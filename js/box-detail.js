import { getBoxes, getTasksByBox, updateTask, deleteTask, reorderTasks, updateBox, addTask, playSound, restoreTask } from './db.js';
import { navigate, openSheet } from './app.js';
import { openLuckyWheel } from './lucky-wheel.js';

const LONG_PRESS_MS = 500;
const DELETE_SWIPE_THRESHOLD = 120;

let undoTimer = null;

function getPriorityColor(priority) {
  if (priority === 3) return '#ff4d4f';
  if (priority === 2) return '#ff922b';
  if (priority === 1) return '#adb5bd';
  return '#111111';
}

function showUndo(task, onUndo, onExpire) {
  clearTimeout(undoTimer);
  document.querySelector('.undo-banner')?.remove();

  const banner = document.createElement('div');
  banner.className = 'undo-banner';
  banner.innerHTML = `已删除任务：${task.content} <button id="undoBtn">撤销</button>`;
  document.body.appendChild(banner);

  banner.querySelector('#undoBtn').addEventListener('click', () => {
    clearTimeout(undoTimer);
    banner.remove();
    onUndo();
  });

  undoTimer = setTimeout(() => {
    banner.remove();
    onExpire?.();
  }, 3000);
}

export function renderBoxDetail(app, boxId) {
  const box = getBoxes().find((b) => b.id === boxId);
  if (!box) return navigate('#home');

  const tasks = getTasksByBox(boxId);
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const openTasks = tasks.filter((t) => !t.isCompleted);
  const doneTasks = tasks.filter((t) => t.isCompleted);
  const progress = tasks.length ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  app.innerHTML = `
    <main id="box-detail" class="page">
      <header class="topbar safe-top">
        <button class="icon-btn" id="backBtn">← 返回</button>
        <input id="boxNameInput" class="title-input" value="${box.name}">
        <div class="row gap8">
          <button class="icon-btn" id="wheelBtn">🎡</button>
          <button class="icon-btn" id="settingsBtn">⚙️</button>
        </div>
      </header>

      <section class="box-progress ${box.color}"><span style="width:${progress}%"></span></section>

      <section class="task-list scroll-area" id="taskList">
        ${openTasks.length === 0 && doneTasks.length === 0 ? `
          <div class="empty-state"><div>${box.icon}</div><h3>还没有任务</h3><p>点击下方按钮添加第一条吧</p></div>
        ` : `
          <div id="openTasks">${openTasks.map((t) => taskItem(t)).join('')}</div>
          <button class="completed-toggle" id="toggleDone">已完成 ${doneTasks.length} 项 ▾</button>
          <div id="doneTasks">${doneTasks.map((t) => taskItem(t)).join('')}</div>
        `}
      </section>

      <footer class="safe-bottom footer-fixed">
        <button class="btn primary ${box.color}" id="addTaskBtn">＋ 添加任务</button>
      </footer>
    </main>
  `;

  app.querySelector('#backBtn').addEventListener('click', () => navigate('#home'));
  app.querySelector('#wheelBtn').addEventListener('click', () => openLuckyWheel(box));
  app.querySelector('#settingsBtn').addEventListener('click', () => navigate('#settings'));
  app.querySelector('#boxNameInput').addEventListener('blur', (e) => {
    const name = e.target.value.trim();
    if (name) updateBox(box.id, { name });
  });
  app.querySelector('#addTaskBtn').addEventListener('click', () => openTaskEditor({ boxId: box.id }, () => renderBoxDetail(app, box.id)));

  const toggle = app.querySelector('#toggleDone');
  if (toggle) toggle.addEventListener('click', () => app.querySelector('#doneTasks').classList.toggle('collapsed'));

  bindTaskEvents(app, box, taskMap);
}

function taskItem(t) {
  const overdue = t.dueDate && !t.isCompleted && new Date(t.dueDate) < new Date();
  const color = getPriorityColor(t.priority ?? 0);
  const taskProgress = Math.max(0, Math.min(100, Number(t.progress) || 0));
  const hasNote = Boolean((t.note || '').trim());
  return `
    <article class="task-item ${t.isCompleted ? 'done' : ''}" data-id="${t.id}">
      <div class="task-main" data-main="1">
        <button class="check ${t.isCompleted ? 'checked' : ''}" style="--check-color:${color}">${t.isCompleted ? '✓' : ''}</button>
        <button class="task-content" data-action="edit">
          <span>${t.content}${hasNote ? ' <small class="task-note-icon" title="已添加备注">📝</small>' : ''}</span>
          ${t.dueDate ? `<small class="${overdue ? 'overdue' : ''}">${new Date(t.dueDate).toLocaleDateString()}</small>` : ''}
          <div class="mini-progress"><span style="width:${taskProgress}%; background:${color}"></span></div>
        </button>
        <span class="grip">⋮⋮</span>
      </div>
    </article>
  `;
}

function bindTaskEvents(app, box, taskMap) {
  app.querySelectorAll('.task-item').forEach((item) => {
    const taskId = item.dataset.id;
    item.querySelector('.check').addEventListener('click', (e) => {
      e.stopPropagation();
      const checked = item.classList.contains('done');
      updateTask(taskId, {
        isCompleted: !checked,
        progress: checked ? 80 : 100,
        completedAt: checked ? null : new Date().toISOString(),
      });
      playSound('complete');
      setTimeout(() => renderBoxDetail(app, box.id), 220);
    });

    item.querySelector('[data-action="edit"]').addEventListener('click', () => openTaskEditor({ taskId, boxId: box.id }, () => renderBoxDetail(app, box.id)));

    bindSwipeDelete(item, box.id, app, taskMap.get(taskId));
  });

  enableLongPressReorder(app, box.id);
}

function bindSwipeDelete(item, boxId, app, taskSnapshot) {
  const main = item.querySelector('.task-main');
  let sx = 0;
  let sy = 0;
  let dx = 0;
  let dy = 0;

  item.addEventListener('touchstart', (e) => {
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    dx = 0;
    dy = 0;
  }, { passive: true });

  item.addEventListener('touchmove', (e) => {
    dx = e.touches[0].clientX - sx;
    dy = e.touches[0].clientY - sy;

    if (Math.abs(dx) > Math.abs(dy) && dx < 0) {
      const x = Math.max(dx, -window.innerWidth * 0.9);
      main.style.transform = `translateX(${x}px)`;
    }
  }, { passive: true });

  item.addEventListener('touchend', () => {
    if (dx < -DELETE_SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      main.style.transform = `translateX(-120%)`;
      setTimeout(() => {
        deleteTask(taskSnapshot.id);
        renderBoxDetail(app, boxId);
        showUndo(taskSnapshot, () => {
          restoreTask(taskSnapshot);
          renderBoxDetail(app, boxId);
        });
      }, 120);
    } else {
      main.style.transform = '';
    }
  });
}

function enableLongPressReorder(app, boxId) {
  const list = app.querySelector('#openTasks');
  if (!list) return;

  let timer = null;
  let dragging = null;
  let pointerId = null;

  const onMove = (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('.task-item');
    if (under && under !== dragging && under.parentElement === list) {
      const rect = under.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      list.insertBefore(dragging, before ? under : under.nextSibling);
    }
  };

  const onUp = (e) => {
    clearTimeout(timer);
    if (!dragging || e.pointerId !== pointerId) return;
    dragging.classList.remove('dragging');
    const ids = Array.from(list.children).map((x) => x.dataset.id);
    reorderTasks(boxId, ids);
    dragging = null;
    pointerId = null;
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    renderBoxDetail(app, boxId);
  };

  list.querySelectorAll('.task-item').forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.check')) return;
      clearTimeout(timer);
      pointerId = e.pointerId;
      timer = setTimeout(() => {
        dragging = el;
        dragging.classList.add('dragging');
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onUp);
      }, LONG_PRESS_MS);
    });

    el.addEventListener('pointerup', () => clearTimeout(timer));
    el.addEventListener('pointercancel', () => clearTimeout(timer));
  });
}

function openTaskEditor({ taskId, boxId }, onDone) {
  const boxes = getBoxes();
  const currentTasks = getTasksByBox(boxId);
  const task = currentTasks.find((x) => x.id === taskId);
  const { root, close } = openSheet(`
    <div class="sheet-handle"></div>
    <div class="sheet-content">
      <h3>${task ? '编辑任务' : '添加任务'}</h3>
      <label>任务内容<input id="taskContent" class="input" value="${task?.content || ''}"></label>
      <label>优先级
        <div class="priority-select">
          ${[0,1,2,3].map((p) => `<button class="prio-dot p${p} ${((task?.priority ?? 0) === p) ? 'active' : ''}" data-p="${p}">${p===0?'无':''}</button>`).join('')}
        </div>
      </label>
      <label>完成进度
        <div class="progress-select">
          ${[20,40,60,80,100].map((v) => `<button class="progress-dot ${(task?.progress||0)===v?'active':''}" data-progress="${v}">${v}%</button>`).join('')}
        </div>
      </label>
      <label>截止日期<input id="taskDate" class="input" type="date" value="${task?.dueDate ? task.dueDate.slice(0,10) : ''}"></label>
      <label>抽奖权重（选填，默认1）<input id="taskWeight" class="input" type="number" min="1" step="1" placeholder="1" value="${task?.weight ?? ''}"></label>
      <label>所属盒子<select id="taskBox" class="input">${boxes.map((b) => `<option value="${b.id}" ${b.id === (task?.boxId || boxId) ? 'selected' : ''}>${b.name}</option>`).join('')}</select></label>
      <label>备注（可选）<textarea id="taskNote" class="input" rows="3">${task?.note || ''}</textarea></label>
      <div class="row gap8"><button class="btn" id="cancelBtn">取消</button><button class="btn primary" id="saveBtn">保存</button></div>
    </div>
  `, { height: '75vh' });

  let priority = task?.priority ?? 0;
  let progress = task?.progress ?? 0;

  root.querySelectorAll('.prio-dot').forEach((btn) => {
    btn.addEventListener('click', () => {
      priority = Number(btn.dataset.p);
      root.querySelectorAll('.prio-dot').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });

  root.querySelectorAll('.progress-dot').forEach((btn) => {
    btn.addEventListener('click', () => {
      progress = Number(btn.dataset.progress);
      root.querySelectorAll('.progress-dot').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });

  root.querySelector('#cancelBtn').addEventListener('click', close);
  root.querySelector('#saveBtn').addEventListener('click', () => {
    const content = root.querySelector('#taskContent').value.trim();
    if (!content) return;
    const nextBoxId = root.querySelector('#taskBox').value;
    const due = root.querySelector('#taskDate').value || null;
    const weight = Math.max(1, Number(root.querySelector('#taskWeight').value) || 1);
    const done = progress >= 100;
    const payload = {
      content,
      priority,
      progress,
      weight,
      dueDate: due ? new Date(due).toISOString() : null,
      boxId: nextBoxId,
      note: root.querySelector('#taskNote').value.trim(),
      isCompleted: done,
      completedAt: done ? (task?.completedAt || new Date().toISOString()) : null,
    };

    if (task) updateTask(task.id, payload);
    else addTask(payload);

    close();
    onDone();
  });
}
