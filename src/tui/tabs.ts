// Multi-tab session manager (opencode-style): several isolated agent
// sessions live in ONE terminal. Each tab owns its title, runtime session,
// unread badge, and busy flag; transcripts/state objects are owned by the
// TUI layer keyed by tab id. This module is pure (no terminal, no runtime)
// so every rule below is unit-tested.
export interface TabInfo {
  id: string;
  title: string;
  /** 1-based position for Alt+1..9 display. */
  index: number;
  busy: boolean;
  unread: number;
  createdAt: number;
  lastActiveAt: number;
}

/** Hard cap: more parallel agent sessions than this melts small boxes. */
export const MAX_TABS = 8;

let tabSeq = 0;

export function defaultTabTitle(n: number): string {
  return n <= 1 ? 'New session' : `New session ${n}`;
}
/** Slug a tab title from the user's first prompt (24 cols, no newlines). */
export function slugTitle(prompt: string): string {
  const s = prompt.replace(/^\/\w+\s*/, '').trim().split('\n')[0].slice(0, 24).trim();
  return s || 'untitled';
}

export class TabManager {
  private tabs: TabInfo[] = [];
  private active = 0;
  private counter = 0;

  constructor() {
    this.create(defaultTabTitle(1));
  }

  list(): TabInfo[] {
    return this.tabs.map((t, i) => ({ ...t, index: i + 1 }));
  }

  activeTab(): TabInfo {
    return { ...this.tabs[this.active], index: this.active + 1 };
  }

  activeIndex(): number {
    return this.active;
  }

  count(): number {
    return this.tabs.length;
  }

  get(id: string): TabInfo | undefined {
    const i = this.tabs.findIndex((t) => t.id === id);
    return i < 0 ? undefined : { ...this.tabs[i], index: i + 1 };
  }

  create(title?: string): TabInfo {
    if (this.tabs.length >= MAX_TABS) {
      throw new Error(`Tab limit reached (${MAX_TABS}). Close one with Alt+W or /tab close first.`);
    }
    this.counter++;
    const now = Date.now();
    const tab: TabInfo = {
      id: `tab-${now.toString(36)}-${tabSeq++}`,
      title: title?.trim() || defaultTabTitle(this.counter),
      index: this.tabs.length + 1,
      busy: false,
      unread: 0,
      createdAt: now,
      lastActiveAt: now,
    };
    this.tabs.push(tab);
    this.active = this.tabs.length - 1;
    return { ...tab };
  }

  /** Close by id or 0-based index. Never drops the last tab: closing it
   *  resets it to a fresh default instead. Returns the new active tab. */
  close(idOrIndex: string | number): TabInfo {
    const i = typeof idOrIndex === 'number' ? idOrIndex : this.tabs.findIndex((t) => t.id === idOrIndex);
    if (i < 0 || i >= this.tabs.length) throw new Error('No such tab.');
    if (this.tabs.length === 1) {
      const now = Date.now();
      this.counter++;
      this.tabs[0] = { ...this.tabs[0], title: defaultTabTitle(this.counter), busy: false, unread: 0, createdAt: now, lastActiveAt: now };
      this.active = 0;
      return this.activeTab();
    }
    this.tabs.splice(i, 1);
    if (this.active >= this.tabs.length) this.active = this.tabs.length - 1;
    else if (this.active > i) this.active--;
    this.tabs[this.active].lastActiveAt = Date.now();
    return this.activeTab();
  }

  switchTo(index: number): TabInfo {
    if (index < 0 || index >= this.tabs.length) throw new Error(`Tab ${index + 1} does not exist (${this.tabs.length} open).`);
    this.active = index;
    this.tabs[index].unread = 0;
    this.tabs[index].lastActiveAt = Date.now();
    return this.activeTab();
  }

  switchToId(id: string): TabInfo {
    const i = this.tabs.findIndex((t) => t.id === id);
    if (i < 0) throw new Error('No such tab.');
    return this.switchTo(i);
  }

  next(): TabInfo {
    return this.switchTo((this.active + 1) % this.tabs.length);
  }

  prev(): TabInfo {
    return this.switchTo((this.active - 1 + this.tabs.length) % this.tabs.length);
  }

  rename(id: string, title: string): TabInfo {
    const t = this.tabs.find((x) => x.id === id);
    if (!t) throw new Error('No such tab.');
    const clean = title.trim().slice(0, 32);
    if (!clean) throw new Error('Title must not be empty.');
    t.title = clean;
    return { ...t, index: this.tabs.indexOf(t) + 1 };
  }

  /** Auto-title a default-named tab from the first user prompt (once). */
  autoTitle(id: string, prompt: string): boolean {
    const t = this.tabs.find((x) => x.id === id);
    if (!t || !/^(tab \d+|New session( \d+)?)$/.test(t.title)) return false;
    t.title = slugTitle(prompt);
    return true;
  }

  setBusy(id: string, busy: boolean): void {
    const t = this.tabs.find((x) => x.id === id);
    if (t) t.busy = busy;
  }

  /** A background tab produced output: badge it (active tab clears on view). */
  markUnread(id: string): void {
    const t = this.tabs.find((x) => x.id === id);
    if (t && this.tabs[this.active].id !== id && t.unread < 99) t.unread++;
  }

  clearUnread(id: string): void {
    const t = this.tabs.find((x) => x.id === id);
    if (t) t.unread = 0;
  }
}

// ---- Clickable tab-bar layout (opencode-style `+` button) ------------------
// Pure column math so mouse hit-testing matches the rendered row EXACTLY:
// the renderer styles these plain cells (ANSI = zero-width) and joins them
// with single spaces, so columns below are the source of truth for clicks.
// Widths are TERMINAL CELLS (CJK titles count 2), via wrap.ts.

import { visibleCells, sliceCells } from './wrap.js';

export interface TabBarCell {
  /** Tab id, or null for the `+ New session` button. */
  tabId: string | null;
  /** Plain (unstyled) cell text; width = visibleCells(plain) in cells.
   *  opencode-style pills: ` {title}{dots} ` — the renderer fills the
   *  active pill with a surface bg, idle pills stay dim text. */
  plain: string;
  /** 0-based index into tabs.list(), -1 for `+`. */
  tabIndex: number;
  /** Structured parts (renderer colors these; plain === ' '+title+unread+busy+' '). */
  title: string;
  unread: string;
  busy: string;
}

export interface TabBarLayout {
  cells: TabBarCell[];
  /** 0-based [start, end) column range per cell (parallel to cells). */
  ranges: Array<[number, number]>;
  /** Whether the key-hint suffix fits after the cells. */
  showHint: boolean;
  /** 0-based [start, end) column range of the `+` button (always present). */
  plusRange: [number, number];
  /** Total plain width including separators (excludes hint). */
  width: number;
}

/** Plain key-hint suffix (styled by the renderer; measured here). */
export const TAB_HINT_PLAIN = 'Alt+T new · Alt+W close · Alt+1-8 switch';

/** Build the tab-bar cells for a terminal width, truncating titles only as
 *  much as needed so bar + `+ New session` ALWAYS fit (no ellipsize-and-guess).
 *  Active-vs-idle styling is the renderer's job (it knows the active id);
 *  columns here are identical for both, so hit-testing stays exact. */
export function tabBarCells(list: TabInfo[], _activeId: string, maxWidth: number): TabBarLayout {
  const w = Math.max(8, maxWidth);
  const unreadOf = (t: TabInfo) => (t.unread > 0 ? ' •' : '');
  // Pill per tab: ` ` + title + unread-dot + busy-dot + ` `, badges
  // space-separated (` api • ● `) — dots jammed on text read as typos.
  // Fixed overhead = 1 + unread + busy + 1.
  const fixedOf = (t: TabInfo) => 1 + unreadOf(t).length + (t.busy ? 2 : 0) + 1;
  // Fair-share title budget: shrink only titles that exceed it.
  const fixedSum = list.reduce((n, t) => n + fixedOf(t), 0);
  // Cells tile with NO separators: each tab cell carries its own symmetric
  // padding (` {title}{dots} `) and the `+` cell follows the last trailing
  // space directly. The renderer joins with '' so columns match exactly.
  const plusWidth = visibleCells('+ New session');
  let titleBudget = Math.floor((w - plusWidth - fixedSum) / Math.max(1, list.length));
  // Narrow terminals shrink titles to a bare '…' rather than overflowing:
  // the bar + `+` must ALWAYS fit so clicks stay exact.
  titleBudget = Math.max(1, titleBudget);
  const cells: TabBarCell[] = list.map((t, i) => {
    let title = t.title;
    if (visibleCells(title) > titleBudget) title = sliceCells(title, Math.max(0, titleBudget - 1)).text + '…';
    const unread = unreadOf(t);
    const busy = t.busy ? ' ●' : '';
    const plain = ` ${title}${unread}${busy} `;
    return { tabId: t.id, plain, tabIndex: i, title, unread, busy };
  });
  cells.push({ tabId: null, plain: '+ New session', tabIndex: -1, title: '+ New session', unread: '', busy: '' });
  const ranges: Array<[number, number]> = [];
  let x = 0;
  cells.forEach((c) => {
    const cw = visibleCells(c.plain);
    ranges.push([x, x + cw]);
    x += cw;
  });
  const showHint = x + 1 + visibleCells(TAB_HINT_PLAIN) <= w;
  return { cells, ranges, showHint, plusRange: ranges[ranges.length - 1], width: x };
}

/** Hit-test a 0-based column against a layout: tab index, 'plus', or null
 *  (separators, hint, and empty space are not clickable). */
export function tabBarHit(layout: TabBarLayout, col: number): { kind: 'tab'; index: number } | { kind: 'plus' } | null {
  if (col < 0) return null;
  for (let i = 0; i < layout.cells.length; i++) {
    const [s, e] = layout.ranges[i];
    if (col >= s && col < e) {
      const c = layout.cells[i];
      return c.tabId === null ? { kind: 'plus' } : { kind: 'tab', index: c.tabIndex };
    }
  }
  return null;
}
