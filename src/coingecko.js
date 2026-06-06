// Thin CoinGecko client. Keyless works for this low volume; a Demo key
// (COINGECKO_API_KEY) raises rate limits if we ever need it.
const BASE = 'https://api.coingecko.com/api/v3';

export const COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'hyperliquid', symbol: 'HYPE', name: 'Hyperliquid' },
  { id: 'near', symbol: 'NEAR', name: 'Near Protocol' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cgFetch(path) {
  const headers = { accept: 'application/json', 'user-agent': 'CryptoAlerts/0.1' };
  const key = process.env.COINGECKO_API_KEY;
  if (key) headers['x-cg-demo-api-key'] = key;

  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${BASE}${path}`, { headers, signal: AbortSignal.timeout(20000) });
      if (res.status === 429) {
        lastErr = new Error(`CoinGecko 429 (rate limited) for ${path}`);
        await sleep(3000 * attempt);
        continue;
      }
      if (!res.ok) throw new Error(`CoinGecko ${res.status} for ${path}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < 4) await sleep(1500 * attempt);
    }
  }
  throw lastErr ?? new Error(`CoinGecko request failed for ${path}`);
}

// Current price + native % changes (1h/24h/7d/30d), keyed by coin id.
export async function fetchMarkets(ids) {
  const data = await cgFetch(
    `/coins/markets?vs_currency=usd&ids=${ids.join(',')}` +
      `&price_change_percentage=1h,24h,7d,30d`
  );
  const byId = {};
  for (const c of data) byId[c.id] = c;
  return byId;
}

// ~100 daily closing prices (ascending) for RSI. days>90 => daily granularity.
export async function fetchDailyCloses(id, days = 100) {
  const data = await cgFetch(`/coins/${id}/market_chart?vs_currency=usd&days=${days}`);
  return (data.prices || []).map((p) => p[1]);
}

export { sleep };
