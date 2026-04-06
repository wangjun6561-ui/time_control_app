import { addTask, getBoxes, getSettings } from './db.js';

export function openAiExtractSheet({ openSheet, showToast, navigate }) {
  openSheet((sheet, close) => {
    const boxes = getBoxes();
    const settings = getSettings();
    sheet.innerHTML += `
      <header class="header"><h3>✦ AI 智能提取</h3><button id="close-ai" class="icon-btn">✕</button></header>
      <textarea id="ai-input" rows="5" placeholder="输入你的任务文本，例如：重要事项有开会、写报告，杂事有买菜、回消息…"></textarea>
      <p style="font-size:13px;color:var(--text-secondary)">使用 DeepSeek AI · <button id="to-settings" class="icon-btn">前往设置配置 API Key</button></p>
      <button id="extract" class="btn primary">✦ 开始提取</button>
      <div id="ai-result"></div>
    `;

    sheet.querySelector('#close-ai').addEventListener('click', close);
    sheet.querySelector('#to-settings').addEventListener('click', () => {
      close();
      navigate('settings');
    });

    sheet.querySelector('#extract').addEventListener('click', async () => {
      if (!navigator.onLine) {
        showToast('当前无网络，AI 提取需要联网使用');
        return;
      }
      if (!settings.deepseekApiKey) {
        showToast('请先在设置中配置 DeepSeek API Key');
        return;
      }
      const userInput = sheet.querySelector('#ai-input').value.trim();
      if (!userInput) return;

      try {
        const boxNames = boxes.map((b) => b.name).join('、');
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST', mode: 'cors',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.deepseekApiKey}` },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: `你是一个任务提取助手。用户会输入一段包含任务信息的文字，请将其中的任务按盒子分类提取出来，返回严格的JSON格式：{"boxes":[{"boxName":"重要事项","tasks":["任务1","任务2"]}]}只返回JSON，不要有其他文字。可用盒子名称：${boxNames}` },
              { role: 'user', content: userInput }
            ],
            temperature: 0.3
          })
        });
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(content);
        renderConfirmUI(parsed.boxes || [], boxes, sheet.querySelector('#ai-result'), close, showToast);
      } catch {
        showToast('提取失败，请检查输入或 API Key');
      }
    });
  }, { height: '70vh' });
}

function renderConfirmUI(groups, boxes, root, close, showToast) {
  if (!groups.length) {
    root.innerHTML = '<div class="card">未提取到任务</div>';
    return;
  }
  const rows = [];
  groups.forEach((g) => {
    const b = boxes.find((box) => box.name === g.boxName) || boxes[0];
    (g.tasks || []).forEach((task) => rows.push({ text: task, boxId: b.id, checked: true }));
  });

  const render = () => {
    root.innerHTML = `<div class="card">${rows.map((r, i) => `
      <div style="display:grid;grid-template-columns:24px 1fr 120px 32px;gap:6px;align-items:center;margin:8px 0">
        <input type="checkbox" data-i="${i}" ${r.checked ? 'checked' : ''}>
        <span>${r.text}</span>
        <select data-box="${i}">${boxes.map((b) => `<option value="${b.id}" ${b.id === r.boxId ? 'selected' : ''}>${b.name}</option>`)}</select>
        <button data-del="${i}" class="icon-btn">×</button>
      </div>`).join('')}
      <button class="btn primary" id="confirm-ai">确认添加 (${rows.filter((r) => r.checked).length}项)</button>
    </div>`;

    root.querySelectorAll('input[type="checkbox"]').forEach((el) => el.addEventListener('change', (e) => { rows[+e.target.dataset.i].checked = e.target.checked; render(); }));
    root.querySelectorAll('select[data-box]').forEach((el) => el.addEventListener('change', (e) => { rows[+e.target.dataset.box].boxId = e.target.value; }));
    root.querySelectorAll('button[data-del]').forEach((el) => el.addEventListener('click', (e) => { rows.splice(+e.target.dataset.del, 1); render(); }));
    root.querySelector('#confirm-ai').addEventListener('click', () => {
      rows.filter((r) => r.checked).forEach((r) => addTask({ boxId: r.boxId, content: r.text }));
      showToast('AI 任务已添加');
      close();
    });
  };

  render();
}
