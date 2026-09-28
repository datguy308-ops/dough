document.addEventListener('DOMContentLoaded', () => {

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Footer year ----------
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---------- Sticky header ----------
  const header = document.getElementById('siteHeader');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 12);
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- Mobile nav ----------
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  const setNav = (open) => {
    mainNav.classList.toggle('open', open);
    document.body.classList.toggle('nav-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  navToggle.addEventListener('click', () => setNav(!mainNav.classList.contains('open')));
  mainNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setNav(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });

  // ---------- Scroll reveal (paper "settles" into place) ----------
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(el => observer.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in-view'));
  }

  // ---------- Gentle parallax on the hero collage ----------
  const collage = document.querySelector('.hero-collage');
  if (collage && !reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    const bits = collage.querySelectorAll('.float-cookie, .c-doodle, .c-item');
    collage.closest('.hero').addEventListener('pointermove', (e) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      bits.forEach((el, i) => {
        const depth = (i % 3 + 1) * 5;
        el.style.transform = `translate(${(x * depth).toFixed(1)}px, ${(y * depth).toFixed(1)}px)`;
      });
    });
  }

  // ---------- Order form (the box itself lives in js/box.js) ----------
  const form = document.getElementById('orderForm');
  const dateInput = document.getElementById('deliveryDate');
  if (dateInput) {
    const min = new Date(Date.now() + 2 * 864e5);
    dateInput.min = min.toISOString().slice(0, 10);
  }

  // ---------- Delivery ($1 per mile, per order, max 20 mi) + live order total ----------
  // Every order is delivered; there is no pickup option. The distance comes from the
  // customer's address via DoughBox.setDistanceProvider() (the maps service, added later).
  // Until a provider is set, the fee is confirmed by reply.
  const DB = window.DoughBox;
  const addressInput = document.getElementById('deliveryAddress');
  const instructionsInput = document.getElementById('deliveryInstructions');
  const distanceNote = document.getElementById('deliveryDistance');
  const totalsBox = document.getElementById('orderTotals');

  // distance lookup state for the current address
  let dist = { address: '', status: 'none', miles: null };   // status: none | pending | ok | too-far | error | manual
  let lookupId = 0;

  function lookupDistance() {
    const address = addressInput.value.trim();
    const provider = DB.distanceProvider;
    if (!address) { dist = { address, status: 'none', miles: null }; render(); return Promise.resolve(dist); }
    if (!provider) { dist = { address, status: 'manual', miles: null }; render(); return Promise.resolve(dist); }
    if (dist.address === address && dist.status !== 'pending' && dist.status !== 'error') return Promise.resolve(dist);
    const id = ++lookupId;
    dist = { address, status: 'pending', miles: null };
    render();
    return Promise.resolve()
      .then(() => provider(address))
      .then(miles => {
        if (id !== lookupId) return dist;                       // a newer lookup is running
        const c = DB.checkDistance(miles);
        dist = { address, status: c.status === 'ok' ? 'ok' : c.status === 'too-far' ? 'too-far' : 'error', miles: c.miles ?? null };
        render();
        return dist;
      })
      .catch(() => {
        if (id === lookupId) { dist = { address, status: 'error', miles: null }; render(); }
        return dist;
      });
  }

  let debounce;
  addressInput.addEventListener('input', () => {
    clearTimeout(debounce);
    if (dist.address !== addressInput.value.trim()) { dist = { ...dist, status: DB.distanceProvider ? 'none' : dist.status }; render(); }
    debounce = setTimeout(lookupDistance, 700);
  });
  addressInput.addEventListener('change', () => { clearTimeout(debounce); lookupDistance(); });

  function render() {
    const max = DB.MAX_DELIVERY_MILES;
    const fee = dist.status === 'ok' ? DB.deliveryFee(dist.miles) : null;
    addressInput.setAttribute('aria-invalid', String(dist.status === 'too-far'));

    distanceNote.className = 'delivery-distance' + (dist.status === 'too-far' || dist.status === 'error' ? ' is-warn' : dist.status === 'ok' ? ' is-ok' : '');
    distanceNote.textContent = {
      none: `Delivery is $1 per mile, within ${max} miles of our kitchen — we'll work out the distance from your address.`,
      manual: `We'll work out the distance from your address and confirm your delivery fee ($1 per mile) when we reply.`,
      pending: 'Finding the distance from our kitchen…',
      ok: `${dist.miles} miles from our kitchen · ${DB.money(fee || 0)} delivery ♡`,
      'too-far': `Sorry — that's ${dist.miles} miles away, and we only deliver within ${max} miles of our kitchen.`,
      error: `We couldn't find that address. Please double-check it — or we'll confirm the delivery fee when we reply.`
    }[dist.status];

    const box = DB.validate(DB.items);
    if (!box.cookies) { totalsBox.innerHTML = ''; return; }
    const rows = [`<li><span>Cookies · box of ${box.cookies}</span><span>${DB.money(box.subtotal)}</span></li>`];
    if (dist.status === 'ok') rows.push(`<li><span>Delivery · ${dist.miles} mi × $1</span><span>${DB.money(fee)}</span></li>`);
    else if (dist.status === 'too-far') rows.push(`<li class="ot-warn"><span>Outside our ${max}-mile delivery area</span></li>`);
    else if (dist.status === 'pending') rows.push(`<li><span>Delivery · $1 per mile</span><span>calculating…</span></li>`);
    else rows.push(`<li><span>Delivery · $1 per mile</span><span>from your address</span></li>`);
    rows.push(dist.status === 'ok'
      ? `<li class="ot-total"><span>Total</span><span>${DB.money(box.subtotal + fee)}</span></li>`
      : dist.status === 'too-far'
        ? `<li class="ot-total"><span>Cookies</span><span>${DB.money(box.subtotal)}</span></li>`
        : `<li class="ot-total"><span>Total</span><span>${DB.money(box.subtotal)} + delivery</span></li>`);
    totalsBox.innerHTML = `<ul>${rows.join('')}</ul><p>Sales tax is included in our prices.</p>`;
  }
  DB.onChange(render);
  render();

  const formNote = document.getElementById('formNote');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formNote.classList.remove('is-error');
    form.querySelectorAll('[aria-invalid]').forEach(f => f.removeAttribute('aria-invalid'));

    // Re-validate the box from the saved model at submit time — the disabled
    // button is only a hint, this is the actual check.
    const box = DB.validate(DB.items);
    const missing = [...form.querySelectorAll('[required]')].filter(f => !f.value.trim());
    const email = form.elements.email;
    const badEmail = !missing.includes(email) && !email.checkValidity();

    if (!box.ok) {
      formNote.classList.add('is-error');
      formNote.textContent = box.cookies === 0
        ? 'Your box is empty — choose a box of 4, 6, or 12 cookies.'
        : `Boxes come in 4, 6, or 12 cookies. ${DB.message(box).replace(/\s*♡$/, '')}.`;
      const firstAdd = form.querySelector('.builder-list .step-btn--add');
      firstAdd && firstAdd.focus();
      return;
    }
    if (missing.length || badEmail) {
      missing.concat(badEmail ? [email] : []).forEach(f => f.setAttribute('aria-invalid', 'true'));
      formNote.classList.add('is-error');
      formNote.textContent = missing.includes(addressInput)
        ? 'Please add your delivery address (and fill in any other missing details).'
        : 'Please fill in your name, a valid email, and a delivery date.';
      (missing[0] || email).focus();
      return;
    }

    // make sure the distance matches the address being submitted
    // (guard against double-submits while the lookup runs)
    if (form.dataset.busy) return;
    form.dataset.busy = '1';
    clearTimeout(debounce);
    let d;
    try { d = await lookupDistance(); } finally { delete form.dataset.busy; }
    if (d.status === 'too-far') {
      addressInput.setAttribute('aria-invalid', 'true');
      formNote.classList.add('is-error');
      formNote.textContent = `Sorry — we only deliver within ${DB.MAX_DELIVERY_MILES} miles of our kitchen, so we can't take this order.`;
      addressInput.focus();
      return;
    }
    const fee = d.status === 'ok' ? DB.deliveryFee(d.miles) : null;

    // The order keeps the exact flavor breakdown, not just a count.
    const order = {
      name: form.elements.name.value.trim(),
      email: email.value.trim(),
      phone: form.elements.phone.value.trim(),
      deliveryDate: form.elements.date.value,
      notes: form.elements.message.value.trim(),
      box: box.lines,                 // [{ flavor, qty, price, lineTotal }, ...] (cents)
      boxSize: box.size,              // 4, 6, or 12
      totalCookies: box.cookies,
      totalFlavors: box.flavors,
      cookiesTotal: box.subtotal,     // cents, sales tax included
      delivery: {
        address: addressInput.value.trim(),
        instructions: instructionsInput.value.trim(),
        miles: fee === null ? null : d.miles,
        fee                              // cents; null = distance to be confirmed
      },
      total: fee === null ? null : box.subtotal + fee   // cents; null until the distance is known
    };

    // Static site: no backend yet. When a form service/email is connected, send `order`
    // (the hidden "box" field already carries the breakdown as text for plain form posts).
    window.lastOrderRequest = order;

    const first = order.name.split(' ')[0];
    formNote.innerHTML = '';
    const thanks = document.createElement('span');
    thanks.textContent = `Thank you, ${first}! We'll be in touch soon to confirm your order ♡`;
    const receipt = document.createElement('ul');
    receipt.className = 'order-receipt';
    const line = (text, cls) => { const li = document.createElement('li'); li.textContent = text; if (cls) li.className = cls; receipt.append(li); };
    order.box.forEach(l => line(`${l.qty} × ${l.flavor} — ${DB.money(l.lineTotal)}`));
    line(`Box of ${order.boxSize} · ${order.totalFlavors} ${order.totalFlavors === 1 ? 'flavor' : 'flavors'} · ${DB.money(order.cookiesTotal)}`, 'order-receipt-total');
    line(fee === null
      ? `Delivery · $1 per mile — we'll confirm the distance`
      : `Delivery · ${order.delivery.miles} mi × $1 — ${DB.money(fee)}`);
    if (order.delivery.instructions) line(`Delivery instructions: ${order.delivery.instructions}`, 'order-receipt-note');
    line(order.total === null
      ? `Total: ${DB.money(order.cookiesTotal)} + delivery (tax included)`
      : `Total: ${DB.money(order.total)} (tax included)`, 'order-receipt-total');
    formNote.append(thanks, receipt);

    form.reset();
    dist = { address: '', status: 'none', miles: null };
    DB.clear();
    render();
  });

});
