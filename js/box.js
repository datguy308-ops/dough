/* ==========================================================================
   Dough Bunny — Build Your Box
   One source of truth for the cookie box: an exact quantity per flavor.
   Every surface (flavor cards, the order form, the floating box sticker,
   and the box summary) reads from and writes to this single model, and
   the box is saved to localStorage so it survives a refresh.

   Pricing is intentionally NOT calculated here: the prices on the page are
   placeholders and there is no pricing rule yet for mixed flavors, so the
   box works in cookie counts and the bakery confirms the total by reply.
   ========================================================================== */
(function () {
  'use strict';

  const FLAVORS = [
    'Chocolate Chip',
    'Strawberry Shortcake',
    'Frosted Butter Cut-Out',
    'Natilla Snickerdoodle',
    'Banana Pudding',
    'Brownie Crispy-Top',
    "S'mores"
  ];
  const MIN_COOKIES = 4;
  const MAX_PER_FLAVOR = 60;              // 5 dozen of one flavor; bigger events go in the notes
  const STORAGE_KEY = 'doughbunny.box.v1';

  /* ---------- pure logic (no DOM) — reusable by a future order backend ---------- */

  // Accept anything and return a clean { flavor: qty } with only known flavors
  // and whole numbers in 0..MAX_PER_FLAVOR. Guards against tampered storage/input.
  function sanitize(raw) {
    const clean = {};
    FLAVORS.forEach(f => {
      const n = Math.floor(Number(raw && raw[f]));
      clean[f] = Number.isFinite(n) ? Math.min(Math.max(n, 0), MAX_PER_FLAVOR) : 0;
    });
    return clean;
  }

  function totals(items) {
    const clean = sanitize(items);
    const lines = FLAVORS.filter(f => clean[f] > 0).map(f => ({ flavor: f, qty: clean[f] }));
    const cookies = lines.reduce((sum, l) => sum + l.qty, 0);
    return { lines, cookies, flavors: lines.length };
  }

  function validate(items) {
    const t = totals(items);
    const missing = Math.max(MIN_COOKIES - t.cookies, 0);
    return { ...t, ok: missing === 0, missing };
  }

  // Friendly name for common box sizes (the old half-dozen / dozen options)
  function sizeLabel(n) {
    if (n === 6) return 'a half dozen';
    if (n === 12) return 'a dozen';
    if (n === 18) return 'a dozen and a half';
    if (n > 0 && n % 12 === 0) return `${n / 12} dozen`;
    if (n >= 36) return 'event-size';
    return '';
  }

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /* ---------- state ---------- */

  const load = () => {
    try { return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').items); }
    catch (e) { return sanitize({}); }
  };
  let items = load();
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items })); } catch (e) { /* private mode: box just won't persist */ }
  };

  const listeners = [];
  function set(flavor, qty, source) {
    if (!FLAVORS.includes(flavor)) return;
    const before = items[flavor];
    items = sanitize({ ...items, [flavor]: qty });
    if (items[flavor] === before) return;
    save();
    listeners.forEach(fn => fn({ flavor, before, after: items[flavor], source }));
  }
  const change = (flavor, delta, source) => set(flavor, items[flavor] + delta, source);
  const clear = () => { items = sanitize({}); save(); listeners.forEach(fn => fn({ cleared: true })); };
  const onChange = (fn) => listeners.push(fn);

  // Expose the model (read-only snapshot + validation) for the order form and tests.
  window.DoughBox = {
    FLAVORS, MIN_COOKIES, MAX_PER_FLAVOR,
    sanitize, totals, validate, sizeLabel,
    get items() { return { ...items }; },
    set, change, clear, onChange,
    // re-read storage in case another tab changed it
    reload() { items = load(); listeners.forEach(fn => fn({ reloaded: true })); }
  };

  /* ---------- UI ---------- */

  document.addEventListener('DOMContentLoaded', () => {
    const status = document.getElementById('boxStatus');
    const announce = (msg) => { if (status) { status.textContent = ''; setTimeout(() => { status.textContent = msg; }, 30); } };

    // A cozy stepper: [−] n [+]
    function makeStepper(flavor, size) {
      const wrap = document.createElement('div');
      wrap.className = 'stepper' + (size ? ` stepper--${size}` : '');
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-label', `${flavor} in your box`);
      wrap.innerHTML = `
        <button type="button" class="step-btn" data-delta="-1" aria-label="Remove one ${flavor}">−</button>
        <span class="step-count" aria-live="polite" aria-atomic="true"><span class="qty-num">0</span><span class="sr-only"> ${flavor}</span></span>
        <button type="button" class="step-btn step-btn--add" data-delta="1" aria-label="Add one ${flavor}">+</button>`;
      wrap.addEventListener('click', (e) => {
        const btn = e.target.closest('.step-btn');
        if (!btn) return;
        change(flavor, Number(btn.dataset.delta), wrap);
      });
      wrap.update = (qty) => {
        wrap.querySelector('.qty-num').textContent = qty;
        wrap.querySelector('[data-delta="-1"]').disabled = qty <= 0;
        wrap.querySelector('[data-delta="1"]').disabled = qty >= MAX_PER_FLAVOR;
      };
      return wrap;
    }

    /* flavor cards (and the spotlight): "Add a little love" becomes a stepper */
    const cardControls = [...document.querySelectorAll('.box-control[data-flavor]')].map(host => {
      const flavor = host.dataset.flavor;
      host.innerHTML = '';
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'btn btn-small add-love';
      add.innerHTML = `<span>Add a little love</span> <svg aria-hidden="true"><use href="#d-heart-fill"/></svg>`;
      add.setAttribute('aria-label', `Add one ${flavor} to your box`);
      add.addEventListener('click', () => {
        change(flavor, 1, host);
        // keep keyboard focus on the control the user is now using
        requestAnimationFrame(() => host.querySelector('.step-btn--add').focus());
      });
      const stepper = makeStepper(flavor);
      const note = document.createElement('p');
      note.className = 'added-note';
      note.innerHTML = `in your box <svg aria-hidden="true"><use href="#d-heart-fill"/></svg>`;
      host.append(add, stepper, note);
      return { flavor, host, add, stepper, card: host.closest('.recipe-tile, .spotlight') };
    });

    /* the order form's "Build your box" list */
    const formList = document.getElementById('boxBuilder');
    const formRows = FLAVORS.map(flavor => {
      const li = document.createElement('li');
      li.className = 'builder-row';
      li.innerHTML = `<span class="builder-name">${flavor}</span>`;
      const stepper = makeStepper(flavor, 'sm');
      li.append(stepper);
      formList && formList.append(li);
      return { flavor, li, stepper };
    });

    /* floating sticker + summary panel */
    const pill = document.getElementById('boxPill');
    const pillText = document.getElementById('boxPillText');
    const panel = document.getElementById('boxPanel');
    const panelList = document.getElementById('boxPanelList');
    const panelTotals = document.getElementById('boxPanelTotals');
    const panelMsg = document.getElementById('boxPanelMsg');
    const continueBtn = document.getElementById('boxContinue');
    const keepBtn = document.getElementById('boxKeep');
    const closeBtn = document.getElementById('boxClose');

    /* form totals */
    const formTotal = document.getElementById('boxTotal');
    const formMsg = document.getElementById('boxMinMsg');
    const submitBtn = document.getElementById('orderSubmit');
    const hiddenBox = document.getElementById('boxField');

    function minMessage(v) {
      if (v.cookies === 0) return `Pick at least ${MIN_COOKIES} cookies to start your box ♡`;
      if (!v.ok) return `Just ${plural(v.missing, 'more cookie', 'more cookies')} ♡`;
      return `${plural(v.cookies, 'cookie', 'cookies')} selected ♡`;
    }

    function render(evt) {
      const v = validate(items);

      cardControls.forEach(c => {
        const qty = items[c.flavor];
        c.add.hidden = qty > 0;
        c.stepper.hidden = qty === 0;
        c.stepper.update(qty);
        c.host.classList.toggle('has-qty', qty > 0);
        if (c.card) c.card.classList.toggle('in-box', qty > 0);
        // if the stepper just hid itself (went to 0), return focus to the add button
        if (qty === 0 && evt && evt.source === c.stepper) c.add.focus();
      });

      formRows.forEach(r => {
        const qty = items[r.flavor];
        r.stepper.update(qty);
        r.li.classList.toggle('has-qty', qty > 0);
      });

      // sticker
      if (pill) {
        pill.classList.toggle('is-short', v.cookies > 0 && !v.ok);
        pillText.textContent = v.cookies === 0
          ? 'Build your box'
          : !v.ok
            ? `${plural(v.cookies, 'cookie', 'cookies')} · Add ${v.missing} more`
            : `${plural(v.cookies, 'cookie', 'cookies')} · ${plural(v.flavors, 'flavor', 'flavors')}`;
        pill.hidden = false;
      }

      // summary panel
      if (panelList) {
        panelList.innerHTML = v.lines.length
          ? v.lines.map(l => `<li><span class="bp-qty">${l.qty} ×</span> <span class="bp-name">${l.flavor}</span></li>`).join('')
          : '<li class="bp-empty">Your box is empty — tap <em>Add a little love</em> on any cookie.</li>';
        const size = sizeLabel(v.cookies);
        panelTotals.innerHTML = `<strong>${plural(v.cookies, 'cookie', 'cookies')}</strong><span>${plural(v.flavors, 'flavor', 'flavors')}${size ? ` · ${size}` : ''}</span>`;
        panelMsg.textContent = minMessage(v);
        panelMsg.classList.toggle('is-ok', v.ok);
        continueBtn.disabled = !v.ok;
      }

      // form
      if (formTotal) {
        const size = sizeLabel(v.cookies);
        formTotal.innerHTML = `<strong>Total: ${plural(v.cookies, 'cookie', 'cookies')}</strong>${v.flavors ? ` <span>· ${plural(v.flavors, 'flavor', 'flavors')}${size ? ` · that's ${size}!` : ''}</span>` : ''}`;
        formMsg.textContent = minMessage(v);
        formMsg.classList.toggle('is-ok', v.ok);
        submitBtn.disabled = !v.ok;
        hiddenBox.value = v.lines.map(l => `${l.qty} x ${l.flavor}`).join('; ');
      }

      if (evt && evt.flavor) {
        announce(evt.after > evt.before
          ? `Added one ${evt.flavor}: ${evt.after} in your box. ${plural(v.cookies, 'cookie', 'cookies')} total.`
          : `Removed one ${evt.flavor}: ${evt.after} left. ${plural(v.cookies, 'cookie', 'cookies')} total.`);
      }
    }

    onChange(render);
    render();

    // keep in sync with other tabs
    window.addEventListener('storage', (e) => { if (e.key === STORAGE_KEY) window.DoughBox.reload(); });

    /* panel open / close — non-modal summary; quantities stay editable on the cards */
    let lastFocus = null;
    function openPanel() {
      lastFocus = document.activeElement;
      render();
      panel.hidden = false;
      pill.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(() => panel.querySelector('.box-panel-title').focus());
    }
    function closePanel() {
      panel.hidden = true;
      pill.setAttribute('aria-expanded', 'false');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    pill && pill.addEventListener('click', () => {
      if (!validate(items).cookies) {                 // empty box: take them to the cookies
        document.getElementById('menu').scrollIntoView({ behavior: 'smooth' });
        return;
      }
      panel.hidden ? openPanel() : closePanel();
    });
    closeBtn && closeBtn.addEventListener('click', closePanel);
    keepBtn && keepBtn.addEventListener('click', () => {
      closePanel();
      document.getElementById('menu').scrollIntoView({ behavior: 'smooth' });
    });
    continueBtn && continueBtn.addEventListener('click', () => {
      const v = validate(items);                       // re-check; never trust the button state
      if (!v.ok) { panelMsg.textContent = minMessage(v); return; }
      closePanel();
      document.getElementById('order').scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => { const n = document.querySelector('#orderForm [name="name"]'); n && n.focus({ preventScroll: true }); }, 700);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel && !panel.hidden) closePanel(); });
    document.addEventListener('click', (e) => {
      if (panel && !panel.hidden && !panel.contains(e.target) && !pill.contains(e.target)) closePanel();
    });

    // hide the sticker while the order form (which already shows the box) is on screen
    const form = document.getElementById('orderForm');
    if (form && pill && 'IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        pill.classList.toggle('is-away', entry.isIntersecting);
        if (entry.isIntersecting && !panel.hidden) closePanel();
      }, { threshold: 0.15 }).observe(form);
    }
  });
})();
