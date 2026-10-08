# Android app

The Android app packages the existing React UI with Capacitor 8. It does not load
the website as a remote page. Package ID: `com.downuptiles.app`; version: `0.3`,
versionCode: `4`. Minimum Android version: 7.0 (API 24), target API 36.

## Build a test APK

Install Node 22+, JDK 21 and Android SDK platform 36 / build-tools 36.0.0.
Accept the Android SDK license and set `JAVA_HOME` and `ANDROID_HOME`.
The build script also detects the local toolchain under `tmp/android-tools/`,
which is excluded from Git and deployment.

```sh
npm ci
npm run android:apk
```

Output: `artifacts/downuptiles-0.3-debug.apk`. Copy it to an Android phone and
allow installation from the browser or file manager used to open it. This is a
debug-signed testing build, not a Google Play release. Keep the local debug
keystore for compatible test updates; release signing requires a separate,
securely backed-up key. Never commit keystores or passwords.

For Android Studio: `npm run android:sync`, then `npm run android:open`.

## Behavior

- Binance REST/WebSocket connections remain direct. MEXC and Yahoo use the
  existing HTTPS APIs on downuptiles.com via Capacitor HTTP. The production
  server needs no change. Native calls have connection/read timeouts; aborted
  UI requests stop waiting and ignore late responses.
- Back dismisses dialogs first, exits tile editing, then navigates back.
  On the initial main screen it minimizes the app.
- Layouts stay in the app's own WebView storage, separate from the browser.
  Transfer them with Export/Import. Native export opens Android's share sheet
  with a JSON file; import uses the system file picker.
- Previously cached prices remain available offline; fresh quotes and uncached
  charts require internet. External links open outside the app.
- Yandex Metrika is restricted to the public website host and does not run in
  this bundled app. No account, extra server or new Android storage permission
  is required. Android automatic cloud backup is disabled.

## Verify on a phone before release

Check Binance/MEXC prices, Market, chart navigation, Android Back, changing and
restarting watchlists, export/share/import, airplane-mode recovery, background
resume, and display insets with gesture and three-button navigation. Build and
browser tests do not replace testing Android WebView on a real device.

Future Play distribution needs a signed release AAB, an increased versionCode
for each update, store assets and declarations. The current APK does not add
automatic updates, push notifications, or an iOS target.
