import { useState } from 'react';
import type { Asset } from '../types/market';
import symbols from '../providers/icon-symbols.json';
const available = new Set(symbols);
export function CoinAvatar({ asset }: { asset: Asset }) {
  const [failed, setFailed] = useState(false);
  const symbol = asset.symbol.toLowerCase();
  const icon = available.has(symbol) ? `/coins/${symbol}.png` : undefined;
  return <span className="coin-avatar" style={{ color: asset.color, backgroundColor: `${asset.color}15` }}>
    {icon && !failed ? <img src={icon} alt="" width="33" height="33" loading="lazy" decoding="async" onError={() => setFailed(true)}/> : asset.symbol.slice(0, 1)}
  </span>;
}
