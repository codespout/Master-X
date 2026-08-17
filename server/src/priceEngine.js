import { PAIRS } from './config.js';

const volatility = {
  BTCUSDT: 0.0008,
  ETHUSDT: 0.001,
  BNBUSDT: 0.0012,
  SOLUSDT: 0.0015,
  XRPUSDT: 0.002,
  DOGEUSDT: 0.0025
};

const prices = {};
for (const p of PAIRS) {
  prices[p.symbol] = { symbol: p.symbol, price: p.seed, open: p.seed, high: p.seed, low: p.seed, change: 0, updatedAt: Date.now() };
}

function walk() {
  for (const p of PAIRS) {
    const tick = prices[p.symbol];
    const vol = volatility[p.symbol] || 0.001;
    const drift = (Math.random() - 0.5) * 2 * vol;
    const jump = Math.random() < 0.02 ? (Math.random() - 0.5) * vol * 4 : 0;
    let next = tick.price * (1 + drift + jump);
    next = Number(next.toFixed(p.precision));
    tick.price = next;
    tick.high = Math.max(tick.high, next);
    tick.low = Math.min(tick.low, next);
    tick.change = ((next - tick.open) / tick.open) * 100;
    tick.updatedAt = Date.now();
  }
}

async function tryFetchLive() {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://api.binance.com/api/v3/ticker/24hr', { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return;
    const data = await res.json();
    const map = {};
    for (const d of data) map[d.symbol] = d;
    for (const p of PAIRS) {
      const d = map[p.symbol];
      if (!d) continue;
      const tick = prices[p.symbol];
      tick.price = Number(parseFloat(d.lastPrice).toFixed(p.precision));
      tick.open = Number(parseFloat(d.openPrice).toFixed(p.precision));
      tick.high = Number(parseFloat(d.highPrice).toFixed(p.precision));
      tick.low = Number(parseFloat(d.lowPrice).toFixed(p.precision));
      tick.change = Number(parseFloat(d.priceChangePercent).toFixed(2));
      tick.updatedAt = Date.now();
    }
  } catch {
    /* offline - simulated walk continues */
  }
}

let liveTimer = null;

export function startPriceEngine() {
  setInterval(walk, 1500);
  liveTimer = setInterval(tryFetchLive, 20000);
  tryFetchLive();
}

export function getPrices() {
  return Object.values(prices);
}

export function getPrice(symbol) {
  const t = prices[symbol];
  return t ? t.price : null;
}
