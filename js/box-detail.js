import { addTask, deleteTask, getBoxes, getTasks, playSound, reorderTasks, updateBox, updateTask } from './db.js';
import { openWheelSheet } from './lucky-wheel.js';

const colorHex = {
  important: '#FF6B6B',
  relax: '#4ECDC4',
  reward: '#FFB940',
  punish: '#6C757D',
  misc: '#6C5CE7'
};

function dueText(dueDate) {
  if (!dueDate) return '';
  const d = new Date(dueDate);
  const today = new Date();
  const over = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return `<div class="task-due ${over ? 'overdue' : ''}">${over ? '已逾期 ' : '截止 '}${d.toLocaleDateString()}</div>`;
}

export function renderBoxDetail({ navigate, state, openSheet, showToast }) {
  const root = document.getElementById('box-detail');
  const boxes = getBoxes();
  const box = boxes.find((b) => b.id === state.boxId) || boxes[0];
  if (!box) return;
  const tasks = getTasks().filter((t) => t.boxId === box.id);
  const pending = tasks.filter((t) => !t.isCompleted);
  const completed = tasks.filter((t) => t.isCompleted);

  root.innerHTML = `
    <header class="header">
      <button class="icon-btn" id="back">←</button>
      <input id="box-name" value="${box.name}" aria-label="盒子名称" />
      <div>
        <button class="icon-btn" id="wheel">🎡</button>
        <button class="icon-btn" id="intro">ℹ️</button>
      </div>
    </header>
    <div class="card">
      <div class="progress-track"><div class="progress-fill" style="background:${colorHex[box.color]};transform:scaleX(${tasks.length ? completed.length / tasks.length : 0})"></div></div>
    </div>
    <section id="pending-list" class="task-list"></section>
    <section class="card">
      <button class="btn" id="toggle-done">已完成 ${completed.length} 项 ▾</button>
      <div id="done-wrap" style="display:none"></div>
    </section>
    <div class="bottom-fixed"><button class="btn primary" id="add-task">＋ 添加任务</button></div>
  `;

  root.querySelector('#back').addEventListener('click', () => navigate('home'));
  root.querySelector('#wheel').addEventListener('click', () => openWheelSheet({ openSheet, box }));
  root.querySelector('#intro').addEventListener('click', () => {
    openSheet((sheet) => {
      sheet.innerHTML += `<h3>${box.name} 介绍</h3><textarea id="desc">${box.description || ''}</textarea>`;
      const ta = sheet.querySelector('#desc');
      ta.addEventListener('blur', () => updateBox(box.id, { description: ta.value.trim() }));
    }, { height: '42vh' });
  }, { passive: true });

  root.querySelector('#box-name').addEventListener('blur', (e) => updateBox(box.id, { name: e.target.value.trim() || box.name }));

  const pendingList = root.querySelector('#pending-list');
  const doneWrap = root.querySelector('#done-wrap');
  const toggleDoneBtn = root.querySelector('#toggle-done');

  if (!tasks.length) {
    pendingList.innerHTML = '<div class="empty-state"><div class="emoji">📭</div><div>还没有任务</div><div>点击下方按钮添加第一条吧</div></div>';
  }

  const buildTaskRow = (task) => {
    const row = document.createElement('article');
    row.className = `task-item ${task.isCompleted ? 'done' : ''}`;
    row.dataset.taskId = task.id;
    row.innerHTML = `
      ${task.priority ? `<div class="priority-dot priority-${task.priority}"></div>` : ''}
      <button class="check-btn">✓</button>
      <div class="task-content" role="button" tabindex="0">${task.content}${dueText(task.dueDate)}</div>
      <button class="drag-handle">⋮⋮</button>
      <button class="task-delete">删除</button>
    `;

    row.querySelector('.check-btn').addEventListener('click', () => {
      const toDone = !task.isCompleted;
      updateTask(task.id, { isCompleted: toDone, completedAt: toDone ? new Date().toISOString() : null });
      if (toDone) playSound('complete');
      renderBoxDetail({ navigate, state: { ...state, boxId: box.id }, openSheet, showToast });
    });

    row.querySelector('.task-content').addEventListener('click', () => openTaskEditor(task, boxes, openSheet, () => renderBoxDetail({ navigate, state: { ...state, boxId: box.id }, openSheet, showToast })));

    initSwipeToDelete(row, () => {
      deleteTask(task.id);
      renderBoxDetail({ navigate, state: { ...state, boxId: box.id }, openSheet, showToast });
    });

    return row;
  };

  pending.forEach((t) => pendingList.appendChild(buildTaskRow(t)));
  completed.forEach((t) => doneWrap.appendChild(buildTaskRow(t)));

  toggleDoneBtn.addEventListener('click', () => {
    doneWrap.style.display = doneWrap.style.display === 'none' ? 'block' : 'none';
  });

  root.querySelector('#add-task').style.background = colorHex[box.color];
  root.querySelector('#add-task').addEventListener('click', () => {
    addTask({ boxId: box.id, content: '新任务' });
    showToast('已添加任务');
    renderBoxDetail({ navigate, state: { ...state, boxId: box.id }, openSheet, showToast });
  });

  initPointerReorder(pendingList, box.id, () => renderBoxDetail({ navigate, state: { ...state, boxId: box.id }, openSheet, showToast }));
}

function initSwipeToDelete(row, onDelete) {
  let sx = 0; let sy = 0;
  row.addEventListener('touchstart', (e) => {
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  }, { passive: true });

  row.addEventListener('touchmove', (e) => {
    const dx = e.touches[0].clientX - sx;
    const dy = e.touches[0].clientY - sy;
    if (Math.abs(dx) > Math.abs(dy) && dx < -20) row.style.setProperty('--swipe-x', `${Math.max(-68, dx)}px`);
  }, { passive: true });

  row.addEventListener('touchend', () => {
    const x = Number((row.style.getPropertyValue('--swipe-x') || '0px').replace('px', ''));
    row.style.setProperty('--swipe-x', x < -60 ? '-68px' : '0px');
  });

  row.querySelector('.task-delete').addEventListener('click', onDelete);
}

function initPointerReorder(list, boxId, onDone) {
  let dragging = null;
  let ghost = null;
  let longPressTimer = null;

  list.querySelectorAll('.task-item').forEach((item) => {
    item.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.check-btn,.task-delete')) return;
      longPressTimer = setTimeout(() => {
        dragging = item;
        ghost = item.cloneNode(true);
        ghost.style.opacity = '0.7';
        ghost.style.position = 'fixed';
        ghost.style.zIndex = 99;
        ghost.style.pointerEvents = 'none';
        document.body.appendChild(ghost);
      }, 500);
    });

    item.addEventListener('pointermove', (e) => {
      if (!dragging || !ghost) return;
      ghost.style.left = '12px';
      ghost.style.top = `${e.clientY - 24}px`;
      const below = [...list.children].find((c) => c !== dragging && e.clientY < c.getBoundingClientRect().top + c.offsetHeight / 2);
      if (below) list.insertBefore(dragging, below); else list.appendChild(dragging);
    });

    item.addEventListener('pointerup', () => {
      clearTimeout(longPressTimer);
      if (!dragging) return;
      ghost?.remove();
      dragging = null;
      const ids = [...list.querySelectorAll('.task-item')].map((n) => n.dataset.taskId);
      reorderTasks(boxId, ids);
      onDone();
    });
    item.addEventListener('pointerleave', () => clearTimeout(longPressTimer));
  });
}

function openTaskEditor(task, boxes, openSheet, refresh) {
  openSheet((sheet, close) => {
    sheet.innerHTML += `
      <h3>编辑任务</h3>
      <textarea id="t-content">${task.content}</textarea>
      <label>优先级</label>
      <select id="t-priority">
        <option value="1" ${task.priority === 1 ? 'selected' : ''}>低</option>
        <option value="2" ${task.priority === 2 ? 'selected' : ''}>中</option>
        <option value="3" ${task.priority === 3 ? 'selected' : ''}>高</option>
      </select>
      <label>截止日期</label>
      <input id="t-due" type="date" value="${task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ''}" />
      <label>所属盒子</label>
      <select id="t-box">
        ${boxes.map((b) => `<option value="${b.id}" ${b.id === task.boxId ? 'selected' : ''}>${b.name}</option>`).join('')}
      </select>
      <div style="display:flex;gap:8px;margin-top:12px"><button id="cancel" class="btn">取消</button><button id="save" class="btn primary">保存</button></div>
    `;

    sheet.querySelector('#cancel').addEventListener('click', close);
    sheet.querySelector('#save').addEventListener('click', () => {
      updateTask(task.id, {
        content: sheet.querySelector('#t-content').value.trim() || task.content,
        priority: Number(sheet.querySelector('#t-priority').value),
        dueDate: sheet.querySelector('#t-due').value ? new Date(sheet.querySelector('#t-due').value).toISOString() : null,
        boxId: sheet.querySelector('#t-box').value
      });
      close();
      refresh();
    });
  }, { height: '64vh' });
}
