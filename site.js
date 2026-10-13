// Floating pill navbar chrome & responsive mobile navigation system
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
  var mobPillsHTML = '';
  var drawerLinksHTML = '';

  pages.forEach(function(p) {
    var href = inSub ? ('/mochi/' + (p[0] === 'index.html' ? '' : p[0])) : (p[0] === 'index.html' ? './' : p[0]);
    var isActive = p[0] === activeKey;
    var activeClass = isActive ? ' active' : '';

    navHTML += '<a href="' + href + '" class="nav-link' + activeClass + '">' + p[1] + '</a>';
    mobPillsHTML += '<a href="' + href + '" class="mob-tab-pill' + activeClass + '">' + p[1] + '</a>';
    drawerLinksHTML += '<a href="' + href + '" class="drawer-nav-link' + activeClass + '">' +
      '<span class="drawer-link-num">' + p[1].split(' ')[0] + '</span>' +
      '<span class="drawer-link-title">' + p[1].split(' ')[1] + '</span>' +
      (isActive ? '<span class="drawer-link-active-dot">●</span>' : '<span class="drawer-link-arrow">→</span>') +
    '</a>';
  });

  var homeHref = inSub ? '/mochi/' : './';
  var demoHref = inSub ? '/mochi/#live-demo' : './#live-demo';

  // Desktop Header with Mobile Toggle
  var header = document.createElement('header');
  header.className = 'site';
  header.innerHTML =
    '<a href="' + homeHref + '" class="nav-brand">mochi<span class="sparkle">✦</span></a>' +
    '<nav class="nav-links">' +
      navHTML +
    '</nav>' +
    '<div class="nav-right">' +
      '<a href="' + REPO + '" class="nav-cta" target="_blank" rel="noopener">' +
        '<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>' +
        '<span>xanstomper/mochi</span>' +
        '<span style="font-size:11px;opacity:0.7">↗</span>' +
      '</a>' +
      '<div class="nav-attribution">website designed by xanstomper</div>' +
      '<button class="nav-mobile-toggle" id="nav-mobile-toggle" aria-label="Open navigation menu" aria-expanded="false">' +
        '<span class="toggle-icon">☰</span>' +
        '<span class="toggle-text">Menu</span>' +
      '</button>' +
    '</div>';

  document.body.insertBefore(header, document.body.firstChild);

  // Mobile Top Tab Bar (Sticky scrollable pills)
  var mobileTabBar = document.createElement('nav');
  mobileTabBar.className = 'mobile-tab-bar';
  mobileTabBar.id = 'mobile-tab-bar';
  mobileTabBar.setAttribute('aria-label', 'Mobile Navigation');
  mobileTabBar.innerHTML =
    '<div class="mobile-tab-scroll">' +
      mobPillsHTML +
    '</div>';
  document.body.insertBefore(mobileTabBar, header.nextSibling);

  // Mobile Navigation Drawer Overlay
  var drawer = document.createElement('div');
  drawer.className = 'nav-mobile-drawer';
  drawer.id = 'nav-mobile-drawer';
  drawer.setAttribute('aria-hidden', 'true');
  drawer.innerHTML =
    '<div class="mobile-drawer-backdrop" id="mobile-drawer-backdrop"></div>' +
    '<div class="mobile-drawer-panel">' +
      '<div class="mobile-drawer-head">' +
        '<a href="' + homeHref + '" class="nav-brand">mochi<span class="sparkle">✦</span></a>' +
        '<button class="mobile-drawer-close" id="mobile-drawer-close" aria-label="Close navigation menu">✕</button>' +
      '</div>' +
      '<div class="mobile-drawer-nav">' +
        drawerLinksHTML +
      '</div>' +
      '<div class="mobile-drawer-footer">' +
        '<a href="' + REPO + '" class="mobile-drawer-cta" target="_blank" rel="noopener">' +
          '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>' +
          '<span>View GitHub Repository</span>' +
          '<span style="margin-left:auto;font-size:14px">↗</span>' +
        '</a>' +
        '<div class="mobile-drawer-sub">designed by xanstomper · minimal autonomous coding agent</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(drawer);

  // Toggle logic for mobile drawer
  var toggleBtn = document.getElementById('nav-mobile-toggle');
  var closeBtn = document.getElementById('mobile-drawer-close');
  var backdrop = document.getElementById('mobile-drawer-backdrop');

  function openDrawer() {
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (toggleBtn) toggleBtn.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (backdrop) backdrop.addEventListener('click', closeDrawer);

  // Close drawer if clicking any drawer nav link
  var drawerLinks = drawer.querySelectorAll('.drawer-nav-link');
  drawerLinks.forEach(function(link) {
    link.addEventListener('click', closeDrawer);
  });

  // Scroll active mobile tab pill into view on page load
  setTimeout(function() {
    var activeMobPill = mobileTabBar.querySelector('.mob-tab-pill.active');
    if (activeMobPill && activeMobPill.scrollIntoView) {
      activeMobPill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, 100);

  // Fluid scroll-linked hero header exit & re-entry (desktop only)
  var ticking = false;
  function updateScrollState() {
    var sy = window.scrollY || window.pageYOffset || 0;
    var isMobile = window.innerWidth <= 968;

    if (!isMobile) {
      var p = Math.min(1, Math.max(0, sy / 180));
      header.style.setProperty('--scroll-p', p.toFixed(3));

      var heroP = Math.min(1, Math.max(0, sy / 380));
      document.documentElement.style.setProperty('--hero-scroll-p', heroP.toFixed(3));

      if (sy > 45) {
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-scrolled');
      }
    } else {
      // On mobile, never hide or blur out the header or tab bar
      header.style.setProperty('--scroll-p', '0');
      document.documentElement.style.setProperty('--hero-scroll-p', '0');
      header.classList.remove('is-scrolled');
    }
    ticking = false;
  }
  window.addEventListener('scroll', function() {
    if (!ticking) {
      requestAnimationFrame(updateScrollState);
      ticking = true;
    }
  }, { passive: true });
  window.addEventListener('resize', updateScrollState);
  updateScrollState();

  // Gooey sliding pill indicator for desktop
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

  // Smooth scroll handler for demo buttons
  document.addEventListener('click', function(e) {
    var target = e.target.closest('a[href*="#live-demo"]');
    if (target) {
      var liveEl = document.getElementById('live-demo');
      if (liveEl) {
        e.preventDefault();
        liveEl.scrollIntoView({ behavior: 'smooth' });
        if (drawer && drawer.classList.contains('is-open')) {
          closeDrawer();
        }
      }
    }
  });
})();
