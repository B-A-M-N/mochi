// ask_question — mid-task user clarification (Claude Code `ask_user_question` /
// opencode question-tool parity).
//
// The model calls this when it is genuinely blocked on a user decision
// (which auth library, which scope, proceed-or-not) instead of guessing and
// burning a full implement→verify loop on the wrong choice. In the TUI the
// call opens an interactive option menu (arrow keys + Enter, Esc skips,
// "type my own" for free text); headless runs resolve deterministic defaults
// so automation never hangs. Read-only: it changes nothing on disk and is
// always allowed, including plan mode and chat tasks.

import type { Tool } from './types.js';
import {
  normalizePromptRequest,
  headlessUserPrompt,
  formatUserPromptResult,
} from './user-prompt.js';

export const askQuestionTool: Tool = {
  def: {
    name: 'ask_question',
    description:
      'Ask the user one or more clarifying questions mid-task and wait for their answers. USE THIS whenever you are blocked on a genuine user decision (which option to implement, which scope, ambiguous requirements) instead of guessing — a wrong guess wastes a full implement/verify loop. Each question shows as an interactive menu with your options; the user may also type a custom answer or skip. Keep to at most 4 questions, 2-4 distinct options each, every option with a short description of its trade-off. Do NOT use it for things you can determine yourself (file contents, test results, repo state) — only for decisions only the user can make.',
    parameters: [
      {
        name: 'questions',
        type: 'array',
        description: 'Questions to ask (max 4). Each: { question: string, header?: short label, options: [{label, description?, recommended?}] (2-4), multiSelect?: boolean }. For a single question you may pass question/options at the top level instead.',
        required: false,
        items: { type: 'string' },
      },
      {
        name: 'question',
        type: 'string',
        description: 'Single-question shorthand: the question text (use with top-level options).',
        required: false,
      },
      {
        name: 'options',
        type: 'array',
        description: 'Single-question shorthand: the answer options (strings or {label, description?, recommended?}).',
        required: false,
        items: { type: 'string' },
      },
      {
        name: 'header',
        type: 'string',
        description: 'Single-question shorthand: short (<=12 char) header label shown above the question.',
        required: false,
      },
      {
        name: 'multiSelect',
        type: 'boolean',
        description: 'Single-question shorthand: allow the user to pick several options.',
        required: false,
      },
    ],
    permission: 'read',
  },
  async execute(args, ctx) {
    if (ctx.abortSignal?.aborted) {
      return 'Question cancelled: the run was aborted before the user could answer. Proceed with your best judgment or stop.';
    }
    const req = normalizePromptRequest(args);
    if (req.questions.length === 0) {
      return 'No valid questions provided. Provide at least one question with 2+ options, e.g. {question: "...", options: [{label: "A", description: "..."}, {label: "B", description: "..."}]}.';
    }
    if (req.questions.some((q) => q.options.length === 0)) {
      return 'Each question needs at least one option (2-4 recommended). Options are what the user picks from; a question with no options cannot be answered. Add options or answer the question yourself from repo context.';
    }
    const promptUser = ctx.promptUser;
    if (!promptUser) {
      return formatUserPromptResult(headlessUserPrompt(req), true);
    }
    try {
      const res = await promptUser(req);
      if (!res || !Array.isArray(res.answers)) {
        return formatUserPromptResult(headlessUserPrompt(req), true);
      }
      return formatUserPromptResult(res, false);
    } catch (err) {
      // A prompt failure (dismissed UI, detached host) must never wedge the
      // run: fall back to defaults and let the model proceed explicitly.
      const msg = err instanceof Error ? err.message : String(err);
      const fallback = headlessUserPrompt(req);
      return `${formatUserPromptResult(fallback, true)}\n(Prompt UI error, used defaults: ${msg.slice(0, 160)})`;
    }
  },
};
