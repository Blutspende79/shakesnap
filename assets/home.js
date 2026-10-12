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

// ── Tap hint: fire once when the surprise card scrolls into view ──────────
const tapHintEl = document.getElementById('tapHint');
const tapTriggerEl = document.getElementById('udCard');
if (tapHintEl && tapTriggerEl) {
  const tapObs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      tapHintEl.classList.add('show');
      tapObs.disconnect();
    }
  }, { threshold: 0.5 });
  tapObs.observe(tapTriggerEl);
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
// Desktop: a click develops the photo on its own. Phones: the visitor shakes
// the real phone, like in the app — the harder the shake, the faster it
// develops, and it freezes when the shaking stops. Android delivers motion
// events right away; iOS asks for access on the first tap. Whenever motion
// is unavailable or declined, the tap falls back to the click behaviour.
const udCard      = document.getElementById('udCard');
const udImg       = document.getElementById('udImg');
const udLabel     = document.getElementById('udLabel');
const udRing      = document.getElementById('pulseRing');
const udResetHint = document.getElementById('udResetHint');
const tapHint     = document.getElementById('tapHint');

// Length of the develop-photo animation on .reveal-img.developing (home.css).
const DEVELOP_MS = 3500;
// Change in acceleration (m/s², summed over the three axes) between two
// motion events. Below the threshold is ordinary hand movement; above it
// counts as shaking and feeds the development, up to the cap per event.
const SHAKE_THRESHOLD = 10;
const SHAKE_CAP       = 40;
const MS_PER_SHAKE    = 1.6; // ≈ 3 s of hard shaking develops the photo

const canDrive = !!udImg && typeof udImg.getAnimations === 'function';
const motionCapable = canDrive && 'DeviceMotionEvent' in window &&
  matchMedia('(pointer: coarse)').matches;
const needsMotionPermission = motionCapable &&
  typeof DeviceMotionEvent.requestPermission === 'function';

let developAnim  = null;  // the photo's CSS animation, paused while shaking
let autoRunning  = false; // developing on its own after a click
let isDeveloped  = false;
let motionActive = false; // the device is delivering motion events
let listening    = false;
let prompted     = false; // "now shake your phone!" has been shown
let cardVisible  = false;
let lastAccel    = null;
let jiggleTimer  = 0;

// The card never resets before its first reveal, so seed it here —
// otherwise every visitor's first surprise would be the markup fallback.
if (udImg) udImg.src = nextSurprisePhoto();

function idleLabel() {
  return motionCapable ? udLabel.dataset.revealShake : udLabel.dataset.reveal;
}
if (udLabel && motionCapable) udLabel.textContent = idleLabel();

if (udCard) {
  new IntersectionObserver(entries => {
    cardVisible = entries[0].isIntersecting;
  }, { threshold: 0.5 }).observe(udCard);
}

function hideTapHint() {
  if (tapHint) { tapHint.style.animation = 'none'; tapHint.style.opacity = '0'; }
}

// Starts the develop animation paused at the beginning, once per reveal.
function developAnimation() {
  if (developAnim) return developAnim;
  udImg.style.filter = '';
  void udImg.offsetWidth;
  udImg.classList.add('developing');
  udCard.classList.add('developed');
  developAnim = udImg.getAnimations()
    .find(a => a.animationName === 'develop-photo') || null;
  if (developAnim) {
    developAnim.pause();
    // Rejects when a reset cancels the animation; nothing to do then.
    developAnim.finished.then(finishReveal, () => {});
  }
  return developAnim;
}

function finishReveal() {
  isDeveloped = true;
  autoRunning = false;
  udCard.classList.remove('jiggle');
  udLabel.textContent = udLabel.dataset.tada;
  udLabel.classList.add('tada');
  if (udResetHint) udResetHint.classList.add('visible');
}

function resetReveal() {
  isDeveloped = false;
  autoRunning = false;
  prompted    = false;
  developAnim = null;
  udCard.classList.remove('developed', 'shaking', 'jiggle');
  udImg.classList.remove('developing'); // also cancels the animation
  udImg.style.filter = 'brightness(0) saturate(0)';
  udImg.src = nextSurprisePhoto();
  udLabel.textContent = idleLabel();
  udLabel.classList.remove('tada');
  if (udResetHint) udResetHint.classList.remove('visible');
  udCard.style.transform = 'rotate(-3deg)';
}

// The click version: two scripted shakes, the photo develops on its own.
function autoReveal() {
  autoRunning = true;
  udLabel.textContent = '';
  hideTapHint();

  udRing.classList.add('fire');
  udRing.addEventListener('animationend', () => udRing.classList.remove('fire'), { once: true });

  udCard.classList.remove('jiggle');
  udCard.classList.add('shaking');
  udCard.style.animation = 'wiggle .22s ease-in-out 5';
  udCard.addEventListener('animationend', () => {
    udCard.style.animation = '';
    udCard.style.transform = 'rotate(-3deg)';
    udCard.classList.remove('shaking');
  }, { once: true });

  setTimeout(() => {
    const anim = canDrive ? developAnimation() : null;
    if (anim) {
      anim.play(); // continues from wherever shaking left it
    } else {
      udImg.style.filter = '';
      void udImg.offsetWidth;
      udImg.classList.add('developing');
      udCard.classList.add('developed');
      setTimeout(finishReveal, DEVELOP_MS);
    }
  }, 200);

  setTimeout(() => {
    udCard.style.animation = 'wiggle .22s ease-in-out 4';
    setTimeout(() => {
      udCard.style.animation = '';
      udCard.style.transform = 'rotate(-3deg)';
    }, 880);
  }, 1950);
}

function promptShake() {
  prompted = true;
  hideTapHint();
  udLabel.textContent = udLabel.dataset.shakePrompt;
  // No motion events at all (no sensor, or blocked): don't leave the
  // visitor shaking for nothing.
  setTimeout(() => {
    if (!motionActive && !isDeveloped && !autoRunning) autoReveal();
  }, 1200);
}

function onMotion(e) {
  const a = e.accelerationIncludingGravity;
  if (!a || a.x == null) return;
  motionActive = true;
  const prev = lastAccel;
  lastAccel = { x: a.x, y: a.y, z: a.z };
  if (!prev || isDeveloped || autoRunning || !cardVisible) return;

  const delta = Math.abs(a.x - prev.x) + Math.abs(a.y - prev.y) + Math.abs(a.z - prev.z);
  if (delta < SHAKE_THRESHOLD) return;

  const anim = developAnimation();
  if (!anim) return;
  hideTapHint();
  udLabel.textContent = '';
  anim.currentTime = Math.min(DEVELOP_MS,
    anim.currentTime + (Math.min(delta, SHAKE_CAP) - SHAKE_THRESHOLD) * MS_PER_SHAKE);
  if (anim.currentTime >= DEVELOP_MS) { anim.finish(); return; }

  udCard.classList.add('jiggle');
  clearTimeout(jiggleTimer);
  jiggleTimer = setTimeout(() => udCard.classList.remove('jiggle'), 250);
}

function listenForShake() {
  if (listening) return;
  listening = true;
  window.addEventListener('devicemotion', onMotion);
}

// Android and other browsers without a permission prompt: listen right away,
// so shaking works even before the first tap.
if (motionCapable && !needsMotionPermission) listenForShake();

// Called from the card's onclick in the markup.
function developInstantPhoto() {
  if (isDeveloped) { resetReveal(); return; }
  if (autoRunning) return;

  if (motionCapable && !prompted) {
    if (needsMotionPermission && !listening) {
      // Must be called straight from the tap for iOS to show the prompt.
      DeviceMotionEvent.requestPermission()
        .then(state => {
          if (state === 'granted') { listenForShake(); promptShake(); }
          else autoReveal();
        })
        .catch(autoReveal);
      return;
    }
    promptShake();
    return;
  }
  // Second tap, or no motion: develop on its own.
  autoReveal();
}
