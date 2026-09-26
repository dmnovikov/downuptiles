const COUNTER_ID = 113084638;
type Metrika = { (...args: unknown[]): void; a?: unknown[][]; l?: number };
declare global { interface Window { ym?: Metrika } }
let lastUrl = '';

// Only the public deployment records visits; local development and tests do not.
export function startAnalytics() {
  if (!import.meta.env.PROD || location.hostname !== 'downuptiles.com' || lastUrl) return;
  lastUrl = location.href;
  window.ym ??= Object.assign((...args: unknown[]) => { window.ym!.a!.push(args); }, { a: [] as unknown[][], l: Date.now() });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://mc.yandex.ru/metrika/tag.js?id=${COUNTER_ID}`;
  if (![...document.scripts].some(s => s.src === script.src)) document.head.appendChild(script);
  window.ym(COUNTER_ID, 'init', {
    ssr: true, webvisor: true, clickmap: true, ecommerce: 'dataLayer',
    referrer: document.referrer, url: lastUrl, accurateTrackBounce: true, trackLinks: true,
  });
}

// Our router uses pushState as well as hash navigation. Send one hit per URL change.
export function trackPageView() {
  if (!lastUrl || lastUrl === location.href || !window.ym) return;
  const previous = lastUrl;
  lastUrl = location.href;
  window.ym(COUNTER_ID, 'hit', lastUrl, { referer: previous, title: document.title });
}
