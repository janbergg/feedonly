import React from 'react';
import { StyleSheet, ActivityIndicator, View, StatusBar } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const START_URL = 'https://www.instagram.com/';

const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

// GramInsta: Instagram with the Reels tab removed.
//  - Hides the Reels button in the bottom nav and closes the gap it leaves.
//  - Blocks the Reels feed (/reels/).
// Reels seen anywhere else (home feed, profiles, DMs, posts) are left untouched.
const INJECTED = `
(function () {
  'use strict';

  // The Reels feed/tab is only the bare /reels/ path (a single reel is /reel/<id>/).
  function isReelsFeed(url) {
    try {
      var p = new URL(url, location.origin).pathname;
      return p === '/reels' || p === '/reels/';
    } catch (e) { return false; }
  }

  // 1. Hide the Reels tab link immediately (before the nav fix runs).
  function injectCSS() {
    if (!document.head) { return requestAnimationFrame(injectCSS); }
    var style = document.createElement('style');
    style.textContent =
      'a[href="/reels/"], a[href="/reels"] { display: none !important; }';
    document.head.appendChild(style);
  }
  injectCSS();

  // 2. Block navigation into the Reels feed. Instagram is a single-page app,
  //    so route changes go through history.pushState, not full page loads.
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
  var navTimer = null;
  function scheduleFixNav() {
    if (navTimer) { return; }
    navTimer = setTimeout(function () { navTimer = null; fixNav(); }, 200);
  }
  (function startObserver() {
    if (!document.body) { return requestAnimationFrame(startObserver); }
    new MutationObserver(scheduleFixNav).observe(document.body, { childList: true, subtree: true });
    fixNav();
  })();
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