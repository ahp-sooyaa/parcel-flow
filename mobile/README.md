# Parcel Flow rider app

The native Expo app for Parcel Flow riders, Android first. Architecture, conventions and the roadmap live in [`docs/mobile-app.md`](../docs/mobile-app.md).

## Run it

```bash
cp .env.example .env   # set EXPO_PUBLIC_API_URL to the web app's address
bun install
bun run start          # scan the QR code with Expo Go
```

When the web app runs on your machine (`bun run dev`, which listens on all interfaces), use your machine's LAN address, not `localhost`, so the phone can reach it.

## Checks

```bash
bun run lint
bun run format:check
bun run typecheck
bun run test
```
