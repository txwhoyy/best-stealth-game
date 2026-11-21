// Shadowline — tuning constants and the three level definitions.
//
// Map legend (one character per tile, 26 columns x 15 rows):
//   '#' wall (blocks movement and sight)   'C' crate (cover: blocks both)
//   's' shadow floor (dark: much harder to be spotted while inside)
//   '.' open floor   'P' player start   'E' exit   'D' data shard (optional pickup)

export const TILE = 40;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const GRID_W = 26;
export const GRID_H = 15;
export const ORIGIN_X = 40;
export const ORIGIN_Y = 60;

// How fast suspicion (0-100) fills while a guard can see the player.
export const SPOT_BASE_RATE = 58;
export const SPOT_SNEAK_FACTOR = 0.42;
export const SPOT_SHADOW_FACTOR = 0.35;
export const SPOT_STILL_FACTOR = 0.72;
export const SPOT_DECAY_RATE = 30;
export const HEARING_RANGE = 110;
export const HEARING_RATE = 12;

// Guard alert bands. 30: suspicious, 65: investigates last-seen spot, 100: caught.
export const SUSPICIOUS_AT = 30;
export const INVESTIGATE_AT = 65;
export const CAUGHT_AT = 100;

export const LEVELS = [
  {
    name: 'Level 1 — The Gallery',
    sub: 'Learn the patrols. Reach the green exit unseen.',
    map: [
      '##########################',
      '#P....s......C....s......#',
      '#.............####.......#',
      '#..####...C........D.....#',
      '#..#.........####....##..#',
      '#..#..s......#......#....#',
      '#..#....C....#..C...#....#',
      '#.....####...#......#..s.#',
      '#.C..........#..s...#....#',
      '#..####..s...#......#....#',
      '#..........C....##.......#',
      '#.s....####......#...C...#',
      '#......#........#........#',
      '#..D...#....C....#...E...#',
      '##########################',
    ],
    guards: [
      { path: [[12, 3], [22, 3]], speed: 52 },
      { path: [[18, 10], [24, 10]], speed: 58 },
    ],
  },
  {
    name: 'Level 2 — The Vault',
    sub: 'More guards, tighter patrols. Shadows are your friends.',
    map: [
      '##########################',
      '#P..s....C.......s.......#',
      '#..........####.....##...#',
      '#.####....#....C....#..D.#',
      '#.#......C#....####.#....#',
      '#.#..s....#....#....#..s.#',
      '#.#.......#..C.#....#....#',
      '#....#####....#..s..#....#',
      '#.C..#........#.....#....#',
      '#...s#..C.....#..C..#..#.#',
      '#....#....s...#.....#..#.#',
      '#.####..####..#.....#..#.#',
      '#......#....C.#..s..#..#.#',
      '#..D...#......#.....#..E.#',
      '##########################',
    ],
    guards: [
      { path: [[6, 8], [13, 8]], speed: 60 },
      { path: [[11, 4], [11, 9]], speed: 56 },
      { path: [[21, 4], [21, 11]], speed: 64 },
    ],
  },
  {
    name: 'Level 3 — The Sanctum',
    sub: 'Four guards, crossing patrols. Patience wins.',
    map: [
      '##########################',
      '#P..s.....C......s....D..#',
      '#...........#####........#',
      '#.####..C..#.....#..##...#',
      '#.#......s.#..C..#..#....#',
      '#.#..####..#.....#..#..s.#',
      '#.#..#.....#..s..#..#....#',
      '#....#..C..#.....#..#....#',
      '#.s..#.....#..C..#..#....#',
      '#....#####..#....#..#....#',
      '#.C......s..#....#..#....#',
      '#..####.....#..C.#..#....#',
      '#.....s...C.#....#..#..#.#',
      '#..D........#....#...E...#',
      '##########################',
    ],
    guards: [
      { path: [[13, 1], [22, 1]], speed: 62 },
      { path: [[9, 2], [9, 7]], speed: 58 },
      { path: [[13, 4], [13, 12]], speed: 66 },
      { path: [[21, 5], [21, 12]], speed: 60 },
    ],
  },
];
