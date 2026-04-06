import { getBoxes, getTasksByBox, updateTask, deleteTask, reorderTasks, updateBox, addTask, playSound } from './db.js';
import { navigate, openSheet } from './app.js';
import { openLuckyWheel } from './lucky-wheel.js';

const LONG_PRESS_MS = 500;

export function renderBoxDetail(app, boxId) {
  const box = getBoxes().find((b) => b.id === boxId);
  if (!box) return navigate('#home');

  const tasks = getTasksByBox(boxId);
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
          <button class="icon-btn" id="descBtn">ℹ️</button>
        </div>
      </header>

      <section class="box-progress ${box.color}"><span style="width:${progress}%"></span></section>

      <section class="task-list scroll-area" id="taskList">
        ${openTasks.length === 0 && doneTasks.length === 0 ? `
          <div class="empty-state"><div>${box.icon}</div><h3>还没有任务</h3><p>点击下方按钮添加第一条吧</p></div>
        ` : `
          <div id="openTasks">${openTasks.map((t) => taskItem(t, box.color)).join('')}</div>
          <button class="completed-toggle" id="toggleDone">已完成 ${doneTasks.length} 项 ▾</button>
          <div id="doneTasks">${doneTasks.map((t) => taskItem(t, box.color)).join('')}</div>
        `}
      </section>

      <footer class="safe-bottom footer-fixed">
        <button class="btn primary ${box.color}" id="addTaskBtn">＋ 添加任务</button>
      </footer>
    </main>
  `;

  app.querySelector('#backBtn').addEventListener('click', () => navigate('#home'));
  app.querySelector('#wheelBtn').addEventListener('click', () => openLuckyWheel(box));
  app.querySelector('#descBtn').addEventListener('click', () => openDesc(box));
  app.querySelector('#boxNameInput').addEventListener('blur', (e) => {
    const name = e.target.value.trim();
    if (name) updateBox(box.id, { name });
  });
  app.querySelector('#addTaskBtn').addEventListener('click', () => openTaskEditor({ boxId: box.id }, () => renderBoxDetail(app, box.id)));

  const toggle = app.querySelector('#toggleDone');
  if (toggle) toggle.addEventListener('click', () => app.querySelector('#doneTasks').classList.toggle('collapsed'));

  bindTaskEvents(app, box);
}

function taskItem(t, color) {
  const overdue = t.dueDate && !t.isCompleted && new Date(t.dueDate) < new Date();
  return `
    <article class="task-item ${t.isCompleted ? 'done' : ''}" data-id="${t.id}">
      <button class="delete-btn">删除</button>
      <div class="task-main" data-main="1">
        <button class="check ${color} p${t.priority} ${t.isCompleted ? 'checked' : ''}">${t.isCompleted ? '✓' : ''}</button>
        <button class="task-content" data-action="edit">
          <span>${t.content}</span>
          ${t.dueDate ? `<small class="${overdue ? 'overdue' : ''}">${new Date(t.dueDate).toLocaleDateString()}</small>` : ''}
        </button>
        <span class="grip">⋮⋮</span>
      </div>
    </article>
  `;
}

function bindTaskEvents(app, box) {
  app.querySelectorAll('.task-item').forEach((item) => {
    const taskId = item.dataset.id;
    item.querySelector('.check').addEventListener('click', (e) => {
      e.stopPropagation();
      const checked = item.classList.contains('done');
      updateTask(taskId, { isCompleted: !checked, completedAt: checked ? null : new Date().toISOString() });
      playSound('complete');
      setTimeout(() => renderBoxDetail(app, box.id), 220);
    });

    item.querySelector('[data-action="edit"]').addEventListener('click', () => openTaskEditor({ taskId, boxId: box.id }, () => renderBoxDetail(app, box.id)));

    item.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTask(taskId);
      renderBoxDetail(app, box.id);
    });

    bindSwipeDelete(item);
  });

  enableLongPressReorder(app, box.id);
}

function bindSwipeDelete(item) {
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
      const x = Math.max(dx, -88);
      main.style.transform = `translateX(${x}px)`;
      if (Math.abs(dx) > 10) item.classList.add('delete-revealing');
    }
  }, { passive: true });

  item.addEventListener('touchend', () => {
    if (dx < -60 && Math.abs(dx) > Math.abs(dy)) {
      item.classList.add('swiped');
      main.style.transform = 'translateX(-88px)';
    } else {
      item.classList.remove('swiped', 'delete-revealing');
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
      if (e.target.closest('.check, .delete-btn')) return;
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
    el.addEventListener('pointerleave', () => clearTimeout(timer));
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
          ${[1,2,3].map((p) => `<button class="prio-dot p${p} ${task?.priority === p ? 'active' : ''}" data-p="${p}"></button>`).join('')}
        </div>
      </label>
      <label>截止日期<input id="taskDate" class="input" type="date" value="${task?.dueDate ? task.dueDate.slice(0,10) : ''}"></label>
      <label>所属盒子<select id="taskBox" class="input">${boxes.map((b) => `<option value="${b.id}" ${b.id === (task?.boxId || boxId) ? 'selected' : ''}>${b.name}</option>`).join('')}</select></label>
      <div class="row gap8"><button class="btn" id="cancelBtn">取消</button><button class="btn primary" id="saveBtn">保存</button></div>
    </div>
  `, { height: '70vh' });

  let priority = task?.priority || 2;
  root.querySelectorAll('.prio-dot').forEach((btn) => {
    btn.addEventListener('click', () => {
      priority = Number(btn.dataset.p);
      root.querySelectorAll('.prio-dot').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });

  root.querySelector('#cancelBtn').addEventListener('click', close);
  root.querySelector('#saveBtn').addEventListener('click', () => {
    const content = root.querySelector('#taskContent').value.trim();
    if (!content) return;
    const nextBoxId = root.querySelector('#taskBox').value;
    const due = root.querySelector('#taskDate').value || null;
    if (task) updateTask(task.id, { content, priority, dueDate: due ? new Date(due).toISOString() : null, boxId: nextBoxId });
    else addTask({ boxId: nextBoxId, content, priority, dueDate: due ? new Date(due).toISOString() : null });
    close();
    onDone();
  });
}

function openDesc(box) {
  const { root } = openSheet(`
    <div class="sheet-handle"></div>
    <div class="sheet-content">
      <h3>盒子介绍</h3>
      <textarea id="descText" class="input" rows="6">${box.description || ''}</textarea>
    </div>
  `, { height: '40vh' });
  root.querySelector('#descText').addEventListener('blur', (e) => updateBox(box.id, { description: e.target.value }));
}
