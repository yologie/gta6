// Solmar City — the whole simulation: city, traffic, pedestrians, police, wanted
// level, missions, combat, shops and saves of state. Everything here is pure
// deterministic logic: the only randomness is world.rng, the only clock is dt.
// Audio and drawing never enter; world events reach them through hooks.
import {
  AVENUES, STREETS, ROAD_W, WORLD_W, WORLD_H, BEACH_Y, SEA_Y,
  PLAYER_RADIUS, PLAYER_WALK, PLAYER_RUN, PLAYER_HEALTH,
  PUNCH_RANGE, PUNCH_DAMAGE, PUNCH_COOLDOWN, SHOOT_COOLDOWN,
  BULLET_SPEED, BULLET_RANGE, BULLET_DAMAGE,
  CAR_W, CAR_HEALTH, CAR_ACCEL, CAR_BRAKE, CAR_MAX_SPEED, CAR_REVERSE_MAX,
  CAR_TURN, TRAFFIC_COUNT, PARKED_COUNT, PED_COUNT,
  WITNESS_RADIUS, POLICE_SIGHT, WANTED_COOLDOWN_BASE, WANTED_COOLDOWN_PER_STAR,
  BUSTED_GRAB_TIME, BUSTED_RAM_TIME, SPRAY_PRICE, PISTOL_PRICE, AMMO_PRICE,
  AMMO_PER_BOX, MISSIONS, RACE_CHECKPOINTS, LANDMARKS,
  GARAGE_POINT, DOCKS_POINT, PLAZA_POINT, GUNSHOP_POINT, SPRAY_POINT,
  TARGET_CAR_POINT, BUILDING_COLORS, CAR_COLORS, PED_COLORS,
} from './config.js';
import { range, intRange, pick, clamp, dist, angleDiff } from './random.js';

let nextCarId = 1;

function rectHit(x, y, r, rect) {
  return x > rect.x - r && x < rect.x + rect.w + r && y > rect.y - r && y < rect.y + rect.h + r;
}

function onRoad(x, y) {
  for (const ay of AVENUES) if (Math.abs(y - ay) < ROAD_W / 2 + 8) return true;
  for (const sx of STREETS) if (Math.abs(x - sx) < ROAD_W / 2 + 8) return true;
  return false;
}

export function createWorld(rng, opts = {}) {
  const world = {
    rng, time: 0, over: false, won: false, overReason: '',
    shake: 0, danger: null, spawnTimer: 0, policeTimer: 0,
    buildings: [], trees: [], cars: [], peds: [], police: [],
    bullets: [], particles: [], floaters: [], pickups: [],
    toast: null, toastT: 0,
    hooks: {},
    mission: { index: 0, stage: 'steal', timer: 0, hasPackage: false, cpIndex: 0, rivalCp: 0 },
    player: null,
    prev: { enter: false },
  };
  nextCarId = 1;

  // --- buildings: fill each block between roads, skipping landmarks and the park
  const parkBlock = { x0: STREETS[1] + ROAD_W / 2 + 8, x1: STREETS[2] - ROAD_W / 2 - 8, y0: AVENUES[1] + ROAD_W / 2 + 8, y1: AVENUES[2] - ROAD_W / 2 - 8 };
  const xs = [60, ...STREETS, WORLD_W - 60];
  const ys = [60, ...AVENUES, BEACH_Y - 40];
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const x0 = xs[bi] + ROAD_W / 2 + 10;
      const x1 = xs[bi + 1] - ROAD_W / 2 - 10;
      const y0 = ys[bj] + ROAD_W / 2 + 10;
      const y1 = ys[bj + 1] - ROAD_W / 2 - 10;
      if (x1 - x0 < 70 || y1 - y0 < 70) continue;
      if (x0 >= parkBlock.x0 - 5 && x1 <= parkBlock.x1 + 5 && y0 >= parkBlock.y0 - 5 && y1 <= parkBlock.y1 + 5) continue;
      const cols = Math.max(1, Math.floor((x1 - x0) / 150));
      const rows = Math.max(1, Math.floor((y1 - y0) / 140));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rng() < 0.18) continue; // an empty lot keeps the city breathing
          const cw = (x1 - x0) / cols;
          const ch = (y1 - y0) / rows;
          const w = cw * range(rng, 0.55, 0.8);
          const h = ch * range(rng, 0.55, 0.8);
          const x = x0 + c * cw + (cw - w) / 2 + range(rng, -6, 6);
          const y = y0 + r * ch + (ch - h) / 2 + range(rng, -6, 6);
          const b = { x, y, w, h, color: pick(rng, BUILDING_COLORS) };
          let clash = false;
          for (const lm of LANDMARKS) if (rectHit(b.x + b.w / 2, b.y + b.h / 2, 30, lm)) clash = true;
          // keep the mission points clear: the spawn, the shop door, the
          // spray bay, the plaza, the docks and the target car's lot
          for (const pt of [GARAGE_POINT, DOCKS_POINT, PLAZA_POINT, GUNSHOP_POINT, SPRAY_POINT, TARGET_CAR_POINT]) {
            if (pt.x > b.x - 70 && pt.x < b.x + b.w + 70 && pt.y > b.y - 70 && pt.y < b.y + b.h + 70) clash = true;
          }
          if (!clash) world.buildings.push(b);
        }
      }
    }
  }
  // Park trees in the central green block.
  for (let i = 0; i < 16; i++) {
    world.trees.push({
      x: range(rng, parkBlock.x0 + 30, parkBlock.x1 - 30),
      y: range(rng, parkBlock.y0 + 30, parkBlock.y1 - 30),
      r: range(rng, 12, 20),
    });
  }

  // --- player: Milo Reyes, on foot in front of Dahlia's Garage
  world.player = {
    x: GARAGE_POINT.x, y: GARAGE_POINT.y, angle: -Math.PI / 2,
    vx: 0, vy: 0, health: PLAYER_HEALTH, cash: 0, hasPistol: false, ammo: 0,
    inCar: null, punchCd: 0, shootCd: 0, lastHurt: -99, grabT: 0, pinT: 0,
    wanted: 0, loseT: 0, speed: 0,
  };

  // --- traffic cars driving the roads
  for (let i = 0; i < TRAFFIC_COUNT; i++) world.cars.push(spawnTrafficCar(world));
  // --- parked cars along the kerbs (free to take, no driver to object)
  for (let i = 0; i < PARKED_COUNT; i++) {
    const road = pick(rng, AVENUES);
    const street = pick(rng, STREETS);
    const horizontal = rng() < 0.5;
    const x = horizontal ? range(rng, 120, WORLD_W - 120) : street + (rng() < 0.5 ? 34 : -34);
    const y = horizontal ? road + (rng() < 0.5 ? 34 : -34) : range(rng, 120, WORLD_H - 220);
    world.cars.push(makeCar(world, x, y, horizontal ? 0 : Math.PI / 2, pick(rng, CAR_COLORS), 'parked', 'none'));
  }
  // --- pedestrians on the sidewalks
  for (let i = 0; i < PED_COUNT; i++) world.peds.push(spawnPed(world));
  // --- cash pickups scattered on the map
  for (let i = 0; i < 12; i++) {
    world.pickups.push({
      x: range(rng, 120, WORLD_W - 120), y: range(rng, 120, BEACH_Y - 60),
      value: pick(rng, [25, 25, 50, 50, 100]), taken: false, respawn: 0,
    });
  }
  if (opts.cash) world.player.cash = opts.cash;
  if (opts.missionIndex) {
    world.mission.index = opts.missionIndex;
    startMission(world);
  }
  return world;
}

export function setHooks(world, hooks) {
  world.hooks = hooks || {};
}

function makeCar(world, x, y, angle, color, kind, driver) {
  return {
    id: nextCarId++, x, y, angle, speed: 0, color, kind, driver,
    health: CAR_HEALTH, maxHealth: CAR_HEALTH, wrecked: false,
    axis: Math.abs(Math.cos(angle)) > 0.7 ? 'h' : 'v',
    dir: Math.abs(Math.cos(angle)) > 0.7 ? (Math.cos(angle) > 0 ? 1 : -1) : (Math.sin(angle) > 0 ? 1 : -1),
    cruise: range(world.rng, 120, 185),
  };
}

function spawnTrafficCar(world) {
  const rng = world.rng;
  const horizontal = rng() < 0.5;
  let x, y, angle;
  if (horizontal) {
    const road = pick(rng, AVENUES);
    const dir = rng() < 0.5 ? 1 : -1;
    x = range(rng, 100, WORLD_W - 100);
    y = road + dir * 22;
    angle = dir > 0 ? 0 : Math.PI;
  } else {
    const street = pick(rng, STREETS);
    const dir = rng() < 0.5 ? 1 : -1;
    x = street + dir * 22;
    y = range(rng, 100, WORLD_H - 200);
    angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  const car = makeCar(world, x, y, angle, pick(rng, CAR_COLORS), 'traffic', 'traffic');
  car.speed = car.cruise;
  return car;
}

function spawnPed(world) {
  const rng = world.rng;
  const horizontal = rng() < 0.5;
  const road = horizontal ? pick(rng, AVENUES) : pick(rng, STREETS);
  const off = (rng() < 0.5 ? 62 : -62);
  return {
    x: horizontal ? range(rng, 80, WORLD_W - 80) : road + off,
    y: horizontal ? road + off : range(rng, 80, BEACH_Y - 40),
    angle: rng() * Math.PI * 2, speed: range(rng, 35, 60),
    color: pick(rng, PED_COLORS), state: 'walk', downT: 0,
    axis: horizontal ? 'h' : 'v', dir: rng() < 0.5 ? 1 : -1,
  };
}

function solidAt(world, x, y, r) {
  if (x < 20 + r || x > WORLD_W - 20 - r || y < 20 + r || y > WORLD_H - 20 - r) return true;
  if (y > SEA_Y - 4) return true; // the sea stops everyone
  for (const b of world.buildings) if (rectHit(x, y, r, b)) return true;
  for (const lm of LANDMARKS) if (rectHit(x, y, r, lm)) return true;
  for (const t of world.trees) if (dist(x, y, t.x, t.y) < t.r + r * 0.5) return true;
  return false;
}

function toast(world, text) {
  world.toast = text;
  world.toastT = 3.2;
}

function burst(world, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    if (world.particles.length > 320) return;
    const a = world.rng() * Math.PI * 2;
    const s = range(world.rng, speed * 0.3, speed);
    world.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: range(world.rng, 0.3, 0.7), color, size: range(world.rng, 2, 5) });
  }
}

function floater(world, x, y, text, color) {
  world.floaters.push({ x, y, text, color: color || '#ffd166', life: 1.4 });
}

function addWanted(world, n) {
  const p = world.player;
  if (n > 0 && p.wanted < 5) {
    p.wanted = Math.min(5, p.wanted + n);
    p.loseT = 0;
    if (world.hooks.onWanted) world.hooks.onWanted(p.wanted);
  }
}

function witnessed(world) {
  const p = world.player;
  for (const ped of world.peds) {
    if (ped.state !== 'down' && dist(p.x, p.y, ped.x, ped.y) < WITNESS_RADIUS) return true;
  }
  for (const cop of world.police) if (dist(p.x, p.y, cop.x, cop.y) < WITNESS_RADIUS) return true;
  return false;
}

// --- missions ---------------------------------------------------------------

export function missionTarget(world) {
  const m = world.mission;
  if (world.over) return null;
  switch (m.index) {
    case 0: return m.stage === 'steal' ? nearestCarPos(world) : GARAGE_POINT;
    case 1: return m.stage === 'pickup' ? DOCKS_POINT : PLAZA_POINT;
    case 2: return null;
    case 3: return RACE_CHECKPOINTS[Math.min(m.cpIndex, RACE_CHECKPOINTS.length - 1)];
    case 4: return m.stage === 'steal' ? TARGET_CAR_POINT : GARAGE_POINT;
    default: return null;
  }
}

function nearestCarPos(world) {
  const p = world.player;
  let best = null;
  let bestD = Infinity;
  for (const car of world.cars) {
    if (car.wrecked) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best ? { x: best.x, y: best.y } : null;
}

export function objectiveText(world) {
  const m = world.mission;
  if (world.won) return 'Story complete — Solmar City is yours, Milo.';
  if (m.index >= MISSIONS.length) return 'Free roam — Solmar City is yours.';
  const name = MISSIONS[m.index].name;
  switch (m.index) {
    case 0: return m.stage === 'steal' ? name + ': steal a car (E near a car)' : name + ': deliver the car to Dahlia\'s Garage';
    case 1: return m.stage === 'pickup'
      ? name + ': pick up the package at the docks'
      : name + ': deliver to the plaza — ' + Math.ceil(m.timer) + 's left';
    case 2: return m.stage === 'survive'
      ? name + ': survive 3 stars — ' + Math.ceil(m.timer) + 's'
      : name + ': lose the cops to finish';
    case 3: return name + ': checkpoint ' + (m.cpIndex + 1) + ' of 5 — beat the rival';
    case 4: return m.stage === 'steal'
      ? name + ': steal the gold coupe at the mall'
      : name + ': deliver the coupe to the garage — 4 stars on you';
    default: return name;
  }
}

function startMission(world) {
  const m = world.mission;
  const p = world.player;
  if (m.index === 0) { m.stage = 'steal'; }
  else if (m.index === 1) { m.stage = 'pickup'; m.timer = 90; m.hasPackage = false; }
  else if (m.index === 2) { m.stage = 'survive'; m.timer = 60; p.wanted = 3; p.loseT = 0; }
  else if (m.index === 3) {
    m.stage = 'race'; m.cpIndex = 0; m.rivalCp = 0;
    const rival = makeCar(world, GARAGE_POINT.x + 60, GARAGE_POINT.y + 40, 0, '#ff5964', 'rival', 'rival');
    world.cars.push(rival);
    m.rivalCarId = rival.id;
  } else if (m.index === 4) {
    m.stage = 'steal';
    const target = makeCar(world, TARGET_CAR_POINT.x, TARGET_CAR_POINT.y, 0, '#ffd166', 'target', 'none');
    target.health = 200;
    target.maxHealth = 200;
    world.cars.push(target);
    m.targetCarId = target.id;
  }
  if (world.hooks.onMissionStart) world.hooks.onMissionStart(m.index);
}

function completeMission(world) {
  const m = world.mission;
  const reward = MISSIONS[m.index].reward;
  world.player.cash += reward;
  floater(world, world.player.x, world.player.y - 30, '+$' + reward, '#ffd166');
  toast(world, MISSIONS[m.index].name + ' complete — +$' + reward);
  if (world.hooks.onMission) world.hooks.onMission(m.index, reward);
  m.index += 1;
  if (m.index >= MISSIONS.length) {
    world.won = true;
    world.over = true;
    world.overReason = 'victory';
    if (world.hooks.onWin) world.hooks.onWin();
    return;
  }
  startMission(world);
}

// --- the step ----------------------------------------------------------------

export function stepWorld(world, input, dt) {
  if (world.over) return;
  world.time += dt;
  const p = world.player;
  const rng = world.rng;
  if (world.toastT > 0) world.toastT -= dt;
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 26);
  if (world.danger && world.time - world.danger.t > 3) world.danger = null;
  if (p.punchCd > 0) p.punchCd -= dt;
  if (p.shootCd > 0) p.shootCd -= dt;
  if (p.health > 0 && p.health < PLAYER_HEALTH && world.time - p.lastHurt > 5) p.health = Math.min(PLAYER_HEALTH, p.health + 2 * dt);

  const enterEdge = input.enter && !world.prev.enter;
  world.prev.enter = !!input.enter;

  // --- player on foot
  if (!p.inCar) {
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len; my /= len;
      const speed = input.run ? PLAYER_RUN : PLAYER_WALK;
      p.angle = Math.atan2(my, mx);
      const nx = p.x + mx * speed * dt;
      const ny = p.y + my * speed * dt;
      if (!solidAt(world, nx, p.y, PLAYER_RADIUS)) p.x = nx;
      if (!solidAt(world, p.x, ny, PLAYER_RADIUS)) p.y = ny;
      p.speed = speed;
    } else p.speed = 0;

    // Punch
    if (input.action && p.punchCd <= 0) {
      p.punchCd = PUNCH_COOLDOWN;
      if (world.hooks.onPunch) world.hooks.onPunch();
      burst(world, p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, '#ffffff', 4, 120);
      for (const ped of world.peds) {
        if (ped.state === 'down') continue;
        if (dist(p.x, p.y, ped.x, ped.y) < PUNCH_RANGE) knockPed(world, ped, p);
      }
      for (const cop of world.police) {
        if (cop.kind !== 'foot') continue;
        if (dist(p.x, p.y, cop.x, cop.y) < PUNCH_RANGE + 6) {
          cop.health -= PUNCH_DAMAGE;
          burst(world, cop.x, cop.y, '#ff5964', 6, 160);
          if (cop.health <= 0) {
            cop.down = true; cop.downT = 5;
            addWanted(world, 1);
            toast(world, 'Cop down — the heat is on');
          }
        }
      }
    }

    // Shoot (F or mouse click toward the cursor)
    const wantShoot = input.shoot || input.mouseDown;
    if (wantShoot && p.shootCd <= 0 && p.hasPistol && p.ammo > 0) {
      p.shootCd = SHOOT_COOLDOWN;
      p.ammo -= 1;
      const aim = (input.mouseWX !== undefined)
        ? Math.atan2(input.mouseWY - p.y, input.mouseWX - p.x)
        : p.angle;
      p.angle = aim;
      world.bullets.push({
        x: p.x + Math.cos(aim) * 20, y: p.y + Math.sin(aim) * 20,
        vx: Math.cos(aim) * BULLET_SPEED, vy: Math.sin(aim) * BULLET_SPEED,
        life: BULLET_RANGE / BULLET_SPEED,
      });
      world.danger = { x: p.x, y: p.y, t: world.time };
      addWanted(world, 1);
      if (world.hooks.onShoot) world.hooks.onShoot();
    } else if (wantShoot && p.shootCd <= 0 && !p.hasPistol) {
      p.shootCd = SHOOT_COOLDOWN;
      toast(world, 'No pistol — buy one at the Gun Shop ($400)');
    }

    // Enter nearest car
    if (enterEdge) {
      let bestCar = null;
      let bestD = 70;
      for (const car of world.cars) {
        if (car.wrecked) continue;
        const d = dist(p.x, p.y, car.x, car.y);
        if (d < bestD) { bestD = d; bestCar = car; }
      }
      if (bestCar) enterCar(world, bestCar);
      else if (dist(p.x, p.y, GUNSHOP_POINT.x, GUNSHOP_POINT.y) < 80) buyFromGunShop(world);
    }
  } else {
    // --- player driving
    const car = p.inCar;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const moving = Math.abs(car.speed) > 5;
    if (input.up) car.speed += CAR_ACCEL * dt;
    if (input.down) car.speed -= (car.speed > 0 ? CAR_BRAKE : CAR_ACCEL * 0.6) * dt;
    if (input.action) car.speed *= Math.max(0, 1 - 3.2 * dt); // handbrake
    if (!input.up && !input.down) car.speed *= Math.max(0, 1 - 0.7 * dt);
    car.speed = clamp(car.speed, -CAR_REVERSE_MAX, CAR_MAX_SPEED);
    if (moving) car.angle += steer * CAR_TURN * dt * clamp(Math.abs(car.speed) / 160, 0.35, 1) * (car.speed < 0 ? -1 : 1);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!solidAt(world, nx, ny, 18)) {
      car.x = nx; car.y = ny;
    } else {
      if (Math.abs(car.speed) > 200) {
        damageCar(world, car, 25);
        burst(world, car.x, car.y, '#ffb703', 10, 200);
        world.shake = 9;
        if (world.hooks.onCrash) world.hooks.onCrash();
      }
      car.speed *= -0.25;
    }
    p.speed = Math.abs(car.speed);
    if (enterEdge) exitCar(world);
    // Pay 'n Spray: drive in, pay $200, wanted cleared, car fixed
    if (dist(car.x, car.y, SPRAY_POINT.x, SPRAY_POINT.y) < 95) {
      if (p.wanted > 0 && p.cash >= SPRAY_PRICE) {
        p.cash -= SPRAY_PRICE;
        p.wanted = 0; p.loseT = 0;
        car.health = car.maxHealth;
        toast(world, "Pay 'n Spray — clean slate, -$200");
        if (world.hooks.onPickup) world.hooks.onPickup();
      } else if (p.wanted > 0 && p.cash < SPRAY_PRICE) {
        toast(world, "Pay 'n Spray costs $200 — you're short");
      }
    }
  }

  // --- traffic cars
  for (const car of world.cars) {
    if (car.wrecked) continue;
    if (car.driver === 'traffic') updateTraffic(world, car, dt);
    else if (car.driver === 'rival') updateRival(world, car, dt);
    else if (car.driver === 'police') updatePoliceCar(world, car, dt);
    if (car.driver !== 'player') {
      // traffic / rival / police cars move and collide with buildings
      if (car.driver === 'traffic' || car.driver === 'rival' || car.driver === 'police') {
        const nx = car.x + Math.cos(car.angle) * car.speed * dt;
        const ny = car.y + Math.sin(car.angle) * car.speed * dt;
        if (!solidAt(world, nx, ny, 18)) { car.x = nx; car.y = ny; }
        else { car.speed *= 0.4; car.angle += 0.3; }
      }
    }
  }

  // --- car-to-car collisions (player car vs everyone)
  const playerCar = p.inCar;
  if (playerCar) {
    for (const car of world.cars) {
      if (car === playerCar || car.wrecked) continue;
      const d = dist(playerCar.x, playerCar.y, car.x, car.y);
      if (d < 44 && d > 0.01) {
        const push = (44 - d) / 2;
        const ux = (car.x - playerCar.x) / d;
        const uy = (car.y - playerCar.y) / d;
        car.x += ux * push; car.y += uy * push;
        playerCar.x -= ux * push; playerCar.y -= uy * push;
        const impact = Math.abs(playerCar.speed - car.speed);
        if (impact > 120) {
          damageCar(world, playerCar, 12);
          damageCar(world, car, 12);
          burst(world, (playerCar.x + car.x) / 2, (playerCar.y + car.y) / 2, '#ffb703', 8, 180);
          world.shake = 7;
          // a hard hit on a cop car is noticed — but only when the player
          // rammed it; a police car ramming a slow player adds no stars
          if (car.kind === 'police' && Math.abs(playerCar.speed) > 120) addWanted(world, 2);
          if (world.hooks.onCrash) world.hooks.onCrash();
          // running a pedestrian over is handled below; a hard hit on a cop car is noticed
        }
        car.speed = playerCar.speed * 0.4;
      }
    }
  }

  // --- player car running over pedestrians
  if (playerCar && Math.abs(playerCar.speed) > 140) {
    for (const ped of world.peds) {
      if (ped.state === 'down') continue;
      if (dist(playerCar.x, playerCar.y, ped.x, ped.y) < 24) {
        knockPed(world, ped, p);
        addWanted(world, 1);
        world.pickups.push({ x: ped.x, y: ped.y, value: 20, taken: false, respawn: 0 });
      }
    }
  }

  // --- pedestrians
  for (const ped of world.peds) updatePed(world, ped, dt);

  // --- police
  updatePolice(world, dt);

  // --- wanted cooldown: out of police sight long enough, lose a star
  if (p.wanted > 0) {
    let seen = false;
    for (const cop of world.police) {
      if (cop.down) continue;
      if (dist(p.x, p.y, cop.x, cop.y) < POLICE_SIGHT) { seen = true; break; }
    }
    if (!seen) {
      p.loseT += dt;
      const cd = WANTED_COOLDOWN_BASE + WANTED_COOLDOWN_PER_STAR * (p.wanted - 1);
      if (p.loseT >= cd) {
        p.wanted -= 1;
        p.loseT = 0;
        toast(world, p.wanted === 0 ? 'You lost the cops' : 'Heat dropping — ' + p.wanted + ' stars');
      }
    } else p.loseT = 0;
  }

  // --- bullets
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    const b = world.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0 || solidAt(world, b.x, b.y, 2);
    if (!dead) {
      for (const ped of world.peds) {
        if (ped.state !== 'down' && dist(b.x, b.y, ped.x, ped.y) < 16) {
          knockPed(world, ped, p); dead = true; break;
        }
      }
    }
    if (!dead) {
      for (const cop of world.police) {
        if (cop.kind === 'foot' && !cop.down && dist(b.x, b.y, cop.x, cop.y) < 16) {
          cop.health -= BULLET_DAMAGE;
          burst(world, cop.x, cop.y, '#ff5964', 6, 160);
          if (cop.health <= 0) { cop.down = true; cop.downT = 5; addWanted(world, 1); }
          dead = true; break;
        }
      }
    }
    if (!dead) {
      for (const car of world.cars) {
        if (car === p.inCar || car.wrecked) continue;
        if (dist(b.x, b.y, car.x, car.y) < 26) {
          damageCar(world, car, BULLET_DAMAGE);
          dead = true; break;
        }
      }
    }
    if (dead) {
      burst(world, b.x, b.y, '#ffd166', 4, 120);
      world.bullets.splice(i, 1);
    }
  }

  // --- pickups
  for (const pk of world.pickups) {
    if (pk.taken) {
      pk.respawn -= dt;
      if (pk.respawn <= 0) pk.taken = false;
      continue;
    }
    if (dist(p.x, p.y, pk.x, pk.y) < 34) {
      pk.taken = true; pk.respawn = 75;
      p.cash += pk.value;
      floater(world, pk.x, pk.y - 14, '+$' + pk.value, '#7CFC9A');
      if (world.hooks.onPickup) world.hooks.onPickup();
    }
  }

  // --- particles and floaters
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const pt = world.particles[i];
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
    if (pt.life <= 0) world.particles.splice(i, 1);
  }
  for (let i = world.floaters.length - 1; i >= 0; i--) {
    const f = world.floaters[i];
    f.y -= 26 * dt; f.life -= dt;
    if (f.life <= 0) world.floaters.splice(i, 1);
  }

  // --- mission progress
  updateMission(world, dt);

  // --- busted / wasted
  if (!world.over) {
    if (p.health <= 0) {
      world.over = true; world.overReason = 'wasted';
      if (world.hooks.onLose) world.hooks.onLose();
    } else if (p.grabT >= BUSTED_GRAB_TIME || p.pinT >= BUSTED_RAM_TIME) {
      world.over = true; world.overReason = 'busted';
      if (world.hooks.onBusted) world.hooks.onBusted();
    }
  }
}

function knockPed(world, ped, player) {
  ped.state = 'down';
  ped.downT = 4;
  burst(world, ped.x, ped.y, '#ff7675', 8, 150);
  world.danger = { x: ped.x, y: ped.y, t: world.time };
}

function damageCar(world, car, amount) {
  if (car.wrecked) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    car.speed = 0;
    burst(world, car.x, car.y, '#555555', 16, 220);
    burst(world, car.x, car.y, '#ffb703', 10, 180);
    if (car.driver === 'player') exitCar(world, true);
    if (car.driver === 'rival') world.mission.rivalCp = 99; // rival is out of the race
  }
}

function enterCar(world, car) {
  const p = world.player;
  if (car.driver === 'traffic') {
    // yank the driver out — they flee on foot
    const driver = spawnPed(world);
    driver.x = car.x + 40; driver.y = car.y + 30;
    driver.state = 'flee';
    world.peds.push(driver);
    if (witnessed(world)) addWanted(world, 1);
    toast(world, 'Car stolen — keep it quiet');
  }
  car.driver = 'player';
  car.kind = 'player';
  p.inCar = car;
  p.x = car.x; p.y = car.y;
  if (world.hooks.onEnterCar) world.hooks.onEnterCar();
}

function exitCar(world, wrecked) {
  const p = world.player;
  const car = p.inCar;
  if (!car) return;
  car.driver = wrecked ? 'none' : 'parked';
  car.kind = wrecked ? 'wrecked' : 'parked';
  car.speed = 0;
  p.inCar = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  if (solidAt(world, p.x, p.y, PLAYER_RADIUS)) {
    p.x = car.x - Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y - Math.sin(car.angle + Math.PI / 2) * 34;
  }
  if (wrecked) {
    p.health -= 15;
    p.lastHurt = world.time;
  }
}

function buyFromGunShop(world) {
  const p = world.player;
  if (!p.hasPistol) {
    if (p.cash >= PISTOL_PRICE) {
      p.cash -= PISTOL_PRICE;
      p.hasPistol = true;
      p.ammo = AMMO_PER_BOX;
      toast(world, 'Pistol bought — F or click to shoot');
      if (world.hooks.onPickup) world.hooks.onPickup();
    } else toast(world, 'Pistol is $400 — you have $' + p.cash);
  } else if (p.cash >= AMMO_PRICE) {
    p.cash -= AMMO_PRICE;
    p.ammo += AMMO_PER_BOX;
    toast(world, 'Ammo +12 — $' + p.cash + ' left');
    if (world.hooks.onPickup) world.hooks.onPickup();
  } else toast(world, 'Ammo box is $50 — you have $' + p.cash);
}

// --- traffic AI ---------------------------------------------------------------

function updateTraffic(world, car, dt) {
  const rng = world.rng;
  // slow for the car ahead in the same lane
  let target = car.cruise;
  for (const other of world.cars) {
    if (other === car || other.wrecked) continue;
    if (other.axis !== car.axis || other.dir !== car.dir) continue;
    const ahead = car.axis === 'h'
      ? (other.x - car.x) * car.dir
      : (other.y - car.y) * car.dir;
    const lateral = car.axis === 'h' ? Math.abs(other.y - car.y) : Math.abs(other.x - car.x);
    if (ahead > 0 && ahead < 85 && lateral < 30) { target = Math.min(target, Math.max(0, other.speed - 20)); break; }
  }
  car.speed += clamp(target - car.speed, -260 * dt, 160 * dt);
  // turn at an intersection, sometimes
  const nearX = car.axis === 'h' ? STREETS.find((s) => Math.abs(car.x - s) < 34) : null;
  const nearY = car.axis === 'v' ? AVENUES.find((a) => Math.abs(car.y - a) < 34) : null;
  if ((nearX !== undefined && nearX !== null) || (nearY !== undefined && nearY !== null)) {
    if (rng() < 0.012) {
      if (car.axis === 'h') {
        car.axis = 'v';
        car.x = nearX;
        car.dir = rng() < 0.5 ? 1 : -1;
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.axis = 'h';
        car.y = nearY;
        car.dir = rng() < 0.5 ? 1 : -1;
        car.angle = car.dir > 0 ? 0 : Math.PI;
      }
    }
  }
  // bounce off the end of a road
  if (car.axis === 'h' && (car.x < 90 || car.x > WORLD_W - 90)) { car.dir *= -1; car.angle += Math.PI; }
  if (car.axis === 'v' && (car.y < 90 || car.y > BEACH_Y - 60)) { car.dir *= -1; car.angle += Math.PI; }
}

// --- rival racer AI: drives the checkpoints in order ---------------------------

function updateRival(world, car, dt) {
  const m = world.mission;
  if (m.rivalCp >= RACE_CHECKPOINTS.length) { car.speed *= 0.95; return; }
  const cp = RACE_CHECKPOINTS[m.rivalCp];
  const want = Math.atan2(cp.y - car.y, cp.x - car.x);
  car.angle += clamp(angleDiff(car.angle, want), -2.4 * dt, 2.4 * dt);
  car.speed += clamp(430 - car.speed, -300 * dt, 260 * dt);
  if (dist(car.x, car.y, cp.x, cp.y) < 80) m.rivalCp += 1;
}

// --- police --------------------------------------------------------------------

function updatePoliceCar(world, car, dt) {
  const p = world.player;
  const want = Math.atan2(p.y - car.y, p.x - car.x);
  car.angle += clamp(angleDiff(car.angle, want), -3.2 * dt, 3.2 * dt);
  const max = 360 + p.wanted * 32;
  car.speed += clamp(max - car.speed, -320 * dt, 300 * dt);
}

// Spawn one police car on a road at the map edge, near the player.
// Exported so the chase screenshot scene can top the pursuit up.
export function addPoliceCar(world) {
  const p = world.player;
  const rng = world.rng;
  const edge = pick(rng, ['n', 's', 'e', 'w']);
  let x = 200, y = 200;
  if (edge === 'n') { x = clamp(p.x + range(rng, -500, 500), 150, WORLD_W - 150); y = AVENUES[0]; }
  if (edge === 's') { x = clamp(p.x + range(rng, -500, 500), 150, WORLD_W - 150); y = AVENUES[3]; }
  if (edge === 'e') { x = STREETS[3]; y = clamp(p.y + range(rng, -500, 500), 150, BEACH_Y - 150); }
  if (edge === 'w') { x = STREETS[0]; y = clamp(p.y + range(rng, -500, 500), 150, BEACH_Y - 150); }
  const car = makeCar(world, x, y, 0, '#2c4a6b', 'police', 'police');
  car.health = 160; car.maxHealth = 160;
  world.cars.push(car);
  world.police.push({ kind: 'car', car, x, y, angle: 0, speed: 0, health: 160, down: false, downT: 0 });
}

function updatePolice(world, dt) {
  const p = world.player;
  const rng = world.rng;
  world.policeTimer -= dt;
  const wantCars = p.wanted > 0 && p.inCar;
  const desired = p.wanted === 0 ? 0 : Math.min(p.wanted + 1, 6);
  const alive = world.police.filter((c) => !c.down);
  // composition: cars while the player drives, foot cops while on foot
  if (alive.length > 0 && alive[0].kind !== (wantCars ? 'car' : 'foot')) {
    world.police = [];
  }
  if (world.police.length < desired && world.policeTimer <= 0 && p.wanted > 0) {
    world.policeTimer = 1.4;
    if (wantCars) {
      addPoliceCar(world);
    } else {
      const a = rng() * Math.PI * 2;
      const d = range(rng, 380, 520);
      world.police.push({
        kind: 'foot', car: null,
        x: clamp(p.x + Math.cos(a) * d, 60, WORLD_W - 60),
        y: clamp(p.y + Math.sin(a) * d, 60, BEACH_Y - 60),
        angle: 0, speed: 0, health: 100, down: false, downT: 0,
      });
    }
  }
  if (p.wanted === 0) {
    // cops give up and walk off: fade the force out
    for (let i = world.police.length - 1; i >= 0; i--) {
      const cop = world.police[i];
      if (cop.kind === 'car' && cop.car) {
        cop.car.wrecked = false;
        cop.car.driver = 'traffic';
        cop.car.kind = 'traffic';
      }
      world.police.splice(i, 1);
    }
    p.grabT = 0; p.pinT = 0;
    return;
  }
  let grabbing = false;
  let pinning = false;
  for (let i = world.police.length - 1; i >= 0; i--) {
    const cop = world.police[i];
    if (cop.down) {
      cop.downT -= dt;
      if (cop.downT <= 0) world.police.splice(i, 1);
      continue;
    }
    if (cop.kind === 'car') {
      const car = cop.car;
      if (!car || car.wrecked) { world.police.splice(i, 1); continue; }
      cop.x = car.x; cop.y = car.y; cop.angle = car.angle; cop.speed = car.speed;
      // ram the player's car; pin the player when they are stopped
      if (p.inCar && dist(car.x, car.y, p.x, p.y) < 58 && Math.abs(p.inCar.speed) < 25) pinning = true;
      // a police car that loses the player by a lot gives up its spot
      if (dist(car.x, car.y, p.x, p.y) > 1500) {
        car.driver = 'traffic'; car.kind = 'traffic';
        world.police.splice(i, 1);
      }
    } else {
      // foot cop runs the player down
      const d = dist(cop.x, cop.y, p.x, p.y);
      const want = Math.atan2(p.y - cop.y, p.x - cop.x);
      cop.angle = want;
      const speed = 195 + p.wanted * 12;
      if (d > 24) {
        cop.x += Math.cos(want) * speed * dt;
        cop.y += Math.sin(want) * speed * dt;
      }
      if (!p.inCar && d < 26) {
        grabbing = true;
        if (world.time - p.lastHurt > 0.8) {
          p.health -= 8;
          p.lastHurt = world.time;
          burst(world, p.x, p.y, '#ff5964', 5, 140);
        }
      }
      if (d > 1400) world.police.splice(i, 1);
    }
  }
  if (grabbing) p.grabT += dt; else p.grabT = Math.max(0, p.grabT - dt * 2);
  if (pinning) p.pinT += dt; else p.pinT = Math.max(0, p.pinT - dt * 2);
}

// --- pedestrians -----------------------------------------------------------------

function updatePed(world, ped, dt) {
  const p = world.player;
  if (ped.state === 'down') {
    ped.downT -= dt;
    if (ped.downT <= 0) { ped.state = 'walk'; }
    return;
  }
  // flee danger: gunfire, a speeding car, or a chase nearby
  let fleeX = 0, fleeY = 0, fleeing = false;
  if (world.danger && dist(ped.x, ped.y, world.danger.x, world.danger.y) < 260) {
    fleeX = ped.x - world.danger.x; fleeY = ped.y - world.danger.y; fleeing = true;
  } else if (p.inCar && Math.abs(p.inCar.speed) > 240 && dist(ped.x, ped.y, p.x, p.y) < 130) {
    fleeX = ped.x - p.x; fleeY = ped.y - p.y; fleeing = true;
  } else if (p.wanted >= 2 && dist(ped.x, ped.y, p.x, p.y) < 160) {
    fleeX = ped.x - p.x; fleeY = ped.y - p.y; fleeing = true;
  }
  if (fleeing) {
    ped.state = 'flee';
    const len = Math.hypot(fleeX, fleeY) || 1;
    ped.angle = Math.atan2(fleeY / len, fleeX / len);
    const nx = ped.x + Math.cos(ped.angle) * 150 * dt;
    const ny = ped.y + Math.sin(ped.angle) * 150 * dt;
    if (!solidAt(world, nx, ny, 10)) { ped.x = nx; ped.y = ny; }
    return;
  }
  ped.state = 'walk';
  // stroll the sidewalk along one road; turn at intersections, sometimes
  if (ped.axis === 'h') {
    ped.x += ped.dir * ped.speed * dt;
    if (ped.x < 80 || ped.x > WORLD_W - 80) ped.dir *= -1;
    const near = STREETS.find((s) => Math.abs(ped.x - s) < 12);
    if (near !== undefined && world.rng() < 0.01) {
      ped.axis = 'v';
      ped.x = near + (ped.dir > 0 ? 62 : -62);
      ped.dir = world.rng() < 0.5 ? 1 : -1;
    }
  } else {
    ped.y += ped.dir * ped.speed * dt;
    if (ped.y < 80 || ped.y > BEACH_Y - 50) ped.dir *= -1;
    const near = AVENUES.find((a) => Math.abs(ped.y - a) < 12);
    if (near !== undefined && world.rng() < 0.01) {
      ped.axis = 'h';
      ped.y = near + (ped.dir > 0 ? 62 : -62);
      ped.dir = world.rng() < 0.5 ? 1 : -1;
    }
  }
  ped.angle = ped.axis === 'h' ? (ped.dir > 0 ? 0 : Math.PI) : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
}

// --- mission progress --------------------------------------------------------------

function updateMission(world, dt) {
  const m = world.mission;
  const p = world.player;
  if (world.won || m.index >= MISSIONS.length) return;
  if (m.index === 0) {
    if (m.stage === 'steal' && p.inCar) {
      m.stage = 'deliver';
      toast(world, 'Nice wheels — take it to Dahlia\'s Garage');
    } else if (m.stage === 'deliver' && p.inCar && dist(p.x, p.y, GARAGE_POINT.x, GARAGE_POINT.y) < 110) {
      completeMission(world);
    }
  } else if (m.index === 1) {
    if (m.stage === 'pickup' && dist(p.x, p.y, DOCKS_POINT.x, DOCKS_POINT.y) < 95) {
      m.stage = 'deliver'; m.timer = 90; m.hasPackage = true;
      toast(world, 'Package grabbed — 90 seconds to the plaza');
    } else if (m.stage === 'deliver') {
      m.timer -= dt;
      if (dist(p.x, p.y, PLAZA_POINT.x, PLAZA_POINT.y) < 95) completeMission(world);
      else if (m.timer <= 0) {
        m.stage = 'pickup'; m.hasPackage = false;
        toast(world, 'Too slow — the package is back at the docks');
      }
    }
  } else if (m.index === 2) {
    if (m.stage === 'survive') {
      m.timer -= dt;
      if (m.timer <= 0) {
        m.stage = 'lose';
        toast(world, 'You lasted — now lose the cops');
      }
    } else if (m.stage === 'lose' && p.wanted === 0) {
      completeMission(world);
    }
  } else if (m.index === 3) {
    const cp = RACE_CHECKPOINTS[m.cpIndex];
    if (cp && dist(p.x, p.y, cp.x, cp.y) < 85) {
      m.cpIndex += 1;
      if (world.hooks.onPickup) world.hooks.onPickup();
      if (m.cpIndex >= RACE_CHECKPOINTS.length) completeMission(world);
      else toast(world, 'Checkpoint ' + m.cpIndex + ' of 5');
    } else if (m.rivalCp >= RACE_CHECKPOINTS.length) {
      m.cpIndex = 0; m.rivalCp = 0;
      const rival = world.cars.find((c) => c.id === m.rivalCarId);
      if (rival) { rival.x = GARAGE_POINT.x + 60; rival.y = GARAGE_POINT.y + 40; rival.speed = 0; }
      toast(world, 'The rival won — race again from checkpoint 1');
    }
  } else if (m.index === 4) {
    const target = world.cars.find((c) => c.id === m.targetCarId);
    if (m.stage === 'steal' && p.inCar === target) {
      m.stage = 'deliver';
      p.wanted = 4; p.loseT = 0;
      toast(world, 'The coupe is yours — 4 stars, run!');
    } else if (m.stage === 'deliver' && p.inCar === target && dist(p.x, p.y, GARAGE_POINT.x, GARAGE_POINT.y) < 110) {
      completeMission(world);
    }
  }
}

// --- determinism check helper --------------------------------------------------------

// A small stable hash of the live state: same seed + same inputs must give the
// same hash. Used by the headless check, never by the game itself.
export function stateHash(world) {
  const p = world.player;
  let h = 2166136261;
  const mix = (n) => {
    h ^= (Math.round(n * 1000) & 0xffff) + 0x9e3779b9 + ((h << 6) >>> 0) + (h >>> 2);
    h = Math.imul(h, 16777619) >>> 0;
  };
  mix(p.x); mix(p.y); mix(p.health); mix(p.cash); mix(p.wanted); mix(world.mission.index);
  mix(world.mission.cpIndex); mix(world.time);
  for (const c of world.cars) { mix(c.x); mix(c.y); mix(c.speed); mix(c.health); }
  for (const ped of world.peds) { mix(ped.x); mix(ped.y); }
  for (const cop of world.police) { mix(cop.x); mix(cop.y); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export { MISSIONS as MISSION_DEFS };
