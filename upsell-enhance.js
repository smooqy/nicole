// ====== Customer data persistence across upsells ======
(function () {
  const CUSTOMER_KEY = 'nicole-customer-data';
  const SOURCE_KEYS = [
    'nicole-customer-data',
    'currentPixVitalicioSorteio', 'currentPixWhatsApp',
    'currentPixChamadaVideo', 'currentPixPackEstreia',
    'currentPixTaxaFinalDesbloqueio', 'currentPixTaxaReembolso',
    'currentPixTaxaSegurancaDados', 'currentPixTaxaSeguranca',
    'nicole-pix-pending-v2'
  ];

  function readStored() {
    for (const key of SOURCE_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const data = JSON.parse(raw);
        if (data && data.name && data.email) return data;
        const candidate =
          (data && data.customer) ||
          (data && data.payment && data.payment.customer) ||
          (data && data.customerName ? {
            name: data.customerName, email: data.customerEmail,
            phone: data.customerPhone || '', document: data.customerDocument || ''
          } : null);
        if (candidate && candidate.name && candidate.email) return candidate;
      } catch (e) {}
    }
    return null;
  }

  function normalize(data) {
    if (!data) return null;
    const phone = String(data.phone || data.customerPhone || '11999999999').replace(/\D/g, '');
    const doc = String(data.document || data.customerDocument || '00000000000').replace(/\D/g, '');
    return {
      name: String(data.name || data.customerName || 'Cliente VIP'),
      email: String(data.email || data.customerEmail || 'cliente@email.com'),
      phone: phone || '11999999999',
      document: doc || '00000000000'
    };
  }

  window.getClientData = function () {
    const stored = readStored();
    const normalized = normalize(stored);
    if (normalized && stored) {
      try { localStorage.setItem(CUSTOMER_KEY, JSON.stringify(normalized)); } catch (e) {}
      return normalized;
    }
    return { name: 'Cliente VIP', email: 'cliente@email.com', phone: '11999999999', document: '00000000000' };
  };

  window.saveClientData = function (data) {
    const normalized = normalize(data);
    if (!normalized) return;
    try { localStorage.setItem(CUSTOMER_KEY, JSON.stringify(normalized)); } catch (e) {}
  };
})();

(function () {
  // === Countdown timer (5 min, sticky per page in localStorage) ===
  const TIMER_KEY = 'upTimerStart_' + location.pathname;
  const TIMER_DURATION = 5 * 60 * 1000;
  let timerStart = parseInt(localStorage.getItem(TIMER_KEY) || '0', 10);
  if (!timerStart || Date.now() - timerStart > TIMER_DURATION + 60000) {
    timerStart = Date.now();
    localStorage.setItem(TIMER_KEY, String(timerStart));
  }

  function fmt(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = String(Math.floor(total / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    return m + ':' + s;
  }

  function tick() {
    const elapsed = Date.now() - timerStart;
    const remaining = Math.max(0, TIMER_DURATION - elapsed);
    const clock = document.getElementById('upTimer');
    const bar = document.getElementById('upTimerBar');
    if (clock) clock.textContent = fmt(remaining);
    if (bar) bar.style.width = (remaining / TIMER_DURATION) * 100 + '%';
    if (remaining <= 0) clearInterval(timerInt);
  }

  tick();
  const timerInt = setInterval(tick, 1000);

  // === Floating social-proof notifications ===
  const names = [
    'Lucas R.', 'Bruno S.', 'Felipe O.', 'Gustavo L.', 'Thiago F.',
    'Diego R.', 'Marcelo S.', 'Andre P.', 'Roberto M.', 'Fernando G.',
    'Mateus S.', 'Gabriel C.', 'Vitor H.', 'Rafael A.', 'Henrique B.',
    'Caio P.', 'Eduardo M.', 'Leandro S.', 'Ricardo F.', 'Daniel O.'
  ];
  const actions = ['acabou de pegar', 'desbloqueou', 'liberou', 'garantiu', 'pegou agora'];

  let feedEl = null;
  function ensureFeed() {
    if (!feedEl) {
      feedEl = document.createElement('div');
      feedEl.id = 'upFeed';
      feedEl.className = 'up-feed';
      document.body.appendChild(feedEl);
    }
    return feedEl;
  }

  function showFeedItem() {
    const feed = ensureFeed();
    const old = feed.querySelector('.up-feed-item:not(.is-out)');
    if (old) {
      old.classList.add('is-out');
      setTimeout(() => old.remove(), 350);
    }
    const item = document.createElement('div');
    item.className = 'up-feed-item';
    const name = names[Math.floor(Math.random() * names.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const sec = Math.floor(Math.random() * 90) + 8;
    item.innerHTML =
      '<div class="up-feed-dot"></div>' +
      '<div><strong>' + name + '</strong> ' + action + ' há <strong>' + sec + 's</strong></div>';
    feed.appendChild(item);
    setTimeout(() => {
      if (item.parentNode) {
        item.classList.add('is-out');
        setTimeout(() => item.remove(), 350);
      }
    }, 5500);
  }

  setTimeout(showFeedItem, 2500);
  setInterval(showFeedItem, 8500 + Math.random() * 5500);

  // === Skip link handler ===
  document.addEventListener('click', function (e) {
    const link = e.target.closest('.up-skip[data-next]');
    if (link) {
      e.preventDefault();
      location.href = link.getAttribute('data-next');
    }
  });

  // === 3-second video preview lock ===
  document.querySelectorAll('.up-hero').forEach(function (hero) {
    const video = hero.querySelector('.up-hero-video');
    const unlock = hero.querySelector('.up-hero-unlock');
    if (!video || !unlock) return;

    let locked = false;
    function maybeLock() {
      if (locked) return;
      if (video.currentTime >= 3) {
        locked = true;
        try { video.pause(); } catch (e) {}
        unlock.classList.add('is-active');
        video.removeEventListener('timeupdate', maybeLock);
      }
    }
    video.addEventListener('timeupdate', maybeLock);
  });

  // === Viewer counter drift (alternating numbers) ===
  document.querySelectorAll('.up-hero-views .views-num').forEach(function (el) {
    let current = parseInt((el.dataset.base || el.textContent || '0').replace(/\D/g, ''), 10);
    if (!current || isNaN(current)) return;

    function render() {
      el.textContent = current.toLocaleString('pt-BR');
    }
    render();

    setInterval(function () {
      const delta = Math.floor(Math.random() * 7) - 3;
      current = Math.max(50, current + delta);
      render();
    }, 1800 + Math.random() * 1400);
  });

  // === Exit-intent overlay (fires once per session, only on up1-4) ===
  const EXIT_KEY = 'nicole-exit-shown-' + location.pathname;
  if (!sessionStorage.getItem(EXIT_KEY) && /\/up[1-4]\//.test(location.pathname)) {
    let exitArmed = false;
    setTimeout(function () { exitArmed = true; }, 4000); // arm after 4s on page

    function showExitOverlay() {
      if (sessionStorage.getItem(EXIT_KEY)) return;
      sessionStorage.setItem(EXIT_KEY, '1');

      const overlay = document.createElement('div');
      overlay.className = 'up-exit';
      const title = (document.querySelector('.up-offer-title')?.textContent || 'essa oferta').trim();
      const priceEl = document.querySelector('.up-new-price strong');
      const priceTxt = priceEl ? priceEl.textContent : '';

      overlay.innerHTML =
        '<div class="up-exit-card">' +
          '<button class="up-exit-close" type="button" aria-label="Fechar">' +
            '<span class="material-symbols-outlined">close</span>' +
          '</button>' +
          '<img class="up-exit-avatar" src="/perfil.png" alt="Nicole">' +
          '<div class="up-exit-eyebrow">' +
            '<span class="material-symbols-outlined">warning</span>Espera, amor' +
          '</div>' +
          '<h2 class="up-exit-title">Você vai fechar mesmo?</h2>' +
          '<p class="up-exit-text">Se você sair agora, eu libero <strong>' + title + '</strong> pra próximas pessoas da fila — e o preço volta pro cheio. Última chance de levar por <strong>' + priceTxt + '</strong>.</p>' +
          '<div class="up-exit-stats">' +
            '<div><span class="material-symbols-outlined">groups</span><strong>12</strong>&nbsp;esperando</div>' +
            '<div><span class="material-symbols-outlined">schedule</span><strong>04:23</strong>&nbsp;restantes</div>' +
          '</div>' +
          '<button class="up-exit-cta" type="button">' +
            '<span class="material-symbols-outlined">lock_open</span>' +
            'Voltar e aproveitar' +
          '</button>' +
          '<a class="up-exit-skip" href="#">Não, vou perder essa oferta</a>' +
        '</div>';

      document.body.appendChild(overlay);
      requestAnimationFrame(function () { overlay.classList.add('is-open'); });

      function close() {
        overlay.classList.remove('is-open');
        setTimeout(function () { overlay.remove(); }, 250);
      }
      overlay.querySelector('.up-exit-close').addEventListener('click', close);
      overlay.querySelector('.up-exit-skip').addEventListener('click', function (e) { e.preventDefault(); close(); });
      overlay.querySelector('.up-exit-cta').addEventListener('click', function () {
        close();
        const cta = document.querySelector('.up-cta, .up-hero-unlock-btn');
        if (cta) cta.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) close();
      });
    }

    document.addEventListener('mouseout', function (e) {
      if (!exitArmed) return;
      if (e.relatedTarget) return; // moved within page
      if (e.clientY <= 10) showExitOverlay();
    });
    // Mobile fallback: trigger if user scrolls up fast near top of page
    let lastScroll = window.scrollY;
    let upwardDistance = 0;
    document.addEventListener('scroll', function () {
      if (!exitArmed) return;
      const curr = window.scrollY;
      if (curr < lastScroll) upwardDistance += (lastScroll - curr);
      else upwardDistance = 0;
      lastScroll = curr;
      if (upwardDistance > 600 && curr < 100) showExitOverlay();
    }, { passive: true });
  }
})();
