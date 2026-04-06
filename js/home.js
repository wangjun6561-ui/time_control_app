import { getBoxes, getTasks } from './db.js';

const gradientMap = {
  important: 'var(--box-important)',
  relax: 'var(--box-relax)',
  reward: 'var(--box-reward)',
  punish: 'var(--box-punish)',
  misc: 'var(--box-misc)'
};

function boxClassBySort(index) {
  if (index === 0) return 'big';
  if (index === 1 || index === 2) return 'medium';
  if (index === 3) return 'wide';
  return 'small';
}

export function renderHome({ navigate, openAiExtractSheet }) {
  const root = document.getElementById('home');
  const boxes = getBoxes();
  const tasks = getTasks();
  const done = tasks.filter((t) => t.isCompleted).length;

  root.innerHTML = `
    <header class="header">
      <div class="title">TaskBox</div>
      <div>
        <button class="icon-btn" id="home-ai" aria-label="AI 提取">✦</button>
        <button class="icon-btn" id="home-settings" aria-label="设置">⚙️</button>
      </div>
    </header>
    <article class="today-card">
      <div>今日共 ${tasks.length} 项任务 · 已完成 ${done} 项</div>
      <div class="progress-track" style="margin-top:10px"><div class="progress-fill" style="transform:scaleX(${tasks.length ? done / tasks.length : 0})"></div></div>
    </article>
    <section class="box-grid" id="box-grid"></section>
    <div class="fab-wrap" id="fab-wrap">
      <div class="fab-actions">
        <button class="fab-action" id="fab-add">＋ 手动添加</button>
        <button class="fab-action" id="fab-ai">✦ AI提取</button>
      </div>
      <button class="fab-main" id="fab-main">＋</button>
    </div>
  `;

  const grid = root.querySelector('#box-grid');
  boxes.forEach((box, i) => {
    const total = tasks.filter((t) => t.boxId === box.id).length;
    const pending = tasks.filter((t) => t.boxId === box.id && !t.isCompleted).length;
    const progress = total ? (total - pending) / total : 0;
    const btn = document.createElement('button');
    btn.className = `box-card ${boxClassBySort(i)}`;
    btn.style.background = gradientMap[box.color] || gradientMap.misc;
    btn.innerHTML = `
      <div class="box-name">${box.name}</div>
      <div class="box-icon">${box.icon}</div>
      <div class="box-count">${pending}<small> 项待完成</small></div>
      <div class="progress-track"><div class="progress-fill" style="transform:scaleX(${progress})"></div></div>
    `;
    btn.addEventListener('click', () => navigate('box-detail', { boxId: box.id }));
    grid.appendChild(btn);
  });

  root.querySelector('#home-settings').addEventListener('click', () => navigate('settings'));
  root.querySelector('#home-ai').addEventListener('click', () => openAiExtractSheet({ navigate }));

  const fabWrap = root.querySelector('#fab-wrap');
  root.querySelector('#fab-main').addEventListener('click', () => fabWrap.classList.toggle('open'));
  root.querySelector('#fab-ai').addEventListener('click', () => openAiExtractSheet({ navigate }));
  root.querySelector('#fab-add').addEventListener('click', () => {
    const first = boxes[0];
    if (first) navigate('box-detail', { boxId: first.id });
  });
}
