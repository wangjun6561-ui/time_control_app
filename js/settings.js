import { getSettings, setSettings, exportData, importData, pushDataToCloud, pullDataFromCloud, exportDailySummary } from './db.js';
import { navigate, showToast } from './app.js';

export function renderSettings(app) {
  const settings = getSettings();
  app.innerHTML = `
    <main id="settings" class="page">
      <header class="topbar safe-top">
        <button class="icon-btn" id="backBtn">← 返回</button>
        <h2>设置</h2>
        <span></span>
      </header>

      <section class="panel">
        <label>DeepSeek API Key
          <div class="row">
            <input id="apiKey" class="input" type="password" value="${settings.deepseekApiKey}">
            <button class="icon-btn" id="toggleKey">👁️</button>
          </div>
        </label>
      </section>

      <section class="panel">
        <p>主题模式</p>
        <div class="tabs" id="themeTabs">
          ${[['system','跟随系统'],['light','浅色'],['dark','深色']].map(([v, n]) => `<button class="tab ${settings.themeMode === v ? 'active' : ''}" data-theme="${v}">${n}</button>`).join('')}
        </div>
      </section>

      <section class="panel row between center">
        <p>完成音效</p>
        <label class="switch"><input id="soundEnabled" type="checkbox" ${settings.soundEnabled ? 'checked' : ''}><span></span></label>
      </section>

      <section class="panel">
        <p>云端同步（多设备一致）</p>
        <label class="row between center">启用云同步
          <label class="switch"><input id="cloudEnabled" type="checkbox" ${settings.cloudEnabled ? 'checked' : ''}><span></span></label>
        </label>
        <label>云端接口 URL（支持 GET/PUT；JSONBin 可直接填 /v3/b/BinID）
          <input id="cloudEndpoint" class="input" value="${settings.cloudEndpoint || ''}" placeholder="./cloud-sync.json 或 https://example.com/taskbox.json">
        </label>
        <label>访问令牌（可选）
          <input id="cloudToken" class="input" type="password" value="${settings.cloudToken || ''}" placeholder="Bearer Token">
        </label>
        <div class="row gap8">
          <button class="btn" id="pullCloudBtn">从云端拉取</button>
          <button class="btn" id="pushCloudBtn">上传到云端</button>
        </div>
      </section>

      <section class="panel">
        <label>Flomo Webhook（用于发送抽奖结果）
          <input id="flomoWebhook" class="input" value="${settings.flomoWebhook || ''}" placeholder="https://flomoapp.com/iwh/...">
        </label>
        <label>GitHub Token（用于自动回写 Gist）
          <input id="githubToken" class="input" type="password" value="${settings.githubToken || ''}" placeholder="ghp_xxx">
        </label>
      </section>

      <section class="panel">
        <p>数据管理</p>
        <div class="row gap8">
          <button class="btn" id="exportBtn">导出数据</button>
          <button class="btn" id="importBtn">导入数据</button>
          <button class="btn" id="dailySummaryBtn">导出今日日报(MD)</button>
          <input id="importInput" type="file" accept="application/json" hidden>
        </div>
      </section>

      <section class="panel muted">
        <p>关于 TaskBox</p>
        <small>v1.1.0 · 游戏化任务管理 PWA</small>
      </section>
    </main>
  `;

  app.querySelector('#backBtn').addEventListener('click', () => navigate('#home'));
  app.querySelector('#toggleKey').addEventListener('click', () => {
    const input = app.querySelector('#apiKey');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  app.querySelector('#apiKey').addEventListener('blur', (e) => setSettings({ deepseekApiKey: e.target.value.trim() }));
  app.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    setSettings({ themeMode: tab.dataset.theme });
    renderSettings(app);
  }));
  app.querySelector('#soundEnabled').addEventListener('change', (e) => setSettings({ soundEnabled: e.target.checked }));

  app.querySelector('#cloudEnabled').addEventListener('change', (e) => setSettings({ cloudEnabled: e.target.checked }));
  app.querySelector('#cloudEndpoint').addEventListener('input', (e) => setSettings({ cloudEndpoint: e.target.value.trim() }));
  app.querySelector('#cloudToken').addEventListener('input', (e) => setSettings({ cloudToken: e.target.value.trim() }));
  app.querySelector('#flomoWebhook').addEventListener('input', (e) => setSettings({ flomoWebhook: e.target.value.trim() }));
  app.querySelector('#githubToken').addEventListener('input', (e) => setSettings({ githubToken: e.target.value.trim() }));

  const syncCloudSettings = () => {
    setSettings({
      cloudEnabled: app.querySelector('#cloudEnabled').checked,
      cloudEndpoint: app.querySelector('#cloudEndpoint').value.trim(),
      cloudToken: app.querySelector('#cloudToken').value.trim(),
    });
  };

  app.querySelector('#pullCloudBtn').addEventListener('click', async () => {
    syncCloudSettings();
    try {
      const result = await pullDataFromCloud({ force: true });
      if (result === 'merged') showToast('已与云端合并并去重');
      else showToast('本地已是最新');
      navigate('#home');
    } catch {
      showToast('云端拉取失败，请检查 URL/Token');
    }
  });

  app.querySelector('#pushCloudBtn').addEventListener('click', async () => {
    syncCloudSettings();
    try {
      await pushDataToCloud({ force: true });
      showToast('已上传到云端');
    } catch {
      showToast('云端上传失败，请检查 URL/Token');
    }
  });

  app.querySelector('#exportBtn').addEventListener('click', exportData);
  app.querySelector('#dailySummaryBtn').addEventListener('click', exportDailySummary);
  app.querySelector('#importBtn').addEventListener('click', () => app.querySelector('#importInput').click());
  app.querySelector('#importInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('导入将覆盖当前所有数据，确认继续？')) return;
    try {
      await importData(file);
      showToast('导入成功');
      navigate('#home');
    } catch {
      showToast('导入失败，文件格式错误');
    }
  });
}
