# Solmar City

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/yologie/gta6/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/yologie/gta6/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar City** is an open-world crime game in the spirit of GTA 6, built
for the make.fun gta6-01 bounty. You are a newcomer trying to make a name in
Solmar, a sun-soaked coastal city of beaches, highways, and back alleys.
Take jobs from the people who run the streets, earn cash and respect, and
stay one step ahead of the Solmar police — or outrun them when the heat
gets too high.

Everything is original: the city, its characters, vehicles, story, art,
and sound are made for this game. Nothing is taken from any commercial
game. The game runs fully offline in a desktop browser — no network
requests, no build step.

## How to play

| Key | Action |
| --- | --- |
| WASD / Arrow keys | Move on foot, drive when in a car |
| E | Enter / exit a car |
| Space | Context action (interact) |
| Shift | Sprint on foot |
| Mouse | Aim — hold to shoot toward the cursor |
| Click | Shoot / confirm buttons |
| M | Mute / unmute |
| P | Pause |
| R | Restart (from pause, victory, or game over) |
| Enter | Start / confirm |

- **On foot and by car:** walk the streets, steal any parked or driven car,
  and drive it — traffic and pedestrians share the roads with you.
- **Wanted level:** breaking the law raises your wanted stars (0–5) and the
  police respond — patrol cars chase, and the heat only cools when you break
  line of sight and lay low. A Pay 'n Spray clears the heat for cash.
- **Missions:** five story missions from Dahlia, the fixer who always has
  one more job — car theft, a timed package run, a getaway, and the big
  score — plus side activities that pay cash. Mission objectives show on
  the HUD and on the minimap.
- **Combat:** fists and firearms, with police and rival crews fighting back.
- **HUD and minimap:** health, cash, wanted stars, mission objective, and a
  live minimap of the city, cars, and police around you.
- **Save:** your progress (cash, completed missions, best wanted level) is
  saved in your browser.

## Run locally

```sh
node serve.ts
```

Then open <http://localhost:8080>. Any port works with `node serve.ts --port 8901`.

Deterministic screenshots: open `http://localhost:8080/?shot=chase&seed=1`
(or `street`, `mission`, `title`) to stage a fixed scene — the game plays
its real rules forward from a seeded start and freezes on that frame. The
four scenes are listed in `shots.json`.

A read-only debug handle, `window.__solmar`, exposes the current screen,
wanted level, cash, and mission state for scripted playtests; the game
itself never reads it.

## File layout

```text
game/
  index.html        1280x720 canvas, loads the game module
  src/
    main.js         bootstrap, fixed-step loop, screen state machine
    config.js       all tuning constants (speeds, wanted levels, city layout)
    random.js       seeded RNG (mulberry32) and helpers
    input.js        keyboard + mouse state, buttons
    audio.js        WebAudio synthesized sound effects + music + mute
    world.js        game state, city, spawning, rules (wanted, cash, win/lose)
    entities.js     player, pedestrian, car, and police update logic
    render.js       all drawing: city, entities, effects, HUD, minimap, screens
    missions.js     story missions, objectives, and side activities
    shots.js        deterministic screenshot scenes (autopilot plays the real rules)
main.ts             packages game/ + screenshots/ and writes dossier.json
serve.ts            tiny static server for game/ on http://localhost:8080
vendor/
  makefun-game.ts   make.fun dossier library (vendored, unchanged)
shots.json          the four screenshot scenes (?shot=chase|street|mission|title)
```

## License

MIT — see [LICENSE](LICENSE).
