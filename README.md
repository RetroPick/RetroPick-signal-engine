# RetroPick Signal Engine

Backend kecil untuk mengirim market alert atau announcement RetroPick ke Telegram dan Discord.

## Setup

```bash
npm install
copy .env.example .env
npm start
```

Isi `.env` dengan token Telegram, chat id Telegram, webhook Discord, dan `BROADCAST_SECRET`.

Market dan news memakai bot/webhook terpisah:

```env
TELEGRAM_MARKET_BOT_TOKEN=replace_this
TELEGRAM_MARKET_CHAT_ID=@RetroPickMarket
TELEGRAM_MARKET_THREAD_ID=2

TELEGRAM_NEWS_BOT_TOKEN=replace_this
TELEGRAM_NEWS_CHAT_ID=@RetroPickMarket
TELEGRAM_NEWS_THREAD_ID=replace_this

DISCORD_MARKET_WEBHOOK_URL=replace_this
DISCORD_NEWS_WEBHOOK_URL=replace_this
```

Untuk Telegram group dengan forum topic, isi juga thread id:

```env
TELEGRAM_MARKET_THREAD_ID=2
```

Angka `2` berasal dari link topic seperti `https://t.me/RetroPickMarket/2`.

## Endpoint

- `GET /health`
- `POST /test/telegram`
- `POST /test/discord`
- `POST /broadcast/market`
- `POST /broadcast/announcement`
- `GET /news/fetch`
- `GET /news/categories`
- `POST /broadcast/news`
- `POST /jobs/news/latest`
- `POST /market/broadcast`
- `GET /market/fetch`
- `POST /market/jobs/latest`
- `POST /market/test/telegram`
- `POST /market/test/discord`
- `GET /market/logs`
- `POST /news/broadcast`
- `POST /news/jobs/latest`
- `POST /news/test/telegram`
- `POST /news/test/discord`
- `GET /news/logs`
- `GET /logs/news`
- `GET /logs/market`

Admin dashboard lokal:

```text
http://127.0.0.1:4174/admin.html
```

Endpoint lama `/broadcast/*`, `/jobs/news/latest`, dan `/logs/*` masih dipertahankan sebagai alias kompatibilitas. Untuk flow baru, pakai endpoint `/market/*` dan `/news/*`.

External market source MVP:

```env
MARKET_SOURCES=polymarket
MARKET_MIN_RELEVANCE_SCORE=1
```

Preview market luar:

```bash
curl "http://127.0.0.1:4174/market/fetch?limit=3&category=crypto" \
  -H "X-Retropick-Secret: <BROADCAST_SECRET>"
```

Broadcast market luar yang belum pernah dikirim:

```bash
curl -X POST http://127.0.0.1:4174/market/jobs/latest \
  -H "Content-Type: application/json" \
  -H "X-Retropick-Secret: <BROADCAST_SECRET>" \
  -d "{\"limit\":3,\"category\":\"crypto\",\"platforms\":[\"telegram\",\"discord\"]}"
```

Semua endpoint `POST` membutuhkan header:

```http
X-Retropick-Secret: <BROADCAST_SECRET>
```

## Contoh Broadcast Market

```bash
curl -X POST http://127.0.0.1:4174/broadcast/market \
  -H "Content-Type: application/json" \
  -H "X-Retropick-Secret: <BROADCAST_SECRET>" \
  -d "{\"marketId\":\"btc-100k-q4\",\"title\":\"Will Bitcoin hit $100K before Q4 2026?\",\"category\":\"Crypto & Finance\",\"marketType\":\"Direction\",\"url\":\"https://retropick-v1.vercel.app/app/markets/btc-100k-q4\",\"platforms\":[\"telegram\",\"discord\"]}"
```

## External News

Konfigurasi sumber berita di `.env`:

```env
NEWS_SOURCES=https://www.coindesk.com/arc/outboundfeeds/rss/,https://techcrunch.com/feed/,https://www.nasa.gov/technology/feed/,https://science.nasa.gov/feed/earth-observatory/natural-events
NEWS_KEYWORDS=bitcoin,btc,ethereum,eth,crypto,defi,etf,cpi,inflation,fed,interest rate,unemployment,gdp,recession,stock,earnings,valuation,ai,artificial intelligence,openai,anthropic,nvidia,benchmark,nasa,science,climate,weather,temperature,rainfall,flood,storm,drought,wildfire
```

Ambil berita terbaru tanpa mengirim:

```bash
curl "http://127.0.0.1:4174/news/fetch?limit=3" \
  -H "X-Retropick-Secret: <BROADCAST_SECRET>"
```

Filter kategori RetroPick:

```bash
curl "http://127.0.0.1:4174/news/fetch?limit=3&category=crypto" \
  -H "X-Retropick-Secret: <BROADCAST_SECRET>"
```

Kategori yang tersedia:

- `crypto`
- `economics`
- `financials`
- `tech_science`
- `climate`

Cron otomatis bisa dinyalakan lewat `.env`:

```env
ENABLE_NEWS_CRON=true
ENABLE_MARKET_CRON=true
```

Default jadwal:

- News crypto, economics, financials, tech & science, dan climate: setiap 60 menit
- Market crypto, economics, financials, tech & science, dan climate: setiap 60 menit

Setting cron eksplisit:

```env
CRON_NEWS_LIMIT=2
CRON_NEWS_CRYPTO=0 * * * *
CRON_NEWS_ECONOMICS=0 * * * *
CRON_NEWS_FINANCIALS=0 * * * *
CRON_NEWS_TECH_SCIENCE=0 * * * *
CRON_NEWS_CLIMATE=0 * * * *

CRON_MARKET_LIMIT=2
CRON_MARKET_CRYPTO=0 * * * *
CRON_MARKET_ECONOMICS=0 * * * *
CRON_MARKET_FINANCIALS=0 * * * *
CRON_MARKET_TECH_SCIENCE=0 * * * *
CRON_MARKET_CLIMATE=0 * * * *
```

Kirim satu berita manual:

```bash
curl -X POST http://127.0.0.1:4174/broadcast/news \
  -H "Content-Type: application/json" \
  -H "X-Retropick-Secret: <BROADCAST_SECRET>" \
  -d "{\"title\":\"Bitcoin ETF inflows rise\",\"summary\":\"Market sentiment may shift as traders watch ETF demand.\",\"source\":\"CoinDesk\",\"category\":\"Crypto & Macro\",\"url\":\"https://example.com/news\",\"platforms\":[\"telegram\",\"discord\"]}"
```

Fetch RSS lalu broadcast berita yang belum pernah dikirim:

```bash
curl -X POST http://127.0.0.1:4174/jobs/news/latest \
  -H "Content-Type: application/json" \
  -H "X-Retropick-Secret: <BROADCAST_SECRET>" \
  -d "{\"limit\":3,\"category\":\"crypto\",\"platforms\":[\"telegram\",\"discord\"]}"
```
