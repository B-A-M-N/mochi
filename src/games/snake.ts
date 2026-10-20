/**
 * Pure Snake game engine. No DOM, no I/O — just deterministic state and step
 * transitions. This is the single source of truth for rules; the HTML page
 * renders an image of `state` produced by this engine.
 *
 * Invariants:
 *   - The snake head is `body[0]`; `body[length-1]` is the tail.
 *   - On every `step`, the snake moves one cell in the current direction.
 *   - Eating food grows by exactly one cell (tail is not popped this tick).
 *   - Collision with walls or self ends the game (`status === 'game_over'`).
 *   - When `wrap` is true, the head wraps around edges instead of dying.
 *   - Food is never placed on the snake's body.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';
export type Status = 'playing' | 'game_over';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface SnakeState {
  readonly width: number;
  readonly height: number;
  readonly wrap: boolean;
  readonly body: readonly Point[]; // head first
  readonly direction: Direction;
  readonly pendingDirection: Direction; // applied next tick (prevents 180° suicide)
  readonly food: Point;
  readonly score: number;
  readonly status: Status;
}

export interface CreateOptions {
  readonly width?: number;
  readonly height?: number;
  readonly wrap?: boolean;
  readonly seed?: number;
}

const DEFAULT_WIDTH = 20;
const DEFAULT_HEIGHT = 20;

/** Tiny mulberry32 PRNG so tests can pin food placement. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIRS: Record<Direction, Point> = {
  up:    { x: 0,  y: -1 },
  down:  { x: 0,  y:  1 },
  left:  { x: -1, y:  0 },
  right: { x: 1,  y:  0 },
};

export const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

function isOpposite(a: Direction, b: Direction): boolean {
  return OPPOSITE[a] === b;
}

function occupied(state: Pick<SnakeState, 'body'>, p: Point): boolean {
  for (const cell of state.body) {
    if (cell.x === p.x && cell.y === p.y) return true;
  }
  return false;
}

function placeFood(
  width: number,
  height: number,
  body: readonly Point[],
  rng: () => number,
): Point {
  const free: Point[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p: Point = { x, y };
      if (!occupied({ body }, p)) free.push(p);
    }
  }
  if (free.length === 0) return { x: -1, y: -1 }; // board full, win state
  return free[Math.floor(rng() * free.length)]!;
}

export function createSnake(opts: CreateOptions = {}): SnakeState {
  const width = opts.width ?? DEFAULT_WIDTH;
  const height = opts.height ?? DEFAULT_HEIGHT;
  const wrap = opts.wrap ?? false;
  const rng = makeRng(opts.seed ?? Date.now());

  if (!Number.isInteger(width) || width < 2) {
    throw new RangeError('width must be an integer >= 2');
  }
  if (!Number.isInteger(height) || height < 2) {
    throw new RangeError('height must be an integer >= 2');
  }

  const midY = Math.floor(height / 2);
  const body: Point[] = [
    { x: Math.floor(width / 2),     y: midY },
    { x: Math.floor(width / 2) - 1, y: midY },
    { x: Math.floor(width / 2) - 2, y: midY },
  ];

  return {
    width,
    height,
    wrap,
    body,
    direction: 'right',
    pendingDirection: 'right',
    food: placeFood(width, height, body, rng),
    score: 0,
    status: 'playing',
  };
}

/**
 * Queue a direction change. 180° reversals are ignored so a player can't
 * kill themselves by tapping the opposite arrow at the last frame.
 */
export function setDirection(state: SnakeState, next: Direction): SnakeState {
  if (state.status !== 'playing') return state;
  if (isOpposite(state.direction, next)) return state;
  if (state.direction === next) return state;
  return { ...state, pendingDirection: next };
}

export function step(state: SnakeState): SnakeState {
  if (state.status !== 'playing') return state;

  const direction = state.pendingDirection;
  const head = state.body[0]!;
  const delta = DIRS[direction]!;
  let nx = head.x + delta.x;
  let ny = head.y + delta.y;

  // Wall handling
  if (state.wrap) {
    nx = (nx + state.width)  % state.width;
    ny = (ny + state.height) % state.height;
  } else if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) {
    return { ...state, status: 'game_over' };
  }

  const newHead: Point = { x: nx, y: ny };
  const ate = newHead.x === state.food.x && newHead.y === state.food.y;

  // Self-collision: check against every body cell the head will occupy.
  // If we're not eating, the tail vacates this tick, so the last cell is safe.
  const checkBody = ate ? state.body : state.body.slice(0, -1);
  if (occupied({ body: checkBody }, newHead)) {
    return { ...state, direction, status: 'game_over' };
  }

  const newBody = ate
    ? [newHead, ...state.body]
    : [newHead, ...state.body.slice(0, -1)];

  return {
    ...state,
    body: newBody,
    direction,
    pendingDirection: direction,
    food: ate ? placeFood(state.width, state.height, newBody, makeRng(state.score + 1)) : state.food,
    score: ate ? state.score + 1 : state.score,
    status: 'playing',
  };
}
