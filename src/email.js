import nodemailer from 'nodemailer';
import { rsiZone } from './rsi.js';

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtPrice(v) {
  if (v == null) return '—';
  let min, max;
  if (v >= 1000) { min = 0; max = 0; }
  else if (v >= 1) { min = 2; max = 2; }
  else { min = 2; max = 6; }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  }).format(v);
}

function fmtPct(v) {
  if (v == null) return { text: '—', color: '#94a3b8', arrow: '' };
  const up = v >= 0;
  return {
    text: `${up ? '+' : ''}${v.toFixed(2)}%`,
    color: up ? '#22c55e' : '#f43f5e',
    arrow: up ? '▲' : '▼',
  };
}

// ── HTML email ────────────────────────────────────────────────────────────────
const CHANGE_COLS = [
  ['1H', 'ch1h'],
  ['24H', 'ch24h'],
  ['1W', 'ch7d'],
  ['1M', 'ch30d'],
];

function changeCell(label, change) {
  const c = fmtPct(change);
  return `
    <td align="center" valign="middle" style="padding:8px 4px;background:#0f1626;border-radius:8px;">
      <div style="font:600 11px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#64748b;letter-spacing:.06em;">${label}</div>
      <div style="font:700 15px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${c.color};margin-top:5px;white-space:nowrap;">${c.arrow} ${c.text}</div>
    </td>`;
}

// Pure HTML/CSS sparkline: a row of height-scaled bars (no SVG/remote image, so
// it renders in Gmail/Apple/Zoho alike). Coloured by overall direction.
function sparkline(series) {
  if (!Array.isArray(series) || series.length < 2) return '';
  const pts = series.slice(-30);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const H = 40; // track height (px)
  const up = pts[pts.length - 1] >= pts[0];
  const color = up ? '#22c55e' : '#f43f5e';

  const bars = pts
    .map((v) => {
      const h = Math.max(3, Math.round(((v - min) / range) * (H - 3)) + 3);
      return `<td valign="bottom" style="padding:0 1px;"><div style="height:${h}px;background:${color};border-radius:1px;font-size:0;line-height:0;">&nbsp;</div></td>`;
    })
    .join('');

  return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;table-layout:fixed;height:${H}px;">
          <tr>${bars}</tr>
        </table>`;
}

function coinCard(row) {
  const zone = rsiZone(row.rsi);
  const rsiVal = row.rsi == null ? '—' : row.rsi.toFixed(0);
  const fillPct = row.rsi == null ? 0 : Math.max(2, Math.min(100, row.rsi));

  const changes = CHANGE_COLS.map(
    ([label, key], i) => (i ? '<td style="width:8px;"></td>' : '') + changeCell(label, row[key])
  ).join('');

  return `
  <tr><td style="padding:0 0 16px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#151c2e;border:1px solid #243049;border-radius:16px;">
      <tr><td style="padding:20px 22px;">

        <!-- header row: name + price -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="left" valign="middle">
              <span style="font:700 18px/1.2 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#f8fafc;">${row.name}</span>
              <span style="display:inline-block;margin-left:8px;padding:2px 8px;background:#243049;border-radius:6px;font:700 11px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#94a3b8;letter-spacing:.05em;">${row.symbol}</span>
            </td>
            <td align="right" valign="middle">
              <span style="font:800 22px/1.2 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#ffffff;">${fmtPrice(row.price)}</span>
            </td>
          </tr>
        </table>

        <!-- RSI -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
          <tr>
            <td valign="middle" style="font:600 12px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#64748b;letter-spacing:.06em;white-space:nowrap;padding-right:12px;">RSI&nbsp;14D</td>
            <td valign="middle" width="100%">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1626;border-radius:6px;">
                <tr><td style="height:8px;background:${zone.color};width:${fillPct}%;border-radius:6px;font-size:0;line-height:0;">&nbsp;</td><td style="font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
            </td>
            <td valign="middle" align="right" style="padding-left:12px;white-space:nowrap;">
              <span style="font:800 16px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${zone.color};">${rsiVal}</span>
              <span style="font:600 11px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${zone.color};margin-left:6px;">${zone.label}</span>
            </td>
          </tr>
        </table>

        <!-- sparkline (30-day trend) -->
        ${sparkline(row.spark)}

        <!-- changes -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
          <tr>${changes}</tr>
        </table>

      </td></tr>
    </table>
  </td></tr>`;
}

export function renderHTML(report) {
  // Explicit components (not dateStyle/timeStyle) so we can append the correct
  // timezone abbreviation — AEST in winter, AEDT in summer — automatically.
  const when = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZoneName: 'short',
  }).format(report.generatedAt);
  const cards = report.rows.map(coinCard).join('');

  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background:#0b1220;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1220;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;">

        <!-- header -->
        <tr><td style="padding:0 0 20px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:16px;background:#6d28d9;background-image:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#ec4899 100%);">
            <tr><td style="padding:22px 24px;">
              <div style="font:800 22px/1.2 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#ffffff;">⚡ Crypto Pulse</div>
              <div style="font:500 13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#ede9fe;margin-top:4px;">6-hour update · ${when}</div>
            </td></tr>
          </table>
        </td></tr>

        ${cards}

        <!-- footer -->
        <tr><td style="padding:6px 8px 0 8px;">
          <div style="font:400 11px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#475569;">
            Prices &amp; % changes from CoinGecko · RSI(14) &amp; 30-day sparkline on daily closes ·
            <span style="color:#22c55e;">green</span>/<span style="color:#f43f5e;">red</span> = up/down ·
            RSI zones: &le;30 oversold, &ge;70 overbought · next update in ~6h.
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function renderText(report) {
  const lines = [`Crypto Pulse — ${report.generatedAt.toISOString()}`, ''];
  for (const r of report.rows) {
    const p = (v) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`);
    lines.push(
      `${r.name} (${r.symbol})  ${r.price == null ? '—' : '$' + r.price}`,
      `  RSI14: ${r.rsi == null ? '—' : r.rsi.toFixed(1)}  |  1H ${p(r.ch1h)}  24H ${p(r.ch24h)}  1W ${p(r.ch7d)}  1M ${p(r.ch30d)}`,
      ''
    );
  }
  return lines.join('\n');
}

// ── Send ──────────────────────────────────────────────────────────────────────
export async function sendEmail({ subject, html, text }) {
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    requireTLS: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transport.sendMail({
    from: process.env.ALERT_FROM,
    to: process.env.ALERT_TO,
    subject,
    text,
    html,
  });
}
