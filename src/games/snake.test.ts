import { describe, expect, it } from 'vitest';
import {
  createSnake,
  setDirection,
  step,
  type SnakeState,
} from './snake.js';

function newGame(seed = 1, wrap = false): SnakeState {
  return createSnake({ width: 5, height: 5, seed, wrap });
}

describe('createSnake', () => {
  it('places the snake horizontally, head on the right, in the middle row', () => {
    const s = newGame();
    expect(s.body).toEqual([
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ]);
    expect(s.direction).toBe('right');
    expect(s.status).toBe('playing');
    expect(s.score).toBe(0);
  });

  it('places food off the snake', () => {
    const s = newGame();
    for (const cell of s.body) {
      expect(cell.x === s.food.x && cell.y === s.food.y).toBe(false);
    }
  });

  it('rejects non-integer or too-small dimensions', () => {
    expect(() => createSnake({ width: 1 })).toThrow(RangeError);
    expect(() => createSnake({ height: 1.5 })).toThrow(RangeError);
  });
});

describe('step', () => {
  it('moves the head one cell in the current direction and pops the tail', () => {
    const s0 = newGame();
    const s1 = step(s0);
    expect(s1.body[0]).toEqual({ x: 3, y: 2 });
    expect(s1.body).toHaveLength(3);
    expect(s1.score).toBe(0);
  });

  it('preserves tail position when food is eaten (snake grows by 1)', () => {
    // Hand-craft a state where moving right lands on the food.
    const s0: SnakeState = {
      ...newGame(42),
      body: [{ x: 1, y: 0 }, { x: 0, y: 0 }],
      food: { x: 2, y: 0 },
    };
    const s1 = step(s0);
    expect(s1.body).toEqual([
      { x: 2, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ]);
    expect(s1.score).toBe(1);
  });

  it('ends the game when the head leaves the grid (no wrap)', () => {
    // Build a snake already at the right edge.
    const s0: SnakeState = {
      ...newGame(),
      body: [{ x: 4, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 2 }],
    };
    const s1 = step(s0);
    expect(s1.status).toBe('game_over');
  });

  it('wraps around the edge when wrap is true', () => {
    const s0: SnakeState = {
      ...newGame(7, true),
      body: [{ x: 4, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 2 }],
    };
    const s1 = step(s0);
    expect(s1.status).toBe('playing');
    expect(s1.body[0]).toEqual({ x: 0, y: 2 });
  });

  it('dies on self-collision (head runs into neck)', () => {
    // A 2x2 loop: head at (2,2) moving up, body wraps around; the next step
    // enters the neck cell (2,1) which is occupied by a non-tail body cell.
    const s0: SnakeState = {
      ...newGame(),
      body: [{ x: 2, y: 2 }, { x: 2, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
      direction: 'up',
      pendingDirection: 'up',
      food: { x: 9, y: 9 }, // not on the snake
    };
    const into = step(s0);
    expect(into.status).toBe('game_over');
  });

  it('does not mutate the input state (immutability)', () => {
    const s0 = newGame();
    const snapshot = JSON.stringify(s0);
    step(s0);
    expect(JSON.stringify(s0)).toBe(snapshot);
  });

  it('no-op when status is already game_over', () => {
    const s0: SnakeState = { ...newGame(), status: 'game_over' };
    expect(step(s0)).toBe(s0);
  });
});

describe('setDirection', () => {
  it('queues a perpendicular turn for the next step', () => {
    const s0 = newGame();
    const s1 = setDirection(s0, 'up');
    expect(s1.pendingDirection).toBe('up');
    expect(s1.direction).toBe('right'); // unchanged until next step
    const s2 = step(s1);
    expect(s2.body[0]).toEqual({ x: 2, y: 1 });
  });

  it('ignores 180° reversals', () => {
    const s0 = newGame();
    const s1 = setDirection(s0, 'left'); // opposite of right
    expect(s1).toBe(s0);
  });

  it('ignores no-op direction changes', () => {
    const s0 = newGame();
    expect(setDirection(s0, 'right')).toBe(s0);
  });

  it('ignores input after game over', () => {
    const s0: SnakeState = { ...newGame(), status: 'game_over' };
    expect(setDirection(s0, 'up')).toBe(s0);
  });
});
