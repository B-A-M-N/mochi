// Modern Ambient Background Engine — Mochi
// Injected cleanly behind content: subtle radial glow + technical engineering grid
// Pure CSS/JS, zero layout shift, hardware accelerated, non-interfering.

(function buildAmbientBackground() {
  var bg = document.createElement('div');
  bg.className = 'bg-ambient';
  bg.setAttribute('aria-hidden', 'true');

  bg.innerHTML = 
    '<div class="bg-glow-top"></div>' +
    '<div class="bg-glow-secondary"></div>' +
    '<div class="bg-grid-mesh"></div>';

  document.body.insertBefore(bg, document.body.firstChild);
})();
