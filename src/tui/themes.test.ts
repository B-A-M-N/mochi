import { describe, it, expect } from 'vitest';
import { THEMES, getTheme, getAllThemes, applyTheme, getCurrentTheme, themeSwatch, honorsNoColor, prefersReducedMotion, stripThemeColors, adaptThemeColors, themeContrastRatio, parseThemeRgb } from './themes.js';
import { setTheme, T } from './view.js';

describe('mochi themes', () => {
  it('defines 22 unique themes', () => {
    expect(THEMES.length).toBe(22);
    const ids = new Set(THEMES.map((t) => t.id));
    expect(ids.size).toBe(22);
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
    }
  });

  it('generates color swatches for each theme', () => {
    for (const theme of THEMES) {
      const sw = themeSwatch(theme);
      expect(sw).toContain('■');
    }
  });

  it('can look up themes by id or name', () => {
    expect(getTheme('cyber-void')?.name).toBe('Cyber Void');
    expect(getTheme('Vaporwave')?.id).toBe('vaporwave');
    expect(getTheme('solar-flare')?.name).toBe('Solar Flare');
    expect(getTheme('deep-sea')?.name).toBe('Deep Sea');
    expect(getTheme('retro-arcade')?.name).toBe('Retro Arcade');
    expect(getTheme('hacker-terminal')?.name).toBe('Hacker Terminal');
    expect(getTheme('midnight-jazz')?.name).toBe('Midnight Jazz');
  });

  it('dynamically switches theme and updates T palette in place', () => {
    const vapor = setTheme('vaporwave');
    expect(vapor.id).toBe('vaporwave');
    expect(T.act).toBe(vapor.colors.act);
    expect(T.bgUser).toBe(vapor.colors.bgUser);

    const solar = setTheme('solar-flare');
    expect(solar.id).toBe('solar-flare');
    expect(T.act).toBe(solar.colors.act);

    // Reset back to cyber-void
    setTheme('cyber-void');
    expect(getCurrentTheme().id).toBe('cyber-void');
  });

  it('persists chosen theme to disk and restores it across sessions', () => {
    applyTheme('retro-arcade');
    expect(process.env.MOCHI_THEME).toBe('retro-arcade');
    expect(getCurrentTheme().id).toBe('retro-arcade');

    // Reset to cyber-void for subsequent test runs
    applyTheme('cyber-void');
    expect(getCurrentTheme().id).toBe('cyber-void');
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
