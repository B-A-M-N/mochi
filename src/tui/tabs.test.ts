import { describe, it, expect } from 'vitest';
import { TabManager, MAX_TABS, slugTitle, defaultTabTitle, tabBarCells, tabBarHit } from './tabs.js';

describe('TabManager', () => {
  it('starts with one default tab', () => {
    const m = new TabManager();
    expect(m.count()).toBe(1);
    expect(m.activeTab().index).toBe(1);
    expect(m.activeTab().title).toBe('New session');
  });

  it('creates, switches, and cycles', () => {
    const m = new TabManager();
    const b = m.create('api');
    expect(m.count()).toBe(2);
    expect(m.activeTab().id).toBe(b.id);
    m.switchTo(0);
    expect(m.activeTab().title).toBe('New session');
    expect(m.next().title).toBe('api');
    expect(m.prev().title).toBe('New session');
    expect(() => m.switchTo(9)).toThrow();
  });

  it('caps at MAX_TABS with a helpful error', () => {
    const m = new TabManager();
    for (let i = 1; i < MAX_TABS; i++) m.create(`t${i}`);
    expect(m.count()).toBe(MAX_TABS);
    expect(() => m.create('one-more')).toThrow(/Tab limit/);
  });

  it('closing the last tab resets instead of emptying', () => {
    const m = new TabManager();
    const only = m.activeTab().id;
    const after = m.close(only);
    expect(m.count()).toBe(1);
    expect(after.unread).toBe(0);
  });

  it('close keeps the active pointer valid', () => {
    const m = new TabManager();
    m.create('b');
    m.create('c');
    m.switchTo(2);
    m.close(1);
    expect(m.count()).toBe(2);
    expect(m.activeIndex()).toBe(1);
  });

  it('renames, auto-titles once, badges unread', () => {
    const m = new TabManager();
    const id = m.activeTab().id;
    expect(m.autoTitle(id, '/goal fix the login bug now')).toBe(true);
    expect(m.get(id)?.title).toBe('fix the login bug now'.slice(0, 24));
    expect(m.autoTitle(id, 'something else')).toBe(false);
    expect(() => m.rename(id, '   ')).toThrow();
    m.rename(id, 'auth-fix');
    expect(m.get(id)?.title).toBe('auth-fix');
    m.create('bg');
    m.markUnread(id);
    expect(m.get(id)?.unread).toBe(1);
    m.switchToId(id);
    expect(m.get(id)?.unread).toBe(0);
  });

  it('slugTitle strips commands and newlines', () => {
    expect(slugTitle('/goal fix x')).toBe('fix x');
    expect(slugTitle('a\nb')).toBe('a');
    expect(slugTitle('')).toBe('untitled');
    expect(defaultTabTitle(3)).toBe('New session 3');
    expect(defaultTabTitle(1)).toBe('New session');
  });
});
describe('tabBarCells + tabBarHit (clickable + button)', () => {
  const listOf = (m: TabManager) => m.list();
  it('lays out tabs with exact columns and a trailing + button', () => {
    const m = new TabManager();
    m.create('api');
    const layout = tabBarCells(listOf(m), m.activeTab().id, 100);
    expect(layout.cells.length).toBe(3); // 2 tabs + plus
    expect(layout.cells[2].plain).toBe('+ New session');
    expect(layout.cells[2].tabId).toBeNull();
    // Ranges tile with zero separators (cells carry their own padding).
    const [ps, pe] = layout.plusRange;
    expect(pe - ps).toBe(13);
    expect(layout.width).toBe(pe);
    // Every column inside a cell hit-tests to that cell.
    for (const [i, cell] of layout.cells.entries()) {
      const [s, e] = layout.ranges[i];
      for (let c = s; c < e; c++) {
        const hit = tabBarHit(layout, c);
        if (cell.tabId === null) expect(hit).toEqual({ kind: 'plus' });
        else expect(hit).toEqual({ kind: 'tab', index: cell.tabIndex });
      }
    }
    // Between-cell gaps and out-of-range are not clickable.
    expect(tabBarHit(layout, -1)).toBeNull();
    expect(tabBarHit(layout, 1000)).toBeNull();
  });

  it('always fits the bar + button, truncating titles deterministically', () => {
    const m = new TabManager();
    m.rename(m.activeTab().id, 'a-very-long-tab-title-that-keeps-going');
    m.create('another-extremely-long-title-here');
    m.create('third-long-title');
    for (const w of [40, 60, 80]) {
      const layout = tabBarCells(listOf(m), m.activeTab().id, w);
      expect(layout.width).toBeLessThanOrEqual(w);
      // Deterministic: same input, same columns.
      const again = tabBarCells(listOf(m), m.activeTab().id, w);
      expect(again.ranges).toEqual(layout.ranges);
      // Plus is still hittable at narrow widths.
      const [ps] = layout.plusRange;
      expect(tabBarHit(layout, ps)).toEqual({ kind: 'plus' });
    }
  });

  it('counts CJK title cells (not code points) for fit + hits', () => {
    const m = new TabManager();
    m.rename(m.activeTab().id, '日本語タブ');
    const layout = tabBarCells(listOf(m), m.activeTab().id, 100);
    expect(layout.width).toBeLessThanOrEqual(100);
    const [s, e] = layout.ranges[0];
    expect(e - s).toBe(1 + 5 * 2 + 0 + 0 + 1); // pad + 5 wide chars + unread(0) + busy(0) + pad
    expect(tabBarHit(layout, s)).toEqual({ kind: 'tab', index: 0 });
  });
});
