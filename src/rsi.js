// Relative Strength Index (Wilder's smoothing).
// `closes` is an ascending (oldest -> newest) array of closing prices.
// Returns the latest RSI value (0–100), or null if there isn't enough data.
export function computeRSI(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length < period + 1) return null;

  // Seed: simple average of the first `period` gains/losses.
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) gain += delta;
    else loss -= delta;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;

  // Wilder smoothing across the remaining closes.
  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    const g = delta > 0 ? delta : 0;
    const l = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Label + colour zone for an RSI value.
export function rsiZone(rsi) {
  if (rsi == null) return { label: 'n/a', color: '#94a3b8' };
  if (rsi >= 70) return { label: 'Overbought', color: '#f43f5e' };
  if (rsi <= 30) return { label: 'Oversold', color: '#22c55e' };
  return { label: 'Neutral', color: '#f59e0b' };
}
