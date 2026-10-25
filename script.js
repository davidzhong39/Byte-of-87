"use strict";

const SHIFT_LENGTH = 240;
const SCAN_COOLDOWN = 24;
const SCAN_DELAY = 6;
// Each night adjusts its own drains, starting faults, contact timing, and impact penalties.
// Every shift has a unique resource that is "leaking".
const SHIFT_PLANS = [
    {
        title: "REACTOR SURGE",
        gimmick: "POWER DRAINS HEAVILY",
        directive: "POWER SURGE: SAVE CHARGE AND USE THE AUXILIARY REACTOR (M).",
        drain: { power: 0.3 },
        startingOutages: ["reactor"],
        firstContact: 30,
        threatMin: 15,
        threatRange: 10
    },
    {
        title: "CONDENSER FAILURE",
        gimmick: "WATER SYSTEMS ARE LEAKING",
        directive: "CONDENSER FAILURE: WATER DRAINS FAST · PRIORITIZE THE CONDENSER (M).",
        drain: { water: 0.28 },
        startingOutages: ["condenser"],
        firstContact: 28,
        threatMin: 14,
        threatRange: 10
    },
    {
        title: "GREENHOUSE BLIGHT",
        gimmick: "FOOD PRODUCTION IS FAILING",
        directive: "GREENHOUSE BLIGHT: RATIONS DRAIN FAST · HARVEST RESERVE TRAYS (M).",
        drain: { food: 0.28 },
        startingOutages: ["hydroponics"],
        firstContact: 26,
        threatMin: 13,
        threatRange: 10
    },
    {
        title: "LIFE SUPPORT CASCADE",
        gimmick: "POWER AND WATER ARE BOTH STRAINED",
        directive: "LIFE SUPPORT CASCADE: POWER + WATER DRAIN FAST · BALANCE BOTH.",
        drain: { power: 0.2, water: 0.18 },
        startingOutages: ["reactor", "condenser"],
        firstContact: 23,
        threatMin: 12,
        threatRange: 9
    },
    {
        title: "TOTAL SYSTEM CASCADE",
        gimmick: "ALL FOUR SUPPLIES DRAIN FASTER",
        directive: "TOTAL CASCADE: ALL SUPPLIES ARE STRAINED · HANDLE THE LOWEST RESERVE FIRST.",
        drain: { oxygen: 0.14, power: 0.14, water: 0.14, food: 0.14 },
        startingOutages: ["scrubber", "reactor", "condenser", "hydroponics"],
        firstContact: 18,
        threatMin: 10,
        threatRange: 8
    },
    {
        title: "FINAL BREACH",
        gimmick: "ALL SYSTEMS FAILING · CONTACT EVERY FEW SECONDS",
        directive: "FINAL BREACH: ALL RESERVES COLLAPSING · CONTACT ADVANCES IN SECONDS.",
        drain: { oxygen: 0.2, power: 0.22, water: 0.2, food: 0.2 },
        startingOutages: ["scrubber", "reactor", "condenser", "hydroponics"],
        firstContact: 12,
        threatMin: 5,
        threatRange: 4,
        impactLoss: { power: 14, oxygen: 5, water: 5 }
    }
];
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
const cameraWireColors = [
    { name: "Amber", color: "#e29a4b" },
    { name: "Blue", color: "#63a9cf" },
    { name: "Green", color: "#a6b183" },
    { name: "Red", color: "#dc6c58" }
];
const sound = {
    enabled: true,
    context: null,
    master: null,
    ambience: null,
    noiseBuffer: null
};
// Shows up randomnly on the log on the right of the screen
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
const challengeSpecs = {
    scrubber: {
        title: "SCRUBBER CALIBRATION",
        eyebrow: "LIFE SUPPORT // SIGNAL ROUTING",
        system: "scrubber",
        rewardResource: "oxygen",
        reward: 18,
        cooldown: 45,
        costs: { power: 4, water: 2 },
        costText: "4 POWER · 2 WATER",
        description: "Route the scrubber's four-part pulse in the order it flashes."
    },
    condenser: {
        title: "CONDENSER PRESSURE",
        eyebrow: "WATER SYSTEM // LEAK ISOLATION",
        system: "condenser",
        rewardResource: "water",
        reward: 20,
        cooldown: 45,
        costs: { power: 3, oxygen: 1 },
        costText: "3 POWER · 1 O₂",
        description: "Isolate the pipe running above the safe pressure limit of 70 PSI."
    },
    hydroponics: {
        title: "NUTRIENT MIX",
        eyebrow: "GREENHOUSE // RESERVE TRAYS",
        system: "hydroponics",
        rewardResource: "food",
        reward: 18,
        cooldown: 45,
        costs: { water: 4, power: 2 },
        costText: "4 WATER · 2 POWER",
        description: "Select the tray that exactly matches the requested N / P / K blend."
    },
    reactor: {
        title: "REACTOR RESEQUENCE",
        eyebrow: "AUXILIARY REACTOR // POWER ROUTING",
        system: "reactor",
        rewardResource: "power",
        reward: 20,
        cooldown: 45,
        costs: { water: 3, food: 2 },
        costText: "3 WATER · 2 RATIONS",
        description: "Route two relay loads to match the reactor's target output."
    }
};
// Outages add continuous drain to the affected supply until the matching work order succeeds.
const systemOutages = {
    scrubber: { resource: "oxygen", note: "SCRUBBERS OFFLINE · O₂ DRAIN UP", drain: 0.28, log: "Scrubber array offline. Oxygen is draining faster; recalibrate the scrubber." },
    reactor: { resource: "power", note: "REACTOR OFFLINE · POWER DRAIN UP", drain: 0.34, log: "Main reactor offline. Power is draining faster; resequence the auxiliary reactor." },
    condenser: { resource: "water", note: "CONDENSER OFFLINE · WATER DRAIN UP", drain: 0.28, log: "Condenser offline. Water is draining faster; isolate the overpressure line." },
    hydroponics: { resource: "food", note: "HYDROPONICS OFFLINE · RATIONS DRAIN UP", drain: 0.28, log: "Hydroponics offline. Rations are draining faster; restore the nutrient mix." }
};
const state = {
    running: false,
    paused: false,
    ended: false,
    shiftNumber: 1,
    elapsed: 0,
    resources: { oxygen: 100, power: 100, water: 100, food: 100 },
    systems: { scrubber: true, reactor: true, condenser: true, hydroponics: true },
    outagesTriggered: 0,
    nextOutageAt: Infinity,
    cameraOnline: true,
    nextCameraOutage: Infinity,
    cameraWiring: null,
    gateClosed: false,
    threat: 0,
    nextThreatMove: 30,
    nextAmbient: 30,
    lastUpkeep: { oxygen: -Infinity, water: -Infinity, food: -Infinity, power: -Infinity },
    strainWarnings: { oxygen: false, power: false, water: false, food: false },
    challengeCooldowns: { scrubber: -Infinity, condenser: -Infinity, hydroponics: -Infinity, reactor: -Infinity },
    activeChallenge: null,
    challengeTimers: [],
    loreIndex: 0,
    scannedAt: -Infinity,
    tickId: null,
    systemsCountdownId: null,
    toastId: null,
    introTimer: null,
    jumpscareTimer: null,
    modalReturnFocus: null,
    modalHotkey: null
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

function currentShift() {
    return SHIFT_PLANS[state.shiftNumber - 1];
}

function renderShiftIdentity() {
    $("mission-day").textContent = String(81 + state.shiftNumber);
    $("shift-label").textContent = `NIGHT ${81 + state.shiftNumber} · LEVEL ${state.shiftNumber} / ${SHIFT_PLANS.length} · ${currentShift().title}`;
}

// Popups share one shell; their data-action buttons are handled by the delegated click listener below.
function showModal(title, eyebrow, content, dismissible = true, hotkey = null) {
    window.clearInterval(state.systemsCountdownId);
    state.systemsCountdownId = null;
    state.modalReturnFocus = document.activeElement;
    state.modalHotkey = hotkey;
    modalTitle.textContent = title;
    modalEyebrow.textContent = eyebrow;
    modalContent.innerHTML = content;
    $("modal-card").classList.toggle("is-wide", Boolean(modalContent.querySelector(".night-select-grid")));
    modalClose.hidden = !dismissible;
    backdrop.classList.add("is-visible");
    const firstButton = modalContent.querySelector("button");
    (firstButton || modalClose).focus();
}

function closeModal(force = false) {
    if (!backdrop.classList.contains("is-visible") || (modalClose.hidden && !force)) return;
    window.clearInterval(state.systemsCountdownId);
    state.systemsCountdownId = null;
    if (state.cameraWiring) {
        // Leaving a repair puzzle does not restore the already-committed resources or camera signal.
        state.cameraWiring = null;
        addLog("Camera repair abandoned. The exterior feed remains offline.", "warning");
        showToast("CAMERA REPAIR ABORTED · FEED STILL OFFLINE", true);
    }
    if (state.activeChallenge) {
        state.activeChallenge = null;
        clearChallengeTimers();
        addLog("Maintenance work order abandoned. Committed supplies were not recovered.", "warning");
        showToast("WORK ORDER ABANDONED · SUPPLIES LOST", true);
    }
    backdrop.classList.remove("is-visible");
    state.modalHotkey = null;
    if (state.modalReturnFocus && typeof state.modalReturnFocus.focus === "function") state.modalReturnFocus.focus();
}

// Ambient sound and effects are synthesized with Web Audio rather than loaded assets.
function initializeAudio() {
    if (sound.context || !sound.enabled) {
        if (sound.enabled && sound.context?.state === "suspended") {
            sound.context.resume().catch((error) => console.error("Unable to resume game audio.", error));
        }
        return;
    }
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
        sound.enabled = false;
        updateSoundButton();
        showToast("AUDIO IS NOT SUPPORTED IN THIS BROWSER", true);
        return;
    }
    sound.context = new AudioContextConstructor();
    sound.master = sound.context.createGain();
    sound.master.gain.value = 0.5;
    sound.master.connect(sound.context.destination);

    const ambienceBus = sound.context.createGain();
    ambienceBus.gain.value = 0.14;
    ambienceBus.connect(sound.master);
    const lowDrone = sound.context.createOscillator();
    lowDrone.type = "sine";
    lowDrone.frequency.value = 48;
    const highDrone = sound.context.createOscillator();
    highDrone.type = "triangle";
    highDrone.frequency.value = 72.4;
    const lowGain = sound.context.createGain();
    lowGain.gain.value = 0.42;
    const highGain = sound.context.createGain();
    highGain.gain.value = 0.16;
    lowDrone.connect(lowGain);
    highDrone.connect(highGain);
    lowGain.connect(ambienceBus);
    highGain.connect(ambienceBus);
    lowDrone.start();
    highDrone.start();

    const noiseLength = sound.context.sampleRate * 2;
    sound.noiseBuffer = sound.context.createBuffer(1, noiseLength, sound.context.sampleRate);
    const noiseData = sound.noiseBuffer.getChannelData(0);
    for (let index = 0; index < noiseLength; index += 1) noiseData[index] = Math.random() * 2 - 1;
    const wind = sound.context.createBufferSource();
    wind.buffer = sound.noiseBuffer;
    wind.loop = true;
    const windFilter = sound.context.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 310;
    const windGain = sound.context.createGain();
    windGain.gain.value = 0.12;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ambienceBus);
    wind.start();
    sound.ambience = { bus: ambienceBus, lowDrone, highDrone, wind };
}

function startAmbientAudio() {
    initializeAudio();
    if (!sound.context || !sound.enabled || !sound.ambience) return;
    sound.ambience.bus.gain.setTargetAtTime(state.paused ? 0.025 : 0.14, sound.context.currentTime, 0.8);
}

function setAmbientLevel(level) {
    if (sound.context && sound.ambience) {
        sound.ambience.bus.gain.setTargetAtTime(level, sound.context.currentTime, 0.35);
    }
}

function playTone(frequency, duration, type = "sine", volume = 0.2, endFrequency = frequency, delay = 0) {
    if (!sound.enabled) return;
    initializeAudio();
    if (!sound.context || !sound.master) return;
    const context = sound.context;
    const startAt = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), startAt + duration);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(sound.master);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
}

function playNoise(duration, volume, frequency = 900, type = "bandpass") {
    if (!sound.enabled) return;
    initializeAudio();
    if (!sound.context || !sound.master || !sound.noiseBuffer) return;
    const context = sound.context;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = sound.noiseBuffer;
    filter.type = type;
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(sound.master);
    source.start();
    source.stop(context.currentTime + duration);
}

function playSoundEffect(name) {
    if (!sound.enabled) return;
    if (name === "gate") {
        playTone(125, 0.24, "triangle", 0.18, 54);
        playNoise(0.18, 0.09, 380, "lowpass");
    } else if (name === "scan") {
        playTone(620, 0.12, "sine", 0.12, 1180);
        playTone(940, 0.18, "sine", 0.08, 520, 0.12);
    } else if (name === "outage") {
        playNoise(0.7, 0.14, 1400);
        playTone(190, 0.48, "sawtooth", 0.08, 48);
    } else if (name === "wire") {
        playTone(520, 0.09, "sine", 0.11, 740);
        playTone(780, 0.13, "sine", 0.09, 1040, 0.1);
    } else if (name === "jumpscare") {
        playNoise(0.95, 0.34, 720, "lowpass");
        playTone(92, 0.8, "sawtooth", 0.32, 24);
        playTone(880, 0.45, "square", 0.16, 110, 0.04);
    } else if (name === "victory") {
        [[523.25, 0], [659.25, 0.14], [783.99, 0.28], [1046.5, 0.48]].forEach(([frequency, delay]) =>
            playTone(frequency, 0.55, "sine", 0.12, frequency * 1.01, delay)
        );
    } else if (name === "power-down") {
        playTone(220, 1.1, "triangle", 0.2, 38);
        playTone(165, 1.25, "sawtooth", 0.08, 28, 0.08);
        playNoise(0.9, 0.12, 260, "lowpass");
    }
}

function updateSoundButton() {
    const button = $("sound-button");
    if (!button) return;
    button.textContent = sound.enabled ? "♪ SOUND ON" : "♪ SOUND OFF";
    button.setAttribute("aria-pressed", String(sound.enabled));
}

function toggleSound() {
    sound.enabled = !sound.enabled;
    updateSoundButton();
    if (sound.enabled) startAmbientAudio();
    else if (sound.master && sound.context) {
        sound.master.gain.setTargetAtTime(0, sound.context.currentTime, 0.05);
    }
    if (sound.enabled && sound.master && sound.context) {
        sound.master.gain.setTargetAtTime(0.5, sound.context.currentTime, 0.12);
    }
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
    list.append(entry);
    // Keeps the log to a maximum of 12 items
    while (list.children.length > 12) list.firstElementChild.remove();
    list.scrollTop = list.scrollHeight;
    $("log-count").textContent = String(list.children.length).padStart(2, "0");
}

function formatClock() {
    const gameMinutes = Math.floor(state.elapsed * 1.5);
    const hours = Math.floor(gameMinutes / 60);
    const minutes = gameMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// Render functions translate state into HUD text, meter widths, warning classes, and scene labels.
function renderResources() {
    for (const name of resourceNames) {
        const amount = Math.max(0, Math.min(100, state.resources[name]));
        const rounded = Math.round(amount);
        $(`${name}-value`).textContent = String(rounded);
        $(`${name}-meter`).style.width = `${amount}%`;
        const card = document.querySelector(`[data-resource="${name}"]`);
        card.classList.toggle("is-low", amount < 30);
        card.classList.toggle("is-critical", amount < 15);
        const strainNotes = {
            // Shortages can increase demand on linked systems, in addition to their normal drains.
            oxygen: state.resources.water < 25 ? "WATER LOW: O₂ USE UP" : "",
            power: state.resources.oxygen < 25 ? "O₂ LOW: REACTOR DRAW UP" : "",
            water: state.resources.food < 25 ? "RATIONS LOW: WATER USE UP" : "",
            food: state.resources.oxygen < 25 ? "CREW FATIGUE: RATIONS USE UP" : ""
        };
        const offlineSystem = Object.entries(systemOutages).find(([system, outage]) => outage.resource === name && !state.systems[system]);
        $(`${name}-note`).textContent = offlineSystem
            ? offlineSystem[1].note
            : amount < 15 ? "CRITICAL RESERVE" : amount < 30 ? "LOW RESERVE" : strainNotes[name] || ({
            oxygen: "SCRUBBERS ONLINE",
            power: "REACTOR NOMINAL",
            water: "TANKS: 4,200 L",
            food: "HYDROPONICS: ACTIVE"
        })[name];
    }
    const average = resourceNames.reduce((total, name) =>
        total + Math.max(0, Math.min(100, state.resources[name])), 0) / resourceNames.length;
    const roundedAverage = Math.round(average);
    const status = average < 35 ? "CRITICAL" : average < 70 ? "STRAINED" : "STABLE";
    $("vitals-label").textContent = `${roundedAverage}% · ${status}`;
    $("vitals-label").classList.toggle("is-critical-text", average < 35);
    $("vitals-label").classList.toggle("is-strained-text", average >= 35 && average < 70);
    const dots = document.querySelector(".vitals-dots");
    dots.classList.toggle("is-critical", average < 35);
    dots.classList.toggle("is-strained", average >= 35 && average < 70);
    document.querySelectorAll(".vitals-dots i").forEach((dot, index) => {
        dot.classList.toggle("is-active", average >= (index + 1) * 20);
    });
}

function renderTime() {
    const remaining = Math.max(0, SHIFT_LENGTH - state.elapsed);
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const nightProgress = Math.min(1, state.elapsed / SHIFT_LENGTH);
    scene.style.setProperty("--moon-top", `${12 + nightProgress * 47}%`);
    scene.style.setProperty("--moon-right", `${18 + nightProgress * 67}%`);
    $("clock").textContent = formatClock();
    $("remaining-label").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} REMAINING`;
    $("timeline-progress").style.width = `${(state.elapsed / SHIFT_LENGTH) * 100}%`;
    renderShiftIdentity();
}

function renderThreat() {
    const scene = $("scene");
    const readout = $("threat-message");
    const position = state.threat;
    // CSS uses this attribute to reveal footprints and escalate camera styling by threat level.
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
    $("door-title").textContent = "PERIMETER GATE";
    $("door-caption").textContent = state.gateClosed ? "SEALED · CLICK TO OPEN" : "OPEN · CLICK TO SEAL";
    $("door-button").setAttribute("aria-pressed", String(state.gateClosed));
    $("door-button").classList.toggle("is-sealed", state.gateClosed);
    renderCamera();
    $("system-status").textContent = state.paused ? "NIGHT PAUSED" : state.running ? (position >= 3 ? "PERIMETER ALERT" : "LIFE SUPPORT ONLINE") : state.ended ? "NIGHT COMPLETE" : "SYSTEMS STANDBY";
    $("system-status").classList.toggle("status-alert", position >= 3 && state.running);

    const lowestReserve = resourceNames
        .filter((name) => state.resources[name] < 30)
        .sort((left, right) => state.resources[left] - state.resources[right])[0];
    const objective = position >= 3 && !state.gateClosed
        ? "PERIMETER ALERT: SEAL THE GATE NOW (G)."
        : state.gateClosed && position < 2
            ? "GATE SEALED: OPEN IT WHEN CONTACT CLEARS TO SAVE POWER."
            : lowestReserve
                ? `RESTORE ${lowestReserve.toUpperCase()} IN MAINTENANCE (M) · REPAIRS COST OTHER SUPPLIES.`
                : `${currentShift().directive} KEEP ALL FOUR RESERVES ABOVE ZERO UNTIL 06:00.`;
    $("watch-objective").textContent = objective;
}

function renderAll() {
    renderResources();
    renderTime();
    renderThreat();
    updateSystemsCountdowns();
}

function addResource(name, amount) {
    state.resources[name] = Math.max(0, Math.min(100, state.resources[name] + amount));
}

function triggerSystemOutage() {
    const availableSystems = Object.keys(systemOutages).filter((system) => state.systems[system]);
    if (availableSystems.length === 0 || state.outagesTriggered >= 2) {
        state.nextOutageAt = Infinity;
        return;
    }
    const system = availableSystems[Math.floor(Math.random() * availableSystems.length)];
    const outage = systemOutages[system];
    state.systems[system] = false;
    state.outagesTriggered += 1;
    state.nextOutageAt = state.outagesTriggered < 2 ? state.elapsed + 55 + Math.floor(Math.random() * 26) : Infinity;
    addLog(outage.log, "warning");
    playSoundEffect("outage");
    showToast(`${system.toUpperCase()} OFFLINE · MAINTENANCE REPAIR REQUIRED`, true);
    renderAll();
}

// Intro timing, typewriter text, and the transition into the selected night are coordinated here.
// Opening the intro restarts its timers so animation or typewriter state cannot carry between runs.
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
    startAmbientAudio();
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
    window.setTimeout(() => {
        document.body.classList.remove("is-intro", "is-revealing");
        introScreen.hidden = true;
        showMainMenu();
    }, INTRO_REVEAL_DURATION);
}

function showMainMenu() {
    startAmbientAudio();
    const nightOptions = SHIFT_PLANS.map((shift, index) => `
        <button class="night-select-option ${index === SHIFT_PLANS.length - 1 ? "is-final-night" : ""}" data-action="select-shift" data-shift="${index + 1}">
            <span class="night-select-day">NIGHT ${82 + index}</span>
            <strong>${shift.title}</strong>
            <small>${shift.gimmick}</small>
        </button>
    `).join("");
    showModal("SELECT A NIGHT", "ARES-87 // NIGHT LEVELS", `
        <p class="modal-lead">Choose one of six standalone night levels. Every level starts with full reserves and its own fresh systems.</p>
        <div class="night-select-grid">${nightOptions}</div>
        <p class="subtle-note">EACH NIGHT IS ITS OWN LEVEL. NIGHT 87 IS THE HIGH-INTENSITY CHALLENGE.</p>
    `, false);
}

function selectShift(shiftNumber) {
    if (!Number.isInteger(shiftNumber) || shiftNumber < 1 || shiftNumber > SHIFT_PLANS.length) return;
    resetGameState();
    state.shiftNumber = shiftNumber;
    applyStartingOutages();
    state.nextThreatMove = currentShift().firstContact;
    renderAll();
    showShiftBriefing();
}

function showShiftBriefing() {
    const shift = currentShift();
    const night = 81 + state.shiftNumber;
    const isFinalNight = state.shiftNumber === SHIFT_PLANS.length;
    showModal(`${shift.title}`, `NIGHT ${night} // LEVEL BRIEFING`, `
        <p class="modal-lead">${isFinalNight
            ? "Night 87 is the high-intensity standalone level. All four reserves are draining hard, and the presence will reach the gate within seconds."
            : `Survive Night ${night} as a standalone level. Your reserves start full, and this run is separate from the other nights.`}</p>
        <div class="manual-list">
            <p><b>${shift.title}</b> ${shift.gimmick}. Follow the objective beneath the clock, watch all four reserves, and use Maintenance to trade supplies for repairs.</p>
            <p><b>THE PERIMETER</b> First contact is expected after ${shift.firstContact} seconds. Seal the gate when the outer gate alert appears, then open it after impact to save charge.</p>
            <p><b>SECURITY PULSE</b> A scan costs 2.5% power and delays the next movement by ${SCAN_DELAY} seconds. Use it to buy time for a gate or repair decision; scans recharge every ${SCAN_COOLDOWN} seconds.</p>
            <p><b>INITIAL SYSTEM FAILURE</b> ${shift.startingOutages.map((system) => systemOutages[system].note).join(" · ")}. Complete the matching maintenance order to restore each system.</p>
            <p><b>STANDALONE LEVEL</b> All supplies and system statuses reset when this night begins. Your result does not carry into another selected night.</p>
        </div>
        <div class="modal-actions"><span class="subtle-note">SCAN: C · GATE: G · MAINTENANCE: M</span><button class="primary-button" data-action="start">BEGIN NIGHT ${night} <span>→</span></button></div>
    `, false);
}

function startGame() {
    if (state.running || state.ended) return;
    startAmbientAudio();
    state.running = true;
    state.paused = false;
    closeModal(true);
    if (state.nextOutageAt === Infinity && state.outagesTriggered < 2) {
        state.nextOutageAt = state.elapsed + 35 + Math.floor(Math.random() * 26);
    }
    if (state.cameraOnline && state.nextCameraOutage === Infinity) {
        state.nextCameraOutage = state.elapsed + 45 + Math.floor(Math.random() * 41);
    }
    $("system-status").textContent = "LIFE SUPPORT ONLINE";
    addLog(`Night ${81 + state.shiftNumber} · ${currentShift().title}: ${currentShift().gimmick}.`, "system");
    addLog(`Night ${81 + state.shiftNumber} started. Perimeter contact expected after ${currentShift().firstContact} seconds.`, "system");
    for (const system of currentShift().startingOutages) addLog(systemOutages[system].log, "warning");
    state.tickId = window.setInterval(tick, 1000);
    renderAll();
}

function checkResourceStrain() {
    const warnings = {
        oxygen: "Oxygen below 25%. Crew life support is entering critical reserve.",
        power: "Power below 25%. The condenser is losing efficiency and consuming extra water.",
        water: "Water below 25%. Scrubber efficiency is falling; oxygen will drain faster.",
        food: "Rations below 25%. Crew fatigue is raising water demand."
    };
    for (const name of resourceNames) {
        if (state.resources[name] < 25 && !state.strainWarnings[name]) {
            state.strainWarnings[name] = true;
            addLog(warnings[name], "warning");
        } else if (state.resources[name] >= 30) {
            state.strainWarnings[name] = false;
        }
    }
}

// The one-second game loop drains supplies, advances threats and outages, and checks shift outcomes.
function tick() {
    if (!state.running || state.paused || state.ended) return;
    state.elapsed += 1;
    const shiftDrain = currentShift().drain;
    // Combine base use, selected-night penalties, outages, and low-reserve strain before deducting.
    const outageDrain = Object.entries(systemOutages).reduce((drains, [system, outage]) => {
        if (!state.systems[system]) drains[outage.resource] += outage.drain;
        return drains;
    }, { oxygen: 0, power: 0, water: 0, food: 0 });
    state.resources.oxygen -= 0.105 + (shiftDrain.oxygen || 0) + outageDrain.oxygen + (state.resources.water < 25 ? 0.055 : 0) + (state.resources.food < 25 ? 0.015 : 0);
    state.resources.power -= 0.115 + (shiftDrain.power || 0) + outageDrain.power + (state.gateClosed ? 0.23 : 0) + (state.resources.oxygen < 25 ? 0.035 : 0);
    state.resources.water -= 0.085 + (shiftDrain.water || 0) + outageDrain.water + (state.resources.food < 25 ? 0.035 : 0) + (state.resources.power < 25 ? 0.02 : 0);
    state.resources.food -= 0.075 + (shiftDrain.food || 0) + outageDrain.food + (state.resources.oxygen < 25 ? 0.02 : 0);

    if (state.elapsed >= state.nextOutageAt) triggerSystemOutage();
    if (state.elapsed >= state.nextCameraOutage) triggerCameraOutage();

    if (state.elapsed >= state.nextThreatMove) {
        const shift = currentShift();
        state.nextThreatMove = state.elapsed + shift.threatMin + Math.floor(Math.random() * shift.threatRange);
        if (state.gateClosed && state.threat >= 2) {
            state.threat = 0;
            const impactLoss = shift.impactLoss || { power: 10, oxygen: 3, water: 3 };
            for (const [resource, amount] of Object.entries(impactLoss)) addResource(resource, -amount);
            addLog("Impact on the gate. The pressure seal vents oxygen and coolant before whatever it was goes quiet.", "warning");
            showToast("GATE IMPACT · POWER / O₂ / H₂O LOST", true);
        } else {
            state.threat = Math.min(4, state.threat + 1);
            addLog(state.threat >= 3 ? "Motion at the outer gate. Seal it now." : "A shape moved between the ridge cameras.", "warning");
        }
        if (state.threat >= 4 && !state.gateClosed) {
            renderAll();
            triggerJumpscare();
            return;
        }
    }

    if (state.elapsed >= state.nextAmbient) {
        state.nextAmbient = state.elapsed + 32 + Math.floor(Math.random() * 14);
        addLog(ambientMessages[Math.floor(Math.random() * ambientMessages.length)], "lore");
    }

    if (state.loreIndex < lore.length && state.elapsed >= (state.loreIndex + 1) * 42) {
        const [date, entry] = lore[state.loreIndex];
        state.loreIndex += 1;
        addLog(`${date}: ${entry}`, "lore");
    }

    if (state.gateClosed && state.resources.power <= 1) {
        state.gateClosed = false;
        addLog("Power depleted. Perimeter gate released automatically.", "warning");
        showToast("POWER CRITICAL · GATE RELEASED", true);
    }
    checkResourceStrain();
    renderAll();

    const failedResource = resourceNames.find((name) => state.resources[name] <= 0);
    if (failedResource) {
        endGame(false, `${failedResource.toUpperCase()} reserves reached zero. The outpost could not sustain life support.`);
    } else if (state.elapsed >= SHIFT_LENGTH) {
        endGame(true, `Night ${81 + state.shiftNumber} survived. Dawn breaks over Ares-87, and the ridge is finally empty. Your radio crackles once: "Good morning, Mara."`);
    }
}

// All normal wins and resource-loss endings converge on this result modal.
function endGame(won, message) {
    state.running = false;
    state.ended = true;
    state.activeChallenge = null;
    clearChallengeTimers();
    window.clearInterval(state.tickId);
    setAmbientLevel(won ? 0.035 : 0.002);
    playSoundEffect(won ? "victory" : "power-down");
    $("system-status").textContent = won ? "NIGHT COMPLETE" : "OUTPOST LOST";
    $("system-status").classList.toggle("status-alert", !won);
    showModal(won ? `NIGHT ${81 + state.shiftNumber} COMPLETE` : "SIGNAL LOST", won ? `NIGHT ${81 + state.shiftNumber} // LEVEL COMPLETE` : `NIGHT ${81 + state.shiftNumber} // CREW STATUS UNKNOWN`, `
        <div class="end-stamp ${won ? "is-win" : ""}">${won ? "06:00" : "NO SIGNAL"}</div>
        <p class="modal-lead">${message}</p>
        <div class="debrief"><span>NIGHT LENGTH <b>${formatClock()}</b></span><span>O₂ <b>${Math.round(state.resources.oxygen)}%</b></span><span>POWER <b>${Math.round(state.resources.power)}%</b></span><span>WATER <b>${Math.round(state.resources.water)}%</b></span><span>RATIONS <b>${Math.round(state.resources.food)}%</b></span></div>
        <div class="modal-actions">${won
            ? `<button class="text-button" data-action="restart">RESTART NIGHT ${81 + state.shiftNumber}</button><button class="primary-button" data-action="${state.shiftNumber < SHIFT_PLANS.length ? "select-shift" : "main-menu"}" ${state.shiftNumber < SHIFT_PLANS.length ? `data-shift="${state.shiftNumber + 1}"` : ""}>${state.shiftNumber < SHIFT_PLANS.length ? `NEXT NIGHT ${82 + state.shiftNumber}` : "NIGHT SELECT"} <span>→</span></button>`
            : `<button class="text-button" data-action="main-menu">NIGHT SELECT</button><button class="primary-button" data-action="restart">RESTART NIGHT ${81 + state.shiftNumber} <span>↻</span></button>`}</div>
    `, false);
}

function triggerJumpscare() {
    state.running = false;
    window.clearInterval(state.tickId);
    closeModal(true);
    const jumpscare = $("jumpscare");
    jumpscare.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-jumpscared");
    playSoundEffect("jumpscare");
    window.clearTimeout(state.jumpscareTimer);
    state.jumpscareTimer = window.setTimeout(() => {
        document.body.classList.remove("is-jumpscared");
        jumpscare.setAttribute("aria-hidden", "true");
        endGame(false, "The outer gate buckled inward. The thing in the storm reached the habitat before you could get away.");
    }, 1100);
}

function restartGame() {
    const shiftNumber = state.shiftNumber;
    window.clearInterval(state.tickId);
    window.clearTimeout(state.introTimer);
    closeModal(true);
    document.body.classList.remove("is-intro");
    document.body.classList.add("is-restarting");

    window.setTimeout(() => {
        resetGameState();
        state.shiftNumber = shiftNumber;
        applyStartingOutages();
        state.nextThreatMove = currentShift().firstContact;
        renderAll();
        introScreen.hidden = true;
        startGame();
        document.body.classList.add("is-revealing-hub");

        window.setTimeout(() => {
            document.body.classList.remove("is-restarting", "is-revealing-hub");
            $("camera-button").focus();
        }, RESTART_FADE_DURATION);
    }, RESTART_FADE_DURATION);
}

function returnToMainMenu() {
    window.clearInterval(state.tickId);
    window.clearTimeout(state.introTimer);
    closeModal(true);
    resetGameState();
    renderAll();
    showMainMenu();
}

// Clear timers and transient UI as well as gameplay values to prevent state leaking between nights.
function resetGameState() {
    window.clearTimeout(state.toastId);
    window.clearTimeout(state.jumpscareTimer);
    window.clearInterval(state.systemsCountdownId);
    state.systemsCountdownId = null;
    clearChallengeTimers();
    document.body.classList.remove("is-jumpscared");
    $("jumpscare").setAttribute("aria-hidden", "true");
    $("toast").classList.remove("is-visible", "is-warning");
    state.running = false;
    state.paused = false;
    state.ended = false;
    state.shiftNumber = 1;
    state.elapsed = 0;
    state.resources = { oxygen: 100, power: 100, water: 100, food: 100 };
    state.systems = { scrubber: true, reactor: true, condenser: true, hydroponics: true };
    state.outagesTriggered = 0;
    state.nextOutageAt = Infinity;
    state.cameraOnline = true;
    state.nextCameraOutage = Infinity;
    state.cameraWiring = null;
    state.gateClosed = false;
    state.threat = 0;
    state.nextThreatMove = SHIFT_PLANS[0].firstContact;
    state.nextAmbient = 30;
    state.lastUpkeep = { oxygen: -Infinity, water: -Infinity, food: -Infinity, power: -Infinity };
    state.strainWarnings = { oxygen: false, power: false, water: false, food: false };
    state.challengeCooldowns = { scrubber: -Infinity, condenser: -Infinity, hydroponics: -Infinity, reactor: -Infinity };
    state.activeChallenge = null;
    state.loreIndex = 0;
    state.scannedAt = -Infinity;
    $("pause-button").textContent = "Ⅱ  PAUSE";
    $("log-list").replaceChildren();
    $("log-count").textContent = "00";
    renderResources();
}

function applyStartingOutages() {
    state.systems = { scrubber: true, reactor: true, condenser: true, hydroponics: true };
    for (const system of currentShift().startingOutages) state.systems[system] = false;
    state.outagesTriggered = currentShift().startingOutages.length;
}

function triggerCameraOutage() {
    if (!state.cameraOnline) return;
    state.cameraOnline = false;
    state.nextCameraOutage = Infinity;
    addLog("Exterior cameras lost signal. The monitor is flickering; reconnect the color-coded lines.", "warning");
    playSoundEffect("outage");
    showToast("CAMERAS OFFLINE · REPAIR THE WIRING", true);
    renderAll();
}

function renderCamera() {
    const offline = !state.cameraOnline;
    const cameraButton = $("camera-button");
    const cameraScene = $("scene");
    cameraScene.classList.toggle("is-camera-offline", offline);
    cameraButton.classList.toggle("is-offline", offline);
    cameraButton.setAttribute("aria-label", offline ? "Repair offline security cameras" : "Scan security feed");
    cameraButton.querySelector("strong").textContent = offline ? "CAMERAS OFFLINE" : "SECURITY FEED";
    cameraButton.querySelector("small").innerHTML = offline
        ? "RECONNECT WIRES · OPEN"
        : `PULSE · STALL 6 SEC <kbd>C</kbd>`;
}

// Camera repair and maintenance/work-order buttons open interactive content in the shared modal.
function openCameraRepair() {
    if (!state.running || state.paused || state.cameraOnline) return;
    if (state.activeChallenge) {
        showToast("FINISH THE CURRENT WORK ORDER FIRST", true);
        return;
    }
    const rightColors = [0, 1, 2, 3];
    for (let index = rightColors.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [rightColors[index], rightColors[swapIndex]] = [rightColors[swapIndex], rightColors[index]];
    }
    state.cameraWiring = { selected: null, connected: [], rightColors };
    showModal("RESTORE CAMERA FEED", "EXTERIOR ARRAY // WIRING REPAIR", `
        <p class="modal-lead">Reconnect each loose camera wire to the matching color on the right. Select a wire on the left, then its matching terminal. Complete all four connections to restore the feed.</p>
        <div class="wiring-board" aria-label="Camera wiring puzzle">
            <div class="wire-bank" aria-label="Loose camera wires">${cameraWireColors.map((wire, index) => `
                <button class="wire-endpoint" type="button" data-action="camera-wire" data-side="left" data-color="${index}" style="--wire-color:${wire.color}" aria-label="${wire.name} wire">
                    <span class="wire-terminal"></span><span>CAM ${String(index + 1).padStart(2, "0")}</span>
                </button>
            `).join("")}</div>
            <div class="wire-bank" aria-label="Cable terminals">${rightColors.map((color) => `
                <button class="wire-endpoint" type="button" data-action="camera-wire" data-side="right" data-color="${color}" style="--wire-color:${cameraWireColors[color].color}" aria-label="${cameraWireColors[color].name} terminal">
                    <span class="wire-terminal"></span><span>PORT ${String(rightColors.indexOf(color) + 1).padStart(2, "0")}</span>
                </button>
            `).join("")}</div>
        </div>
        <p class="challenge-status" id="wire-status" aria-live="polite">SELECT A LOOSE WIRE</p>
        <div class="modal-actions"><span class="subtle-note">ALL FOUR CONNECTIONS REQUIRED</span><button class="text-button" data-action="close">LEAVE FEED OFFLINE</button></div>
    `);
}

function handleCameraWire(side, color) {
    const wiring = state.cameraWiring;
    if (!wiring || !Number.isInteger(color) || color < 0 || color >= cameraWireColors.length) return;
    const status = $("wire-status");
    if (side === "left") {
        if (wiring.connected.includes(color)) return;
        wiring.selected = color;
        status.textContent = `CAM ${String(color + 1).padStart(2, "0")} SELECTED · CHOOSE THE MATCHING COLOR`;
    } else if (side === "right") {
        if (wiring.selected === null) {
            status.textContent = "SELECT A LOOSE WIRE FIRST";
            return;
        }
        if (wiring.selected !== color) {
            wiring.selected = null;
            status.textContent = "COLOR MISMATCH · SELECT A WIRE AND TRY AGAIN";
            renderCameraWiring();
            return;
        }
        wiring.connected.push(color);
        wiring.selected = null;
        if (wiring.connected.length === cameraWireColors.length) {
            completeCameraRepair();
            return;
        }
        status.textContent = `${wiring.connected.length} / ${cameraWireColors.length} CONNECTIONS SECURE`;
    } else {
        return;
    }
    renderCameraWiring();
}

function renderCameraWiring() {
    const wiring = state.cameraWiring;
    if (!wiring) return;
    modalContent.querySelectorAll(".wire-endpoint").forEach((button) => {
        const color = Number(button.dataset.color);
        const connected = wiring.connected.includes(color);
        button.classList.toggle("is-connected", connected);
        button.classList.toggle("is-selected", button.dataset.side === "left" && wiring.selected === color);
        button.disabled = connected;
        button.setAttribute("aria-pressed", String(button.dataset.side === "left" && wiring.selected === color));
    });
}

function completeCameraRepair() {
    state.cameraWiring = null;
    state.cameraOnline = true;
    state.nextCameraOutage = state.elapsed + 45 + Math.floor(Math.random() * 41);
    addLog("Camera feed restored. The exterior array is back online.", "system");
    playSoundEffect("wire");
    renderAll();
    closeModal(true);
    showToast("CAMERAS ONLINE · FEED RESTORED");
}

function scanFeed() {
    if (!state.running || state.paused) {
        showToast("SECURITY FEED UNAVAILABLE", true);
        return;
    }
    if (!state.cameraOnline) {
        openCameraRepair();
        return;
    }
    if (state.resources.power < 3) {
        showToast("NOT ENOUGH POWER TO SCAN", true);
        return;
    }
    const cooldownRemaining = SCAN_COOLDOWN - (state.elapsed - state.scannedAt);
    if (cooldownRemaining > 0) {
        showToast(`SCANNER RECHARGING · ${Math.ceil(cooldownRemaining)}S`, true);
        return;
    }
    addResource("power", -2.5);
    playSoundEffect("scan");
    state.scannedAt = state.elapsed;
    state.nextThreatMove = Math.max(state.nextThreatMove, state.elapsed) + SCAN_DELAY;
    const sightings = [
        "Nothing on the ridge. The camera keeps refocusing on the airlock.",
        "Thermal return: one figure. No heat signature.",
        "East ridge is clear. The tracks leading toward you are not.",
        "Feed static. Something is standing where the camera cannot see."
    ];
    const index = state.threat > 0 ? Math.min(state.threat, sightings.length - 1) : 0;
    addLog(sightings[index], state.threat > 0 ? "warning" : "system");
    const movementEta = Math.max(0, state.nextThreatMove - state.elapsed);
    showModal("SECURITY FEED", `CAM 0${Math.min(3, state.threat + 1)} // LIVE SCAN`, `
        <div class="camera-preview ${state.threat > 0 ? "camera-danger" : ""}"><span class="camera-crosshair">+</span><div class="camera-scanline"></div><b>${state.threat > 0 ? "THERMAL ANOMALY DETECTED" : "NO MOTION DETECTED"}</b><small>${state.threat > 0 ? `DISTANCE: ${Math.max(8, 46 - state.threat * 10)}M · BEARING EAST` : "PERIMETER CLEAR · SIGNAL 98%"}</small><small>NEXT MOVEMENT IN ${movementEta} SEC</small></div>
        <p class="subtle-note">PULSE INTERFERENCE DELAYS THE NEXT MOVEMENT BY ${SCAN_DELAY} SEC · 2.5% POWER · ${SCAN_COOLDOWN} SEC RECHARGE.</p>
        <div class="modal-actions"><button class="primary-button" data-action="close">RETURN TO HABITAT <span>→</span></button></div>
    `, true, "c");
    renderAll();
}

// Sealing blocks a high-level impact but costs power immediately and increases its ongoing drain.
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
    playSoundEffect("gate");
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
        return `<button class="system-option" data-action="upkeep" data-system="${name}" ${disabled ? "disabled" : ""}><span class="system-option-icon">${({ oxygen: "O₂", power: "ϟ", water: "H₂O", food: "N" })[name]}</span><span><b>${name.toUpperCase()} <small data-cooldown-label>${cooldown > 0 ? ` · READY IN ${Math.ceil(cooldown)}S` : ""}</small></b><small>${descriptions[name]}</small></span><span class="system-plus">+</span></button>`;
    }).join("");
    const challengeButtons = Object.entries(challengeSpecs).map(([name, challenge]) => {
        const cooldown = Math.max(0, challenge.cooldown - (state.elapsed - state.challengeCooldowns[name]));
        const insufficient = Object.entries(challenge.costs).some(([resource, cost]) => state.resources[resource] < cost);
        const disabled = !available || cooldown > 0 || insufficient || Boolean(state.activeChallenge);
        const offline = !state.systems[challenge.system];
        const status = offline ? " · OFFLINE" : cooldown > 0 ? ` · READY IN ${Math.ceil(cooldown)}S` : "";
        const description = offline ? `Restore the offline ${challenge.system} system. ${challenge.description}` : challenge.description;
        return `<button class="system-option challenge-option" data-action="challenge" data-challenge="${name}" ${disabled ? "disabled" : ""}><span class="system-option-icon">${({ scrubber: "O₂", condenser: "H₂O", hydroponics: "N", reactor: "ϟ" })[name]}</span><span><b>${challenge.title}<small data-cooldown-label>${status}</small></b><small>${description} COST: ${challenge.costText}.</small></span><span class="system-plus">↗</span></button>`;
    }).join("");
    const offlineSystems = Object.entries(systemOutages)
        .filter(([system]) => !state.systems[system])
        .map(([, outage]) => outage.note)
        .join(" · ");
    showModal("SYSTEMS CONSOLE", "MAINTENANCE // MANUAL OVERRIDE", `
        <p class="modal-lead">Emergency overrides have a 28-second cooldown. System faults can disable life support; complete the matching field work order to bring it back online.</p>
        ${offlineSystems ? `<p class="subtle-note is-critical-text">${offlineSystems} · COMPLETE THE MATCHING FIELD WORK ORDER.</p>` : ""}
        <div class="system-options">${buttons}</div>
        <p class="subtle-note work-order-heading">FIELD WORK ORDERS · REPAIR OFFLINE SYSTEMS OR RESTORE SUPPLIES</p>
        <div class="system-options">${challengeButtons}</div>
        <div class="modal-actions"><span class="subtle-note">REACTOR LOAD: ${Math.round(100 - state.resources.power)}% · GATE ${state.gateClosed ? "SEALED" : "OPEN"}</span><button class="text-button" data-action="close">BACK TO WATCH</button></div>
    `, true, "m");
    updateSystemsCountdowns();
    state.systemsCountdownId = window.setInterval(updateSystemsCountdowns, 250);
}

function updateSystemsCountdowns() {
    if (!backdrop.classList.contains("is-visible") || modalTitle.textContent !== "SYSTEMS CONSOLE") return;
    const available = state.running && !state.paused;
    const upkeepCosts = { oxygen: { power: 8 }, water: { power: 10 }, food: { power: 8 }, power: { water: 7, food: 5 } };
    modalContent.querySelectorAll('[data-action="upkeep"]').forEach((button) => {
        const name = button.dataset.system;
        const cooldown = Math.max(0, 28 - (state.elapsed - state.lastUpkeep[name]));
        const insufficient = Object.entries(upkeepCosts[name]).some(([resource, cost]) => state.resources[resource] < cost);
        button.disabled = !available || cooldown > 0 || insufficient;
        button.querySelector("[data-cooldown-label]").textContent = cooldown > 0 ? ` · READY IN ${Math.ceil(cooldown)}S` : "";
    });
    modalContent.querySelectorAll('[data-action="challenge"]').forEach((button) => {
        const name = button.dataset.challenge;
        const challenge = challengeSpecs[name];
        const cooldown = Math.max(0, challenge.cooldown - (state.elapsed - state.challengeCooldowns[name]));
        const insufficient = Object.entries(challenge.costs).some(([resource, cost]) => state.resources[resource] < cost);
        const offline = !state.systems[challenge.system];
        button.disabled = !available || cooldown > 0 || insufficient || Boolean(state.activeChallenge);
        const status = [];
        if (offline) status.push("OFFLINE");
        if (cooldown > 0) status.push(`READY IN ${Math.ceil(cooldown)}S`);
        button.querySelector("[data-cooldown-label]").textContent = status.length ? ` · ${status.join(" · ")}` : "";
    });
}

function clearChallengeTimers() {
    for (const timer of state.challengeTimers) window.clearTimeout(timer);
    state.challengeTimers = [];
}

function scheduleChallengeTimer(callback, delay) {
    state.challengeTimers.push(window.setTimeout(callback, delay));
}

// Each work order charges its supplies first, then creates the matching puzzle UI.
function beginChallenge(name) {
    const challenge = challengeSpecs[name];
    if (!challenge || !state.running || state.paused) return;
    if (state.elapsed - state.challengeCooldowns[name] < challenge.cooldown) {
        showToast("WORK ORDER STILL RECHARGING", true);
        return;
    }
    if (state.activeChallenge) {
        showToast("FINISH THE CURRENT WORK ORDER FIRST", true);
        return;
    }
    const unable = Object.entries(challenge.costs).find(([resource, cost]) => state.resources[resource] < cost);
    if (unable) {
        showToast(`INSUFFICIENT ${unable[0].toUpperCase()}`, true);
        return;
    }
    for (const [resource, cost] of Object.entries(challenge.costs)) addResource(resource, -cost);
    state.challengeCooldowns[name] = state.elapsed;
    addLog(`${challenge.title} started. Supplies committed: ${challenge.costText}.`, "system");

    if (name === "reactor") {
        let relays = [2, 3, 5, 8].map((load) => load + Math.floor(Math.random() * 4));
        const relayPairs = [];
        for (let first = 0; first < relays.length; first += 1) {
            for (let second = first + 1; second < relays.length; second += 1) {
                relayPairs.push({ first, second, total: relays[first] + relays[second] });
            }
        }
        let distinctTotals = relayPairs.filter((pair) =>
            relayPairs.filter((other) => other.total === pair.total).length === 1
        );
        if (distinctTotals.length === 0) {
            relays = [3, 5, 7, 10];
            relayPairs.length = 0;
            for (let first = 0; first < relays.length; first += 1) {
                for (let second = first + 1; second < relays.length; second += 1) {
                    relayPairs.push({ first, second, total: relays[first] + relays[second] });
                }
            }
            distinctTotals = relayPairs;
        }
        const target = distinctTotals[Math.floor(Math.random() * distinctTotals.length)];
        state.activeChallenge = {
            name,
            relays,
            targetLoad: target.total,
            selectedRelays: [],
            mistakes: 0
        };
        showModal(challenge.title, challenge.eyebrow, `
            <p class="modal-lead">Route exactly two relays into the core. Their combined output must match the target load. One incorrect pairing is allowed.</p>
            <div class="challenge-display"><span class="eyebrow">CORE TARGET</span><strong>${target.total} MW</strong><small id="challenge-status" aria-live="polite">SELECT TWO RELAYS</small></div>
            <div class="reactor-relays">${relays.map((load, index) => `
                <button class="reactor-relay" data-action="reactor-relay" data-relay="${index}" aria-pressed="false">
                    <span>RELAY 0${index + 1}</span><b>${load} <small>MW</small></b>
                </button>
            `).join("")}</div>
            <div class="modal-actions"><span class="subtle-note">SUCCESS · +${challenge.reward}% POWER</span><button class="text-button" data-action="close">ABORT WORK ORDER</button></div>
        `);
        return;
    }
    if (name === "scrubber") {
        const signals = ["A", "B", "C"];
        const sequenceLength = 4;
        const sequence = Array.from({ length: sequenceLength }, () => signals[Math.floor(Math.random() * signals.length)]);
        state.activeChallenge = { name, sequence, progress: 0, mistakes: 0, active: false };
        showModal(challenge.title, challenge.eyebrow, `
            <p class="modal-lead">Memorize the ${sequenceLength}-part scrubber signal, then repeat it. Two routing errors will abort the work order.</p>
            <div class="challenge-display"><span class="eyebrow">SIGNAL ROUTE</span><strong>A&nbsp;&nbsp; B&nbsp;&nbsp; C</strong><small id="challenge-status" aria-live="polite">WATCH THE SIGNALS</small></div>
            <div class="challenge-signals">${signals.map((signal) => `<button class="challenge-signal" data-action="signal" data-signal="${signal}" disabled>${signal}</button>`).join("")}</div>
            <div class="modal-actions"><span class="subtle-note">SUCCESS · +${challenge.reward}% ${challenge.rewardResource.toUpperCase()}</span><button class="text-button" data-action="close">ABORT WORK ORDER</button></div>
        `);
        scheduleChallengeTimer(() => playScrubberSequence(0), 500);
        return;
    }

    if (name === "condenser") {
        const highIndex = Math.floor(Math.random() * 3);
        const pressures = Array.from({ length: 3 }, (_, index) => index === highIndex
            ? 74 + Math.floor(Math.random() * 20)
            : 48 + Math.floor(Math.random() * 20));
        state.activeChallenge = { name, pressures, mistakes: 0 };
        showModal(challenge.title, challenge.eyebrow, `
            <p class="modal-lead">Isolate the single line above 70 PSI. You have two attempts before the leak spreads.</p>
            <div class="challenge-gauges">${pressures.map((pressure, index) => `
                <button class="challenge-gauge" data-action="valve" data-valve="${index}">
                    <span>LINE 0${index + 1}</span><b>${pressure} <small>PSI</small></b><i class="${pressure > 70 ? "is-overpressure" : ""}"></i>
                </button>
            `).join("")}</div>
            <p class="challenge-status" id="challenge-status" aria-live="polite">SELECT THE OVERPRESSURE LINE</p>
            <div class="modal-actions"><span class="subtle-note">SUCCESS · +20% WATER</span><button class="text-button" data-action="close">ABORT WORK ORDER</button></div>
        `);
        return;
    }

    const target = [1 + Math.floor(Math.random() * 4), 1 + Math.floor(Math.random() * 4), 1 + Math.floor(Math.random() * 4)];
    const firstDistractor = [...target];
    firstDistractor[0] = firstDistractor[0] === 4 ? 3 : firstDistractor[0] + 1;
    const secondDistractor = [...target];
    secondDistractor[1] = secondDistractor[1] === 4 ? 3 : secondDistractor[1] + 1;
    const trays = [target, firstDistractor, secondDistractor];
    for (let index = trays.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [trays[index], trays[swapIndex]] = [trays[swapIndex], trays[index]];
    }
    state.activeChallenge = { name, target, trays, correctTray: trays.findIndex((tray) => tray.every((value, index) => value === target[index])), mistakes: 0 };
    showModal(challenge.title, challenge.eyebrow, `
        <p class="modal-lead">Prepare the requested nutrient blend. Match every value exactly; you have two attempts.</p>
        <div class="challenge-display"><span class="eyebrow">REQUESTED N / P / K</span><strong>${target.join(" / ")}</strong></div>
        <div class="challenge-trays">${trays.map((tray, index) => `<button class="challenge-tray" data-action="tray" data-tray="${index}"><span>TRAY 0${index + 1}</span><b>${tray.join(" / ")}</b><small>N / P / K</small></button>`).join("")}</div>
        <p class="challenge-status" id="challenge-status" aria-live="polite">SELECT THE EXACT BLEND</p>
        <div class="modal-actions"><span class="subtle-note">SUCCESS · +18% RATIONS</span><button class="text-button" data-action="close">ABORT WORK ORDER</button></div>
    `);
}

function playScrubberSequence(index) {
    const challenge = state.activeChallenge;
    if (!challenge || challenge.name !== "scrubber") return;
    const buttons = modalContent.querySelectorAll(".challenge-signal");
    const status = $("challenge-status");
    challenge.active = false;
    buttons.forEach((button) => {
        button.disabled = true;
        button.classList.remove("is-lit");
    });
    if (index === 0) status.textContent = "WATCH THE SIGNALS";
    if (index >= challenge.sequence.length) {
        challenge.active = true;
        buttons.forEach((button) => { button.disabled = false; });
        status.textContent = "REPEAT THE FOUR-PART SIGNAL";
        return;
    }
    const signal = challenge.sequence[index];
    const activeButton = modalContent.querySelector(`.challenge-signal[data-signal="${signal}"]`);
    activeButton.classList.add("is-lit");
    scheduleChallengeTimer(() => {
        activeButton.classList.remove("is-lit");
        scheduleChallengeTimer(() => playScrubberSequence(index + 1), 180);
    }, 480);
}

function handleScrubberSignal(signal) {
    const challenge = state.activeChallenge;
    if (!challenge || challenge.name !== "scrubber" || !challenge.active) return;
    if (challenge.sequence[challenge.progress] !== signal) {
        challenge.mistakes += 1;
        challenge.progress = 0;
        if (challenge.mistakes >= 2) {
            finishChallenge(false);
            return;
        }
        $("challenge-status").textContent = "MISROUTE. ONE FAULT LEFT; WATCH AGAIN.";
        playScrubberSequence(0);
        return;
    }
    challenge.progress += 1;
    if (challenge.progress === challenge.sequence.length) {
        finishChallenge(true);
        return;
    }
    $("challenge-status").textContent = `ROUTE ${challenge.progress} / ${challenge.sequence.length} LOCKED`;
}

function handleReactorRelay(index) {
    const challenge = state.activeChallenge;
    if (!challenge || challenge.name !== "reactor" || !Number.isInteger(index) || index < 0 || index >= challenge.relays.length) return;
    if (challenge.selectedRelays.includes(index)) {
        challenge.selectedRelays = challenge.selectedRelays.filter((selected) => selected !== index);
    } else if (challenge.selectedRelays.length < 2) {
        challenge.selectedRelays.push(index);
    }
    modalContent.querySelectorAll(".reactor-relay").forEach((button) => {
        const selected = challenge.selectedRelays.includes(Number(button.dataset.relay));
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
    });
    if (challenge.selectedRelays.length < 2) {
        $("challenge-status").textContent = `${challenge.selectedRelays.length} / 2 RELAYS SELECTED`;
        return;
    }
    const total = challenge.selectedRelays.reduce((sum, relay) => sum + challenge.relays[relay], 0);
    if (total === challenge.targetLoad) {
        finishChallenge(true);
        return;
    }
    challenge.mistakes += 1;
    challenge.selectedRelays = [];
    modalContent.querySelectorAll(".reactor-relay").forEach((button) => {
        button.classList.remove("is-selected");
        button.setAttribute("aria-pressed", "false");
    });
    if (challenge.mistakes >= 2) {
        finishChallenge(false);
        return;
    }
    $("challenge-status").textContent = `${total} MW OVERLOAD. WRONG PAIR; ONE ATTEMPT LEFT.`;
}

function handlePressureValve(index) {
    const challenge = state.activeChallenge;
    if (!challenge || challenge.name !== "condenser") return;
    if (challenge.pressures[index] > 70) {
        finishChallenge(true);
        return;
    }
    challenge.mistakes += 1;
    if (challenge.mistakes >= 2) {
        finishChallenge(false);
        return;
    }
    $("challenge-status").textContent = "LINE IS WITHIN LIMIT. ONE ATTEMPT LEFT.";
}

function handleNutrientTray(index) {
    const challenge = state.activeChallenge;
    if (!challenge || challenge.name !== "hydroponics") return;
    if (index === challenge.correctTray) {
        finishChallenge(true);
        return;
    }
    challenge.mistakes += 1;
    if (challenge.mistakes >= 2) {
        finishChallenge(false);
        return;
    }
    $("challenge-status").textContent = "BLEND MISMATCH. ONE ATTEMPT LEFT.";
}

// Successful work orders restore their linked system and reserve; failures keep the cost spent.
function finishChallenge(success) {
    const challenge = state.activeChallenge;
    if (!challenge) return;
    const spec = challengeSpecs[challenge.name];
    const repaired = success && !state.systems[spec.system];
    state.activeChallenge = null;
    clearChallengeTimers();
    if (success) {
        state.systems[spec.system] = true;
        addResource(spec.rewardResource, spec.reward);
        addLog(repaired
            ? `${spec.title} complete. ${spec.system.toUpperCase()} SYSTEM RESTORED; ${spec.rewardResource.toUpperCase()} reserves +${spec.reward}%.`
            : `${spec.title} complete. ${spec.rewardResource.toUpperCase()} reserves restored by ${spec.reward}%.`, "system");
        showToast(repaired
            ? `${spec.system.toUpperCase()} RESTORED · ${spec.rewardResource.toUpperCase()} +${spec.reward}%`
            : `${spec.rewardResource.toUpperCase()} RESTORED · +${spec.reward}%`);
    } else {
        addLog(`${spec.title} failed. The committed supplies are lost; the system remains strained.`, "warning");
        showToast("WORK ORDER FAILED · SUPPLIES LOST", true);
    }
    checkResourceStrain();
    renderAll();
    showModal(success ? "WORK ORDER COMPLETE" : "WORK ORDER FAILED", spec.eyebrow, `
        <p class="modal-lead">${success
            ? `${repaired ? `${spec.system.toUpperCase()} is back online. ` : ""}${spec.rewardResource.toUpperCase()} restored by ${spec.reward}%. Keep an eye on the supplies committed to this repair.`
            : "The repair did not hold. Supplies were spent, and the console is cooling down before another attempt."}</p>
        <div class="modal-actions"><button class="primary-button" data-action="systems">RETURN TO MAINTENANCE <span>→</span></button><button class="text-button" data-action="close">BACK TO WATCH</button></div>
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
    checkResourceStrain();
    renderAll();
    openSystems();
}

function togglePause() {
    if (!state.running || state.ended) return;
    state.paused = !state.paused;
    $("pause-button").textContent = state.paused ? "▶  RESUME" : "Ⅱ  PAUSE";
    $("system-status").textContent = state.paused ? "NIGHT PAUSED" : "LIFE SUPPORT ONLINE";
    if (state.paused) {
        setAmbientLevel(0.025);
        showModal("NIGHT PAUSED", "SYSTEMS HOLD // TIMER STOPPED", `
            <p class="modal-lead">The simulation is paused. Resources and the clock will not advance.</p>
            <div class="modal-actions"><button class="primary-button" data-action="resume">RESUME NIGHT <span>→</span></button><button class="text-button" data-action="main-menu">NIGHT SELECT</button><button class="text-button" data-action="restart">ABANDON NIGHT</button></div>
        `, false);
    } else {
        startAmbientAudio();
        closeModal(true);
        renderThreat();
    }
}

// Delegation keeps dynamically-created popup buttons wired after every modal render.
modalContent.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "start") startGame();
    else if (action === "select-shift") selectShift(Number(button.dataset.shift));
    else if (action === "main-menu") returnToMainMenu();
    else if (action === "restart") restartGame();
    else if (action === "resume") togglePause();
    else if (action === "close") closeModal();
    else if (action === "upkeep") performUpkeep(button.dataset.system);
    else if (action === "challenge") beginChallenge(button.dataset.challenge);
    else if (action === "signal") handleScrubberSignal(button.dataset.signal);
    else if (action === "reactor-relay") handleReactorRelay(Number(button.dataset.relay));
    else if (action === "camera-wire") handleCameraWire(button.dataset.side, Number(button.dataset.color));
    else if (action === "valve") handlePressureValve(Number(button.dataset.valve));
    else if (action === "tray") handleNutrientTray(Number(button.dataset.tray));
    else if (action === "systems") openSystems();
});

introStart.addEventListener("click", beginNightWatch);
$("camera-button").addEventListener("click", scanFeed);
$("door-button").addEventListener("click", toggleGate);
$("systems-button").addEventListener("click", openSystems);
$("pause-button").addEventListener("click", togglePause);
$("sound-button").addEventListener("click", toggleSound);
updateSoundButton();
$("help-button").addEventListener("click", () => showModal("FIELD MANUAL", "ARES-87 // CREW REFERENCE", `
    <p class="modal-lead">Make it to 06:00. The storm is not the only thing outside.</p>
    <div class="manual-list"><p><b>SUPPLIES</b> All four meters drain continuously. Below 30% the reserve warning turns amber; below 15% it turns red. Below 25%, shortages strain linked systems: low water speeds oxygen loss, low oxygen raises power draw, low power raises condenser water use, and low food raises water and oxygen use. Any meter reaching zero ends the night.</p><p><b>SYSTEM FAULTS</b> Every level begins with its targeted system offline. Up to two outage events can occur per night counting those starting failures, so levels that begin with two or more faults will not trigger another random outage. Scrubber, reactor, condenser, or hydroponics outages increase the linked supply's drain; the resource subtitle names the system that is offline. Repair faults before nightfall.</p><p><b>CAMERA FAILURE</b> The exterior camera array can flicker offline independently of life support. Open Security Feed and reconnect each matching wire pair to restore the feed. The outage may return later.</p><p><b>MAINTENANCE</b> Refill a supply from the maintenance panel. Overrides cost other supplies and share a 28-second cooldown per system. The auxiliary reactor trades water and rations for power. Field work orders repair their matching offline system or restore supplies: calibrate the scrubbers, isolate condenser pressure, match the nutrient blend, or route two reactor relays to match the target output. Work orders have a 45-second cooldown; starting one commits its supplies even if you abort or fail.</p><p><b>SECURITY</b> The security pulse reveals the presence's distance and next movement, and disrupts it for 6 seconds (costs 2.5% power; recharges in 24 seconds). It buys time to seal the gate or finish a repair, but cannot replace either. Close the gate when contact reaches the perimeter. A sealed gate uses extra power every second; an impact knocks the presence back but vents oxygen and coolant as well as costing power. If it reaches the open habitat, it will get you.</p><p><b>CONTROLS</b> C scan / repair cameras · G gate · M maintenance · Space pause · Esc close popups or resume while paused · Sound On/Off in the footer.</p><p><b>THE LOG</b> Crew entries and strange radio messages appear as the night goes on. You may want to read them before sunrise.</p></div>
    <div class="modal-actions"><button class="primary-button" data-action="close">UNDERSTOOD <span>→</span></button></div>
`));
$("modal-close").addEventListener("click", () => closeModal());
backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeModal();
});
// Keyboard shortcuts mirror the visible controls; modal-specific hotkeys are handled first.
document.addEventListener("keydown", (event) => {
    if (document.body.classList.contains("is-jumpscared")) {
        event.preventDefault();
        return;
    }
    if (state.paused && backdrop.classList.contains("is-visible") &&
        (event.key === "Escape" || event.code === "Space")) {
        event.preventDefault();
        if (!event.repeat) togglePause();
        return;
    }
    if (event.key === "Escape") closeModal();
    const key = event.key.toLowerCase();
    if (event.repeat || document.body.classList.contains("is-intro") || document.body.classList.contains("is-revealing") || document.body.classList.contains("is-restarting")) return;
    if (backdrop.classList.contains("is-visible")) {
        if (key === state.modalHotkey) closeModal();
        return;
    }
    if (key === "c") scanFeed();
    else if (key === "g") toggleGate();
    else if (key === "m") openSystems();
    else if (event.code === "Space") {
        event.preventDefault();
        togglePause();
    }
});

renderAll();
addLog("Ares-87 night watch initiated. All systems nominal.", "system");
openIntro();
