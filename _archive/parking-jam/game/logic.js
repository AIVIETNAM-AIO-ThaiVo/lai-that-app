// Luật chơi Parking Jam. Hàm thuần: không đụng DOM, không đổi state cũ (luôn trả state mới).
// Dùng được cả trong trình duyệt (ui.js) lẫn trong node (game/tests/*.test.js).

export const SIZE = 6;

const STEP = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] };

export const LEVELS = [
  {
    name: 'Level 1',
    cars: [
      { id: 'A', x: 0, y: 2, len: 2, dir: 'right', color: '#E4572E' },
      { id: 'B', x: 3, y: 0, len: 3, dir: 'down', color: '#4E3DC2' },
      { id: 'C', x: 5, y: 4, len: 2, dir: 'up', color: '#0F7A70' },
    ],
  },
  {
    name: 'Level 2',
    cars: [
      { id: 'A', x: 1, y: 1, len: 2, dir: 'right', color: '#E4572E' },
      { id: 'B', x: 4, y: 0, len: 2, dir: 'down', color: '#4E3DC2' },
      { id: 'C', x: 2, y: 4, len: 3, dir: 'right', color: '#0F7A70' },
      { id: 'D', x: 5, y: 3, len: 3, dir: 'up', color: '#C9781A' },
      { id: 'E', x: 0, y: 3, len: 2, dir: 'down', color: '#2F6FD1' },
    ],
  },
  {
    name: 'Level 3',
    cars: [
      { id: 'A', x: 0, y: 1, len: 2, dir: 'down', color: '#E4572E' },
      { id: 'B', x: 2, y: 2, len: 2, dir: 'left', color: '#4E3DC2' },
      { id: 'C', x: 4, y: 1, len: 3, dir: 'down', color: '#0F7A70' },
      { id: 'D', x: 4, y: 0, len: 2, dir: 'right', color: '#C9781A' },
      { id: 'F', x: 0, y: 4, len: 2, dir: 'left', color: '#2F6FD1' },
      { id: 'G', x: 3, y: 5, len: 2, dir: 'right', color: '#B23A2A' },
    ],
  },
];

export const isHorizontal = (car) => car.dir === 'left' || car.dir === 'right';

/** Các ô xe đang chiếm, tính từ ô (x, y) ở góc trên-trái. */
export function cells(car) {
  const [dx, dy] = isHorizontal(car) ? [1, 0] : [0, 1];
  return Array.from({ length: car.len }, (_, i) => [car.x + dx * i, car.y + dy * i]);
}

export function createState(levelIndex = 0) {
  const level = LEVELS[levelIndex];
  if (!level) throw new Error(`Không có level ${levelIndex}`);
  return { levelIndex, cars: level.cars.map((c) => ({ ...c })) };
}

function occupied(state, exceptId) {
  const set = new Set();
  for (const car of state.cars) {
    if (car.id === exceptId) continue;
    for (const [x, y] of cells(car)) set.add(`${x},${y}`);
  }
  return set;
}

/** Ô đầu xe theo hướng chạy. */
function head(car) {
  const all = cells(car);
  return car.dir === 'left' || car.dir === 'up' ? all[0] : all[all.length - 1];
}

/** Xe có đường trống tới mép bãi không. */
export function canExit(state, id) {
  const car = state.cars.find((c) => c.id === id);
  if (!car) return false;
  const busy = occupied(state, id);
  const [dx, dy] = STEP[car.dir];
  let [x, y] = head(car);
  for (;;) {
    x += dx;
    y += dy;
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return true;
    if (busy.has(`${x},${y}`)) return false;
  }
}

/** Chạm vào xe. Trả về { state, result } với result là 'exited' | 'blocked' | 'missing'. */
export function tap(state, id) {
  if (!state.cars.some((c) => c.id === id)) return { state, result: 'missing' };
  if (!canExit(state, id)) return { state, result: 'blocked' };
  return { state: { ...state, cars: state.cars.filter((c) => c.id !== id) }, result: 'exited' };
}

export const isComplete = (state) => state.cars.length === 0;
