const STORAGE_KEY = 'taskbox_data';

const DEFAULT_BOXES = [
  { name: '重要事项', color: 'important', icon: '⭐', sortOrder: 0, isDefault: true, description: '放这里的，都是不做会后悔的事。别拖了，一件一件来。' },
  { name: '放松盒', color: 'relax', icon: '☕', sortOrder: 1, isDefault: true, description: '累了就来这里抽一个，给自己一个正当的休息理由。' },
  { name: '奖励盒', color: 'reward', icon: '🎁', sortOrder: 2, isDefault: true, description: '完成了重要任务？来这里随机抽一个奖励犒劳自己吧。' },
  { name: '惩罚盒', color: 'punish', icon: '⚡', sortOrder: 3, isDefault: true, description: '没完成计划？随机抽一个惩罚，对自己狠一点才能进步。' },
  { name: '杂事盒', color: 'misc', icon: '📦', sortOrder: 4, isDefault: true, description: '想到就记，统一处理，减少脑内占用。' },
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
  { boxName: '惩罚盒', content: '输出主题文章 2k 字' },
];

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalize(data) {
  return {
    boxes: Array.isArray(data.boxes) ? data.boxes : [],
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    settings: {
      deepseekApiKey: data.settings?.deepseekApiKey || '',
      themeMode: data.settings?.themeMode || 'system',
      soundEnabled: data.settings?.soundEnabled ?? true,
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
    dueDate: null,
    completedAt: null,
    createdAt: now,
  }));
  const initial = {
    boxes,
    tasks,
    settings: { deepseekApiKey: '', themeMode: 'system', soundEnabled: true },
  };
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

export function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(data)));
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
