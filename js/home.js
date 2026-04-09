import { getBoxes, getTasks, addTask, addBox } from './db.js';
import { navigate, openSheet, showToast } from './app.js';
import { openAIExtractSheet } from './ai-extract.js';

function cardSizeClass(box) {
  if (box.sortOrder === 0) return 'large';
  if (box.sortOrder === 1 || box.sortOrder === 2) return 'mid';
  return 'small';
}

export function renderHome(app) {
  const boxes = getBoxes();
  const tasks = getTasks();

  app.innerHTML = `
    <main id="home" class="page">
      <header class="topbar safe-top">
        <div class="row gap8 center">
          <button class="icon-btn sw-entry-btn" id="smallWorldEntry" aria-label="进入小世界">小世界</button>
          <h1>TaskBox</h1>
        </div>
        <div class="row gap8">
          <button class="icon-btn" id="aiTopBtn" aria-label="AI提取">✦</button>
          <button class="icon-btn" id="settingsBtn" aria-label="设置">⚙️</button>
        </div>
      </header>

      <section class="box-grid scroll-area">
        ${boxes.map((b) => {
          const boxTasks = tasks.filter((t) => t.boxId === b.id);
          const pendingTasks = boxTasks.filter((t) => !t.isCompleted);
          const finished = boxTasks.filter((t) => t.isCompleted).length;
          const pct = boxTasks.length ? Math.round((finished / boxTasks.length) * 100) : 0;
          const importantPreview = b.sortOrder === 0
            ? `<ul class="important-preview">${pendingTasks.slice(0, 3).map((t) => `<li>${t.content}</li>`).join('')}</ul>`
            : `<div class="box-main"><b>${pendingTasks.length}</b></div>`;

          return `
            <button class="box-card ${cardSizeClass(b)} ${b.color}" data-box-id="${b.id}">
              <div class="box-head"><strong>${b.name}</strong><span>${b.icon}</span></div>
              ${importantPreview}
              <div class="progress"><span style="width:${pct}%"></span></div>
            </button>
          `;
        }).join('')}
      </section>

      <div class="fab-wrap safe-bottom" id="fabWrap">
        <button class="fab-sub" id="fabBox">＋ 添加盒子</button>
        <button class="fab-sub" id="fabManual">＋ 手动添加</button>
        <button class="fab-sub" id="fabAI">✦ AI提取</button>
        <button class="fab-main" id="fabMain">＋</button>
      </div>
    </main>
  `;

  app.querySelectorAll('.box-card').forEach((el) => el.addEventListener('click', () => navigate(`#box/${el.dataset.boxId}`)));
  app.querySelector('#smallWorldEntry').addEventListener('click', () => {
    const fx = document.createElement('div');
    fx.className = 'sw-lightflow';
    fx.innerHTML = Array.from({ length: 28 }).map(() => '<span></span>').join('');
    app.appendChild(fx);
    requestAnimationFrame(() => fx.classList.add('show'));
    setTimeout(() => {
      navigate('#smallworld');
      fx.remove();
    }, 420);
  });
  app.querySelector('#settingsBtn').addEventListener('click', () => navigate('#settings'));
  app.querySelector('#aiTopBtn').addEventListener('click', openAIExtractSheet);

  const fabWrap = app.querySelector('#fabWrap');
  app.querySelector('#fabMain').addEventListener('click', () => fabWrap.classList.toggle('open'));
  app.querySelector('#fabAI').addEventListener('click', openAIExtractSheet);
  app.querySelector('#fabManual').addEventListener('click', () => openAddTaskSheet(boxes));
  app.querySelector('#fabBox').addEventListener('click', openAddBoxSheet);
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

function openAddBoxSheet() {
  const { root, close } = openSheet(`
    <div class="sheet-handle"></div>
    <div class="sheet-content">
      <h3>添加新盒子</h3>
      <label>盒子名称<input id="newBoxName" class="input" placeholder="例如：运动盒"></label>
      <label>盒子介绍<textarea id="newBoxDesc" class="input" placeholder="写一句这个盒子是做什么的"></textarea></label>
      <button class="btn primary" id="saveBoxBtn">创建盒子</button>
    </div>
  `, { height: '52vh', onClose: () => {} });

  root.querySelector('#saveBoxBtn').addEventListener('click', async () => {
    const name = root.querySelector('#newBoxName').value.trim();
    const description = root.querySelector('#newBoxDesc').value.trim();
    if (!name) return;
    try {
      await addBox({ name, description });
      showToast('盒子已创建并尝试上传云端');
      close();
      renderHome(document.getElementById('app'));
    } catch (err) {
      showToast(err?.message === 'box exists' ? '盒子名称已存在' : '创建失败，请重试');
    }
  });
}
