// Shell completions (`mochi completion bash|zsh|fish`): static scripts generated
// from the canonical command table below. A coverage test greps cli.ts for
// every `first === '<cmd>'` literal and fails when a command lacks a completion
// entry, so the two can never drift apart silently.
export interface CompletionCommand {
  name: string;
  description: string;
  subcommands?: Array<{ name: string; description: string }>;
  aliases?: string[];
}

export const COMPLETION_COMMANDS: CompletionCommand[] = [
  { name: 'goal', description: 'Run a multi-step objective' },
  { name: 'team', description: 'Run specialists concurrently' },
  { name: 'plan', description: 'Plan only, no edits' },
  { name: 'ask', description: 'Ask a question, no tools' },
  { name: 'run', description: 'Run a task by id' },
  { name: 'shell', description: 'Run a shell command' },
  { name: 'tui', description: 'Open the interactive TUI' },
  {
    name: 'term', description: 'Open Mochi in its own terminal window',
    aliases: ['terminal', 'open'],
    subcommands: [],
  },
  {
    name: 'daemon', description: 'Persistent agent over localhost HTTP',
    subcommands: [
      { name: 'start', description: 'Start the daemon' },
      { name: 'status', description: 'Show daemon status' },
      { name: 'stop', description: 'Stop the daemon' },
      { name: 'restart', description: 'Restart on the same port' },
      { name: 'rotate', description: 'Rotate the bearer token' },
      { name: 'jobs', description: 'List workspace goals' },
      { name: 'send', description: 'Send a goal' },
      { name: 'approve', description: 'Approve a pending plan' },
      { name: 'resume', description: 'Resume a goal' },
      { name: 'cron', description: 'Scheduled jobs (add|list|remove)' },
    ],
  },
  {
    name: 'skills', description: 'Browse and manage skills',
    subcommands: [
      { name: 'list', description: 'List skills' },
      { name: 'search', description: 'Search skills' },
      { name: 'audit', description: 'Skill health report' },
      { name: 'repo', description: 'Shared skill registry' },
      { name: 'import', description: 'Import skills' },
      { name: 'pack', description: 'Bundle skills into a portable pack' },
      { name: 'unpack', description: 'Install a skill pack' },
    ],
  },
  { name: 'session', description: 'Session history (list|search)' },
  { name: 'trace', description: 'Replay a run trace' },
  { name: 'checkpoint', description: 'Named snapshots' },
  { name: 'rollback', description: 'Restore a checkpoint' },
  { name: 'branch', description: 'Branch the session' },
  { name: 'resume', description: 'Resume a persisted goal' },
  { name: 'commit', description: 'Checkpoint commit' },
  { name: 'diff', description: 'Show pending changes' },
  { name: 'status', description: 'Repository status', aliases: ['changes'] },
  { name: 'review', description: 'Review the working-tree diff' },
  { name: 'fix', description: 'Fix a diagnosed issue' },
  { name: 'test', description: 'Run the test command' },
  { name: 'verify', description: 'Run verification (alias path)' },
  { name: 'lint', description: 'Run linters' },
  { name: 'doctor', description: 'Diagnose workspace configuration' },
  { name: 'init', description: 'Create MOCHI.md' },
  { name: 'config', description: 'Show effective configuration' },
  { name: 'login', description: 'Authenticate a provider' },
  { name: 'models', description: 'List models' },
  { name: 'providers', description: 'List providers' },
  { name: 'model', description: 'Select model' },
  { name: 'reasoning', description: 'Set reasoning depth', aliases: ['depth'] },
  { name: 'mode', description: 'Set execution mode' },
  { name: 'memory', description: 'Project memory' },
  { name: 'rules', description: 'Show MOCHI.md contract', aliases: ['rule'] },
  { name: 'profiles', description: 'List agent profiles' },
  { name: 'plugins', description: 'List plugins', aliases: ['plugin'] },
  { name: 'hooks', description: 'List hooks' },
  {
    name: 'mcp', description: 'Search, add & manage MCP servers',
    subcommands: [
      { name: 'list', description: 'List built-in MCP servers' },
      { name: 'search', description: 'Search servers by keyword' },
      { name: 'add', description: 'Install a server into .mcp.json' },
    ],
  },
  { name: 'acp', description: 'Agent Client Protocol server' },
  { name: 'chameleon', description: 'Synthetic reasoning parameters' },
  { name: 'self-train', description: 'Self-review loop', aliases: ['selftrain', 'train'] },
  { name: 'speculate', description: 'Speculative execution' },
  { name: 'perf', description: 'Performance diagnostics' },
  { name: 'usage', description: 'Token usage and cost' },
  { name: 'tokens', description: 'Token breakdown' },
  { name: 'stats', description: 'Performance statistics' },
  { name: 'audit', description: 'Security audit', aliases: ['security'] },
  { name: 'docgen', description: 'Generate architecture docs', aliases: ['docs'] },
  { name: 'dashboard', description: 'Open dashboard', aliases: ['web'] },
  { name: 'discord', description: 'Discord gateway' },
  { name: 'ambient', description: 'Ambient agent mode' },
  { name: 'termix', description: 'Multi-agent broadcast' },
  { name: 'bg', description: 'Background tasks' },
  { name: 'workspace', description: 'Manage workspaces' },
  { name: 'import-skills', description: 'Import skills from a source' },
  { name: 'issue', description: 'File an issue' },
  { name: 'inspect', description: 'Inspect a target' },
  { name: 'check', description: 'Run checks' },
  { name: 'known-good', description: 'Mark a known-good state' },
  { name: 'use', description: 'Use a profile or preset' },
  { name: 'enhance', description: 'Enhance a prompt' },
  {
    name: 'completion', description: 'Print shell completion script',
    subcommands: [
      { name: 'bash', description: 'Bash completion script' },
      { name: 'zsh', description: 'Zsh completion script' },
      { name: 'fish', description: 'Fish completion script' },
    ],
  },
];

/** All names the completer offers (canonical + aliases, deduped). */
export function completionNames(): string[] {
  const out: string[] = [];
  for (const c of COMPLETION_COMMANDS) {
    out.push(c.name, ...(c.aliases ?? []));
  }
  return [...new Set(out)];
}

export function subcommandNames(cmd: string): string[] {
  const c = COMPLETION_COMMANDS.find((x) => x.name === cmd || x.aliases?.includes(cmd));
  return c?.subcommands?.map((s) => s.name) ?? [];
}

function bashEscape(s: string): string {
  return s.replace(/'/g, `'\\''`);
}

export function completionBash(): string {
  const names = completionNames().join(' ');
  const cases = COMPLETION_COMMANDS.filter((c) => c.subcommands?.length)
    .map((c) => `      ${[c.name, ...(c.aliases ?? [])].join('|')}) COMPREPLY=($(compgen -W "${c.subcommands!.map((s) => s.name).join(' ')}" -- "$cur")) ;;`)
    .join('\n');
  return `# mochi bash completion (generated by \`mochi completion bash\`)
_mochi_completions() {
  local cur prev
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  if [[ $COMP_CWORD -eq 1 ]]; then
    COMPREPLY=($(compgen -W '${names}' -- "$cur"))
    return 0
  fi
  case "$prev" in
${cases}
  esac
  return 0
}
complete -F _mochi_completions mochi
`;
}

export function completionZsh(): string {
  const cmds = COMPLETION_COMMANDS.map((c) => `    '${c.name}:${bashEscape(c.description)}'`).join('\n');
  const subs = COMPLETION_COMMANDS.filter((c) => c.subcommands?.length)
    .map((c) => `      (${[c.name, ...(c.aliases ?? [])].join('|')}) _describe 'command' "(${c.subcommands!.map((s) => `'${s.name}:${bashEscape(s.description)}'`).join(' ')})" ;;`)
    .join('\n');
  return `#compdef mochi
# mochi zsh completion (generated by \`mochi completion zsh\`)
_mochi() {
  local -a commands=(
${cmds}
  )
  if (( CURRENT == 2 )); then
    _describe 'command' commands
    return
  fi
  case "$words[2]" in
${subs}
  esac
}
_mochi "$@"
`;
}

export function completionFish(): string {
  const cmds = COMPLETION_COMMANDS.map((c) => `complete -c mochi -f -n '__fish_use_subcommand' -a '${c.name}' -d '${bashEscape(c.description)}'`).join('\n');
  const subs = COMPLETION_COMMANDS.filter((c) => c.subcommands?.length)
    .map((c) => c.subcommands!.map((s) => `complete -c mochi -f -n '__fish_seen_subcommand_from ${[c.name, ...(c.aliases ?? [])].join(';')}' -a '${s.name}' -d '${bashEscape(s.description)}'`).join('\n'))
    .join('\n');
  const aliases = COMPLETION_COMMANDS.flatMap((c) => (c.aliases ?? []).map((a) => `complete -c mochi -f -n '__fish_use_subcommand' -a '${a}' -d 'alias: ${c.name}'`)).join('\n');
  return `# mochi fish completion (generated by \`mochi completion fish\`)
${cmds}
${aliases}
${subs}
`;
}

export function completionFor(shell: string): string {
  const s = shell.toLowerCase();
  if (s === 'bash') return completionBash();
  if (s === 'zsh') return completionZsh();
  if (s === 'fish') return completionFish();
  throw new Error(`Unknown shell "${shell}". Use bash|zsh|fish.`);
}
