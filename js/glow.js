/* Mariglow Glow System — petals, bloom, section washes, curtain reveals,
   mirror-shine, letter rise, count-ups, magnetic buttons, progress ribbon.
   Motion only: it never moves, hides or resizes layout. */
(function(){
  'use strict';
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  function $(s, c){ return (c||document).querySelector(s); }
  function $$(s, c){ return Array.prototype.slice.call((c||document).querySelectorAll(s)); }

  /* ---------- progress ribbon (rides the site's own scroll scheduler) ---------- */
  var bar = document.createElement('div'); bar.className = 'mg-progress'; document.body.appendChild(bar);
  function progress(){
    var h = document.documentElement;
    var max = h.scrollHeight - innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0) + ')';
  }
  if (window.Scroll && Scroll.add) Scroll.add(progress); else addEventListener('scroll', progress, {passive:true});
  progress();
  if (reduced) return;

  /* ---------- warm bloom following the pointer ---------- */
  if (finePointer){
    var bloom = document.createElement('div'); bloom.className = 'mg-bloom'; document.body.appendChild(bloom);
    var bx = innerWidth/2, by = innerHeight/2, tx = bx, ty = by, bloomLive = false;
    addEventListener('pointermove', function(e){
      tx = e.clientX; ty = e.clientY; bloom.classList.add('on');
      var hot = e.target && e.target.closest && e.target.closest('a,button,.tile,.pg-tile,.t-card,.bin,.chip');
      bloom.classList.toggle('big', !!hot);
    }, {passive:true});
    (function bloomLoop(){
      bx += (tx - bx) * 0.075; by += (ty - by) * 0.075;
      bloom.style.transform = 'translate(' + bx + 'px,' + by + 'px)';
      requestAnimationFrame(bloomLoop);
    })();
  }

  /* ---------- section-to-section washes ---------- */
  var wash = document.createElement('div'); wash.className = 'mg-wash'; document.body.appendChild(wash);
  var TINTS = ['201,79,124', '232,147,12', '23,80,63', '232,160,180'];
  var tintIdx = 0, lastSection = null;
  var washIO = new IntersectionObserver(function(es){
    es.forEach(function(en){
      if (en.isIntersecting && en.target !== lastSection){
        lastSection = en.target;
        var rgb = TINTS[tintIdx++ % TINTS.length];
        wash.style.background = 'radial-gradient(ellipse 90% 60% at 50% 115%, rgba(' + rgb + ',.55), rgba(' + rgb + ',0) 70%)';
        wash.animate([{opacity:0},{opacity:.17, offset:.35},{opacity:0}], {duration:1100, easing:'ease-out'});
      }
    });
  }, {rootMargin:'-42% 0px -42% 0px'});
  $$('main > section, .view > section, footer.site-footer').forEach(function(s){ washIO.observe(s); });

  /* ---------- hero petal drift ---------- */
  var hero = $('.hero');
  if (hero){
    var cv = document.createElement('canvas'); cv.id = 'mg-petals'; hero.appendChild(cv);
    var ctx = cv.getContext('2d'), W = 0, H = 0, petals = [], heroVisible = true, t0 = performance.now();
    var PCOLORS = ['232,147,12', '201,79,124', '253,243,238', '232,160,180'];
    function sizeCanvas(){
      var r = hero.getBoundingClientRect(); W = cv.width = Math.max(300, r.width); H = cv.height = Math.max(300, r.height);
      var n = Math.round(Math.min(26, Math.max(10, W / 60)));
      petals = [];
      for (var i = 0; i < n; i++) petals.push({
        x: Math.random()*W, y: Math.random()*H, s: 5 + Math.random()*8,
        vy: .22 + Math.random()*.4, ph: Math.random()*6.28, sw: .4 + Math.random()*.9,
        rot: Math.random()*6.28, vr: (Math.random()-.5)*.01, c: PCOLORS[i % PCOLORS.length], a: .35 + Math.random()*.4
      });
    }
    sizeCanvas(); addEventListener('resize', sizeCanvas);
    new IntersectionObserver(function(es){ heroVisible = es[0].isIntersecting; }, {threshold: 0}).observe(hero);
    (function petalLoop(now){
      requestAnimationFrame(petalLoop);
      if (!heroVisible || document.hidden) return;
      var t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      petals.forEach(function(p){
        p.y += p.vy; p.x += Math.sin(t * p.sw + p.ph) * .45; p.rot += p.vr;
        if (p.y > H + 16){ p.y = -16; p.x = Math.random()*W; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + Math.sin(t*p.sw + p.ph)*.5);
        ctx.fillStyle = 'rgba(' + p.c + ',' + p.a + ')';
        ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * .45, 0, 0, 6.29); ctx.fill(); ctx.restore();
      });
    })(t0);
  }

  /* ---------- hero title letter rise ---------- */
  var h1span = $('.hero-h1 > span');
  if (h1span && h1span.children.length === 0){
    var text = h1span.textContent; h1span.textContent = '';
    text.split('').forEach(function(ch, i){
      var mask = document.createElement('span'); mask.className = 'mg-lmask';
      var l = document.createElement('span'); l.className = 'mg-l'; l.textContent = ch;
      l.style.transitionDelay = (i * 55) + 'ms';
      mask.appendChild(l); h1span.appendChild(mask);
    });
    setTimeout(function(){ $$('.mg-l', h1span).forEach(function(l){ l.classList.add('in'); }); }, 1500);
  }

  /* ---------- image curtain reveals ---------- */
  var cio = new IntersectionObserver(function(es){
    es.forEach(function(en){ if (en.isIntersecting){ en.target.classList.add('in'); cio.unobserve(en.target); } });
  }, {rootMargin:'0px 0px -8% 0px'});
  $$('.cs-cols img, .cs-hero-mock img, .cs-hero-mock video, .polaroid img').forEach(function(im){
    im.classList.add('mg-curtain'); cio.observe(im);
  });

  /* ---------- mirror-shine glare tracking ---------- */
  if (finePointer){
    $$('.tile, .pg-tile, .fact-card, .t-card').forEach(function(card){
      card.addEventListener('pointermove', function(e){
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      }, {passive:true});
    });
    /* ---------- magnetic buttons ---------- */
    $$('.nav-cta, .cs-closing .cta').forEach(function(btn){
      btn.classList.add('mg-mag');
      btn.addEventListener('pointermove', function(e){
        var r = btn.getBoundingClientRect();
        btn.classList.add('live');
        btn.style.transform = 'translate(' + ((e.clientX - r.left)/r.width - .5) * 7 + 'px,' + ((e.clientY - r.top)/r.height - .5) * 5 + 'px)';
      });
      btn.addEventListener('pointerleave', function(){ btn.classList.remove('live'); btn.style.transform = ''; });
    });
  }

  /* ---------- count-ups ---------- */
  var nio = new IntersectionObserver(function(es){
    es.forEach(function(en){
      if (!en.isIntersecting) return;
      nio.unobserve(en.target);
      var el = en.target, raw = el.textContent.trim(), pct = /%$/.test(raw), n = parseInt(raw, 10);
      if (isNaN(n) || n <= 0 || n > 1900) return;
      var start = null;
      (function tick(now){
        if (!start) start = now;
        var p = Math.min(1, (now - start) / 950), e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(n * e) + (pct ? '%' : '');
        if (p < 1) requestAnimationFrame(tick);
      })(performance.now());
    });
  }, {threshold:.5});
  $$('.cs-stat b').forEach(function(b){ nio.observe(b); });
})();
