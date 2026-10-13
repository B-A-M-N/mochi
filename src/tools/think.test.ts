import { describe, it, expect } from 'vitest';
import { thinkTool } from './think.js';
import { EventBus } from '../events.js';
import type { ToolContext } from './types.js';

function ctx(bus?: EventBus): ToolContext {
  return {
    cwd: '/tmp',
    workspace: { dir: '/tmp', root: '/' } as any,
    config: {} as any,
    events: (bus ?? new EventBus()) as never,
    agentId: 'test',
  };
}

describe('think tool', () => {
  it('records a reasoning note as a thought event (never a chat message) and acks', async () => {
    const bus = new EventBus();
    const thoughts: string[] = [];
    const chatMessages: unknown[] = [];
    bus.on('agent:reasoning', (e: any) => thoughts.push(e.content));
    bus.on('message', (e: any) => chatMessages.push(e));
    const out = await thinkTool.execute({ thought: 'Consider using the sqlite adapter.' }, ctx(bus));
    expect(out).toContain('acknowledged');
    expect(thoughts).toContain('[think] Consider using the sqlite adapter.\n');
    // Chatbox ownership: think must never type into the transcript as a chat
    // line — every `message` event renders as one (the auto-typing spam).
    expect(chatMessages).toEqual([]);
  });

  it('rejects an empty thought gracefully', async () => {
    expect(await thinkTool.execute({ thought: '   ' }, ctx())).toContain('Nothing recorded');
  });
});