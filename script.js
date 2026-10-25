"use strict";

const SHIFT_LENGTH = 240;
const SHIFT_PLANS = [
    {
        title: "REACTOR SURGE",
        gimmick: "POWER DRAINS HEAVILY",
        directive: "POWER SURGE: SAVE CHARGE AND USE THE AUXILIARY REACTOR (M).",
        drain: { power: 0.22 },
        firstContact: 30,
        threatMin: 15,
        threatRange: 10
    },
    {
        title: "CONDENSER FAILURE",
        gimmick: "WATER SYSTEMS ARE LEAKING",
        directive: "CONDENSER FAILURE: WATER DRAINS FAST · PRIORITIZE THE CONDENSER (M).",
        drain: { water: 0.18 },
        firstContact: 28,
        threatMin: 14,
        threatRange: 10
    },
    {
        title: "GREENHOUSE BLIGHT",
        gimmick: "FOOD PRODUCTION IS FAILING",
        directive: "GREENHOUSE BLIGHT: RATIONS DRAIN FAST · HARVEST RESERVE TRAYS (M).",
        drain: { food: 0.18 },
        firstContact: 26,
        threatMin: 13,
        threatRange: 10
    },
    {
        title: "LIFE SUPPORT CASCADE",
        gimmick: "POWER AND WATER ARE BOTH STRAINED",
        directive: "LIFE SUPPORT CASCADE: POWER + WATER DRAIN FAST · BALANCE BOTH.",
        drain: { power: 0.12, water: 0.11 },
        firstContact: 23,
        threatMin: 12,
        threatRange: 9
    },
    {
        title: "TOTAL SYSTEM CASCADE",
        gimmick: "ALL FOUR SUPPLIES DRAIN FASTER",
        directive: "TOTAL CASCADE: ALL SUPPLIES ARE STRAINED · HANDLE THE LOWEST RESERVE FIRST.",
        drain: { oxygen: 0.07, power: 0.09, water: 0.07, food: 0.07 },
        firstContact: 18,
        threatMin: 10,
        threatRange: 8
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
        rewardResource: "food",
        reward: 18,
        cooldown: 45,
        costs: { water: 4, power: 2 },
        costText: "4 WATER · 2 POWER",
        description: "Select the tray that exactly matches the requested N / P / K blend."
    }
};
const state = {
    running: false,
    paused: false,
    ended: false,
    shiftNumber: 1,
    elapsed: 0,
    campaignElapsed: 0,
    resources: { oxygen: 100, power: 100, water: 100, food: 100 },
    gateClosed: false,
    threat: 0,
    nextThreatMove: 30,
    nextAmbient: 30,
    lastUpkeep: { oxygen: -Infinity, water: -Infinity, food: -Infinity, power: -Infinity },
    strainWarnings: { oxygen: false, power: false, water: false, food: false },
    challengeCooldowns: { scrubber: -Infinity, condenser: -Infinity, hydroponics: -Infinity },
    activeChallenge: null,
    challengeTimers: [],
    loreIndex: 0,
    scannedAt: -Infinity,
    tickId: null,
    toastId: null,
    introTimer: null,
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
    $("shift-label").textContent = `SHIFT ${String(state.shiftNumber).padStart(2, "0")} / 05 · ${currentShift().title}`;
}

function showModal(title, eyebrow, content, dismissible = true, hotkey = null) {
    state.modalReturnFocus = document.activeElement;
    state.modalHotkey = hotkey;
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
            oxygen: state.resources.water < 25 ? "WATER LOW: O₂ USE UP" : "",
            power: state.resources.oxygen < 25 ? "O₂ LOW: REACTOR DRAW UP" : "",
            water: state.resources.food < 25 ? "RATIONS LOW: WATER USE UP" : "",
            food: state.resources.oxygen < 25 ? "CREW FATIGUE: RATIONS USE UP" : ""
        };
        $(`${name}-note`).textContent = amount < 15 ? "CRITICAL RESERVE" : amount < 30 ? "LOW RESERVE" : strainNotes[name] || ({
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
    renderShiftIdentity();
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
    $("door-title").textContent = "PERIMETER GATE";
    $("door-caption").textContent = state.gateClosed ? "SEALED · CLICK TO OPEN" : "OPEN · CLICK TO SEAL";
    $("door-button").setAttribute("aria-pressed", String(state.gateClosed));
    $("door-button").classList.toggle("is-sealed", state.gateClosed);
    $("system-status").textContent = state.paused ? "WATCH PAUSED" : state.running ? (position >= 3 ? "PERIMETER ALERT" : "LIFE SUPPORT ONLINE") : state.ended ? "SHIFT COMPLETE" : "SYSTEMS STANDBY";
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
    window.setTimeout(() => {
        document.body.classList.remove("is-intro", "is-revealing");
        introScreen.hidden = true;
        const shift = currentShift();
        showModal("FIVE NIGHTS AT ARES-87", "DAY 82 // CAMPAIGN BRIEFING", `
            <p class="modal-lead">Survive five consecutive watches, from Day 82 through Day 86. Supplies carry over at dawn, so every repair and every sealed gate affects the next shift.</p>
            <div class="manual-list">
                <p><b>SHIFT 01 · ${shift.title}</b> ${shift.gimmick}. Follow the objective beneath the clock, watch all four reserves, and use Maintenance to trade supplies for repairs.</p>
                <p><b>THE PERIMETER</b> First contact is delayed for 30 seconds. Scanning costs power. Seal the gate when the outer gate alert appears, then open it after impact to save charge.</p>
                <p><b>FIVE SHIFTS, ONE RUN</b> Each dawn brings a tougher system failure. Your supplies persist between shifts; survive Day 86 to win the campaign.</p>
            </div>
            <div class="modal-actions"><span class="subtle-note">SCAN: C · GATE: G · MAINTENANCE: M</span><button class="primary-button" data-action="start">BEGIN NIGHT WATCH <span>→</span></button></div>
        `, false);
    }, INTRO_REVEAL_DURATION);
}

function startGame() {
    if (state.running || state.ended) return;
    state.running = true;
    state.paused = false;
    closeModal(true);
    $("system-status").textContent = "LIFE SUPPORT ONLINE";
    addLog(`Day ${81 + state.shiftNumber} / 86 · ${currentShift().title}: ${currentShift().gimmick}.`, "system");
    addLog(`Night watch started. Perimeter contact expected after ${currentShift().firstContact} seconds.`, "system");
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

function tick() {
    if (!state.running || state.paused || state.ended) return;
    state.elapsed += 1;
    state.campaignElapsed += 1;
    const shiftDrain = currentShift().drain;
    state.resources.oxygen -= 0.105 + (shiftDrain.oxygen || 0) + (state.resources.water < 25 ? 0.055 : 0) + (state.resources.food < 25 ? 0.015 : 0);
    state.resources.power -= 0.115 + (shiftDrain.power || 0) + (state.gateClosed ? 0.23 : 0) + (state.resources.oxygen < 25 ? 0.035 : 0);
    state.resources.water -= 0.085 + (shiftDrain.water || 0) + (state.resources.food < 25 ? 0.035 : 0) + (state.resources.power < 25 ? 0.02 : 0);
    state.resources.food -= 0.075 + (shiftDrain.food || 0) + (state.resources.oxygen < 25 ? 0.02 : 0);

    if (state.elapsed >= state.nextThreatMove) {
        const shift = currentShift();
        state.nextThreatMove = state.elapsed + shift.threatMin + Math.floor(Math.random() * shift.threatRange);
        if (state.gateClosed && state.threat >= 2) {
            state.threat = 0;
            addResource("power", -10);
            addResource("oxygen", -3);
            addResource("water", -3);
            addLog("Impact on the gate. The pressure seal vents oxygen and coolant before whatever it was goes quiet.", "warning");
            showToast("GATE IMPACT · POWER / O₂ / H₂O LOST", true);
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

    if (state.loreIndex < lore.length && state.campaignElapsed >= (state.loreIndex + 1) * 42) {
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
        if (state.shiftNumber === SHIFT_PLANS.length) {
            endGame(true, "Five shifts survived. The storm breaks over Ares-87, and the ridge is finally empty. Your radio crackles once: \"Good morning, Mara.\"");
        } else {
            completeShift();
        }
    }
}

function completeShift() {
    state.running = false;
    state.paused = false;
    window.clearInterval(state.tickId);
    state.gateClosed = false;
    state.threat = 0;
    state.activeChallenge = null;
    clearChallengeTimers();
    renderAll();
    const nextShift = SHIFT_PLANS[state.shiftNumber];
    showModal(`SHIFT ${String(state.shiftNumber).padStart(2, "0")} COMPLETE`, `DAY ${81 + state.shiftNumber} // DAWN`, `
        <p class="modal-lead">You made it through ${currentShift().title}. Remaining supplies carry directly into Day ${82 + state.shiftNumber}, and the next system is already failing.</p>
        <div class="briefing-grid">
            <div><b>UP NEXT · SHIFT ${String(state.shiftNumber + 1).padStart(2, "0")}</b><span>${nextShift.title} — ${nextShift.gimmick.toLowerCase()}.</span></div>
            <div><b>CREW RESERVES CARRY OVER</b><span>Review the meters before the next watch. Repairs and work orders are available again.</span></div>
        </div>
        <div class="debrief"><span>O₂ <b>${Math.round(state.resources.oxygen)}%</b></span><span>POWER <b>${Math.round(state.resources.power)}%</b></span><span>WATER <b>${Math.round(state.resources.water)}%</b></span><span>RATIONS <b>${Math.round(state.resources.food)}%</b></span></div>
        <div class="modal-actions"><span class="subtle-note">DAY ${82 + state.shiftNumber} OF 86</span><button class="primary-button" data-action="next-shift">BEGIN SHIFT ${String(state.shiftNumber + 1).padStart(2, "0")} <span>→</span></button></div>
    `, false);
}

function startNextShift() {
    if (state.running || state.ended || state.shiftNumber >= SHIFT_PLANS.length) return;
    state.shiftNumber += 1;
    state.elapsed = 0;
    state.gateClosed = false;
    state.threat = 0;
    state.nextThreatMove = currentShift().firstContact;
    state.nextAmbient = 30;
    state.lastUpkeep = { oxygen: -Infinity, water: -Infinity, food: -Infinity, power: -Infinity };
    state.strainWarnings = { oxygen: false, power: false, water: false, food: false };
    state.challengeCooldowns = { scrubber: -Infinity, condenser: -Infinity, hydroponics: -Infinity };
    state.scannedAt = -Infinity;
    renderAll();
    startGame();
}

function endGame(won, message) {
    state.running = false;
    state.ended = true;
    state.activeChallenge = null;
    clearChallengeTimers();
    window.clearInterval(state.tickId);
    $("system-status").textContent = won ? "SHIFT COMPLETE" : "OUTPOST LOST";
    $("system-status").classList.toggle("status-alert", !won);
    showModal(won ? "FIVE NIGHTS SURVIVED" : "SIGNAL LOST", won ? "DAY 86 // CAMPAIGN COMPLETE" : `DAY ${81 + state.shiftNumber} // CREW STATUS UNKNOWN`, `
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
    clearChallengeTimers();
    $("toast").classList.remove("is-visible", "is-warning");
    state.running = false;
    state.paused = false;
    state.ended = false;
    state.shiftNumber = 1;
    state.elapsed = 0;
    state.campaignElapsed = 0;
    state.resources = { oxygen: 100, power: 100, water: 100, food: 100 };
    state.gateClosed = false;
    state.threat = 0;
    state.nextThreatMove = SHIFT_PLANS[0].firstContact;
    state.nextAmbient = 30;
    state.lastUpkeep = { oxygen: -Infinity, water: -Infinity, food: -Infinity, power: -Infinity };
    state.strainWarnings = { oxygen: false, power: false, water: false, food: false };
    state.challengeCooldowns = { scrubber: -Infinity, condenser: -Infinity, hydroponics: -Infinity };
    state.activeChallenge = null;
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
    `, true, "c");
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
    const challengeButtons = Object.entries(challengeSpecs).map(([name, challenge]) => {
        const cooldown = Math.max(0, challenge.cooldown - (state.elapsed - state.challengeCooldowns[name]));
        const insufficient = Object.entries(challenge.costs).some(([resource, cost]) => state.resources[resource] < cost);
        const disabled = !available || cooldown > 0 || insufficient || Boolean(state.activeChallenge);
        const status = cooldown > 0 ? ` · READY IN ${Math.ceil(cooldown)}S` : "";
        return `<button class="system-option challenge-option" data-action="challenge" data-challenge="${name}" ${disabled ? "disabled" : ""}><span class="system-option-icon">${({ scrubber: "O₂", condenser: "H₂O", hydroponics: "N" })[name]}</span><span><b>${challenge.title}${status ? `<small>${status}</small>` : ""}</b><small>${challenge.description} COST: ${challenge.costText}.</small></span><span class="system-plus">↗</span></button>`;
    }).join("");
    showModal("SYSTEMS CONSOLE", "MAINTENANCE // MANUAL OVERRIDE", `
        <p class="modal-lead">Emergency overrides have a 28-second cooldown. Every fix costs something. Nothing here is free.</p>
        <div class="system-options">${buttons}</div>
        <p class="subtle-note work-order-heading">FIELD WORK ORDERS · SUCCESS RESTORES SUPPLIES</p>
        <div class="system-options">${challengeButtons}</div>
        <div class="modal-actions"><span class="subtle-note">REACTOR LOAD: ${Math.round(100 - state.resources.power)}% · GATE ${state.gateClosed ? "SEALED" : "OPEN"}</span><button class="text-button" data-action="close">BACK TO WATCH</button></div>
    `, true, "m");
}

function clearChallengeTimers() {
    for (const timer of state.challengeTimers) window.clearTimeout(timer);
    state.challengeTimers = [];
}

function scheduleChallengeTimer(callback, delay) {
    state.challengeTimers.push(window.setTimeout(callback, delay));
}

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

    if (name === "scrubber") {
        const signals = ["A", "B", "C"];
        const sequence = Array.from({ length: 4 }, () => signals[Math.floor(Math.random() * signals.length)]);
        state.activeChallenge = { name, sequence, progress: 0, mistakes: 0, active: false };
        showModal(challenge.title, challenge.eyebrow, `
            <p class="modal-lead">Memorize the four-part signal, then repeat it. Two routing errors will abort the calibration.</p>
            <div class="challenge-display"><span class="eyebrow">SIGNAL ROUTE</span><strong>A&nbsp;&nbsp; B&nbsp;&nbsp; C</strong><small id="challenge-status" aria-live="polite">WATCH THE SIGNALS</small></div>
            <div class="challenge-signals">${signals.map((signal) => `<button class="challenge-signal" data-action="signal" data-signal="${signal}" disabled>${signal}</button>`).join("")}</div>
            <div class="modal-actions"><span class="subtle-note">SUCCESS · +18% OXYGEN</span><button class="text-button" data-action="close">ABORT WORK ORDER</button></div>
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
    state.activeChallenge = { name, target, trays, correctTray: trays.findIndex((tray) => tray.every((value, index) => value === target)), mistakes: 0 };
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

function finishChallenge(success) {
    const challenge = state.activeChallenge;
    if (!challenge) return;
    const spec = challengeSpecs[challenge.name];
    state.activeChallenge = null;
    clearChallengeTimers();
    if (success) {
        addResource(spec.rewardResource, spec.reward);
        addLog(`${spec.title} complete. ${spec.rewardResource.toUpperCase()} reserves restored by ${spec.reward}%.`, "system");
        showToast(`${spec.rewardResource.toUpperCase()} RESTORED · +${spec.reward}%`);
    } else {
        addLog(`${spec.title} failed. The committed supplies are lost; the system remains strained.`, "warning");
        showToast("WORK ORDER FAILED · SUPPLIES LOST", true);
    }
    checkResourceStrain();
    renderAll();
    showModal(success ? "WORK ORDER COMPLETE" : "WORK ORDER FAILED", spec.eyebrow, `
        <p class="modal-lead">${success
            ? `${spec.rewardResource.toUpperCase()} restored by ${spec.reward}%. Keep an eye on the supplies committed to this repair.`
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
    else if (action === "next-shift") startNextShift();
    else if (action === "restart") restartGame();
    else if (action === "resume") togglePause();
    else if (action === "close") closeModal();
    else if (action === "upkeep") performUpkeep(button.dataset.system);
    else if (action === "challenge") beginChallenge(button.dataset.challenge);
    else if (action === "signal") handleScrubberSignal(button.dataset.signal);
    else if (action === "valve") handlePressureValve(Number(button.dataset.valve));
    else if (action === "tray") handleNutrientTray(Number(button.dataset.tray));
    else if (action === "systems") openSystems();
});

introStart.addEventListener("click", beginNightWatch);
$("camera-button").addEventListener("click", scanFeed);
$("door-button").addEventListener("click", toggleGate);
$("systems-button").addEventListener("click", openSystems);
$("pause-button").addEventListener("click", togglePause);
$("help-button").addEventListener("click", () => showModal("FIELD MANUAL", "ARES-87 // CREW REFERENCE", `
    <p class="modal-lead">Make it to 06:00. The storm is not the only thing outside.</p>
    <div class="manual-list"><p><b>SUPPLIES</b> All four meters drain continuously. Below 30% the reserve warning turns amber; below 15% it turns red. Below 25%, shortages strain linked systems: low water speeds oxygen loss, low oxygen raises power draw, low power raises condenser water use, and low food raises water and oxygen use. Any meter reaching zero ends the shift.</p><p><b>MAINTENANCE</b> Refill a supply from the maintenance panel. Overrides cost other supplies and share a 28-second cooldown per system. The auxiliary reactor trades water and rations for power. Three field work orders offer skill-based repairs on a 45-second cooldown; starting one commits its supplies even if you abort or fail.</p><p><b>SECURITY</b> Scan the feed to get a better read on the approaching presence (costs 2.5% power). Close the gate when it gets close. A sealed gate uses extra power every second; an impact knocks the presence back but vents oxygen and coolant as well as costing power.</p><p><b>CONTROLS</b> C scan · G gate · M maintenance · Space pause · Esc close popup.</p><p><b>THE LOG</b> Crew entries and strange radio messages appear as the shift goes on. You may want to read them before sunrise.</p></div>
    <div class="modal-actions"><button class="primary-button" data-action="close">UNDERSTOOD <span>→</span></button></div>
`));
$("modal-close").addEventListener("click", () => closeModal());
backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeModal();
});
document.addEventListener("keydown", (event) => {
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
