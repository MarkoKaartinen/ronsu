/*
 * Start-up guard. It runs before the app and shows a readable message with a way out if the app cannot
 * start at all (the script fails to load, throws before anything is drawn, or takes far too long), instead
 * of leaving a blank screen. main.ts removes the guard's element as soon as the app has started.
 *
 * Plain ES5 in an external file (the CSP does not allow inline scripts). It cannot use the app's
 * translations because it runs before the app, so the two languages are spelled out here.
 */
(function () {
  var fi = /^fi/i.test(navigator.language || '');
  var text = fi
    ? {
        title: 'Voi ei!',
        body: 'Sovellus ei käynnistynyt. Syynä voi olla vanhentunut välimuisti, heikko yhteys tai selaimen lisäosa.',
        retry: 'Yritä uudelleen',
        reset: 'Tyhjennä sovelluksen välimuisti ja lataa uudelleen',
      }
    : {
        title: 'Oh, no!',
        body: 'The app did not start. The cause may be an outdated cache, a poor connection or a browser add-on.',
        retry: 'Try again',
        reset: "Reset the app's cache and reload",
      };

  function appHasStarted() {
    var app = document.getElementById('app');
    return !!app && app.childNodes.length > 0;
  }

  function reset() {
    var work = [];
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      work.push(
        navigator.serviceWorker.getRegistrations().then(function (list) {
          return Promise.all(list.map(function (r) { return r.unregister(); }));
        }),
      );
    }
    if (window.caches) {
      work.push(
        caches.keys().then(function (keys) {
          return Promise.all(keys.map(function (k) { return caches.delete(k); }));
        }),
      );
    }
    Promise.all(work).then(reload, reload);
  }

  function reload() {
    location.reload();
  }

  function button(label, onclick, primary) {
    var b = document.createElement('button');
    b.textContent = label;
    b.onclick = onclick;
    b.style.cssText =
      'min-height:3rem;border-radius:.9rem;font:inherit;font-weight:' + (primary ? '700' : '600') + ';cursor:pointer;' +
      (primary
        ? 'border:0;background:var(--accent,#88c0d0);color:var(--on-accent,#2e3440)'
        : 'border:1px solid var(--border,#4c566a);background:var(--surface,#3b4252);color:var(--text,#eceff4)');
    return b;
  }

  function show(detail) {
    if (appHasStarted() || document.getElementById('boot-guard')) return;
    var box = document.createElement('main');
    box.id = 'boot-guard';
    box.setAttribute('role', 'alert');
    box.style.cssText =
      'position:fixed;inset:0;z-index:1000;box-sizing:border-box;padding:3rem 1.5rem;display:flex;flex-direction:column;' +
      'justify-content:center;gap:.8rem;max-width:28rem;margin:0 auto;font-family:system-ui,sans-serif;line-height:1.5;' +
      'background:var(--bg,#2e3440);color:var(--text,#eceff4)';
    var h = document.createElement('h1');
    h.textContent = text.title;
    h.style.cssText = 'margin:0;font-size:1.8rem';
    var p = document.createElement('p');
    p.textContent = text.body;
    p.style.margin = '0';
    box.appendChild(h);
    box.appendChild(p);
    if (detail) {
      var pre = document.createElement('pre');
      pre.textContent = detail;
      pre.style.cssText =
        'margin:0;padding:.7rem .9rem;border-radius:.6rem;background:var(--surface,#3b4252);color:var(--muted,#b4bdce);' +
        'font-size:.8rem;white-space:pre-wrap;overflow-wrap:anywhere;max-height:9rem;overflow:auto';
      box.appendChild(pre);
    }
    var actions = document.createElement('div');
    actions.style.cssText = 'display:grid;gap:.6rem;margin-top:.6rem';
    actions.appendChild(button(text.retry, reload, true));
    actions.appendChild(button(text.reset, reset, false));
    box.appendChild(actions);
    document.body.appendChild(box);
  }

  // A script or stylesheet of the app failed to load (404, blocked, offline): resource errors do not bubble,
  // so listen in the capture phase.
  window.addEventListener(
    'error',
    function (e) {
      var el = e.target;
      var critical = el && (el.tagName === 'SCRIPT' || (el.tagName === 'LINK' && /stylesheet|modulepreload/.test(el.rel)));
      if (el && el !== window && critical) {
        show('Failed to load ' + (el.src || el.href));
      } else if (!(el && el !== window) && !appHasStarted() && e.message) {
        // A script error before anything has been drawn
        setTimeout(function () { show(e.message); }, 0);
      }
    },
    true,
  );

  // Nothing drawn after a long wait: the app is stuck (e.g. a stale cache serving files that no longer exist)
  setTimeout(function () { show('Timeout: the app did not start in time'); }, 15000);
})();
