// Floating pill navbar chrome
(function() {
  var path = location.pathname;
  var inSub = path.indexOf('/mochi') > -1;
  var REPO = 'https://github.com/xanstomper/mochi';
  var pages = [
    ['index.html', '01/ Home'],
    ['docs.html', '02/ Docs'],
    ['benchmarks.html', '03/ Benchmarks'],
    ['changelog.html', '04/ Changelog'],
    ['source.html', '05/ Source'],
  ];

  // Determine active tab
  var activeKey = 'index.html';
  if (path.indexOf('docs') > -1) activeKey = 'docs.html';
  else if (path.indexOf('benchmarks') > -1) activeKey = 'benchmarks.html';
  else if (path.indexOf('changelog') > -1) activeKey = 'changelog.html';
  else if (path.indexOf('source') > -1) activeKey = 'source.html';

  var navHTML = '';
  pages.forEach(function(p) {
    var href = inSub ? ('/mochi/' + (p[0] === 'index.html' ? '' : p[0])) : (p[0] === 'index.html' ? './' : p[0]);
    var isActive = p[0] === activeKey ? ' active' : '';
    navHTML += '<a href="' + href + '" class="nav-link' + isActive + '">' + p[1] + '</a>';
  });

  var homeHref = inSub ? '/mochi/' : './';

  var header = document.createElement('header');
  header.className = 'site';
  header.innerHTML =
    '<a href="' + homeHref + '" class="nav-brand">mochi<span class="sparkle"></span></a>' +
    '<nav class="nav-links">' + navHTML + '</nav>' +
    '<div style="position: relative; display: flex; flex-direction: column; align-items: flex-end;">' +
      '<a href="' + REPO + '" class="nav-cta" target="_blank" rel="noopener">' +
        '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>' +
        'xanstomper/mochi ↗' +
      '</a>' +
      '<div class="nav-attribution">website designed by xanstomper</div>' +
    '</div>';

  document.body.insertBefore(header, document.body.firstChild);

  // Gooey sliding pill indicator
  var navLinks = header.querySelector('.nav-links');
  if (navLinks) {
    var indicator = document.createElement('div');
    indicator.className = 'nav-pill-indicator';
    navLinks.appendChild(indicator);

    function updateIndicator(target) {
      if (!target) {
        target = navLinks.querySelector('.nav-link.active');
      }
      if (target) {
        indicator.style.transform = 'translateX(' + target.offsetLeft + 'px)';
        indicator.style.width = target.offsetWidth + 'px';
        indicator.style.opacity = '1';
      }
    }

    setTimeout(function() { updateIndicator(); }, 60);
    window.addEventListener('resize', function() { updateIndicator(); });

    var links = navLinks.querySelectorAll('.nav-link');
    links.forEach(function(link) {
      link.addEventListener('mouseenter', function() { updateIndicator(link); });
    });
    navLinks.addEventListener('mouseleave', function() { updateIndicator(); });
  }
})();
