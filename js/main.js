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
  const dateInput = document.getElementById('pickupDate');
  if (dateInput) {
    const min = new Date(Date.now() + 2 * 864e5);
    dateInput.min = min.toISOString().slice(0, 10);
  }

  // ---------- Delivery ($1 per mile, per order) + live order total ----------
  const DB = window.DoughBox;
  const fulfillment = document.getElementById('fulfillment');
  const deliveryFields = document.getElementById('deliveryFields');
  const addressInput = document.getElementById('deliveryAddress');
  const milesInput = document.getElementById('deliveryMiles');
  const totalsBox = document.getElementById('orderTotals');
  const isDelivery = () => fulfillment.value === 'Local delivery';

  function renderTotals() {
    const delivery = isDelivery();
    deliveryFields.hidden = !delivery;
    addressInput.required = delivery;
    const box = DB.validate(DB.items);
    const t = DB.orderTotal(DB.items, delivery, milesInput.value);
    if (!box.cookies) { totalsBox.innerHTML = ''; return; }
    const rows = [`<li><span>Cookies · box of ${box.cookies}</span><span>${DB.money(t.cookies)}</span></li>`];
    if (delivery) {
      rows.push(t.delivery === null
        ? `<li><span>Delivery · $1 per mile</span><span>we'll confirm</span></li>`
        : `<li><span>Delivery · ${Number(milesInput.value)} mi × $1</span><span>${DB.money(t.delivery)}</span></li>`);
    }
    rows.push(t.total === null
      ? `<li class="ot-total"><span>Total</span><span>${DB.money(t.cookies)} + delivery</span></li>`
      : `<li class="ot-total"><span>Total</span><span>${DB.money(t.total)}</span></li>`);
    totalsBox.innerHTML = `<ul>${rows.join('')}</ul><p>Sales tax is included in our prices.</p>`;
  }
  fulfillment.addEventListener('change', renderTotals);
  milesInput.addEventListener('input', renderTotals);
  DB.onChange(renderTotals);
  renderTotals();

  const formNote = document.getElementById('formNote');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    formNote.classList.remove('is-error');
    form.querySelectorAll('[aria-invalid]').forEach(f => f.removeAttribute('aria-invalid'));

    // Re-validate the box from the saved model at submit time — the disabled
    // button is only a hint, this is the actual check.
    const box = window.DoughBox.validate(window.DoughBox.items);
    const missing = [...form.querySelectorAll('[required]')].filter(f => !f.value.trim());
    const email = form.elements.email;
    const badEmail = !missing.includes(email) && !email.checkValidity();

    if (!box.ok) {
      formNote.classList.add('is-error');
      formNote.textContent = box.cookies === 0
        ? 'Your box is empty — choose a box of 4, 6, or 12 cookies.'
        : `Boxes come in 4, 6, or 12 cookies. ${window.DoughBox.message(box).replace(/\s*♡$/, '')}.`;
      const firstAdd = form.querySelector('.builder-list .step-btn--add');
      firstAdd && firstAdd.focus();
      return;
    }
    if (missing.length || badEmail) {
      missing.concat(badEmail ? [email] : []).forEach(f => f.setAttribute('aria-invalid', 'true'));
      formNote.classList.add('is-error');
      formNote.textContent = missing.includes(addressInput)
        ? 'Please add your delivery address (and fill in any other missing details).'
        : 'Please fill in your name, a valid email, and a pickup date.';
      (missing[0] || email).focus();
      return;
    }
    const delivery = isDelivery();
    if (delivery && milesInput.value.trim() && DB.deliveryFee(milesInput.value) === null) {
      milesInput.setAttribute('aria-invalid', 'true');
      formNote.classList.add('is-error');
      formNote.textContent = 'Please enter the delivery distance as a number of miles, or leave it blank.';
      milesInput.focus();
      return;
    }
    const totals = DB.orderTotal(DB.items, delivery, milesInput.value);

    // The order keeps the exact flavor breakdown, not just a count.
    const order = {
      name: form.elements.name.value.trim(),
      email: email.value.trim(),
      phone: form.elements.phone.value.trim(),
      pickupDate: form.elements.date.value,
      fulfillment: form.elements.fulfillment.value,
      notes: form.elements.message.value.trim(),
      box: box.lines,                 // [{ flavor, qty, price, lineTotal }, ...] (cents)
      boxSize: box.size,              // 4, 6, or 12
      totalCookies: box.cookies,
      totalFlavors: box.flavors,
      cookiesTotal: totals.cookies,   // cents, sales tax included
      delivery: delivery ? {
        address: addressInput.value.trim(),
        miles: DB.deliveryFee(milesInput.value) === null ? null : Number(milesInput.value),
        fee: totals.delivery            // cents; null = distance to be confirmed
      } : null,
      total: totals.total             // cents; null until the delivery distance is confirmed
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
    order.box.forEach(l => {
      const li = document.createElement('li');
      li.textContent = `${l.qty} × ${l.flavor} — ${window.DoughBox.money(l.lineTotal)}`;
      receipt.append(li);
    });
    const tot = document.createElement('li');
    tot.className = 'order-receipt-total';
    tot.textContent = `Box of ${order.boxSize} · ${order.totalFlavors} ${order.totalFlavors === 1 ? 'flavor' : 'flavors'} · ${DB.money(order.cookiesTotal)}`;
    receipt.append(tot);
    if (order.delivery) {
      const d = document.createElement('li');
      d.textContent = order.delivery.fee === null
        ? `Delivery · $1 per mile — we'll confirm the distance`
        : `Delivery · ${order.delivery.miles} mi × $1 — ${DB.money(order.delivery.fee)}`;
      receipt.append(d);
    }
    const grand = document.createElement('li');
    grand.className = 'order-receipt-total';
    grand.textContent = order.total === null
      ? `Total: ${DB.money(order.cookiesTotal)} + delivery (tax included)`
      : `Total: ${DB.money(order.total)} (tax included)`;
    receipt.append(grand);
    formNote.append(thanks, receipt);

    form.reset();
    window.DoughBox.clear();
    renderTotals();
  });

});
