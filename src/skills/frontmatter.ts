// Shared YAML frontmatter helpers used by BOTH frontmatter parsers
// (`skills.ts` and `skill-manager.ts`). Kept in one place so the two cannot
// drift — a previous split is exactly how block scalars went unhandled in one
// of them.

/** Does a frontmatter value look like a YAML block-scalar indicator?
 *  (`|`, `>-`, `|+`, `|2-`, `>2` …) */
export const BLOCK_SCALAR_RE = /^([|>])[\d+-]*$/;

/** Strip a SINGLE pair of matching surrounding quotes only. The old
 *  `replace(/^["']|["']$/g, '')` stripped from each end independently, so a
 *  value like `echo "hello world"` lost its trailing quote (and `"foo` its
 *  leading one). */
export function stripMatchingQuotes(v: string): string {
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1);
  }
  return v;
}

/** Fold a YAML folded-scalar (`>`) block: adjacent non-empty lines join with a
 *  space, blank lines become paragraph breaks. */
export function foldBlockLines(lines: string[]): string {
  let out = '';
  for (const l of lines) {
    if (l === '') { out += '\n'; continue; }
    if (out && !out.endsWith('\n')) out += ' ';
    out += l;
  }
  return out;
}

/**
 * Consume the indented continuation lines of a block scalar whose indicator
 * line is `lines[start]`. Returns the scalar text (chomping applied, trimmed)
 * and the index of the last consumed line.
 *
 * Imported Cursor / Antigravity / Hermes skills write long descriptions this
 * way; ignoring the continuation left the value as a bare `>-` and broke skill
 * retrieval (which is description-driven) and the `<available_skills>` prompt.
 */
export function readBlockScalar(
  lines: string[],
  start: number,
  indicator: string,
): { text: string; next: number } {
  const style = indicator[0];
  const collected: string[] = [];
  let i = start;
  while (i + 1 < lines.length) {
    const next = lines[i + 1];
    if (next.trim() === '') { collected.push(''); i++; continue; }
    if (!/^\s/.test(next)) break;
    collected.push(next.replace(/^\s+/, ''));
    i++;
  }
  while (collected.length && collected[collected.length - 1] === '') collected.pop();
  let text = style === '|' ? collected.join('\n') : foldBlockLines(collected);
  if (!indicator.includes('+')) text = text.replace(/\n+$/, '');
  return { text: text.trim(), next: i };
}
