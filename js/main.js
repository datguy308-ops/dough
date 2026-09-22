document.addEventListener('DOMContentLoaded', () => {

  // ---------- Footer year ----------
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---------- Sticky header shadow ----------
  const header = document.getElementById('siteHeader');
  const onScroll = () => {
    if (window.scrollY > 12) header.classList.add('scrolled');
    else header.classList.remove('scrolled');

    const backToTop = document.getElementById('backToTop');
    if (window.scrollY > 500) backToTop.classList.add('show');
    else backToTop.classList.remove('show');
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- Mobile nav toggle ----------
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  navToggle.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
  mainNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // ---------- Back to top ----------
  document.getElementById('backToTop').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ---------- Scroll reveal ----------
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(el => observer.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in-view'));
  }

  // ---------- Menu tabs ----------
  const tabs = document.querySelectorAll('.menu-tab');
  const panels = document.querySelectorAll('.menu-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`.menu-panel[data-panel="${tab.dataset.tab}"]`).classList.add('active');
    });
  });

  // ---------- Contact form (static demo submission) ----------
  const form = document.getElementById('contactForm');
  const formNote = document.getElementById('formNote');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    formNote.textContent = "Thanks! We'll be in touch shortly to confirm your order.";
    form.reset();
  });

});
