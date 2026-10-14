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
    // earliest date = today (same-day orders only if available — we confirm), in local time
    const min = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    dateInput.min = `${min.getFullYear()}-${pad(min.getMonth() + 1)}-${pad(min.getDate())}`;
  }

  // ---------- Delivery + order summary ----------
  // Every order is delivered; there is no pickup option. The site never works out a distance or a
  // delivery fee: the owner checks the address, picks the flat rate (DoughBox.DELIVERY_RATES), and
  // confirms the fee and full total before sending the Square payment link. So the summary shows the
  // cookie subtotal only, with delivery "to be confirmed".
  const DB = window.DoughBox;
  const addressInput = document.getElementById('deliveryAddress');
  const instructionsInput = document.getElementById('deliveryInstructions');
  const totalsBox = document.getElementById('orderTotals');
  // enough of an address to check the driving distance by hand: needs a 5-digit ZIP code
  const hasZip = (address) => /\b\d{5}(?:-\d{4})?\b/.test(address);

  function render() {
    const box = DB.validate(DB.items);
    if (!box.cookies) { totalsBox.innerHTML = ''; return; }
    totalsBox.innerHTML = `<ul>
      <li><span>Cookie subtotal · ${box.cookies} ${box.cookies === 1 ? 'cookie' : 'cookies'}</span><span>${DB.money(box.subtotal)}</span></li>
      <li><span>Delivery fee</span><span>To be confirmed</span></li>
      <li class="ot-total"><span>Cookie subtotal (delivery not included)</span><span>${DB.money(box.subtotal)}</span></li>
    </ul><p>We'll confirm your delivery fee and full order total before payment ♡</p><p>Cookie prices include any applicable sales tax.</p>`;
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
      `Delivery date: ${order.deliveryDate} (${order.deliveryWindow})`,
      `Delivery address: ${order.delivery.address}`,
      order.delivery.instructions ? `Delivery instructions: ${order.delivery.instructions}` : null,
      '',
      `Box of ${order.boxSize}:`,
      ...order.box.map(l => `  ${l.qty} x ${DB.label(l.flavor)} (${DB.money(l.lineTotal)})`),
      `Cookie subtotal: ${DB.money(order.cookiesTotal)} (tax included; delivery not included)`,
      `Status: ${order.status}`,
      `Allergens in this box: contains ${order.allergens.join(', ')}. Cross-contact with other major allergens may occur.`
        + (order.allergensPending.length ? ` Allergen details still to be confirmed for: ${order.allergensPending.join(', ')}.` : ''),
      `Promotional emails/texts: ${order.marketing.optIn ? 'yes, opted in' : 'no'}`,
      order.notes ? `\nNotes & allergies: ${order.notes}` : null
    ];
    return lines.filter(l => l !== null).join('\n');
  }

  function showConfirmation(order, sent) {
    const $ = (id) => document.getElementById(id);
    const first = order.name.split(' ')[0];
    $('confirmTitle').textContent = sent ? `Thank you, ${first} — we got your order request ♡` : `Thank you, ${first} ♡`;
    $('confirmLead').textContent = sent
      ? 'Here’s what you asked for. This is an order request — nothing has been charged, and your order isn’t final until we confirm it. When we confirm, we’ll send you a Square payment link for the full amount.'
      : 'Here’s your order request. Nothing has been charged, and your order isn’t final until we confirm it. When we confirm, we’ll send you a Square payment link for the full amount.';

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
    line(`Cookie subtotal (delivery not included) — ${DB.money(order.cookiesTotal)} (includes any applicable sales tax)`, 'order-receipt-total');
    line('Delivery fee — to be confirmed');
    line(`Delivery: ${new Date(order.deliveryDate + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · preferred ${order.deliveryWindow.toLowerCase()}`, 'order-receipt-note');
    line(`Deliver to: ${order.delivery.address}`, 'order-receipt-note');
    if (order.delivery.instructions) line(`Instructions: ${order.delivery.instructions}`, 'order-receipt-note');
    line(`Allergens: contains ${order.allergens.join(', ').toLowerCase()}; cross-contact with other major allergens may occur.`
      + (order.allergensPending.length ? ` Allergen details for ${order.allergensPending.join(', ')} are coming soon — we'll go over them with you.` : ''), 'order-receipt-note');

    $('confirmNext').textContent = sent
      ? 'Dough Bunny will check your address and reach out to confirm your delivery fee, full order total, and delivery time — then send your Square payment link.'
      : 'Once we have it, Dough Bunny will check your address and reach out to confirm your delivery fee, full order total, and delivery time — then send your Square payment link.';

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
    const missing = [...form.querySelectorAll('[required]')].filter(f => (f.type === 'checkbox' ? !f.checked : !f.value.trim()));
    const agree = document.getElementById('agreePolicies');
    const email = form.elements.email;
    const badEmail = !missing.includes(email) && !email.checkValidity();
    const badAddress = !missing.includes(addressInput) && !hasZip(addressInput.value);

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
        : missing.length === 1 && missing[0] === agree
          ? 'Please confirm you\'ve read the order policies and allergen information.'
          : 'Please fill in your name, a valid email, a delivery date, and a preferred delivery time.';
      (missing[0] || email).focus();
      return;
    }
    if (badAddress) {
      addressInput.setAttribute('aria-invalid', 'true');
      formNote.classList.add('is-error');
      formNote.textContent = 'Please include your full delivery address — street, city, state, and ZIP code — so we can confirm your delivery fee.';
      addressInput.focus();
      return;
    }

    form.dataset.busy = '1';
    submitBtn.setAttribute('aria-busy', 'true');
    try {
      // The order keeps the exact flavor breakdown, not just a count.
      const order = {
        name: form.elements.name.value.trim(),
        email: email.value.trim(),
        phone: form.elements.phone.value.trim(),
        deliveryDate: form.elements.date.value,
        deliveryWindow: form.elements.deliveryWindow.value,
        notes: form.elements.message.value.trim(),
        box: box.lines,                 // [{ flavor, qty, price, lineTotal }, ...] (cents)
        boxSize: box.size,              // 4, 6, or 12
        totalCookies: box.cookies,
        totalFlavors: box.flavors,
        cookiesTotal: box.subtotal,     // cents, sales tax included
        allergens: DB.allergensIn(box.lines.map(l => l.flavor)),
        allergensPending: DB.allergensPending(box.lines.map(l => l.flavor)),
        agreedToPolicies: agree.checked,
        // optional, separate marketing consent — never required to order
        marketing: {
          optIn: form.elements.marketing.checked,
          consentText: form.elements.marketing.checked ? document.getElementById('marketingText').textContent.trim() : null,
          at: form.elements.marketing.checked ? new Date().toISOString() : null
        },
        delivery: {
          address: addressInput.value.trim(),
          instructions: instructionsInput.value.trim(),
          fee: null                        // set by the owner after checking the driving distance
        },
        status: DB.DELIVERY_PENDING        // "Delivery fee pending confirmation"
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
      DB.clear();
      render();
    } finally {
      delete form.dataset.busy;
      submitBtn.removeAttribute('aria-busy');
    }
  });

});
