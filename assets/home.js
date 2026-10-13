// Homepage behaviour, shared by index.html (EN) and de/index.html (DE).
// Visible strings live in the markup (data-* attributes), never here, so the
// two language versions differ only in their HTML.

// ── Photo pools ──────────────────────────────────────
// Self-hosted Unsplash photos (see pictures/CREDITS.txt). Each card draws
// from its own pool so the hero and the surprise demo never collide.
// Resolved against this script, not the page, so the same pools work from the
// site root and from de/.
const SCRIPT_URL = document.currentScript.src;
const photo = name => new URL('../pictures/web/' + name, SCRIPT_URL).href;
const HERO_PHOTOS = [
  photo('1_brooke-cagle-oTweoxMKdkA.jpg'),
  photo('1_helena-lopes-PGnqT0rXWLs.jpg'),
  photo('1_timon-studler-BIk2ANMmNz4.jpg'),
];
const SURPRISE_PHOTOS = [
  photo('2_morgan-lane-18N4okmWccM.jpg'),
  photo('2_pineapple-supply-co-NgDapgpAiTE.jpg'),
];

// Walks a shuffled copy of the pool and reshuffles once it is used up, so
// every photo is seen before any repeats. On reshuffle the previous last
// entry is swapped away from the front to avoid a back-to-back duplicate.
function makePhotoPicker(pool) {
  let queue = [];
  let last  = null;

  function reshuffle() {
    queue = pool.slice();
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    if (queue.length > 1 && queue[0] === last) {
      [queue[0], queue[1]] = [queue[1], queue[0]];
    }
  }

  return function next() {
    if (!queue.length) reshuffle();
    last = queue.shift();
    return last;
  };
}

const nextHeroPhoto     = makePhotoPicker(HERO_PHOTOS);
const nextSurprisePhoto = makePhotoPicker(SURPRISE_PHOTOS);

// Warm the cache so a freshly swapped photo is decoded before it develops.
HERO_PHOTOS.concat(SURPRISE_PHOTOS).forEach(src => { new Image().src = src; });

// ── Store badges: visitor's own store first ─────────────────
// Only reorders; both badges always stay visible. iOS and desktop keep
// the default App Store-first order.
if (/Android/.test(navigator.userAgent)) {
  document.getElementById('storeBadges')?.classList.add('android-first');
}

// ── Scroll-reveal ───────────────────────────────────────────
const observer = new IntersectionObserver(
  entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); }),
  { threshold: 0.13 }
);
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ── Nav brand: on phones the hero's own icon + name sit right below it, so
// the CSS hides the nav copy while the hero brand is on screen. The top
// margin is the fixed nav's height, which covers that part of the viewport.
const navEl = document.querySelector('nav');
const heroBrandEl = document.querySelector('.hero-brand');
if (navEl && heroBrandEl) {
  new IntersectionObserver(
    entries => navEl.classList.toggle('hero-brand-visible', entries[0].isIntersecting),
    { rootMargin: '-70px 0px 0px 0px' }
  ).observe(heroBrandEl);
}

// ── Hero instant-photo card: auto-develop on page load, click to replay ──
const heroCard = document.getElementById('heroCard');

function triggerHeroDevelop() {
  const img       = document.getElementById('heroImg');
  const resetHint = document.getElementById('heroResetHint');
  if (!heroCard || !img) return;

  // reset to undeveloped, then swap in the next photo while it is still
  // blacked out so the change is never visible
  img.classList.remove('developing');
  img.style.filter = 'brightness(0) saturate(0)';
  img.src = nextHeroPhoto();
  heroCard.style.animation = 'float 4.5s ease-in-out infinite';
  if (resetHint) resetHint.classList.remove('visible');

  // void reflow so animation class restart works cleanly
  void img.offsetWidth;

  setTimeout(() => {
    // ── first shake ──
    heroCard.style.animation = 'wiggle .22s ease-in-out 4';
    setTimeout(() => {
      heroCard.style.animation = 'float 4.5s ease-in-out infinite';
      // start developing
      img.style.filter = '';
      void img.offsetWidth;
      img.classList.add('developing');

      // ── second shake at ~50% of development (1.75s in) ──
      setTimeout(() => {
        heroCard.style.animation = 'wiggle .22s ease-in-out 4';
        setTimeout(() => {
          heroCard.style.animation = 'float 4.5s ease-in-out infinite';
        }, 880);
      }, 1550);

      // show reset overlay once photo is fully developed
      setTimeout(() => {
        if (resetHint) resetHint.classList.add('visible');
      }, 3500);
    }, 880);
  }, 300);
}

// Auto-start after page is fully loaded
window.addEventListener('load', () => setTimeout(triggerHeroDevelop, 700));

// Click to replay
if (heroCard) {
  heroCard.style.cursor = 'pointer';
  heroCard.addEventListener('click', triggerHeroDevelop);
}

// ── Surprise instant-photo demo ─────────────────────────────
// A click or tap shakes the card twice and the photo develops on its own;
// the next click resets it with a new photo. No motion sensor on the
// website: browsers claim the shake gesture for their own features (e.g.
// Firefox's shake to summarize) and iOS would ask for motion access.
const udCard      = document.getElementById('udCard');
const udImg       = document.getElementById('udImg');
const udLabel     = document.getElementById('udLabel');
const udRing      = document.getElementById('pulseRing');
const udResetHint = document.getElementById('udResetHint');
const tapHint     = document.getElementById('tapHint');

// Length of the develop-photo animation on .reveal-img.developing (home.css).
const DEVELOP_MS = 3500;
// The finger below the card bounces whenever the card comes into view, then
// again at this interval while it stays there, until the first tap. With
// reduced motion it bounces once only.
const TAP_HINT_EVERY_MS = 5000;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let isDeveloped  = false;
let autoRunning  = false;
let tapHintDone  = !tapHint;
let tapHintTimer = 0;

function bounceTapHint() {
  tapHint.classList.remove('show');
  void tapHint.offsetWidth; // restart the animation
  tapHint.classList.add('show');
  if (reduceMotion) tapHintDone = true;
  else tapHintTimer = setTimeout(bounceTapHint, TAP_HINT_EVERY_MS);
}

function stopTapHint() {
  tapHintDone = true;
  clearTimeout(tapHintTimer);
  if (tapHint) tapHint.classList.remove('show');
}

if (!tapHintDone && udCard) {
  new IntersectionObserver(entries => {
    if (tapHintDone) return;
    clearTimeout(tapHintTimer);
    if (entries[0].isIntersecting) bounceTapHint();
  }, { threshold: 0.5 }).observe(udCard);
}

// The card never resets before its first reveal, so seed it here —
// otherwise every visitor's first surprise would be the markup fallback.
if (udImg) udImg.src = nextSurprisePhoto();

function finishReveal() {
  isDeveloped = true;
  autoRunning = false;
  udLabel.textContent = udLabel.dataset.tada;
  udLabel.classList.add('tada');
  if (udResetHint) udResetHint.classList.add('visible');
}

function resetReveal() {
  isDeveloped = false;
  udCard.classList.remove('developed', 'shaking');
  udImg.classList.remove('developing');
  udImg.style.filter = 'brightness(0) saturate(0)';
  udImg.src = nextSurprisePhoto();
  udLabel.textContent = udLabel.dataset.reveal;
  udLabel.classList.remove('tada');
  if (udResetHint) udResetHint.classList.remove('visible');
  udCard.style.transform = 'rotate(-3deg)';
}

// Two scripted shakes; the photo develops during the first one.
function autoReveal() {
  autoRunning = true;
  udLabel.textContent = '';
  stopTapHint();

  udRing.classList.add('fire');
  udRing.addEventListener('animationend', () => udRing.classList.remove('fire'), { once: true });

  udCard.classList.add('shaking');
  udCard.style.animation = 'wiggle .22s ease-in-out 5';
  udCard.addEventListener('animationend', () => {
    udCard.style.animation = '';
    udCard.style.transform = 'rotate(-3deg)';
    udCard.classList.remove('shaking');
  }, { once: true });

  setTimeout(() => {
    udImg.style.filter = '';
    void udImg.offsetWidth;
    udImg.classList.add('developing');
    udCard.classList.add('developed');
    setTimeout(finishReveal, DEVELOP_MS);
  }, 200);

  setTimeout(() => {
    udCard.style.animation = 'wiggle .22s ease-in-out 4';
    setTimeout(() => {
      udCard.style.animation = '';
      udCard.style.transform = 'rotate(-3deg)';
    }, 880);
  }, 1950);
}

// Called from the card's onclick in the markup.
function developInstantPhoto() {
  if (isDeveloped) { resetReveal(); return; }
  if (autoRunning) return;
  autoReveal();
}
