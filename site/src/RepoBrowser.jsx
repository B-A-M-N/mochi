import React, { useState } from 'react';
import { REAL_REPO_FILES } from './repo-files.js';
import { IconSearch } from './icons.jsx';

const REPO_URL = 'https://github.com/xanstomper/mochi';

const FILE_GROUPS = [
  {
    title: 'Core Engine & Turn Loop',
    dir: 'src/agent',
    files: ['src/agent/loop.ts'],
  },
  {
    title: 'Model Routing & Failover',
    dir: 'src',
    files: ['src/model-router.ts'],
  },
  {
    title: 'Surgical AST Tools',
    dir: 'src/tools',
    files: ['src/tools/edit.ts', 'src/tools/patch.ts'],
  },
  {
    title: 'Multi-Tab TUI Engine',
    dir: 'src/tui',
    files: ['src/tui/tabs.ts'],
  },
  {
    title: 'Verification & AST Guards',
    dir: 'src/core',
    files: ['src/core/ast-guard.ts'],
  },
  {
    title: 'Compiled Native Rust Core',
    dir: 'native/mochi_core/src',
    files: ['native/mochi_core/src/lib.rs'],
  },
  {
    title: 'Telemetry & Benchmarks',
    dir: 'bench',
    files: ['bench/efficiency.mjs'],
  },
  {
    title: 'Manifest & Configuration',
    dir: '.',
    files: ['package.json'],
  },
];

export default function RepoBrowser() {
  const [selectedPath, setSelectedPath] = useState('src/agent/loop.ts');
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');

  const currentFile = REAL_REPO_FILES[selectedPath] || REAL_REPO_FILES['src/agent/loop.ts'];

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentFile.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const lines = currentFile.code.split('\n');

  // Syntax highlighter for TypeScript, Rust, and JavaScript
  const highlightLine = (line) => {
    // Basic syntax tokenization for keywords, strings, comments
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//!')) {
      return <span style={{ color: '#8E879E', fontStyle: 'italic' }}>{line}</span>;
    }
    if (trimmed.startsWith('#') && !trimmed.startsWith('#!')) {
      return <span style={{ color: '#8E879E', fontStyle: 'italic' }}>{line}</span>;
    }

    // Tokenizer using regex
    const tokens = [];
    const regex = /(\b(?:import|export|from|default|class|interface|type|const|let|var|function|return|async|await|if|else|for|while|try|catch|new|pub|fn|struct|impl|mut|use|enum|self|Self|match|where|crate)\b)|('(?:\\.|[^'])*'|"(?:\\.|[^"])*"|`(?:\\.|[^`])*`)|(\b(?:string|number|boolean|void|any|Promise|Set|Map|usize|u32|Self|Option|Result|HashMap|Vec)\b)|(\b[0-9]+(?:\.[0-9]+)?\b)/g;

    let lastIndex = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        tokens.push(line.substring(lastIndex, match.index));
      }

      if (match[1]) {
        // Keyword
        tokens.push(<span key={match.index} style={{ color: '#7C3AED', fontWeight: 600 }}>{match[1]}</span>);
      } else if (match[2]) {
        // String
        tokens.push(<span key={match.index} style={{ color: '#059669' }}>{match[2]}</span>);
      } else if (match[3]) {
        // Type
        tokens.push(<span key={match.index} style={{ color: '#2563EB', fontWeight: 600 }}>{match[3]}</span>);
      } else if (match[4]) {
        // Number
        tokens.push(<span key={match.index} style={{ color: '#D97706' }}>{match[4]}</span>);
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < line.length) {
      tokens.push(line.substring(lastIndex));
    }

    return tokens.length ? tokens : line;
  };

  return (
    <div className="code-explorer-card" style={{ width: '100%', maxWidth: '100%' }}>
      {/* Top GitHub Navigation Bar */}
      <div className="explorer-topbar" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="explorer-repo-meta" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" style={{ color: 'var(--purple)' }}>
              <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1h-8a1 1 0 00-1 1v6.708A2.486 2.486 0 014.5 9h8V1.5z" />
            </svg>
            <a href={REPO_URL} target="_blank" rel="noopener" style={{ textDecoration: 'none', color: 'var(--ink)', fontWeight: 700, fontSize: 14 }}>
              xanstomper
            </a>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <a href={REPO_URL} target="_blank" rel="noopener" style={{ textDecoration: 'none', color: 'var(--purple-dark)', fontWeight: 800, fontSize: 14 }}>
              mochi
            </a>
          </div>
          <span className="repo-badge-git" style={{ background: 'var(--purple-lighter)', color: 'var(--purple-dark)', fontWeight: 700, border: '1px solid rgba(139, 92, 246, 0.2)' }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: 4 }}>
              <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z" />
            </svg>
            main
          </span>
          <span className="repo-stat">727 Shipped Files</span>
          <span className="repo-stat">1,459 Tests Passing</span>
          <span className="repo-stat">0 Dependencies</span>
          <span className="repo-stat">MIT License</span>
        </div>

        <div className="explorer-actions">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener"
            className="explorer-gh-btn"
            style={{ textDecoration: 'none' }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <span>View Full GitHub Repo ↗</span>
          </a>
        </div>
      </div>

      {/* Main Split Grid: Left File Tree | Right Code Viewer */}
      <div className="explorer-grid" style={{ minHeight: 640 }}>
        {/* Left Sidebar: Architecture Tree */}
        <aside className="explorer-tree-side" style={{ width: 300, flexShrink: 0 }}>
          <div className="tree-search-bar" style={{ position: 'relative' }}>
            <IconSearch size={15} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--muted)' }} />
            <input
              type="text"
              placeholder="Search repository files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="tree-filter-input"
              style={{ paddingLeft: 34 }}
            />
          </div>

          <div className="tree-list" style={{ padding: '8px 10px' }}>
            {FILE_GROUPS.map((group) => {
              const matchingFiles = group.files.filter((filePath) => {
                const file = REAL_REPO_FILES[filePath];
                if (!file) return false;
                if (!search) return true;
                const q = search.toLowerCase();
                return file.name.toLowerCase().includes(q) || file.path.toLowerCase().includes(q) || group.title.toLowerCase().includes(q);
              });

              if (matchingFiles.length === 0) return null;

              return (
                <div key={group.dir} className="tree-dir-group" style={{ marginBottom: 12 }}>
                  <div className="tree-dir-label" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', fontSize: 11.5, fontWeight: 700, color: 'var(--purple-dark)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2A1.75 1.75 0 004.98 1H1.75z" />
                    </svg>
                    <span>{group.title}</span>
                  </div>
                  <div className="tree-files" style={{ paddingLeft: 10 }}>
                    {matchingFiles.map((filePath) => {
                      const file = REAL_REPO_FILES[filePath];
                      const isActive = selectedPath === filePath;
                      return (
                        <button
                          key={filePath}
                          className={'tree-file-btn' + (isActive ? ' active' : '')}
                          onClick={() => setSelectedPath(filePath)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            width: '100%',
                            gap: 8,
                            padding: '7px 10px',
                            borderRadius: 8,
                            border: 'none',
                            background: isActive ? 'var(--purple-lighter)' : 'transparent',
                            color: isActive ? 'var(--purple-dark)' : 'var(--ink)',
                            fontWeight: isActive ? 700 : 500,
                            fontSize: 13,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s',
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" style={{ color: isActive ? 'var(--purple)' : 'var(--muted)' }}>
                            <path d="M3.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75zm5.75.56v2.19c0 .138.112.25.25.25h2.19L9.5 2.06zM2 1.75C2 .784 2.784 0 3.75 0h5.586a1.75 1.75 0 011.237.513l3.914 3.914c.328.328.513.774.513 1.237v8.586A1.75 1.75 0 0113.25 16H3.75A1.75 1.75 0 012 14.25V1.75z" />
                          </svg>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {file.name}
                          </span>
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', padding: '2px 5px', borderRadius: 4, background: isActive ? '#ffffff' : '#EDE8F5', color: 'var(--purple-dark)', fontWeight: 600 }}>
                            {file.lang}
                          </span>
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
          <div className="code-view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--line)', background: '#FAF8FC' }}>
            <div className="code-view-meta" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                {currentFile.path}
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--purple-lighter)', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>
                {currentFile.size} · {currentFile.lines} lines
              </span>
            </div>
            <div className="code-view-actions" style={{ display: 'flex', gap: 10 }}>
              <button
                className="code-copy-btn"
                onClick={handleCopy}
                style={{ padding: '6px 14px', fontSize: 12.5, fontWeight: 600, borderRadius: 8, cursor: 'pointer', background: '#ffffff', border: '1.5px solid var(--line)', color: 'var(--ink)' }}
              >
                {copied ? '✓ Copied' : 'Copy Code'}
              </button>
              <a
                href={`${REPO_URL}/blob/main/${currentFile.path}`}
                target="_blank"
                rel="noopener"
                className="code-external-link"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, borderRadius: 8, textDecoration: 'none', background: 'var(--purple)', color: '#ffffff' }}
              >
                Open in GitHub ↗
              </a>
            </div>
          </div>

          {/* File description note */}
          <div style={{ padding: '8px 20px', background: 'rgba(139, 92, 246, 0.05)', borderBottom: '1px solid var(--line)', fontSize: 12.5, color: 'var(--purple-dark)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>ℹ</span>
            <span>{currentFile.desc}</span>
          </div>

          {/* Interactive Code Body with Line Numbers */}
          <div className="code-content-wrapper" style={{ flex: 1, overflow: 'auto', background: '#ffffff', maxHeight: 600 }}>
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
