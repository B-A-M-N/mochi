import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Mochi from '../Mascot.jsx';
import Footer from '../Footer.jsx';
import { AnimatedContent } from '../anim.jsx';
import { IconSearch } from '../icons.jsx';
import { RELEASES } from '../changelog-data.js';

const FILTER_TAGS = ['All', 'LATEST', 'PERF', 'SECURITY', 'TUI', 'RUST CORE', 'MODELS & MCP', 'DAEMON'];

// Helper to format inline markdown code and bold
function formatItem(text) {
  const parts = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(
        <strong key={match.index} style={{ color: 'var(--ink)', fontWeight: 700 }}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`')) {
      parts.push(
        <code key={match.index} className="timeline-code">
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length ? parts : text;
}

export default function Changelog() {
  const [activeTag, setActiveTag] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeVersion, setActiveVersion] = useState(RELEASES[0]?.version || 'v0.22.1');
  const [expandedVersions, setExpandedVersions] = useState({
    'v0.22.1 (Current)': true,
    'v0.22.1-pre2': true,
    'v0.22.0': true,
    'v0.21.0': true,
    'v0.20.0': true,
  });

  const toggleExpand = (ver) => {
    setExpandedVersions((prev) => ({ ...prev, [ver]: !prev[ver] }));
  };

  const expandAll = () => {
    const all = {};
    RELEASES.forEach((r) => {
      all[r.version] = true;
    });
    setExpandedVersions(all);
  };

  const collapseAll = () => {
    setExpandedVersions({});
  };

  const filteredReleases = RELEASES.filter((rel) => {
    const matchesTag =
      activeTag === 'All' ||
      rel.tag.toLowerCase().includes(activeTag.toLowerCase()) ||
      rel.categories.some((c) => c.name.toLowerCase().includes(activeTag.toLowerCase()));

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      rel.version.toLowerCase().includes(q) ||
      rel.title.toLowerCase().includes(q) ||
      rel.categories.some(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.items.some((item) => item.toLowerCase().includes(q))
      );

    return matchesTag && matchesSearch;
  });

  const scrollToRelease = (ver) => {
    setActiveVersion(ver);
    const element = document.getElementById('rel-' + ver.replace(/[^a-zA-Z0-9]/g, '-'));
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      <div className="pagehead">
        <div className="wrap" style={{ maxWidth: 1440, width: '95vw' }}>
          <div className="pagehead-row">
            <div className="pagehead-col">
              <AnimatedContent direction="bottom" delay={0.1}>
                <div className="hero-eyebrow">
                  <span className="sparkle" />
                  FULL PRODUCTION RELEASE HISTORY
                </div>
              </AnimatedContent>

              <h1 className="hero-title">
                What’s New <span className="accent-title">in Mochi.</span>
              </h1>

              <AnimatedContent direction="bottom" delay={0.2}>
                <p className="hero-sub" style={{ maxWidth: 720 }}>
                  Complete technical changelog documenting all 35 releases from v0.22 down to v0.1.0. Every architectural change, native Rust op, bwrap sandbox isolation, and memory reduction shipped in source.
                </p>
              </AnimatedContent>

              {/* Tag Filters & Search */}
              <AnimatedContent direction="bottom" delay={0.3}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 16 }}>
                  <div className="filter-pills" style={{ margin: 0 }}>
                    {FILTER_TAGS.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setActiveTag(tag)}
                        className={`filter-pill ${activeTag === tag ? 'active' : ''}`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>

                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button
                      onClick={expandAll}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        fontFamily: 'var(--font-mono)',
                        background: '#ffffff',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        cursor: 'pointer',
                        color: 'var(--purple-dark)',
                        fontWeight: 700,
                      }}
                    >
                      Expand All
                    </button>
                    <button
                      onClick={collapseAll}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        fontFamily: 'var(--font-mono)',
                        background: '#ffffff',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        cursor: 'pointer',
                        color: 'var(--ink-soft)',
                        fontWeight: 600,
                      }}
                    >
                      Collapse All
                    </button>
                  </div>
                </div>

                <div className="doc-search-bar" style={{ marginTop: 20 }}>
                  <IconSearch size={18} className="text-muted" />
                  <input
                    type="text"
                    placeholder="Search all 35 releases (e.g. bwrap, MCP, multi-tab, prompt cache, AST, PSS)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </AnimatedContent>
            </div>

            {/* Custom Changelog Mascot */}
            <AnimatedContent direction="right" delay={0.2}>
              <div className="subpage-mascot-wrap">
                <div className="subpage-doodle">35 releases documented!</div>
                <Mochi variant="changelog" size={360} />
              </div>
            </AnimatedContent>
          </div>

          {/* Left-Aligned Responsive 2-Column Changelog Layout */}
          <div className="changelog-layout">
            {/* Left Column: Sticky Version Quick-Jump Rail */}
            <aside className="changelog-sidebar">
              <div className="changelog-sidebar-title">
                Jump to Version ({filteredReleases.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filteredReleases.map((rel) => {
                  const isActive = activeVersion === rel.version;
                  return (
                    <div
                      key={rel.version}
                      className={`changelog-nav-item ${isActive ? 'active' : ''}`}
                      onClick={() => scrollToRelease(rel.version)}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>
                        {rel.version}
                      </span>
                      <span style={{ fontSize: 11, color: isActive ? 'var(--purple-dark)' : 'var(--muted)' }}>
                        {rel.date.split(',')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </aside>

            {/* Right Column: Left-Aligned Timeline Cards */}
            <main className="timeline-full" style={{ minWidth: 0 }}>
              {filteredReleases.length === 0 ? (
                <div style={{ background: '#ffffff', borderRadius: 20, padding: 48, textAlign: 'center', border: '1.5px solid var(--line)' }}>
                  <h3 style={{ fontSize: 20, color: 'var(--ink)', marginBottom: 8 }}>No matching releases found</h3>
                  <p style={{ color: 'var(--muted)' }}>Try adjusting your search query or tag filter.</p>
                </div>
              ) : (
                filteredReleases.map((rel, i) => {
                  const isExpanded = expandedVersions[rel.version] !== false;
                  const anchorId = 'rel-' + rel.version.replace(/[^a-zA-Z0-9]/g, '-');
                  return (
                    <div
                      key={rel.version}
                      id={anchorId}
                      className="timeline-entry"
                      style={{ marginBottom: 28, paddingLeft: 0 }}
                    >
                      <div className="timeline-content" style={{ padding: '28px 32px' }}>
                        <div
                          className="timeline-head"
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => toggleExpand(rel.version)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <span className="timeline-version" style={{ fontSize: 14 }}>
                              {rel.version}
                            </span>
                            <span
                              className="timeline-badge"
                              style={{
                                background:
                                  rel.tag === 'LATEST' || rel.tag === 'NEXT'
                                    ? '#059669'
                                    : rel.tag === 'SECURITY'
                                    ? '#DC2626'
                                    : rel.tag === 'RUST CORE'
                                    ? '#D97706'
                                    : 'var(--purple)',
                              }}
                            >
                              {rel.tag}
                            </span>
                            <span className="timeline-date">{rel.date}</span>
                          </div>
                          <span style={{ fontSize: 20, color: 'var(--purple-dark)', fontWeight: 800, marginLeft: 'auto' }}>
                            {isExpanded ? '−' : '+'}
                          </span>
                        </div>

                        <h3
                          className="timeline-title"
                          style={{ cursor: 'pointer', marginTop: 14, marginBottom: 14, fontSize: 20, fontWeight: 800 }}
                          onClick={() => toggleExpand(rel.version)}
                        >
                          {rel.title}
                        </h3>

                        {isExpanded && (
                          <div className="timeline-body" style={{ marginTop: 18 }}>
                            {rel.categories.map((cat) => (
                              <div key={cat.name} style={{ marginBottom: 20 }}>
                                <div
                                  style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    color: 'var(--purple-dark)',
                                    marginBottom: 8,
                                    textTransform: 'uppercase',
                                    letterSpacing: '.08em',
                                  }}
                                >
                                  {cat.name}
                                </div>
                                <ul style={{ margin: 0, paddingLeft: 20 }}>
                                  {cat.items.map((item, idx) => (
                                    <li key={idx} style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.65, marginBottom: 8 }}>
                                      {formatItem(item)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Stay Updated Card */}
              <div className="stay-updated-card" style={{ marginTop: 32, width: '100%' }}>
                <div>
                  <h4 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, color: 'var(--ink)' }}>
                    Want to stay updated on new releases?
                  </h4>
                  <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', margin: 0 }}>
                    Follow the project on X or star the repository on GitHub for instant notifications on every build.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <a
                    href="https://x.com/xanstomper"
                    target="_blank"
                    rel="noopener"
                    className="btn btn-primary"
                  >
                    Follow @xanstomper
                  </a>
                  <a
                    href="https://github.com/xanstomper/mochi"
                    target="_blank"
                    rel="noopener"
                    className="btn btn-secondary"
                  >
                    Star on GitHub
                  </a>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<Changelog />);
}
