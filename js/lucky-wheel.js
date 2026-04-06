import { getTasksByBox, playSound } from './db.js';
import { openSheet } from './app.js';

export function openLuckyWheel(box) {
  const pendingTasks = getTasksByBox(box.id).filter((t) => !t.isCompleted);
  const { root } = openSheet(`
    <div class="sheet-handle"></div>
    <div class="sheet-content wheel">
      <h3>${box.name} · 随机抽取</h3>
      <canvas id="wheelCanvas"></canvas>
      <button id="spinBtn" class="btn primary ${box.color}" ${pendingTasks.length ? '' : 'disabled'}>开始</button>
      <div id="wheelResult" class="result-card"></div>
    </div>
  `, { height: '80vh' });

  const canvas = root.querySelector('#wheelCanvas');
  const ctx = canvas.getContext('2d');
  const size = Math.min(window.innerWidth * 0.85, 360);
  canvas.width = size;
  canvas.height = size;

  let angle = 0;
  const draw = () => {
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2;
    const r = size / 2 - 4;

    if (!pendingTasks.length) {
      ctx.fillStyle = '#aaa';
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('空空如也', cx, cx);
      return;
    }

    const step = (Math.PI * 2) / pendingTasks.length;
    pendingTasks.forEach((task, i) => {
      const start = angle + i * step;
      const end = start + step;
      ctx.beginPath();
      ctx.moveTo(cx, cx);
      ctx.arc(cx, cx, r, start, end);
      ctx.closePath();
      ctx.fillStyle = `hsla(${(i * 60) % 360} 80% 60% / ${0.8 - (i % 3) * 0.15})`;
      ctx.fill();

      ctx.save();
      ctx.translate(cx, cx);
      ctx.rotate(start + step / 2);
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.max(11, 15 - pendingTasks.length / 2)}px sans-serif`;
      ctx.textAlign = 'right';
      const text = task.content.length > 12 ? `${task.content.slice(0, 11)}…` : task.content;
      ctx.fillText(text, r - 16, 4);
      ctx.restore();
    });

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, cx, 28, 0, Math.PI * 2);
    ctx.fill();
  };

  draw();

  root.querySelector('#spinBtn').addEventListener('click', () => {
    const duration = 3000 + Math.random() * 2000;
    const start = performance.now();
    const baseAngle = angle;
    const target = angle + Math.PI * 10 + Math.random() * Math.PI * 2;
    let lastSector = -1;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      angle = baseAngle + (target - baseAngle) * eased;
      draw();

      const sector = Math.floor(((Math.PI * 2 - (angle % (Math.PI * 2))) / (Math.PI * 2)) * pendingTasks.length);
      if (sector !== lastSector) {
        lastSector = sector;
        playSound('wheel-stop');
      }

      if (t < 1) requestAnimationFrame(tick);
      else {
        const finalSector = (pendingTasks.length - (Math.floor((angle % (Math.PI * 2)) / ((Math.PI * 2) / pendingTasks.length))) - 1 + pendingTasks.length) % pendingTasks.length;
        root.querySelector('#wheelResult').innerHTML = `<p>🎉 抽中了：${pendingTasks[finalSector].content}</p><button class="btn" id="okBtn">好的</button>`;
        root.querySelector('#okBtn').addEventListener('click', () => root.querySelector('#wheelResult').innerHTML = '');
      }
    };
    requestAnimationFrame(tick);
  });
}
