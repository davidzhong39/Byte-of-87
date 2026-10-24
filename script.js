const button = document.getElementById("start-button");
const message = document.getElementById("message");

button.addEventListener("click", () => {
    message.textContent = "Game started!";
});