// Solmar City — the make.fun gta6-01 entry packager (Node 22, stdlib only).
//
// Solmar City is an open-world crime game set in a sun-soaked coastal city:
// explore on foot and by car, steal cars, outrun the police as your wanted
// level rises, and work through story missions. This program hands the entry
// in: it copies this directory's game/ (the playable game, plain static files
// a desktop browser loads offline) and screenshots/ into the output
// directory, then writes /output/dossier.json with the vendored make.fun
// library. The scorer's own caps are passed through, so this program fails
// exactly where the scorer would refuse the entry.
//
//   MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output (default
// /output). The program runs twice in grading and both runs must write the
// same bytes, so it does nothing time- or order-dependent here: plain copies
// plus the deterministic dossier build.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the directory this file lives in; game/ and
// screenshots/ sit beside it.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

// Solmar City's entry point: without game/index.html there is no game to
// hand in, so fail loudly instead of packaging an empty output.
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error(`no game/index.html found next to main.ts (${gameDir})`);
}

mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });

const outShots = join(outDir, 'screenshots');
mkdirSync(outShots, { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, outShots, { recursive: true });
}

// Caps from the bounty's gate: the text cap shapes the dossier bytes; the
// rest refuse an entry the scorer would refuse (more than 4 screenshots or
// one over 256 KiB; more than 993 files in game/ or 48 MiB of game files in
// all, or a path under game/ over 1000 bytes).
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`Solmar City packaged into ${outDir}`);
