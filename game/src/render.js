// Shadowline — render: draws the whole game on one canvas — floor, shadow
// zones, crates and walls, guard vision cones, the player, the HUD and the
// title / caught / complete / win screens. All art is drawn, no images.

import { TILE, GRID_W, GRID_H, VIEW_W, VIEW_H, ORIGIN_X, ORIGIN_Y } from './config.js';
import { CONE_RANGE, CONE_HALF_ANGLE } from './guard.js';

const TAU = Math.PI * 2;

function coneColor(guard) {
  if (guard.state === 'investigate') return 'rgba(255, 64, 48, 0.26)';
  if (guard.suspicion >= 30) return 'rgba(255, 170, 40, 0.26)';
  return 'rgba(255, 214, 90, 0.22)';
}

function coneEdge(guard) {
  if (guard.state === 'investigate') return 'rgba(255, 64, 48, 0.55)';
  if (guard.suspicion >= 30) return 'rgba(255, 170, 40, 0.5)';
  return 'rgba(255, 214, 90, 0.4)';
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  draw(game) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.drawFloor(game);
    this.drawExit(game);
    this.drawShards(game);
    this.drawCones(game);
    this.drawCratesAndWalls(game);
    this.drawGuards(game);
    this.drawPlayer(game);
    this.drawFrame(game);
    this.drawHud(game);
    if (game.state === 'title') this.drawTitle(game);
    if (game.state === 'caught') this.drawCaught(game);
    if (game.state === 'levelComplete') this.drawLevelComplete(game);
    if (game.state === 'win') this.drawWin(game);
  }

  drawFloor(game) {
    const ctx = this.ctx;
    const level = game.level;
    for (let ty = 0; ty < GRID_H; ty++) {
      for (let tx = 0; tx < GRID_W; tx++) {
        const sx = ORIGIN_X + tx * TILE;
        const sy = ORIGIN_Y + ty * TILE;
        const c = level.tileAt(tx, ty);
        if (c === '#') continue; // walls drawn later, above the floor
        const checker = (tx + ty) % 2 === 0;
        ctx.fillStyle = c === 's' ? '#171d33' : checker ? '#1a2233' : '#161d2c';
        ctx.fillRect(sx, sy, TILE, TILE);
        if (c === 's') {
          ctx.fillStyle = 'rgba(96, 120, 220, 0.10)';
          ctx.fillRect(sx + 2, sy + 2, TILE - 4, TILE - 4);
          ctx.strokeStyle = 'rgba(120, 150, 255, 0.25)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(sx + 3.5, sy + 3.5, TILE - 7, TILE - 7);
          ctx.setLineDash([]);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1);
      }
    }
  }

  drawExit(game) {
    const ctx = this.ctx;
    const p = game.level.toScreen(game.level.exit.x, game.level.exit.y);
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 350);
    const grad = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 46);
    grad.addColorStop(0, `rgba(64, 255, 150, ${0.5 * pulse})`);
    grad.addColorStop(1, 'rgba(64, 255, 150, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 46, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0e3d24';
    ctx.strokeStyle = '#46ffa0';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.rect(p.x - 15, p.y - 15, 30, 30);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#46ffa0';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', p.x, p.y + 4);
  }

  drawShards(game) {
    const ctx = this.ctx;
    for (const shard of game.level.shards) {
      if (shard.taken) continue;
      const p = game.level.toScreen((shard.tx + 0.5) * TILE, (shard.ty + 0.5) * TILE);
      const bob = Math.sin(performance.now() / 300 + shard.tx) * 2;
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#39d5ff';
      ctx.strokeStyle = '#bff1ff';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-7, -7, 14, 14);
      ctx.strokeRect(-7, -7, 14, 14);
      ctx.restore();
    }
  }

  // A cone stops at walls and crates: raycast its edge so the light reads
  // as blocked by cover, the way a player expects it to.
  drawCones(game) {
    const ctx = this.ctx;
    for (const guard of game.guards) {
      const p = game.level.toScreen(guard.x, guard.y);
      const rays = 28;
      const edge = [];
      for (let i = 0; i <= rays; i++) {
        const a = guard.facing - CONE_HALF_ANGLE + (2 * CONE_HALF_ANGLE * i) / rays;
        const d = this.raycast(game.level, guard.x, guard.y, a, CONE_RANGE);
        edge.push(game.level.toScreen(guard.x + Math.cos(a) * d, guard.y + Math.sin(a) * d));
      }
      const grad = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, CONE_RANGE);
      grad.addColorStop(0, coneColor(guard));
      grad.addColorStop(1, 'rgba(255, 214, 90, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      for (const pt of edge) ctx.lineTo(pt.x, pt.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = coneEdge(guard);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      for (const pt of edge) ctx.lineTo(pt.x, pt.y);
      ctx.closePath();
      ctx.stroke();
    }
  }

  /** Distance along a ray from (x, y) until a solid tile, at most maxDist. */
  raycast(level, x, y, angle, maxDist) {
    const step = 6;
    const dx = Math.cos(angle) * step;
    const dy = Math.sin(angle) * step;
    let cx = x;
    let cy = y;
    for (let d = step; d <= maxDist; d += step) {
      cx += dx;
      cy += dy;
      const { tx, ty } = level.tileOf(cx, cy);
      if (level.isSolidTile(tx, ty)) return d - step / 2;
    }
    return maxDist;
  }

  drawCratesAndWalls(game) {
    const ctx = this.ctx;
    const level = game.level;
    for (let ty = 0; ty < GRID_H; ty++) {
      for (let tx = 0; tx < GRID_W; tx++) {
        const c = level.tileAt(tx, ty);
        const sx = ORIGIN_X + tx * TILE;
        const sy = ORIGIN_Y + ty * TILE;
        if (c === 'C') {
          ctx.fillStyle = '#7a5a28';
          ctx.fillRect(sx + 3, sy + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = '#8f6c31';
          ctx.fillRect(sx + 3, sy + 3, TILE - 6, 8);
          ctx.strokeStyle = '#4d3a17';
          ctx.lineWidth = 2;
          ctx.strokeRect(sx + 3, sy + 3, TILE - 6, TILE - 6);
          ctx.beginPath();
          ctx.moveTo(sx + 4, sy + 4);
          ctx.lineTo(sx + TILE - 4, sy + TILE - 4);
          ctx.moveTo(sx + TILE - 4, sy + 4);
          ctx.lineTo(sx + 4, sy + TILE - 4);
          ctx.stroke();
        } else if (c === '#') {
          ctx.fillStyle = '#2c3550';
          ctx.fillRect(sx, sy, TILE, TILE);
          ctx.fillStyle = '#3a476b';
          ctx.fillRect(sx, sy, TILE, 6);
          ctx.strokeStyle = '#12151f';
          ctx.lineWidth = 1;
          ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1);
        }
      }
    }
  }

  drawGuards(game) {
    const ctx = this.ctx;
    for (const guard of game.guards) {
      const p = game.level.toScreen(guard.x, guard.y);
      // Body: a red-uniformed guard, visible against the floor at a glance.
      ctx.fillStyle = '#c22e2e';
      ctx.strokeStyle = '#ff7a6e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 13, 0, TAU);
      ctx.fill();
      ctx.stroke();
      // Facing nose / visor.
      const nx = p.x + Math.cos(guard.facing) * 13;
      const ny = p.y + Math.sin(guard.facing) * 13;
      ctx.fillStyle = '#ffd9d4';
      ctx.beginPath();
      ctx.arc(nx, ny, 4.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, TAU);
      ctx.fill();
      // Suspicion arc above the guard.
      if (guard.suspicion > 2) {
        ctx.strokeStyle = guard.suspicion >= 65 ? '#ff4030' : '#ffb020';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 20, 9, -Math.PI / 2, -Math.PI / 2 + (guard.suspicion / 100) * TAU);
        ctx.stroke();
      }
      // "?" while suspicious, "!" while investigating.
      if (guard.state === 'investigate' || guard.suspicion >= 65) {
        this.mark(p.x, p.y - 34, '!', '#ff5040');
      } else if (guard.state === 'suspicious') {
        this.mark(p.x, p.y - 34, '?', '#ffb020');
      }
    }
  }

  mark(x, y, text, color) {
    const ctx = this.ctx;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  drawPlayer(game) {
    const ctx = this.ctx;
    const player = game.player;
    const p = game.level.toScreen(player.x, player.y);
    const hidden = game.level.inShadow(player.x, player.y);
    if (hidden) {
      ctx.strokeStyle = 'rgba(120, 160, 255, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 19, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#9db8ff';
      ctx.fillText('HIDDEN', p.x, p.y - 24);
    }
    // Hooded infiltrator: teal cloak, darker hood, facing wedge.
    const r = player.sneaking ? 10 : 12;
    ctx.fillStyle = '#19b8a6';
    ctx.strokeStyle = '#0d6e63';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    const fx = p.x + Math.cos(player.facing) * (r + 2);
    const fy = p.y + Math.sin(player.facing) * (r + 2);
    ctx.fillStyle = '#d7fff6';
    ctx.beginPath();
    ctx.arc(fx, fy, 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0b3d37';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, TAU);
    ctx.fill();
    if (player.sneaking) {
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#8ff5e6';
      ctx.fillText('SNEAK', p.x, p.y - 18);
    }
  }

  drawFrame(game) {
    const ctx = this.ctx;
    ctx.strokeStyle = '#3a476b';
    ctx.lineWidth = 2;
    ctx.strokeRect(ORIGIN_X - 1, ORIGIN_Y - 1, GRID_W * TILE + 2, GRID_H * TILE + 2);
    void game;
  }

  drawHud(game) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10, 13, 20, 0.9)';
    ctx.fillRect(0, 0, VIEW_W, 48);
    ctx.fillStyle = '#e8ecf5';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(game.level.name, 16, 22);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#9aa7bd';
    ctx.fillText(game.level.sub, 16, 40);

    // Alert word + suspicion meter, centered.
    const alert = game.alertWord();
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = alert.color;
    ctx.fillText(alert.word, VIEW_W / 2, 20);
    ctx.fillStyle = '#232c42';
    ctx.fillRect(VIEW_W / 2 - 90, 28, 180, 8);
    ctx.fillStyle = alert.color;
    ctx.fillRect(VIEW_W / 2 - 90, 28, 180 * (game.maxSuspicion() / 100), 8);
    ctx.strokeStyle = '#4a5878';
    ctx.lineWidth = 1;
    ctx.strokeRect(VIEW_W / 2 - 90.5, 27.5, 181, 9);

    // Right side: shards, timer, score.
    ctx.textAlign = 'right';
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#39d5ff';
    ctx.fillText(`◆ ${game.shardsCollected} / ${game.level.shards.length}`, VIEW_W - 220, 22);
    ctx.fillStyle = '#e8ecf5';
    ctx.fillText(`⏱ ${game.timeText()}`, VIEW_W - 120, 22);
    ctx.fillStyle = '#ffd65a';
    ctx.fillText(`Score ${game.score}`, VIEW_W - 16, 22);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#9aa7bd';
    ctx.fillText('WASD move · Shift sneak · R restart · M mute · click to walk', VIEW_W - 16, 40);

    // Bottom hint line.
    ctx.textAlign = 'center';
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#7c8aa5';
    ctx.fillText(game.hintText(), VIEW_W / 2, VIEW_H - 12);
  }

  panel(title, lines, accent) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(5, 8, 14, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 620;
    const h = 120 + lines.length * 30;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    ctx.fillStyle = '#121826';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(title, VIEW_W / 2, y + 58);
    ctx.fillStyle = '#dfe6f2';
    ctx.font = '16px sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, y + 100 + i * 30));
  }

  drawTitle(game) {
    const ctx = this.ctx;
    this.panel('SHADOWLINE', [
      'A top-down stealth game. Slip past the guards, use cover and shadow,',
      'grab the data shards, and reach the green EXIT unseen.',
      '',
      'WASD / arrows — move      Shift — sneak (slower, quieter, harder to spot)',
      'Mouse click — walk there      R — restart level      M — mute',
      '',
      'Press ENTER to begin',
    ], '#19b8a6');
    ctx.fillStyle = '#7c8aa5';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('3 levels · guards patrol, get suspicious, and investigate what they saw', VIEW_W / 2, VIEW_H - 90);
    void game;
  }

  drawCaught(game) {
    this.panel('SPOTTED!', [
      'A guard caught you in the open.',
      `You reached ${game.level.name} in ${game.timeText()} — ${game.shardsCollected} shard${game.shardsCollected === 1 ? '' : 's'} grabbed.`,
      '',
      'Press R to try the level again',
    ], '#ff5040');
  }

  drawLevelComplete(game) {
    this.panel('LEVEL CLEAR', [
      `${game.level.name} — unseen or not, you made it out.`,
      `Time ${game.timeText()} · Shards ${game.shardsCollected}/${game.level.shards.length} · +${game.lastBonus} bonus`,
      '',
      'Press ENTER for the next level',
    ], '#46ffa0');
  }

  drawWin(game) {
    const ghost = game.timesSpotted === 0 ? 'GHOST — never spotted. ' : '';
    this.panel('YOU VANISHED INTO THE NIGHT', [
      `${ghost}All three levels cleared.`,
      `Final score ${game.score} · Total time ${game.timeText()} · Shards ${game.totalShards}/${game.totalShardsPossible}`,
      `Times spotted: ${game.timesSpotted}`,
      '',
      'Press R to play again',
    ], '#ffd65a');
  }
}
