const secretInput = document.querySelector("#secret");
const statusEl = document.querySelector("#status");
const newsList = document.querySelector("#newsList");
const marketList = document.querySelector("#marketList");
const newsResult = document.querySelector("#newsResult");
const marketResult = document.querySelector("#marketResult");
const logsResult = document.querySelector("#logsResult");

let previewNews = [];
let previewMarkets = [];

secretInput.value = localStorage.getItem("retropick_broadcast_secret") || "";
secretInput.addEventListener("input", () => {
  localStorage.setItem("retropick_broadcast_secret", secretInput.value);
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#panel-${button.dataset.tab}`).classList.add("active");
  });
});

function headers() {
  return {
    "Content-Type": "application/json",
    "X-Retropick-Secret": secretInput.value,
  };
}

function setStatus(message) {
  statusEl.textContent = message;
}

function selectedPlatforms(form) {
  const platforms = [];
  if (form.telegram?.checked) platforms.push("telegram");
  if (form.discord?.checked) platforms.push("discord");
  return platforms;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function renderNews(items) {
  newsList.innerHTML = "";
  previewNews = items;
  if (!items.length) {
    newsList.innerHTML = '<div class="card">No matching news found.</div>';
    return;
  }

  items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <h3>${item.title}</h3>
      <div class="meta">
        <span class="pill">${item.marketCategoryLabel}</span>
        <span>Score ${item.relevanceScore}</span>
        <span>${item.source}</span>
      </div>
      <p>${item.whyItMatters || item.summary || ""}</p>
      <div class="button-row">
        <button type="button" data-send-news="${index}">Approve & Send</button>
        <a href="${item.url}" target="_blank" rel="noreferrer">Open source</a>
      </div>
    `;
    newsList.append(card);
  });
}

function renderMarkets(items) {
  marketList.innerHTML = "";
  previewMarkets = items;
  if (!items.length) {
    marketList.innerHTML = '<div class="card">No matching external markets found.</div>';
    return;
  }

  items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <h3>${item.title}</h3>
      <div class="meta">
        <span class="pill">${item.marketCategoryLabel}</span>
        <span>${item.source}</span>
        <span>YES ${Math.round(Number(item.yesPrice || 0) * 100)}%</span>
        <span>24h Vol ${Number(item.volume24hr || 0).toLocaleString("en-US")}</span>
      </div>
      <div class="button-row">
        <button type="button" data-send-market="${index}">Approve & Send</button>
        <a href="${item.url}" target="_blank" rel="noreferrer">Open market</a>
      </div>
    `;
    marketList.append(card);
  });
}

document.querySelector("#marketForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Sending market broadcast...");
  const form = event.currentTarget;
  const formData = new FormData(form);
  const body = {
    marketId: formData.get("marketId"),
    headline: formData.get("headline"),
    title: formData.get("title"),
    context: formData.get("context"),
    category: formData.get("category"),
    marketType: formData.get("marketType"),
    url: formData.get("url"),
    platforms: selectedPlatforms(form),
    skipDuplicates: form.skipDuplicates.checked,
  };

  try {
    const data = await requestJson("/market/broadcast", {
      method: "POST",
      body: JSON.stringify(body),
    });
    marketResult.textContent = JSON.stringify(data, null, 2);
    setStatus("Market broadcast finished.");
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector("#fetchMarkets").addEventListener("click", async () => {
  setStatus("Fetching external market preview...");
  const params = new URLSearchParams({
    category: document.querySelector("#marketCategory").value,
    limit: document.querySelector("#marketLimit").value,
  });

  try {
    const data = await requestJson(`/market/fetch?${params}`);
    renderMarkets(data.markets);
    setStatus(`Fetched ${data.count} latest external market(s). Review before sending.`);
  } catch (error) {
    setStatus(error.message);
  }
});

marketList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-send-market]");
  if (!button) return;
  const item = previewMarkets[Number(button.dataset.sendMarket)];
  setStatus("Sending approved external market...");

  try {
    const data = await requestJson("/market/broadcast", {
      method: "POST",
      body: JSON.stringify({
        ...item,
        platforms: ["telegram", "discord"],
        skipDuplicates: true,
      }),
    });
    marketResult.textContent = JSON.stringify(data, null, 2);
    setStatus("Approved market broadcast finished.");
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector("#broadcastLatestMarkets").addEventListener("click", async () => {
  setStatus("Broadcasting latest external market...");
  try {
    const data = await requestJson("/market/jobs/latest", {
      method: "POST",
      body: JSON.stringify({
        category: document.querySelector("#marketCategory").value,
        limit: Number(document.querySelector("#marketLimit").value),
        platforms: ["telegram", "discord"],
      }),
    });
    marketResult.textContent = JSON.stringify(data, null, 2);
    setStatus("Latest-market broadcast finished.");
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector("#fetchNews").addEventListener("click", async () => {
  setStatus("Fetching news preview...");
  const params = new URLSearchParams({
    category: document.querySelector("#category").value,
    limit: document.querySelector("#limit").value,
  });

  try {
    const data = await requestJson(`/news/fetch?${params}`);
    renderNews(data.news);
    setStatus(`Fetched ${data.count} latest news item(s). Review before sending.`);
  } catch (error) {
    setStatus(error.message);
  }
});

newsList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-send-news]");
  if (!button) return;
  const item = previewNews[Number(button.dataset.sendNews)];
  setStatus("Sending approved news...");

  try {
    const data = await requestJson("/news/broadcast", {
      method: "POST",
      body: JSON.stringify({
        ...item,
        platforms: ["telegram", "discord"],
        skipDuplicates: true,
      }),
    });
    newsResult.textContent = JSON.stringify(data, null, 2);
    setStatus("Approved news broadcast finished.");
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector("#broadcastLatest").addEventListener("click", async () => {
  setStatus("Broadcasting latest news...");
  try {
    const data = await requestJson("/news/jobs/latest", {
      method: "POST",
      body: JSON.stringify({
        category: document.querySelector("#category").value,
        limit: Number(document.querySelector("#limit").value),
        platforms: ["telegram", "discord"],
      }),
    });
    newsResult.textContent = JSON.stringify(data, null, 2);
    setStatus("Latest-news broadcast finished.");
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector("#loadMarketLogs").addEventListener("click", async () => {
  const data = await requestJson("/market/logs?limit=20");
  logsResult.textContent = JSON.stringify(data, null, 2);
  setStatus("Market logs loaded.");
});

document.querySelector("#loadNewsLogs").addEventListener("click", async () => {
  const data = await requestJson("/news/logs?limit=20");
  logsResult.textContent = JSON.stringify(data, null, 2);
  setStatus("News logs loaded.");
});
