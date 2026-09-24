export function precision(price: number) { return price >= 100 ? 2 : price >= 1 ? 3 : price >= .01 ? 5 : price >= .0001 ? 6 : 8; }
export function formatPrice(price: number) { return new Intl.NumberFormat('en-US', { minimumFractionDigits: precision(price), maximumFractionDigits: precision(price) }).format(price); }
export function roundedChange(change: number) { return Number(change.toFixed(2)); }
export function direction(change: number) { const value = roundedChange(change); return value > 0 ? 'up' : value < 0 ? 'down' : 'flat'; }
export function formatChange(change: number) { const value = roundedChange(change); return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}%`; }
export function changeDots(change: number) { const magnitude = Math.abs(change); return magnitude > 50 ? 3 : magnitude > 30 ? 2 : magnitude > 15 ? 1 : 0; }
