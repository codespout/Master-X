import { useEffect, useRef, useState } from 'react';
import { subscribe } from '../ws';

export default function usePriceFeed(symbol, maxPoints = 120) {
  const [price, setPrice] = useState(null);
  const [history, setHistory] = useState([]);
  const symbolRef = useRef(symbol);

  useEffect(() => {
    symbolRef.current = symbol;
    setHistory([]);
  }, [symbol]);

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type !== 'prices') return;
      const p = msg.data.find((x) => x.symbol === symbolRef.current);
      if (!p) return;
      setPrice(p);
      setHistory((h) => {
        const next = [...h, { t: p.updatedAt, price: p.price }];
        return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
      });
    });
    return unsub;
  }, [maxPoints]);

  return { price, history };
}
