export function MoversLoading({ count = 4 }: { count?: number }) {
  return <>{Array.from({ length: count }, (_, index) => <div key={index} className="quote-tile movers-placeholder" aria-hidden="true">
    <div className="tile-content"><span className="placeholder-symbol"/><span className="placeholder-price"/><span className="placeholder-chart"/><span className="placeholder-change"/></div>
  </div>)}</>;
}
