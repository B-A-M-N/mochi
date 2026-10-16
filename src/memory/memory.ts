import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface MemoryEntry {
  kind: 'decision' | 'architecture' | 'convention' | 'failure';
  title: string;
  body: string;
  source?: string;
  updatedAt: number;
}

function entryToMarkdown(e: MemoryEntry): string {
  const lines = [
    `## ${e.kind}: ${e.title}`,
    e.body,
    e.source ? `Source: ${e.source}` : null,
    `Updated: ${new Date(e.updatedAt).toISOString()}`,
  ].filter(Boolean);
  return lines.join('\n') + '\n';
}

export class MemoryStore {
  private dir: string;
  private files: Record<MemoryEntry['kind'], string>;

  /** Failures are unbounded input to the model's context, so keep only the
   *  most recent slice — otherwise every past failure is replayed every run. */
  static readonly MAX_FAILURE_ENTRIES = 50;

  constructor(workspaceDir: string) {
    this.dir = resolve(workspaceDir, 'memory');
    this.files = {
      decision: resolve(this.dir, 'decisions.md'),
      architecture: resolve(this.dir, 'architecture.md'),
      convention: resolve(this.dir, 'conventions.md'),
      failure: resolve(this.dir, 'failures.md'),
    };
  }

  ensure() {
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
    for (const file of Object.values(this.files)) {
      if (!existsSync(file)) writeFileSync(file, '');
    }
  }

  add(entry: Omit<MemoryEntry, 'updatedAt'> & { updatedAt?: number }) {
    this.ensure();
    const file = this.files[entry.kind];
    const normalized: MemoryEntry = {
      ...entry,
      updatedAt: entry.updatedAt ?? Date.now(),
    };
    const existing = readFileSync(file, 'utf8');
    const header = `## ${entry.kind}: ${entry.title}`;
    if (existing.includes(header)) return false;
    writeFileSync(file, existing + entryToMarkdown(normalized));
    if (entry.kind === 'failure') this.prune('failure', MemoryStore.MAX_FAILURE_ENTRIES);
    return true;
  }

  /** Keep only the newest `limit` entries of a kind (oldest dropped). */
  private prune(kind: MemoryEntry['kind'], limit: number): void {
    const entries = this.entries(kind);
    if (entries.length <= limit) return;
    const keep = entries.slice(-limit);
    writeFileSync(this.files[kind], keep.map((e) => entryToMarkdown(e)).join('\n'));
  }

  addDecision(title: string, body: string, source?: string) {
    return this.add({ kind: 'decision', title, body, source });
  }

  addArchitecture(title: string, body: string, source?: string) {
    return this.add({ kind: 'architecture', title, body, source });
  }

  addConvention(title: string, body: string, source?: string) {
    return this.add({ kind: 'convention', title, body, source });
  }

  addFailure(title: string, body: string, source?: string) {
    return this.add({ kind: 'failure', title, body, source });
  }

  /** Remove every entry of `kind` whose stored title matches `title`
   *  (header is `${kind}: ${title}`). Returns true if at least one entry was
   *  removed. Used by the consolidation loop to resolve failure lessons that
   *  a later successful run proved wrong -- keeps memory from accumulating a
   *  permanent "you failed at X" bias for issues the agent already fixed. */
  remove(kind: MemoryEntry['kind'], title: string): boolean {
    this.ensure();
    const target = `${kind}: ${title}`;
    const entries = this.entries(kind);
    const keep = entries.filter((e) => e.title !== target);
    if (keep.length === entries.length) return false;
    writeFileSync(this.files[kind], (keep.length ? keep.map((e) => entryToMarkdown(e)).join('\n') + '\n' : ''));
    return true;
  }

  removeFailure(taskTitle: string): boolean {
    return this.remove('failure', `Failed: ${taskTitle}`);
  }

  load(kind?: MemoryEntry['kind']): string {
    this.ensure();
    const entries = this.entries(kind);
    if (!kind) {
      // Preserve legacy grouping: `# <kind>s` section headers.
      const sections: string[] = [];
      for (const k of Object.keys(this.files) as MemoryEntry['kind'][]) {
        const group = entries.filter((e) => e.kind === k);
        if (group.length) sections.push(`# ${k}s\n` + group.map((e) => entryToMarkdown(e)).join('\n').trim());
      }
      const project = entries.find((e) => e.source === 'project.md');
      if (sections.length === 0 && project) sections.unshift(project.body);
      return sections.join('\n\n');
    }
    return entries.map((e) => entryToMarkdown(e)).join('\n').trim();
  }

  /** Return the individual memory entries (plus the optional project.md blurb).
   *  Index-based so callers can select a subset of *relevant* entries rather than
   *  dumping every memory into every packet. */
  entries(kind?: MemoryEntry['kind']): MemoryEntry[] {
    this.ensure();
    const kinds = kind ? [kind] : (Object.keys(this.files) as MemoryEntry['kind'][]);
    const result: MemoryEntry[] = [];
    for (const k of kinds) {
      const file = this.files[k];
      if (!existsSync(file)) continue;
      const content = readFileSync(file, 'utf8');
      for (const block of content.split(/^## /m).slice(1)) {
        const lines = block.split('\n');
        const header = lines[0].trim();
        // Preserve the stored timestamp. Dropping it made every entry look
        // like it was written in 1970 (load() re-renders `Updated:`), which
        // broke any recency ordering/decay that reads updatedAt.
        const updatedLine = lines.find((l) => l.startsWith('Updated:'));
        const parsed = updatedLine ? Date.parse(updatedLine.slice('Updated:'.length).trim()) : NaN;
        const updatedAt = Number.isFinite(parsed) ? parsed : 0;
        const body = lines.slice(1).filter((l) => !l.startsWith('Updated:')).join('\n').trim();
        if (!header) continue;
        result.push({ kind: k, title: header, body, updatedAt });
      }
    }
    // project.md is not a kind-category entry; emit it as a single "project"
    // blob (weighted to always be carried) so callers keep the project facts
    // alongside per-entry memories.
    const projectPath = resolve(this.dir, '..', 'project.md');
    if (!kind && existsSync(projectPath)) {
      const project = readFileSync(projectPath, 'utf8').trim();
      if (project) result.unshift({ kind: 'decision', title: 'project overview', body: project, source: 'project.md', updatedAt: 0 });
    }
    return result;
  }

  summary(): string {
    return this.load().split('\n').slice(0, 80).join('\n');
  }
}
