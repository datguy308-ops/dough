/* ==========================================================================
   Dough Bunny — Build Your Box
   One source of truth for the cookie box: an exact quantity per flavor.
   Every surface (flavor cards, the order form, the floating box sticker,
   and the box summary) reads from and writes to this single model, and
   the box is saved to localStorage so it survives a refresh.

   Business rules (keep in sync with any future order backend):
   - a box holds exactly 4, 6, or 12 cookies in total, mixed freely
   - 12 is the most a customer can order
   - prices are per large cookie; money is handled in whole cents
   ========================================================================== */
(function () {
  'use strict';

  // flavor -> price per large cookie, in cents
  const PRICES = {
    'Chocolate Chip': 450,
    'Strawberry Shortcake': 600,
    'Frosted Butter Cut-Out': 500,
    'Natilla Snickerdoodle': 450,
    'Banana Pudding': 550,
    'Brownie Crispy-Top': 550,
    "S'mores": 550
  };
  const FLAVORS = Object.keys(PRICES);
  const BOX_SIZES = [4, 6, 12];
  const MAX_COOKIES = BOX_SIZES[BOX_SIZES.length - 1];
  const STORAGE_KEY = 'doughbunny.box.v1';

  const money = (cents) => `$${(cents / 100).toFixed(2)}`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /* ---------- pure logic (no DOM) — reusable by a future order backend ---------- */

  // Accept anything and return a clean { flavor: qty }: only known flavors, whole
  // numbers >= 0, and never more than MAX_COOKIES in total (extra cookies are
  // dropped from the end of the menu). Guards against tampered storage/input.
  function sanitize(raw) {
    const clean = {};
    let room = MAX_COOKIES;
    FLAVORS.forEach(f => {
      const n = Math.floor(Number(raw && raw[f]));
      const qty = Number.isFinite(n) ? Math.min(Math.max(n, 0), room) : 0;
      clean[f] = qty;
      room -= qty;
    });
    return clean;
  }

  function totals(items) {
    const clean = sanitize(items);
    const lines = FLAVORS.filter(f => clean[f] > 0).map(f => ({
      flavor: f, qty: clean[f], price: PRICES[f], lineTotal: PRICES[f] * clean[f]
    }));
    const cookies = lines.reduce((sum, l) => sum + l.qty, 0);
    const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
    return { lines, cookies, flavors: lines.length, subtotal };
  }

  // ok only when the total is exactly one of the box sizes
  function validate(items) {
    const t = totals(items);
    const ok = BOX_SIZES.includes(t.cookies);
    const next = BOX_SIZES.find(n => n >= t.cookies && n !== t.cookies) || null;   // next size up
    const prev = [...BOX_SIZES].reverse().find(n => n < t.cookies) || null;       // next size down
    return {
      ...t, ok,
      size: ok ? t.cookies : null,
      full: t.cookies >= MAX_COOKIES,
      next, addNeeded: next ? next - t.cookies : 0,
      prev, removeNeeded: prev ? t.cookies - prev : 0
    };
  }

  // The one human-readable status line, shared by the box, form, and submit check.
  function message(v) {
    if (v.cookies === 0) return 'Choose a box of 4, 6, or 12 cookies ♡';
    if (v.ok) return v.full ? 'Box of 12 — your box is full ♡' : `Box of ${v.size} ready ♡`;
    const add = `Add ${plural(v.addNeeded, 'more', 'more')} for a box of ${v.next}`;
    return v.prev ? `${add} — or remove ${v.removeNeeded} for a box of ${v.prev}` : `${add} ♡`;
  }

  function sizeLabel(n) {
    if (n === 6) return 'a half dozen';
    if (n === 12) return 'a dozen';
    return '';
  }

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
    if (!FLAVORS.includes(flavor)) return false;
    const before = items[flavor];
    const others = totals(items).cookies - before;
    if (qty > before && others + qty > MAX_COOKIES) {            // box is full
      listeners.forEach(fn => fn({ full: true, flavor, source }));
      return false;
    }
    items = sanitize({ ...items, [flavor]: qty });
    if (items[flavor] === before) return false;
    save();
    listeners.forEach(fn => fn({ flavor, before, after: items[flavor], source }));
    return true;
  }
  const change = (flavor, delta, source) => set(flavor, items[flavor] + delta, source);
  const clear = () => { items = sanitize({}); save(); listeners.forEach(fn => fn({ cleared: true })); };
  const onChange = (fn) => listeners.push(fn);

  // Expose the model (read-only snapshot + validation) for the order form and tests.
  window.DoughBox = {
    FLAVORS, PRICES, BOX_SIZES, MAX_COOKIES,
    sanitize, totals, validate, message, sizeLabel, money,
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
      wrap.update = (qty, full) => {
        wrap.querySelector('.qty-num').textContent = qty;
        wrap.querySelector('[data-delta="-1"]').disabled = qty <= 0;
        const plus = wrap.querySelector('[data-delta="1"]');
        plus.disabled = full;
        plus.title = full ? 'Your box is full (12 cookies)' : '';
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
      li.innerHTML = `<span class="builder-name">${flavor}<small>${money(PRICES[flavor])} each</small></span>`;
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

    // little 4 / 6 / 12 tracker shown in the box summary and the form
    const tracks = [...document.querySelectorAll('.size-track')];
    tracks.forEach(t => {
      t.innerHTML = BOX_SIZES.map(n => `<li data-size="${n}"><span>${n}</span></li>`).join('');
    });
    function renderTracks(v) {
      tracks.forEach(t => t.querySelectorAll('li').forEach(li => {
        const n = Number(li.dataset.size);
        li.classList.toggle('is-current', v.size === n);
        li.classList.toggle('is-next', !v.ok && v.next === n);
        li.classList.toggle('is-passed', v.cookies > n);
      }));
    }

    function render(evt) {
      const v = validate(items);

      cardControls.forEach(c => {
        const qty = items[c.flavor];
        c.add.hidden = qty > 0;
        c.add.disabled = v.full;
        c.add.title = v.full ? 'Your box is full (12 cookies)' : '';
        c.stepper.hidden = qty === 0;
        c.stepper.update(qty, v.full);
        c.host.classList.toggle('has-qty', qty > 0);
        if (c.card) c.card.classList.toggle('in-box', qty > 0);
        // if the stepper just hid itself (went to 0), return focus to the add button
        if (qty === 0 && evt && evt.source === c.stepper) c.add.focus();
      });

      formRows.forEach(r => {
        const qty = items[r.flavor];
        r.stepper.update(qty, v.full);
        r.li.classList.toggle('has-qty', qty > 0);
      });

      // sticker
      if (pill) {
        pill.classList.toggle('is-short', v.cookies > 0 && !v.ok);
        pillText.textContent = v.cookies === 0
          ? 'Build your box'
          : !v.ok
            ? `${plural(v.cookies, 'cookie', 'cookies')} · Add ${v.addNeeded} more`
            : `${plural(v.cookies, 'cookie', 'cookies')} · ${plural(v.flavors, 'flavor', 'flavors')} · ${money(v.subtotal)}`;
        pill.hidden = false;
      }

      // summary panel
      if (panelList) {
        panelList.innerHTML = v.lines.length
          ? v.lines.map(l => `<li><span class="bp-qty">${l.qty} ×</span> <span class="bp-name">${l.flavor}</span> <span class="bp-price">${money(l.lineTotal)}</span></li>`).join('')
          : '<li class="bp-empty">Your box is empty — tap <em>Add a little love</em> on any cookie.</li>';
        panelTotals.innerHTML = `<span>${plural(v.cookies, 'cookie', 'cookies')} · ${plural(v.flavors, 'flavor', 'flavors')}</span><strong>Subtotal ${money(v.subtotal)}</strong>`;
        panelMsg.textContent = message(v);
        panelMsg.classList.toggle('is-ok', v.ok);
        continueBtn.disabled = !v.ok;
      }

      // form
      if (formTotal) {
        const size = sizeLabel(v.cookies);
        formTotal.innerHTML = `<strong>${plural(v.cookies, 'cookie', 'cookies')} · Subtotal ${money(v.subtotal)}</strong>${v.flavors ? ` <span>· ${plural(v.flavors, 'flavor', 'flavors')}${size ? ` · that's ${size}!` : ''}</span>` : ''}`;
        formMsg.textContent = message(v);
        formMsg.classList.toggle('is-ok', v.ok);
        submitBtn.disabled = !v.ok;
        hiddenBox.value = v.lines.map(l => `${l.qty} x ${l.flavor} (${money(l.lineTotal)})`).join('; ')
          + (v.lines.length ? `; box of ${v.cookies}; subtotal ${money(v.subtotal)}` : '');
      }

      renderTracks(v);

      if (evt && evt.full) {
        announce('Your box is full — 12 cookies is our biggest box.');
        return;
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
      if (!v.ok) { panelMsg.textContent = message(v); return; }
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
