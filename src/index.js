import { COINS, fetchMarkets, fetchDailyCloses, sleep } from './coingecko.js';
import { computeRSI } from './rsi.js';
import { renderHTML, renderText, sendEmail } from './email.js';

async function buildReport() {
  const markets = await fetchMarkets(COINS.map((c) => c.id));
  const rows = [];

  for (const coin of COINS) {
    const m = markets[coin.id];
    let rsi = null;
    let closes = [];
    try {
      closes = await fetchDailyCloses(coin.id, 100);
      rsi = computeRSI(closes, 14);
    } catch (err) {
      console.error(`RSI/history fetch failed for ${coin.id}: ${err?.message ?? err}`);
    }
    await sleep(400); // be gentle with the keyless rate limit

    rows.push({
      symbol: coin.symbol,
      name: coin.name,
      price: m?.current_price ?? null,
      ch1h: m?.price_change_percentage_1h_in_currency ?? null,
      ch24h: m?.price_change_percentage_24h_in_currency ?? null,
      ch7d: m?.price_change_percentage_7d_in_currency ?? null,
      ch30d: m?.price_change_percentage_30d_in_currency ?? null,
      rsi,
      spark: closes.slice(-31), // 30 shown bars + 1 prior day for day-over-day colour
    });
  }

  return { generatedAt: new Date(), rows };
}

function subjectLine(report) {
  const parts = report.rows.map((r) => {
    if (r.price == null) return `${r.symbol} —`;
    const p = r.price >= 1000 ? Math.round(r.price).toLocaleString('en-US') : r.price.toFixed(2);
    return `${r.symbol} $${p}`;
  });
  return `⚡ Crypto Pulse — ${parts.join(' · ')}`;
}

async function main() {
  const report = await buildReport();
  const html = renderHTML(report);
  const text = renderText(report);
  const subject = subjectLine(report);

  // --dry-run writes the HTML to a file instead of emailing (for previewing).
  if (process.argv.includes('--dry-run')) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync('preview.html', html);
    console.log('Wrote preview.html');
    console.log(text);
    return;
  }

  const info = await sendEmail({ subject, html, text });
  console.log(`Sent: ${subject}`);
  console.log(`messageId: ${info.messageId}  accepted: ${JSON.stringify(info.accepted)}`);
}

main().catch((err) => {
  console.error('CryptoAlerts run failed:', err);
  process.exit(1);
});
