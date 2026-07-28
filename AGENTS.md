# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Scramble Debugging Notes

## Known: react-native-maps breaks Expo Go

**Symptom:** App loads to blank white screen on Expo Go, no visible errors.

**Cause:** `react-native-maps` v1.20.1 fails to initialise on Expo Go without additional native config (Google Maps API key on Android, etc.). The crash happens at bundle load, before any React renders — you get a silent blank screen.

**Confirmed working workaround (Tue 2026-07-28):** Stubbed `src/screens/MapScreen.tsx` with a placeholder. Original saved as `MapScreen.tsx.original`. Once the app loaded with the stub, we knew maps was the only blocker.

**Proper fix (TODO):**
- Option A: Build a native dev client (`eas build --profile development`) that includes Google Maps config. Then maps work in dev, and Expo Go isn't needed.
- Option B: Guard `react-native-maps` behind a Platform check or lazy-load so Expo Go can skip it.
- Option C: Configure Google Maps API keys properly in app.json so Expo Go loads the module. Needs research.

## Debugging tips

- **Expo Go must be signed into the `hlake1` account** — otherwise EAS Update returns 403 (project is private).
- **Ngrok tunnels drop mid-bundle** on flaky connections. If the bundle download stalls (e.g. gets stuck at 24%), the tunnel probably died. Use EAS Update (`exp://u.expo.dev/...`) instead of `expo start --tunnel` when possible — it's more reliable.
- **Web build works fine** (`npx expo start --web`) — Metro bundling itself is not the issue. Any bundling errors seen in web don't necessarily fail on native (e.g. web bundler chokes on `react-native-maps` because it's native-only, but that's expected).
- **Crostini can't do LAN** — `expo start --lan` gives out an internal IP the phone can't reach. Always use tunnel or EAS Update.

## EAS Update URL (permanent, stable)

```
exp://u.expo.dev/8ea6f930-0e3f-432f-bc33-477fbf6a8ad9?channel-name=preview&runtime-version=exposdk%3A54.0.0
```

QR command:
```
npx qrcode-terminal "exp://u.expo.dev/8ea6f930-0e3f-432f-bc33-477fbf6a8ad9?channel-name=preview&runtime-version=exposdk%3A54.0.0"
```
