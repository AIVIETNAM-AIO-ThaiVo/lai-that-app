// Giao diện: vẽ state từ logic.js ra DOM và nhận chạm. Không chứa luật chơi.
import { LEVELS, createState, tap, isComplete, isHorizontal } from './logic.js';

const lot = document.getElementById('lot');
const levelName = document.getElementById('level-name');
const complete = document.getElementById('complete');

let state = createState(0);

const ARROW = { right: '→', left: '←', up: '↑', down: '↓' };
const EXIT_OFFSET = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] };

function render() {
  levelName.textContent = LEVELS[state.levelIndex].name;
  lot.replaceChildren(
    ...state.cars.map((car) => {
      const el = document.createElement('button');
      el.className = 'car';
      el.dataset.car = car.id;
      el.setAttribute('aria-label', `Xe ${car.id}`);
      el.textContent = ARROW[car.dir];
      el.style.background = car.color;
      const w = isHorizontal(car) ? car.len : 1;
      const h = isHorizontal(car) ? 1 : car.len;
      el.style.left = `calc(8px + var(--cell) * ${car.x} + 3px)`;
      el.style.top = `calc(8px + var(--cell) * ${car.y} + 3px)`;
      el.style.width = `calc(var(--cell) * ${w} - 6px)`;
      el.style.height = `calc(var(--cell) * ${h} - 6px)`;
      el.addEventListener('click', () => onTap(car.id, el));
      return el;
    }),
  );
  complete.hidden = !isComplete(state);
}

function onTap(id, el) {
  const car = state.cars.find((c) => c.id === id);
  const next = tap(state, id);
  if (next.result === 'blocked') {
    el.classList.remove('blocked');
    void el.offsetWidth; // chạy lại animation
    el.classList.add('blocked');
    return;
  }
  if (next.result !== 'exited') return;
  state = next.state;
  const [dx, dy] = EXIT_OFFSET[car.dir];
  el.style.transform = `translate(${dx * 500}px, ${dy * 500}px)`;
  el.style.opacity = '0';
  setTimeout(render, 350);
}

// Hợp đồng với bot test (xem CLAUDE.md). Đừng xoá.
window.__game = {
  state: () => state,
  cars: () => state.cars.map((c) => c.id),
};

render();
