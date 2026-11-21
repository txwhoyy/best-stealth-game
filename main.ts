// Shadowline — entrypoint for make.fun's "Make the best stealth game" bounty.
//
// Copies game/ and screenshots/ from this repository into the output
// directory and writes dossier.json there with buildDossier from the kit's
// vendor/makefun-game.ts. Standard library only; runs on Node 22.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const GAME_DIR = join(REPO_ROOT, 'game');
const SHOTS_DIR = join(REPO_ROOT, 'screenshots');

function fail(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

// The entry is the game plus its screenshots; both must be present.
if (!existsSync(join(GAME_DIR, 'index.html'))) {
  fail('game/index.html is missing');
}
if (!existsSync(SHOTS_DIR) || !statSync(SHOTS_DIR).isDirectory()) {
  fail('screenshots/ is missing');
}
const shotNames = readdirSync(SHOTS_DIR).filter((n) => !n.startsWith('.'));
if (shotNames.length < 3 || shotNames.length > 4) {
  fail(`screenshots/ holds ${shotNames.length} images, need 3 or 4`);
}
for (const name of shotNames) {
  const st = statSync(join(SHOTS_DIR, name));
  if (!st.isFile()) fail(`screenshots/${name} is not a regular file`);
  if (st.size > 256 * 1024) fail(`screenshots/${name} is over 256 KiB`);
}

// Fresh output directory, then copy the two trees in verbatim.
mkdirSync(OUT_DIR, { recursive: true });
cpSync(GAME_DIR, join(OUT_DIR, 'game'), { recursive: true, dereference: false });
cpSync(SHOTS_DIR, join(OUT_DIR, 'screenshots'), { recursive: true, dereference: false });

// The dossier is byte for byte what the kit's library writes from them.
// Build it twice: the grader runs this program twice and both runs must
// write the same bytes, so prove determinism here before writing anything.
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};
const first = buildDossier(OUT_DIR, caps);
const second = buildDossier(OUT_DIR, caps);
if (!Buffer.from(first).equals(Buffer.from(second))) {
  fail('dossier is not deterministic across builds');
}
const dossier = first;
writeFileSync(join(OUT_DIR, 'dossier.json'), dossier);

console.log(`main.ts: wrote ${OUT_DIR}/dossier.json (${dossier.length} bytes)`);
console.log(`main.ts: game/ + ${shotNames.length} screenshots copied to ${OUT_DIR}`);
for (const name of shotNames) {
  const st = statSync(join(OUT_DIR, 'screenshots', name));
  console.log(`main.ts: screenshots/${name} (${st.size} bytes)`);
}
