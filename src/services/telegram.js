async function sendTelegramMessage({ text, token, chatId, messageThreadId, label }) {
  if (!token || !chatId) {
    throw new Error(`${label} Telegram config is incomplete`);
  }

  const body = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
  };

  if (messageThreadId) {
    body.message_thread_id = Number(messageThreadId);
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const description = payload?.description || response.statusText;
    throw new Error(`${label} Telegram sendMessage failed: ${description}`);
  }

  return payload;
}

export async function sendTelegramMarketMessage(text) {
  return sendTelegramMessage({
    text,
    token: process.env.TELEGRAM_MARKET_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_MARKET_CHAT_ID || process.env.TELEGRAM_CHAT_ID,
    messageThreadId: process.env.TELEGRAM_MARKET_THREAD_ID || process.env.TELEGRAM_MESSAGE_THREAD_ID,
    label: "Market",
  });
}

export async function sendTelegramNewsMessage(text) {
  return sendTelegramMessage({
    text,
    token: process.env.TELEGRAM_NEWS_BOT_TOKEN,
    chatId: process.env.TELEGRAM_NEWS_CHAT_ID || process.env.TELEGRAM_CHAT_ID,
    messageThreadId: process.env.TELEGRAM_NEWS_THREAD_ID,
    label: "News",
  });
}
