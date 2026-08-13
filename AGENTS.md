# AGENTS.md

## Cursor Cloud specific instructions

Aridia is a single client-side React 19 + Vite 6 SPA (a calendar / task-management productivity app). There is no backend, database, or auth — all data is persisted in the browser's `localStorage` (keys `aridia-tasks`, `aridia-weather-cache`). The package manager is npm (see `package-lock.json`).

Standard commands live in `package.json` scripts; run them from the repo root:
- Dev server: `npm run dev` — Vite serves on `http://localhost:5173/`. This is the command to use for development (not `build`/`preview`).
- Build: `npm run build`
- Lint: `npm run lint`

Non-obvious caveats:
- `npm run lint` currently reports many pre-existing errors/warnings (unused vars, a `no-undef` for `__dirname` in `vite.config.js`, etc.) in the committed source. These are pre-existing, not caused by your changes — do not assume you broke something if lint fails. Compare against the baseline before attributing new lint errors to your work.
- The dev server binds to localhost only (no `--host`). Use the in-VM browser to reach `http://localhost:5173/`.
- The sidebar weather widget calls the external OpenWeatherMap API and requires browser geolocation. When location is denied or there's no network, it shows "WEATHER UNAVAILABLE" — this is an expected fallback, not a bug. The rest of the app works fully without it.
- `vite.config.js` includes a `debug-agent-log` dev middleware (`/__debug_agent_log`) plus `src/debugAgentLog.js`; these are debug instrumentation that fail silently and are not required for the app to run.
- To create a task/event in the UI, double-click a time slot on the calendar grid to open the task creation card.
