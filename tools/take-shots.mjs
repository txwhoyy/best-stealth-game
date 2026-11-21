// Shadowline screenshot run: renders the game's deterministic ?shot= presets
// in headless Chrome and saves 4 PNGs into screenshots/ (first by name is
// the cover). Real renders of the game's own code, nothing composited.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire('/home/hatch/workspace/makefun/spot-shots/package.json');
const { chromium } = require('playwright-core');

const OUT = '/home/hatch/workspace/makefun/best-stealth-game-repo/screenshots';
mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { name: '1-cover.png', query: '?shot=cover' },
  { name: '2-sneak.png', query: '?shot=sneak' },
  { name: '3-alert.png', query: '?shot=alert' },
  { name: '4-win.png', query: '?shot=win' },
];

const browser = await chromium.launch({
  executablePath: '/home/hatch/workspace/makefun/spot-shots/chrome-linux64/chrome',
  args: ['--no-sandbox', '--force-color-profile=srgb'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
for (const shot of SHOTS) {
  await page.goto('http://127.0.0.1:8080/index.html' + shot.query, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: OUT + '/' + shot.name });
  console.log('took', shot.name);
}
console.log('console errors:', JSON.stringify(errors));
await browser.close();
