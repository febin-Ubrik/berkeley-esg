/* Berkeley UAE — /esg page script (GSAP 3.12 + ScrollTrigger + Lenis loaded before it by the page code).
   Fade-ups, image parallax and the National Priorities row reveals are native Webflow interactions (IX3); the navbar hide/show is in the site footer code. */
var REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;   // read once; every block below used to call matchMedia itself
/* Lenis smooth scroll (Febin, 21 Sep), driven by GSAP's ticker so ScrollTrigger reads the same frame. Off under reduced motion; touch stays native (Lenis default). */
if (!REDUCED_MOTION) {
  var lenis = new Lenis();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
  gsap.ticker.lagSmoothing(0);
}
/* Section 05 — logo tiles on scroll (Febin). Their reveal is CSS :hover only; here, while the list is on screen, the row nearest the screen centre gets .is-active (same styles),
   so one logo shows from the moment the list enters and it changes as you scroll. Hovering takes over in CSS. Measured from live rects, so the rows' fade-up offset can't skew it.
   Hover-capable desktops only: elsewhere the tiles sit inline and stay open. State only, so it also runs under reduced motion (the CSS drops the transition). */
gsap.matchMedia().add('(min-width: 992px) and (hover: hover)', function () {
  var list = document.querySelector('.esg-ms-list'), rows = gsap.utils.toArray('.esg-ms-row');
  function setActive() {
    var c = innerHeight / 2, lb = list.getBoundingClientRect(), best = null, near = Infinity;
    if (lb.top < innerHeight && lb.bottom > 0) rows.forEach(function (r) { var b = r.getBoundingClientRect(), d = Math.abs((b.top + b.bottom) / 2 - c); if (d < near) { near = d; best = r; } });
    rows.forEach(function (r) { r.classList.toggle('is-active', r === best); });
  }
  ScrollTrigger.create({ trigger: list, start: 'top bottom', end: 'bottom top', onUpdate: setActive, onToggle: setActive });
  return function () { rows.forEach(function (r) { r.classList.remove('is-active'); }); };
});
/* Section 07 — ESG Solutions, medusmo.com "home-sticky" script (setupScrollLogic + the scrubbed .home-sticky_scroll-progress bars): same triggers, classes and scrub.
   Ours adds: the heading is state 0 (Febin), so trigger 1 retires it; the matching pie wedge sweeps with each bar. All widths with motion; reduced motion gets the CSS list. */
gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', function () {   // every width now (Febin: the pie on mobile too)
  var sol = document.querySelector('.esg-sol'); if (!sol) return;
  var q = gsap.utils.selector(sol), triggers = q('.esg-sol-triggers > div'), intro = q('.esg-sol-intro')[0], items = q('.esg-sol-item'), tabs = q('.esg-sol-tab'), wedges = q('.esg-sol-wedge'), count = q('.esg-sol-count')[0], n = triggers.length;
  function setCount(i) { count.textContent = String(i + 1).padStart(2, '0'); sol.style.setProperty('--active', 'var(--c' + i + ')'); }
  tabs.forEach(function (t, i) { sol.style.setProperty('--c' + i, getComputedStyle(t).getPropertyValue('--c').trim()); });
  function wedge(k, f) {   // centre → arc: wedge k of n, f of the way round; the same geometry as the static grey tracks
    if (f <= 0) return '';
    var a0 = (k / n) * 2 * Math.PI - Math.PI / 2, a1 = a0 + (2 * Math.PI / n) * Math.min(f, 1), P = function (a) { return (100 + 90 * Math.cos(a)).toFixed(3) + ' ' + (100 + 90 * Math.sin(a)).toFixed(3); };
    return 'M100 100 L' + P(a0) + ' A90 90 0 0 1 ' + P(a1) + 'Z';
  }
  triggers.forEach(function (t, i) {
    ScrollTrigger.create({ trigger: t, start: 'top bottom',
      onEnter: function () { [items, tabs].forEach(function (g) { g[i].classList.add('is-active'); if (i > 0) g[i - 1].classList.add('is-past'); });
        if (i === 0) { intro.classList.add('is-past'); sol.classList.remove('is-intro'); } setCount(i); },
      onLeaveBack: function () { [items, tabs].forEach(function (g) { g[i].classList.remove('is-active'); if (i > 0) g[i - 1].classList.remove('is-past'); });
        if (i === 0) { intro.classList.remove('is-past'); sol.classList.add('is-intro'); } else setCount(i - 1); } });
    gsap.timeline({ scrollTrigger: { trigger: t, start: 'top bottom', end: 'bottom bottom', scrub: true } })
      .fromTo(tabs[i].querySelector('.esg-sol-progress'), { width: '0%' }, { width: '100%', ease: 'none' }, 0)
      .fromTo({ f: 0 }, { f: 0 }, { f: 1, ease: 'none', onUpdate: function () { wedges[i].setAttribute('d', wedge(i, this.targets()[0].f)); } }, 0);
  });
  return function () { items.concat(tabs).forEach(function (el) { el.classList.remove('is-active', 'is-past'); }); wedges.forEach(function (w) { w.setAttribute('d', ''); }); intro.classList.remove('is-past'); sol.classList.add('is-intro'); setCount(0); };
});
/* Section 03 — saapro.ae IX2 "How it works 2" (a-44, ≥480px) / "… Mobile" (a-45), a "while scrolling in view" scrub with smoothing 50.
   Timeline positions are their scroll %: 0 = section top at the viewport bottom, 100 = section bottom at the viewport top. */
(function () {
  var mx = document.querySelector('.esg-mx');
  if (!mx) return;
  var q = gsap.utils.selector(mx), sticky = q('.esg-mx-sticky')[0], REDUCED = REDUCED_MOTION;
  q('.esg-mx-dots')[0].innerHTML = '<i></i>'.repeat(52);
  var orbHost = q('.esg-mx-orb')[0], orbAnim = { play: function () {}, pause: function () {} };   // a native Webflow Lottie inside the orb plays itself
  if (!orbHost.querySelector('[data-animation-type="lottie"]') && window.lottie)
    orbAnim = lottie.loadAnimation({ container: orbHost, renderer: 'svg', loop: true, autoplay: false, path: 'https://cdn.prod.website-files.com/65c38b291e3d86ea0f356862/66475c29372f78d31c609769_3.json' });   // the /about-us orb asset   // the /about-us hero orb, unmodified (aura.json is the same comp with its dark BG layer stripped)
  if (REDUCED) return;   // static list (CSS), orb on its first frame
  var inView = false;
  new IntersectionObserver(function (e) { inView = e[0].isIntersecting; inView ? orbAnim.play() : orbAnim.pause(); }).observe(sticky);
  /* Cursor follow, as the /about-us orb (Febin 21 Sep). Site IX a-238 "movebubblemouse": page mouse move, both axes, viewport-based, ±80px on a 600px orb,
     smoothing 100 (Webflow closes 1% of the gap per frame), rests at the centre. Scaled to this orb: ±13.3% of its width.
     Written to the CSS translate property, which stacks with the transform GSAP animates on the same element. */
  var orbEl = q('.esg-mx-orb')[0], aim = { x: 0, y: 0 }, pos = { x: 0, y: 0 };
  addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') { aim.x = e.clientX / innerWidth * 2 - 1; aim.y = e.clientY / innerHeight * 2 - 1; } });
  document.documentElement.addEventListener('pointerleave', function () { aim.x = aim.y = 0; });
  gsap.ticker.add(function (t, dt) {
    if (!inView) return;
    var k = 1 - Math.pow(0.99, dt * 0.06), r = orbEl.offsetWidth * 80 / 600;   // 1% per 60fps frame, whatever the refresh rate
    pos.x += (aim.x - pos.x) * k; pos.y += (aim.y - pos.y) * k;
    orbEl.style.translate = (pos.x * r).toFixed(2) + 'px ' + (pos.y * r).toFixed(2) + 'px';
  });

  var LIT = '#2bbab0';   // Berkeley turquoise on the navy scene (Febin); their dots light #54bf44
  var em = function () { return parseFloat(getComputedStyle(mx).fontSize); };
  // Rows travel until the last step sits 2em inside the right edge (they hard-code -159em / -121em for their 6 steps). offsetLeft ignores transforms.
  var dist = function () {
    return Math.max.apply(null, q('.esg-mx-item:last-child').map(function (el) { return el.offsetLeft + el.offsetWidth; })) - sticky.clientWidth + 2 * em();
  };
  gsap.matchMedia().add({ desk: '(min-width: 992px)', phone: '(max-width: 991px)', dots18: '(max-width: 479px)' }, function (ctx) {
    var d = ctx.conditions.desk, pad = d ? 2 : 1;               // their row / line inset in em
    var wrapX = d ? -25.5 : -5.5, headX = d ? -50 : -35;        // their a-44 / a-45 heading values
    var headEl = q('.esg-mx-head')[0], mark = q('.esg-mx-mark')[0], orb = q('.esg-mx-orb')[0], steps = q('.esg-mx-steps')[0], content = q('.esg-mx-content')[0];
    // settled top of the steps: desktop centres them with translateY(-50%) (offsetTop ignores transforms), phones keep them in flow
    var stepsTop = function () { return steps.offsetTop - (d ? steps.offsetHeight / 2 : 0); };
    var dots = q('.esg-mx-dots i').filter(function (i) { return i.offsetParent; }), pre = dots.length > 18 ? 7 : 2;   // their line starts with 7 of 52 lit
    // orb target: its centre at screen x = cx, midway down the space above the steps (offsets ignore transforms; the head is position:relative)
    var markX = function (cx) { return cx - (headEl.offsetLeft + mark.offsetLeft + mark.offsetWidth / 2 + wrapX * em()); };
    var markY = function () { return stepsTop() / 2 - (headEl.offsetTop + mark.offsetTop + mark.offsetHeight / 2); };
    // the orb holds the centre, starts drifting right half a screen before the last step comes on, and reaches the right edge with it (Febin)
    var lastIn = Math.max.apply(null, q('.esg-mx-item:last-child').map(function (el) { return el.offsetLeft; }));
    var goRight = 20 + 60 * gsap.utils.clamp(0.5, 0.85, (lastIn - 1.5 * sticky.clientWidth) / dist());
    gsap.set(dots.slice(0, pre), { backgroundColor: LIT });
    var tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: q('.esg-mx-main')[0], start: 'top bottom', end: 'bottom top', scrub: 0.5, invalidateOnRefresh: true } })   // their IX smoothing 50 on top of Lenis, as on Saapro (was scrub 1 while Lenis was missing)
      // 0 = section top at the viewport bottom; their scroll %
      .to(headEl, { x: function () { return wrapX * em(); }, duration: d ? 10 : 3 }, d ? 15 : 20)
      // their -50em clears a 24em heading; ours is wider, so go at least far enough to leave the screen.
      // Desktop: never slower than the steps either, or the centred row 1 catches the paragraph on its way out.
      .to(q('.esg-mx-title, .esg-mx-lead'), { x: function (i, el) {
        return Math.min(headX * em(), -(el.offsetLeft + el.offsetWidth + wrapX * em()), d ? -dist() * 18 / 60 : 0); }, duration: d ? 18 : 20 }, d ? 25 : 23)
      // orb (their leaf, 5em → 10em): glides to the centre while the heading leaves, waits there, then moves right with the last step. Rings dropped.
      .to(mark, { x: function () { return markX(sticky.clientWidth / 2); }, y: markY, duration: 18, ease: 'power1.inOut' }, 25)
      .to(orb, { scale: 1, duration: 18, ease: 'power1.inOut' }, 25)
      // long, soft ease so it drifts off and settles rather than darting; lands just after the rows stop (80%), before the section releases (~86%)
      .to(mark, { x: function () { return markX(sticky.clientWidth - pad * em() - orb.offsetWidth / 2); }, duration: 82 - goRight, ease: 'power2.inOut' }, goRight)
      .to(q('.esg-mx-row'), { x: function () { return -dist(); }, duration: 60 }, 20)
      // their Lottie flips one dot per frame from frame 1 to 45 of 55, scrubbed across 20–80%
      .to(dots.slice(pre), { backgroundColor: LIT, duration: 0.3, stagger: 49 / (dots.length - pre) }, 20 + 49 / (dots.length - pre))
      .set({}, {}, 100);
    // Desktop: the steps enter where theirs sit (3em off the bottom), so the heading arrives alone first, then rise to the
    // centred line while the heading slides out (Febin, iteration 2). Saapro's rows never move vertically.
    if (d) tl.fromTo(steps, { yPercent: -50, y: function () { return content.clientHeight - 3 * em() - steps.offsetHeight - stepsTop(); } },
      { yPercent: -50, y: 0, duration: 15, ease: 'power1.inOut' }, 20);
  });
})();
