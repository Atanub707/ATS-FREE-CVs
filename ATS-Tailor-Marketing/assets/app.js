(function () {
  'use strict';

  // Mobile nav
  var toggle = document.querySelector('.nav-toggle');
  var links = document.getElementById('nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // FAQ accordion (one open at a time)
  document.querySelectorAll('.faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      var wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function (i) {
        i.classList.remove('open');
        i.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
      });
      if (!wasOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Auto-rotating carousels (2s per slide, pause on hover, reduced-motion safe)
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-carousel]').forEach(function (c) {
    var slides = c.querySelectorAll('.carousel-slide');
    if (slides.length < 2) return;
    var dotsWrap = c.closest('.tour-shot, .shot-wrap') ? c.closest('.tour-shot, .shot-wrap').querySelector('.carousel-dots') : null;
    if (!dotsWrap) return;
    var dots = [];
    var idx = 0;
    var timer = null;
    slides.forEach(function (s, i) {
      var d = document.createElement('button');
      d.className = 'carousel-dot' + (i === 0 ? ' active' : '');
      d.setAttribute('aria-label', 'Show slide ' + (i + 1));
      d.addEventListener('click', function () { go(i); restart(); });
      dotsWrap.appendChild(d);
      dots.push(d);
    });
    function go(i) {
      slides[idx].classList.remove('active');
      dots[idx].classList.remove('active');
      idx = i;
      slides[idx].classList.add('active');
      dots[idx].classList.add('active');
    }
    function restart() {
      if (timer) clearInterval(timer);
      timer = null;
      if (!reduceMotion) timer = setInterval(function () { go((idx + 1) % slides.length); }, 2000);
    }
    c.addEventListener('mouseenter', function () { if (timer) { clearInterval(timer); timer = null; } });
    c.addEventListener('mouseleave', restart);
    restart();
  });

  // Scroll reveal (disabled under prefers-reduced-motion)
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('revealed'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('revealed'); });
  }
})();
