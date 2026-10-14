/* ==========================================================================
   Dough Bunny — Build Your Box
   One source of truth for the cookie box: an exact quantity per flavor.
   Every surface (flavor cards, the order form, the floating box sticker,
   and the box summary) reads from and writes to this single model, and
   the box is saved to localStorage so it survives a refresh.

   The customer can also pick a box size up front (4 / 6 / 12). That choice only
   guides the UI (size picker, the little box meter, "add N more" copy); the
   actual rule is still validate(): the total must be exactly 4, 6, or 12.

   Business rules (keep in sync with any future order backend):
   - a box holds exactly 4, 6, or 12 cookies in total, mixed freely
   - 12 is the most a customer can order
   - prices are per large cookie and already include sales tax
   - every order is delivered (no pickup), flat fee per order by one-way driving distance:
     0–5 mi $5 · over 5–10 mi $8 · over 10–15 mi $12 · over 15–20 mi $16; over 20 mi is outside
     the standard area. The owner checks the distance and confirms the fee by hand — the site
     never calculates it.
   - money is handled in whole cents
   ========================================================================== */
(function () {
  'use strict';

  // flavor -> price per large cookie, in cents. Names are exactly the bakery's cookbook names
  // (shown on screen and sent with orders) — don't rename or add alternate names.
  const PRICES = {
    'Chocolate Chip': 450,
    'Snickerdoodle': 450,
    "S'mores": 550,
    'Strawberry Shortcake': 600,
    'Frosted Butter Cookie': 500,
    'Banana Pudding': 550,
    'Brownie Cookie': 550
  };
  // earlier flavor names -> current names, so boxes saved by older versions of the site still load
  const RENAMED = {
    'Chocolate Chip Cookies': 'Chocolate Chip',
    'Strawberry Shortcake Cookies': 'Strawberry Shortcake',
    'Frosted Butter Cookies': 'Frosted Butter Cookie',
    'Frosted Butter Cut-Out': 'Frosted Butter Cookie',
    'Natilla Snickerdoodle Cookies': 'Snickerdoodle',
    'Natilla Snickerdoodle': 'Snickerdoodle',
    'Banana Pudding Cookies': 'Banana Pudding',
    'Crackly-Top Brownie Cookies': 'Brownie Cookie',
    'Brownie Crispy-Top': 'Brownie Cookie',
    "S'mores Cookies": "S'mores"
  };
  // Allergen statements per flavor, exactly as provided by the bakery (website information form).
  // A flavor without an entry shows "allergen details coming soon" — never guess.
  const ALLERGENS = {
    'Chocolate Chip': { contains: ['Wheat', 'Milk', 'Eggs', 'Soy'], note: 'Made in a kitchen that handles peanuts, tree nuts, sesame, and other major allergens. Cross-contact may occur.' },
    'Snickerdoodle': { contains: ['Wheat', 'Milk', 'Eggs'], note: 'Cross-contact with other major allergens may occur.' },
    "S'mores": { contains: ['Wheat', 'Milk', 'Eggs', 'Soy'], note: 'Cross-contact with other major allergens may occur.' },
    'Strawberry Shortcake': { contains: ['Wheat', 'Milk', 'Eggs', 'Soy'], note: 'Cross-contact with other major allergens may occur.' },
    'Frosted Butter Cookie': { contains: ['Wheat', 'Milk', 'Eggs'], note: 'Made in a kitchen that handles soy, peanuts, tree nuts, sesame, and other major allergens; cross-contact may occur.' },
    'Brownie Cookie': { contains: ['Wheat', 'Milk', 'Eggs', 'Soy'], note: 'Made in a kitchen that handles peanuts, tree nuts, sesame, and other major allergens; cross-contact may occur.' }
    // 'Banana Pudding': not provided yet
  };
  // Full ingredient lists (in descending order by weight, as on the box label). Add each one as
  // the bakery provides it, e.g. 'Chocolate Chip': 'Enriched flour (wheat flour, …), butter (milk), …'
  const INGREDIENTS = {};
  const FLAVORS = Object.keys(PRICES);
  // allergens contained across a set of flavors (in a stable order)
  const ALLERGEN_ORDER = ['Wheat', 'Milk', 'Eggs', 'Soy'];
  const allergensIn = (flavors) => ALLERGEN_ORDER.filter(a => flavors.some(f => (ALLERGENS[f] || { contains: [] }).contains.includes(a)));
  const allergensPending = (flavors) => flavors.filter(f => !ALLERGENS[f]);
  const BOX_SIZES = [4, 6, 12];
  const MAX_COOKIES = BOX_SIZES[BOX_SIZES.length - 1];
  // Flat delivery fee per order (cents) by one-way driving distance, up to `upTo` miles.
  // For display only: the owner confirms each order's fee after checking the address.
  const DELIVERY_RATES = [
    { from: 0, upTo: 5, fee: 500 },
    { from: 5, upTo: 10, fee: 800 },
    { from: 10, upTo: 15, fee: 1200 },
    { from: 15, upTo: 20, fee: 1600 }
  ];
  const MAX_DELIVERY_MILES = DELIVERY_RATES[DELIVERY_RATES.length - 1].upTo;   // standard delivery area
  const DELIVERY_PENDING = 'Delivery fee pending confirmation';
  const STORAGE_KEY = 'doughbunny.box.v1';

  const money = (cents) => `$${(cents / 100).toFixed(2)}`;
  const moneyShort = (cents) => (cents % 100 ? money(cents) : `$${cents / 100}`);
  // Display name = the flavor's exact name (kept as a hook in case display names ever differ).
  const label = (flavor) => flavor;
  const listSizes = () => `${BOX_SIZES.slice(0, -1).join(', ')}, or ${BOX_SIZES[BOX_SIZES.length - 1]}`;
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

  const migrate = (raw) => {
    const out = { ...(raw || {}) };
    Object.keys(RENAMED).forEach(old => {
      if (old in out && RENAMED[old] !== old) { out[RENAMED[old]] = (Number(out[RENAMED[old]]) || 0) + (Number(out[old]) || 0); delete out[old]; }
    });
    return out;
  };
  const cleanTarget = (n) => (BOX_SIZES.includes(Number(n)) ? Number(n) : null);
  const readStore = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch (e) { return {}; }
  };
  const load = () => sanitize(migrate(readStore().items));
  let items = load();
  let target = cleanTarget(readStore().target);          // chosen box size (UI guide only)
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items, target })); } catch (e) { /* private mode: box just won't persist */ }
  };

  // The box size the customer is filling: their pick, bumped up automatically
  // if they add more cookies than it holds.
  const fitTarget = (cookies) => BOX_SIZES.find(n => n >= cookies) || MAX_COOKIES;
  function activeTarget(v) {
    if (target && v.cookies <= target) return target;
    return v.cookies ? fitTarget(v.cookies) : target;
  }

  // Target-aware progress line for the meter, the form, and the box summary.
  function progress(v) {
    const t = activeTarget(v);
    if (!v.cookies) return t ? `Your box of ${t} is ready to fill ♡` : `Pick a box of ${listSizes()} cookies ♡`;
    if (v.cookies === t) return `Box of ${t} — full and ready ♡`;
    const more = t - v.cookies;
    return v.ok
      ? `${v.cookies} of ${t} · add ${more} more, or order as a box of ${v.cookies}`
      : `${v.cookies} of ${t} · add ${more} more ♡`;
  }

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
    const now = totals(items).cookies;
    if (now && (!target || now > target)) target = fitTarget(now);   // grow the box as needed
    save();
    listeners.forEach(fn => fn({ flavor, before, after: items[flavor], source }));
    return true;
  }
  const change = (flavor, delta, source) => set(flavor, items[flavor] + delta, source);
  const clear = () => { items = sanitize({}); target = null; save(); listeners.forEach(fn => fn({ cleared: true })); };
  // Choose a box size. Sizes smaller than what's already in the box aren't allowed.
  function setTarget(n) {
    const t = cleanTarget(n);
    if (!t || t < totals(items).cookies) return false;
    target = t;
    save();
    listeners.forEach(fn => fn({ target: t }));
    return true;
  }
  const onChange = (fn) => listeners.push(fn);

  // Expose the model (read-only snapshot + validation) for the order form and tests.
  window.DoughBox = {
    FLAVORS, PRICES, ALLERGENS, INGREDIENTS, allergensIn, allergensPending, BOX_SIZES, MAX_COOKIES,
    DELIVERY_RATES, MAX_DELIVERY_MILES, DELIVERY_PENDING,
    sanitize, totals, validate, message, progress, sizeLabel, listSizes, money, moneyShort, label,
    get items() { return { ...items }; },
    get target() { return activeTarget(validate(items)); },
    set, change, clear, onChange, setTarget,
    // re-read storage in case another tab changed it
    reload() { items = load(); target = cleanTarget(readStore().target); listeners.forEach(fn => fn({ reloaded: true })); }
  };

  /* ---------- UI ---------- */

  document.addEventListener('DOMContentLoaded', () => {
    const status = document.getElementById('boxStatus');
    const announce = (msg) => { if (status) { status.textContent = ''; setTimeout(() => { status.textContent = msg; }, 30); } };

    // Fill copy that mirrors business values, so the page never drifts from the rules above.
    const bind = {
      'max-miles': String(MAX_DELIVERY_MILES),
      'delivery-from': moneyShort(DELIVERY_RATES[0].fee),
      'delivery-range': `${moneyShort(DELIVERY_RATES[0].fee)}–${moneyShort(DELIVERY_RATES[DELIVERY_RATES.length - 1].fee)}`,
      'delivery-fees': DELIVERY_RATES.map(r => moneyShort(r.fee)).join(', ').replace(/, ([^,]+)$/, ', or $1'),
      'box-sizes': listSizes()
    };
    document.querySelectorAll('[data-db]').forEach(el => { if (el.dataset.db in bind) el.textContent = bind[el.dataset.db]; });
    document.querySelectorAll('[data-delivery-rates]').forEach(ul => {
      ul.innerHTML = DELIVERY_RATES.map(r =>
        `<li><span>${r.from}–${r.upTo} miles</span><strong>${moneyShort(r.fee)}</strong></li>`).join('');
    });
    document.querySelectorAll('[data-allergens-for]').forEach(el => {
      const a = ALLERGENS[el.dataset.allergensFor];
      el.classList.toggle('is-pending', !a);
      el.innerHTML = a
        ? `<strong>Contains: ${a.contains.join(', ')}.</strong> <span>${a.note}</span>`
        : '<strong>Allergen details coming soon.</strong> <span>Please call, text, or email us before ordering if you have any food allergies.</span>';
    });
    document.querySelectorAll('[data-ingredients-for]').forEach(el => {
      const list = INGREDIENTS[el.dataset.ingredientsFor];
      el.textContent = list || 'Full ingredient list coming soon — ask us anytime.';
    });
    document.querySelectorAll('[data-price-for]').forEach(el => {
      const f = el.dataset.priceFor;
      if (f in PRICES) el.innerHTML = `${money(PRICES[f])} <small>per large cookie</small>`;
    });

    // flavor -> illustration type, read from the menu cards (used to color the box meter)
    const artFor = {};
    document.querySelectorAll('.recipe-tile').forEach(card => {
      const ctl = card.querySelector('.box-control[data-flavor]');
      const art = card.querySelector('[data-cookie]');
      if (ctl && art) artFor[ctl.dataset.flavor] = art.dataset.cookie;
    });

    // A cozy stepper: [−] n [+]  (the count is announced once, via #boxStatus)
    function makeStepper(flavor, size) {
      const name = label(flavor);
      const wrap = document.createElement('div');
      wrap.className = 'stepper' + (size ? ` stepper--${size}` : '');
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-label', `${name} in your box`);
      wrap.innerHTML = `
        <button type="button" class="step-btn" data-delta="-1" aria-label="Remove one ${name}">−</button>
        <span class="step-count"><span class="qty-num">0</span><span class="sr-only"> ${name}</span></span>
        <button type="button" class="step-btn step-btn--add" data-delta="1" aria-label="Add one ${name}">+</button>`;
      wrap.addEventListener('click', (e) => {
        const btn = e.target.closest('.step-btn');
        if (!btn) return;
        change(flavor, Number(btn.dataset.delta), wrap);
      });
      const num = wrap.querySelector('.qty-num');
      const minus = wrap.querySelector('[data-delta="-1"]');
      const plus = wrap.querySelector('[data-delta="1"]');
      wrap.update = (qty, full) => {
        num.textContent = qty;
        minus.disabled = qty <= 0;
        plus.disabled = full;
        plus.title = full ? `Your box is full (${MAX_COOKIES} cookies)` : '';
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
      add.setAttribute('aria-label', `Add one ${label(flavor)} to your box`);
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

    /* the order form's flavor list */
    const formList = document.getElementById('boxBuilder');
    const formRows = FLAVORS.map(flavor => {
      const li = document.createElement('li');
      li.className = 'builder-row';
      const alg = ALLERGENS[flavor] ? `contains ${ALLERGENS[flavor].contains.join(', ').toLowerCase()}` : 'allergen details coming soon';
      li.innerHTML = `<span class="builder-name">${label(flavor)}<small>${money(PRICES[flavor])} each · ${alg}</small></span>`;
      const stepper = makeStepper(flavor, 'sm');
      li.append(stepper);
      formList && formList.append(li);
      return { flavor, li, stepper };
    });

    /* Step 1 — box size pickers (menu + form) */
    const pickers = [...document.querySelectorAll('.size-picker')];
    const sizeNote = { 4: 'cookies', 6: 'half dozen', 12: 'a dozen' };
    pickers.forEach(p => {
      p.innerHTML = BOX_SIZES.map(n => `
        <button type="button" class="size-opt" data-size="${n}" aria-pressed="false">
          <span class="size-num">${n}</span><span class="size-word">${sizeNote[n] || 'cookies'}</span>
        </button>`).join('');
      p.addEventListener('click', (e) => {
        const b = e.target.closest('.size-opt');
        if (!b || b.disabled) return;
        if (setTarget(Number(b.dataset.size))) announce(`Box of ${b.dataset.size} chosen. ${progress(validate(items))}`);
      });
    });

    /* the little box that fills up */
    const meters = [...document.querySelectorAll('.box-meter')];
    meters.forEach(m => { m.innerHTML = '<span class="meter-slots" aria-hidden="true"></span><span class="meter-text"></span>'; });

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
    const boxAllergens = document.getElementById('boxAllergens');

    function render(evt) {
      const v = validate(items);
      const t = activeTarget(v);
      const prog = progress(v);

      cardControls.forEach(c => {
        const qty = items[c.flavor];
        c.add.hidden = qty > 0;
        c.add.disabled = v.full;
        c.add.title = v.full ? `Your box is full (${MAX_COOKIES} cookies)` : '';
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

      pickers.forEach(p => p.querySelectorAll('.size-opt').forEach(b => {
        const n = Number(b.dataset.size);
        b.setAttribute('aria-pressed', String(t === n));
        b.disabled = n < v.cookies;
        b.title = b.disabled ? `Remove a few cookies to choose a box of ${n}` : '';
      }));

      // meter: one slot per cookie in the chosen box, colored by flavor
      const slots = t || BOX_SIZES[0];
      const filled = v.lines.flatMap(l => Array(l.qty).fill(artFor[l.flavor] || 'choc'));
      const slotHtml = Array.from({ length: slots }, (_, i) =>
        `<span class="slot${filled[i] ? ` is-filled slot--${filled[i]}` : ''}"></span>`).join('');
      meters.forEach(m => {
        m.dataset.size = slots;
        m.classList.toggle('is-ok', v.ok);
        m.querySelector('.meter-slots').innerHTML = slotHtml;
        m.querySelector('.meter-text').textContent = prog;
      });

      // sticker: cookies + price when the box is valid, what's missing when it isn't
      if (pill) {
        const more = t ? t - v.cookies : v.addNeeded;
        pill.classList.toggle('is-short', v.cookies > 0 && !v.ok);
        pillText.textContent = v.cookies === 0
          ? 'Build your box'
          : v.ok
            ? `${plural(v.cookies, 'cookie', 'cookies')} · ${money(v.subtotal)}`
            : `${plural(v.cookies, 'cookie', 'cookies')} · Add ${more} more`;
        pill.setAttribute('aria-label', v.cookies === 0
          ? 'Build your box — go to the cookies'
          : `Your cookie box: ${pillText.textContent}. Open box summary`);
        pill.hidden = false;
      }

      // summary panel
      if (panelList) {
        panelList.innerHTML = v.lines.length
          ? v.lines.map(l => `<li><span class="bp-qty">${l.qty} ×</span> <span class="bp-name">${label(l.flavor)}</span> <span class="bp-price">${money(l.lineTotal)}</span></li>`).join('')
          : '<li class="bp-empty">Your box is empty — tap <em>Add a little love</em> on any cookie.</li>';
        panelTotals.innerHTML = `<span>${plural(v.cookies, 'cookie', 'cookies')} · ${plural(v.flavors, 'flavor', 'flavors')}</span><strong>${money(v.subtotal)} <small>tax incl.</small></strong>`;
        panelMsg.textContent = v.ok || !v.cookies ? prog : `${prog} (boxes come in ${listSizes()})`;
        panelMsg.classList.toggle('is-ok', v.ok);
        continueBtn.disabled = !v.ok;
      }

      // form
      if (formTotal) {
        formTotal.innerHTML = `<strong>Box subtotal: ${money(v.subtotal)}</strong> <span>· ${plural(v.cookies, 'cookie', 'cookies')}${v.flavors ? ` · ${plural(v.flavors, 'flavor', 'flavors')}` : ''}</span>`;
        formMsg.textContent = prog;
        formMsg.classList.toggle('is-ok', v.ok);
        submitBtn.disabled = !v.ok;
        if (boxAllergens) {
          boxAllergens.hidden = !v.lines.length;
          const flavors = v.lines.map(l => l.flavor);
          const pending = allergensPending(flavors);
          boxAllergens.innerHTML = v.lines.length
            ? `<strong>Allergens in your box:</strong> contains ${allergensIn(flavors).join(', ').toLowerCase()}. Our kitchen handles peanuts, tree nuts, sesame, soy, and other major allergens; cross-contact may occur.`
              + (pending.length ? ` <em>Allergen details for ${pending.join(', ')} are coming soon — please ask us before ordering if you have allergies.</em>` : '')
            : '';
        }
        hiddenBox.value = v.lines.map(l => `${l.qty} x ${l.flavor} (${money(l.lineTotal)})`).join('; ')
          + (v.lines.length ? `; box of ${v.cookies}; cookies ${money(v.subtotal)} incl. tax` : '');
      }

      if (evt && evt.full) {
        announce(`Your box is full — ${MAX_COOKIES} cookies is our biggest box.`);
        return;
      }
      if (evt && evt.flavor) {
        announce(evt.after > evt.before
          ? `Added one ${label(evt.flavor)}: ${evt.after} in your box. ${prog}`
          : `Removed one ${label(evt.flavor)}: ${evt.after} left. ${prog}`);
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
    const goTo = (id) => document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
    pill && pill.addEventListener('click', () => {
      if (!validate(items).cookies) { goTo('build'); return; }       // empty box: take them to the cookies
      panel.hidden ? openPanel() : closePanel();
    });
    closeBtn && closeBtn.addEventListener('click', closePanel);
    keepBtn && keepBtn.addEventListener('click', () => { closePanel(); goTo('menu'); });
    continueBtn && continueBtn.addEventListener('click', () => {
      const v = validate(items);                       // re-check; never trust the button state
      if (!v.ok) { panelMsg.textContent = progress(v); return; }
      closePanel();
      goTo('order');
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
