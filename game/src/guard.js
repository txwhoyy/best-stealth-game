// Shadowline — guard: patrols a waypoint loop, watches a vision cone, and
// runs the detection state machine: patrol -> suspicious -> investigate ->
// back to patrol, with suspicion that fills when the player is seen and
// decays when the player is hidden. A guard never fails the player instantly.

import {
  TILE,
  SPOT_BASE_RATE,
  SPOT_SNEAK_FACTOR,
  SPOT_SHADOW_FACTOR,
  SPOT_STILL_FACTOR,
  SPOT_DECAY_RATE,
  HEARING_RANGE,
  HEARING_RATE,
  SUSPICIOUS_AT,
  INVESTIGATE_AT,
  CAUGHT_AT,
} from './config.js';

export const CONE_RANGE = 195;
export const CONE_HALF_ANGLE = 0.62; // radians either side of facing

const TAU = Math.PI * 2;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

export class Guard {
  constructor(def, level) {
    this.level = level;
    this.waypoints = def.path.map(([tx, ty]) => ({
      x: (tx + 0.5) * TILE,
      y: (ty + 0.5) * TILE,
    }));
    this.speed = def.speed ?? 55;
    this.x = this.waypoints[0].x;
    this.y = this.waypoints[0].y;
    this.targetIndex = 1 % this.waypoints.length;
    this.facing = 0;
    this.pause = 0;
    this.state = 'patrol'; // patrol | suspicious | investigate | return
    this.suspicion = 0;
    this.lastSeen = null; // {x, y} level-local, or null
    this.lookTimer = 0;
    this.scanDir = 1;
    this.stepPhase = 0;
    this.stepped = false; // set true on a footstep this frame, read by audio
  }

  /** Can this guard see the player right now? Returns a spotting rate (0 = no). */
  spottingRate(player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > CONE_RANGE) return 0;
    const angleTo = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(angleTo, this.facing)) > CONE_HALF_ANGLE) return 0;
    if (!this.level.hasLineOfSight(this.x, this.y, player.x, player.y)) return 0;
    let rate = SPOT_BASE_RATE * (1.45 - dist / CONE_RANGE);
    if (player.sneaking) rate *= SPOT_SNEAK_FACTOR;
    if (this.level.inShadow(player.x, player.y)) rate *= SPOT_SHADOW_FACTOR;
    if (!player.moving) rate *= SPOT_STILL_FACTOR;
    return rate;
  }

  update(dt, player) {
    this.stepped = false;
    const seen = this.spottingRate(player);
    if (seen > 0) {
      this.suspicion = Math.min(CAUGHT_AT, this.suspicion + seen * dt);
      this.lastSeen = { x: player.x, y: player.y };
      // A half-seen player makes the guard stop and stare.
      if (this.suspicion >= SUSPICIOUS_AT && this.state === 'patrol') {
        this.state = 'suspicious';
        this.facing = Math.atan2(player.y - this.y, player.x - this.x);
      }
      if (this.suspicion >= INVESTIGATE_AT && this.state !== 'investigate') {
        this.state = 'investigate';
      }
    } else {
      this.suspicion = Math.max(0, this.suspicion - SPOT_DECAY_RATE * dt);
      // Loud footsteps nearby raise suspicion even without sight.
      const dist = Math.hypot(player.x - this.x, player.y - this.y);
      if (player.moving && !player.sneaking && dist < HEARING_RANGE) {
        this.suspicion = Math.min(CAUGHT_AT, this.suspicion + HEARING_RATE * dt);
        if (this.lastSeen === null) this.lastSeen = { x: player.x, y: player.y };
        if (this.suspicion >= SUSPICIOUS_AT && this.state === 'patrol') {
          this.state = 'suspicious';
          this.facing = Math.atan2(player.y - this.y, player.x - this.x);
        }
      }
    }

    if (this.suspicion >= CAUGHT_AT) return 'caught';

    switch (this.state) {
      case 'patrol':
        this.patrol(dt);
        break;
      case 'suspicious':
        // Stare at the last-seen spot; lose interest as suspicion fades.
        if (this.lastSeen) {
          this.facing = Math.atan2(this.lastSeen.y - this.y, this.lastSeen.x - this.x);
        }
        if (this.suspicion < SUSPICIOUS_AT - 6) this.state = 'patrol';
        break;
      case 'investigate': {
        if (!this.lastSeen) {
          this.state = 'return';
          break;
        }
        const arrived = this.moveToward(this.lastSeen.x, this.lastSeen.y, this.speed * 1.7, dt);
        if (arrived) {
          this.lookTimer += dt;
          this.facing += this.scanDir * dt * 1.6;
          if (this.lookTimer > 1.1) {
            this.scanDir *= -1;
            this.lookTimer = 0;
            this.state = 'return';
          }
        }
        if (this.suspicion < INVESTIGATE_AT - 25) this.state = 'return';
        break;
      }
      case 'return': {
        const wp = this.waypoints[this.targetIndex];
        const arrived = this.moveToward(wp.x, wp.y, this.speed, dt);
        if (arrived) this.state = 'patrol';
        break;
      }
      default:
        this.patrol(dt);
    }
    return null;
  }

  patrol(dt) {
    if (this.pause > 0) {
      this.pause -= dt;
      // Scan the room slowly while paused at a waypoint.
      this.facing += Math.sin(performance.now() / 900) * dt * 0.5;
      return;
    }
    const wp = this.waypoints[this.targetIndex];
    const arrived = this.moveToward(wp.x, wp.y, this.speed, dt);
    if (arrived) {
      this.targetIndex = (this.targetIndex + 1) % this.waypoints.length;
      this.pause = 1.1;
    }
  }

  /** Move toward a point, sliding along walls. Returns true when arrived. */
  moveToward(tx, ty, speed, dt) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return true;
    const step = Math.min(dist, speed * dt);
    const nx = this.x + (dx / dist) * step;
    const ny = this.y + (dy / dist) * step;
    this.facing = Math.atan2(dy, dx);
    if (this.level.circleFree(nx, this.y, 12)) this.x = nx;
    if (this.level.circleFree(this.x, ny, 12)) this.y = ny;
    this.stepPhase += step;
    if (this.stepPhase > 34) {
      this.stepPhase = 0;
      this.stepped = true;
    }
    return false;
  }
}
