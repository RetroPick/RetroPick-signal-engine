const tabButtons = document.querySelectorAll(".tab-button");
const flowCards = document.querySelectorAll(".flow-card");

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const tab = button.dataset.tab;

    tabButtons.forEach((item) => item.classList.remove("active"));
    flowCards.forEach((card) => card.classList.remove("active"));

    button.classList.add("active");
    document.querySelector(`#tab-${tab}`).classList.add("active");
  });
});

document.querySelectorAll(".checklist input").forEach((input) => {
  input.addEventListener("change", () => {
    input.closest("label").classList.toggle("done", input.checked);
  });
});
