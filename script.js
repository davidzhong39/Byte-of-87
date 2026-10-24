"use strict";

const SHIFT_LENGTH = 240;
const INTRO_BLACK_DURATION = 2000;
const INTRO_FADE_DURATION = 5000;
const INTRO_TYPE_DELAY = 55;
const INTRO_MESSAGE_HOLD = 1100;
const INTRO_BUTTON_FADE_DURATION = 1200;
const INTRO_REVEAL_DURATION = 1600;
const RESTART_FADE_DURATION = 650;
const INTRO_MESSAGES = [
    "You were sent to Mars to build a new home.",
    "Something is moving beyond the habitat.",
    "Keep the outpost alive. Do not let them in."
];
const resourceNames = ["oxygen", "power", "water", "food"];
const lore = [
    ["DAY 01 // ARRIVAL", "The landing crew named this place Ares-87 after the mission number. The first thing they saw was a set of footprints leading away from the lander. Nobody claimed them."],
    ["DAY 19 // COMMS", "Earth says the signal delay is 14 minutes. The reply that came back to our last transmission arrived six hours before we sent it."],
    ["DAY 42 // GREENHOUSE", "Something has been tapping on the glass from the outside. The greenhouse is on the pressurized side of the habitat."],
    ["DAY 63 // PERSONNEL", "The manifest says there are five of us. The mess hall keeps setting six places. We stopped correcting it."],
    ["DAY 86 // PERSONAL", "If the perimeter alarm sounds, do not open the door to check. Whatever is out there learned how we knock."]
];
const ambientMessages = [
    "Wind shear climbing. Keep the external locks engaged.",
    "The ridge camera is drifting again. Probably just the storm.",
    "Hydroponics report a second root system. No one planted it.",
    "A voice on the maintenance channel asked for Mara. Mara died on Day 19.",
    "Dust density obscuring the eastern horizon."
];
const state = {
    running: false,
    paused: false,
    ended: false,
    elapsed: 0,
    resources: { oxygen: 100, power: 100, water: 100, food: 100 },
    gateClosed: false,
    threat: 0,
    nextThreatMove: 14,
    nextAmbient: 30,
    lastUpkeep: { oxygen: -Infinity, water: -Infinity, food: -Infinity, power: -Infinity },
    loreIndex: 0,
    scannedAt: -Infinity,
    tickId: null,
    toastId: null,
    introTimer: null,
    modalReturnFocus: null
};

const $ = (id) => document.getElementById(id);
const backdrop = $("modal-backdrop");
const modalContent = $("modal-content");
const modalTitle = $("modal-title");
const modalEyebrow = $("modal-eyebrow");
const modalClose = $("modal-close");
const introScreen = $("intro-screen");
const scene = $("scene");
const introMessage = $("intro-message");
const introStart = $("intro-start");

function showModal(title, eyebrow, content, dismissible = true) {
    state.modalReturnFocus = document.activeElement;
    modalTitle.textContent = title;
    modalEyebrow.textContent = eyebrow;
    modalContent.innerHTML = content;
    modalClose.hidden = !dismissible;
    backdrop.classList.add("is-visible");
    const firstButton = modalContent.querySelector("button");
    (firstButton || modalClose).focus();
}

function closeModal(force = false) {
    if (!backdrop.classList.contains("is-visible") || (modalClose.hidden && !force)) return;
    backdrop.classList.remove("is-visible");
    if (state.modalReturnFocus && typeof state.modalReturnFocus.focus === "function") state.modalReturnFocus.focus();
}

function showToast(message, warning = false) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.toggle("is-warning", warning);
    toast.classList.add("is-visible");
    window.clearTimeout(state.toastId);
    state.toastId = window.setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

function addLog(message, type = "normal") {
    const list = $("log-list");
    const entry = document.createElement("article");
    entry.className = `log-entry ${type}`;
    const time = document.createElement("time");
    time.textContent = formatClock();
    const text = document.createElement("p");
    text.textContent = message;
    entry.append(time, text);
    list.prepend(entry);
    while (list.children.length > 12) list.lastElementChild.remove();
    $("log-count").textContent = String(list.children.length).padStart(2, "0");
}

function formatClock() {
    const gameMinutes = Math.floor(state.elapsed * 1.5);
    const hours = Math.floor(gameMinutes / 60);
    const minutes = gameMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function renderResources() {
    for (const name of resourceNames) {
        const amount = Math.max(0, Math.min(100, state.resources[name]));
        const rounded = Math.round(amount);
        $(`${name}-value`).textContent = String(rounded);
        $(`${name}-meter`).style.width = `${amount}%`;
        const card = document.querySelector(`[data-resource="${name}"]`);
        card.classList.toggle("is-low", amount < 30);
        card.classList.toggle("is-critical", amount < 15);
        $(`${name}-note`).textContent = amount < 15 ? "CRITICAL RESERVE" : amount < 30 ? "LOW RESERVE" : ({
            oxygen: "SCRUBBERS ONLINE",
            power: "REACTOR NOMINAL",
            water: "TANKS: 4,200 L",
            food: "HYDROPONICS: ACTIVE"
        })[name];
    }
    const weakest = Math.min(...resourceNames.map((name) => state.resources[name]));
    $("vitals-label").textContent = weakest < 15 ? "CRITICAL" : weakest < 35 ? "STRAINED" : "STABLE";
    $("vitals-label").classList.toggle("is-critical-text", weakest < 15);
}

function renderTime() {
    const remaining = Math.max(0, SHIFT_LENGTH - state.elapsed);
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    $("clock").textContent = formatClock();
    $("remaining-label").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} REMAINING`;
    $("timeline-progress").style.width = `${(state.elapsed / SHIFT_LENGTH) * 100}%`;
    $("shift-label").textContent = "SHIFT 01 / NIGHT WATCH";
}

function renderThreat() {
    const scene = $("scene");
    const readout = $("threat-message");
    const position = state.threat;
    scene.dataset.threat = String(position);
    scene.classList.toggle("is-haunted", position > 0);
    scene.classList.toggle("is-imminent", position >= 3);
    $("signal-label").textContent = position > 0 ? `SIGNAL ${Math.max(18, 98 - position * 19)}%` : "SIGNAL 98%";
    $("weather").textContent = position >= 3 ? "MOTION ALERT: PERIMETER" : "DUST FRONT: BUILDING";
    if (position === 0) {
        readout.textContent = state.elapsed > 70 ? "MOVEMENT DETECTED BEYOND THE RIDGE." : "PERIMETER QUIET. FOR NOW.";
        $("camera-name").textContent = "CAM 01 — HABITAT PERIMETER";
    } else if (position < 3) {
        readout.textContent = state.elapsed - state.scannedAt < 8
            ? "THERMAL SIGNATURE APPROACHING THE HABITAT."
            : "SIGNAL DEGRADATION. SOMETHING IS MOVING.";
        $("camera-name").textContent = "CAM 02 — EASTERN RIDGE";
    } else {
        readout.textContent = state.elapsed - state.scannedAt < 8
            ? "CONTACT AT THE OUTER GATE. IT KNOWS YOU'RE HERE."
            : "WARNING: MOTION AT THE PERIMETER.";
        $("camera-name").textContent = "CAM 03 — OUTER GATE";
    }
    $("gate-state").textContent = state.gateClosed ? "SEALED" : "OPEN";
    $("door-title").textContent = state.gateClosed ? "GATE SEALED" : "PERIMETER GATE";
    $("door-caption").textContent = state.gateClosed ? "CLICK TO OPEN · POWER DRAIN" : "OPEN · CLICK TO SEAL";
    $("door-button").setAttribute("aria-pressed", String(state.gateClosed));
    $("door-button").classList.toggle("is-sealed", state.gateClosed);
    $("system-status").textContent = state.paused ? "WATCH PAUSED" : state.running ? (position >= 3 ? "PERIMETER ALERT" : "LIFE SUPPORT ONLINE") : state.ended ? "SHIFT COMPLETE" : "SYSTEMS STANDBY";
    $("system-status").classList.toggle("status-alert", position >= 3 && state.running);
}

function renderAll() {
    renderResources();
    renderTime();
    renderThreat();
}

function addResource(name, amount) {
    state.resources[name] = Math.max(0, Math.min(100, state.resources[name] + amount));
}

function openIntro() {
    closeModal(true);
    window.clearTimeout(state.introTimer);
    introScreen.hidden = false;
    introScreen.classList.remove("is-hiding");
    introScreen.setAttribute("aria-modal", "true");
    introMessage.textContent = "";
    introStart.hidden = true;
    introStart.classList.remove("is-visible");
    introStart.disabled = false;
    document.body.classList.remove("is-revealing");
    document.body.classList.add("is-intro");
    introScreen.focus();
    state.introTimer = window.setTimeout(() => {
        scene.classList.add("is-visible");
        state.introTimer = window.setTimeout(() => typeIntroMessage(0), INTRO_FADE_DURATION);
    }, INTRO_BLACK_DURATION);
}

function typeIntroMessage(messageIndex, characterIndex = 0) {
    if (messageIndex >= INTRO_MESSAGES.length) {
        revealIntroStart();
        return;
    }

    const message = INTRO_MESSAGES[messageIndex];
    introMessage.textContent = message.slice(0, characterIndex);
    if (characterIndex < message.length) {
        state.introTimer = window.setTimeout(
            () => typeIntroMessage(messageIndex, characterIndex + 1),
            INTRO_TYPE_DELAY
        );
        return;
    }

    state.introTimer = window.setTimeout(() => {
        if (messageIndex === INTRO_MESSAGES.length - 1) {
            revealIntroStart();
            return;
        }
        introMessage.textContent = "";
        state.introTimer = window.setTimeout(() => typeIntroMessage(messageIndex + 1), 350);
    }, INTRO_MESSAGE_HOLD);
}

function revealIntroStart() {
    introStart.hidden = false;
    void introStart.offsetWidth;
    introStart.classList.add("is-visible");
    state.introTimer = window.setTimeout(() => introStart.focus(), INTRO_BUTTON_FADE_DURATION);
}

function beginNightWatch() {
    if (state.running || state.ended) return;
    introStart.disabled = true;
    const openingBounds = scene.getBoundingClientRect();
    introScreen.classList.add("is-hiding");
    introScreen.setAttribute("aria-modal", "false");
    document.body.classList.remove("is-intro");
    document.body.classList.add("is-revealing");
    const hudBounds = scene.getBoundingClientRect();
    const offsetX = openingBounds.left - hudBounds.left;
    const offsetY = openingBounds.top - hudBounds.top;
    const scaleX = openingBounds.width / hudBounds.width;
    const scaleY = openingBounds.height / hudBounds.height;
    scene.animate([
        {
            transform: `translate(${offsetX}px, ${offsetY}px) scale(${scaleX}, ${scaleY})`,
            transformOrigin: "top left"
        },
        { transform: "translate(0, 0) scale(1, 1)", transformOrigin: "top left" }
    ], {
        duration: INTRO_REVEAL_DURATION,
        easing: "cubic-bezier(.45, 0, .55, 1)"
    });
    startGame();
    window.setTimeout(() => {
        document.body.classList.remove("is-intro", "is-revealing");
        introScreen.hidden = true;
        $("camera-button").focus();
    }, INTRO_REVEAL_DURATION);
}

function startGame() {
    if (state.running || state.ended) return;
    state.running = true;
    state.paused = false;
    closeModal(true);
    $("system-status").textContent = "LIFE SUPPORT ONLINE";
    addLog("Night watch started. Dust front will reach the habitat by 02:00.", "system");
    state.tickId = window.setInterval(tick, 1000);
    renderAll();
}

function tick() {
    if (!state.running || state.paused || state.ended) return;
    state.elapsed += 1;
    state.resources.oxygen -= 0.105;
    state.resources.power -= 0.115 + (state.gateClosed ? 0.23 : 0);
    state.resources.water -= 0.085;
    state.resources.food -= 0.075;

    if (state.elapsed >= state.nextThreatMove) {
        state.nextThreatMove = state.elapsed + 10 + Math.floor(Math.random() * 9);
        if (state.gateClosed && state.threat >= 2) {
            state.threat = 0;
            addResource("power", -10);
            addLog("Impact on the gate. Whatever it was has gone quiet.", "warning");
            showToast("GATE IMPACT · POWER SURGE", true);
        } else {
            state.threat = Math.min(4, state.threat + 1);
            addLog(state.threat >= 3 ? "Motion at the outer gate. Seal it now." : "A shape moved between the ridge cameras.", "warning");
        }
        if (state.threat >= 4 && !state.gateClosed) {
            renderAll();
            endGame(false, "The outer gate buckled inward. In the red emergency light, the footprints stopped at your bunk.");
            return;
        }
    }

    if (state.elapsed >= state.nextAmbient) {
        state.nextAmbient = state.elapsed + 32 + Math.floor(Math.random() * 14);
        addLog(ambientMessages[Math.floor(Math.random() * ambientMessages.length)], "lore");
    }

    if (state.elapsed >= 60 && state.loreIndex < lore.length && state.elapsed >= (state.loreIndex + 1) * 42) {
        const [date, entry] = lore[state.loreIndex];
        state.loreIndex += 1;
        addLog(`${date}: ${entry}`, "lore");
    }

    if (state.gateClosed && state.resources.power <= 1) {
        state.gateClosed = false;
        addLog("Power depleted. Perimeter gate released automatically.", "warning");
        showToast("POWER CRITICAL · GATE RELEASED", true);
    }
    renderAll();

    const failedResource = resourceNames.find((name) => state.resources[name] <= 0);
    if (failedResource) {
        endGame(false, `${failedResource.toUpperCase()} reserves reached zero. The outpost could not sustain life support.`);
    } else if (state.elapsed >= SHIFT_LENGTH) {
        endGame(true, "The storm breaks. In the dawn light, the ridge is empty. Your radio crackles once: \"Good morning, Mara.\"");
    }
}

function endGame(won, message) {
    state.running = false;
    state.ended = true;
    window.clearInterval(state.tickId);
    $("system-status").textContent = won ? "SHIFT COMPLETE" : "OUTPOST LOST";
    $("system-status").classList.toggle("status-alert", !won);
    showModal(won ? "FIRST LIGHT" : "SIGNAL LOST", won ? "SHIFT 01 // SURVIVED" : "ARES-87 // CREW STATUS UNKNOWN", `
        <div class="end-stamp ${won ? "is-win" : ""}">${won ? "06:00" : "NO SIGNAL"}</div>
        <p class="modal-lead">${message}</p>
        <div class="debrief"><span>SHIFT DURATION <b>${formatClock()}</b></span><span>O₂ <b>${Math.round(state.resources.oxygen)}%</b></span><span>POWER <b>${Math.round(state.resources.power)}%</b></span><span>WATER <b>${Math.round(state.resources.water)}%</b></span><span>RATIONS <b>${Math.round(state.resources.food)}%</b></span></div>
        <div class="modal-actions"><button class="primary-button" data-action="restart">START ANOTHER SHIFT <span>↻</span></button></div>
    `, false);
}

function restartGame() {
    window.clearInterval(state.tickId);
    window.clearTimeout(state.introTimer);
    closeModal(true);
    document.body.classList.remove("is-intro");
    document.body.classList.add("is-restarting");

    window.setTimeout(() => {
        resetGameState();
        introScreen.hidden = true;
        startGame();
        document.body.classList.add("is-revealing-hub");

        window.setTimeout(() => {
            document.body.classList.remove("is-restarting", "is-revealing-hub");
            $("camera-button").focus();
        }, RESTART_FADE_DURATION);
    }, RESTART_FADE_DURATION);
}

function resetGameState() {
    window.clearTimeout(state.toastId);
    $("toast").classList.remove("is-visible", "is-warning");
    state.running = false;
    state.paused = false;
    state.ended = false;
    state.elapsed = 0;
    state.resources = { oxygen: 100, power: 100, water: 100, food: 100 };
    state.gateClosed = false;
    state.threat = 0;
    state.nextThreatMove = 14;
    state.nextAmbient = 30;
    state.lastUpkeep = { oxygen: -Infinity, water: -Infinity, food: -Infinity, power: -Infinity };
    state.loreIndex = 0;
    state.scannedAt = -Infinity;
    $("pause-button").textContent = "Ⅱ  PAUSE";
    $("log-list").replaceChildren();
    $("log-count").textContent = "00";
}

function scanFeed() {
    if (!state.running || state.paused) {
        showToast("SECURITY FEED UNAVAILABLE", true);
        return;
    }
    if (state.resources.power < 3) {
        showToast("NOT ENOUGH POWER TO SCAN", true);
        return;
    }
    addResource("power", -2.5);
    state.scannedAt = state.elapsed;
    const sightings = [
        "Nothing on the ridge. The camera keeps refocusing on the airlock.",
        "Thermal return: one figure. No heat signature.",
        "East ridge is clear. The tracks leading toward you are not.",
        "Feed static. Something is standing where the camera cannot see."
    ];
    const index = state.threat > 0 ? Math.min(state.threat, sightings.length - 1) : 0;
    addLog(sightings[index], state.threat > 0 ? "warning" : "system");
    showModal("SECURITY FEED", `CAM 0${Math.min(3, state.threat + 1)} // LIVE SCAN`, `
        <div class="camera-preview ${state.threat > 0 ? "camera-danger" : ""}"><span class="camera-crosshair">+</span><div class="camera-scanline"></div><b>${state.threat > 0 ? "THERMAL ANOMALY DETECTED" : "NO MOTION DETECTED"}</b><small>${state.threat > 0 ? `DISTANCE: ${Math.max(8, 46 - state.threat * 10)}M · BEARING EAST` : "PERIMETER CLEAR · SIGNAL 98%"}</small></div>
        <p class="subtle-note">LIVE FEED · 2.5% POWER CONSUMED · TRUST YOUR EARS, NOT THE STATIC.</p>
        <div class="modal-actions"><button class="primary-button" data-action="close">RETURN TO HABITAT <span>→</span></button></div>
    `);
    renderAll();
}

function toggleGate() {
    if (!state.running || state.paused) {
        showToast("GATE CONTROLS OFFLINE", true);
        return;
    }
    if (!state.gateClosed && state.resources.power < 2) {
        showToast("INSUFFICIENT POWER TO SEAL GATE", true);
        return;
    }
    state.gateClosed = !state.gateClosed;
    if (state.gateClosed) {
        state.resources.power -= 1;
        addLog("Perimeter gate sealed. Power draw elevated.", "warning");
        showToast("GATE SEALED · POWER DRAIN INCREASED");
    } else {
        addLog("Perimeter gate opened.", "system");
        showToast("GATE OPEN");
    }
    renderAll();
}

function openSystems() {
    const available = state.running && !state.paused;
    const descriptions = {
        oxygen: "Purge scrubbers and refill oxygen (+24). Costs 8 power.",
        water: "Run emergency condenser (+22). Costs 10 power.",
        food: "Harvest reserve trays (+20). Costs 8 power.",
        power: "Restart the auxiliary reactor (+28). Costs 7 water and 5 rations."
    };
    const buttons = resourceNames.map((name) => {
        const cooldown = Math.max(0, 28 - (state.elapsed - state.lastUpkeep[name]));
        const disabled = !available || cooldown > 0 || (name === "oxygen" && state.resources.power < 8) ||
            (name === "water" && state.resources.power < 10) || (name === "food" && state.resources.power < 8) ||
            (name === "power" && (state.resources.water < 7 || state.resources.food < 5));
        return `<button class="system-option" data-action="upkeep" data-system="${name}" ${disabled ? "disabled" : ""}><span class="system-option-icon">${({ oxygen: "O₂", power: "ϟ", water: "H₂O", food: "N" })[name]}</span><span><b>${name.toUpperCase()} ${cooldown > 0 ? `<small> · READY IN ${Math.ceil(cooldown)}S</small>` : ""}</b><small>${descriptions[name]}</small></span><span class="system-plus">+</span></button>`;
    }).join("");
    showModal("SYSTEMS CONSOLE", "MAINTENANCE // MANUAL OVERRIDE", `
        <p class="modal-lead">Emergency overrides have a 28-second cooldown. Every fix costs something. Nothing here is free.</p>
        <div class="system-options">${buttons}</div>
        <div class="modal-actions"><span class="subtle-note">REACTOR LOAD: ${Math.round(100 - state.resources.power)}% · GATE ${state.gateClosed ? "SEALED" : "OPEN"}</span><button class="text-button" data-action="close">BACK TO WATCH</button></div>
    `);
}

function performUpkeep(name) {
    if (!state.running || state.paused || !resourceNames.includes(name)) return;
    if (state.elapsed - state.lastUpkeep[name] < 28) {
        showToast("OVERRIDE STILL RECHARGING", true);
        return;
    }
    const costs = { oxygen: { power: 8 }, water: { power: 10 }, food: { power: 8 }, power: { water: 7, food: 5 } };
    const gains = { oxygen: 24, water: 22, food: 20, power: 28 };
    const unable = Object.entries(costs[name]).find(([resource, cost]) => state.resources[resource] < cost);
    if (unable) {
        showToast(`INSUFFICIENT ${unable[0].toUpperCase()}`, true);
        return;
    }
    for (const [resource, cost] of Object.entries(costs[name])) addResource(resource, -cost);
    addResource(name, gains[name]);
    state.lastUpkeep[name] = state.elapsed;
    addLog(`${name.toUpperCase()} override complete. Reserves restored by ${gains[name]}%.`, "system");
    showToast(`${name.toUpperCase()} RESTORED · +${gains[name]}%`);
    renderAll();
    openSystems();
}

function togglePause() {
    if (!state.running || state.ended) return;
    state.paused = !state.paused;
    $("pause-button").textContent = state.paused ? "▶  RESUME" : "Ⅱ  PAUSE";
    $("system-status").textContent = state.paused ? "WATCH PAUSED" : "LIFE SUPPORT ONLINE";
    if (state.paused) {
        showModal("WATCH PAUSED", "SYSTEMS HOLD // TIMER STOPPED", `
            <p class="modal-lead">The simulation is paused. Resources and the clock will not advance.</p>
            <div class="modal-actions"><button class="primary-button" data-action="resume">RESUME NIGHT WATCH <span>→</span></button><button class="text-button" data-action="restart">ABANDON SHIFT</button></div>
        `, false);
    } else {
        closeModal(true);
        renderThreat();
    }
}

modalContent.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "start") startGame();
    else if (action === "restart") restartGame();
    else if (action === "resume") togglePause();
    else if (action === "close") closeModal();
    else if (action === "upkeep") performUpkeep(button.dataset.system);
});

introStart.addEventListener("click", beginNightWatch);
$("camera-button").addEventListener("click", scanFeed);
$("door-button").addEventListener("click", toggleGate);
$("systems-button").addEventListener("click", openSystems);
$("pause-button").addEventListener("click", togglePause);
$("help-button").addEventListener("click", () => showModal("FIELD MANUAL", "ARES-87 // CREW REFERENCE", `
    <p class="modal-lead">Make it to 06:00. The storm is not the only thing outside.</p>
    <div class="manual-list"><p><b>SUPPLIES</b> All four meters drain continuously. Below 30% the reserve warning turns amber; below 15% it turns red. Any meter reaching zero ends the shift.</p><p><b>MAINTENANCE</b> Refill a supply from the maintenance panel. Overrides cost other supplies and share a 28-second cooldown per system. The auxiliary reactor trades water and rations for power.</p><p><b>SECURITY</b> Scan the feed to get a better read on the approaching presence (costs 2.5% power). Close the gate when it gets close. A sealed gate uses extra power every second; a hit knocks the presence back but costs more power.</p><p><b>CONTROLS</b> C scan · G gate · M maintenance · Space pause · Esc close popup.</p><p><b>THE LOG</b> Crew entries and strange radio messages appear as the shift goes on. You may want to read them before sunrise.</p></div>
    <div class="modal-actions"><button class="primary-button" data-action="close">UNDERSTOOD <span>→</span></button></div>
`));
$("modal-close").addEventListener("click", () => closeModal());
backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeModal();
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
    if (event.repeat || backdrop.classList.contains("is-visible") || document.body.classList.contains("is-intro") || document.body.classList.contains("is-revealing") || document.body.classList.contains("is-restarting")) return;
    if (event.key.toLowerCase() === "c") scanFeed();
    else if (event.key.toLowerCase() === "g") toggleGate();
    else if (event.key.toLowerCase() === "m") openSystems();
    else if (event.code === "Space") {
        event.preventDefault();
        togglePause();
    }
});

renderAll();
addLog("Ares-87 night watch initiated. All systems nominal.", "system");
openIntro();
