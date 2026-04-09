import { navigate, openSheet, showToast } from './app.js';

const NUMERALS = ['壹', '貳', '參', '肆', '伍', '陸', '柒', '捌'];

async function loadJson(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(path);
  return res.json();
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

function mapLevelName(level, name) {
  return `${NUMERALS[level - 1] || level}·${name || ''}`;
}

function getFloorCount(floor, countField) {
  const raw = floor[countField];
  if (Array.isArray(raw)) return raw.length;
  if (Number.isFinite(raw)) return raw;
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

  const title = document.createElement('strong');
  title.textContent = safeText(itemName);
  row.appendChild(title);

  const editBtn = document.createElement('button');
  editBtn.className = 'icon-btn';
  editBtn.dataset.edit = String(index);
  editBtn.textContent = '✎';
  row.appendChild(editBtn);

  const delBtn = document.createElement('button');
  delBtn.className = 'icon-btn';
  delBtn.dataset.del = String(index);
  delBtn.textContent = '🗑';
  row.appendChild(delBtn);

  return row;
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
    const [pavilionLoaded, towerLoaded] = await Promise.all([
      loadJsonAny(['data/pavilion.json', 'pavilion.json']),
      loadJsonAny(['data/tower.json', 'tower.json']),
    ]);
    const pavilionRaw = pavilionLoaded.data;
    const towerRaw = towerLoaded.data;

    const pavilion = Array.isArray(pavilionRaw.treasure_vault) ? pavilionRaw.treasure_vault : [];
    const tower = Array.isArray(towerRaw.treasure_vault) ? towerRaw.treasure_vault : [];

    if (pavilion.length === 0 || tower.length === 0) {
      app.querySelector('#swContent').innerHTML = '<p class="muted">数据加载失败，请检查 pavilion.json / tower.json 的目录与 treasure_vault 结构。</p>';
      return;
    }

    app.querySelector('#swContent').innerHTML = `
      <h3>珍宝阁 · 因果台</h3>
      ${renderBuilding(pavilion, 'level', 'level_name', 'items', 'pavilion')}
      <h3>弑神塔 · 天劫台</h3>
      ${renderBuilding(tower, 'floor', 'floor_name', 'total_tasks', 'tower')}
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

  const loaded = await loadJsonAny(isPavilion ? ['data/pavilion.json', 'pavilion.json'] : ['data/tower.json', 'tower.json']);
  const path = loaded.path;
  const key = isPavilion ? 'level' : 'floor';
  const raw = loaded.data;
  const floors = Array.isArray(raw.treasure_vault) ? raw.treasure_vault : [];
  const floor = floors.find((f) => String(f[key]) === String(floorId));
  if (!floor) {
    navigate('#smallworld');
    return;
  }

  const items = isPavilion ? (Array.isArray(floor.items) ? floor.items : []) : (Array.isArray(floor.tasks) ? floor.tasks : []);

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
    const title = prompt(isPavilion ? '奖励标题' : '试炼标题');
    if (!title) return;
    const desc = prompt('描述', '') || '';
    const tags = (prompt('标签(逗号分隔)', '') || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (isPavilion) {
      items.push({
        id: `L${floor.level}_${Date.now()}`,
        title,
        description: desc,
        types: tags,
        triangle: { money: 1, time: 1, energy: 1 },
        narrative_line: null,
      });
    } else {
      items.push({
        id: `F${floor.floor}-${Date.now()}`,
        name: title,
        desc,
        tags,
        dimension: '成长与学习',
        reward_tier: floor.floor,
      });
      floor.total_tasks = items.length;
    }
    saveFloor(path, raw).then(() => renderSmallWorldFloor(app, type, floorId));
  });

  app.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    items.splice(Number(b.dataset.del), 1);
    if (!isPavilion) floor.total_tasks = items.length;
    saveFloor(path, raw).then(() => renderSmallWorldFloor(app, type, floorId));
  }));

  app.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.edit);
    const target = items[i];
    const title = prompt('标题', isPavilion ? target.title : target.name);
    if (!title) return;
    const desc = prompt('描述', isPavilion ? target.description : target.desc) || '';
    if (isPavilion) Object.assign(target, { title, description: desc });
    else Object.assign(target, { name: title, desc });
    saveFloor(path, raw).then(() => renderSmallWorldFloor(app, type, floorId));
  }));
}

function saveFloor(path, json) {
  showToast('本地数据已更新（请手动回写 JSON 文件）');
  console.log('Please save file manually:', path, json);
  return Promise.resolve();
}

function openSpin(items, isPavilion) {
  const list = items.slice();
  if (list.length === 0) {
    showToast('当前楼层暂无内容，无法抽奖');
    return;
  }

  const { root } = openSheet(`
    <div class="sheet-handle"></div>
    <div class="sheet-content wheel">
      <h3>抽奖</h3>
      <canvas id="swWheel"></canvas>
      <button class="btn primary" id="drawBtn">抽奖</button>
      <div id="swResult"></div>
    </div>
  `, { height: '80vh' });

  const canvas = root.querySelector('#swWheel');
  const ctx = canvas.getContext('2d');
  const size = Math.min(window.innerWidth * 0.85, 360);
  canvas.width = size;
  canvas.height = size;
  let angle = 0;

  const draw = () => {
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2;
    const r = size / 2 - 5;
    const step = (Math.PI * 2) / list.length;
    list.forEach((it, i) => {
      const s = angle + i * step;
      const e = s + step;
      ctx.beginPath();
      ctx.moveTo(cx, cx);
      ctx.arc(cx, cx, r, s, e);
      ctx.closePath();
      ctx.fillStyle = `hsl(${(i * 45) % 360} 80% 60%)`;
      ctx.fill();
      ctx.save();
      ctx.translate(cx, cx);
      ctx.rotate(s + step / 2);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'right';
      ctx.fillText(safeText(isPavilion ? it.title : it.name).slice(0, 10), r - 10, 4);
      ctx.restore();
    });
  };

  draw();

  root.querySelector('#drawBtn').addEventListener('click', () => {
    const target = Math.floor(Math.random() * list.length);
    const step = (Math.PI * 2) / list.length;
    const pointer = -Math.PI / 2;
    const targetAngle = pointer - (target + 0.5) * step;
    const final = angle + Math.PI * 8 + ((targetAngle - angle) % (Math.PI * 2));
    const start = performance.now();
    const dur = 3000;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      angle = angle + (final - angle) * (1 - Math.pow(1 - t, 3));
      draw();
      if (t < 1) requestAnimationFrame(tick);
      else showResult(root, list[target], isPavilion);
    };

    requestAnimationFrame(tick);
  });
}

function showResult(root, item, isPavilion) {
  const title = safeText(isPavilion ? item.title : item.name);
  const desc = safeText(isPavilion ? item.description : item.desc);
  const tags = (isPavilion ? item.types : item.tags) || [];

  root.querySelector('#swResult').innerHTML = `
    <div class="panel" id="resultCard">
      ${isPavilion ? `<h4>${escapeHtml(title)}</h4>` : `<h4>试炼内容</h4><h5>${escapeHtml(title)}</h5>`}
      <p>${escapeHtml(desc)}</p>
      <p>${tags.map((t) => `#${escapeHtml(t)}`).join(' ')}</p>
      <button class="btn sw-save-btn" id="saveImgBtn">一键保存</button>
    </div>
  `;

  root.querySelector('#saveImgBtn').addEventListener('click', () => {
    const c = document.createElement('canvas');
    c.width = 1080;
    c.height = 720;
    const ctx = c.getContext('2d');

    const grd = ctx.createLinearGradient(0, 0, c.width, c.height);
    grd.addColorStop(0, '#111827');
    grd.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText(isPavilion ? title : '试炼内容', 60, 120);

    ctx.font = 'bold 42px sans-serif';
    ctx.fillText(title, 60, 200);

    ctx.font = '32px sans-serif';
    const text = desc.slice(0, 120);
    ctx.fillText(text, 60, 280);
    ctx.fillStyle = '#93c5fd';
    ctx.fillText(tags.map((t) => `#${safeText(t)}`).join(' '), 60, 360);

    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = `small-world-${Date.now()}.png`;
    a.click();
  });
}
