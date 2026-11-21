// Shadowline — game: the state machine (title / playing / caught /
// levelComplete / win), the main loop, scoring, and the deterministic
// ?shot= presets used to take the entry's screenshots.

import { LEVELS, TILE, ORIGIN_X, ORIGIN_Y, GRID_W, GRID_H } from './config.js';
import { Level } from './level.js';
import { Guard } from './guard.js';
import { Player } from './player.js';
import { SoundBank } from './audio.js';
import { Renderer } from './render.js';
import { Input } from './input.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.sound = new SoundBank();
    this.state = 'title';
    this.levelIndex = 0;
    this.score = 0;
    this.timesSpotted = 0;
    this.totalShards = 0;
    this.totalShardsPossible = LEVELS.reduce((n, l) => n + (l.map.join('').match(/D/g) || []).length, 0);
    this.lastBonus = 0;
    this.frozen = false; // ?shot= presets freeze the world for a stable render
    this.loadLevel(0);

    this.input.onKey = (code) => this.handleKey(code);
    this.input.onClick = (sx, sy) => {
      this.sound.ensure();
      if (this.state !== 'playing' || this.frozen) return;
      const lx = sx - ORIGIN_X;
      const ly = sy - ORIGIN_Y;
      if (lx < 0 || ly < 0 || lx > GRID_W * TILE || ly > GRID_H * TILE) return;
      if (this.level.circleFree(lx, ly, 12)) this.player.clickTarget = { x: lx, y: ly };
    };

    this.applyShotPreset();
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  loadLevel(index) {
    this.levelIndex = index;
    this.level = new Level(LEVELS[index]);
    this.player = new Player(this.level);
    this.guards = this.level.def.guards.map((g) => new Guard(g, this.level));
    this.time = 0;
    this.shardsCollected = 0;
    this.levelSpotted = false;
    this.caughtTimer = 0;
  }

  alertWord() {
    const s = this.maxSuspicion();
    if (this.state === 'caught') return { word: 'CAUGHT', color: '#ff5040' };
    if (this.guards.some((g) => g.state === 'investigate')) return { word: 'HUNTED — hide!', color: '#ff5040' };
    if (s >= 65) return { word: 'ALARM', color: '#ff5040' };
    if (s >= 30) return { word: 'SUSPICIOUS', color: '#ffb020' };
    if (s > 2) return { word: 'WATCHED', color: '#ffd65a' };
    return { word: 'UNSEEN', color: '#46ffa0' };
  }

  maxSuspicion() {
    return this.guards.reduce((m, g) => Math.max(m, g.suspicion), 0);
  }

  hintText() {
    if (this.state !== 'playing') return '';
    if (this.level.inShadow(this.player.x, this.player.y)) {
      return 'You are in shadow — guards spot you much slower here.';
    }
    if (this.player.sneaking) return 'Sneaking: slower, quieter, harder to spot.';
    return 'Reach the green EXIT. Crates block sight — shadow hides you.';
  }

  timeText() {
    const t = Math.floor(this.time);
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  }

  handleKey(code) {
    this.sound.ensure();
    if (code === 'KeyM') {
      this.sound.muted = !this.sound.muted;
      return;
    }
    if (this.state === 'title' && (code === 'Enter' || code === 'Space')) {
      this.sound.uiClick();
      this.state = 'playing';
      return;
    }
    if (this.state === 'levelComplete' && (code === 'Enter' || code === 'Space')) {
      this.sound.uiClick();
      if (this.levelIndex + 1 >= LEVELS.length) {
        this.state = 'win';
      } else {
        this.loadLevel(this.levelIndex + 1);
        this.state = 'playing';
      }
      return;
    }
    if ((this.state === 'caught' || this.state === 'win') && (code === 'KeyR' || code === 'Enter')) {
      this.sound.uiClick();
      if (this.state === 'win') {
        this.score = 0;
        this.timesSpotted = 0;
        this.totalShards = 0;
        this.loadLevel(0);
      } else {
        this.loadLevel(this.levelIndex);
      }
      this.state = 'playing';
      return;
    }
    if (this.state === 'playing' && code === 'KeyR') {
      this.sound.uiClick();
      this.loadLevel(this.levelIndex);
    }
  }

  update(dt) {
    if (this.state === 'caught') {
      this.caughtTimer += dt;
      return;
    }
    if (this.state !== 'playing') return;
    this.time += dt;

    this.player.update(dt, this.input);
    if (this.player.stepped) {
      this.sound.step(this.player.sneaking ? 0.35 : 0.8, this.player.sneaking);
    }

    let caught = false;
    for (const guard of this.guards) {
      const prevState = guard.state;
      const result = guard.update(dt, this.player);
      if (prevState !== 'investigate' && guard.state === 'investigate') {
        this.sound.alertSting();
        this.levelSpotted = true;
        this.timesSpotted += 1;
      }
      if (guard.stepped) {
        const d = Math.hypot(guard.x - this.player.x, guard.y - this.player.y);
        this.sound.step(this.sound.volumeByDistance(d, 320) * 0.7, false);
      }
      if (result === 'caught') caught = true;
    }

    // Data shards: walk over one to grab it.
    for (const shard of this.level.shards) {
      if (shard.taken) continue;
      const dx = this.player.x - (shard.tx + 0.5) * TILE;
      const dy = this.player.y - (shard.ty + 0.5) * TILE;
      if (dx * dx + dy * dy < 26 * 26) {
        shard.taken = true;
        this.shardsCollected += 1;
        this.totalShards += 1;
        this.score += 10;
        this.sound.pickup();
      }
    }

    // Exit: step on the exit tile to clear the level.
    const pt = this.player.tile();
    if (pt.tx === this.level.exitTile.tx && pt.ty === this.level.exitTile.ty) {
      const timeBonus = Math.max(0, 120 - Math.floor(this.time));
      const ghostBonus = this.levelSpotted ? 0 : 25;
      this.lastBonus = timeBonus + ghostBonus + this.shardsCollected * 10;
      this.score += this.lastBonus;
      this.sound.exitChime();
      this.state = 'levelComplete';
      return;
    }

    if (caught) {
      this.state = 'caught';
      this.caughtTimer = 0;
      this.sound.caughtSting();
    }
  }

  frame(now) {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    if (!this.frozen) this.update(dt);
    this.renderer.draw(this);
    requestAnimationFrame((t) => this.frame(t));
  }

  // -- deterministic screenshot presets (?shot=cover|sneak|alert|win) --------
  // Each preset puts the world in one fixed, readable state and freezes it,
  // so a screenshot taken a second later looks exactly the same.
  applyShotPreset() {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (!shot) return;
    this.frozen = true;
    if (shot === 'cover') {
      this.loadLevel(0);
      this.state = 'playing';
      this.time = 34;
      this.player.x = 9.5 * TILE;
      this.player.y = 6.5 * TILE;
      this.player.sneaking = true;
      this.guards[0].x = 20.5 * TILE;
      this.guards[0].y = 2.5 * TILE;
      this.guards[0].facing = Math.PI;
      this.guards[1].x = 20.5 * TILE;
      this.guards[1].y = 10.5 * TILE;
      this.guards[1].facing = -Math.PI / 2;
    } else if (shot === 'sneak') {
      this.loadLevel(1);
      this.state = 'playing';
      this.time = 67;
      this.player.x = 8.5 * TILE;
      this.player.y = 6.5 * TILE;
      this.player.sneaking = true;
      this.guards[1].x = 9.5 * TILE;
      this.guards[1].y = 8.5 * TILE;
      this.guards[1].facing = -Math.PI / 2;
      this.guards[1].suspicion = 18;
      this.guards[1].state = 'suspicious';
    } else if (shot === 'alert') {
      this.loadLevel(1);
      this.state = 'playing';
      this.time = 92;
      this.player.x = 13.5 * TILE;
      this.player.y = 3.5 * TILE;
      this.guards[0].x = 15.5 * TILE;
      this.guards[0].y = 2.5 * TILE;
      this.guards[0].facing = Math.atan2(3.5 - 2.5, 13.5 - 15.5);
      this.guards[0].suspicion = 84;
      this.guards[0].state = 'investigate';
      this.guards[0].lastSeen = { x: 13.5 * TILE, y: 3.5 * TILE };
      this.levelSpotted = true;
      this.timesSpotted = 1;
    } else if (shot === 'win') {
      this.loadLevel(2);
      this.state = 'win';
      this.time = 214;
      this.score = 486;
      this.totalShards = 5;
      this.timesSpotted = 1;
    }
  }
}

// Boot the game when the page loads.
const canvas = document.getElementById('game');
window.__shadowline = new Game(canvas);
