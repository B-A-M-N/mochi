// Pastel Lavender Background Engine
// Injected on every page. Soft ambient blobs, sparkles, and waves.

(function buildBackground() {
  if (document.querySelector('.bg-decor')) return;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  var bg = document.createElement('div');
  bg.className = 'bg-decor';
  bg.setAttribute('aria-hidden', 'true');

  // ambient blobs: lower sections only, hero section has dedicated illustration backdrop
  var blobColors = [
    'radial-gradient(circle, #E8E3FD 0%, transparent 70%)',
    'radial-gradient(circle, #F0EDFE 0%, transparent 70%)',
    'radial-gradient(circle, #DDD6FE 0%, transparent 70%)',
  ];
  var blobPositions = [
    { top: '65%', right: '6%', size: 380 },
  ];
  blobPositions.forEach(function(pos, i) {
    var blob = document.createElement('div');
    blob.className = 'bg-blob';
    blob.style.background = blobColors[i % blobColors.length];
    blob.style.width = pos.size + 'px';
    blob.style.height = pos.size + 'px';
    if (pos.top) blob.style.top = pos.top;
    if (pos.bottom) blob.style.bottom = pos.bottom;
    if (pos.left) blob.style.left = pos.left;
    if (pos.right) blob.style.right = pos.right;
    blob.style.opacity = rand(0.35, 0.50).toFixed(2);
    bg.appendChild(blob);
  });

  // dots: only on the right side
  for (var i = 0; i < 6; i++) {
    var dot = document.createElement('div');
    dot.className = 'bg-dot';
    var s = rand(6, 14).toFixed(0);
    dot.style.width = s + 'px';
    dot.style.height = s + 'px';
    dot.style.top = rand(10, 85).toFixed(1) + '%';
    dot.style.left = rand(55, 95).toFixed(1) + '%';
    dot.style.opacity = rand(0.12, 0.25).toFixed(2);
    bg.appendChild(dot);
  }

  // sparkles: avoid top-left header zone completely
  var sparkleColors = ['#8B75F6', '#C4B5FD', '#E8E3FD', '#A78BFA'];
  for (var j = 0; j < 8; j++) {
    var sp = document.createElement('div');
    sp.className = 'bg-sparkle';
    var sz = rand(10, 20).toFixed(0);
    sp.style.width = sz + 'px';
    sp.style.height = sz + 'px';
    sp.style.background = pick(sparkleColors);
    sp.style.top = rand(15, 90).toFixed(1) + '%';
    sp.style.left = rand(52, 96).toFixed(1) + '%';
    sp.style.animationDelay = rand(0, 3.5).toFixed(1) + 's';
    bg.appendChild(sp);
  }

  // waves: strictly on right edge and bottom
  var wavePositions = [
    { top: '8%', right: '-3%', w: 460, h: 290 },
    { bottom: '8%', right: '10%', w: 340, h: 270 },
  ];
  wavePositions.forEach(function(pos, i) {
    var wave = document.createElement('div');
    wave.className = 'bg-wave';
    wave.style.width = pos.w + 'px';
    wave.style.height = pos.h + 'px';
    if (pos.top) wave.style.top = pos.top;
    if (pos.bottom) wave.style.bottom = pos.bottom;
    if (pos.left) wave.style.left = pos.left;
    if (pos.right) wave.style.right = pos.right;
    wave.style.animationDelay = (i * 2) + 's';
    bg.appendChild(wave);
  });

  document.body.insertBefore(bg, document.body.firstChild);
})();
