// Renders the app icon + iPad splash screens to PNG with Chromium. Run: node tests/make-icons.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium } = require(PW);

const root = resolve(new URL('..', import.meta.url).pathname);
const icon = readFileSync(resolve(root, 'assets/icons/icon.svg'), 'utf8');
mkdirSync(resolve(root, 'assets/splash'), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

async function shot(html, w, h, out, scale = 1) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(html);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: w, height: h }, omitBackground: false });
}

const iconHtml = (size, pad = 0, bg = 'transparent') => `<html><body style="margin:0;background:${bg};width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center">
  <div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${icon.replace('<svg ', '<svg style="width:100%;height:100%" ')}</div></body></html>`;
await shot(iconHtml(192), 192, 192, resolve(root, 'assets/icons/icon-192.png'));
await shot(iconHtml(512), 512, 512, resolve(root, 'assets/icons/icon-512.png'));
await shot(iconHtml(180), 180, 180, resolve(root, 'assets/icons/apple-touch-icon.png'));
// maskable: safe zone is the inner 80%, so pad the artwork on an orange field
await shot(iconHtml(512, 56, '#FF8C42'), 512, 512, resolve(root, 'assets/icons/icon-512-maskable.png'));

const sizes = [[2048, 2732], [2732, 2048], [1668, 2388], [2388, 1668], [1640, 2360], [2360, 1640], [1668, 2224], [2224, 1668], [1620, 2160], [2160, 1620], [1536, 2048], [2048, 1536]];
for (const [w, h] of sizes) {
  const s = Math.round(Math.min(w, h) * 0.26);
  const html = `<html><body style="margin:0;width:${w}px;height:${h}px;background:#fff8ec;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:${Math.round(s * 0.12)}px">
    <div style="width:${s}px;height:${s}px;border-radius:${Math.round(s * 0.22)}px;overflow:hidden;box-shadow:0 ${s * 0.06}px ${s * 0.16}px rgba(43,39,64,.14)">${icon.replace('<svg ', '<svg style="width:100%;height:100%" ')}</div>
    <div style="font-family:-apple-system,system-ui,sans-serif;font-weight:700;font-size:${Math.round(s * 0.22)}px;color:#2b2740">Numbat Maths</div></body></html>`;
  await shot(html, w, h, resolve(root, `assets/splash/splash-${w}x${h}.png`));
}
await browser.close();
console.log('icons + splash written');
