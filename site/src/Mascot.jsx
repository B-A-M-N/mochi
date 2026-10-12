import React from 'react';

export default function Mochi({ variant = 'default', className = '', style = {}, size }) {
  const base = typeof window !== 'undefined' && window.location.pathname.startsWith('/mochi') ? '/mochi' : '';
  const fileMap = {
    default: 'mochi-mascot.png',
    docs: 'docs-mascot.png',
    benchmarks: 'benchmarks-mascot.png',
    changelog: 'changelog-mascot.png',
    source: 'source-mascot.png',
  };
  const fileName = fileMap[variant] || 'mochi-mascot.png';
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
