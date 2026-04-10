import { navigate, openSheet, showToast } from './app.js';
import { getSettings } from './db.js';
import { openWeightedWheel } from './lucky-wheel.js';

const NUMERALS = ['壹', '貳', '參', '肆', '伍', '陸', '柒', '捌'];
const SW_CACHE_KEYS = {
  pavilion: 'taskbox_sw_pavilion_cache',
  tower: 'taskbox_sw_tower_cache',
};

async function loadJson(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(path);
  const text = await res.text();
  return parseJsonLenient(text);
}

function extractFirstJsonObject(text) {
  const start = text.indexOf('{');
  if (start < 0) return text;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text;
}

function parseJsonLenient(text) {
  try {
    return JSON.parse(text);
  } catch {
    const normalized = extractFirstJsonObject(text)
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, '\'')
      .replace(/^\uFEFF/, '');
    return JSON.parse(normalized);
  }
}

async function loadJsonAny(paths) {
  let lastErr;
  for (const path of paths) {
    try {
      const data = await loadJson(path);
      return { data, path };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('No candidate path loaded');
}

function readCachedData(type) {
  const raw = localStorage.getItem(SW_CACHE_KEYS[type]);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCachedData(type, data) {
  localStorage.setItem(SW_CACHE_KEYS[type], JSON.stringify(data));
}

async function loadSmallWorldSource(type) {
  const settings = getSettings();
  const customUrl = type === 'pavilion' ? settings.pavilionDataUrl : settings.towerDataUrl;

  if (customUrl) {
    try {
      const data = await loadJson(customUrl);
      writeCachedData(type, data);
      return { data, path: customUrl, source: 'remote' };
    } catch {
      const cached = readCachedData(type);
      if (cached) return { data: cached, path: `cache:${type}`, source: 'cache' };
    }
  }

  try {
    const local = await loadJsonAny(type === 'pavilion' ? ['data/pavilion.json', 'pavilion.json'] : ['data/tower.json', 'tower.json']);
    writeCachedData(type, local.data);
    return { ...local, source: 'local' };
  } catch {
    const cached = readCachedData(type);
    if (cached) return { data: cached, path: `cache:${type}`, source: 'cache' };
    throw new Error(`${type} data load failed`);
  }
}

function mapLevelName(level, name) {
  return `${NUMERALS[level - 1] || level}·${name || ''}`;
}

function getFloorCount(floor, countField) {
  const raw = floor[countField];
  if (Array.isArray(raw)) return raw.length;
  if (Number.isFinite(raw)) return raw;
  if (Number.isFinite(floor.items_count)) return floor.items_count;
  if (Number.isFinite(floor.tasks_count)) return floor.tasks_count;
  if (Array.isArray(floor.items)) return floor.items.length;
  if (Array.isArray(floor.tasks)) return floor.tasks.length;
  if (Number.isFinite(floor.total_tasks)) return floor.total_tasks;
  return 0;
}

function safeText(value) {
  return String(value ?? '');
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = safeText(value);
  return div.innerHTML;
}

function createFloorRow(itemName, index) {
  const row = document.createElement('div');
  row.className = 'sw-row';
  row.dataset.i = String(index);

  const title = document.createElement('button');
  title.className = 'icon-btn';
  title.style.textAlign = 'left';
  title.dataset.edit = String(index);
  title.textContent = safeText(itemName);
  row.appendChild(title);

  const delBtn = document.createElement('button');
  delBtn.className = 'icon-btn';
  delBtn.dataset.del = String(index);
  delBtn.textContent = '🗑';
  row.appendChild(delBtn);

  return row;
}

function normalizePavilionFloor(floor = {}) {
  const firstArray = (...keys) => {
    for (const k of keys) if (Array.isArray(floor[k])) return floor[k];
    const fuzzy = Object.keys(floor).find((k) => /item/i.test(k) && Array.isArray(floor[k]));
    return fuzzy ? floor[fuzzy] : [];
  };
  return {
    ...floor,
    level: Number(floor.level ?? floor.floor ?? floor.tier ?? 0),
    level_name: floor.level_name || floor.name || floor.title || '',
    level_description: floor.level_description || floor.description || floor.desc || '',
    items_count: Number(floor.items_count ?? floor.total_items ?? floor.count ?? 0),
    items: firstArray('items', 'rewards', 'reward_items'),
    sample_item_titles: firstArray('sample_item_titles', 'sample_titles'),
    sample_item_ids: firstArray('sample_item_ids', 'sample_ids'),
  };
}

function normalizeTowerFloor(floor = {}) {
  const firstArray = (...keys) => {
    for (const k of keys) if (Array.isArray(floor[k])) return floor[k];
    const fuzzy = Object.keys(floor).find((k) => /task/i.test(k) && Array.isArray(floor[k]));
    return fuzzy ? floor[fuzzy] : [];
  };
  return {
    ...floor,
    floor: Number(floor.floor ?? floor.level ?? floor.tier ?? 0),
    floor_name: floor.floor_name || floor.name || floor.title || '',
    floor_desc: floor.floor_desc || floor.description || floor.desc || '',
    difficulty: floor.difficulty || floor.floor_difficulty || floor.difficulty_label || '',
    total_tasks: Number(floor.total_tasks ?? floor.tasks_count ?? floor.count ?? 0),
    tasks_count: Number(floor.tasks_count ?? floor.total_tasks ?? floor.count ?? 0),
    tasks: firstArray('tasks', 'task_list', 'challenges', 'trials'),
    sample_task_names: firstArray('sample_task_names', 'sample_names'),
    sample_task_ids: firstArray('sample_task_ids', 'sample_ids'),
  };
}

function normalizePavilionItem(item = {}, idx = 0, level = 0, fallbackDesc = '') {
  return {
    ...item,
    id: item.id || `L${level}_${idx + 1}`,
    title: item.title || item.name || item.label || '',
    description: item.description || item.desc || fallbackDesc || '',
    types: Array.isArray(item.types) ? item.types : (Array.isArray(item.tags) ? item.tags : []),
  };
}

function normalizeTowerTask(task = {}, idx = 0, floor = 0, fallbackDesc = '') {
  return {
    ...task,
    id: task.id || `F${floor}-${idx + 1}`,
    name: task.name || task.title || task.label || '',
    desc: task.desc || task.description || fallbackDesc || '',
    tags: Array.isArray(task.tags) ? task.tags : (Array.isArray(task.types) ? task.types : []),
  };
}

function pickVaultArray(raw) {
  if (!raw || typeof raw !== 'object') return [];
  const candidates = [
    raw.treasure_vault,
    raw.tower,
    raw.floors,
    raw.data,
  ];
  const hit = candidates.find((arr) => Array.isArray(arr));
  return hit || [];
}

function renderBuilding(data, key, nameField, countField, type) {
  if (!Array.isArray(data) || data.length === 0) {
    return `<section class="sw-building ${type}"><p class="muted">暂无楼层数据</p></section>`;
  }

  const floors = [...data].sort((a, b) => Number(a[key]) - Number(b[key]));
  const counts = floors.map((f) => Math.max(1, getFloorCount(f, countField)));
  const max = Math.max(...counts, 1);

  return `
    <section class="sw-building ${type}">
      ${floors.map((f, i) => {
        const count = counts[i];
        const pct = ((count / max) * 70) + 30;
        const width = Number.isFinite(pct) ? Math.round(pct) : Math.round(100 / Math.max(floors.length, 1));
        const label = mapLevelName(Number(f[key]), safeText(f[nameField]));
        return `<button class="sw-floor" style="width:${width}%" data-type="${type}" data-floor="${Number(f[key])}">${escapeHtml(label)}</button>`;
      }).join('')}
    </section>
  `;
}

export async function renderSmallWorldMap(app) {
  app.innerHTML = `
    <main class="page" id="small-world">
      <header class="topbar safe-top">
        <button class="icon-btn" id="swBack">← 返回</button>
        <h2>小世界地图</h2>
        <span class="muted">smallWorld</span>
      </header>
      <div class="panel" id="swContent"><p>加载中...</p></div>
    </main>
  `;

  app.querySelector('#swBack').addEventListener('click', () => navigate('#home'));

  try {
    const [pavilionResult, towerResult] = await Promise.allSettled([
      loadSmallWorldSource('pavilion'),
      loadSmallWorldSource('tower'),
    ]);

    const pavilionRaw = pavilionResult.status === 'fulfilled' ? pavilionResult.value.data : {};
    const towerRaw = towerResult.status === 'fulfilled' ? towerResult.value.data : {};
    const pavilion = pickVaultArray(pavilionRaw).map(normalizePavilionFloor).filter((f) => Number.isFinite(f.level) && f.level > 0);
    const tower = pickVaultArray(towerRaw).map(normalizeTowerFloor).filter((f) => Number.isFinite(f.floor) && f.floor > 0);

    app.querySelector('#swContent').innerHTML = `
      <h3>珍宝阁 · 因果台</h3>
      ${pavilion.length ? renderBuilding(pavilion, 'level', 'level_name', 'items', 'pavilion') : '<p class="muted">珍宝阁数据加载失败</p>'}
      <h3>弑神塔 · 天劫台</h3>
      ${tower.length ? renderBuilding(tower, 'floor', 'floor_name', 'total_tasks', 'tower') : '<p class="muted">弑神塔数据加载失败（检查 tower.json 结构/链接）</p>'}
    `;

    app.querySelectorAll('.sw-floor').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const floor = btn.dataset.floor;
        navigate(`#sw/${type}/${floor}`);
      });
    });
  } catch {
    app.querySelector('#swContent').innerHTML = '<p class="muted">未找到 pavilion.json / tower.json。请放在 data/ 目录或站点根目录。</p>';
  }
}

export async function renderSmallWorldFloor(app, type, floorId) {
  const isPavilion = type === 'pavilion';
  if (!isPavilion && type !== 'tower') {
    navigate('#smallworld');
    return;
  }

  const loaded = await loadSmallWorldSource(isPavilion ? 'pavilion' : 'tower');
  const path = loaded.path;
  const key = isPavilion ? 'level' : 'floor';
  const raw = loaded.data;
  const floorsRaw = pickVaultArray(raw);
  const floors = (isPavilion ? floorsRaw.map(normalizePavilionFloor) : floorsRaw.map(normalizeTowerFloor));
  const floor = floors.find((f) => String(f[key]) === String(floorId));
  if (!floor) {
    navigate('#smallworld');
    return;
  }

  const items = isPavilion
    ? ((Array.isArray(floor.items) && floor.items.length > 0)
      ? floor.items.map((it, i) => normalizePavilionItem(it, i, floor.level, floor.level_description)).filter((it) => it.title)
      : (floor.sample_item_titles || []).map((title, i) => normalizePavilionItem({
        id: floor.sample_item_ids?.[i],
        title,
      }, i, floor.level, floor.level_description)).filter((it) => it.title))
    : ((Array.isArray(floor.tasks) && floor.tasks.length > 0)
      ? floor.tasks.map((it, i) => normalizeTowerTask(it, i, floor.floor, floor.floor_desc)).filter((it) => it.name)
      : (floor.sample_task_names || []).map((name, i) => normalizeTowerTask({
        id: floor.sample_task_ids?.[i],
        name,
      }, i, floor.floor, floor.floor_desc)).filter((it) => it.name));

  app.innerHTML = `
    <main class="page">
      <header class="topbar safe-top">
        <button class="icon-btn" id="swBack">← 返回</button>
        <h2>${escapeHtml(mapLevelName(Number(floor[key]), isPavilion ? floor.level_name : floor.floor_name))}</h2>
        <div class="row gap8">
          <button class="icon-btn" id="infoBtn" aria-label="楼层信息">ⓘ</button>
          <button class="icon-btn" id="spinBtn" aria-label="抽奖" ${items.length === 0 ? 'disabled' : ''}>🎡</button>
        </div>
      </header>
      <section class="panel scroll-area" id="swList" style="max-height:65vh"></section>
    </main>
  `;

  const list = app.querySelector('#swList');
  items.forEach((it, i) => list.appendChild(createFloorRow(isPavilion ? it.title : it.name, i)));
  const addBtn = document.createElement('button');
  addBtn.className = 'btn';
  addBtn.id = 'addBtn';
  addBtn.textContent = isPavilion ? '+ 添加奖励' : '+ 添加试炼';
  list.appendChild(addBtn);

  app.querySelector('#swBack').addEventListener('click', () => navigate('#smallworld'));
  app.querySelector('#infoBtn').addEventListener('click', () => {
    const title = isPavilion ? '楼层说明' : safeText(floor.difficulty || '难度未设置');
    const msg = isPavilion ? safeText(floor.level_description) : safeText(floor.floor_desc);
    openSheet(`
      <div class="sheet-handle"></div>
      <div class="sheet-content">
        <h4>${escapeHtml(title)}</h4>
        <p>${escapeHtml(msg)}</p>
      </div>
    `, { height: '35vh' });
  });
  app.querySelector('#spinBtn').addEventListener('click', () => openSpin(items, isPavilion));

  addBtn.addEventListener('click', () => {
    openFloorItemEditor({ isPavilion }, (payload) => {
      if (isPavilion) {
        items.push({
          id: `L${floor.level}_${Date.now()}`,
          title: payload.title,
          description: payload.desc,
          types: payload.tags,
          priority: payload.priority,
          progress: payload.progress,
          triangle: { money: 1, time: 1, energy: 1 },
          narrative_line: null,
        });
      } else {
        items.push({
          id: `F${floor.floor}-${Date.now()}`,
          name: payload.title,
          desc: payload.desc,
          tags: payload.tags,
          priority: payload.priority,
          progress: payload.progress,
          dimension: '成长与学习',
          reward_tier: floor.floor,
        });
        floor.total_tasks = items.length;
      }
      saveFloor(path, raw, type)
        .then(() => renderSmallWorldFloor(app, type, floorId))
        .catch(() => showToast('保存失败：请检查 GitHub Token / Gist URL'));
    });
  });

  app.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    items.splice(Number(b.dataset.del), 1);
    if (!isPavilion) floor.total_tasks = items.length;
    saveFloor(path, raw, type)
      .then(() => renderSmallWorldFloor(app, type, floorId))
      .catch(() => showToast('删除失败：请检查 GitHub Token / Gist URL'));
  }));

  app.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.edit);
    const target = items[i];
    openFloorItemEditor({
      isPavilion,
      initialTitle: isPavilion ? target.title : target.name,
      initialDesc: isPavilion ? target.description : target.desc,
      initialTags: isPavilion ? target.types : target.tags,
      initialPriority: target.priority ?? 0,
      initialProgress: target.progress ?? 0,
    }, (payload) => {
      if (isPavilion) Object.assign(target, {
        title: payload.title,
        description: payload.desc,
        types: payload.tags,
        priority: payload.priority,
        progress: payload.progress,
      });
      else Object.assign(target, {
        name: payload.title,
        desc: payload.desc,
        tags: payload.tags,
        priority: payload.priority,
        progress: payload.progress,
      });
      saveFloor(path, raw, type)
        .then(() => renderSmallWorldFloor(app, type, floorId))
        .catch(() => showToast('更新失败：请检查 GitHub Token / Gist URL'));
    });
  }));
}

function openFloorItemEditor({
  isPavilion,
  initialTitle = '',
  initialDesc = '',
  initialTags = [],
  initialPriority = 0,
  initialProgress = 0,
} = {}, onSave) {
  const { root, close } = openSheet(`
    <div class="sheet-handle"></div>
    <div class="sheet-content">
      <h3>${initialTitle ? '编辑内容' : '新增内容'}</h3>
      <label>标题<input id="swEditTitle" class="input" value="${escapeHtml(initialTitle)}" placeholder="${isPavilion ? '奖励标题' : '试炼标题'}"></label>
      <label>描述<input id="swEditDesc" class="input" value="${escapeHtml(initialDesc)}" placeholder="详情描述（抽奖后显示）"></label>
      <label>标签（逗号分隔）<input id="swEditTags" class="input" value="${escapeHtml((initialTags || []).join(', '))}" placeholder="例如：成长, 社交"></label>
      <label>优先级
        <div class="priority-select">
          ${[0, 1, 2, 3].map((p) => `<button class="prio-dot p${p} ${Number(initialPriority) === p ? 'active' : ''}" data-p="${p}">${p === 0 ? '无' : ''}</button>`).join('')}
        </div>
      </label>
      <label>完成进度
        <div class="progress-select">
          ${[0, 20, 40, 60, 80, 100].map((v) => `<button class="progress-dot ${Number(initialProgress) === v ? 'active' : ''}" data-progress="${v}">${v}%</button>`).join('')}
        </div>
      </label>
      <div class="row gap8">
        <button class="btn" id="swEditCancel">取消</button>
        <button class="btn primary" id="swEditSave">保存</button>
      </div>
    </div>
  `, { height: '70vh' });

  let priority = Number(initialPriority) || 0;
  let progress = Number(initialProgress) || 0;

  root.querySelectorAll('.prio-dot').forEach((btn) => {
    btn.addEventListener('click', () => {
      priority = Number(btn.dataset.p);
      root.querySelectorAll('.prio-dot').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });

  root.querySelectorAll('.progress-dot').forEach((btn) => {
    btn.addEventListener('click', () => {
      progress = Number(btn.dataset.progress);
      root.querySelectorAll('.progress-dot').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });

  root.querySelector('#swEditCancel').addEventListener('click', close);
  root.querySelector('#swEditSave').addEventListener('click', () => {
    const title = root.querySelector('#swEditTitle').value.trim();
    if (!title) {
      showToast('标题不能为空');
      return;
    }
    const desc = root.querySelector('#swEditDesc').value.trim();
    const tags = root.querySelector('#swEditTags').value.split(',').map((x) => x.trim()).filter(Boolean);
    onSave?.({ title, desc, tags, priority, progress });
    close();
  });
}

function parseGistRawUrl(url) {
  const match = String(url || '').match(/gist\.githubusercontent\.com\/[^/]+\/([a-f0-9]+)\/raw\/[^/]+\/(.+)$/i);
  if (!match) return null;
  return { gistId: match[1], filename: decodeURIComponent(match[2]) };
}

async function uploadSmallWorldToGist(type, json) {
  const settings = getSettings();
  const token = (settings.githubToken || '').trim();
  if (!token) throw new Error('missing_token');

  const dataUrl = type === 'pavilion' ? settings.pavilionDataUrl : settings.towerDataUrl;
  const parsed = parseGistRawUrl(dataUrl);
  if (!parsed) throw new Error('invalid_gist_url');

  const res = await fetch(`https://api.github.com/gists/${parsed.gistId}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: {
        [parsed.filename]: {
          content: JSON.stringify(json, null, 2),
        },
      },
    }),
  });
  if (!res.ok) throw new Error('gist_patch_failed');
}

async function saveFloor(_path, json, type) {
  await uploadSmallWorldToGist(type, json);
  showToast('已自动回写 Gist');
}

function openSpin(items, isPavilion) {
  const list = items.slice();
  if (list.length === 0) {
    showToast('当前楼层暂无内容，无法抽奖');
    return;
  }
  openWeightedWheel({
    title: isPavilion ? '珍宝阁抽奖' : '弑神塔抽奖',
    entries: list,
    color: isPavilion ? 'reward' : 'punish',
    getText: (item) => (isPavilion ? item.title : item.name),
    onPicked: (root, picked) => showResult(root, picked, isPavilion),
  });
}

function showResult(root, item, isPavilion) {
  const title = safeText(isPavilion ? item.title : item.name);
  const desc = safeText(isPavilion ? item.description : item.desc);
  const tags = (isPavilion ? item.types : item.tags) || [];

  root.querySelector('#wheelResult').innerHTML = `
    <div class="panel" id="resultCard">
      ${isPavilion ? `<h4>${escapeHtml(title)}</h4>` : `<h4>试炼内容</h4><h5>${escapeHtml(title)}</h5>`}
      <p>${escapeHtml(desc)}</p>
      <p>${tags.map((t) => `#${escapeHtml(t)}`).join(' ')}</p>
      <button class="btn sw-save-btn" id="sendFlomoBtn">发送到 Flomo</button>
    </div>
  `;

  root.querySelector('#sendFlomoBtn').addEventListener('click', async () => {
    const webhook = (getSettings().flomoWebhook || '').trim();
    if (!webhook) {
      showToast('请先在设置中填写 Flomo Webhook');
      return;
    }
    const markdown = [
      isPavilion ? '## 珍宝阁抽奖结果' : '## 弑神塔抽奖结果',
      '',
      `### ${title}`,
      '',
      desc || '无描述',
      '',
      tags.length ? tags.map((t) => `#${safeText(t)}`).join(' ') : '',
      '',
      '#弑神塔',
    ].filter(Boolean).join('\n');

    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: markdown,
          content_type: 'markdown',
        }),
      });
      if (!res.ok) throw new Error('flomo_failed');
      showToast('已发送到 Flomo');
    } catch {
      showToast('发送失败，请检查 Flomo Webhook');
    }
  });
}
