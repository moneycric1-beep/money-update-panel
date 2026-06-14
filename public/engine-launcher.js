// MONEY UPDATE - Engine Launcher
// Auto-detects Firebase config from panel's network calls,
// waits for devices to load, then injects "SMS Engine" button into each device card.

(function() {
  'use strict';

  // ============== CAPTURE FIREBASE CONFIG ==============
  // Hook into fetch / XHR / WebSocket to grab Firebase URL + API key
  // as soon as the panel starts syncing.

  var capturedFbUrl = localStorage.getItem('engine_fb_url') || '';
  var capturedFbKey = localStorage.getItem('engine_fb_key') || '';

  function captureFromUrl(url) {
    try {
      var u = String(url);

      // Match Firebase database URLs (https + wss)
      var dbMatch = u.match(/https?:\/\/([a-z0-9-]+(?:-default-rtdb)?\.(?:firebaseio\.com|firebasedatabase\.app))/i);
      if (dbMatch && !capturedFbUrl) {
        capturedFbUrl = 'https://' + dbMatch[1];
        localStorage.setItem('engine_fb_url', capturedFbUrl);
        console.log('[Engine] Captured Firebase URL:', capturedFbUrl);
      }

      // Match WebSocket URLs (wss://xxx.firebaseio.com/.ws)
      var wsMatch = u.match(/wss?:\/\/([a-z0-9-]+\.(?:firebaseio\.com|firebasedatabase\.app))/i);
      if (wsMatch && !capturedFbUrl) {
        capturedFbUrl = 'https://' + wsMatch[1];
        localStorage.setItem('engine_fb_url', capturedFbUrl);
        console.log('[Engine] Captured Firebase URL via WS:', capturedFbUrl);
      }

      // Match API key in query string
      var keyMatch = u.match(/[?&](?:key|apikey|api_key)=([^&]+)/i);
      if (keyMatch && !capturedFbKey) {
        capturedFbKey = decodeURIComponent(keyMatch[1]);
        localStorage.setItem('engine_fb_key', capturedFbKey);
        console.log('[Engine] Captured API key');
      }

      // AIza... pattern in URL (Firebase API keys)
      var aizaMatch = u.match(/AIza[A-Za-z0-9_-]{35}/);
      if (aizaMatch && !capturedFbKey) {
        capturedFbKey = aizaMatch[0];
        localStorage.setItem('engine_fb_key', capturedFbKey);
        console.log('[Engine] Captured AIza key');
      }
    } catch (e) {}
  }

  // Hook fetch
  if (window.fetch) {
    var origFetch = window.fetch;
    window.fetch = function(input, init) {
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        captureFromUrl(url);
      } catch (e) {}
      return origFetch.apply(this, arguments);
    };
  }

  // Hook XMLHttpRequest
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    try { captureFromUrl(url); } catch (e) {}
    return origOpen.apply(this, arguments);
  };

  // Hook WebSocket
  var OrigWS = window.WebSocket;
  if (OrigWS) {
    window.WebSocket = function(url, protocols) {
      try { captureFromUrl(url); } catch (e) {}
      return protocols ? new OrigWS(url, protocols) : new OrigWS(url);
    };
    window.WebSocket.prototype = OrigWS.prototype;
    Object.keys(OrigWS).forEach(function(k) { window.WebSocket[k] = OrigWS[k]; });
  }

  // Also try common storage keys used by the panel
  function refreshFromStorage() {
    var keys = ['firebaseConfig', 'fbConfig', 'firebase_config', 'panel_firebase', 'config'];
    for (var i = 0; i < keys.length; i++) {
      try {
        var raw = localStorage.getItem(keys[i]) || sessionStorage.getItem(keys[i]);
        if (!raw) continue;
        var obj = JSON.parse(raw);
        if (!capturedFbUrl) {
          var u = obj.databaseURL || obj.url || obj.firebaseUrl || obj.dbUrl;
          if (u) {
            capturedFbUrl = u;
            localStorage.setItem('engine_fb_url', u);
          }
        }
        if (!capturedFbKey) {
          var k = obj.apiKey || obj.key || obj.firebaseKey;
          if (k) {
            capturedFbKey = k;
            localStorage.setItem('engine_fb_key', k);
          }
        }
      } catch (e) {}
    }
  }

  refreshFromStorage();
  setInterval(refreshFromStorage, 5000);

  // ============== STYLES ==============
  var style = document.createElement('style');
  style.textContent = [
    '.sms-engine-card-btn{',
    '  display:inline-flex;align-items:center;gap:6px;',
    '  background:linear-gradient(135deg,#4ade80,#22c55e);',
    '  color:#000;border:none;padding:8px 14px;',
    '  border-radius:8px;font-family:Inter,sans-serif;',
    '  font-size:12px;font-weight:700;letter-spacing:.3px;',
    '  cursor:pointer;margin:6px 4px 4px 4px;',
    '  box-shadow:0 2px 8px rgba(74,222,128,.25);',
    '  transition:all .15s;',
    '}',
    '.sms-engine-card-btn:hover{',
    '  transform:translateY(-1px);',
    '  box-shadow:0 4px 16px rgba(74,222,128,.5);',
    '}',
    '.sms-engine-card-btn::before{content:"\\26A1";font-size:13px;}',
    '#sms-engine-floating{',
    '  position:fixed;bottom:24px;right:24px;z-index:99999;',
    '  background:linear-gradient(135deg,#4ade80,#22c55e);color:#000;',
    '  border:none;padding:14px 22px;border-radius:50px;',
    '  font-family:Inter,sans-serif;font-size:13px;font-weight:700;',
    '  letter-spacing:.5px;cursor:pointer;',
    '  box-shadow:0 4px 24px rgba(74,222,128,.4);',
    '  display:flex;align-items:center;gap:8px;transition:all .2s;',
    '}',
    '#sms-engine-floating:hover{transform:translateY(-2px);box-shadow:0 6px 32px rgba(74,222,128,.6);}',
    '#sms-engine-floating::before{content:"\\26A1";font-size:16px;}'
  ].join('');
  document.head.appendChild(style);

  // ============== DEVICE CARD DETECTION ==============
  // Strategy: scan for elements that contain IMEI (15 digits)
  // or device identifiers, and add an Engine button to each.

  var seenCards = new WeakSet();
  var seenDeviceIds = {};

  function findDeviceCards() {
    var nodes = [];

    // Strategy 1: data-attributes
    document.querySelectorAll('[data-device-id], [data-deviceid], [data-device]').forEach(function(el) {
      nodes.push({ el: el, id: el.getAttribute('data-device-id') || el.getAttribute('data-deviceid') || el.getAttribute('data-device') });
    });

    // Strategy 2: scan all visible cards/divs containing IMEI-like text
    var allEls = document.querySelectorAll('div, article, li, section');
    for (var i = 0; i < allEls.length; i++) {
      var el = allEls[i];
      if (seenCards.has(el)) continue;
      // Skip very large containers
      if (el.children.length > 30) continue;
      var text = el.innerText || '';
      if (text.length < 10 || text.length > 2000) continue;

      // Look for IMEI (15 digits) or 14-16 digit number
      var imeiMatch = text.match(/\b\d{14,16}\b/);
      if (!imeiMatch) continue;

      // Make sure this is the smallest container with the IMEI (not a parent)
      var hasChildWithSameImei = false;
      for (var j = 0; j < el.children.length; j++) {
        var ct = el.children[j].innerText || '';
        if (ct.indexOf(imeiMatch[0]) !== -1 && (el.children[j].innerText || '').length > 50) {
          hasChildWithSameImei = true;
          break;
        }
      }
      if (hasChildWithSameImei) continue;

      // Skip if it's a tiny inline element
      var rect = el.getBoundingClientRect();
      if (rect.height < 40 || rect.width < 100) continue;

      nodes.push({ el: el, id: imeiMatch[0] });
    }

    return nodes;
  }

  function injectButton(node) {
    if (seenCards.has(node.el)) return;
    if (!node.id) return;

    // Avoid duplicate injection by deviceId per card
    if (node.el.querySelector('.sms-engine-card-btn')) {
      seenCards.add(node.el);
      return;
    }

    var btn = document.createElement('button');
    btn.className = 'sms-engine-card-btn';
    btn.setAttribute('data-engine-device', node.id);
    btn.textContent = 'SMS ENGINE';
    btn.title = 'Open SMS Engine for ' + node.id;
    btn.addEventListener('click', function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      openEngineFor(node.id);
    });

    // Append at the end of the card
    node.el.appendChild(btn);
    seenCards.add(node.el);
    seenDeviceIds[node.id] = true;
    console.log('[Engine] Injected button for device:', node.id);
  }

  function scanAndInject() {
    var nodes = findDeviceCards();
    nodes.forEach(injectButton);

    // Hide floating button if we found cards (per-card buttons exist)
    var floating = document.getElementById('sms-engine-floating');
    if (floating) {
      var anyCardButton = document.querySelector('.sms-engine-card-btn');
      floating.style.display = anyCardButton ? 'none' : 'flex';
    }
  }

  // ============== OPEN ENGINE PAGE ==============
  function openEngineFor(deviceId) {
    var fbUrl = capturedFbUrl || localStorage.getItem('engine_fb_url') || '';
    var fbKey = capturedFbKey || localStorage.getItem('engine_fb_key') || '';

    if (!fbUrl) {
      fbUrl = prompt('Firebase Database URL not detected.\nEnter manually:', 'https://your-project.firebaseio.com');
      if (!fbUrl) return;
      capturedFbUrl = fbUrl;
      localStorage.setItem('engine_fb_url', fbUrl);
    }

    if (!deviceId) {
      deviceId = prompt('Enter Device ID:');
      if (!deviceId) return;
    }

    localStorage.setItem('engine_device_id', deviceId);

    var params = new URLSearchParams();
    params.set('fb', fbUrl);
    if (fbKey) params.set('key', fbKey);
    params.set('device', deviceId);

    window.open('engine.html?' + params.toString(), '_blank', 'width=1400,height=900');
  }

  // ============== FLOATING BUTTON (fallback) ==============
  function createFloatingButton() {
    if (document.getElementById('sms-engine-floating')) return;
    var btn = document.createElement('button');
    btn.id = 'sms-engine-floating';
    btn.textContent = 'SMS ENGINE';
    btn.title = 'Open SMS Engine (manual device)';
    btn.style.display = 'none'; // hidden until devices loaded check
    btn.addEventListener('click', function() {
      openEngineFor(null);
    });
    document.body.appendChild(btn);
  }

  // ============== BOOT ==============
  function boot() {
    createFloatingButton();
    scanAndInject();

    // Watch for DOM changes (React re-renders, devices loading)
    var observer = new MutationObserver(function(mutations) {
      // Throttle: schedule a single scan
      if (boot._scanTimer) return;
      boot._scanTimer = setTimeout(function() {
        boot._scanTimer = null;
        scanAndInject();
      }, 250);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Periodic scan as backup
    setInterval(scanAndInject, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
