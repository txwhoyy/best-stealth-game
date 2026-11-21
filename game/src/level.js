// Shadowline — level: parses a level definition into a tile grid and answers
// the questions the game asks about the world: is a tile solid, is it shadow,
// does a straight line between two points have a clear line of sight.

import { GRID_W, GRID_H, TILE, ORIGIN_X, ORIGIN_Y } from './config.js';

export const SOLID = new Set(['#', 'C']);

export class Level {
  constructor(def) {
    this.def = def;
    this.name = def.name;
    this.sub = def.sub;
    this.grid = def.map.map((row) => row.split(''));
    this.shards = [];
    this.playerStart = { x: 1.5 * TILE, y: 1.5 * TILE };
    this.exit = { x: 23.5 * TILE, y: 13.5 * TILE };
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const c = this.grid[y][x];
        if (c === 'P') this.playerStart = { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE };
        if (c === 'E') this.exit = { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE };
        if (c === 'D') this.shards.push({ tx: x, ty: y, taken: false });
      }
    }
    this.exitTile = { tx: Math.floor(this.exit.x / TILE), ty: Math.floor(this.exit.y / TILE) };
  }

  tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return '#';
    return this.grid[ty][tx];
  }

  isSolidTile(tx, ty) {
    return SOLID.has(this.tileAt(tx, ty));
  }

  isShadowTile(tx, ty) {
    return this.tileAt(tx, ty) === 's';
  }

  /** World (level-local px) -> tile coordinates. */
  tileOf(px, py) {
    return { tx: Math.floor(px / TILE), ty: Math.floor(py / TILE) };
  }

  /** Is the point inside a shadow zone? */
  inShadow(px, py) {
    const { tx, ty } = this.tileOf(px, py);
    return this.isShadowTile(tx, ty);
  }

  /** Is a circle (px, py, radius) free of solid tiles? */
  circleFree(px, py, r) {
    const minTx = Math.floor((px - r) / TILE);
    const maxTx = Math.floor((px + r) / TILE);
    const minTy = Math.floor((py - r) / TILE);
    const maxTy = Math.floor((py + r) / TILE);
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (!this.isSolidTile(tx, ty)) continue;
        const cx = Math.max(tx * TILE, Math.min(px, (tx + 1) * TILE));
        const cy = Math.max(ty * TILE, Math.min(py, (ty + 1) * TILE));
        const dx = px - cx;
        const dy = py - cy;
        if (dx * dx + dy * dy < r * r) return false;
      }
    }
    return true;
  }

  /** Line of sight between two level-local points, blocked by walls and crates. */
  hasLineOfSight(x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / 6));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const { tx, ty } = this.tileOf(x0 + dx * t, y0 + dy * t);
      if (this.isSolidTile(tx, ty)) return false;
    }
    return true;
  }

  /** Screen position of a level-local point. */
  toScreen(px, py) {
    return { x: ORIGIN_X + px, y: ORIGIN_Y + py };
  }

  shardsLeft() {
    return this.shards.filter((s) => !s.taken).length;
  }
}
