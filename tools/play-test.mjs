// Shadowline play-test: drives the real game in headless Chrome — title,
// movement, sneak, detection + recovery, exit, level 2 — and records every
// console error and every network request the page makes.
import { createRequire } from 'node:module';

const require = createRequire('/home/hatch/workspace/makefun/spot-shots/package.json');
const { chromium } = require('playwright-core');

const BASE = 'http://127.0.0.1:8080/index.html';
const browser = await chromium.launch({
  executablePath: '/home/hatch/workspace/makefun/spot-shots/chrome-linux64/chrome',
  args: ['--no-sandbox', '--force-color-profile=srgb', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
const requests = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('request', (r) => requests.push(r.url()));
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));

const state = () => page.evaluate(() => {
  const g = window.__shadowline;
  return {
    state: g.state,
    level: g.levelIndex,
    px: Math.round(g.player.x),
    py: Math.round(g.player.y),
    sneaking: g.player.sneaking,
    suspicion: Math.round(g.maxSuspicion()),
    guardStates: g.guards.map((x) => x.state),
    score: g.score,
    time: g.timeText(),
  };
});

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(500);
console.log('title:', JSON.stringify(await state()));

await page.keyboard.press('Enter');
await page.waitForTimeout(200);
console.log('after Enter:', JSON.stringify(await state()));

// Walk right and down with real keys.
await page.keyboard.down('KeyD');
await page.waitForTimeout(700);
await page.keyboard.up('KeyD');
await page.keyboard.down('KeyS');
await page.waitForTimeout(400);
await page.keyboard.up('KeyS');
console.log('after walking:', JSON.stringify(await state()));

// Sneak.
await page.keyboard.down('ShiftLeft');
await page.keyboard.down('KeyD');
await page.waitForTimeout(400);
await page.keyboard.up('KeyD');
await page.keyboard.up('ShiftLeft');
console.log('after sneak:', JSON.stringify(await state()));

// Walk into guard 0's cone and stand there: suspicion must rise, guard reacts.
// Place the player ahead of the guard, along the way the guard is facing.
await page.evaluate(() => {
  const g = window.__shadowline;
  const guard = g.guards[0];
  g.player.x = guard.x + Math.cos(guard.facing) * 90;
  g.player.y = guard.y + Math.sin(guard.facing) * 90;
});
await page.waitForTimeout(1000);
console.log('in cone 1.0s:', JSON.stringify(await state()));

// Flee to a shadow tile and wait: suspicion must decay, guard investigates.
await page.evaluate(() => {
  const g = window.__shadowline;
  g.player.x = 5.5 * 40;
  g.player.y = 1.5 * 40;
});
await page.waitForTimeout(2500);
console.log('hidden 2.5s:', JSON.stringify(await state()));
await page.waitForTimeout(2500);
console.log('hidden 5.0s:', JSON.stringify(await state()));

// Step on the exit tile: level must complete.
await page.evaluate(() => {
  const g = window.__shadowline;
  g.player.x = g.level.exit.x;
  g.player.y = g.level.exit.y;
});
await page.waitForTimeout(300);
console.log('on exit:', JSON.stringify(await state()));
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
console.log('level 2:', JSON.stringify(await state()));

// On level 2, stand in front of a guard until caught, then restart with R.
await page.evaluate(() => {
  const g = window.__shadowline;
  const guard = g.guards[0];
  g.player.x = guard.x + Math.cos(guard.facing) * 70;
  g.player.y = guard.y + Math.sin(guard.facing) * 70;
});
await page.waitForTimeout(3500);
console.log('caught test:', JSON.stringify(await state()));
await page.keyboard.press('KeyR');
await page.waitForTimeout(200);
console.log('after R:', JSON.stringify(await state()));

console.log('console errors:', JSON.stringify(errors));
console.log('requests:', JSON.stringify(requests, null, 1));
await browser.close();
