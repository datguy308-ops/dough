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

  // ---------- Scroll reveal ----------
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

  // ---------- Hero parallax on floating cookies ----------
  const hero = document.querySelector('.hero-visual');
  if (hero && !reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    const floaters = hero.querySelectorAll('.float-cookie, .hero-deco');
    hero.closest('.hero').addEventListener('pointermove', (e) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      floaters.forEach((el, i) => {
        const depth = (i % 3 + 1) * 10;
        el.style.translate = `${(x * depth).toFixed(1)}px ${(y * depth).toFixed(1)}px`;
      });
    });
  }

  // ---------- Order form ----------
  const dateInput = document.getElementById('pickupDate');
  if (dateInput) {
    const min = new Date(Date.now() + 2 * 864e5);
    dateInput.min = min.toISOString().slice(0, 10);
  }

  const form = document.getElementById('orderForm');
  const formNote = document.getElementById('formNote');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    formNote.classList.remove('is-error');

    const missing = [...form.querySelectorAll('[required]')].filter(f => !f.value.trim());
    const email = form.elements.email;
    const flavors = [...form.querySelectorAll('input[name="flavors"]:checked')];

    if (missing.length || !email.checkValidity() || !flavors.length) {
      formNote.classList.add('is-error');
      formNote.textContent = !flavors.length && !missing.length
        ? 'Pick at least one flavor so we know what to bake!'
        : 'Please fill in your name, a valid email, and a pickup date.';
      (missing[0] || (!email.checkValidity() && email) || flavors[0] || form.querySelector('.chips input')).focus();
      return;
    }

    // Static site: no backend yet. Hook this up to a form service or email when ready.
    const name = form.elements.name.value.trim().split(' ')[0];
    formNote.textContent = `Thank you, ${name}! We'll be in touch soon to confirm your order ♡`;
    form.reset();
  });

});
