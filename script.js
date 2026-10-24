const button = document.getElementById("start-button");
const message = document.getElementById("message");
const habitat = {oxygen: 100, power: 100, water: 100, temp: 70};

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

button.addEventListener("click", () => {
    message.innerText = "Game started!";
});