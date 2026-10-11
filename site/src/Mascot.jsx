import React from 'react';

export default function Mochi({ className = '', style = {}, size }) {
  const base = typeof window !== 'undefined' && window.location.pathname.startsWith('/mochi') ? '/mochi' : '';
  const imgStyle = {
    height: 'auto',
    display: 'block',
    maxWidth: '100%',
    ...(size ? { width: typeof size === 'number' ? `${size}px` : size } : {}),
    ...style
  };

  return (
    <img
      src={base + '/assets/mochi-mascot.png'}
      alt="Mochi Mascot"
      className={className}
      style={imgStyle}
      draggable="false"
    />
  );
}
