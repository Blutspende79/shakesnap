// "Get the app" redirect, shared by the thin pages in image/ and surprise/ —
// the links inside the app's share captions (lib/utils/store_links.dart).
//
// Phones go straight to their store; desktop and unknown devices land on the
// homepage, which explains the app and shows both badges. Each page loads this
// synchronously in <head> and names its campaign in `data-source`, so a phone
// never paints the page and the store statistics can tell the shares apart.
//
// Keep the store URLs in sync with the badges in index.html.
(function () {
  const PLAY_STORE_URL =
    'https://play.google.com/store/apps/details?id=app.shakesnap';

  // TODO(release): set once the App Store Connect record exists, e.g.
  // 'https://apps.apple.com/app/id1234567890'. Until then iOS visitors fall
  // through to the homepage instead of a dead store link.
  const APP_STORE_URL = null;

  // TODO(release): Apple's provider token (App Store Connect → App Analytics
  // → Campaigns). App Analytics only attributes a `ct` campaign when `pt` is
  // present, so without it the campaign is left off entirely.
  const APP_STORE_PROVIDER_TOKEN = null;

  // Every page lives one folder below the site root.
  const HOMEPAGE_DOWNLOAD = '../index.html#download';

  const source = document.currentScript.dataset.source || 'web';

  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; the touch points give it away.
  const isIOS = /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);

  function appStoreTarget() {
    if (!APP_STORE_URL) return null;
    if (!APP_STORE_PROVIDER_TOKEN) return APP_STORE_URL;
    return APP_STORE_URL + '?pt=' + APP_STORE_PROVIDER_TOKEN +
      '&ct=' + source + '&mt=8';
  }

  function playStoreTarget() {
    // Shows up under "Acquisition → Campaigns" in the Play Console.
    const referrer = 'utm_source=shakesnap.app&utm_medium=share' +
      '&utm_campaign=' + source;
    return PLAY_STORE_URL + '&referrer=' + encodeURIComponent(referrer);
  }

  const target =
    (isIOS && appStoreTarget()) ||
    (isAndroid && playStoreTarget()) ||
    HOMEPAGE_DOWNLOAD;

  // replace(), not href: Back must not land here and bounce straight on.
  location.replace(target);
})();
