# VPS deployment

Ubuntu 22.04 deployment: Nginx serves `dist/` and proxies `/api/` to the Node server.
No npm packages are needed at runtime: the server uses Node built-ins, and the frontend
is built locally with `npm ci && npm run build`.

- App: `/opt/downuptiles/current`, symlink to a directory in `/opt/downuptiles/releases/`.
- Runtime: `/opt/node/bin/node`, Node 22.23.3 downloaded from nodejs.org with SHA256 verification.
- Service: `downuptiles.service`, unprivileged `downuptiles` user, read-only filesystem,
  384 MB memory limit, automatic restart, listening only on `127.0.0.1:5173`.
- Nginx site: `/etc/nginx/sites-available/downuptiles`.
- Firewall: incoming TCP 56777 (SSH), 80 and 443; other inbound ports denied.
- SSH: keys only. Existing root key retained; port unchanged.
- Ubuntu unattended security updates and Certbot renewal timers enabled.
- Application state remains in visitors' browsers. No server database or private API keys.

## Operations

```sh
systemctl status downuptiles nginx
journalctl -u downuptiles -n 100 --no-pager
nginx -t
systemctl restart downuptiles
```

For an update, build locally, upload `dist/`, `server/`, `package.json` and `LICENSE`
into a new release directory. Keep it root-owned and readable by the service and Nginx.
Switch `/opt/downuptiles/current` to the new directory and restart `downuptiles`.
Retain the previous release so rollback only requires switching the symlink back and restarting.
Do not upload `.git`, `.env`, SSH keys, local context files or development dependencies.

The initial release is `4db294f-deploy1`, based on commit `4db294f` plus the `HOST`
environment-variable support in `server/start.mjs` and these deployment configs.

## Domain and HTTPS

Production URL: https://downuptiles.com/. Its A record points to 194.59.183.167.
Let's Encrypt certificate issued on 2026-09-26, initially expires 2026-12-25.
Certbot manages the certificate and Nginx HTTPS configuration; HTTP redirects to HTTPS.
`certbot.timer` is enabled; a simulated renewal passed on 2026-09-26. Certificate paths are under `/etc/letsencrypt/live/downuptiles.com/`;
private keys stay on the VPS and must never be copied into the repository.

`nginx.conf` is the bootstrap HTTP configuration. On a fresh server, install it and run
`certbot --nginx -d downuptiles.com --redirect` to generate the TLS configuration.
Do not overwrite the live Certbot-managed configuration with the bootstrap file.

Moving from HTTP/IP to HTTPS/domain changes the browser storage origin. Existing users
should export their layout before switching, then import it on the final address.
Node binary upgrades are manual; Ubuntu's security timer does not update `/opt/node`.

## Analytics

Yandex Metrika counter **113084638** is loaded asynchronously by `src/services/analytics.ts`
only in the production build on downuptiles.com. A noscript pixel is included in `index.html`.
The owner's supplied settings enable Webvisor, click maps, link tracking and accurate bounce tracking.
SPA route changes send explicit, deduplicated `hit` calls so Crypto, Tops, Market and charts
are counted without relying on full page reloads. Local development does not initialize the tracker.

Statistics are viewed in the owner's Yandex Metrika account; no separate analytics VPS service
or DNS record is required. Published release: `/opt/downuptiles/releases/4db294f-metrika1`.

Umami was briefly installed and then retired at the owner's request. Its containers and daily
backup job are stopped and the Nginx collector is removed. Database volume, final dumps under
`/var/backups/umami`, and root-only configuration in `/opt/umami` are retained for recovery.
They consume disk space only; do not restart them unless intentionally restoring Umami.
