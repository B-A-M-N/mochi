// Interactive first-run onboarding & setup wizard for Mochi TUI.
// Guides new users through borrowing keys, selecting preferred models,
// adopting skills & MCP servers, and connecting editors.
// One-time setup, recorded in ~/.config/mochi/onboarded.json.

import type { Runtime } from '../runtime.js';
import type { LineKind } from './state.js';
import { scanForOnboarding } from '../onboarding/detect.js';
import {
  importProviderKeys,
  importSkillSources,
  importMcpSources,
  markOnboarded,
} from '../onboarding/import.js';

export type MenuFn = (title: string, items: string[], mark?: Set<number>) => Promise<number>;
export type PushFn = (kind: LineKind, text: string) => void;

export async function runInteractiveOnboarding(
  runtime: Runtime,
  openMenu: MenuFn,
  push: PushFn,
  scheduleRender: () => void,
  version: string = 'v0.24.0',
): Promise<void> {
  const scan = scanForOnboarding(runtime.cwd);

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
    `nothing is overwritten without asking. revisit anytime via /setup or /onboard.`,
  ];
  for (const line of welcomeBanner) {
    push('system', line);
  }
  scheduleRender();

  // 2. Interactive Welcome & Setup Menu
  const detectedKeysCount = scan.providers.filter((p) => p.hasKey).length;
  const welcomeChoices = [
    `⚡ 1. Express Setup (Auto-borrow ${detectedKeysCount} keys, ${scan.totalSkills} skills & best models)`,
    `🛠️ 2. Step-by-Step Setup (Configure keys, model, skills & editor interactively)`,
    `⏩ 3. Skip Setup (I'll configure manually later)`,
  ];

  const mainPick = await openMenu(
    `Mochi Setup (One-time, 60 seconds)`,
    welcomeChoices
  );

  // User canceled with Esc or chose Skip
  if (mainPick === -1 || mainPick === 2) {
    push('system', 'Setup skipped. You can revisit anytime by typing /setup or /onboard.');
    markOnboarded({ providersImported: [], skillsImported: 0, mcpImported: 0 });
    return;
  }

  let providersImported: string[] = [];
  let skillsImported = 0;
  let mcpImported = 0;

  // Path A: Express Setup
  if (mainPick === 0) {
    push('system', '⚡ Running Express Setup...');
    const pRes = importProviderKeys({ overwrite: false });
    if (pRes.primary) providersImported.push(pRes.primary);
    providersImported.push(...pRes.failover);

    if (scan.skillSources.length) {
      const sRes = await importSkillSources(scan.skillSources.map((s) => s.dir), { force: false });
      skillsImported = sRes.imported;
    }

    if (scan.mcpSources.length) {
      const mRes = importMcpSources(scan.mcpSources.map((m) => m.file));
      mcpImported = mRes.imported.length;
    }

    markOnboarded({ providersImported, skillsImported, mcpImported });
    push('system', `✓ Setup complete! Adopted ${providersImported.length} provider key(s), ${skillsImported} skill(s), ${mcpImported} MCP server(s).`);
    push('system', `🍡 You're all set! Send a message or ask Mochi a task to begin.`);
    scheduleRender();
    return;
  }

  // Path B: Step-by-Step Interactive Setup
  // Step 1: Borrow API keys + providers you already use elsewhere
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
  const modelOptions = [
    `glm-5.3-flash (Recommended: ultra-fast, free tier, high context)`,
    `deepseek-v4-flash (Fast, accurate code edits, low latency)`,
    `opencode-zen-3.5 (Powerful reasoning, architecture & debugging)`,
    `Keep current model (${runtime.config.model.model || 'default'})`,
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
  } else {
    push('system', `Preserved current model.`);
  }

  // Step 3: Adopt skills, MCP servers & tools from other agents
  const skillOptions = [
    `Adopt all skills & MCPs (${scan.totalSkills} skills, ${scan.totalMcpServers} MCPs)`,
    `Adopt skills only (${scan.totalSkills} skills across ${scan.skillSources.length} sources)`,
    `Adopt MCP servers only (${scan.totalMcpServers} servers)`,
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
    if (scan.mcpSources.length) {
      const mRes = importMcpSources(scan.mcpSources.map((m) => m.file));
      mcpImported = mRes.imported.length;
    }
  }
  push('system', `✓ Skills: ${skillsImported} imported | MCP: ${mcpImported} imported`);

  // Step 4: Connect VS Code + JetBrains so mochi lives in your editor
  const editorOptions = [
    `Connect VS Code + JetBrains (ACP & MCP stdio server enabled)`,
    `VS Code only (via ~/.vscode or Cursor config)`,
    `JetBrains only (Tools → Mochi chat)`,
    `Terminal Only (Skip editor integration)`,
  ];
  const step4Pick = await openMenu(
    `Step 4/4: Connect VS Code + JetBrains`,
    editorOptions
  );

  if (step4Pick !== 3 && step4Pick !== -1) {
    push('system', `✓ Editor integration ready! Run \`mochi mcp-serve\` for MCP or \`mochi acp\` for ACP in your IDE.`);
  } else {
    push('system', `Skipped editor integration.`);
  }

  // Finish and persist
  markOnboarded({ providersImported, skillsImported, mcpImported });
  push('system', `\n🍡 Setup complete! Welcome to Mochi. Send a message to begin.`);
  scheduleRender();
}
