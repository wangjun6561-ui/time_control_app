import { exportData, getSettings, importData, saveSettings } from './db.js';

export function renderSettings({ navigate, showToast }) {
  const root = document.getElementById('settings');
  const s = getSettings();

  root.innerHTML = `
    <header class="header"><button class="icon-btn" id="back">←</button><div class="title">设置</div><div></div></header>
    <section class="card">
      <h3>DeepSeek API Key</h3>
      <div style="display:flex;gap:8px">
        <input id="api-key" type="password" value="${s.deepseekApiKey || ''}" />
        <button id="toggle-eye" class="btn">👁️</button>
      </div>
    </section>
    <section class="card">
      <h3>主题模式</h3>
      <div class="theme-tabs">
        <button class="btn ${s.themeMode === 'system' ? 'active' : ''}" data-theme="system">跟随系统</button>
        <button class="btn ${s.themeMode === 'light' ? 'active' : ''}" data-theme="light">浅色</button>
        <button class="btn ${s.themeMode === 'dark' ? 'active' : ''}" data-theme="dark">深色</button>
      </div>
    </section>
    <section class="card">
      <h3>完成音效</h3>
      <label><input id="sound" type="checkbox" ${s.soundEnabled ? 'checked' : ''} /> 开启音效</label>
    </section>
    <section class="card">
      <h3>数据管理</h3>
      <div style="display:flex;gap:8px"><button id="export" class="btn">导出数据</button><button id="import" class="btn">导入数据</button></div>
      <input id="file" type="file" accept="application/json" style="display:none" />
    </section>
    <section class="card"><h3>关于 TaskBox</h3><p style="font-size:13px;color:var(--text-secondary)">v1.0.0 · 游戏化任务管理</p></section>
  `;

  root.querySelector('#back').addEventListener('click', () => navigate('home'));
  const keyInput = root.querySelector('#api-key');
  keyInput.addEventListener('blur', () => saveSettings({ deepseekApiKey: keyInput.value.trim() }));
  root.querySelector('#toggle-eye').addEventListener('click', () => {
    keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
  });

  root.querySelectorAll('[data-theme]').forEach((btn) => btn.addEventListener('click', (e) => {
    const themeMode = e.target.dataset.theme;
    saveSettings({ themeMode });
    applyTheme(themeMode);
    renderSettings({ navigate, showToast });
  }));

  root.querySelector('#sound').addEventListener('change', (e) => saveSettings({ soundEnabled: e.target.checked }));

  root.querySelector('#export').addEventListener('click', () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'taskbox-backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  const fileInput = root.querySelector('#file');
  root.querySelector('#import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('导入将覆盖当前所有数据，确认继续？')) return;
    const text = await file.text();
    importData(JSON.parse(text));
    showToast('导入成功');
    navigate('home');
  });
}

function applyTheme(mode) {
  document.documentElement.style.colorScheme = mode === 'system' ? 'light dark' : mode;
  if (mode === 'light') document.body.style.background = '#F8F9FA';
  if (mode === 'dark') document.body.style.background = '#1A1A2E';
}
