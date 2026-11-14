/* SS Printer Services — own-code site engine. Mechanics per forensic SPEC; no reference code reused. */
(function(){'use strict';
var $=function(s,c){return (c||document).querySelector(s)};
var $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};
var reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
/* CS static gate — decided once at load (SPEC §3.5): deck bails at <=820px or reduced motion */
var CS_STATIC=(innerWidth<=820)||reduced;
if(CS_STATIC) document.documentElement.classList.add('cs-static');
function fmt(t){if(!isFinite(t))t=0;t=Math.max(0,Math.round(t));return Math.floor(t/60)+':'+('0'+(t%60)).slice(-2)}

/* ---------------- Loader (SPEC §1.3: cold min 1200 / cap 8000; heavy 500/1500) ---------------- */
var LOADER_LINES=['Warming up the print heads…','Checking toner levels…','Aligning the bench…','Loading paper, A4…','Testing page one…','Since 2001, still printing…','Calibrating colours…','Clearing paper jams…','Sharpening the diagnosis…','Ready when you are…'];
var loaderEl=$('#page-loader'),lineEl=$('#pl-line'),lineIdx=0,loaderDone=false;
document.documentElement.classList.add('pl-lock');
var lineTimer=setInterval(function(){ if(!lineEl)return; lineEl.style.opacity=0; setTimeout(function(){ lineIdx=(lineIdx+1)%LOADER_LINES.length; lineEl.textContent=LOADER_LINES[lineIdx]; lineEl.style.opacity=.66; },300); },1600);
function hideLoader(){ if(loaderDone)return; loaderDone=true; clearInterval(lineTimer); loaderEl.classList.add('is-hiding'); document.documentElement.classList.remove('pl-lock'); setTimeout(function(){ loaderEl.style.display='none'; },420); }
function showLoader(ready,min,cap){
  return new Promise(function(res){
    var t0=performance.now(),done=false;
    function fin(){ if(done)return; done=true; res(); }
    Promise.race([ready,new Promise(function(r){setTimeout(r,cap)})]).then(function(){
      var wait=Math.max(0,min-(performance.now()-t0)); setTimeout(fin,wait);
    });
    setTimeout(fin,cap+50);
  });
}
function heroReady(){
  var imgs=$$('.hero img').map(function(im){ return im.decode? im.decode().catch(function(){}):Promise.resolve(); });
  return Promise.all([document.fonts?document.fonts.ready:Promise.resolve()].concat(imgs));
}
function viewReady(view){
  var imgs=$$( 'img',view).slice(0,6).map(function(im){ return im.decode? im.decode().catch(function(){}):Promise.resolve(); });
  return Promise.all(imgs);
}

/* ---------------- Router + curtain (SPEC §1.2: 550 / 350 / 900) ---------------- */
var TITLES={home:'SS Printer Services — Printer Repair & Cartridge Refilling, Hyderabad',about:'About — SS Printer Services, Hyderabad since 2001',playground:'Services — SS Printer Services',repair:'Repair — SS Printer Services',refilling:'Refilling — SS Printer Services',onsite:'On-Site & AMC — SS Printer Services',spares:'Spares & Consumables — SS Printer Services'};
var VIEWS=['home','about','playground','repair','refilling','onsite','spares'];
var CURTAIN_ROUTES={home:1,about:1,playground:1};
var current='home';
function viewEl(name){ return name==='home'? $('#home-view') : document.getElementById(name+'-view'); }
function applyRoute(name,skipScroll){
  current=name;
  VIEWS.forEach(function(v){ var el=viewEl(v); if(el) el.hidden = (v!==name); });
  document.body.className=document.body.className.replace(/\broute-\w+/g,'').trim();
  document.body.classList.add('route-'+name);
  if(document.body.classList.contains('night-keep')){}
  document.title=TITLES[name]||TITLES.home;
  if(!skipScroll) window.scrollTo({top:0,behavior:'instant'});
  $('#nav').classList.remove('menu-open');
  buildPager(name);
  initDeck(name);
  Scroll.kick();
}
var curtainBusy=false;
function goRoute(name){
  if(name===current||curtainBusy) return;
  var useCurtain = CURTAIN_ROUTES[name]&&CURTAIN_ROUTES[current]&&!reduced;
  if(!useCurtain){ applyRoute(name); return; }
  curtainBusy=true;
  var cur=$('#route-curtain'); cur.classList.add('is-active'); cur.classList.remove('is-opening'); cur.classList.add('is-closing');
  var target=viewEl(name);
  if(target) viewReady(target); /* head-start decode, not awaited (SPEC §1.2) */
  setTimeout(function(){ /* T_CLOSE 550 */
    applyRoute(name);
    setTimeout(function(){ /* T_HOLD 350 */
      cur.classList.remove('is-closing'); cur.classList.add('is-opening');
      setTimeout(function(){ cur.classList.remove('is-active','is-opening'); curtainBusy=false; },980); /* T_OPEN 900 + 80 settle */
    },350);
  },550);
}
document.addEventListener('click',function(e){
  var a=e.target.closest('[data-route]');
  if(a){ e.preventDefault(); goRoute(a.getAttribute('data-route')); }
  var t=e.target.closest('[data-goto]');
  if(t){ goRoute(t.getAttribute('data-goto')); }
});
$$('[data-goto]').forEach(function(t){ t.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); goRoute(t.getAttribute('data-goto')); } }); });
addEventListener('popstate',function(){ applyRoute(route.token()); });

/* ---------------- Theme (SPEC §1.7) ---------------- */
var themeBtn=$('#theme-toggle');
function setNight(n){ document.body.classList.toggle('night',n); try{localStorage.setItem('theme',n?'night':'day')}catch(e){} }
if(document.body.classList.contains('night')){} else { try{ if(localStorage.getItem('theme')==='night') setNight(true); }catch(e){} }
themeBtn.addEventListener('click',function(){
  var n=!document.body.classList.contains('night');
  if(document.startViewTransition){ document.startViewTransition(function(){ setNight(n); }); }
  else { document.body.classList.add('theme-fading'); setNight(n); setTimeout(function(){document.body.classList.remove('theme-fading')},500); }
});

/* ---------------- Nav ---------------- */
var nav=$('#nav'),pill=$('#nav-pill');
Scroll.add(function(y){ pill.classList.toggle('compact',y>innerHeight*0.7); });
$('#burger').addEventListener('click',function(){ nav.classList.toggle('menu-open'); });
$$('#nav .mobile-menu a').forEach(function(a){ a.addEventListener('click',function(){ nav.classList.remove('menu-open'); }); });

/* ---------------- Recorder / audio (SPEC §3.1) ---------------- */
var audio=$('#audio'),rec=$('#recorder'),playBtn=$('#rec-play'),fill=$('#rec-fill'),knob=$('#rec-knob'),
    curEl=$('#rec-cur'),totEl=$('#rec-total'),slider=$('#rec-slider'),wave=$('#wave-btn'),scrubbing=false;
audio.addEventListener('loadedmetadata',function(){ totEl.textContent=fmt(audio.duration); }); /* placeholder 2:00 replaced here */
function paintRec(){
  if(!audio.duration) return; var p=audio.currentTime/audio.duration;
  fill.style.width=(p*100)+'%'; knob.style.left=(p*100)+'%'; curEl.textContent=fmt(audio.currentTime);
}
audio.addEventListener('timeupdate',function(){ if(!scrubbing) paintRec(); });
audio.addEventListener('play',function(){ rec.classList.add('playing'); wave.classList.add('playing'); });
audio.addEventListener('pause',function(){ rec.classList.remove('playing'); wave.classList.remove('playing'); });
audio.addEventListener('ended',function(){ rec.classList.remove('playing'); wave.classList.remove('playing'); paintRec(); });
function toggleAudio(){ if(audio.paused) audio.play().catch(function(){}); else audio.pause(); }
playBtn.addEventListener('click',function(e){ e.stopPropagation(); toggleAudio(); });
wave.addEventListener('click',toggleAudio);
rec.addEventListener('click',function(e){ if(e.target.closest('#rec-slider'))return; toggleAudio(); });
function scrubTo(clientX){
  var r=slider.getBoundingClientRect(); var p=Math.min(1,Math.max(0,(clientX-r.left)/r.width));
  if(audio.duration) audio.currentTime=p*audio.duration; paintRec();
}
slider.addEventListener('pointerdown',function(e){ scrubbing=true; rec.classList.add('scrubbing'); slider.setPointerCapture(e.pointerId); scrubTo(e.clientX); e.stopPropagation(); });
slider.addEventListener('pointermove',function(e){ if(scrubbing) scrubTo(e.clientX); });
slider.addEventListener('pointerup',function(){ scrubbing=false; rec.classList.remove('scrubbing'); });

/* ---------------- Hero: word roll + scroll scale (SPEC §3.1) ---------------- */
var track=$('#roll-track'),rollIdx=0;
if(track&&!reduced){ setInterval(function(){ rollIdx++; track.style.transform='translateY(-'+(rollIdx*1.2)+'em)'; if(rollIdx===4){ setTimeout(function(){ track.style.transition='none'; rollIdx=0; track.style.transform='translateY(0)'; requestAnimationFrame(function(){ requestAnimationFrame(function(){ track.style.transition=''; }); }); },620); } },1460); /* HOLD 900 + roll 560 */ }
var heroContent=$('#hero-content');
Scroll.add(function(y,vh,vw){
  if(current!=='home'||!heroContent) return;
  var p=Math.min(1,Math.max(0,y/(0.8*vh))); var e=1-Math.pow(1-p,3);
  var fit=1; if(vw>=641&&vw<=1100) fit=Math.min(1,Math.max(0.6,(vw-96)/911));
  heroContent.style.transform='scale('+(fit*(1-0.12*e))+')';
});

/* ---------------- Reveals (SPEC §1.7) ---------------- */
var io=new IntersectionObserver(function(es){ es.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } }); },{rootMargin:'0px 0px -10% 0px'});
$$('.reveal').forEach(function(el){ io.observe(el); });

/* Intro line-by-line reveal (SPEC §3.1) */
(function(){
  var box=$('#intro-copy'); if(!box) return;
  $$('p',box).forEach(function(p){
    var words=p.textContent.trim().split(/\s+/); p.textContent='';
    var spans=words.map(function(w){ var s=document.createElement('span'); s.textContent=w+' '; p.appendChild(s); return s; });
    var tops=spans.map(function(s){ return s.offsetTop; }); /* measure all before regrouping */
    p.textContent='';
    var lineEl=null,lastTop=null;
    spans.forEach(function(s,i){
      if(lastTop===null||Math.abs(tops[i]-lastTop)>4){ lineEl=document.createElement('span'); lineEl.className='line'; p.appendChild(lineEl); lastTop=tops[i]; }
      lineEl.appendChild(s);
    });
    p._lines=$$('.line',p);
  });
  Scroll.add(function(){
    if(current!=='home')return;
    $$('p',box).forEach(function(p){
      if(!p._lines)return; var r=p.getBoundingClientRect(); var prog=Math.min(1,Math.max(0,(innerHeight-r.top)/(innerHeight*0.9)));
      p._lines.forEach(function(l,i){ l.classList.toggle('lit',prog>(i+0.4)/p._lines.length); });
    });
  });
})();

/* Tile row scrub + video gating (SPEC §3.1) */
$$('[data-tile-row]').forEach(function(row){
  Scroll.add(function(){
    if(current!=='home')return; var r=row.getBoundingClientRect();
    var p=Math.min(1,Math.max(0,(innerHeight-r.top)/(innerHeight*0.75)));
    row.style.setProperty('--reveal',p.toFixed(3));
    $$('.tile',row).forEach(function(t){ t.style.setProperty('--reveal',p.toFixed(3)); });
  });
});
var vio=new IntersectionObserver(function(es){ es.forEach(function(en){
  var v=en.target;
  if(en.isIntersecting){ if(!v.src&&v.dataset.src){ v.src=v.dataset.src; } v.play&&v.play().catch(function(){}); }
  else if(v.pause) v.pause();
}); },{threshold:0.2});
$$('video[data-src]').forEach(function(v){ vio.observe(v); });

/* Marquee: duplicate set for the loop (SPEC §3.1) */
(function(){ var mt=$('#marquee-track'); if(mt) mt.innerHTML+=mt.innerHTML; })();

/* Testimonial fan scrub (SPEC §3.1: SCRUB 460px, spread × 462px) */
(function(){
  var cards=$$('#t-cards .t-card'); if(!cards.length)return;
  cards.forEach(function(c,i){ c.style.zIndex=10-Math.abs(i-1); });
  Scroll.add(function(y,vh){
    if(current!=='home')return;
    if(innerWidth<=1100){ cards.forEach(function(c){ c.style.transform=''; }); return; }
    var sec=$('#testimonials'); var r=sec.getBoundingClientRect();
    var start=vh*0.2; var p=Math.min(1,Math.max(0,(start-r.top)/460));
    cards.forEach(function(c,i){ var pos=i-1; c.style.transform='translateX('+(pos*p*462)+'px) rotate('+(pos*p*4)+'deg)'; });
  });
})();

/* ---------------- About polaroids (SPEC §3.2) ---------------- */
(function(){
  var stage=$('#ai-photos'); if(!stage)return; var reset=$('#pol-reset'),moved=false;
  $$('.polaroid',stage).forEach(function(pol){
    var sx=0,sy=0,ox=0,oy=0,drag=false;
    pol.addEventListener('pointerdown',function(e){ drag=true; sx=e.clientX; sy=e.clientY; var m=/translate\(([-\d.]+)px,([-\d.]+)px\)/.exec(pol.style.transform||''); ox=m?parseFloat(m[1]):0; oy=m?parseFloat(m[2]):0; pol.setPointerCapture(e.pointerId); pol.style.transition='none'; pol.style.zIndex=9; });
    pol.addEventListener('pointermove',function(e){ if(!drag)return; var rot=/rotate\(([-\d.]+)deg\)/.exec(pol.className==='polaroid pol-1'?'rotate(-2.06deg)':'') ; pol.style.transform='translate('+(ox+e.clientX-sx)+'px,'+(oy+e.clientY-sy)+'px)'; moved=true; reset.classList.add('show'); });
    pol.addEventListener('pointerup',function(){ drag=false; pol.style.transition='transform .5s cubic-bezier(0.34,1.56,0.64,1)'; });
  });
  reset.addEventListener('click',function(){ $$('.polaroid',stage).forEach(function(p){ p.style.transition='transform .72s cubic-bezier(0.22,1,0.36,1)'; p.style.transform=''; }); reset.classList.remove('show'); moved=false; });
})();

/* ---------------- Playground coverflow (SPEC §4.1 — exact ring maths) ---------------- */
var SERVICES=[
 {t:'Laser & Inkjet Repair',tag:'Repair · Since 2001',img:'assets/workbench-2.webp',d:'Paper jams, dead boards, faded prints — laser and inkjet printers diagnosed and repaired at the KPHB bench.'},
 {t:'On-Site Repair',tag:'Service · 35+ Areas',video:'assets/service-centre.mp4',poster:'assets/service-centre-poster.jpg',d:'The bench comes to you: doorstep repair for homes and offices, with door pickup and delivery in Hyderabad.'},
 {t:'Cartridge Refilling',tag:'Refilling · 5-Step Process',img:'assets/toner-collection.webp',d:'Ink and toner cartridges disassembled, cleaned, refilled and print-tested — never a bare top-up.'},
 {t:'Installation & Setup',tag:'Setup · Homes & Offices',img:'assets/printer-collection.webp',d:'New printer unboxed, networked and printing from every desk — setup ends with a test page, not a shrug.'},
 {t:'Maintenance & AMC',tag:'Support · Offices',img:'assets/workbench-4.webp',d:'Scheduled maintenance and annual support for offices that print every day and cannot afford a silent machine.'},
 {t:'Genuine Spare Parts',tag:'Spares · Genuine',img:'assets/product-3.webp',d:'Genuine parts matched to your exact brand and model — supplied at the counter or fitted by the bench.'},
 {t:'Plotter Repair',tag:'Repair · Large Format',img:'assets/workbench-1.webp',d:'Large-format plotters repaired on-site where they stand — the machines that do not travel come to us last.'},
 {t:'Printer Sales',tag:'Sales · Enquiry Only',img:'assets/storefront.webp',d:'Printers sold with honest advice from the people who will service them — enquire at the counter, no listed prices.'}
];
var N=SERVICES.length,active=0,trackEl=$('#pgf-track'),capEl=$('#pgf-cap'),wheelLock=0;
function mod(i,n){ return ((i%n)+n)%n; }
function buildCards(){
  if(!trackEl||trackEl.children.length) return;
  SERVICES.forEach(function(s,i){
    var card=document.createElement('div'); card.className='pgf-card'; card.tabIndex=0; card.setAttribute('role','button');
    card.setAttribute('aria-label',s.t);
    if(s.video){ var v=document.createElement('video'); v.muted=true; v.loop=true; v.playsInline=true; v.preload='none'; if(s.poster)v.poster=s.poster; var src=document.createElement('source'); src.dataset.src=s.video; v.appendChild(src); card.appendChild(v); }
    else { var im=document.createElement('img'); im.src=s.img; im.alt=s.t; card.appendChild(im); }
    var open=document.createElement('span'); open.className='pgf-open'; open.textContent='⤢ Open'; card.appendChild(open);
    card.addEventListener('click',function(){ if(dragMoved)return; if(i===active) openLightbox(active); else go(i); });
    card.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); if(i===active) openLightbox(active); else go(i); } });
    trackEl.appendChild(card);
  });
}
function layout(){
  if(!trackEl) return;
  var isMobile=innerWidth<620, spread=isMobile?60:54, depth=isMobile?250:300, rot=isMobile?32:38, visible=isMobile?1:2;
  $$('.pgf-card',trackEl).forEach(function(card,i){
    var off=i-active; if(off>N/2)off-=N; if(off<-N/2)off+=N;
    var v=card.querySelector('video');
    if(Math.abs(off)>visible){
      var dir=off>0?1:-1;
      card.style.opacity='0'; card.style.pointerEvents='none';
      card.style.transform='translate3d('+(dir*spread*(visible+1))+'%,0,'+(-depth*(visible+1))+'px) rotateY('+(-dir*rot)+'deg) scale(.5)';
      card.classList.remove('is-active'); if(v)v.pause();
    } else {
      var scale=1-Math.abs(off)*(isMobile?0.16:0.14);
      card.style.opacity= off===0?'1':(Math.abs(off)===1?'0.55':'0.22');
      card.style.pointerEvents='auto'; card.style.zIndex=100-Math.abs(off);
      card.style.transform='translate3d('+(off*spread)+'%,0,'+(-Math.abs(off)*depth)+'px) rotateY('+(-off*rot)+'deg) scale('+scale+')';
      card.classList.toggle('is-active',off===0);
      if(v){ if(off===0&&current==='playground'){ var src=v.querySelector('source'); if(src&&!src.src&&src.dataset.src){ src.src=src.dataset.src; v.load(); } v.play().catch(function(){}); } else v.pause(); }
    }
  });
  var s=SERVICES[active];
  capEl.classList.add('swap');
  setTimeout(function(){
    $('#cap-idx').textContent=('0'+(active+1)).slice(-2)+' / '+('0'+N).slice(-2);
    $('#cap-title').textContent=s.t; $('#cap-tags').textContent=s.tag; $('#cap-desc').textContent=s.d;
    capEl.classList.remove('swap');
  },180);
}
function go(i){ active=mod(i,N); layout(); }
buildCards();
$('#pgf-prev').addEventListener('click',function(){ go(active-1); });
$('#pgf-next').addEventListener('click',function(){ go(active+1); });
/* drag: 50px = 1 step, axis-locked at 8px (SPEC §4.1) */
var dragMoved=false,dragging=false,startX=0,startY=0,axis=null;
var stage=$('#pgf-stage');
stage.addEventListener('pointerdown',function(e){ dragging=true; dragMoved=false; startX=e.clientX; startY=e.clientY; axis=null; });
stage.addEventListener('pointermove',function(e){
  if(!dragging)return;
  var dx=e.clientX-startX, dy=e.clientY-startY;
  if(!axis&&Math.hypot(dx,dy)>8) axis=Math.abs(dx)>Math.abs(dy)?'x':'y';
  if(axis==='x'&&Math.abs(dx)>=50){ go(active+(dx<0?1:-1)); startX=e.clientX; dragMoved=true; }
});
addEventListener('pointerup',function(){ dragging=false; if(dragMoved) setTimeout(function(){ dragMoved=false; },50); });
stage.addEventListener('wheel',function(e){
  if(current!=='playground')return; e.preventDefault();
  var now=performance.now(); if(now-wheelLock<420)return; wheelLock=now;
  var d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY; if(d!==0) go(active+(d>0?1:-1));
},{passive:false});
addEventListener('keydown',function(e){
  if(current!=='playground')return;
  if(lbOpen){ if(e.key==='Escape')closeLightbox(); if(e.key==='ArrowRight')lbGo(active+1); if(e.key==='ArrowLeft')lbGo(active-1); return; }
  if(e.key==='ArrowRight')go(active+1); if(e.key==='ArrowLeft')go(active-1);
});
var rsz; addEventListener('resize',function(){ clearTimeout(rsz); rsz=setTimeout(layout,120); });

/* Brick grid (SPEC §4.3 geometry) */
(function(){
  var grid=$('#pg-grid'); if(!grid)return;
  SERVICES.forEach(function(s,i){
    var t=document.createElement('article'); t.className='pg-tile'; t.tabIndex=0;
    var im=document.createElement('img'); im.src=s.poster||s.img; im.alt=s.t; t.appendChild(im);
    var ov=document.createElement('div'); ov.className='pg-overlay';
    ov.innerHTML=''; var h=document.createElement('h3'); h.textContent=s.t; var p=document.createElement('p'); p.textContent=s.tag;
    ov.appendChild(h); ov.appendChild(p); t.appendChild(ov);
    t.addEventListener('click',function(){ go(i); openLightbox(i); });
    grid.appendChild(t);
  });
  Scroll.add(function(){
    if(current!=='playground')return;
    $$('.pg-tile',grid).forEach(function(t){ var r=t.getBoundingClientRect(); var p=Math.min(1,Math.max(0,(innerHeight-r.top)/(innerHeight*0.8))); t.style.setProperty('--reveal',p.toFixed(3)); });
  });
})();

/* Lightbox (SPEC §4.2) */
var lb=$('#pgf-lightbox'),lbOpen=false;
function fillLb(i){
  var s=SERVICES[i],stageEl=$('#lb-stage'); stageEl.innerHTML='';
  if(s.video){ var v=document.createElement('video'); v.src=s.video; v.loop=true; v.autoplay=true; if(innerWidth<=620){ v.muted=true; v.playsInline=true; } else { v.controls=true; } stageEl.appendChild(v); }
  else { var im=document.createElement('img'); im.src=s.img; im.alt=s.t; stageEl.appendChild(im); }
  $('#lb-idx').textContent=('0'+(i+1)).slice(-2)+' / '+('0'+N).slice(-2);
  $('#lb-title').textContent=s.t; $('#lb-desc').textContent=s.d;
}
function openLightbox(i){ fillLb(i); lb.classList.add('open'); lbOpen=true; $('#lb-close').focus(); }
function closeLightbox(){ lb.classList.remove('open'); lbOpen=false; $('#lb-stage').innerHTML=''; }
function lbGo(i){ go(i); fillLb(active); }
$('#lb-close').addEventListener('click',closeLightbox);
$('#lb-prev').addEventListener('click',function(){ lbGo(active-1); });
$('#lb-next').addEventListener('click',function(){ lbGo(active+1); });
lb.addEventListener('click',function(e){ if(e.target===lb) closeLightbox(); });

/* ---------------- Case-study pager (SPEC §1.5) ---------------- */
var pager=$('#cs-pager');
function buildPager(name){
  pager.classList.remove('show'); pager.querySelectorAll('.cs-pg-t').forEach(function(t){t.remove()});
  if(['repair','refilling','onsite','spares'].indexOf(name)===-1||innerWidth<=820||matchMedia('(hover: none)').matches) return;
  var view=viewEl(name); if(!view)return;
  var chapters=[]; var idx=0;
  $$('.cs-band',view).forEach(function(band){
    var num=$('.cs-ledger-num',band),eye=$('.cs-ledger-eye',band);
    if(num&&eye){ chapters.push({band:band,num:num.textContent.trim(),label:eye.textContent.trim()}); }
    else if(band.classList.contains('cs-hero')) chapters.push({band:band,num:'',label:'Overview'});
    else if(band.classList.contains('cs-closing')) chapters.push({band:band,num:'',label:'Closing'});
    else if(band.hasAttribute('data-readnext')) chapters.push({band:band,num:'',label:'Read next'});
    idx++;
  });
  var pill=$('#cs-pg-pill');
  chapters.forEach(function(ch,i){
    var t=document.createElement('button'); t.className='cs-pg-t'; t.setAttribute('aria-label',ch.label);
    var f=document.createElement('span'); f.className='cs-pg-f'; t.appendChild(f); pager.appendChild(t); ch.tick=f; ch.btn=t;
    t.addEventListener('click',function(){ if(deck){ deckGoToBand(ch.band); } else { ch.band.scrollIntoView({behavior:reduced?'auto':'smooth'}); } });
    t.addEventListener('mouseenter',function(){
      pill.querySelector('.n').textContent=ch.num?('Section '+ch.num):'';
      pill.querySelector('.t').textContent=ch.label;
      pill.style.left=(t.offsetLeft+t.offsetWidth/2)+'px';
    });
  });
  pager._chapters=chapters; pager.classList.add('show');
  Scroll.kick();
}
Scroll.add(function(){
  if(!pager._chapters||!pager.classList.contains('show')||deck)return;
  var mid=innerHeight*0.5, dark=false;
  pager._chapters.forEach(function(ch,i){
    var r=ch.band.getBoundingClientRect();
    var p=Math.min(1,Math.max(0,(mid-r.top)/Math.max(1,r.height)));
    ch.tick.style.setProperty('--f',p.toFixed(3));
    if(r.top<=mid&&r.bottom>=mid) dark=ch.band.classList.contains('dark');
  });
  pager.classList.toggle('on-dark',dark);
  /* read-next progress bar */
  var rn=$('.cs-readnext:not([hidden]) .rn-bar i'); var rnb=$('.cs-readnext .rn-bar');
  if(rnb){ var rr=rnb.closest('.cs-readnext').getBoundingClientRect(); var rp=Math.min(1,Math.max(0,(innerHeight-rr.top)/innerHeight)); var fill=rnb.querySelector('i'); if(fill) fill.style.setProperty('--rnf',rp.toFixed(3)); if(fill) fill.style.transform='scaleX('+rp+')'; }
});

/* ---------------- Contact drawer ---------------- */
var drawer=$('#contact-drawer');
function openDrawer(){ drawer.classList.add('open'); var f=$('#cf-name'); if(f)f.focus(); }
function closeDrawer(){ drawer.classList.remove('open'); }
$$('[data-contact]').forEach(function(b){ b.addEventListener('click',function(e){ e.preventDefault(); openDrawer(); }); });
$$('[data-close-drawer]').forEach(function(b){ b.addEventListener('click',closeDrawer); });
addEventListener('keydown',function(e){ if(e.key==='Escape'){ closeDrawer(); if(lbOpen)closeLightbox(); } });
$('#contact-form').addEventListener('submit',function(e){
  e.preventDefault();
  var name=$('#cf-name').value,phone=$('#cf-phone').value,pr=$('#cf-printer').value,msg=$('#cf-msg').value;
  var body=encodeURIComponent('Name: '+name+'\nPhone: '+phone+'\nPrinter: '+pr+'\n\n'+msg);
  location.href='mailto:jv.ssprinterservices@gmail.com?subject='+encodeURIComponent('Repair enquiry — '+pr)+'&body='+body;
});

/* ---------------- Dot cursor (SPEC §1.7) ---------------- */
(function(){
  var dot=$('#dot-cursor'); if(!dot||!matchMedia('(hover:hover) and (pointer:fine)').matches)return;
  var x=0,y=0,raf=false;
  addEventListener('pointermove',function(e){ x=e.clientX; y=e.clientY; if(!raf){ raf=true; requestAnimationFrame(function(){ dot.style.left=x+'px'; dot.style.top=y+'px'; raf=false; }); }
    dot.classList.toggle('grow',!!e.target.closest('a,button,.tile,.pgf-card,.pg-tile,.recorder')); });
  addEventListener('pointerdown',function(){ dot.classList.add('press'); });
  addEventListener('pointerup',function(){ dot.classList.remove('press'); });
})();

/* ---------------- Case-study snap deck (SPEC §3.5) ----------------
   One wheel/key/touch gesture = exactly one panel. DUR 1000ms easeInOutCubic
   tween of the virtual target + 300ms settle failsafe; renderS chases targetS
   by rAF lerp and snaps at |diff|<0.4. Per panel: read = max(0, innerH - V),
   sweep SL = round(V*0.6), dwell DW = round(V*0.5); incoming panel slides
   tx 100->0 with ENTER_SCALE 0.5->1 under cubic-out render ease. */
var deck=null;
function easeInOutCubic(k){ return k<.5 ? 4*k*k*k : 1-Math.pow(-2*k+2,3)/2; }
function easeOutCubic(t){ return 1-Math.pow(1-t,3); }
function deckGoToBand(band){ if(!deck)return; var i=deck.bands.indexOf(band); if(i>-1) deckGoTo(i); }
function deckGoTo(k){
  if(!deck)return; k=Math.max(0,Math.min(deck.panels.length-1,k)); if(k===deck.targetIdx&&deck.tween)return;
  var d=deck; d.targetIdx=k;
  d.tween={from:d.targetS,to:d.P[k],t0:performance.now()};
  clearTimeout(d.failsafe);
  d.failsafe=setTimeout(function(){ if(d.tween&&performance.now()-d.tween.t0>=1000){ d.targetS=d.tween.to; d.tween=null; } },1300); /* DUR + 300 settle failsafe */
}
function deckStep(dir){ if(!deck||deck.tween)return; deckGoTo(deck.targetIdx+dir); }
function teardownDeck(){
  if(!deck)return; var d=deck; deck=null;
  cancelAnimationFrame(d.raf); clearTimeout(d.failsafe);
  removeEventListener('wheel',d.onWheel); removeEventListener('keydown',d.onKey);
  removeEventListener('touchstart',d.onTS); removeEventListener('touchend',d.onTE);
  d.bands.forEach(function(b){
    var inner=b.querySelector('.cs-slide-inner');
    if(inner){ while(inner.firstChild) b.insertBefore(inner.firstChild,inner); inner.remove(); }
    b.classList.remove('cs-slide','cv'); b.style.transform=''; b.style.visibility=''; b.style.zIndex='';
    if(d.stage.contains(b)) d.page.insertBefore(b,d.stage);
  });
  d.stage.remove(); document.body.classList.remove('cs-deck-on');
}
function initDeck(name){
  teardownDeck();
  if(CS_STATIC||['repair','refilling','onsite','spares'].indexOf(name)===-1) return;
  var view=viewEl(name); if(!view)return;
  var page=view.querySelector('.cs-page'); if(!page)return;
  var bands=$$('.cs-band',page); if(bands.length<2)return;
  var V=innerHeight, SL=Math.round(V*0.6), DW=Math.round(V*0.5);
  var stage=document.createElement('div'); stage.className='cs-deck'; page.appendChild(stage);
  var panels=bands.map(function(b){
    var inner=document.createElement('div'); inner.className='cs-slide-inner';
    while(b.firstChild) inner.appendChild(b.firstChild);
    b.appendChild(inner); b.classList.add('cs-slide'); stage.appendChild(b);
    return {band:b,inner:inner,read:0,vids:$$('video',b)};
  });
  panels.forEach(function(p){ p.read=Math.max(0,p.inner.scrollHeight-V); });
  var P=[0]; for(var i=0;i<panels.length-1;i++) P.push(P[i]+panels[i].read+DW+SL);
  var d=deck={page:page,stage:stage,bands:bands,panels:panels,P:P,SL:SL,DW:DW,V:V,
    targetS:0,renderS:0,targetIdx:0,tween:null,failsafe:0,raf:0,lastVidKey:''};
  document.body.classList.add('cs-deck-on');
  function render(s){
    var n=panels.length, idx=0;
    if(s>=P[n-1]-0.5) idx=n-1; else { while(idx<n-2&&s>=P[idx+1]-0.5) idx++; }
    var local=s-P[idx], readPart=Math.min(local,panels[idx].read), rest=local-panels[idx].read;
    var sweepT= idx<n-1 ? Math.max(0,Math.min(1,(rest-DW)/SL)) : 0, e=easeOutCubic(sweepT);
    var vidKey='';
    panels.forEach(function(p,k){
      if(k<idx){ p.band.style.visibility='visible'; p.band.style.zIndex=k; p.band.style.transform=''; p.band.classList.remove('cv'); p.inner.style.transform='translateY('+(-p.read)+'px)'; }
      else if(k===idx){ p.band.style.visibility='visible'; p.band.style.zIndex=20; p.band.style.transform=''; p.band.classList.remove('cv'); p.inner.style.transform='translateY('+(-readPart)+'px)'; }
      else if(k===idx+1&&sweepT>0){ p.band.style.visibility='visible'; p.band.style.zIndex=30; p.band.style.transform='translateX('+((1-e)*100)+'%) scale('+(0.5+0.5*e)+')'; p.band.classList.add('cv'); p.inner.style.transform=''; }
      else { p.band.style.visibility='hidden'; p.band.style.transform=''; }
      if(k===idx||(k===idx+1&&sweepT>0)) vidKey+=k+',';
    });
    if(vidKey!==d.lastVidKey){ d.lastVidKey=vidKey;
      panels.forEach(function(p,k){ var on=(k===idx||(k===idx+1&&sweepT>0)); p.vids.forEach(function(v){ if(on){ if(v.paused) v.play().catch(function(){}); } else if(!v.paused) v.pause(); }); });
    }
    /* pager sync */
    if(pager._chapters){
      var dark=false;
      pager._chapters.forEach(function(ch){
        var ci=bands.indexOf(ch.band); if(ci<0||!ch.tick)return;
        var denom= ci<n-1 ? (P[ci+1]-P[ci]) : (panels[ci].read+DW+SL);
        var f=Math.max(0,Math.min(1,(s-P[ci])/Math.max(1,denom)));
        ch.tick.style.setProperty('--f',f.toFixed(3));
      });
      var curBand= (sweepT>0.5&&idx+1<n)? panels[idx+1].band : panels[idx].band;
      dark=curBand.classList.contains('dark');
      pager.classList.toggle('on-dark',dark);
      var rn=panels[n-1].band.querySelector('.rn-bar i');
      if(rn){ var rf= idx===n-1?1:(idx===n-2?sweepT:0); rn.style.transform='scaleX('+rf+')'; }
    }
  }
  d.render=render;
  function loop(){
    if(deck!==d)return;
    var now=performance.now();
    if(d.tween){ var k=Math.min(1,(now-d.tween.t0)/1000); d.targetS=d.tween.from+(d.tween.to-d.tween.from)*easeInOutCubic(k); if(k>=1){ d.targetS=d.tween.to; d.tween=null; } }
    var diff=d.targetS-d.renderS;
    if(Math.abs(diff)<0.4) d.renderS=d.targetS; else d.renderS+=diff*0.3;
    render(d.renderS);
    d.raf=requestAnimationFrame(loop);
  }
  d.onWheel=function(e){
    if(deck!==d||drawer.classList.contains('open'))return;
    if(e.target.closest&&e.target.closest('.drawer'))return;
    e.preventDefault(); if(d.tween)return;
    var dd=Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:e.deltaX; if(dd) deckStep(dd>0?1:-1);
  };
  d.onKey=function(e){
    if(deck!==d||drawer.classList.contains('open'))return;
    if(e.target.closest&&e.target.closest('input,textarea,select'))return;
    if(['ArrowDown','PageDown',' '].indexOf(e.key)>-1){ e.preventDefault(); deckStep(1); }
    else if(['ArrowUp','PageUp'].indexOf(e.key)>-1){ e.preventDefault(); deckStep(-1); }
  };
  var touchY=null;
  d.onTS=function(e){ touchY=e.touches[0].clientY; };
  d.onTE=function(e){ if(touchY===null)return; var dy=touchY-e.changedTouches[0].clientY; touchY=null; if(Math.abs(dy)>36) deckStep(dy>0?1:-1); };
  addEventListener('wheel',d.onWheel,{passive:false});
  addEventListener('keydown',d.onKey);
  addEventListener('touchstart',d.onTS,{passive:true});
  addEventListener('touchend',d.onTE,{passive:true});
  render(0);
  d.raf=requestAnimationFrame(loop);
}

/* ---------------- Paper plane + trail (SPEC §3.1.2) ---------------- */
(function(){
  var layer=$('#plane-layer'); if(!layer)return;
  var plane=$('#paper-plane'), paths=[$('#trail-1'),$('#trail-2'),$('#trail-3')];
  var proj=$('#story'), feat=$('#work'), testi=$('#testimonials'); if(!proj||!feat||!testi)return;
  function place(){ var top=proj.offsetTop; layer.style.top=top+'px'; layer.style.height=((feat.offsetTop+feat.offsetHeight)-top)+'px'; }
  place(); addEventListener('resize',place);
  var segs=[[0,0.30],[0.36,0.63],[0.69,1]];
  Scroll.add(function(y,vh){
    if(current!=='home'){ plane.style.opacity=0; return; }
    var top=proj.offsetTop, bottom=feat.offsetTop+feat.offsetHeight, total=Math.max(1,bottom-top);
    var read=y+vh/2, p=Math.max(0,Math.min(1,(read-top)/total));
    var maxP=Math.max(0,Math.min(1,((testi.offsetTop-160)-top)/total)); /* PLANE_BUFFER 160 */
    var pp=Math.min(p,maxP), seg=-1, sp=0;
    for(var s2=0;s2<3;s2++){ if(pp>=segs[s2][0]&&pp<=segs[s2][1]){ seg=s2; sp=(pp-segs[s2][0])/(segs[s2][1]-segs[s2][0]); break; } }
    if(seg<0){ plane.style.opacity=0; return; }
    var path=paths[seg], len=path.getTotalLength();
    var pt=path.getPointAtLength(sp*len), pt2=path.getPointAtLength(Math.min(len,sp*len+2));
    var w=layer.clientWidth, h=layer.clientHeight;
    plane.style.left=(pt.x/1440*w)+'px'; plane.style.top=(pt.y/3021*h)+'px';
    var ang=Math.atan2((pt2.y-pt.y)/3021*h,(pt2.x-pt.x)/1440*w)*180/Math.PI;
    plane.style.transform='rotate('+(ang-31)+'deg)'; /* nose offset -31deg */
    plane.style.opacity= p>maxP ? 0 : 0.95; /* parks/fades before testimonials */
  });
})();

/* ---------------- Footer garden (SPEC §1.7) ---------------- */
(function(){
  var wrap=$('#g-plants'), garden=$('#garden'); if(!wrap||!garden)return;
  var petalC=['#faf5e6','#fbf7ec','#f7f1df'], stemC=['#b06a4d','#a95c42','#bb765b'],
      lavC=['#7c5fa6','#684c90','#8f73b8','#5b4680','#9a80c2'], leafC=['#5c7d3f','#4a6b33','#6f9450'];
  var plants=[];
  for(var i=0;i<16;i++){
    var el=document.createElement('div'); el.className='g-plant';
    el.style.left=(4+i/15*92+Math.sin(i*7.3)*1.4)+'%';
    el.style.width=(26+((i*17)%14))+'px';
    el.style.setProperty('--gs',(0.45+((i*29)%30)/100).toFixed(2));
    el.style.setProperty('--sway',(4.2+((i*13)%26)/10)+'s');
    var kind=i%3, svg='';
    if(kind===0){ var rings=''; for(var p=0;p<6;p++) rings+='<ellipse cx="17" cy="9" rx="4.6" ry="8" fill="'+petalC[i%3]+'" stroke="#e2d5b0" transform="rotate('+(p*60)+' 17 20)"/>';
      svg='<svg viewBox="0 0 34 100"><path d="M17 100 C15 74 19 56 17 40" stroke="'+stemC[i%3]+'" stroke-width="3" fill="none"/>'+rings+'<circle cx="17" cy="20" r="5.4" fill="#e89a1c"/></svg>'; }
    else if(kind===1){ svg='<svg viewBox="0 0 34 100"><path d="M17 100 C15 70 19 50 17 26" stroke="'+stemC[i%3]+'" stroke-width="3" fill="none"/><g fill="'+lavC[i%5]+'"><circle cx="17" cy="14" r="5"/><circle cx="11" cy="24" r="4.4"/><circle cx="23" cy="24" r="4.4"/><circle cx="12" cy="35" r="4"/><circle cx="22" cy="35" r="4"/></g></svg>'; }
    else { svg='<svg viewBox="0 0 34 100"><path d="M17 100 C16 76 18 60 17 44" stroke="#33361a" stroke-width="3" fill="none"/><path d="M17 62 C6 54 3 40 5 28 C17 32 22 46 17 62Z" fill="'+leafC[i%3]+'"/><path d="M17 50 C28 42 31 28 29 16 C17 20 12 34 17 50Z" fill="'+leafC[(i+1)%3]+'"/></svg>'; }
    el.innerHTML=svg; wrap.appendChild(el); plants.push(el);
  }
  var drops=[];
  garden.addEventListener('click',function(e){
    var r=garden.getBoundingClientRect(), cx=e.clientX-r.left, cy=e.clientY-r.top;
    plants.forEach(function(pl){ var pr=pl.getBoundingClientRect(); if(Math.abs(pr.left-r.left+pr.width/2-cx)<=80) pl.style.setProperty('--gs',1); }); /* reach 80px */
    for(var d2=0;d2<7;d2++){ var dr=document.createElement('span'); dr.className='g-drop'; garden.appendChild(dr); drops.push({el:dr,x:cx+(Math.random()*36-18),y:cy,vy:Math.random()*1.5,vx:Math.random()*1.6-0.8}); }
  });
  (function tick(){ drops=drops.filter(function(d3){ d3.vy+=0.42; d3.x+=d3.vx; d3.y+=d3.vy; d3.el.style.left=d3.x+'px'; d3.el.style.top=d3.y+'px'; if(d3.y>garden.clientHeight-26){ d3.el.remove(); return false; } return true; }); requestAnimationFrame(tick); })(); /* droplet gravity 0.42 */
})();

/* ---------------- Boot ---------------- */
applyRoute(route.token(),true);
layout();
showLoader(document.fonts&&document.fonts.ready?Promise.all([document.fonts.ready,heroReady()]):heroReady(), reduced?600:1200, 8000).then(hideLoader);
})();
