import type { Tool } from './types.js';

// think — a structured, non-mutating scratchpad for the model's working
// reasoning. Returns a short confirmation. It exists so a model that likes to
// "think out loud" has a first-class, content-controlled channel instead of
// free-form prose: reasoning is emitted for the transcript and (optionally)
// surfaced as a note, but never treated as task output.
//
// Chatbox-ownership rule: think emits ONLY agent:reasoning (rendered as a
// collapsed thought row). It must NEVER emit a `message` event — those render
// as full chat lines, so every think call used to "type a message
// automatically" into the user's chatbox. Only the user writes user lines;
// only the model writes answer text; harness chatter stays in cards/logs.
//
// It performs no I/O, costs nothing, and is idempotent — purely a harness
// affordance, so it is wired as a read-only tool.

export const thinkTool: Tool = {
  def: {
    name: 'think',
    description:
      'Record a short intermediate reasoning step or hypothesis before acting. Does not modify anything and is not counted as task output. Use it to structure your internal reasoning, then continue with a tool or a final answer.',
    parameters: [
      { name: 'thought', type: 'string', description: 'The reasoning note or plan step', required: true },
    ],
    permission: 'read',
  },
  async execute(args, ctx) {
    const thought = String(args.thought ?? '').slice(0, 4000);
    if (!thought.trim()) return 'Nothing recorded.';
    ctx.events.emit({
      type: 'agent:reasoning',
      content: `[think] ${thought}\n`,
      agentId: ctx.agentId,
    });
    return '[acknowledged]';
  },
};