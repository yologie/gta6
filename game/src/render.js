// Solmar City — every pixel is drawn in code: the city, the cars, the people, the
// HUD, the minimap and every menu. No image files, no fonts fetched, no network.
// The camera follows Milo; the minimap always shows the whole city at a glance.
import {
  WIDTH, HEIGHT, WORLD_W, WORLD_H, AVENUES, STREETS, ROAD_W, BEACH_Y, SEA_Y,
  COLORS, LANDMARKS, MISSIONS, RACE_CHECKPOINTS,
  GARAGE_POINT, DOCKS_POINT, PLAZA_POINT, GUNSHOP_POINT, SPRAY_POINT, TARGET_CAR_POINT,
} from './config.js';
import { clamp, dist } from './random.js';
import { missionTarget, objectiveText } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'gameover';
export const SCREEN_VICTORY = 'victory';

const MINIMAP_W = 230;
const MINIMAP_H = 160;

function cameraFor(world) {
  const p = world.player;
  return {
    x: clamp(p.x - WIDTH / 2, 0, Math.max(0, WORLD_W - WIDTH)),
    y: clamp(p.y - HEIGHT / 2, 0, Math.max(0, WORLD_H - HEIGHT)),
  };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, x, y, angle, color, opts) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  rr(ctx, -21, -11, 46, 26, 7);
  ctx.fill();
  ctx.fillStyle = color;
  rr(ctx, -23, -13, 48, 26, 7);
  ctx.fill();
  ctx.fillStyle = '#1c2733';
  rr(ctx, -8, -10, 16, 20, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  rr(ctx, -6, -9, 12, 18, 2);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(22, -10, 3, 5);
  ctx.fillRect(22, 5, 3, 5);
  ctx.fillStyle = '#ff5964';
  ctx.fillRect(-25, -10, 3, 5);
  ctx.fillRect(-25, 5, 3, 5);
  if (opts && opts.police) {
    ctx.fillStyle = '#f4f6f8';
    ctx.fillRect(-14, -13, 12, 26);
    ctx.fillStyle = Math.floor((opts.t || 0) * 3) % 2 === 0 ? '#ff3b30' : '#2f7bff';
    ctx.fillRect(-12, -8, 4, 6);
    ctx.fillStyle = Math.floor((opts.t || 0) * 3) % 2 === 0 ? '#2f7bff' : '#ff3b30';
    ctx.fillRect(-12, 2, 4, 6);
  }
  if (opts && opts.target) {
    ctx.strokeStyle = '#fff3b0';
    ctx.lineWidth = 2;
    rr(ctx, -25, -15, 52, 30, 8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color, opts) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath();
  ctx.arc(Math.cos(angle) * 3, Math.sin(angle) * 3, 5.5, 0, Math.PI * 2);
  ctx.fill();
  if (opts && opts.cop) {
    ctx.fillStyle = '#1c2f4a';
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 3, Math.sin(angle) * 3, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 3, Math.sin(angle) * 3, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCity(ctx, world, cam, t) {
  // ground: grass, then the sand strip and the sea at the south edge
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(-cam.x, -cam.y, WORLD_W, WORLD_H);
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(-cam.x, BEACH_Y - cam.y, WORLD_W, WORLD_H - BEACH_Y);
  ctx.fillStyle = COLORS.sea;
  ctx.fillRect(-cam.x, SEA_Y - cam.y, WORLD_W, WORLD_H - SEA_Y);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const wy = SEA_Y + 14 + i * 12 + Math.sin(t * 1.4 + i * 1.7) * 3;
    ctx.beginPath();
    for (let x = 0; x <= WORLD_W; x += 60) {
      const yy = wy + Math.sin(x * 0.02 + t + i) * 2;
      if (x === 0) ctx.moveTo(x - cam.x, yy - cam.y);
      else ctx.lineTo(x - cam.x, yy - cam.y);
    }
    ctx.stroke();
  }
  // park block: green lawn, paths, trees
  ctx.fillStyle = COLORS.park;
  ctx.fillRect(900 + ROAD_W / 2 - cam.x, 700 + ROAD_W / 2 - cam.y, 1450 - 900 - ROAD_W, 1100 - 700 - ROAD_W);
  ctx.strokeStyle = '#e8dcc0';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(945 - cam.x, 900 - cam.y);
  ctx.lineTo(1405 - cam.x, 900 - cam.y);
  ctx.moveTo(1175 - cam.x, 745 - cam.y);
  ctx.lineTo(1175 - cam.x, 1055 - cam.y);
  ctx.stroke();
  for (const tree of world.trees) {
    ctx.fillStyle = '#3d7a2e';
    ctx.beginPath();
    ctx.arc(tree.x - cam.x, tree.y - cam.y, tree.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5da83f';
    ctx.beginPath();
    ctx.arc(tree.x - cam.x - 3, tree.y - cam.y - 3, tree.r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  // sidewalks: pale bands flanking every road
  ctx.fillStyle = COLORS.sidewalk;
  for (const ay of AVENUES) ctx.fillRect(-cam.x, ay - ROAD_W / 2 - 14 - cam.y, WORLD_W, ROAD_W + 28);
  for (const sx of STREETS) ctx.fillRect(sx - ROAD_W / 2 - 14 - cam.x, -cam.y, ROAD_W + 28, WORLD_H);
  // roads
  ctx.fillStyle = COLORS.road;
  for (const ay of AVENUES) ctx.fillRect(-cam.x, ay - ROAD_W / 2 - cam.y, WORLD_W, ROAD_W);
  for (const sx of STREETS) ctx.fillRect(sx - ROAD_W / 2 - cam.x, -cam.y, ROAD_W, WORLD_H);
  // centre dashes
  ctx.fillStyle = COLORS.roadLine;
  for (const ay of AVENUES) {
    for (let x = 30; x < WORLD_W; x += 64) ctx.fillRect(x - cam.x, ay - 3 - cam.y, 34, 6);
  }
  for (const sx of STREETS) {
    for (let y = 30; y < WORLD_H; y += 64) ctx.fillRect(sx - 3 - cam.x, y - cam.y, 6, 34);
  }
  // buildings: coloured block, darker roof edge, lit windows
  for (const b of world.buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, 8);
    ctx.fillRect(b.x - cam.x, b.y - cam.y, 8, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if ((c * 7 + r * 3) % 3 !== 0) continue;
        ctx.fillRect(b.x + 12 + c * 26 - cam.x, b.y + 14 + r * 26 - cam.y, 10, 12);
      }
    }
  }
  // landmarks: solid plots with a sign
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px system-ui, sans-serif';
  for (const lm of LANDMARKS) {
    ctx.fillStyle = lm.color;
    ctx.fillRect(lm.x - cam.x, lm.y - cam.y, lm.w, lm.h);
    ctx.fillStyle = lm.roof;
    ctx.fillRect(lm.x - cam.x, lm.y - cam.y, lm.w, 14);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(lm.name, lm.x + lm.w / 2 - cam.x, lm.y + lm.h / 2 + 5 - cam.y);
  }
  // docks: wooden pier into the beach
  ctx.fillStyle = '#8a6d4b';
  ctx.fillRect(2280 - cam.x, 1640 - cam.y, 24, 100);
  ctx.fillRect(2240 - cam.x, 1620 - cam.y, 110, 24);
}

function drawMarker(ctx, world, cam, t) {
  const target = missionTarget(world);
  if (!target) return;
  const bounce = Math.sin(t * 3) * 8;
  const sx = target.x - cam.x;
  const sy = target.y - cam.y - 46 + bounce;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 209, 102, 0.18)';
  ctx.beginPath();
  ctx.arc(target.x - cam.x, target.y - cam.y, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(target.x - cam.x, target.y - cam.y, 52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(sx, sy + 26);
  ctx.lineTo(sx - 13, sy);
  ctx.lineTo(sx + 13, sy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // off-screen edge arrow pointing at the target, with the distance in metres
  const p = world.player;
  const tx = target.x - cam.x;
  const ty = target.y - cam.y;
  if (tx < 0 || tx > WIDTH || ty < 0 || ty > HEIGHT) {
    const ax = clamp(tx, 44, WIDTH - 44);
    const ay = clamp(ty, 44, HEIGHT - 44);
    const ang = Math.atan2(ty - ay, tx - ax);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(Math.hypot(target.x - p.x, target.y - p.y) / 10) + 'm', ax, ay + 30);
  }
}

function drawWorld(ctx, world, t) {
  const cam = cameraFor(world);
  const shakeX = world.shake > 0 ? Math.sin(world.time * 47) * world.shake * 0.5 : 0;
  const shakeY = world.shake > 0 ? Math.cos(world.time * 39) * world.shake * 0.5 : 0;
  const camS = { x: cam.x + shakeX, y: cam.y + shakeY };
  ctx.save();
  drawCity(ctx, world, camS, t);
  // cash pickups
  for (const pk of world.pickups) {
    if (pk.taken) continue;
    const bob = Math.sin(t * 2 + pk.x) * 3;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(pk.x - camS.x, pk.y - camS.y + bob, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a6d1f';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', pk.x - camS.x, pk.y - camS.y + 4 + bob);
  }
  drawMarker(ctx, world, camS, t);
  // cars
  for (const car of world.cars) {
    if (car.wrecked) {
      drawCarShape(ctx, car.x - camS.x, car.y - camS.y, car.angle, '#5a5a60', {});
      ctx.fillStyle = 'rgba(90,90,90,0.5)';
      ctx.beginPath();
      ctx.arc(car.x - camS.x, car.y - camS.y - 14, 10 + Math.sin(t * 2) * 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    drawCarShape(ctx, car.x - camS.x, car.y - camS.y, car.angle, car.color, {
      police: car.kind === 'police',
      target: car.kind === 'target',
      t,
    });
  }
  // pedestrians
  for (const ped of world.peds) {
    if (ped.state === 'down') {
      ctx.save();
      ctx.translate(ped.x - camS.x, ped.y - camS.y);
      ctx.rotate(Math.PI / 2);
      drawPerson(ctx, 0, 0, 0, ped.color, {});
      ctx.restore();
    } else {
      drawPerson(ctx, ped.x - camS.x, ped.y - camS.y, ped.angle, ped.color, {});
    }
  }
  // police on foot
  for (const cop of world.police) {
    if (cop.kind !== 'foot' || cop.down) continue;
    drawPerson(ctx, cop.x - camS.x, cop.y - camS.y, cop.angle, '#2c4a6b', { cop: true });
  }
  // bullets
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 3;
  for (const b of world.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - camS.x, b.y - camS.y);
    ctx.lineTo(b.x - b.vx * 0.02 - camS.x, b.y - b.vy * 0.02 - camS.y);
    ctx.stroke();
  }
  // particles
  for (const pt of world.particles) {
    ctx.globalAlpha = clamp(pt.life * 2, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - camS.x - pt.size / 2, pt.y - camS.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  // the player, Milo Reyes — teal jacket, always readable
  const p = world.player;
  drawPerson(ctx, p.x - camS.x, p.y - camS.y, p.angle, p.inCar ? '#2ec4b6' : '#14b8a6', {});
  if (!p.inCar) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x - camS.x + Math.cos(p.angle) * 14, p.y - camS.y + Math.sin(p.angle) * 14);
    ctx.lineTo(p.x - camS.x + Math.cos(p.angle) * 22, p.y - camS.y + Math.sin(p.angle) * 22);
    ctx.stroke();
  }
  // floating score text
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const f of world.floaters) {
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x - camS.x, f.y - camS.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawMinimap(ctx, world) {
  const mx = WIDTH - MINIMAP_W - 16;
  const my = 16;
  const sx = MINIMAP_W / WORLD_W;
  const sy = MINIMAP_H / WORLD_H;
  ctx.save();
  ctx.fillStyle = COLORS.hudBg;
  rr(ctx, mx - 6, my - 6, MINIMAP_W + 12, MINIMAP_H + 12, 10);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(mx, my, MINIMAP_W, MINIMAP_H);
  ctx.clip();
  ctx.fillStyle = '#3f7a34';
  ctx.fillRect(mx, my, MINIMAP_W, MINIMAP_H);
  ctx.fillStyle = '#2fa8d8';
  ctx.fillRect(mx, my + SEA_Y * sy, MINIMAP_W, MINIMAP_H - SEA_Y * sy);
  ctx.fillStyle = '#e8dcc0';
  ctx.fillRect(mx, my + BEACH_Y * sy, MINIMAP_W, (SEA_Y - BEACH_Y) * sy);
  ctx.strokeStyle = '#4a4a52';
  ctx.lineWidth = 4;
  for (const ay of AVENUES) {
    ctx.beginPath();
    ctx.moveTo(mx, my + ay * sy);
    ctx.lineTo(mx + MINIMAP_W, my + ay * sy);
    ctx.stroke();
  }
  for (const sx2 of STREETS) {
    ctx.beginPath();
    ctx.moveTo(mx + sx2 * sx, my);
    ctx.lineTo(mx + sx2 * sx, my + MINIMAP_H);
    ctx.stroke();
  }
  const dot = (x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx + x * sx, my + y * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const car of world.cars) {
    if (car.wrecked) continue;
    dot(car.x, car.y, 2.5, car.kind === 'police' ? '#2f7bff' : car.kind === 'target' ? '#ffd166' : '#d8d8d8');
  }
  for (const cop of world.police) {
    if (!cop.down) dot(cop.x, cop.y, 3, cop.kind === 'car' ? '#2f7bff' : '#7fb3ff');
  }
  const target = missionTarget(world);
  if (target) {
    ctx.fillStyle = '#ffd166';
    const tx = mx + target.x * sx;
    const ty = my + target.y * sy;
    ctx.beginPath();
    ctx.moveTo(tx, ty - 6);
    ctx.lineTo(tx + 5, ty + 4);
    ctx.lineTo(tx - 5, ty + 4);
    ctx.closePath();
    ctx.fill();
  }
  const p = world.player;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#14b8a6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mx + p.x * sx, my + p.y * sy, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR CITY', mx, my + MINIMAP_H + 18);
}

function drawHUD(ctx, world, t) {
  const p = world.player;
  ctx.save();
  // top-left panel: cash, stars, health, objective
  ctx.fillStyle = COLORS.hudBg;
  rr(ctx, 14, 14, 380, 118, 10);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#7CFC9A';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('$' + p.cash, 28, 46);
  ctx.font = 'bold 24px system-ui, sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < p.wanted ? '#ffd166' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', 168 + i * 28, 46);
  }
  // health bar
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  rr(ctx, 28, 58, 200, 14, 7);
  ctx.fill();
  ctx.fillStyle = p.health > 50 ? '#7CFC9A' : p.health > 25 ? '#ffd166' : '#ff5964';
  rr(ctx, 28, 58, 200 * clamp(p.health / 100, 0, 1), 14, 7);
  ctx.fill();
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('HP ' + Math.ceil(p.health), 236, 70);
  if (p.hasPistol) {
    ctx.fillStyle = '#ffd166';
    ctx.fillText('PISTOL  ammo ' + p.ammo, 28, 92);
  } else {
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('No pistol — Gun Shop $400', 28, 92);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  const obj = objectiveText(world);
  ctx.fillText(obj.length > 62 ? obj.slice(0, 62) + '…' : obj, 28, 116);
  // mission progress
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '12px system-ui, sans-serif';
  const done = Math.min(world.mission.index, MISSIONS.length);
  ctx.fillText('Missions ' + done + '/' + MISSIONS.length + (world.mission.index < MISSIONS.length ? ' — ' + MISSIONS[world.mission.index].name : ''), 28, 132 - 14 + 14);
  drawMinimap(ctx, world);
  // speed, bottom-right, while driving
  if (p.inCar) {
    ctx.fillStyle = COLORS.hudBg;
    rr(ctx, WIDTH - 190, HEIGHT - 74, 176, 60, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(Math.abs(p.inCar.speed) * 0.24) + ' km/h', WIDTH - 30, HEIGHT - 34);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    const hp = Math.round((p.inCar.health / p.inCar.maxHealth) * 100);
    ctx.fillText('car ' + hp + '%', WIDTH - 30, HEIGHT - 18);
  }
  // controls hint, bottom-left
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,248,231,0.75)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(p.inCar
    ? 'W/S drive  A/D steer  Space handbrake  E exit  P pause  M mute'
    : 'WASD move  Shift run  E enter car / shop  Space punch  F / click shoot  P pause  M mute', 16, HEIGHT - 16);
  // toast, centre-top
  if (world.toast && world.toastT > 0) {
    ctx.globalAlpha = clamp(world.toastT, 0, 1);
    ctx.fillStyle = COLORS.hudBg;
    const w = ctx.measureText(world.toast).width + 36;
    rr(ctx, WIDTH / 2 - w / 2, 150, w, 36, 18);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.toast, WIDTH / 2, 173);
    ctx.globalAlpha = 1;
  }
  // wanted vignette
  if (p.wanted >= 3) {
    const pulse = 0.10 + 0.05 * Math.sin(t * 4);
    ctx.fillStyle = 'rgba(255,40,60,' + pulse.toFixed(3) + ')';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 14, 26, 0.82)';
  rr(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.5)';
  ctx.lineWidth = 2;
  rr(ctx, x, y, w, h, 14);
  ctx.stroke();
}

function button(ctx, b, hover, label) {
  ctx.fillStyle = hover === b.id ? '#ffd166' : '#f2a65a';
  rr(ctx, b.x, b.y, b.w, b.h, 10);
  ctx.fill();
  ctx.fillStyle = '#1c2733';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 6);
}

export function screenButtons(screen, world) {
  if (screen === SCREEN_TITLE) {
    return [{ id: 'start', x: WIDTH / 2 - 130, y: 560, w: 260, h: 52 }];
  }
  if (screen === SCREEN_PAUSED) {
    return [
      { id: 'resume', x: WIDTH / 2 - 130, y: 380, w: 260, h: 50 },
      { id: 'restart', x: WIDTH / 2 - 130, y: 444, w: 260, h: 50 },
    ];
  }
  if (screen === SCREEN_OVER || screen === SCREEN_VICTORY) {
    return [{ id: 'again', x: WIDTH / 2 - 130, y: 480, w: 260, h: 52 }];
  }
  return [];
}

function drawTitle(ctx, world, best, hover, save) {
  ctx.save();
  ctx.fillStyle = 'rgba(6, 12, 24, 0.55)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  panel(ctx, WIDTH / 2 - 380, 70, 760, 520);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('SOLMAR CITY', WIDTH / 2, 150);
  ctx.fillStyle = '#2ec4b6';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('A SUN-SOAKED OPEN-WORLD CRIME STORY', WIDTH / 2, 184);
  ctx.fillStyle = COLORS.text;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Milo Reyes is back in Solmar City with empty pockets and a', WIDTH / 2, 224);
  ctx.fillText('fixer named Dahlia who always has one more job. Steal cars,', WIDTH / 2, 248);
  ctx.fillText('run packages, outdrive the Solmar PD — and pull the Big Score.', WIDTH / 2, 272);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('WASD / arrows — move & drive      Shift — run      E — enter car / shop', WIDTH / 2, 316);
  ctx.fillText('Space — punch / handbrake      F or click — shoot      P — pause      M — mute', WIDTH / 2, 340);
  ctx.fillText('5 story missions from Dahlia  •  Wanted 0–5 stars  •  Pay \'n Spray clears the heat', WIDTH / 2, 372);
  ctx.fillText('Gun Shop sells a pistol ($400) and ammo ($50)  •  Cash pickups hide all over the city', WIDTH / 2, 396);
  if (save) {
    ctx.fillStyle = '#7CFC9A';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('Saved run: $' + save.cash + '  •  ' + save.missions + '/5 missions — Enter continues it', WIDTH / 2, 436);
  }
  if (best > 0) {
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('Best cash: $' + best, WIDTH / 2, 464);
  }
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('An original city. No borrowed names, maps or music.', WIDTH / 2, 500);
  const b = screenButtons(SCREEN_TITLE, world)[0];
  button(ctx, b, hover, save ? 'CONTINUE — ENTER' : 'START — ENTER');
  ctx.restore();
}

function drawPaused(ctx, hover) {
  ctx.save();
  ctx.fillStyle = 'rgba(6, 12, 24, 0.6)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  panel(ctx, WIDTH / 2 - 260, 220, 520, 300);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText('PAUSED', WIDTH / 2, 290);
  ctx.fillStyle = COLORS.text;
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('The city waits. Dahlia does not.', WIDTH / 2, 330);
  for (const b of screenButtons(SCREEN_PAUSED)) {
    button(ctx, b, hover, b.id === 'resume' ? 'RESUME — P' : 'RESTART — R');
  }
  ctx.restore();
}

function drawOver(ctx, world, best, hover) {
  const p = world.player;
  ctx.save();
  ctx.fillStyle = 'rgba(20, 4, 8, 0.72)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  panel(ctx, WIDTH / 2 - 300, 170, 600, 380);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5964';
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillText(world.overReason === 'busted' ? 'BUSTED' : 'WASTED', WIDTH / 2, 260);
  ctx.fillStyle = COLORS.text;
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText(world.overReason === 'busted'
    ? 'The Solmar PD finally got their hands on Milo.'
    : 'Milo went down hard on the streets of Solmar City.', WIDTH / 2, 300);
  ctx.fillStyle = '#7CFC9A';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('Cash: $' + p.cash + '    Missions: ' + Math.min(world.mission.index, 5) + '/5', WIDTH / 2, 350);
  ctx.fillStyle = '#ffd166';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Best cash: $' + best, WIDTH / 2, 384);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Dahlia always has another job. Press R or click below.', WIDTH / 2, 420);
  const b = screenButtons(SCREEN_OVER, world)[0];
  button(ctx, b, hover, 'PLAY AGAIN — R');
  ctx.restore();
}

function drawVictory(ctx, world, best, hover) {
  const p = world.player;
  ctx.save();
  ctx.fillStyle = 'rgba(6, 20, 12, 0.66)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  panel(ctx, WIDTH / 2 - 320, 150, 640, 400);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillText('THE BIG SCORE', WIDTH / 2, 230);
  ctx.fillStyle = '#7CFC9A';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('Story complete — all 5 missions done', WIDTH / 2, 272);
  ctx.fillStyle = COLORS.text;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('The gold coupe is in Dahlia\'s garage, the cops are', WIDTH / 2, 310);
  ctx.fillText('chasing ghosts, and Milo Reyes owns Solmar City.', WIDTH / 2, 334);
  ctx.fillStyle = '#7CFC9A';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('Final cash: $' + p.cash + '    Best: $' + best, WIDTH / 2, 380);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Free roam continues after this screen — or start a new story.', WIDTH / 2, 420);
  const b = screenButtons(SCREEN_VICTORY, world)[0];
  button(ctx, b, hover, 'PLAY AGAIN — R');
  ctx.restore();
}

export function render(ctx, screen, world, best, hover, t, save) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  drawWorld(ctx, world, t);
  if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHUD(ctx, world, t);
  if (screen === SCREEN_TITLE) drawTitle(ctx, world, best, hover, save);
  else if (screen === SCREEN_PAUSED) drawPaused(ctx, hover);
  else if (screen === SCREEN_OVER) drawOver(ctx, world, best, hover);
  else if (screen === SCREEN_VICTORY) drawVictory(ctx, world, best, hover);
}
