import React from 'react';
import { StyleSheet, ActivityIndicator, View, StatusBar } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const START_URL = 'https://www.instagram.com/';

const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

// GramInsta: Instagram without the Reels tab, Explore grid, or reel-to-reel scrolling.
//  - Hides the Reels button in the bottom nav and closes the gap.
//  - Blocks the Reels feed (/reels/).
//  - On Explore, hides the grid of suggested posts but keeps search.
//  - When a reel is showing (a /reel/ permalink or a reel opened inside a DM),
//    locks scrolling so the "Suggested" feed can't be pulled in. Profile reels
//    open as a static Post and aren't affected.
const INJECTED = `
(function () {
  'use strict';

  function isReelsFeed(url) {
    try {
      var p = new URL(url, location.origin).pathname;
      return p === '/reels' || p === '/reels/';
    } catch (e) { return false; }
  }

  // 1. Hide the Reels tab link immediately.
  function injectCSS() {
    if (!document.head) { return requestAnimationFrame(injectCSS); }
    var style = document.createElement('style');
    style.textContent =
      'a[href="/reels/"], a[href="/reels"] { display: none !important; }';
    document.head.appendChild(style);
  }
  injectCSS();

  // 2. Block navigation into the Reels feed.
  var _push = history.pushState;
  history.pushState = function (s, t, url) {
    if (url && isReelsFeed(url)) { return; }
    return _push.apply(this, arguments);
  };
  var _replace = history.replaceState;
  history.replaceState = function (s, t, url) {
    if (url && isReelsFeed(url)) { return; }
    return _replace.apply(this, arguments);
  };
  window.addEventListener('popstate', function () {
    if (isReelsFeed(location.pathname)) { location.replace('/'); }
  }, true);
  if (isReelsFeed(location.pathname)) { location.replace('/'); }

  // 3. Remove the empty Reels slot from the bottom nav and even out the rest.
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
    slot.style.setProperty('display', 'none', 'important');
    nav.style.setProperty('justify-content', 'space-around', 'important');
  }

  // 4. On Explore (/explore/), hide the grid of suggested posts, keep search.
  function hideExploreGrid() {
    var p = location.pathname;
    if (p !== '/explore/' && p !== '/explore') { return; }
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

  // 5. Lock scrolling while a reel is showing. A reel fills nearly the full
  //    width (landscape, letterboxed) OR nearly the full height (portrait);
  //    a video inside a chat bubble fills neither, so it won't match.
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
  // Re-check the instant a touch starts, so closing a reel releases the lock
  // immediately instead of waiting for the next poll.
  window.addEventListener('touchstart', function () {
    if (lockOn) { updateReelLock(); }
  }, { passive: true, capture: true });

  // Run all fixes on load, two quick retries, then a light 0.5s poll.
  function apply() { fixNav(); hideExploreGrid(); updateReelLock(); }
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