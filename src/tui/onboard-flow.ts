// Interactive first-run onboarding & universal agent injection for Mochi TUI.
// Discovers literally any coding agent (Claude Code, Hermes, Antigravity, Codex,
// Cline/Roo-Cline, OpenCode, Cursor, Windsurf, J-Code, Aider, Continue, Goose,
// Terminus, etc.) and injects their:
//   1. API keys & providers
//   2. Preferred models (coding / fast / reasoning / review)
//   3. Skills (SKILL.md trees + ecosystem registries)
//   4. Tools & MCP server definitions
//   5. Multi-agent shared memory & context (Terminus memory.json)
// One-time setup, recorded in ~/.config/mochi/onboarded.json.
// Can be re-triggered anytime via /setup, /onboard, /inject, or /adopt.

import type { Runtime } from '../runtime.js';
import type { LineKind } from './state.js';
import { scanForOnboarding } from '../onboarding/detect.js';
import {
  importProviderKeys,
  importDetectedModels,
  importSkillSources,
  importMcpServerDefs,
  importMcpSources,
  importTerminusMemory,
  injectAllAgentEcosystem,
  markOnboarded,
} from '../onboarding/import.js';

export type MenuFn = (title: string, items: string[], mark?: Set<number>) => Promise<number>;
export type PushFn = (kind: LineKind, text: string) => void;

export async function runUniversalInjection(
  runtime: Runtime,
  push: PushFn,
  scheduleRender: () => void,
): Promise<void> {
  push('system', '⚡ Scanning machine for all coding agents (Claude, Hermes, Antigravity, Codex, OpenCode, Cursor, Cline, J-Code, Terminus)...');
  scheduleRender();

  const scan = scanForOnboarding(runtime.cwd);
  const rep = await injectAllAgentEcosystem(scan, { force: false });

  push('system', `✓ Universal agent injection complete!`);
  push('system', `  • Detected agents (${rep.agentsCount}): ${scan.agents.filter((a) => a.installed).map((a) => a.name).join(', ') || 'Standard host'}`);
  push('system', `  • Provider keys (${rep.providersImported.length}): ${rep.providersImported.join(', ') || 'None found'}`);
  push('system', `  • Configured models: ${rep.modelsImported.join(', ') || scan.models.map((m) => m.model).slice(0, 3).join(', ') || 'Defaults'}`);
  push('system', `  • Skills adopted: ${rep.skillsImported} skills imported into ~/.mochi/skills/`);
  push('system', `  • MCP servers injected (${rep.mcpImported.length}): ${rep.mcpImported.join(', ') || 'None found'}`);
  if (rep.memoryImported) {
    push('system', `  • Terminus shared memory: Bridged into ~/.mochi/memory/terminus-memory.md`);
  }
  scheduleRender();
}

export async function runInteractiveOnboarding(
  runtime: Runtime,
  openMenu: MenuFn,
  push: PushFn,
  scheduleRender: () => void,
  version: string = 'v0.24.0',
): Promise<void> {
  const scan = scanForOnboarding(runtime.cwd);

  const installedAgents = scan.agents.filter((a) => a.installed);
  const agentNames = installedAgents.map((a) => a.name);

  // 1. Welcome Screen Banner
  const welcomeBanner = [
    `🍡 welcome home, builder — mochi ${version} is ready to cozy up`,
    `your tiny autonomous coding companion. one quick setup and we're off.`,
    ``,
    `── what this does (60 seconds, one time only) ──`,
    ` 1. borrow API keys + providers you already use elsewhere`,
    ` 2. pick your favorite model for coding / fast / review`,
    ` 3. adopt skills, MCP servers & tools from your other agents`,
    ` 4. connect VS Code + JetBrains so mochi lives in your editor`,
    ``,
  ];

  if (agentNames.length > 0) {
    welcomeBanner.push(`detected ${agentNames.length} coding agents on host: ${agentNames.slice(0, 6).join(', ')}${agentNames.length > 6 ? ` +${agentNames.length - 6} more` : ''}`);
    welcomeBanner.push(`found ${scan.totalSkills} skills, ${scan.models.length} models, ${scan.totalMcpServers} MCP tools & ${scan.providers.filter((p) => p.hasKey).length} keys ready to inject.`);
    welcomeBanner.push(``);
  }

  welcomeBanner.push(`nothing is overwritten without asking. revisit anytime via /setup, /onboard, or /inject.`);

  for (const line of welcomeBanner) {
    push('system', line);
  }
  scheduleRender();

  // 2. Interactive Welcome & Setup Menu
  const detectedKeysCount = scan.providers.filter((p) => p.hasKey).length;
  const welcomeChoices = [
    `⚡ 1. Express Setup (Auto-inject ${agentNames.length} agents, ${detectedKeysCount} keys, ${scan.totalSkills} skills & ${scan.totalMcpServers} MCPs)`,
    `🛠️ 2. Step-by-Step Setup (Configure keys, model, skills & editor interactively)`,
    `⏩ 3. Skip Setup (I'll configure manually later)`,
  ];

  const mainPick = await openMenu(
    `Mochi Setup (One-time, 60 seconds)`,
    welcomeChoices
  );

  // User canceled with Esc or chose Skip
  if (mainPick === -1 || mainPick === 2) {
    push('system', 'Setup skipped. You can revisit anytime by typing /setup, /onboard, or /inject.');
    markOnboarded({ providersImported: [], skillsImported: 0, mcpImported: 0 });
    return;
  }

  // Path A: Express Setup
  if (mainPick === 0) {
    push('system', '⚡ Running Express Setup...');
    scheduleRender();

    const rep = await injectAllAgentEcosystem(scan, { force: false });

    push('system', `✓ Setup complete! Universal agent injection successful:`);
    push('system', `  • Agents adopted: ${agentNames.join(', ') || 'host environment'}`);
    push('system', `  • Provider keys (${rep.providersImported.length}): ${rep.providersImported.join(', ') || 'default free inference'}`);
    push('system', `  • Skills adopted: ${rep.skillsImported} skills in ~/.mochi/skills/`);
    push('system', `  • MCP tools (${rep.mcpImported.length}): ${rep.mcpImported.join(', ') || 'none'}`);
    if (rep.memoryImported) {
      push('system', `  • Terminus memory: Unified context enabled`);
    }
    push('system', `🍡 You're all set! Send a message or ask Mochi a task to begin.`);
    scheduleRender();
    return;
  }

  // Path B: Step-by-Step Interactive Setup
  let providersImported: string[] = [];
  let skillsImported = 0;
  let mcpImported = 0;

  // Step 1: Borrow API keys + providers
  const keyedProviders = scan.providers.filter((p) => p.hasKey);
  const providerOptions = [
    `Auto-adopt all detected keys (${keyedProviders.length} found: ${keyedProviders.map((p) => p.name).join(', ') || 'none'})`,
    ...scan.providers.map((p) => `${p.name.padEnd(16)} ${p.hasKey ? '● ' + p.maskedKey + ' (' + p.keySource + ')' : '○ No key found'}`),
    `Skip provider import`,
  ];
  const step1Pick = await openMenu(
    `Step 1/4: Borrow API Keys & Providers`,
    providerOptions
  );

  if (step1Pick === 0) {
    const pRes = importProviderKeys({ overwrite: false });
    if (pRes.primary) providersImported.push(pRes.primary);
    providersImported.push(...pRes.failover);
    push('system', `✓ Adopted providers: ${providersImported.join(', ') || 'none'}`);
  } else if (step1Pick > 0 && step1Pick <= scan.providers.length) {
    const chosenP = scan.providers[step1Pick - 1];
    if (chosenP.hasKey) {
      providersImported.push(chosenP.id);
      void runtime.useProvider(chosenP.id);
      push('system', `✓ Wired ${chosenP.name} as primary provider.`);
    } else {
      push('system', `Note: ${chosenP.name} has no key configured yet. Set one via /login.`);
    }
  } else {
    push('system', `Skipped provider key adoption.`);
  }

  // Step 2: Pick favorite model for coding / fast / review
  const curatedModelChoices = [
    `glm-5.3-flash (Recommended: ultra-fast, free tier, high context)`,
    `deepseek-v4-flash (Fast, accurate code edits, low latency)`,
    `opencode-zen-3.5 (Powerful reasoning, architecture & debugging)`,
    `Keep current model (${runtime.config.model.model || 'default'})`,
  ];

  const cleanDetected = scan.models
    .map((m) => m.model.trim())
    .filter((m) => m && !m.endsWith(':') && m !== '-' && m.length > 2);

  const detectedModelChoices = cleanDetected
    .slice(0, 4)
    .map((m) => `${m} (detected from other agents)`);

  const modelOptions = [
    ...curatedModelChoices,
    ...detectedModelChoices,
  ];
  const step2Pick = await openMenu(
    `Step 2/4: Pick Favorite Model for Coding`,
    modelOptions
  );

  if (step2Pick === 0) {
    void runtime.useProvider('freeinference', 'glm-5.3-flash');
    push('system', `✓ Model set to glm-5.3-flash`);
  } else if (step2Pick === 1) {
    void runtime.useProvider('freeinference', 'deepseek-v4-flash');
    push('system', `✓ Model set to deepseek-v4-flash`);
  } else if (step2Pick === 2) {
    void runtime.useProvider('opencode-zen', 'opencode/opencode-zen-3.5');
    push('system', `✓ Model set to opencode-zen-3.5`);
  } else if (step2Pick >= curatedModelChoices.length && step2Pick < modelOptions.length) {
    const chosenModelName = cleanDetected[step2Pick - curatedModelChoices.length];
    importDetectedModels(scan.models, { overwriteProfiles: true });
    push('system', `✓ Adopted detected model: ${chosenModelName}`);
  } else {
    push('system', `Preserved current model.`);
  }

  // Step 3: Adopt skills, MCP servers & tools from other agents
  const skillOptions = [
    `Adopt all skills & MCP tools (${scan.totalSkills} skills, ${scan.totalMcpServers} MCP tools across ${agentNames.length} agents)`,
    `Adopt skills only (${scan.totalSkills} skills across ${scan.skillSources.length} sources)`,
    `Adopt MCP servers only (${scan.totalMcpServers} servers: ${Object.keys(scan.mcpServerDefs).join(', ') || 'none'})`,
    `Skip foreign skills & MCPs (keep built-in only)`,
  ];
  const step3Pick = await openMenu(
    `Step 3/4: Adopt Skills & MCP Servers`,
    skillOptions
  );

  if (step3Pick === 0 || step3Pick === 1) {
    if (scan.skillSources.length) {
      const sRes = await importSkillSources(scan.skillSources.map((s) => s.dir), { force: false });
      skillsImported = sRes.imported;
    }
  }
  if (step3Pick === 0 || step3Pick === 2) {
    const mRes = importMcpServerDefs(scan.mcpServerDefs, { force: false });
    if (scan.mcpSources.length) {
      importMcpSources(scan.mcpSources.map((m) => m.file));
    }
    mcpImported = mRes.imported.length;
  }
  push('system', `✓ Skills: ${skillsImported} imported | MCP: ${mcpImported} tools injected`);

  // Step 4: Connect VS Code + JetBrains + Terminus Memory
  const editorOptions = [
    `Connect VS Code + JetBrains + Terminus Memory (${scan.terminusMemoryAvailable ? 'Terminus Memory found' : 'MCP & ACP'})`,
    `VS Code only (via ~/.vscode or Cursor config)`,
    `JetBrains only (Tools → Mochi chat)`,
    `Terminal Only (Skip editor integration)`,
  ];
  const step4Pick = await openMenu(
    `Step 4/4: Connect Editors & Multi-Agent Memory`,
    editorOptions
  );

  let memoryImported = false;
  if (step4Pick === 0) {
    memoryImported = importTerminusMemory();
    push('system', `✓ Editor integration ready! Run \`mochi mcp-serve\` for MCP or \`mochi acp\` in your IDE.`);
    if (memoryImported) push('system', `✓ Unified Terminus multi-agent memory bridged into ~/.mochi/memory/`);
  } else if (step4Pick !== 3 && step4Pick !== -1) {
    push('system', `✓ Editor integration ready! Run \`mochi mcp-serve\` for MCP or \`mochi acp\` in your IDE.`);
  } else {
    push('system', `Skipped editor integration.`);
  }

  // Finish and persist
  markOnboarded({ providersImported, skillsImported, mcpImported, memoryImported });
  push('system', `\n🍡 Setup complete! Welcome to Mochi. Send a message to begin.`);
  scheduleRender();
}
