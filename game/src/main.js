// Solmar City — bootstrap, fixed-step game loop, and the screen state machine.
// Screens: title -> play -> paused -> victory / gameover. The loop runs a fixed
// 60 Hz simulation with an accumulator; rendering is decoupled from updates.
// Best cash and mission progress persist in localStorage.
import {
  attachInput, anyPressed, flushPressed, mousePos, pointInRect,
  readInput, takeClick, wasPressed,
} from './input.js';
import {
  ensureAudio, updateEngine, toggleMute,
  sfxClick, sfxCrash, sfxGunshot, sfxMission, sfxPickup, sfxPunch, sfxBusted, sfxDenied,
} from './audio.js';
import { STEP, WIDTH, HEIGHT, WORLD_W, WORLD_H } from './config.js';
import { liveRng, clamp } from './random.js';
import {
  render, screenButtons,
  SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_VICTORY,
} from './render.js';
import { autopilot, stageShot } from './shots.js';
import { createWorld, setHooks, stepWorld } from './world.js';

const BEST_KEY = 'solmar-best-cash';
const SAVE_KEY = 'solmar-save';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let screen = SCREEN_TITLE;
let world = createWorld(liveRng());
let best = 0;
let save = null;
try {
  best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) save = JSON.parse(raw);
} catch { best = 0; save = null; }

attachInput(canvas);

function liveHooks() {
  return {
    onPunch: () => sfxPunch(),
    onShoot: () => sfxGunshot(),
    onPickup: () => sfxPickup(),
    onCrash: () => sfxCrash(),
    onMission: () => { sfxMission(); saveBest(); saveProgress(); },
    onWin: () => { sfxMission(); saveBest(); saveProgress(); },
    onLose: () => sfxBusted(),
    onBusted: () => sfxBusted(),
    onWanted: () => {},
    onEnterCar: () => sfxClick(),
    onMissionStart: () => {},
  };
}
setHooks(world, liveHooks());

function saveBest() {
  if (world.player.cash > best) {
    best = world.player.cash;
    try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* storage may be blocked */ }
  }
}

function saveProgress() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: world.player.cash,
      missions: Math.min(world.mission.index, 5),
    }));
  } catch { /* storage may be blocked */ }
}

function clearSave() {
  save = null;
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage may be blocked */ }
}

function startRun(fromSave) {
  ensureAudio();
  flushPressed();
  if (fromSave && save) {
    world = createWorld(liveRng(), { cash: save.cash, missionIndex: save.missions });
  } else {
    world = createWorld(liveRng());
    if (!fromSave) clearSave();
  }
  setHooks(world, liveHooks());
  screen = SCREEN_PLAY;
}

function endRunIfOver() {
  if (!world.over) return;
  saveBest();
  saveProgress();
  screen = world.won ? SCREEN_VICTORY : SCREEN_OVER;
}

// Read-only debug handle for the verifier: it can watch cash/missions/wanted
// move during scripted playtests. Never used by the game itself.
window.__solmar = {
  get state() { return screen; },
  get cash() { return world.player.cash; },
  get missions() { return world.mission.index; },
  get wanted() { return world.player.wanted; },
  get health() { return world.player.health; },
  get inCar() { return !!world.player.inCar; },
  get over() { return world.over; },
  get running() { return !document.hidden; },
};

// --- screenshot scenes -------------------------------------------------------
// ?shot=chase|street|mission|title&seed=1 stages a deterministic scene and
// freezes on it; the verifier screenshots that frame.
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
let shotMode = false;
if (shotName) {
  const seed = Number(params.get('seed') || 1) || 1;
  const staged = stageShot(shotName, seed);
  world = staged.world;
  screen = staged.screen;
  shotMode = true;
  if (world.player.cash > best) best = world.player.cash;
}

// --- per-frame input ---------------------------------------------------------

function cameraX() {
  return clamp(world.player.x - WIDTH / 2, 0, Math.max(0, WORLD_W - WIDTH));
}
function cameraY() {
  return clamp(world.player.y - HEIGHT / 2, 0, Math.max(0, WORLD_H - HEIGHT));
}

function handleGlobalKeys() {
  if (wasPressed('KeyM')) toggleMute();
  if (wasPressed('KeyR') && (screen === SCREEN_VICTORY || screen === SCREEN_OVER || screen === SCREEN_PAUSED)) {
    sfxClick();
    startRun(false);
    return;
  }
  if (wasPressed('KeyP')) {
    if (screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
    else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
  }
}

function handleClicks() {
  const click = takeClick();
  if (!click) return;
  ensureAudio();
  for (const b of screenButtons(screen, world)) {
    if (pointInRect(click.x, click.y, b)) {
      sfxClick();
      if (b.id === 'start') startRun(!!save);
      else if (b.id === 'again') startRun(false);
      else if (b.id === 'resume') screen = SCREEN_PLAY;
      else if (b.id === 'restart') startRun(false);
      return;
    }
  }
}

function hoverButton() {
  const m = mousePos();
  for (const b of screenButtons(screen, world)) {
    if (pointInRect(m.x, m.y, b)) return b.id;
  }
  return null;
}

// --- the loop ----------------------------------------------------------------

let last = performance.now();
let acc = 0;
let elapsed = 0; // wall-clock seconds since load, for ambient animation

function frame(now) {
  requestAnimationFrame(frame);
  const dtMs = Math.min(100, now - last);
  last = now;
  acc += dtMs / 1000;
  elapsed += dtMs / 1000;

  handleGlobalKeys();
  handleClicks();

  // Enter starts from the title (continuing a save when one exists);
  // Enter or R also restarts from the end screens.
  if (screen === SCREEN_TITLE && anyPressed(['Enter', 'NumpadEnter'])) {
    startRun(!!save);
  } else if ((screen === SCREEN_VICTORY || screen === SCREEN_OVER) && wasPressed('Enter')) {
    startRun(false);
  }

  // Simulation.
  if (!shotMode) {
    if (screen === SCREEN_PLAY) {
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        const input = readInput();
        input.mouseWX = input.mouseX + cameraX();
        input.mouseWY = input.mouseY + cameraY();
        stepWorld(world, input, STEP);
        acc -= STEP;
        steps++;
      }
      if (steps === 5) acc = 0; // drop backlog after a hitch, never spiral
      endRunIfOver();
    } else if (screen === SCREEN_TITLE) {
      // Attract mode: the world plays itself behind the title, steered by the
      // same autopilot the screenshot scenes use — no duplicate pilot here.
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        stepWorld(world, autopilot(world), STEP);
        acc -= STEP;
        steps++;
      }
      if (steps === 5) acc = 0;
      if (world.over) {
        world = createWorld(liveRng());
        setHooks(world, liveHooks());
      }
    } else {
      acc = 0;
    }
  }

  // Engine hum and siren follow live state; cosmetic only.
  if (!shotMode) {
    const p = world.player;
    updateEngine(p.inCar ? Math.abs(p.inCar.speed) : p.speed, p.wanted, dtMs / 1000);
  }

  // In shot mode the world is frozen, so freeze the clock too: the staged
  // frame must be pixel-stable across runs (waves and markers drift with t).
  render(ctx, screen, world, best, hoverButton(), shotMode ? 0 : elapsed, save);
}

requestAnimationFrame(frame);

// The screenshot scenes render once and announce readiness.
if (shotMode) {
  render(ctx, screen, world, best, null, 0, save);
  window.__shotReady = true;
}
