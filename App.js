import React, { useRef } from 'react';
import { StyleSheet, ActivityIndicator, View, StatusBar } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const START_URL = 'https://www.instagram.com/';

const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

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
    try {
      var t = e.target;
      var nearA = t.closest ? t.closest('a') : null;
      console.log('TAP>', t.tagName,
        '| href=', (nearA ? nearA.getAttribute('href') : 'none'),
        '| role=', (t.getAttribute ? t.getAttribute('role') : 'none'));
    } catch (err) { console.log('TAP> err', err.message); }

    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) { return; }
    var href = a.getAttribute('href');
    if (blockedFeed(href)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (href && href.indexOf('/reel/') === 0 && location.pathname.indexOf('/direct/') === 0) {
      e.preventDefault();
      e.stopPropagation();
      location.assign(href);
    }
  }, true);
  if (blockedFeed(location.pathname)) { location.replace('/'); }

  function onReelPage() {
    var p = location.pathname;
    return p.indexOf('/reel/') === 0 || p.indexOf('/reels/') === 0 || p === '/reels';
  }
  function inDialog(el) {
    return el && el.closest && el.closest('[role="dialog"]');
  }
  window.addEventListener('touchmove', function (e) {
    if (onReelPage() && !inDialog(e.target)) { e.preventDefault(); }
  }, { passive: false, capture: true });
  window.addEventListener('wheel', function (e) {
    if (onReelPage() && !inDialog(e.target) && Math.abs(e.deltaY) > 0) {
      e.preventDefault();
    }
  }, { passive: false, capture: true });

  true;
})();
true;
`;

function isBlockedUrl(url) {
  try {
    const path = new URL(url).pathname;
    return path === '/reels' || path === '/reels/';
  } catch (e) {
    return false;
  }
}

export default function App() {
  const ref = useRef(null);
  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <WebView
        ref={ref}
        source={{ uri: START_URL }}
        userAgent={USER_AGENT}
        injectedJavaScriptBeforeContentLoaded={INJECTED}
        onShouldStartLoadWithRequest={(req) => {
          const ok = !isBlockedUrl(req.url);
          console.log('SHOULD>', ok, req.url);
          return ok;
        }}
        setSupportMultipleWindows={false}
        onNavigationStateChange={(s) => console.log('NAV>', s.url)}
        onError={(e) => console.log('ERR>', e.nativeEvent.description, e.nativeEvent.url)}
        onHttpError={(e) => console.log('HTTP>', e.nativeEvent.statusCode, e.nativeEvent.url)}
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