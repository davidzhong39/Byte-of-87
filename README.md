# BYTE OF 87 — Outpost Survival

A browser-based Mars outpost survival game. Survive a four-minute night level at Ares-87 by maintaining oxygen, power, water, and rations while a presence advances through the storm toward the habitat. Scan security feeds, time the perimeter gate, and spend resources on emergency repairs. Crew logs reveal more of the outpost's story as the night unfolds.

## Play

No build step, package installation, API key, or external service is required.

### Open directly

Open `index.html` in a modern desktop or mobile browser. The game is plain HTML, CSS, and JavaScript and works offline.

### Serve locally (optional)

From the project directory, start any static file server. For example, with Python:

```powershell
py -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000). Stop the server with `Ctrl+C`.

## How to play

- After the intro, select any of six standalone levels: **Night 82** through **Night 87**. Every selected night starts with full reserves and fresh system statuses; supplies and damage do not carry between levels.
- Each level begins with its targeted system offline, in addition to its increased level-specific drain: Night 82 starts with the reactor offline; Night 83 with the condenser; Night 84 with hydroponics; Night 85 with the reactor and condenser; Nights 86 and 87 with all four systems offline. Offline systems add a substantial extra drain until repaired.
- Nights 82–86 add increasingly severe resource and perimeter pressure: heavy power drain, then water, then food, followed by a power-and-water cascade and increased drain on all four supplies.
- **Night 87** is the final, high-intensity level: every reserve drains heavily, contact advances every few seconds, and gate impacts hit harder.
- During each four-minute night, follow the objective beneath the clock and keep all four resources above zero until the timer reaches **04:00 remaining** (the in-game clock reaches 06:00).
- Use **Maintenance** to restore a resource. Every override has its own 28-second cooldown and costs other supplies.
- The game can trigger up to two random life-support outage events total, including the failures a level starts with; levels that already have two or more starting outages will not add random life-support failures. The affected resource subtitle calls out the outage, and its drain increases. Repair faults before completing the level.
- Open **Maintenance** for field work orders: repeat the scrubber signal, isolate the overpressure line, match the hydroponics blend, or route two reactor relays to match the target output. A successful work order brings an offline system back online and restores its resource; each costs supplies and has a 45-second cooldown.
- Keep linked reserves above 25% when possible. Water shortages accelerate oxygen loss, low oxygen increases reactor draw, low power raises condenser water use, and low rations increase water and oxygen use.
- Use **Security Feed** to reveal the presence's distance and movement timing. Each pulse costs 2.5% power and delays its next movement by 6 seconds; the scanner recharges in 24 seconds. Save a pulse to buy time for a gate or repair decision.
- The exterior camera array can independently flicker offline during a night. Open Security Feed to reconnect the four matching wire colors; the outage can recur after repair. When the presence reaches an open habitat, an original creature jumpscare precedes the loss screen.
- Seal the **Perimeter Gate** when the presence gets close. A sealed gate turns it back after an impact, but steadily consumes extra power; impacts also vent oxygen and coolant.
- The field log stays in a fixed-height panel and lists events in time order, with the newest entry at the bottom.

### Controls

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Scan security feed / repair offline cameras | Security Feed | `C` |
| Seal or open the gate | Perimeter Gate | `G` |
| Open maintenance | Maintenance | `M` |
| Pause or resume | Pause button | `Space` while paused |
| Close a popup | Close button | `Esc` |

Each night is a standalone level. After a loss or completed night, choose to replay that level or return to night selection. The moon moves across the sky as the night progresses. The help button (`?`) opens the in-game field manual.

## Project files

- `index.html` — game layout, controls, and popup dialog.
- `style.css` — responsive rusty-metal HUD and scene styling.
- `script.js` — resource simulation, threat behavior, controls, field log, and level state.

The game uses no external APIs or third-party runtime libraries. All visual effects are created with CSS and HTML.
