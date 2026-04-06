const STORAGE_KEY = 'taskbox_data';

const DEFAULT_BOXES = [
  { name: '重要事项', color: 'important', icon: '⭐', sortOrder: 0, isDefault: true, description: '放这里的，都是不做会后悔的事。别拖了，一件一件来。' },
  { name: '放松盒', color: 'relax', icon: '☕', sortOrder: 1, isDefault: true, description: '累了就来这里抽一个，给自己一个正当的休息理由。' },
  { name: '奖励盒', color: 'reward', icon: '🎁', sortOrder: 2, isDefault: true, description: '完成了重要任务？来这里随机抽一个奖励犒劳自己吧。' },
  { name: '惩罚盒', color: 'punish', icon: '⚡', sortOrder: 3, isDefault: true, description: '没完成计划？随机抽一个惩罚，对自己狠一点才能进步。' }
];

const DEFAULT_TASKS = [
  { boxName: '放松盒', content: '听音乐两首' },
  { boxName: '放松盒', content: '冥想 5min' },
  { boxName: '放松盒', content: '靠墙站立' },
  { boxName: '放松盒', content: '洗袜子/衣服/扫地' },
  { boxName: '放松盒', content: '整理桌面' },
  { boxName: '奖励盒', content: '高分牛肉火锅' },
  { boxName: '奖励盒', content: '高分自助餐' },
  { boxName: '惩罚盒', content: '复盘 1k 字' },
  { boxName: '惩罚盒', content: '输出主题文章 2k 字' }
];

const sounds = {
  complete: new Audio('assets/sounds/complete.mp3'),
  wheelStop: new Audio('assets/sounds/wheel-stop.mp3')
};
Object.values(sounds).forEach((s) => { s.preload = 'auto'; });

export const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function save(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

function initData() {
  const now = new Date().toISOString();
  const boxes = DEFAULT_BOXES.map((b) => ({ id: uid(), createdAt: now, ...b }));
  const boxByName = Object.fromEntries(boxes.map((b) => [b.name, b]));
  const tasks = DEFAULT_TASKS.map((t, i) => ({
    id: uid(),
    boxId: boxByName[t.boxName].id,
    content: t.content,
    isCompleted: false,
    sortOrder: i,
    priority: 2,
    dueDate: null,
    completedAt: null,
    createdAt: now
  }));
  const data = {
    boxes,
    tasks,
    settings: { deepseekApiKey: '', themeMode: 'system', soundEnabled: true }
  };
  save(data);
  return data;
}

export function getData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return initData();
  try { return JSON.parse(raw); } catch { return initData(); }
}

export function updateData(mutator) {
  const data = getData();
  mutator(data);
  save(data);
  return data;
}

export function getBoxes() { return [...getData().boxes].sort((a, b) => a.sortOrder - b.sortOrder); }
export function getTasks() { return [...getData().tasks].sort((a, b) => a.sortOrder - b.sortOrder); }
export function getSettings() { return getData().settings; }

export function addTask(partial) {
  return updateData((d) => {
    d.tasks.push({
      id: uid(),
      isCompleted: false,
      sortOrder: d.tasks.filter((t) => t.boxId === partial.boxId).length,
      priority: 2,
      dueDate: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      ...partial
    });
  });
}

export function updateTask(taskId, patch) {
  return updateData((d) => {
    const i = d.tasks.findIndex((t) => t.id === taskId);
    if (i < 0) return;
    d.tasks[i] = { ...d.tasks[i], ...patch };
  });
}

export function deleteTask(taskId) {
  return updateData((d) => { d.tasks = d.tasks.filter((t) => t.id !== taskId); });
}

export function reorderTasks(boxId, orderedIds) {
  return updateData((d) => {
    orderedIds.forEach((id, idx) => {
      const t = d.tasks.find((task) => task.id === id && task.boxId === boxId);
      if (t) t.sortOrder = idx;
    });
  });
}

export function updateBox(boxId, patch) {
  return updateData((d) => {
    const idx = d.boxes.findIndex((b) => b.id === boxId);
    if (idx >= 0) d.boxes[idx] = { ...d.boxes[idx], ...patch };
  });
}

export function addBox(partial) {
  return updateData((d) => {
    d.boxes.push({ id: uid(), createdAt: new Date().toISOString(), sortOrder: d.boxes.length, color: 'misc', icon: '📦', description: '', isDefault: false, ...partial });
  });
}

export function saveSettings(patch) {
  return updateData((d) => { d.settings = { ...d.settings, ...patch }; });
}

export function importData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function exportData() {
  return JSON.stringify(getData(), null, 2);
}

export function playSound(name) {
  if (!getSettings().soundEnabled) return;
  const s = new Audio(`assets/sounds/${name}.mp3`);
  s.play().catch(() => {});
}
