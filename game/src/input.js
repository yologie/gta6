// Solmar City — keyboard + mouse state, and edge-triggered "just pressed" actions.
// The game reads one plain input object each step; the screenshot autopilot builds
// the same shape, so live play and staged scenes share one control surface.
import { WIDTH, HEIGHT } from './config.js';

const held = new Set();
const pressed = new Set();
const mouse = { x: WIDTH / 2, y: HEIGHT / 2, down: false, clicked: false, clickX: 0, clickY: 0 };

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'action',
  KeyE: 'enter',
  KeyF: 'shoot',
};

export function attachInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * WIDTH;
    mouse.y = ((e.clientY - r.top) / r.height) * HEIGHT;
  });
  canvas.addEventListener('mousedown', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * WIDTH;
    mouse.y = ((e.clientY - r.top) / r.height) * HEIGHT;
    mouse.down = true;
    mouse.clicked = true;
    mouse.clickX = mouse.x;
    mouse.clickY = mouse.y;
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
}

// Snapshot of the current intent for one fixed step.
export function readInput() {
  const input = emptyInput();
  for (const code of held) {
    const name = KEYMAP[code];
    if (name) input[name] = true;
  }
  // Mouse held = shoot toward the cursor; a click also counts as one shot.
  input.mouseDown = mouse.down;
  input.mouseX = mouse.x;
  input.mouseY = mouse.y;
  return input;
}

// True once for each physical press of the given code, then consumed.
export function wasPressed(code) {
  if (pressed.has(code)) {
    pressed.delete(code);
    return true;
  }
  return false;
}

export function anyPressed(codes) {
  for (const c of codes) {
    if (pressed.has(c)) {
      pressed.delete(c);
      return true;
    }
  }
  return false;
}

// A click (screen coords) since the last check, or null. Consumes the click.
export function takeClick() {
  if (!mouse.clicked) return null;
  mouse.clicked = false;
  return { x: mouse.clickX, y: mouse.clickY };
}

export function mousePos() {
  return { x: mouse.x, y: mouse.y };
}

export function flushPressed() {
  pressed.clear();
}

// A blank input object — what the autopilot starts from.
export function emptyInput() {
  return {
    up: false, down: false, left: false, right: false, run: false,
    action: false, enter: false, shoot: false,
    mouseDown: false, mouseX: WIDTH / 2, mouseY: HEIGHT / 2,
  };
}

export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
