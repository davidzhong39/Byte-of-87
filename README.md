# BYTE OF 87 — Outpost Survival

A browser-based Mars outpost survival game. Survive a four-minute night shift at Ares-87 by maintaining oxygen, power, water, and rations while a presence advances through the storm toward the habitat. Scan security feeds, time the perimeter gate, and spend resources on emergency repairs. Crew logs reveal more of the outpost's story as the shift unfolds.

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

- The campaign starts on **Mission Day 82**. Survive five consecutive four-minute watches, through Day 86, to win. Supplies carry over between shifts.
- Each shift adds a tougher system failure: heavy power drain, then water, then food, followed by a power-and-water cascade, and finally increased drain on all four supplies. The perimeter also advances faster on later shifts.
- Your first watch begins with a briefing. During each shift, follow the objective beneath the clock and keep all four resources above zero until the timer reaches **04:00 remaining** (the in-game clock reaches 06:00).
- Use **Maintenance** to restore a resource. Every override has its own 28-second cooldown and costs other supplies.
- Open **Maintenance** for three optional field work orders: repeat the scrubber signal, isolate the overpressure line, or match the hydroponics blend. Success restores oxygen, water, or rations; each challenge costs supplies and has a 45-second cooldown.
- Keep linked reserves above 25% when possible. Water shortages accelerate oxygen loss, low oxygen increases reactor draw, low power raises condenser water use, and low rations increase water and oxygen use.
- Use **Security Feed** to scan for the approaching presence. Scanning costs power.
- Seal the **Perimeter Gate** when the presence gets close. A sealed gate turns it back after an impact, but steadily consumes extra power; impacts also vent oxygen and coolant.
- The field log stays in a fixed-height panel and lists events in time order, with the newest entry at the bottom.

### Controls

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Scan security feed | Security Feed | `C` |
| Seal or open the gate | Perimeter Gate | `G` |
| Open maintenance | Maintenance | `M` |
| Pause or resume | Pause button | `Space` |
| Close a popup | Close button | `Esc` |

The game can be restarted after a shift ends. The help button (`?`) opens the in-game field manual.

## Project files

- `index.html` — game layout, controls, and popup dialog.
- `style.css` — responsive rusty-metal HUD and scene styling.
- `script.js` — resource simulation, threat behavior, controls, field log, and shift state.

The game uses no external APIs or third-party runtime libraries. All visual effects are created with CSS and HTML.
