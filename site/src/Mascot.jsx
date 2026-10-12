import React from 'react';

export default function Mochi({ variant = 'default', className = '', style = {}, size, animated = true }) {
  const base = typeof window !== 'undefined' && window.location.pathname.startsWith('/mochi') ? '/mochi' : '';
  const fileMap = {
    default: animated ? 'mochi-mascot.gif' : 'mochi-mascot.png',
    home: animated ? 'mochi-mascot.gif' : 'mochi-mascot.png',
    docs: animated ? 'docs-mascot.gif' : 'docs-mascot.png',
    benchmarks: animated ? 'benchmarks-mascot.gif' : 'benchmarks-mascot.png',
    changelog: animated ? 'changelog-mascot.gif' : 'changelog-mascot.png',
    source: animated ? 'source-mascot.gif' : 'source-mascot.png',
  };
  const fileName = fileMap[variant] || (animated ? `${variant}-mascot.gif` : 'mochi-mascot.png');
  const imgStyle = {
    height: 'auto',
    display: 'block',
    maxWidth: '100%',
    ...(size ? { width: typeof size === 'number' ? `${size}px` : size } : {}),
    ...style
  };

  return (
    <img
      src={base + '/assets/' + fileName}
      alt={`Mochi ${variant} Mascot`}
      className={className}
      style={imgStyle}
      draggable="false"
    />
  );
}
