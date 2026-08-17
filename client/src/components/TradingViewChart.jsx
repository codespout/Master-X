import { useEffect, useId, useRef, useState } from 'react';
import { LineChart as LineIcon } from 'lucide-react';

function buildWidget(id, symbol) {
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
    backgroundColor: 'rgba(13,21,36,1)',
    gridColor: 'rgba(28,41,64,0.5)'
  });
  return true;
}

export default function TradingViewChart({ symbol = 'BTCUSDT', height = 420 }) {
  const containerRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const rawId = useId();
  const chartId = `tv-chart-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;

  useEffect(() => {
    let cancelled = false;
    const host = containerRef.current;
    if (!host) return;
    host.innerHTML = '';

    try {
      if (buildWidget(chartId, symbol)) return;
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
        if (!buildWidget(chartId, symbol)) setFailed(true);
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

  if (failed) {
    return (
      <div className="flex items-center justify-center gap-3" style={{ height }}>
        <LineIcon className="h-8 w-8 text-mx-muted/50" />
        <span className="text-sm text-mx-muted">
          Live chart unavailable offline. Simulated price feed still active below.
        </span>
      </div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      <div id={chartId} ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
