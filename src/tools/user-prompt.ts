// Interactive user prompt contract (Claude Code / opencode parity).
//
// When the model is blocked on a genuine user decision mid-task it calls the
// `ask_question` tool instead of guessing. The tool resolves the question(s)
// through `ToolContext.promptUser`, which the TUI wires to an interactive
// option menu (arrow keys + Enter, Esc to skip, free-text fallback).
// Headless hosts (CLI non-TTY, daemon, ACP, SDK) leave `promptUser` unset and
// the tool falls back to deterministic defaults (recommended/first option) so
// automation never hangs waiting for input that cannot arrive.
//
// This file is transport-agnostic: no TUI imports, no cycles (tools/types.ts
// imports the types only).

/** One selectable answer for a question. */
export interface UserPromptOption {
  label: string;
  description?: string;
  /** Shown as "(recommended)" and wins the headless default. */
  recommended?: boolean;
}

/** One question presented to the user. */
export interface UserPromptQuestion {
  question: string;
  /** Short (<=12 char) header shown above the question, e.g. "Auth". */
  header?: string;
  options: UserPromptOption[];
  /** When true the user may pick several options (sequential picks). */
  multiSelect?: boolean;
}

export interface UserPromptRequest {
  questions: UserPromptQuestion[];
  toolCallId?: string;
}

export interface UserPromptAnswer {
  question: string;
  header?: string;
  /** Labels the user picked (empty when skipped). */
  selected: string[];
  /** Free-typed answer when the user chose "type my own". */
  freeText?: string;
  /** True when no interactive UI existed and defaults were used. */
  usedDefault?: boolean;
  /** True when the user dismissed the question (Esc) without answering. */
  skipped?: boolean;
}

export interface UserPromptResponse {
  answers: UserPromptAnswer[];
}

/** Host-provided interactive resolver. Set by the TUI; absent headless. */
export type PromptUserFn = (req: UserPromptRequest) => Promise<UserPromptResponse>;

const MAX_QUESTIONS = 4;
const MAX_OPTIONS = 4;

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function toOption(raw: unknown): UserPromptOption | null {
  if (typeof raw === 'string') {
    const label = raw.trim().slice(0, 80);
    return label ? { label } : null;
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const label = str(o.label ?? o.name ?? o.value, 80);
    if (!label) return null;
    const description = str(o.description ?? o.hint, 200) || undefined;
    const recommended = o.recommended === true || o.recommend === true || undefined;
    return { label, description, recommended };
  }
  return null;
}

function toQuestion(raw: unknown): UserPromptQuestion | null {
  if (typeof raw === 'string') {
    const question = raw.trim().slice(0, 500);
    return question ? { question, options: [] } : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const question = str(o.question ?? o.text ?? o.prompt, 500);
  if (!question) return null;
  const header = str(o.header ?? o.title, 12) || undefined;
  const rawOptions = Array.isArray(o.options) ? o.options
    : Array.isArray(o.choices) ? o.choices
    : [];
  const options = rawOptions.map(toOption).filter((x): x is UserPromptOption => x !== null).slice(0, MAX_OPTIONS);
  const multiSelect = o.multiSelect === true || o.multi_select === true || undefined;
  return { question, header, options, multiSelect };
}

/** Normalize the model's loose args into a bounded request. Accepts both the
 *  structured form (`{questions: [{question, header?, options, multiSelect?}]}`)
 *  and the flat single-question form (`{question, header?, options, multiSelect?}`). */
export function normalizePromptRequest(args: Record<string, unknown>): UserPromptRequest {
  const rawList = Array.isArray(args.questions) ? args.questions : [args];
  const questions = rawList.map(toQuestion).filter((q): q is UserPromptQuestion => q !== null).slice(0, MAX_QUESTIONS);
  return { questions, toolCallId: typeof args.toolCallId === 'string' ? args.toolCallId : undefined };
}

/** Deterministic headless fallback: recommended option wins, else the first.
 *  Never blocks, never throws — automation always gets an answer. */
export function headlessUserPrompt(req: UserPromptRequest): UserPromptResponse {
  return {
    answers: req.questions.map((q) => {
      const pick = q.options.find((o) => o.recommended) ?? q.options[0];
      return {
        question: q.question,
        header: q.header,
        selected: pick ? [pick.label] : [],
        usedDefault: true,
      };
    }),
  };
}

/** Model-readable rendering of the user's answers. */
export function formatUserPromptResult(res: UserPromptResponse, usedHeadlessFallback: boolean): string {
  const lines: string[] = [];
  if (usedHeadlessFallback) {
    lines.push('(No interactive UI is attached to this run, so defaults were used. Do not treat them as considered user decisions — prefer the safest option and note the assumption.)');
  }
  for (const a of res.answers) {
    const head = a.header ? `[${a.header}] ` : '';
    if (a.skipped || (a.selected.length === 0 && !a.freeText)) {
      lines.push(`- ${head}${a.question} → (user skipped; proceed with your best judgment)`);
      continue;
    }
    const parts = [...a.selected];
    if (a.freeText) parts.push(`(custom: ${a.freeText})`);
    lines.push(`- ${head}${a.question} → ${parts.join(', ') || '(no selection)'}`);
  }
  return `User answers:\n${lines.join('\n') || '(no questions)'}`;
}
