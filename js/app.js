import { getBoxes, getSettings, pullDataFromCloud } from './db.js';
import { renderHome } from './home.js';
import { renderBoxDetail } from './box-detail.js';
import { openAIExtractSheet } from './ai-extract.js';
import { renderSettings } from './settings.js';
import { renderSmallWorldMap, renderSmallWorldFloor, renderSmallWorldSettings } from './small-world.js';

const app = document.getElementById('app');

export function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

export function checkOnline() {
  if (!navigator.onLine) {
    showToast('当前无网络，AI 提取需要联网使用');
    return false;
  }
  return true;
}

export function openSheet(contentHtml, { height = '70vh', onClose } = {}) {
  const root = document.getElementById('bottom-sheet-root');
  root.innerHTML = `
    <div class="sheet-backdrop"></div>
    <section class="bottom-sheet" style="height:${height}">${contentHtml}</section>
  `;

  const backdrop = root.querySelector('.sheet-backdrop');
  const sheet = root.querySelector('.bottom-sheet');

  requestAnimationFrame(() => {
    backdrop.classList.add('show');
    sheet.classList.add('show');
  });

  const close = () => {
    backdrop.classList.remove('show');
    sheet.classList.remove('show');
    setTimeout(() => {
      root.innerHTML = '';
      onClose?.();
    }, 220);
  };

  backdrop.addEventListener('click', close);

  let startY = 0;
  let moved = 0;
  sheet.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
    moved = 0;
  }, { passive: true });
  sheet.addEventListener('touchmove', (e) => {
    moved = e.touches[0].clientY - startY;
    if (moved > 0) sheet.style.transform = `translateY(${Math.min(moved, 120)}px)`;
  }, { passive: true });
  sheet.addEventListener('touchend', () => {
    if (moved > 80) close();
    else sheet.style.transform = '';
  });

  return { root, sheet, close };
}

function applyTheme() {
  const mode = getSettings().themeMode;
  document.documentElement.dataset.theme = mode;
}

export function navigate(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function route() {
  applyTheme();
  const parts = (location.hash || '#home').replace('#', '').split('/').filter(Boolean);
  const [path, param, subParam] = parts;
  if (path === 'home') renderHome(app);
  else if (path === 'box') renderBoxDetail(app, param);
  else if (path === 'settings') renderSettings(app);
  else if (path === 'smallworld') renderSmallWorldMap(app);
  else if (path === 'sw-settings') renderSmallWorldSettings(app);
  else if (path === 'sw' && (param === 'pavilion' || param === 'tower') && subParam) {
    renderSmallWorldFloor(app, param, subParam).catch(() => {
      showToast('楼层数据加载失败');
      location.hash = '#smallworld';
    });
  } else location.hash = '#home';
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(() => {});
}

function setupAudioUnlock() {
  let audioUnlocked = false;
  document.addEventListener('touchstart', () => {
    if (audioUnlocked) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    ctx.resume();
    audioUnlocked = true;
  }, { once: true });
}

function setupKeyboardInsets() {
  if (!window.visualViewport) return;
  const update = () => {
    const inset = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
    document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`);
  };
  window.visualViewport.addEventListener('resize', update);
  update();
}

async function tryCloudPull() {
  try {
    const result = await pullDataFromCloud();
    if (result === 'merged') showToast('已自动合并云端数据');
  } catch {
    // no-op
  }
}

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', async () => {
  getBoxes();
  setupAudioUnlock();
  setupKeyboardInsets();
  registerServiceWorker();
  await tryCloudPull();
  route();
});

window.TaskBoxApp = {
  navigate,
  openAIExtractSheet: () => {
    if (!checkOnline()) return;
    openAIExtractSheet();
  },
  showToast,
};
