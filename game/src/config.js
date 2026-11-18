// Solmar City — all tuning constants live here. Change a number, change the game.
export const WIDTH = 1280;
export const HEIGHT = 720;
export const WORLD_W = 2600;
export const WORLD_H = 1800;
export const STEP = 1 / 60;

// Roads: 4 avenues (horizontal) and 4 streets (vertical), ~90px wide.
export const AVENUES = [300, 700, 1100, 1500];
export const STREETS = [350, 900, 1450, 2000];
export const ROAD_W = 90;
export const BEACH_Y = 1640; // sand strip starts here; the sea is the south edge
export const SEA_Y = 1730;

// Player on foot
export const PLAYER_RADIUS = 13;
export const PLAYER_WALK = 175;
export const PLAYER_RUN = 285;
export const PLAYER_HEALTH = 100;
export const PUNCH_RANGE = 46;
export const PUNCH_DAMAGE = 25;
export const PUNCH_COOLDOWN = 0.35;
export const SHOOT_COOLDOWN = 0.22;
export const BULLET_SPEED = 920;
export const BULLET_RANGE = 560;
export const BULLET_DAMAGE = 34;

// Cars
export const CAR_W = 46;
export const CAR_H = 24;
export const CAR_ACCEL = 420;
export const CAR_BRAKE = 620;
export const CAR_MAX_SPEED = 520;
export const CAR_REVERSE_MAX = 160;
export const CAR_TURN = 2.9; // radians per second at full steer
export const CAR_HEALTH = 180;
export const TRAFFIC_COUNT = 14;
export const PARKED_COUNT = 8;
export const PED_COUNT = 24;

// Wanted level
export const WITNESS_RADIUS = 330;
export const POLICE_SIGHT = 520;
export const WANTED_COOLDOWN_BASE = 15; // seconds at 1 star
export const WANTED_COOLDOWN_PER_STAR = 10;
export const BUSTED_GRAB_TIME = 1.2; // cop contact on foot
export const BUSTED_RAM_TIME = 2.0; // pinned by a police car while stopped
export const SPRAY_PRICE = 200;
export const PISTOL_PRICE = 400;
export const AMMO_PRICE = 50;
export const AMMO_PER_BOX = 12;

// Missions: name, blurb, reward
export const MISSIONS = [
  { name: 'Hot Wheels', reward: 300, blurb: 'Steal any car and bring it to Dahlia\'s Garage.' },
  { name: 'Package Run', reward: 500, blurb: 'Grab the package at the docks, deliver it to the plaza in 90 seconds.' },
  { name: 'Getaway', reward: 800, blurb: 'Survive a 3-star wanted level for 60 seconds, then lose the cops.' },
  { name: 'Street Race', reward: 1000, blurb: 'Beat the rival driver through 5 checkpoints around Solmar City.' },
  { name: 'The Big Score', reward: 2000, blurb: 'Steal the gold coupe from the mall lot, shake a 4-star response, deliver it to the garage.' },
];
export const RACE_CHECKPOINTS = [
  { x: 350, y: 300 }, { x: 2000, y: 300 }, { x: 2000, y: 1500 },
  { x: 350, y: 1500 }, { x: 900, y: 1100 },
];

// Landmark plots (solid buildings) and mission points
export const LANDMARKS = [
  { id: 'garage', name: "Dahlia's Garage", x: 430, y: 430, w: 150, h: 110, color: '#e07840', roof: '#b85a2a' },
  { id: 'police', name: 'Police Station', x: 1010, y: 430, w: 170, h: 110, color: '#5b7fa6', roof: '#3d5a78' },
  { id: 'hospital', name: 'Solmar General', x: 1560, y: 830, w: 170, h: 120, color: '#e8e4d8', roof: '#c94f5e' },
  { id: 'mall', name: 'Palms Mall', x: 1560, y: 1230, w: 190, h: 130, color: '#d9a441', roof: '#a87c2c' },
  { id: 'gunshop', name: 'Gun Shop', x: 610, y: 1230, w: 120, h: 90, color: '#8a6d4b', roof: '#5f4a33' },
  { id: 'spray', name: "Pay 'n Spray", x: 2060, y: 830, w: 130, h: 100, color: '#4fa8a0', roof: '#35746e' },
  { id: 'docks', name: 'The Docks', x: 2250, y: 1560, w: 160, h: 90, color: '#7a6a55', roof: '#5a4d3d' },
];
export const GARAGE_POINT = { x: 505, y: 590 }; // drop-off in front of the garage
export const DOCKS_POINT = { x: 2250, y: 1500 };
export const PLAZA_POINT = { x: 1175, y: 900 };
export const GUNSHOP_POINT = { x: 670, y: 1340 };
export const SPRAY_POINT = { x: 2125, y: 950 };
export const TARGET_CAR_POINT = { x: 1660, y: 1400 };

// Palette — a bright, sun-soaked coastal city
export const COLORS = {
  grass: '#7ec850',
  grassDark: '#6db544',
  sand: '#f0d9a0',
  sea: '#2fa8d8',
  seaDeep: '#1e7fb0',
  road: '#4a4a52',
  roadLine: '#f5d76e',
  sidewalk: '#c9c2b4',
  buildingRoof: '#e07840',
  park: '#5da83f',
  text: '#fff8e7',
  textDim: '#d8cdb4',
  danger: '#ff5964',
  gold: '#ffd166',
  teal: '#2ec4b6',
  hudBg: 'rgba(10, 16, 28, 0.72)',
};
export const BUILDING_COLORS = ['#f2a65a', '#e07890', '#7fb3d5', '#a8c686', '#d9a441', '#c9a0dc', '#f28b82', '#81c995', '#f6bd60', '#84a9c0'];
export const CAR_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#2c3e50', '#fd79a8', '#00cec9'];
export const PED_COLORS = ['#ff7675', '#74b9ff', '#55efc4', '#fdcb6e', '#a29bfe', '#e17055', '#00b894', '#d63031'];
