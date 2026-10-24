const button = document.getElementById("start-button");
const message = document.getElementById("message");
const DEEPSPACE_API_KEY = "HACKATHON API KEY"; //provided API key??
const DEEPSPACE_ENDPOINT = "https://api.deep.space/v1/diagnostics"; //provided endpoint??

const habitat = {oxygen: 100, power: 100, water: 100, temp: 70, isCritical: false};

function gameLoop() {
    habitat.oxygen -= 1;
    habitat.power -= 0.5;
    habitat.water -= 0.2;
    habitat.temp -= 0.1;
    updateHabitat();
}

function updateHabitat() {
    document.getElementById("oxygen").innerText = `Oxygen: ${Math.round(habitat.oxygen)}%`;
    document.getElementById("power").innerText = `Power: ${Math.round(habitat.power)}%`;
    document.getElementById("water").innerText = `Water: ${Math.round(habitat.water)}%`;
    document.getElementById("temp").innerText = `Temperature: ${Math.round(habitat.temp)}°F`;
}

setInterval(gameLoop, 3000); // Update habitat every 3 seconds

async function checkHabitatHealth(){
    if (habitat.oxygen < 30 || habitat.power < 30 || habitat.water < 30 || habitat.temp < 20 || habitat.temp > 100 && !habitat.isCritical) {
        habitat.isCritical = true;
        const telemetryPayload = {
            system: "Aria-9 Outpost",
            oxygenLevel: habitat.oxygen,
            powerLevel: habitat.power,
            OutsideStatus: "Severe Dust Storm",
            prompt: "Generate a short, high-stress emergency diagnostic warning for the human crew."
        };
        const aiResponseText = await fetchDeepSpaceDiagnostics(TelemetryPayload);
        triggerEmergencyAlert(aiResponseText);
    }
}

// Fallback if the DeepSpace API fails or returns an error
const fallbackMessages = [
    "Warning: Sector 4 thermal regulators failing. Pressure dropping.",
    "Alert: Solar array efficiency down to 12% due to dust occlusion.",
    "Critical: CO2 scrubbers overloaded. Switch to backup cells."
];

async function fetchDeepSpaceDiagnostics(payload) {
    try{ 
        const response = await fetch(DEEPSPACE_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${DEEPSPACE_API_KEY}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        return data.diagnosticMessage || "Warning: Subsystem failure detected. Immediate manual override required.";
    } catch (error) {
        console.error("DeepSpace API Error:", error);
        return "Critical system error. Communications offline.";
    }
}

function triggerEmergencyAlert(message) {
    const terminalLog = document.getElementById("terminal-log");
    terminalLog.innerHTML += `<p class="alert-text">> ${message}</p>`;

    playElevenLabsAudio(message);
}

function playElevenLabsAudio(text) {
    // Stub for your ElevenLabs integration
    console.log("Sending text to ElevenLabs voice synth:", text);
    // const audioUrl = ... call ElevenLabs API ...
    // new Audio(audioUrl).play();
}

button.addEventListener("click", () => {
    message.innerText = "Game started!";
});