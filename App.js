import React from 'react';
import { StyleSheet, ActivityIndicator, View, StatusBar } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const START_URL = 'https://www.instagram.com/';

const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

// Hides the Reels tab, blocks the Reels feed (/reels/), and evens out the
// bottom nav. Reels everywhere else (home, profiles, DMs, posts) are untouched.
const INJECTED = `
(function () {
  'use strict';

  var css = \`
    a[href="/reels/"],
    a[href="/reels"] {
      display: none !important;
    }
  \`;
  function injectCSS() {
    if (document.head) {
      var style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    } else {
      requestAnimationFrame(injectCSS);
    }
  }
  injectCSS();

  function blockedFeed(url) {
    try {
      var p = new URL(url, location.origin).pathname;
      return p === '/reels' || p === '/reels/';
    } catch (e) { return false; }
  }

  var _push = history.pushState;
  history.pushState = function (s, t, url) {
    if (url && blockedFeed(url)) { return; }
    return _push.apply(this, arguments);
  };
  var _replace = history.replaceState;
  history.replaceState = function (s, t, url) {
    if (url && blockedFeed(url)) { return; }
    return _replace.apply(this, arguments);
  };
  window.addEventListener('popstate', function () {
    if (blockedFeed(location.pathname)) { location.replace('/'); }
  }, true);

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (a && blockedFeed(a.getAttribute('href'))) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  if (blockedFeed(location.pathname)) { location.replace('/'); }

  // Remove the empty Reels slot from the bottom nav and even out the rest.
  function fixNav() {
    var reel = document.querySelector('a[href="/reels/"], a[href="/reels"]');
    if (!reel) { return; }
    var home = document.querySelector('a[href="/"]');
    var nav = null;
    if (home) {
      var anc = reel;
      while (anc && !anc.contains(home)) { anc = anc.parentElement; }
      nav = anc;
    }
    if (!nav) { nav = reel.parentElement; }
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
  function startObserver() {
    if (document.body) {
      new MutationObserver(scheduleFixNav).observe(document.body, { childList: true, subtree: true });
      fixNav();
    } else {
      requestAnimationFrame(startObserver);
    }
  }
  startObserver();
})();
true;
`;

// Backstop: block full-page loads to the Reels feed, allow everything else.
function isBlockedUrl(url) {
  try {
    const path = new URL(url).pathname;
    return path === '/reels' || path === '/reels/';
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
          onShouldStartLoadWithRequest={(req) => !isBlockedUrl(req.url)}
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