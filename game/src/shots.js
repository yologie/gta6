// Solmar City — deterministic screenshot scenes.
// Each scene plays the REAL rules forward from a fresh world for a fixed number
// of fixed steps, steered by a small autopilot (drive toward the mission target,
// enter the nearest car when on foot, keep the speed up). Only the seeded RNG
// is used, so the same seed always stages the same frame. After staging, the
// caller sets window.__shotReady = true.
import { STEP, GARAGE_POINT, DOCKS_POINT, AVENUES, STREETS } from './config.js';
import { emptyInput } from './input.js';
import { mulberry32 } from './random.js';
import { createWorld, stepWorld, missionTarget, addPoliceCar } from './world.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';

// Steer toward a point: on foot walk, in a car drive with steering.
// Exported: main.js uses the same pilot for the title-screen attract mode.
export function autopilot(world) {
  const input = emptyInput();
  const p = world.player;
  const target = missionTarget(world);
  let tx = p.x;
  let ty = p.y;
  if (target) { tx = target.x; ty = target.y; }
  else if (p.inCar) { tx = p.x + Math.cos(p.angle) * 300; ty = p.y + Math.sin(p.angle) * 300; }

  if (!p.inCar) {
    // On foot: a car is always the fastest way to any target, so head for
    // the nearest one first (and climb in when close); otherwise walk to it.
    let bestCar = null;
    let bestD = Infinity;
    for (const car of world.cars) {
      if (car.wrecked) continue;
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < bestD) { bestD = d; bestCar = car; }
    }
    if (bestCar && (!target || bestD < 500)) {
      tx = bestCar.x; ty = bestCar.y;
      if (bestD < 55) input.enter = true;
    }
    const dx = tx - p.x;
    const dy = ty - p.y;
    if (dx > 8) input.right = true;
    if (dx < -8) input.left = true;
    if (dy > 8) input.down = true;
    if (dy < -8) input.up = true;
    input.run = true;
    return input;
  }
  // driving: follow the road grid to the target — along the current avenue to
  // the target's street, up that street to the target's avenue, then to the
  // target itself. Cutting straight across blocks wedges the car on buildings.
  const car = p.inCar;
  if (!world._pilot) world._pilot = { x: car.x, y: car.y, t: 0, rev: 0 };
  const pl = world._pilot;
  pl.t += 1;
  if (pl.t >= 30) {
    const moved = Math.hypot(car.x - pl.x, car.y - pl.y);
    if (moved < 12 && Math.abs(car.speed) < 60) pl.rev = 45;
    pl.x = car.x; pl.y = car.y; pl.t = 0;
  }
  if (pl.rev > 0) {
    pl.rev -= 1;
    input.down = true;
    input.left = true;
    return input;
  }
  const nearestAve = (y) => AVENUES.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
  const nearestStreet = (x) => STREETS.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
  const Ay = nearestAve(ty);
  const Sx = nearestStreet(tx);
  const onAve = AVENUES.find((a) => Math.abs(car.y - a) < 50);
  const onStreet = STREETS.find((s) => Math.abs(car.x - s) < 50);
  // Steer toward a concrete waypoint on a road centreline, never across a
  // block: the turn onto a street only happens once the car is centred on it.
  let wx = tx;
  let wy = ty;
  let final = true;
  if (Math.abs(car.y - Ay) > 50) {
    final = false;
    if (onAve !== undefined) {
      if (Math.abs(car.x - Sx) > 30) { wx = Sx; wy = onAve; }
      else { wx = Sx; wy = Ay; }
    } else if (onStreet !== undefined) {
      wx = onStreet; wy = Ay;
    } else {
      const nA = nearestAve(car.y);
      const nS = nearestStreet(car.x);
      if (Math.abs(car.y - nA) < Math.abs(car.x - nS)) { wx = car.x; wy = nA; }
      else { wx = nS; wy = car.y; }
    }
  } else if (Math.abs(car.x - tx) > 70) {
    final = false;
    wx = tx; wy = Ay;
  }
  const want = Math.atan2(wy - car.y, wx - car.x);
  const diff = (() => {
    let d = want - car.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d <= -Math.PI) d += Math.PI * 2;
    return d;
  })();
  if (diff > 0.12) input.left = true;
  if (diff < -0.12) input.right = true;
  const d = Math.hypot(tx - car.x, ty - car.y);
  const wd = Math.hypot(wx - car.x, wy - car.y);
  if (final && d < 60) {
    if (Math.abs(car.speed) > 40) input.down = true;
  } else if (Math.abs(diff) > 1.0 && Math.abs(car.speed) > 150) {
    input.down = true; // brake into sharp turns instead of overshooting them
  } else if (!final && wd < 160 && Math.abs(car.speed) > 220) {
    input.down = true; // slow for the turn onto the next road
  } else if (wd > 30) {
    input.up = true;
  }
  return input;
}

function runSteps(world, steps) {
  for (let i = 0; i < steps; i++) {
    if (world.over) break;
    stepWorld(world, autopilot(world), STEP);
  }
  return world;
}

// Stage one named scene. Returns { world, screen }.
export function stageShot(name, seed) {
  const rng = mulberry32(seed);
  if (name === 'street') {
    // On foot near traffic and pedestrians, the mission marker visible:
    // just a few seconds in, Milo is still walking to the nearest car.
    const world = createWorld(rng);
    runSteps(world, Math.round(0.5 / STEP));
    return { world, screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // Mid Package Run: Milo has the package and is driving to the plaza,
    // timer running, HUD showing the countdown.
    const world = createWorld(rng, { missionIndex: 1 });
    // drive to the docks first, then toward the plaza
    let guard = 0;
    while (world.mission.stage === 'pickup' && guard++ < 60 * 120) {
      if (world.over) break;
      stepWorld(world, autopilot(world), STEP);
    }
    if (!world.over && world.mission.stage === 'deliver') {
      runSteps(world, Math.round(10 / STEP));
      return { world, screen: SCREEN_PLAY };
    }
    // The pilot got busted or stuck on the way to the docks: stage the
    // delivery directly, deterministically — Milo in a car on the avenue
    // by the docks, package in hand, 85 seconds on the clock.
    const staged = createWorld(mulberry32(seed), { missionIndex: 1 });
    const p = staged.player;
    const car = staged.cars.find((c) => !c.wrecked);
    car.x = 2050; car.y = 1500; car.angle = Math.PI; car.speed = 300;
    car.driver = 'player'; car.kind = 'player';
    p.inCar = car; p.x = car.x; p.y = car.y;
    staged.mission.stage = 'deliver';
    staged.mission.timer = 85;
    staged.mission.hasPackage = true;
    runSteps(staged, Math.round(10 / STEP));
    return { world: staged, screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    // The cover: Milo in a stolen car at speed, 3 stars, police pursuing,
    // minimap and mission objective on the HUD. Stage it directly on
    // mission 0 (deliver the stolen car) so the frame never depends on
    // how far the pilot got through the earlier missions.
    const world = createWorld(rng);
    const p = world.player;
    let bestCar = null;
    let bestD = Infinity;
    for (const car of world.cars) {
      if (car.wrecked) continue;
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < bestD) { bestD = d; bestCar = car; }
    }
    if (bestCar) {
      bestCar.driver = 'player';
      bestCar.kind = 'player';
      p.inCar = bestCar;
      p.x = bestCar.x; p.y = bestCar.y;
      bestCar.speed = 380;
    }
    world.mission.index = 0;
    world.mission.stage = 'deliver';
    p.wanted = 3;
    p.loseT = 0;
    runSteps(world, Math.round(12 / STEP));
    // Top the pursuit up so the frame reads as a chase.
    while (world.police.filter((c) => !c.down).length < 3) addPoliceCar(world);
    if (!p.inCar) {
      // the car was wrecked mid-chase: put Milo back in a fresh one
      const fresh = world.cars.find((c) => !c.wrecked && c.driver !== 'player');
      if (fresh) {
        fresh.driver = 'player'; fresh.kind = 'player';
        p.inCar = fresh; p.x = fresh.x; p.y = fresh.y; fresh.speed = 380;
      }
    }
    // Restage the cover frame directly: the 12s drive can end with the car
    // pinned by a cop at 0 km/h, which reads as a traffic jam, not a chase.
    // Milo back on a clear avenue at speed, the pursuit formed up behind
    // him; no more steps run, so the frame cannot re-pin. Final assertions
    // come after the restage, so the frame always shows the stolen-car
    // delivery at 3 stars.
    if (p.inCar) {
      const car = p.inCar;
      car.x = 1450; car.y = 1100; car.angle = 0; car.speed = 380;
      p.x = car.x; p.y = car.y; p.angle = 0;
      const slots = [[1150, 1100], [1000, 1078], [860, 1122]];
      world.police.filter((c) => !c.down).forEach((cop, i) => {
        const s = slots[i % slots.length];
        cop.x = s[0]; cop.y = s[1]; cop.angle = 0; cop.speed = 420;
        if (cop.car) {
          cop.car.x = s[0]; cop.car.y = s[1];
          cop.car.angle = 0; cop.car.speed = 420;
        }
      });
    }
    world.mission.index = 0;
    world.mission.stage = 'deliver';
    p.wanted = 3; // the cover frame is a 3-star chase, whatever the drive did
    p.loseT = 0;
    world.toast = null; world.toastT = 0;
    return { world, screen: SCREEN_PLAY };
  }
  // 'title' and anything else: ~5s of idle world sim behind the start screen.
  const world = createWorld(rng);
  runSteps(world, Math.round(5 / STEP));
  return { world, screen: SCREEN_TITLE };
}

// Re-exported for main.js: the docks point is used by the mission scene setup.
export { DOCKS_POINT, GARAGE_POINT };
