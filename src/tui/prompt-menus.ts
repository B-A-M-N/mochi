// Interactive user-facing menus as testable units (onboard-flow / tools-menu
// pattern): ask_question option menus + approval allow/deny menus with all TUI
// effects injected, so scripted tests drive every path — single pick, custom
// text, multi-select rounds, skips, empty answers. app.ts stays a dispatcher.
import { T } from './view.js';
import type { LineKind } from './state.js';
import type {
  UserPromptRequest,
  UserPromptResponse,
  UserPromptAnswer,
} from '../tools/user-prompt.js';
import type {
  ApprovalRequest,
  ApprovalDecision,
} from '../security/approval.js';

export interface PromptMenuDeps {
  openMenu: (title: string, items: string[]) => Promise<number>;
  ask: (question: string) => Promise<string>;
  push: (kind: LineKind, text: string) => void;
  scheduleRender: () => void;
  setMenuSelected: (i: number) => void;
}

/** Interactive ask_question resolver (Claude Code / opencode parity): one
 *  menu per question — arrow keys + Enter to pick, Esc skips, "type my own"
 *  drops to free text, multi-select loops single picks until Done. */
export async function tuiPromptUser(
  deps: PromptMenuDeps,
  req: UserPromptRequest,
): Promise<UserPromptResponse> {
  const { openMenu, ask, push, scheduleRender, setMenuSelected } = deps;
  const answers: UserPromptAnswer[] = [];
  for (const q of req.questions) {
    const title = q.header ? `${q.header}: ${q.question}` : q.question;
    push('system', `? ${title}`);
    const picked: string[] = [];
    let custom = '';
    let skipped = false;
    if (!q.multiSelect) {
      const items = [
        ...q.options.map((o) => `${T.bold}${o.label}${T.reset}${o.recommended ? ` ${T.lime}(recommended)${T.reset}` : ''}${o.description ? `${T.grayDark} — ${o.description}${T.reset}` : ''}`),
        `${T.cyan}✎ Type my own answer…${T.reset}`,
      ];
      setMenuSelected(0);
      const idx = await openMenu(title, items);
      if (idx < 0 || idx >= items.length) {
        skipped = true;
      } else if (idx === items.length - 1) {
        custom = (await ask('Your answer (Enter to send, Esc to skip):')).trim();
        if (!custom) skipped = true;
      } else {
        picked.push(q.options[idx].label);
      }
    } else {
      for (;;) {
        const items = [
          ...q.options.map((o) => `${picked.includes(o.label) ? `${T.lime}●${T.reset}` : `${T.grayDark}○${T.reset}`} ${T.bold}${o.label}${T.reset}${o.description ? `${T.grayDark} — ${o.description}${T.reset}` : ''}`),
          `${T.lime}✓ Done — use selected${picked.length ? ` (${picked.length})` : ''}${T.reset}`,
          `${T.cyan}✎ Type my own answer…${T.reset}`,
        ];
        setMenuSelected(0);
        const idx = await openMenu(picked.length ? `${title} (${picked.length} selected)` : title, items);
        if (idx < 0 || idx >= items.length) break;
        if (idx === items.length - 1) {
          const t = (await ask('Your answer (Enter to send, empty keeps picking):')).trim();
          if (t) { custom = t; break; }
          continue;
        }
        if (idx === items.length - 2) break;
        const label = q.options[idx].label;
        if (!picked.includes(label)) picked.push(label);
      }
      if (picked.length === 0 && !custom) skipped = true;
    }
    if (skipped) push('system', '◇ question skipped — the agent proceeds with its best judgment');
    else push('system', `◇ you chose: ${[...picked, ...(custom ? [`"${custom}"`] : [])].join(', ')}`);
    answers.push({
      question: q.question,
      header: q.header,
      selected: picked,
      ...(custom ? { freeText: custom } : {}),
      ...(skipped ? { skipped: true } : {}),
    });
    scheduleRender();
  }
  return { answers };
}

/** Interactive approval gate (Claude Code parity): allow once / allow always
 *  this session / deny. Esc denies. */
export async function tuiRequestApproval(
  deps: PromptMenuDeps,
  req: ApprovalRequest,
): Promise<ApprovalDecision> {
  const { openMenu, push, scheduleRender, setMenuSelected } = deps;
  const risk = req.risk && req.risk !== 'low' ? ` ${T.warning ?? T.orange ?? ''}[risk: ${req.risk}]${T.reset}` : '';
  push('system', `? ${T.bold}${req.tool}${T.reset} wants to run: ${req.summary}${risk}`);
  const items = [
    `${T.lime}Allow once${T.reset}${T.grayDark} — run it this time${T.reset}`,
    `${T.cyan}Allow always${T.reset}${T.grayDark} — remember for this session${T.reset}`,
    `${T.error}Deny${T.reset}${T.grayDark} — skip it (Esc)${T.reset}`,
  ];
  setMenuSelected(0);
  const idx = await openMenu(`Allow ${req.tool}? (${req.policy})`, items);
  if (idx === 0) {
    push('system', `◇ allowed once: ${req.summary}`);
    scheduleRender();
    return 'allow-once';
  }
  if (idx === 1) {
    push('system', `◇ allowed always this session: ${req.summary}`);
    scheduleRender();
    return 'allow-always';
  }
  push('system', `◇ denied: ${req.summary} — the agent works around it`);
  scheduleRender();
  return 'deny';
}
