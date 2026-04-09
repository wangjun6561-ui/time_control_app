import { navigate } from './app.js';

const FLOORS = {
  pavilion: ['1', '2', '3'],
  tower: ['1', '2', '3', '4', '5'],
};

function getFloors(type) {
  return FLOORS[type] || FLOORS.pavilion;
}

export function renderSmallWorldMap(app) {
  app.innerHTML = `
    <main id="smallworld" class="page">
      <header class="topbar safe-top">
        <button class="icon-btn" id="smallWorldBackBtn" aria-label="返回首页">←</button>
        <h1>小世界</h1>
        <span></span>
      </header>

      <section class="panel">
        <h3>选择区域</h3>
        <div class="row gap8" style="margin-top: 12px;">
          <button class="btn" id="openPavilionBtn" aria-label="打开小世界展馆">展馆</button>
          <button class="btn" id="openTowerBtn" aria-label="打开小世界高塔">高塔</button>
        </div>
      </section>
    </main>
  `;

  app.querySelector('#smallWorldBackBtn').addEventListener('click', () => navigate('#home'));
  app.querySelector('#openPavilionBtn').addEventListener('click', () => navigate('#sw/pavilion/1'));
  app.querySelector('#openTowerBtn').addEventListener('click', () => navigate('#sw/tower/1'));
}

export function renderSmallWorldFloor(app, type, floor) {
  const floors = getFloors(type);
  const safeFloor = floors.includes(String(floor)) ? String(floor) : floors[0];

  app.innerHTML = `
    <main id="smallworld-floor" class="page">
      <header class="topbar safe-top">
        <button class="icon-btn" id="smallWorldMapBtn" aria-label="返回小世界地图">←</button>
        <h1>小世界 · ${type === 'tower' ? '高塔' : '展馆'} ${safeFloor} 层</h1>
        <span></span>
      </header>

      <section class="panel">
        <p>当前区域：${type === 'tower' ? '高塔' : '展馆'}</p>
        <p>当前楼层：${safeFloor} 层</p>
        <div class="row gap8" style="flex-wrap: wrap; margin-top: 12px;">
          ${floors.map((level) => `
            <button class="btn ${level === safeFloor ? 'primary' : ''}" data-floor="${level}" aria-label="查看${level}层">
              ${level} 层
            </button>
          `).join('')}
        </div>
      </section>
    </main>
  `;

  app.querySelector('#smallWorldMapBtn').addEventListener('click', () => navigate('#smallworld'));
  app.querySelectorAll('[data-floor]').forEach((el) => {
    el.addEventListener('click', () => navigate(`#sw/${type}/${el.dataset.floor}`));
  });
}
