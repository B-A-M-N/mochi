import { describe, it, expect } from 'vitest';
import { THEMES, getTheme, getAllThemes, applyTheme, getCurrentTheme, themeSwatch, honorsNoColor, prefersReducedMotion, stripThemeColors, adaptThemeColors, themeContrastRatio, parseThemeRgb, loadSavedTheme, themeIsDark, canvasBg, tabActiveBg } from './themes.js';
import { setTheme, T } from './view.js';

describe('mochi themes', () => {
  it('defines 23 unique themes', () => {
    expect(THEMES.length).toBe(23);
    const ids = new Set(THEMES.map((t) => t.id));
    expect(ids.size).toBe(23);
  });

  it('keeps stable ids (persistence keys) while names stay tasteful', () => {
    // ids are load-bearing (theme.json, MOCHI_THEME); display names are free.
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(23);
    const names = THEMES.map((t) => t.name);
    expect(new Set(names).size).toBe(23);
    for (const n of names) expect(n.trim().length).toBeGreaterThan(0);
  });

  it('every theme has all required color tokens and description', () => {
    for (const theme of THEMES) {
      expect(theme.id).toBeTruthy();
      expect(theme.name).toBeTruthy();
      expect(theme.description).toBeTruthy();
      expect(theme.splashStops.length).toBeGreaterThanOrEqual(3);

      const c = theme.colors;
      expect(c.act).toContain('\x1b[');
      expect(c.plan).toContain('\x1b[');
      expect(c.success).toContain('\x1b[');
      expect(c.error).toContain('\x1b[');
      expect(c.warning).toContain('\x1b[');
      expect(c.gray).toContain('\x1b[');
      expect(c.grayDark).toContain('\x1b[');
      expect(c.fg).toContain('\x1b[');
      expect(c.bgUser).toContain('\x1b[');
      expect(c.rule).toContain('\x1b[');
      expect(c.pink).toContain('\x1b[');
      expect(c.magenta).toContain('\x1b[');
      expect(c.violet).toContain('\x1b[');
      expect(c.cyan).toContain('\x1b[');
      expect(c.lime).toContain('\x1b[');
      expect(c.orange).toContain('\x1b[');
      expect(c.teal).toContain('\x1b[');
      expect(c.bg).toContain('\x1b[');
    }
  });

  it('generates color swatches for each theme', () => {
    for (const theme of THEMES) {
      const sw = themeSwatch(theme);
      expect(sw).toContain('■');
    }
  });

  it('can look up themes by id or name', () => {
    expect(getTheme('cyber-void')?.name).toBe('Abyss');
    expect(getTheme('Mirage')?.id).toBe('vaporwave');
    expect(getTheme('solar-flare')?.name).toBe('Ember');
    expect(getTheme('deep-sea')?.name).toBe('Lagoon');
    expect(getTheme('retro-arcade')?.name).toBe('CRT');
    expect(getTheme('hacker-terminal')?.name).toBe('Phosphor');
    expect(getTheme('midnight-jazz')?.name).toBe('Noir');
    expect(getTheme('mochi-purple')?.name).toBe('Mochi Purple');
    expect(getTheme('paper-light')?.name).toBe('Paper');
  });

  it('dynamically switches theme and updates T palette in place', () => {
    const vapor = setTheme('vaporwave');
    expect(vapor.id).toBe('vaporwave');
    expect(T.act).toBe(vapor.colors.act);
    expect(T.bgUser).toBe(vapor.colors.bgUser);

    const solar = setTheme('solar-flare');
    expect(solar.id).toBe('solar-flare');
    expect(T.act).toBe(solar.colors.act);

    // Reset back to the default (paint-only: setTheme never touches disk,
    // so no test can cement a theme into the developer's real files).
    // Assert the painted palette (T), not the module-cached currentTheme id:
    // setTheme paints T/R in place while the id cache only moves on applyTheme.
    const mp = setTheme('mochi-purple');
    expect(T.act).toBe(mp.colors.act);
    expect(T.bgUser).toBe(mp.colors.bgUser);
  });

  it('persists chosen theme to disk and restores it across sessions', async () => {
    // Sandboxed HOME+cwd: applyTheme writes real files by design, so this
    // test must never run against the developer's actual home directory
    // (it once cemented cyber-void into real files on every suite run).
    const { mkdtempSync, rmSync, readFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { resolve } = await import('node:path');
    const prevHome = process.env.HOME;
    const prevCwd = process.cwd();
    const prevTheme = getCurrentTheme().id;
    const fakeHome = mkdtempSync(resolve(tmpdir(), 'mochi-home-'));
    try {
      process.env.HOME = fakeHome;
      process.chdir(fakeHome);
      applyTheme('retro-arcade');
      expect(process.env.MOCHI_THEME).toBe('retro-arcade');
      expect(getCurrentTheme().id).toBe('retro-arcade');
      const saved = JSON.parse(readFileSync(resolve(fakeHome, '.config', 'mochi', 'theme.json'), 'utf8'));
      expect(saved.theme).toBe('retro-arcade');

      applyTheme('mochi-purple');
      expect(getCurrentTheme().id).toBe('mochi-purple');
    } finally {
      process.chdir(prevCwd);
      if (prevHome === undefined) delete process.env.HOME;
      else process.env.HOME = prevHome;
      delete process.env.MOCHI_THEME;
      setTheme(prevTheme);
      rmSync(fakeHome, { recursive: true, force: true });
    }
  });
});

describe('themes are visually distinct', () => {
  // Verifies the key claim of the redesigned themes: most themes have a
  // distinct assistantGutter color (the most-seen color in the TUI), and
  // each theme picks at least one role color that no other theme uses.
  // This is what makes them "look different" rather than being the same
  // rainbow with different palette labels.
  it('most themes have unique assistantGutter colors (≥ 15 distinct)', () => {
    // Some themes intentionally share a gutter (midnight-jazz + obsidian-gold
    // both want gold; cyber-void + deep-sea both want cyan). That visual
    // kinship is a feature, not a bug. What matters is that the BULK of
    // themes pick distinct colors, which is the visible claim.
    const seen = new Map<string, string>();
    for (const t of THEMES) {
      const color = t.roleColors?.assistantGutter ?? t.colors.cyan;
      if (!seen.has(color)) seen.set(color, t.id);
    }
    expect(seen.size, `expected ≥ 15 distinct assistantGutter colors, got ${seen.size}`).toBeGreaterThanOrEqual(15);
  });

  it('every theme picks at least 4 role-color overrides', () => {
    // Each redesigned/new theme should customize at least 4 semantic
    // roles so the role colors genuinely differ from the palette default.
    for (const t of THEMES) {
      const overrides = Object.keys(t.roleColors ?? {}).length;
      expect(overrides, `${t.id} should customize at least 4 roles, has ${overrides}`).toBeGreaterThanOrEqual(4);
    }
  });

  it('themes differ in white-balance (fg color) so they read as different palettes', () => {
    // Collect distinct fg colors. With 20 themes covering cool, warm,
    // cream, ivory, charcoal etc, we expect at least 15 distinct values.
    const fgColors = new Set(THEMES.map((t) => t.colors.fg));
    expect(fgColors.size).toBeGreaterThanOrEqual(15);
  });

  it('themes differ in userBg so user-input highlights read as different surfaces', () => {
    const bgs = new Set(THEMES.map((t) => t.colors.bgUser));
    expect(bgs.size).toBeGreaterThanOrEqual(15);
  });

  it('themes include the developer-favorite set (Dracula, Tokyo Night, Catppuccin, Gruvbox, One Dark)', () => {
    const ids = new Set(THEMES.map((t) => t.id));
    for (const required of ['dracula', 'tokyo-night', 'catppuccin-mocha', 'gruvbox', 'one-dark']) {
      expect(ids.has(required), `missing required theme: ${required}`).toBe(true);
    }
  });

  it('NO_COLOR strips every escape byte from the adapted theme', () => {
    const prev = process.env.NO_COLOR;
    try {
      process.env.NO_COLOR = '1';
      expect(honorsNoColor()).toBe(true);
      const stripped = adaptThemeColors(THEMES[0]);
      for (const v of Object.values(stripped.colors)) {
        if (typeof v === 'string') expect(v).not.toContain('\x1b');
      }
      expect(stripThemeColors(THEMES[0]).colors.fg).toBe('');
    } finally {
      if (prev === undefined) delete process.env.NO_COLOR;
      else process.env.NO_COLOR = prev;
    }
    expect(honorsNoColor()).toBe(false);
  });

  it('reduced-motion is honored via env, NO_COLOR, or dumb terminal', () => {
    const prev = { ...process.env };
    try {
      delete process.env.NO_COLOR;
      process.env.TERM = 'xterm-256color';
      process.env.MOCHI_REDUCED_MOTION = '1';
      expect(prefersReducedMotion()).toBe(true);
      delete process.env.MOCHI_REDUCED_MOTION;
      expect(prefersReducedMotion()).toBe(false);
      process.env.TERM = 'dumb';
      expect(prefersReducedMotion()).toBe(true);
    } finally {
      process.env = prev;
    }
  });

  it('every theme passes WCAG AA body-text contrast (fg on bgUser ≥ 4.5)', () => {
    for (const t of THEMES) {
      const ratio = themeContrastRatio(t);
      expect(ratio, `${t.id} contrast unparseable`).not.toBeNull();
      expect(ratio as number, `${t.id} body contrast ${ratio?.toFixed(2)} below AA 4.5`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('ships a light theme for bright rooms (paper-light ≥ 7)', () => {
    const light = getTheme('paper-light');
    expect(light).toBeTruthy();
    expect(themeContrastRatio(light as never) as number).toBeGreaterThanOrEqual(7);
    expect(parseThemeRgb('no color here', 38)).toBeNull();
  });
});

describe('theme persistence', () => {
  it('applyTheme persists so loadSavedTheme restores it next launch', async () => {
    const { mkdtempSync, readFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { resolve } = await import('node:path');
    const prevHome = process.env.HOME;
    const prevCwd = process.cwd();
    const fakeHome = mkdtempSync(resolve(tmpdir(), 'mochi-home-'));
    try {
      process.env.HOME = fakeHome;
      process.chdir(fakeHome);
      applyTheme('dracula');
      const saved = JSON.parse(readFileSync(resolve(fakeHome, '.config', 'mochi', 'theme.json'), 'utf8'));
      expect(saved.theme).toBe('dracula');
      // loadSavedTheme is module-cached; verify via fresh file read path:
      // the file the next process reads must carry the choice.
      expect(loadSavedTheme().id).toBeTruthy();
    } finally {
      process.chdir(prevCwd);
      if (prevHome === undefined) delete process.env.HOME;
      else process.env.HOME = prevHome;
      rmSync(fakeHome, { recursive: true, force: true });
    }
  });
});

describe('theme distinctness (entire-look contract)', () => {
  it('every signature accent is unique — no two themes share an act color', () => {
    const seen = new Map<string, string>();
    for (const t of THEMES) {
      expect(seen.has(t.colors.act), `act ${t.colors.act} shared by ${seen.get(t.colors.act)} and ${t.id}`).toBe(false);
      seen.set(t.colors.act, t.id);
    }
    expect(seen.size).toBe(23);
  });

  it('every body-text color is unique', () => {
    const seen = new Map<string, string>();
    for (const t of THEMES) {
      expect(seen.has(t.colors.fg), `fg shared by ${seen.get(t.colors.fg)} and ${t.id}`).toBe(false);
      seen.set(t.colors.fg, t.id);
    }
    expect(seen.size).toBe(23);
  });

  it('every theme owns a canvas bg; dark set is everything but the two lights', () => {
    const lights = new Set(['paper-light', 'cotton-candy']);
    for (const t of THEMES) {
      expect(t.colors.bg, `${t.id} missing canvas bg`).toContain('\x1b[');
      expect(themeIsDark(t), `${t.id} dark classification`).toBe(!lights.has(t.id));
    }
  });

  it('tabActiveBg derives a dimmed act pill per theme (empty when unparseable)', async () => {
    // applyTheme (not setTheme) moves the getCurrentTheme cache that
    // tabActiveBg reads — and it writes real files, so sandbox HOME+cwd
    // exactly like the persistence tests above. COLORTERM is pinned so the
    // truecolor branch is deterministic on CI (no COLORTERM there); the
    // 256-color fallback is covered by the canvasBg capability tests.
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { resolve } = await import('node:path');
    const prevHome = process.env.HOME;
    const prevCwd = process.cwd();
    const prevTheme = getCurrentTheme().id;
    const prevColorTerm = process.env.COLORTERM;
    const fakeHome = mkdtempSync(resolve(tmpdir(), 'mochi-home-'));
    try {
      process.env.COLORTERM = 'truecolor';
      process.env.HOME = fakeHome;
      process.chdir(fakeHome);
      applyTheme('mochi-purple');
      expect(tabActiveBg()).toBe('\x1b[48;2;27;22;40m'); // 16% of act 167,139,250
      applyTheme('dracula');
      expect(tabActiveBg()).toBe('\x1b[48;2;13;40;20m'); // 16% of act 80,250,123
    } finally {
      applyTheme(prevTheme);
      process.chdir(prevCwd);
      if (prevHome === undefined) delete process.env.HOME;
      else process.env.HOME = prevHome;
      if (prevColorTerm === undefined) delete process.env.COLORTERM;
      else process.env.COLORTERM = prevColorTerm;
      rmSync(fakeHome, { recursive: true, force: true });
    }
  });
});

describe('mochi-purple default', () => {  it('exists, is dark, and passes AA on near-black', () => {
    const t = getTheme('mochi-purple');
    expect(t).toBeTruthy();
    expect(themeIsDark(t!)).toBe(true);
    expect(themeContrastRatio(t!) as number).toBeGreaterThanOrEqual(7);
  });
  it('classifies light themes as light (no forced black canvas)', () => {
    expect(themeIsDark(getTheme('paper-light')!)).toBe(false);
    expect(themeIsDark(getTheme('cotton-candy')!)).toBe(false);
  });
});

describe('canvasBg (capability-aware black canvas)', () => {
  const prev = { ...process.env };
  const reset = () => {
    delete process.env.NO_COLOR;
    delete process.env.MOCHI_THEME;
    process.env.TERM = 'xterm-256color';
    process.env.COLORTERM = 'truecolor';
    applyTheme('mochi-purple');
  };
  it('emits the theme canvas on truecolor dark themes (soft obsidian black for mochi-purple)', () => {
    reset();
    expect(canvasBg()).toBe('\x1b[48;2;10;10;10m');
  });
  it('emits nearest palette index on 256-color terms — never 24-bit codes', () => {
    reset();
    delete process.env.COLORTERM;
    expect(canvasBg()).toBe('\x1b[48;5;232m');
  });
  it('stays transparent for NO_COLOR and dumb terms', () => {
    reset();
    process.env.NO_COLOR = '1';
    expect(canvasBg()).toBe('');
    delete process.env.NO_COLOR;
    process.env.TERM = 'dumb';
    expect(canvasBg()).toBe('');
    Object.assign(process.env, prev);
  });
  it('stays transparent on light themes (via the real applyTheme path)', async () => {
    reset();
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { resolve } = await import('node:path');
    const prevHome = process.env.HOME;
    const prevCwd = process.cwd();
    const prevTheme = getCurrentTheme().id;
    const fakeHome = mkdtempSync(resolve(tmpdir(), 'mochi-home-'));
    try {
      process.env.HOME = fakeHome;
      // applyTheme also writes <cwd>/.mochi/theme.json — sandbox cwd too or
      // this test poisons the real repo's theme file (regression: dracula
      // hijacked the next launch in ~/mochi).
      process.chdir(fakeHome);
      applyTheme('paper-light');
      expect(getCurrentTheme().id).toBe('paper-light');
      expect(canvasBg()).toBe('');
    } finally {
      applyTheme(prevTheme);
      process.chdir(prevCwd);
      if (prevHome === undefined) delete process.env.HOME;
      else process.env.HOME = prevHome;
      rmSync(fakeHome, { recursive: true, force: true });
      Object.assign(process.env, prev);
    }
  });
});
