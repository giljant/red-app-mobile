# RED — Zagreb Queue Intelligence

> Real-time crowd and queue data for public services in Zagreb. Think Waze, but for waiting rooms.

![React Native](https://img.shields.io/badge/React_Native-0.76-blue) ![Expo](https://img.shields.io/badge/Expo-SDK_54-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)

## The problem

Showing up to FINA or a bank at the wrong time means a 90-minute wait instead of 10. Google Maps "busy times" doesn't cover Croatian public institutions, and even where it does, it's based on historical patterns rather than what's happening right now. RED fills that gap with live crowdsourced reports from people physically on location.

## Stack

| Layer | Tech |
|---|---|
| Mobile | React Native + Expo (TypeScript) |
| Routing | expo-router (file-based, dynamic routes) |
| Maps | react-native-maps + TomTom Routing & Traffic API |
| State | useState + Context API |
| Storage | AsyncStorage |
| Backend | Next.js API Routes + SQLite ([red-app](https://github.com/giljant/red-app)) |

TomTom over Google Maps: the free tier covers routing, traffic tiles, and geocoding without a billing account — practical for a project at this stage.

SQLite over Postgres: appropriate at this scale, zero infrastructure overhead, trivially swappable later via the same `better-sqlite3` interface.

## Architecture

### Data freshness model

The core challenge with crowdsourced data is staleness. A crowd report from 3 hours ago isn't neutral — it's actively misleading. RED uses a three-state freshness model:

```
Fresh    < 1h    →  show live crowd level
Stale    1–3h    →  show level + orange "Xh staro" warning
Unknown  > 3h    →  fall back to historical average, label "Uobičajeno"
```

This is implemented in `utils/radnoVrijeme.ts`:

```ts
export function svjezinaStatusa(lastUpdated: string | null): Svježina {
  if (!lastUpdated) return 'nepoznato';
  const diffH = (Date.now() - new Date(lastUpdated).getTime()) / 3600000;
  if (diffH < 1) return 'svježe';
  if (diffH < 3) return 'staro';
  return 'nepoznato';
}
```

### Historical fallback

When live data is unknown, the app falls back to a per-(day, hour) historical average computed by the backend — so it always shows something useful rather than a blank state. This also means the app is useful from day one, before many users have reported.

The `guzva_prosjecna` field comes pre-computed in the `/api/lokacije` response, based on the current day and hour.

### Rate limiting

Reports are rate-limited per device rather than per username. On first launch, a UUID is generated and persisted in AsyncStorage:

```ts
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
```

This `device_id` is sent with every crowd report. The backend enforces a 30-minute cooldown per device per location, making username changes a useless bypass attempt. Reports also require the user to be within 300m of the location — verified using the Haversine formula against GPS coordinates.

### Map performance

Rendering 180+ markers simultaneously hurts both readability and performance. Category filter chips control visibility: the default "Sve" view shows only a TomTom traffic overlay with no markers. Selecting a specific category (e.g. "Financije") renders only those markers — typically 15–25 — with crowd-colored icons.

## Screens

**Home** — filterable location list, "Blizu tebe" proximity cards, high-crowd alert section

**Map** — TomTom traffic overlay, category-filtered markers, routing with crowd-colored polyline + ETA bar, incident reporting via long-press

**"Kada ići"** — per-location hourly crowd chart (weekly breakdown) with best-time recommendation, fetched from `/api/statistike/:id`

**Feed** — city-wide community posts, auto-refreshed every 30s

## Key flows

### Crowd report
1. User opens a location modal and selects crowd level
2. App verifies GPS — must be within 300m of the location
3. PUT `/api/lokacije` with `{ id, guzva, device_id }`
4. Backend checks per-device 30-minute cooldown, updates `guzva` + `last_updated`
5. Location list re-fetches

### Routing
1. User searches or taps a category marker
2. `fetchRuta(lok)` calls TomTom Routing API with current GPS + destination
3. Polyline rendered with color matching the location's current crowd level
4. ETA bar appears at bottom of map with distance and estimated wait time

## Project structure

```
app/
  (tabs)/
    index.tsx       # Home — location list with proximity sort
    explore.tsx     # Map — TomTom routing + incident reporting
    feed.tsx        # Community feed
  lokacija/
    [id].tsx        # "Kada ići" — hourly crowd chart per location
  context/
    user.tsx        # Username + device ID (AsyncStorage)
  _layout.tsx       # Root layout, push notification permissions
utils/
  radnoVrijeme.ts   # Business hours, freshness states, wait time estimates
```

## Running locally

**Backend must be running first** — see [red-app](https://github.com/giljant/red-app)

```bash
npm install
npx expo start --clear
```

Update the `API` constant in `app/(tabs)/index.tsx`, `explore.tsx`, and `feed.tsx` to your machine's local IP address (`localhost` won't work — the physical device needs to reach your network).

## Roadmap

- [ ] Push notifications — alert nearby users when a location hits high crowd
- [ ] Location tagging in feed posts
- [ ] EAS production build + app store submission
- [ ] Expand location database beyond Zagreb
