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

- Keep all four resources above zero until the timer reaches **04:00 remaining** (the in-game clock reaches 06:00).
- Use **Maintenance** to restore a resource. Every override has its own 28-second cooldown and costs other supplies.
- Use **Security Feed** to scan for the approaching presence. Scanning costs power.
- Seal the **Perimeter Gate** when the presence gets close. A sealed gate turns it back after an impact, but steadily consumes extra power.
- Watch the field log for system warnings and story entries.

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
