// Shared terminal-chrome geometry: the SINGLE source of truth for how rows
// are divided between the tab bar, transcript, busy line, composer, status
// bars, and the auto-approve row. renderFrame, transcriptGeometry (selection
// math), and the autocomplete dropdown MUST all use this — three hand-rolled
// copies drifted before (4:3 vs 3:2 vs a third variant), desyncing selection
// and smearing dropdowns over the transcript on short terminals.
import { wrap } from './wrap.js';

export interface ChromeLayout {
  /** Tab-bar rows pinned at the top (0 when tabs hidden, normally 1). */
  topRows: number;
  statusRows: number;
  composerRows: number;
  bottomRows: number;
  /** Transcript content height (excludes chrome). */
  contentH: number;
  /** Transcript message width at this terminal width. */
  chatMw: number;
  /** Visible transcript rows (minus the busy line when running). */
  availableH: number;
}

export function chromeLayout(opts: {
  w: number;
  h: number;
  /** Current composer text (drives composer growth). */
  inputText: string;
  busy: boolean;
  topRows?: number;
  indent?: number;
}): ChromeLayout {
  const { w, h, inputText, busy } = opts;
  const topRows = opts.topRows ?? 0;
  const statusRows = h >= 20 ? 3 : 2;
  const innerW = Math.max(1, w - 6);
  const rawRows = inputText ? wrap(inputText, innerW) : [''];
  // Composer expands as the user types, up to 1/3 of screen height.
  // In short windowed mode (h < 24) use 3 rows for single-line input, 4 for multiline.
  const minComposer = h < 24 ? (rawRows.length > 1 ? 4 : 3) : 4;
  const composerRows = Math.min(Math.max(minComposer, Math.floor(h / 3)), rawRows.length + 2);
  // Bottom consists of composer, status bars, and the auto-approve row.
  const bottomRows = composerRows + statusRows + 1;
  const contentH = Math.max(1, h - bottomRows - topRows);
  const indent = opts.indent ?? 2;
  const chatMw = Math.min(w - indent * 2, Math.max(24, w - 4));
  const availableH = busy ? Math.max(1, contentH - 1) : contentH;
  return { topRows, statusRows, composerRows, bottomRows, contentH, chatMw, availableH };
}
