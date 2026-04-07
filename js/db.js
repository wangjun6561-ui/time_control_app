const STORAGE_KEY = 'taskbox_data';

const DEFAULT_BOXES = [
  { name: '重要盒', color: 'important', icon: '⭐', sortOrder: 0, isDefault: true, description: '放这里的，都是不做会后悔的事。别拖了，一件一件来。' },
  { name: '放松盒', color: 'relax', icon: '☕', sortOrder: 1, isDefault: true, description: '累了就来这里抽一个，给自己一个正当的休息理由。' },
  { name: '奖励盒', color: 'reward', icon: '🎁', sortOrder: 2, isDefault: true, description: '完成了重要任务？来这里随机抽一个奖励犒劳自己吧。' },
  { name: '待办盒', color: 'misc', icon: '📦', sortOrder: 3, isDefault: true, description: '想到就记，统一处理，减少脑内占用。' },
  { name: '惩罚盒', color: 'punish', icon: '⚡', sortOrder: 4, isDefault: true, description: '没完成计划？随机抽一个惩罚，对自己狠一点才能进步。' },
];

const DEFAULT_TASKS = [
  { boxName: '放松盒', content: '听音乐两首' },
  { boxName: '放松盒', content: '冥想 5min' },
  { boxName: '放松盒', content: '靠墙站立' },
  { boxName: '放松盒', content: '洗袜子/衣服/扫地' },
  { boxName: '放松盒', content: '整理桌面' },
  { boxName: '放松盒', content: '离开屏幕望向远处' },
  { boxName: '放松盒', content: '散步 5min' },
  { boxName: '放松盒', content: '拉伸颈肩' },
  { boxName: '放松盒', content: '喝杯热饮' },
  { boxName: '放松盒', content: '随手涂鸦' },
  { boxName: '放松盒', content: '做几组深蹲' },
  { boxName: '放松盒', content: '写下三件感恩的事' },
  { boxName: '放松盒', content: '冷水洗脸' },
  { boxName: '放松盒', content: '做手部按摩' },
  { boxName: '放松盒', content: '渐进式肌肉放松' },
  { boxName: '放松盒', content: '读几页课外书' },
  { boxName: '放松盒', content: '4-7-8 呼吸练习' },
  { boxName: '放松盒', content: '闻喜欢的香薰' },
  { boxName: '放松盒', content: '自由书写 5min' },

  { boxName: '奖励盒', content: '高分牛肉火锅' },
  { boxName: '奖励盒', content: '高分自助餐' },
  { boxName: '奖励盒', content: '高分烧烤夜宵' },
  { boxName: '奖励盒', content: '去网红甜品店打卡' },
  { boxName: '奖励盒', content: '去电影院看一部期待已久的电影' },
  { boxName: '奖励盒', content: '买一件想了很久的东西100美元以内' },
  { boxName: '奖励盒', content: '买一本一直想看的书' },
  { boxName: '奖励盒', content: '去一个没去过的公园或景点' },
  { boxName: '奖励盒', content: '去咖啡馆坐一个下午' },
  { boxName: '奖励盒', content: '报一个一直想学的兴趣课' },
  { boxName: '奖励盒', content: '来一次说走就走的短途旅行-10h' },

  { boxName: '惩罚盒', content: '复盘 1k 字' },
  { boxName: '惩罚盒', content: '输出主题文章 2k 字' },
  { boxName: '惩罚盒', content: '手写笔记整理 30min' },
  { boxName: '惩罚盒', content: '背 50 个单词并默写' },
  { boxName: '惩罚盒', content: '读专业书籍 1 小时并做笔记' },
  { boxName: '惩罚盒', content: '整理电脑文件夹' },
  { boxName: '惩罚盒', content: '本周待办全部过一遍并更新' },
  { boxName: '惩罚盒', content: '做 50 个深蹲 + 20 个俯卧撑' },
  { boxName: '惩罚盒', content: '跑步或快走 30min' },
  { boxName: '惩罚盒', content: '戒手机 2 小时' },
  { boxName: '惩罚盒', content: '今日禁止刷短视频' },
  { boxName: '惩罚盒', content: '提前 1 小时起床' },
  { boxName: '惩罚盒', content: '冷水澡' },
  { boxName: '惩罚盒', content: '整理并归纳本周所有错误' },
  { boxName: '惩罚盒', content: '给自己录一段 5min 反思视频' },
  { boxName: '惩罚盒', content: '列出下周计划并细化到每天' },
  { boxName: '惩罚盒', content: '学一个新技能并输出笔记' },
  { boxName: '惩罚盒', content: '阅读并总结一篇英文文章' },
  { boxName: '惩罚盒', content: '断食一餐' },
];


let cloudSyncTimer = null;

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalize(data = {}) {
  return {
    boxes: (Array.isArray(data.boxes) ? data.boxes : []).map((b) => {
      const renamed = b.name === '杂事盒' ? '待办盒' : (b.name === '重要事项' ? '重要盒' : b.name);
      const orderMap = { '重要盒': 0, '放松盒': 1, '奖励盒': 2, '待办盒': 3, '惩罚盒': 4 };
      return { ...b, name: renamed, sortOrder: orderMap[renamed] ?? b.sortOrder ?? 99 };
    }),
    tasks: (Array.isArray(data.tasks) ? data.tasks : []).map((t) => ({ ...t, weight: t.weight ?? 1 })),
    settings: {
      deepseekApiKey: data.settings?.deepseekApiKey || '',
      themeMode: data.settings?.themeMode || 'system',
      soundEnabled: data.settings?.soundEnabled ?? true,
      cloudEnabled: data.settings?.cloudEnabled ?? false,
      cloudEndpoint: data.settings?.cloudEndpoint || './cloud-sync.json',
      cloudToken: data.settings?.cloudToken || '',
    },
    meta: {
      updatedAt: data.meta?.updatedAt || new Date().toISOString(),
    },
  };
}

function seed() {
  const now = new Date().toISOString();
  const boxes = DEFAULT_BOXES.map((b, i) => ({ ...b, id: uid(), createdAt: now, sortOrder: i }));
  const boxMap = new Map(boxes.map((b) => [b.name, b.id]));
  const tasks = DEFAULT_TASKS.map((t, i) => ({
    id: uid(),
    boxId: boxMap.get(t.boxName),
    content: t.content,
    isCompleted: false,
    sortOrder: i,
    priority: 2,
    weight: 1,
    dueDate: null,
    completedAt: null,
    createdAt: now,
  }));
  const initial = normalize({
    boxes,
    tasks,
    settings: { deepseekApiKey: '', themeMode: 'system', soundEnabled: true, cloudEnabled: false, cloudEndpoint: './cloud-sync.json', cloudToken: '' },
    meta: { updatedAt: now },
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

export function getData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seed();
  try {
    return normalize(JSON.parse(raw));
  } catch {
    return seed();
  }
}

export function saveData(data, { skipCloud = false } = {}) {
  const normalized = normalize(data);
  normalized.meta.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  if (!skipCloud) scheduleCloudPush();
}

export function updateData(updater) {
  const next = updater(structuredClone(getData()));
  saveData(next);
  return next;
}

export const getBoxes = () => getData().boxes.sort((a, b) => a.sortOrder - b.sortOrder);
export const getTasks = () => getData().tasks;
export const getSettings = () => getData().settings;

export function getTasksByBox(boxId) {
  return getTasks()
    .filter((t) => t.boxId === boxId)
    .sort((a, b) => a.sortOrder - b.sortOrder || new Date(a.createdAt) - new Date(b.createdAt));
}

export function addTask(task) {
  updateData((data) => {
    const maxOrder = Math.max(-1, ...data.tasks.filter((t) => t.boxId === task.boxId && !t.isCompleted).map((t) => t.sortOrder));
    data.tasks.push({
      id: uid(),
      content: task.content,
      boxId: task.boxId,
      priority: task.priority ?? 2,
      weight: task.weight ?? 1,
      dueDate: task.dueDate ?? null,
      isCompleted: false,
      sortOrder: maxOrder + 1,
      completedAt: null,
      createdAt: new Date().toISOString(),
    });
    return data;
  });
}

export function updateTask(taskId, patch) {
  updateData((data) => {
    const t = data.tasks.find((x) => x.id === taskId);
    if (t) Object.assign(t, patch);
    return data;
  });
}

export function deleteTask(taskId) {
  updateData((data) => {
    data.tasks = data.tasks.filter((t) => t.id !== taskId);
    return data;
  });
}

export function reorderTasks(boxId, orderedTaskIds) {
  updateData((data) => {
    const indexMap = new Map(orderedTaskIds.map((id, i) => [id, i]));
    data.tasks.forEach((t) => {
      if (t.boxId === boxId && !t.isCompleted && indexMap.has(t.id)) t.sortOrder = indexMap.get(t.id);
    });
    return data;
  });
}

export function updateBox(boxId, patch) {
  updateData((data) => {
    const box = data.boxes.find((b) => b.id === boxId);
    if (box) Object.assign(box, patch);
    return data;
  });
}

export function setSettings(patch) {
  updateData((data) => {
    data.settings = { ...data.settings, ...patch };
    return data;
  });
}

export function exportData() {
  const blob = new Blob([JSON.stringify(getData(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'taskbox-backup.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function importData(file) {
  const text = await file.text();
  const parsed = normalize(JSON.parse(text));
  saveData(parsed);
}

export function playSound(name) {
  if (!getSettings().soundEnabled) return;
  const s = new Audio(`assets/sounds/${name}.mp3`);
  s.play().catch(() => {});
}

function scheduleCloudPush() {
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    pushDataToCloud().catch(() => {});
  }, 700);
}


function isJsonBinEndpoint(url) {
  return /api\.jsonbin\.io\/v3\/b\//.test(url || '');
}

function normalizeToken(token = '') {
  return token.trim().replace(/^\[|\]$/g, '');
}


function resolveCloudEndpoint(rawEndpoint, { forRead = false } = {}) {
  const value = (rawEndpoint || '').trim();
  if (!value) return '';

  let endpoint = value;
  if (/^[a-f0-9]{24}$/i.test(endpoint)) {
    endpoint = `https://api.jsonbin.io/v3/b/${endpoint}`;
  } else if (endpoint.startsWith('/v3/')) {
    endpoint = `https://api.jsonbin.io${endpoint}`;
  } else if (endpoint.startsWith('v3/')) {
    endpoint = `https://api.jsonbin.io/${endpoint}`;
  }

  if (forRead && isJsonBinEndpoint(endpoint) && !/\/latest$/i.test(endpoint) && !/\/\d+$/i.test(endpoint)) {
    endpoint = `${endpoint.replace(/\/$/, '')}/latest`;
  }

  return endpoint;
}

function buildCloudHeaders(endpoint, token, includeJson = true) {
  const cleanToken = normalizeToken(token);
  const headers = includeJson ? { 'Content-Type': 'application/json' } : {};

  if (!cleanToken) return headers;

  if (isJsonBinEndpoint(endpoint)) {
    headers['X-Master-Key'] = cleanToken;
    headers['X-Access-Key'] = cleanToken;
  } else {
    headers.Authorization = `Bearer ${cleanToken}`;
  }

  return headers;
}

export async function pushDataToCloud(options = {}) {
  const { force = false } = options;
  const data = getData();
  const { cloudEnabled, cloudEndpoint, cloudToken } = data.settings;
  const endpoint = resolveCloudEndpoint(cloudEndpoint, { forRead: false });
  if (!endpoint) return false;
  if (!force && !cloudEnabled) return false;

  await fetch(endpoint, {
    method: 'PUT',
    headers: buildCloudHeaders(endpoint, cloudToken, true),
    body: JSON.stringify(data),
  });

  return true;
}


function dedupeTasks(tasks) {
  const map = new Map();

  tasks.forEach((t) => {
    const key = [t.boxId, t.content?.trim(), t.dueDate || '', t.priority || 2].join('::');
    const current = map.get(key);

    if (!current) {
      map.set(key, { ...t });
      return;
    }

    current.isCompleted = Boolean(current.isCompleted || t.isCompleted);
    current.completedAt = current.completedAt || t.completedAt || null;
    current.weight = Math.max(Number(current.weight) || 1, Number(t.weight) || 1);
    current.sortOrder = Math.min(Number(current.sortOrder) || 0, Number(t.sortOrder) || 0);
    map.set(key, current);
  });

  return Array.from(map.values());
}

function mergeData(local, cloud) {
  const merged = normalize({
    ...local,
    boxes: [...local.boxes, ...cloud.boxes],
    tasks: [...local.tasks, ...cloud.tasks],
    meta: { updatedAt: new Date().toISOString() },
  });

  const chosenByName = new Map();
  const idRemap = new Map();
  merged.boxes.forEach((b) => {
    if (!chosenByName.has(b.name)) chosenByName.set(b.name, b);
    idRemap.set(b.id, chosenByName.get(b.name).id);
  });

  merged.boxes = Array.from(chosenByName.values()).map((b, i) => ({ ...b, sortOrder: i }));
  const validBoxIds = new Set(merged.boxes.map((b) => b.id));

  merged.tasks = dedupeTasks(
    merged.tasks
      .map((t) => ({ ...t, boxId: idRemap.get(t.boxId) || t.boxId }))
      .filter((t) => validBoxIds.has(t.boxId))
  );

  return merged;
}

export async function pullDataFromCloud(options = {}) {
  const { force = false } = options;
  const local = getData();
  const { cloudEnabled, cloudEndpoint, cloudToken } = local.settings;
  const endpoint = resolveCloudEndpoint(cloudEndpoint, { forRead: true });
  if (!endpoint) return false;
  if (!force && !cloudEnabled) return false;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: buildCloudHeaders(endpoint, cloudToken, false),
  });
  if (!response.ok) throw new Error('cloud pull failed');

  const payload = await response.json();
  const cloudRaw = isJsonBinEndpoint(endpoint) ? (payload.record || {}) : payload;
  const cloudData = normalize(cloudRaw);
  const merged = mergeData(local, cloudData);
  merged.settings = { ...merged.settings, deepseekApiKey: local.settings.deepseekApiKey };
  saveData(merged, { skipCloud: true });
  return 'merged';
}
