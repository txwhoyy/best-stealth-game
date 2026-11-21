// Shadowline — input: keyboard state (WASD / arrows, Shift to sneak, R to
// restart, Enter to start, M to mute) plus click-to-move on the canvas.

export class Input {
  constructor(canvas) {
    this.left = false;
    this.right = false;
    this.up = false;
    this.down = false;
    this.sneak = false;
    this.keys = new Set();
    /** Callbacks the game wires up: onKey(code), onClick(levelX, levelY). */
    this.onKey = null;
    this.onClick = null;
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (e.repeat) return;
      this.keys.add(e.code);
      this.refresh();
      if (this.onKey) this.onKey(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.refresh();
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.refresh();
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.onClick) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const sx = (e.clientX - rect.left) * scaleX;
      const sy = (e.clientY - rect.top) * scaleY;
      this.onClick(sx, sy);
    });
  }

  refresh() {
    const k = this.keys;
    this.left = k.has('KeyA') || k.has('ArrowLeft');
    this.right = k.has('KeyD') || k.has('ArrowRight');
    this.up = k.has('KeyW') || k.has('ArrowUp');
    this.down = k.has('KeyS') || k.has('ArrowDown');
    this.sneak = k.has('ShiftLeft') || k.has('ShiftRight');
  }

  pressed(code) {
    return this.keys.has(code);
  }
}
