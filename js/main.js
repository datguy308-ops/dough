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

  // ---------- Cookie box: "Add a little love" buttons <-> order form ----------
  const form = document.getElementById('orderForm');
  const flavorBoxes = [...form.querySelectorAll('input[name="flavors"]')];
  const addButtons = [...document.querySelectorAll('.add-love')];
  const pill = document.getElementById('boxPill');
  const pillText = document.getElementById('boxPillText');
  const status = document.getElementById('boxStatus');
  const boxFor = (flavor) => flavorBoxes.find(b => b.value === flavor);

  const syncBox = () => {
    const chosen = flavorBoxes.filter(b => b.checked).map(b => b.value);
    addButtons.forEach(btn => {
      const inBox = chosen.includes(btn.dataset.flavor);
      btn.setAttribute('aria-pressed', String(inBox));
      btn.querySelector('.add-label').textContent = inBox ? 'In your box' : 'Add a little love';
    });
    pill.hidden = chosen.length === 0;
    pillText.textContent = `${chosen.length} ${chosen.length === 1 ? 'flavor' : 'flavors'} in your box`;
  };

  addButtons.forEach(btn => btn.addEventListener('click', () => {
    const box = boxFor(btn.dataset.flavor);
    if (!box) return;
    box.checked = !box.checked;
    status.textContent = box.checked
      ? `${box.value} added to your cookie box.`
      : `${box.value} removed from your cookie box.`;
    syncBox();
  }));
  flavorBoxes.forEach(b => b.addEventListener('change', syncBox));

  // hide the pill while the order form itself is on screen
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      pill.classList.toggle('is-away', entry.isIntersecting);
      pill.style.visibility = entry.isIntersecting ? 'hidden' : '';
    }, { threshold: 0.2 }).observe(form);
  }
  syncBox();

  // ---------- Order form ----------
  const dateInput = document.getElementById('pickupDate');
  if (dateInput) {
    const min = new Date(Date.now() + 2 * 864e5);
    dateInput.min = min.toISOString().slice(0, 10);
  }

  const formNote = document.getElementById('formNote');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    formNote.classList.remove('is-error');
    form.querySelectorAll('[aria-invalid]').forEach(f => f.removeAttribute('aria-invalid'));

    const missing = [...form.querySelectorAll('[required]')].filter(f => !f.value.trim());
    const email = form.elements.email;
    const badEmail = !missing.includes(email) && !email.checkValidity();
    const flavors = flavorBoxes.filter(b => b.checked);

    if (missing.length || badEmail || !flavors.length) {
      missing.concat(badEmail ? [email] : []).forEach(f => f.setAttribute('aria-invalid', 'true'));
      formNote.classList.add('is-error');
      formNote.textContent = !flavors.length && !missing.length && !badEmail
        ? 'Pick at least one flavor so we know what to bake!'
        : 'Please fill in your name, a valid email, and a pickup date.';
      (missing[0] || (badEmail && email) || flavorBoxes[0]).focus();
      return;
    }

    // Static site: no backend yet. Hook this up to a form service or email when ready.
    const name = form.elements.name.value.trim().split(' ')[0];
    formNote.textContent = `Thank you, ${name}! We'll be in touch soon to confirm your order ♡`;
    form.reset();
    syncBox();
  });

});
