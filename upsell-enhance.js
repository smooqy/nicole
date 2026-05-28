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
})();
