import { getBoxes, getTasks, addTask } from './db.js';
import { navigate, openSheet } from './app.js';
import { openAIExtractSheet } from './ai-extract.js';

function getStats() {
  const tasks = getTasks();
  const done = tasks.filter((t) => t.isCompleted).length;
  return { total: tasks.length, done };
}

function cardSizeClass(box) {
  if (box.sortOrder === 0) return 'large';
  if (box.sortOrder === 1 || box.sortOrder === 2) return 'mid';
  return 'small';
}

export function renderHome(app) {
  const boxes = getBoxes();
  const tasks = getTasks();
  const stats = getStats();

  app.innerHTML = `
    <main id="home" class="page">
      <header class="topbar safe-top">
        <h1>TaskBox</h1>
        <div class="row gap8">
          <button class="icon-btn" id="smallWorldBtn" aria-label="小世界">🌐</button>
          <button class="icon-btn" id="aiTopBtn" aria-label="AI提取">✦</button>
          <button class="icon-btn" id="settingsBtn" aria-label="设置">⚙️</button>
        </div>
      </header>

      <section class="today-card">
        <p>今日共 ${stats.total} 项任务 · 已完成 ${stats.done} 项</p>
        <div class="progress"><span style="width:${stats.total ? Math.round((stats.done / stats.total) * 100) : 0}%"></span></div>
      </section>

      <section class="box-grid scroll-area">
        ${boxes.map((b) => {
          const boxTasks = tasks.filter((t) => t.boxId === b.id);
          const pending = boxTasks.filter((t) => !t.isCompleted).length;
          const finished = boxTasks.filter((t) => t.isCompleted).length;
          const pct = boxTasks.length ? Math.round((finished / boxTasks.length) * 100) : 0;
          return `
            <button class="box-card ${cardSizeClass(b)} ${b.color}" data-box-id="${b.id}">
              <div class="box-head"><strong>${b.name}</strong><span>${b.icon}</span></div>
              <div class="box-main"><b>${pending}</b><small>项待完成</small></div>
              <div class="progress"><span style="width:${pct}%"></span></div>
            </button>
          `;
        }).join('')}
      </section>

      <div class="fab-wrap safe-bottom" id="fabWrap">
        <button class="fab-sub" id="fabManual">＋ 手动添加</button>
        <button class="fab-sub" id="fabAI">✦ AI提取</button>
        <button class="fab-main" id="fabMain">＋</button>
      </div>
    </main>
  `;

  app.querySelectorAll('.box-card').forEach((el) => {
    el.addEventListener('click', () => navigate(`#box/${el.dataset.boxId}`));
  });
  app.querySelector('#smallWorldBtn').addEventListener('click', () => navigate('#smallworld'));
  app.querySelector('#settingsBtn').addEventListener('click', () => navigate('#settings'));
  app.querySelector('#aiTopBtn').addEventListener('click', openAIExtractSheet);

  const fabWrap = app.querySelector('#fabWrap');
  app.querySelector('#fabMain').addEventListener('click', () => fabWrap.classList.toggle('open'));
  app.querySelector('#fabAI').addEventListener('click', openAIExtractSheet);
  app.querySelector('#fabManual').addEventListener('click', () => openAddTaskSheet(boxes));
}

function openAddTaskSheet(boxes) {
  const { root, close } = openSheet(`
    <div class="sheet-handle"></div>
    <div class="sheet-content">
      <h3>手动添加任务</h3>
      <label>任务内容<input id="newTaskContent" class="input" placeholder="输入任务"></label>
      <label>所属盒子
        <select id="newTaskBox" class="input">
          ${boxes.map((b) => `<option value="${b.id}">${b.name}</option>`).join('')}
        </select>
      </label>
      <button class="btn primary" id="saveTaskBtn">保存</button>
    </div>
  `, { height: '46vh', onClose: () => {} });

  root.querySelector('#saveTaskBtn').addEventListener('click', () => {
    const content = root.querySelector('#newTaskContent').value.trim();
    const boxId = root.querySelector('#newTaskBox').value;
    if (!content) return;
    addTask({ content, boxId });
    close();
    renderHome(document.getElementById('app'));
  });
}
