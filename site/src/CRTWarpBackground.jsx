import React from 'react';
import CRTWarp from './CRTWarp';

export default function CRTWarpBackground() {
  return (
    <div
      className="site-crt-bg"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        opacity: 0.24,
      }}
      aria-hidden="true"
    >
      <CRTWarp
        color="#8B67F6"
        backgroundColor="#ffffff"
        speed={0.4}
        curvature={0.18}
        scanlineStrength={0.12}
        scanlineFrequency={180}
        waveAmplitude={0.28}
        waveFrequency={2.2}
        bloom={1.5}
        bloomRadius={1}
        noise={0.03}
        vignette={0}
        brightness={0.85}
        pixelation={1}
        rgbShift={0.012}
        mouseReact
        mouseStrength={0.5}
        dpr={1}
        fps={30}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
