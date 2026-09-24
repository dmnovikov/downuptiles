import { memo } from 'react';
import type { Point } from '../types/market';
export const Sparkline = memo(function Sparkline({ points }: { points: Point[] }) {
  const values = points.map(p => p.value), low = Math.min(...values), high = Math.max(...values), span = high - low || 1;
  const firstTime = points[0].time, duration = points.at(-1)!.time - firstTime || 1;
  const line = points.map(p => `${((p.time - firstTime) / duration * 156 + 2).toFixed(2)},${(45 - (p.value - low) / span * 39).toFixed(2)}`).join(' ');
  return <svg className="sparkline" viewBox="0 0 160 52" preserveAspectRatio="none" aria-label="Price over the last 24 hours" role="img"><path d="M2 48H158" className="sparkline-baseline"/><polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.65" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"/></svg>;
});
