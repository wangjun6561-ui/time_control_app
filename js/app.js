import { renderHome } from './home.js';
import { renderBoxDetail } from './box-detail.js';
import { renderSettings } from './settings.js';
import { openAiExtractSheet } from './ai-extract.js';
import { getBoxes } from './db.js';

const routes = ['home', 'box-detail', 'settings'];
const state = { route: 'home', boxId: null };

export function showToast(text) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => t.classList.remove('show'), 1800);
}

export function navigate(route, params = {}) {
  const prev = document.getElementById(state.route);
  const next = document.getElementById(route);
  if (!next || route === state.route) return;

  next.classList.add('is-active', 'page-enter');
  requestAnimationFrame(() => {
    next.classList.add('page-enter-active');
    prev?.classList.add('page-exit-active');
    setTimeout(() => {
      prev?.classList.remove('is-active', 'page-exit-active');
      next.classList.remove('page-enter', 'page-enter-active');
    }, 200);
  });

  state.route = route;
  Object.assign(state, params);
  render();
}

export function openSheet(renderFn, { height = '70vh' } = {}) {
  const root = document.getElementById('sheet-root');
  const mask = document.createElement('div');
  mask.className = 'sheet-mask';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.style.height = height;
  sheet.innerHTML = '<div class="drag-bar"></div>';
  root.append(mask, sheet);

  const close = () => {
    sheet.classList.remove('show');
    mask.remove();
    setTimeout(() => sheet.remove(), 220);
  };

  let startY = 0;
  sheet.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener('touchmove', (e) => {
    if (e.touches[0].clientY - startY > 80) close();
  }, { passive: true });

  mask.addEventListener('click', close);
  renderFn(sheet, close);
  requestAnimationFrame(() => sheet.classList.add('show'));
  return close;
}

export function checkOnline() {
  if (!navigator.onLine) {
    showToast('当前无网络，AI 提取需要联网使用');
    return false;
  }
  return true;
}

function hookKeyboardSafeArea() {
  if (!window.visualViewport) return;
  const update = () => {
    const keyboardHeight = Math.max(0, window.innerHeight - window.visualViewport.height);
    document.querySelectorAll('.bottom-fixed').forEach((el) => {
      el.style.transform = keyboardHeight > 0 ? `translateY(-${keyboardHeight}px)` : 'translateY(0)';
    });
  };
  window.visualViewport.addEventListener('resize', update);
}

function render() {
  if (state.route === 'home') renderHome({ navigate, openAiExtractSheet });
  if (state.route === 'box-detail') renderBoxDetail({ navigate, state, openSheet, showToast });
  if (state.route === 'settings') renderSettings({ navigate, showToast });
}

function bindGlobalAudioUnlock() {
  let audioUnlocked = false;
  const unlock = () => {
    if (audioUnlocked) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume();
    audioUnlocked = true;
  };
  document.addEventListener('touchstart', unlock, { once: true, passive: true });
  document.addEventListener('mousedown', unlock, { once: true });
}

function boot() {
  for (const route of routes) {
    const el = document.getElementById(route);
    if (!el) throw new Error(`缺少页面节点: ${route}`);
  }
  render();
  hookKeyboardSafeArea();
  bindGlobalAudioUnlock();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

boot();

window.TaskBoxApp = {
  navigate,
  openAiExtractSheet: () => openAiExtractSheet({ getBoxNames: () => getBoxes().map((b) => b.name), navigate, openSheet, showToast })
};
