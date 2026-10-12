import React, { useState, useMemo } from 'react';
import { REAL_REPO_FILES } from './repo-files.js';
import { ALL_REPO_PATHS } from './all-repo-paths.js';
import { IconSearch } from './icons.jsx';

const REPO_URL = 'https://github.com/xanstomper/mochi';

// Categorize all 714 files by top directory
function categorizePaths(paths) {
  const groups = {};
  paths.forEach((p) => {
    let groupName = 'Root Configs & Manifests';
    if (p.startsWith('src/agent/')) groupName = 'src/agent — Turn Loop & Consensus';
    else if (p.startsWith('src/core/')) groupName = 'src/core — AST Guards & Dispatcher';
    else if (p.startsWith('src/tools/')) groupName = 'src/tools — Surgical Diff & Shell';
    else if (p.startsWith('src/model/')) groupName = 'src/model — Model Router & Failover';
    else if (p.startsWith('src/tui/')) groupName = 'src/tui — Multi-Tab Terminal Matrix';
    else if (p.startsWith('src/mcp/')) groupName = 'src/mcp — Model Context Protocol';
    else if (p.startsWith('src/cognitive/')) groupName = 'src/cognitive — Chameleon Swarms';
    else if (p.startsWith('src/observability/')) groupName = 'src/observability — Autopsy & Traces';
    else if (p.startsWith('src/repo/')) groupName = 'src/repo — CodeGraph & Git Plumbing';
    else if (p.startsWith('src/security/')) groupName = 'src/security — Sandbox & Permissions';
    else if (p.startsWith('src/skills/')) groupName = 'src/skills — Skill Curation Engine';
    else if (p.startsWith('src/state/')) groupName = 'src/state — Checkpoint & Session Store';
    else if (p.startsWith('src/stream/')) groupName = 'src/stream — Fast Events & SSE Parser';
    else if (p.startsWith('src/daemon/')) groupName = 'src/daemon — Persistent Agent Service';
    else if (p.startsWith('src/')) groupName = 'src — Entrypoint & Runtime Core';
    else if (p.startsWith('native/')) groupName = 'native/mochi_core — Rust N-API Engine';
    else if (p.startsWith('bench/')) groupName = 'bench — Empirical Telemetry Suites';
    else if (p.startsWith('examples/')) groupName = 'examples — Agent Configurations';
    else if (p.startsWith('.github/')) groupName = '.github — CI/CD Workflows';

    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(p);
  });

  return Object.keys(groups).map((name) => ({
    title: name,
    files: groups[name],
  }));
}

export default function RepoBrowser() {
  const [selectedPath, setSelectedPath] = useState('src/agent/loop.ts');
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');
  const [customFile, setCustomFile] = useState(null);
  const [fetchingCustom, setFetchingCustom] = useState(false);
  const [activeTabMode, setActiveTabMode] = useState('curated'); // 'curated' | 'all'

  // Pre-categorized groups
  const allGroups = useMemo(() => categorizePaths(ALL_REPO_PATHS), []);

  const currentFile = useMemo(() => {
    if (customFile && customFile.path === selectedPath) {
      return customFile;
    }
    if (REAL_REPO_FILES[selectedPath]) {
      return REAL_REPO_FILES[selectedPath];
    }
    // Fallback if not loaded yet
    return {
      path: selectedPath,
      name: selectedPath.split('/').pop(),
      lang: selectedPath.endsWith('.rs') ? 'rust' : selectedPath.endsWith('.json') ? 'json' : selectedPath.endsWith('.md') ? 'markdown' : 'typescript',
      size: 'Remote',
      lines: '...',
      desc: `Source file from GitHub repository: ${selectedPath}`,
      code: fetchingCustom ? '// Loading file from GitHub repository...\n// Please wait...' : '// Click or press Enter to fetch this file from GitHub.',
    };
  }, [customFile, selectedPath, fetchingCustom]);

  const handleCopy = () => {
    if (navigator.clipboard && currentFile.code) {
      navigator.clipboard.writeText(currentFile.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSelectFile = async (path) => {
    setSelectedPath(path);
    if (REAL_REPO_FILES[path]) {
      return;
    }
    setFetchingCustom(true);
    try {
      const res = await fetch(`https://raw.githubusercontent.com/xanstomper/mochi/main/${path}`);
      if (res.ok) {
        const text = await res.text();
        const linesCount = text.split('\n').length;
        setCustomFile({
          path,
          name: path.split('/').pop(),
          lang: path.endsWith('.rs') ? 'rust' : path.endsWith('.json') ? 'json' : path.endsWith('.md') ? 'markdown' : 'typescript',
          size: `${(text.length / 1024).toFixed(1)} KB`,
          lines: linesCount,
          desc: `Fetched live from GitHub main branch: ${path}`,
          code: text,
        });
      } else {
        setCustomFile({
          path,
          name: path.split('/').pop(),
          lang: 'text',
          size: '0 KB',
          lines: 1,
          desc: `Could not fetch live content for ${path}`,
          code: `// Unable to fetch ${path} from GitHub (HTTP ${res.status}).\n// You can view it directly on GitHub at:\n// https://github.com/xanstomper/mochi/blob/main/${path}`,
        });
      }
    } catch {
      setCustomFile({
        path,
        name: path.split('/').pop(),
        lang: 'text',
        size: '0 KB',
        lines: 1,
        desc: `Fetch error for ${path}`,
        code: `// Network error fetching ${path}.\n// View on GitHub: https://github.com/xanstomper/mochi/blob/main/${path}`,
      });
    } finally {
      setFetchingCustom(false);
    }
  };

  const lines = (currentFile.code || '').split('\n');

  // Syntax highlighter for TypeScript, Rust, and JavaScript
  const highlightLine = (line) => {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//!')) {
      return <span style={{ color: '#8E879E', fontStyle: 'italic' }}>{line}</span>;
    }
    if (trimmed.startsWith('#') && !trimmed.startsWith('#!')) {
      return <span style={{ color: '#8E879E', fontStyle: 'italic' }}>{line}</span>;
    }
    if (trimmed.startsWith('import ') || trimmed.startsWith('export ') || trimmed.startsWith('from ')) {
      return (
        <span>
          <span style={{ color: '#7C3AED', fontWeight: 600 }}>{line.match(/^(import|export|from)/)?.[0]}</span>
          {line.replace(/^(import|export|from)/, '')}
        </span>
      );
    }
    if (trimmed.startsWith('function ') || trimmed.startsWith('const ') || trimmed.startsWith('let ') || trimmed.startsWith('pub fn ') || trimmed.startsWith('fn ')) {
      return (
        <span>
          <span style={{ color: '#2563EB', fontWeight: 600 }}>{line.match(/^(function|const|let|pub fn|fn)/)?.[0]}</span>
          {line.replace(/^(function|const|let|pub fn|fn)/, '')}
        </span>
      );
    }
    return line;
  };

  return (
    <div className="explorer-card" style={{ maxWidth: 1560, margin: '0 auto', background: '#ffffff', borderRadius: 24, border: '1.5px solid rgba(138, 103, 246, 0.25)', boxShadow: '0 8px 32px rgba(138, 103, 246, 0.12)', overflow: 'hidden' }}>
      {/* Explorer Top Toolbar */}
      <div className="explorer-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--line)', background: '#FAF8FC', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, color: '#111116', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#8A67F6' }}>📦</span> xanstomper/mochi
          </span>
          <span style={{ fontSize: 11.5, background: '#EDE8F8', color: '#8A67F6', padding: '3px 8px', borderRadius: 999, fontWeight: 700 }}>
            {ALL_REPO_PATHS.length} Files in Repository
          </span>
        </div>

        {/* View mode toggle */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setActiveTabMode('curated')}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: activeTabMode === 'curated' ? '1.5px solid #8A67F6' : '1px solid var(--line)',
              background: activeTabMode === 'curated' ? '#F4EFFE' : '#ffffff',
              color: activeTabMode === 'curated' ? '#8A67F6' : '#111116',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Curated Core (35)
          </button>
          <button
            onClick={() => setActiveTabMode('all')}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: activeTabMode === 'all' ? '1.5px solid #8A67F6' : '1px solid var(--line)',
              background: activeTabMode === 'all' ? '#F4EFFE' : '#ffffff',
              color: activeTabMode === 'all' ? '#8A67F6' : '#111116',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Full Repo Tree ({ALL_REPO_PATHS.length})
          </button>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener"
            className="btn btn-outline"
            style={{ padding: '6px 14px', fontSize: 12, textDecoration: 'none', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span>GitHub ↗</span>
          </a>
        </div>
      </div>

      {/* Main Split Grid: Left File Tree | Right Code Viewer */}
      <div className="explorer-grid" style={{ minHeight: 740, display: 'flex' }}>
        {/* Left Sidebar: Architecture Tree */}
        <aside className="explorer-tree-side" style={{ width: 340, flexShrink: 0, borderRight: '1px solid var(--line)', background: '#FAF8FC' }}>
          <div className="tree-search-bar" style={{ position: 'relative', padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
            <IconSearch size={15} style={{ position: 'absolute', left: 24, top: 22, color: 'var(--muted)' }} />
            <input
              type="text"
              placeholder={`Search all ${ALL_REPO_PATHS.length} files in repo...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.trim()) {
                  handleSelectFile(search.trim());
                }
              }}
              className="tree-filter-input"
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                borderRadius: 8,
                border: '1.5px solid var(--line)',
                fontSize: 12.5,
                fontFamily: 'var(--font-mono)',
                background: '#ffffff',
                color: '#111116',
              }}
            />
          </div>

          <div className="tree-list" style={{ padding: '10px', maxHeight: 680, overflowY: 'auto' }}>
            {/* If searching or in all mode, show all categorized groups */}
            {allGroups.map((group) => {
              const fileList = activeTabMode === 'curated' && !search
                ? group.files.filter((f) => REAL_REPO_FILES[f])
                : group.files;

              const matchingFiles = fileList.filter((filePath) => {
                if (!search) return true;
                const q = search.toLowerCase();
                return filePath.toLowerCase().includes(q) || group.title.toLowerCase().includes(q);
              });

              if (matchingFiles.length === 0) return null;

              return (
                <div key={group.title} className="tree-dir-group" style={{ marginBottom: 14 }}>
                  <div className="tree-dir-label" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', fontSize: 11, fontWeight: 700, color: 'var(--purple-dark)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2A1.75 1.75 0 004.98 1H1.75z" />
                    </svg>
                    <span>{group.title}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)' }}>({matchingFiles.length})</span>
                  </div>
                  <div className="tree-files" style={{ paddingLeft: 10 }}>
                    {matchingFiles.map((filePath) => {
                      const isActive = selectedPath === filePath;
                      const fileName = filePath.split('/').pop();
                      const isPreIndexed = !!REAL_REPO_FILES[filePath];

                      return (
                        <button
                          key={filePath}
                          className={'tree-file-btn' + (isActive ? ' active' : '')}
                          onClick={() => handleSelectFile(filePath)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            width: '100%',
                            gap: 8,
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: 'none',
                            background: isActive ? '#EDE8F8' : 'transparent',
                            color: isActive ? '#8A67F6' : '#111116',
                            fontWeight: isActive ? 750 : 500,
                            fontSize: 12.5,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s',
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" style={{ color: isActive ? '#8A67F6' : 'var(--muted)' }}>
                            <path d="M3.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75zm5.75.56v2.19c0 .138.112.25.25.25h2.19L9.5 2.06zM2 1.75C2 .784 2.784 0 3.75 0h5.586a1.75 1.75 0 011.237.513l3.914 3.914c.328.328.513.774.513 1.237v8.586A1.75 1.75 0 0113.25 16H3.75A1.75 1.75 0 012 14.25V1.75z" />
                          </svg>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {fileName}
                          </span>
                          {isPreIndexed ? (
                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 5px', borderRadius: 4, background: '#ffffff', color: '#8A67F6', fontWeight: 700 }}>
                              FAST
                            </span>
                          ) : (
                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 5px', borderRadius: 4, background: 'rgba(0,0,0,0.05)', color: 'var(--muted)', fontWeight: 600 }}>
                              RAW
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Right Pane: Syntax Highlighted Code Viewer */}
        <section className="explorer-code-view" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* File Header / Breadcrumbs */}
          <div className="code-view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid var(--line)', background: '#FAF8FC' }}>
            <div className="code-view-meta" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 800, color: '#111116' }}>
                {currentFile.path}
              </span>
              <span style={{ fontSize: 12, color: '#8A67F6', background: '#F4EFFE', padding: '3px 10px', borderRadius: 999, fontWeight: 700 }}>
                {currentFile.size} · {currentFile.lines} lines
              </span>
              {fetchingCustom && <span style={{ fontSize: 12, color: '#8A67F6', fontWeight: 600 }}>Fetching live from GitHub...</span>}
            </div>
            <div className="code-view-actions" style={{ display: 'flex', gap: 10 }}>
              <button
                className="code-copy-btn"
                onClick={handleCopy}
                style={{ padding: '6px 14px', fontSize: 12.5, fontWeight: 700, borderRadius: 8, cursor: 'pointer', background: '#ffffff', border: '1.5px solid var(--line)', color: '#111116' }}
              >
                {copied ? '✓ Copied' : 'Copy Code'}
              </button>
              <a
                href={`${REPO_URL}/blob/main/${currentFile.path}`}
                target="_blank"
                rel="noopener"
                className="code-external-link"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 14px', fontSize: 12.5, fontWeight: 700, borderRadius: 8, textDecoration: 'none', background: '#111116', color: '#ffffff' }}
              >
                Open on GitHub ↗
              </a>
            </div>
          </div>

          {/* File description note */}
          <div style={{ padding: '10px 24px', background: 'rgba(138, 103, 246, 0.05)', borderBottom: '1px solid var(--line)', fontSize: 13, color: '#8A67F6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>ℹ</span>
            <span>{currentFile.desc}</span>
          </div>

          {/* Interactive Code Body with Line Numbers */}
          <div className="code-content-wrapper" style={{ flex: 1, overflow: 'auto', background: '#ffffff', maxHeight: 660 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: '21px' }}>
              <tbody>
                {lines.map((lineText, idx) => {
                  const lineNum = idx + 1;
                  return (
                    <tr key={lineNum} style={{ verticalAlign: 'top' }}>
                      <td
                        style={{
                          width: 48,
                          minWidth: 48,
                          textAlign: 'right',
                          paddingRight: 16,
                          paddingLeft: 12,
                          userSelect: 'none',
                          color: '#A29CAD',
                          fontSize: 12,
                          borderRight: '1px solid #ECE7F5',
                          background: '#FAF8FC',
                        }}
                      >
                        {lineNum}
                      </td>
                      <td style={{ paddingLeft: 16, paddingRight: 16, whiteSpace: 'pre', color: '#1B1726' }}>
                        {highlightLine(lineText)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
