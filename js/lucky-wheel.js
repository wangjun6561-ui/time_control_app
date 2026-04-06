import { getTasks, playSound } from './db.js';

export function openWheelSheet({ openSheet, box }) {
  openSheet((sheet, close) => {
    const tasks = getTasks().filter((t) => t.boxId === box.id && !t.isCompleted);
    sheet.innerHTML += `
      <h3>${box.name} · 随机抽取</h3>
      <div class="canvas-wrap"><canvas id="wheel-canvas"></canvas></div>
      <div style="display:flex;justify-content:center"><button id="spin" class="btn primary">开始</button></div>
      <div id="wheel-result" class="card" style="display:none"></div>
    `;

    const canvas = sheet.querySelector('#wheel-canvas');
    const ctx = canvas.getContext('2d');
    const size = Math.min(window.innerWidth * 0.85, 360);
    canvas.width = size;
    canvas.height = size;
    const radius = size / 2;
    let angle = 0;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      if (!tasks.length) {
        ctx.fillStyle = '#999';
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('空空如也', radius, radius);
        return;
      }
      const step = (Math.PI * 2) / tasks.length;
      tasks.forEach((task, i) => {
        const start = i * step + angle;
        ctx.beginPath();
        ctx.moveTo(radius, radius);
        ctx.arc(radius, radius, radius - 4, start, start + step);
        ctx.closePath();
        ctx.fillStyle = `rgba(255,107,107,${0.4 + (i % 3) * 0.2})`;
        ctx.fill();

        ctx.save();
        ctx.translate(radius, radius);
        ctx.rotate(start + step / 2);
        ctx.fillStyle = '#fff';
        ctx.font = `${Math.max(11, 16 - tasks.length / 2)}px sans-serif`;
        const tx = task.content.length > 9 ? `${task.content.slice(0, 9)}…` : task.content;
        ctx.fillText(tx, radius * 0.55, 4);
        ctx.restore();
      });
      ctx.beginPath();
      ctx.fillStyle = '#fff';
      ctx.arc(radius, radius, 30, 0, Math.PI * 2);
      ctx.fill();
    };

    draw();
    const spinBtn = sheet.querySelector('#spin');
    if (!tasks.length) spinBtn.disabled = true;

    spinBtn.addEventListener('click', () => {
      const duration = 3000 + Math.random() * 2000;
      const start = performance.now();
      const init = angle;
      const extra = Math.PI * (10 + Math.random() * 6);
      let lastSector = -1;

      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - (1 - t) ** 3;
        angle = init + extra * eased;
        draw();

        const sector = Math.floor((((Math.PI * 1.5 - angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)) / ((Math.PI * 2) / tasks.length));
        if (sector !== lastSector) {
          lastSector = sector;
          if (navigator.vibrate) navigator.vibrate(8);
        }

        if (t < 1) requestAnimationFrame(tick);
        else {
          const idx = (tasks.length - sector) % tasks.length;
          playSound('wheel-stop');
          const card = sheet.querySelector('#wheel-result');
          card.style.display = 'block';
          card.innerHTML = `🎉 抽中了：${tasks[idx].content}<div style="margin-top:10px"><button id="wheel-ok" class="btn primary">好的</button></div>`;
          card.querySelector('#wheel-ok').addEventListener('click', close);
        }
      };
      requestAnimationFrame(tick);
    });
  }, { height: '80vh' });
}
