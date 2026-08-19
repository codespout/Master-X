import { useEffect, useId, useRef, useState } from 'react';
import { LineChart as LineIcon, Maximize2 } from 'lucide-react';

function buildWidget(id, symbol, container) {
  const tv = window.TradingView;
  if (!tv) return null;
  new tv.widget({
    container_id: id,
    autosize: true,
    symbol: `BINANCE:${symbol}`,
    interval: '1',
    timezone: 'Etc/UTC',
    theme: 'dark',
    style: '1',
    locale: 'en',
    enable_publishing: false,
    allow_symbol_change: false,
    hide_side_toolbar: false,
    hide_top_toolbar: true,
    studies: ['STD;MACD'],
    backgroundColor: 'rgba(9,14,25,1)',
    gridColor: 'rgba(42,59,89,0.6)',
    toolbar_bg: '#0d1524',
    save_image: false,
    container
  });
  return true;
}

export default function TradingViewChart({ symbol = 'BTCUSDT', height = 420, title }) {
  const containerRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const rawId = useId();
  const chartId = `tv-chart-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;

  useEffect(() => {
    let cancelled = false;
    const host = containerRef.current;
    if (!host) return;
    host.innerHTML = '';

    try {
      if (buildWidget(chartId, symbol, host)) return;
    } catch (e) {
      console.warn('TradingView init failed', e);
      setFailed(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onerror = () => !cancelled && setFailed(true);
    script.onload = () => {
      if (cancelled) return;
      try {
        if (!buildWidget(chartId, symbol, host)) setFailed(true);
      } catch (e) {
        console.warn('TradingView init failed', e);
        setFailed(true);
      }
    };
    host.appendChild(script);
    return () => {
      cancelled = true;
      if (script.parentNode) script.parentNode.removeChild(script);
      try {
        host.innerHTML = '';
      } catch {
        /* ignore */
      }
    };
  }, [symbol, chartId]);

  const header = (
    <div className="flex items-center justify-between border-b border-mx-border bg-mx-bg2 px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mx-up opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-mx-up" />
        </span>
        <span className="font-mono text-xs font-bold text-mx-text">{title || symbol}</span>
        <span className="hidden text-[11px] text-mx-muted sm:inline">Live Binance feed · 1m candles</span>
      </div>
      <button
        type="button"
        onClick={() => setFullscreen((f) => !f)}
        className="rounded-lg p-1.5 text-mx-muted transition-colors hover:bg-mx-card hover:text-mx-accent"
        aria-label="Toggle fullscreen"
      >
        <Maximize2 className="h-4 w-4" />
      </button>
    </div>
  );

  if (failed) {
    return (
      <div className="overflow-hidden rounded-2xl border border-mx-border bg-mx-card">
        {header}
        <div className="flex flex-col items-center justify-center gap-2" style={{ height }}>
          <LineIcon className="h-8 w-8 text-mx-muted/50" />
          <span className="text-sm text-mx-muted">Live chart unavailable offline. Simulated price feed still active.</span>
        </div>
      </div>
    );
  }

  const chartBody = (
    <div className="relative" style={{ height }}>
      <div id={chartId} ref={containerRef} className="absolute inset-0" />
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-[#090e19]">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-sm font-bold text-mx-text">{title || symbol}</span>
            <span className="text-[11px] text-mx-muted">Live Binance feed</span>
          </div>
          <button type="button" onClick={() => setFullscreen(false)} className="rounded-lg border border-mx-border2 bg-mx-card px-3 py-1.5 text-xs font-semibold text-mx-text hover:text-mx-accent">
            Exit fullscreen
          </button>
        </div>
        {chartBody}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-mx-border bg-mx-card">
      {header}
      {chartBody}
    </div>
  );
}
