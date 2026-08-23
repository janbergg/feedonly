import React from 'react';
import { StyleSheet, ActivityIndicator, View, StatusBar } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const START_URL = 'https://www.instagram.com/';

const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

// GramInsta: Instagram without the Reels tab, Explore grid, or reel-to-reel scrolling.
const INJECTED = `
(function () {
  'use strict';

  function isReelsFeed(url) {
    try {
      var p = new URL(url, location.origin).pathname;
      return p === '/reels' || p === '/reels/';
    } catch (e) { return false; }
  }

  // Tag <html> with the current path so path-scoped CSS can act from first paint.
  function syncPath() {
    var el = document.documentElement;
    var p = location.pathname;
    if (el.getAttribute('data-gi-path') !== p) { el.setAttribute('data-gi-path', p); }
  }
  syncPath();

  // 1. Hide the Reels tab, and hide the Explore grid from first paint (CSS
  //    scoped to /explore/ so it never flashes before the script removes it).
  function injectCSS() {
    if (!document.head) { return requestAnimationFrame(injectCSS); }
    var style = document.createElement('style');
    style.textContent =
      'a[href="/reels/"], a[href="/reels"] { display: none !important; }' +
      'html[data-gi-path="/explore/"] a[href^="/p/"],' +
      'html[data-gi-path="/explore/"] a[href^="/reel/"],' +
      'html[data-gi-path="/explore"] a[href^="/p/"],' +
      'html[data-gi-path="/explore"] a[href^="/reel/"] { display: none !important; }';
    document.head.appendChild(style);
  }
  injectCSS();

  // 2. Block navigation into the Reels feed, and keep the path tag in sync.
  var _push = history.pushState;
  history.pushState = function (s, t, url) {
    if (url && isReelsFeed(url)) { return; }
    var r = _push.apply(this, arguments);
    syncPath();
    return r;
  };
  var _replace = history.replaceState;
  history.replaceState = function (s, t, url) {
    if (url && isReelsFeed(url)) { return; }
    var r = _replace.apply(this, arguments);
    syncPath();
    return r;
  };
  window.addEventListener('popstate', function () {
    if (isReelsFeed(location.pathname)) { location.replace('/'); return; }
    syncPath();
  }, true);
  if (isReelsFeed(location.pathname)) { location.replace('/'); }

  // 3. Remove the empty Reels slot from the bottom nav and even out the rest.
  //    Idempotent: once hidden, the slot is marked so the poll stops touching
  //    styles (avoids layout recalcs that stutter scrolling).
  function fixNav() {
    var reel = document.querySelector('a[href="/reels/"], a[href="/reels"]');
    if (!reel) { return; }
    var home = document.querySelector('a[href="/"]');
    var nav = reel.parentElement;
    if (home) {
      var anc = reel;
      while (anc && !anc.contains(home)) { anc = anc.parentElement; }
      if (anc) { nav = anc; }
    }
    var slot = reel;
    while (slot.parentElement && slot.parentElement !== nav) { slot = slot.parentElement; }
    if (slot.getAttribute('data-gi') === '1') { return; }
    slot.style.setProperty('display', 'none', 'important');
    slot.setAttribute('data-gi', '1');
    nav.style.setProperty('justify-content', 'space-around', 'important');
  }

  // 4. On Explore (/explore/), hide the grid container and the loading spinner,
  //    keep search. (The CSS above already stops the grid images from flashing.)
  function hideExploreGrid() {
    var p = location.pathname;
    if (p !== '/explore/' && p !== '/explore') { return; }
    var spin = document.querySelectorAll('[data-visualcompletion="loading-state"], [role="progressbar"], svg[aria-label="Loading..."]');
    for (var k = 0; k < spin.length; k++) { spin[k].style.setProperty('display', 'none', 'important'); }
    var links = document.querySelectorAll('a[href^="/p/"], a[href^="/reel/"]');
    if (links.length < 3) { return; }
    var first = links[0], last = links[links.length - 1];
    var anc = first;
    while (anc && !anc.contains(last)) { anc = anc.parentElement; }
    if (!anc || anc === document.body) { return; }
    var search = document.querySelector('input, [contenteditable="true"], [role="textbox"]');
    if (search && anc.contains(search)) {
      var child = first;
      while (child.parentElement && child.parentElement !== anc) { child = child.parentElement; }
      if (child && child.contains(last) && !child.contains(search)) { anc = child; }
      else { return; }
    }
    anc.style.setProperty('display', 'none', 'important');
  }

  // 5. Lock scrolling while a reel is showing (a /reel/ permalink or a reel
  //    opened inside a DM). A reel fills nearly the full width or full height;
  //    a chat-bubble video fills neither, so it won't match.
  function reelOverlayShowing() {
    var vids = document.querySelectorAll('video');
    var W = window.innerWidth, H = window.innerHeight;
    for (var i = 0; i < vids.length; i++) {
      var r = vids[i].getBoundingClientRect();
      if (r.width >= W * 0.85 || r.height >= H * 0.85) { return true; }
    }
    return false;
  }
  function blockScroll(e) { e.preventDefault(); }
  var lockOn = false;
  function setLock(on) {
    if (on && !lockOn) {
      window.addEventListener('touchmove', blockScroll, { passive: false, capture: true });
      window.addEventListener('wheel', blockScroll, { passive: false, capture: true });
      lockOn = true;
    } else if (!on && lockOn) {
      window.removeEventListener('touchmove', blockScroll, { capture: true });
      window.removeEventListener('wheel', blockScroll, { capture: true });
      lockOn = false;
    }
  }
  function updateReelLock() {
    var p = location.pathname;
    var shouldLock =
      (p.indexOf('/reel/') === 0) ||
      (p.indexOf('/direct/') === 0 && reelOverlayShowing());
    setLock(shouldLock);
  }
  window.addEventListener('touchstart', function () {
    if (lockOn) { updateReelLock(); }
  }, { passive: true, capture: true });

  // Run all fixes on load, two quick retries, then a light 0.5s poll.
  function apply() { syncPath(); fixNav(); hideExploreGrid(); updateReelLock(); }
  apply();
  setTimeout(apply, 250);
  setTimeout(apply, 700);
  setInterval(apply, 500);
})();
true;
`;

// Backstop for full-page loads: block the Reels feed, allow everything else.
function isReelsFeed(url) {
  try {
    const p = new URL(url).pathname;
    return p === '/reels' || p === '/reels/';
  } catch (e) {
    return false;
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <WebView
          source={{ uri: START_URL }}
          userAgent={USER_AGENT}
          injectedJavaScriptBeforeContentLoaded={INJECTED}
          onShouldStartLoadWithRequest={(req) => !isReelsFeed(req.url)}
          setSupportMultipleWindows={false}
          decelerationRate="normal"
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          domStorageEnabled
          javaScriptEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#ffffff" />
            </View>
          )}
          style={styles.webview}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  webview: { flex: 1, backgroundColor: '#000000' },
  loading: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
});