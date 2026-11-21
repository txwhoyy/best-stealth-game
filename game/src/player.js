// Shadowline — player: WASD / arrow-key movement with wall sliding, a sneak
// mode (Shift: slower, quieter, harder to spot), and an optional click-to-move
// target for mouse play. Radius 12 px, so the player fits one-tile corridors.

import { TILE } from './config.js';

export const PLAYER_RADIUS = 12;
const WALK_SPEED = 165;
const SNEAK_SPEED = 92;

export class Player {
  constructor(level) {
    this.level = level;
    this.reset();
  }

  reset() {
    this.x = this.level.playerStart.x;
    this.y = this.level.playerStart.y;
    this.sneaking = false;
    this.moving = false;
    this.clickTarget = null;
    this.stepPhase = 0;
    this.stepped = false;
    this.facing = -Math.PI / 2;
  }

  update(dt, input) {
    this.stepped = false;
    this.sneaking = !!input.sneak;
    let mx = 0;
    let my = 0;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    if (input.up) my -= 1;
    if (input.down) my += 1;

    if (mx !== 0 || my !== 0) {
      this.clickTarget = null; // keys always win over a click target
    } else if (this.clickTarget) {
      const dx = this.clickTarget.x - this.x;
      const dy = this.clickTarget.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 6) {
        this.clickTarget = null;
      } else {
        mx = dx / dist;
        my = dy / dist;
      }
    }

    const len = Math.hypot(mx, my);
    this.moving = len > 0;
    if (!this.moving) return;

    this.sneaking = !!input.sneak;
    const speed = this.sneaking ? SNEAK_SPEED : WALK_SPEED;
    const step = speed * dt;
    const nx = this.x + mx * step;
    const ny = this.y + my * step;
    if (this.level.circleFree(nx, this.y, PLAYER_RADIUS)) this.x = nx;
    if (this.level.circleFree(this.x, ny, PLAYER_RADIUS)) this.y = ny;

    this.stepPhase += step;
    const stride = this.sneaking ? 26 : 34;
    if (this.stepPhase > stride) {
      this.stepPhase = 0;
      this.stepped = true;
    }
  }

  /** Level-local tile the player stands on. */
  tile() {
    return {
      tx: Math.floor(this.x / TILE),
      ty: Math.floor(this.y / TILE),
    };
  }
}
