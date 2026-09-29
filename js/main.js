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
    // earliest date = two days out, in the visitor's local time (not UTC)
    const min = new Date(Date.now() + 2 * 864e5);
    const pad = (n) => String(n).padStart(2, '0');
    dateInput.min = `${min.getFullYear()}-${pad(min.getMonth() + 1)}-${pad(min.getDate())}`;
  }

  // ---------- Delivery + live order total ----------
  // Every order is delivered; there is no pickup option. The distance comes from the
  // customer's address via DoughBox.setDistanceProvider() (the maps service, added later).
  // Until a provider is set, the fee is confirmed by reply. Values (miles, $/mile) come from DoughBox.
  const DB = window.DoughBox;
  const addressInput = document.getElementById('deliveryAddress');
  const instructionsInput = document.getElementById('deliveryInstructions');
  const distanceNote = document.getElementById('deliveryDistance');
  const totalsBox = document.getElementById('orderTotals');
  const perMile = DB.moneyShort(DB.DELIVERY_PER_MILE);

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

  function distanceText() {
    const max = DB.MAX_DELIVERY_MILES;
    const connected = !!DB.distanceProvider;
    const fee = dist.status === 'ok' ? DB.deliveryFee(dist.miles) : null;
    return {
      none: connected
        ? 'Enter your address to see your exact delivery fee.'
        : `Your exact delivery fee (${perMile} per mile) will be confirmed from your address when we reply.`,
      manual: `We'll confirm your exact delivery fee (${perMile} per mile) from this address when we reply.`,
      pending: 'Finding the distance from our kitchen…',
      ok: `${dist.miles} miles from our kitchen · ${DB.money(fee || 0)} delivery ♡`,
      'too-far': `Sorry — that's ${dist.miles} miles away, and we only deliver within ${max} miles of our kitchen.`,
      error: `We couldn't find that address. Please double-check it — or we'll confirm the delivery fee when we reply.`
    }[dist.status];
  }

  function render() {
    const max = DB.MAX_DELIVERY_MILES;
    const fee = dist.status === 'ok' ? DB.deliveryFee(dist.miles) : null;
    if (dist.status === 'too-far') addressInput.setAttribute('aria-invalid', 'true');
    else if (addressInput.getAttribute('aria-invalid') === 'true' && addressInput.value.trim()) addressInput.removeAttribute('aria-invalid');

    distanceNote.className = 'delivery-distance' + (dist.status === 'too-far' || dist.status === 'error' ? ' is-warn' : dist.status === 'ok' ? ' is-ok' : '');
    const text = distanceText();
    if (distanceNote.textContent !== text) distanceNote.textContent = text;   // don't re-announce unchanged text

    const box = DB.validate(DB.items);
    if (!box.cookies) { totalsBox.innerHTML = ''; return; }
    const rows = [`<li><span>Cookie box · ${box.cookies} ${box.cookies === 1 ? 'cookie' : 'cookies'}</span><span>${DB.money(box.subtotal)}</span></li>`];
    if (dist.status === 'ok') rows.push(`<li><span>Delivery · ${dist.miles} mi × ${perMile}</span><span>${DB.money(fee)}</span></li>`);
    else if (dist.status === 'too-far') rows.push(`<li class="ot-warn"><span>Outside our ${max}-mile delivery area</span></li>`);
    else if (dist.status === 'pending') rows.push(`<li><span>Delivery · ${perMile} per mile</span><span>calculating…</span></li>`);
    else rows.push(`<li><span>Delivery · ${perMile} per mile</span><span>to be confirmed</span></li>`);
    rows.push(dist.status === 'ok'
      ? `<li class="ot-total"><span>Total</span><span>${DB.money(box.subtotal + fee)}</span></li>`
      : `<li class="ot-total"><span>Total so far</span><span>${DB.money(box.subtotal)} + delivery</span></li>`);
    totalsBox.innerHTML = `<ul>${rows.join('')}</ul><p>Sales tax is included in our prices.</p>`;
  }
  DB.onChange(render);
  render();

  // ---------- Sending the order ----------
  // No order backend is connected yet. When one is, register it here:
  //   DoughOrders.setSubmitHandler(async (order) => { /* POST to your form service / server */ });
  // The handler should throw if sending fails. Until then, the confirmation says plainly that
  // the request wasn't sent and offers a ready-to-send email instead.
  let submitHandler = null;
  window.DoughOrders = {
    setSubmitHandler(fn) { submitHandler = typeof fn === 'function' ? fn : null; },
    get connected() { return !!submitHandler; }
  };

  const formNote = document.getElementById('formNote');
  const submitBtn = document.getElementById('orderSubmit');
  const confirmBox = document.getElementById('orderConfirm');

  function orderSummaryText(order) {
    const lines = [
      `Name: ${order.name}`,
      `Email: ${order.email}`,
      order.phone ? `Phone: ${order.phone}` : null,
      `Delivery date: ${order.deliveryDate}`,
      `Delivery address: ${order.delivery.address}`,
      order.delivery.instructions ? `Delivery instructions: ${order.delivery.instructions}` : null,
      '',
      `Box of ${order.boxSize}:`,
      ...order.box.map(l => `  ${l.qty} x ${DB.label(l.flavor)} (${DB.money(l.lineTotal)})`),
      `Cookie subtotal: ${DB.money(order.cookiesTotal)} (tax included)`,
      `Delivery: ${order.delivery.fee === null ? `${perMile} per mile, to be confirmed` : `${order.delivery.miles} mi, ${DB.money(order.delivery.fee)}`}`,
      order.total === null ? null : `Total: ${DB.money(order.total)}`,
      order.notes ? `\nNotes & allergies: ${order.notes}` : null
    ];
    return lines.filter(l => l !== null).join('\n');
  }

  function showConfirmation(order, sent) {
    const $ = (id) => document.getElementById(id);
    const first = order.name.split(' ')[0];
    $('confirmTitle').textContent = sent ? `Thank you, ${first} — we got your order request ♡` : `Thank you, ${first} ♡`;
    $('confirmLead').textContent = sent
      ? 'Here’s what you asked for. This is an order request — nothing has been charged, and your order isn’t final until we confirm it.'
      : 'Here’s your order request. Nothing has been charged, and your order isn’t final until we confirm it.';

    const offline = $('confirmOffline');
    offline.hidden = sent;
    const mail = offline.querySelector('a[data-order-mail]');
    if (mail) {
      const base = mail.getAttribute('href').split('?')[0];
      mail.href = `${base}?subject=${encodeURIComponent(`Cookie order request — ${order.name}`)}&body=${encodeURIComponent(orderSummaryText(order))}`;
    }

    const receipt = $('confirmReceipt');
    receipt.innerHTML = '';
    const line = (text, cls) => { const li = document.createElement('li'); li.textContent = text; if (cls) li.className = cls; receipt.append(li); };
    line(`Box of ${order.boxSize} · ${order.totalFlavors} ${order.totalFlavors === 1 ? 'flavor' : 'flavors'}`, 'receipt-head');
    order.box.forEach(l => line(`${l.qty} × ${DB.label(l.flavor)} — ${DB.money(l.lineTotal)}`));
    line(`Cookie subtotal — ${DB.money(order.cookiesTotal)} (tax included)`, 'order-receipt-total');
    line(order.delivery.fee === null
      ? `Delivery — ${perMile} per mile, to be confirmed`
      : `Delivery · ${order.delivery.miles} mi — ${DB.money(order.delivery.fee)}`);
    line(order.total === null
      ? `Total — ${DB.money(order.cookiesTotal)} + delivery`
      : `Total — ${DB.money(order.total)}`, 'order-receipt-total');
    line(`Delivery date: ${new Date(order.deliveryDate + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`, 'order-receipt-note');
    line(`Deliver to: ${order.delivery.address}`, 'order-receipt-note');
    if (order.delivery.instructions) line(`Instructions: ${order.delivery.instructions}`, 'order-receipt-note');

    $('confirmNext').textContent = sent
      ? 'Dough Bunny will reach out to confirm your order, delivery date, and delivery fee.'
      : 'Once we have it, Dough Bunny will reach out to confirm your order, delivery date, and delivery fee.';

    form.hidden = true;
    confirmBox.hidden = false;
    confirmBox.focus();
  }

  document.getElementById('confirmAgain').addEventListener('click', () => {
    confirmBox.hidden = true;
    form.hidden = false;
    formNote.textContent = '';
    form.querySelector('.form-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
    form.elements.name.focus({ preventScroll: true });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.dataset.busy) return;                         // guard against double-submits
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
        ? `Your box is empty — choose a box of ${DB.listSizes()} cookies.`
        : `Boxes come in ${DB.listSizes()} cookies. ${DB.message(box).replace(/\s*♡$/, '')}.`;
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

    form.dataset.busy = '1';
    submitBtn.setAttribute('aria-busy', 'true');
    try {
      // make sure the distance matches the address being submitted
      clearTimeout(debounce);
      const d = await lookupDistance();
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

      let sent = false;
      if (submitHandler) {
        try {
          await submitHandler(order);
          sent = true;
        } catch (err) {
          formNote.classList.add('is-error');
          formNote.textContent = 'Something went wrong sending your order. Please try again in a moment, or email us.';
          return;
        }
      }
      window.lastOrderRequest = order;

      showConfirmation(order, sent);
      form.reset();
      dist = { address: '', status: 'none', miles: null };
      DB.clear();
      render();
    } finally {
      delete form.dataset.busy;
      submitBtn.removeAttribute('aria-busy');
    }
  });

});
