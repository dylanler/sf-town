# SF Town

SF Town is a 2D pixel-art social simulation set across a foggy, colorful San Francisco. One hundred residents follow routines, move between landmarks, make local decisions, and meet each other while you wander through the town.

The runnable experience is local-first: the complete population, memory stream, conversations, interactions, decision trajectories, check-ins, and observer settings are persisted in the browser with `localStorage`. There is no Convex deployment or hosted database. The only network call is the optional server-side model proxy for DeepSeek through OpenRouter; without a key, the town remains playable in local fallback mode.

## Run it

```bash
npm install
cp .env.example .env.local
# add your OPENROUTER_API_KEY to .env.local
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

For a production build:

```bash
npm run build
npm run preview
```

Useful checks:

```bash
npm run check
npm run lint
```

## Simulation and observation

The `SIMULATION CONTROL ROOM` exposes pause/resume, step, speed, resident trajectory tracking, social memory, and a searchable event log. Each autonomous step advances routines, movement, energy, mood, and a decision branch for every resident. Social pulses ask the configured model to return resident-to-resident interactions and short dialogue, then store them in the local memory stream. Use `RESET` to restore the starter population.

The model proxy runs at `http://localhost:8787` and Vite proxies `/api/town/*` to it. The active model defaults to `deepseek/deepseek-v4-flash-0731` and can be changed in `.env.local` without changing the client.

## Visuals

The San Francisco panorama, landmark postcard sheet, and resident sprite sheet in `assets/generated/` were created with the built-in image generator for this project. They are used as the map scene, landmark cards, and 100 resident markers; the map overlays and UI remain crisp pixel-style elements.

## Project notes

The repository began as an AI Town/Convex prototype. The original Convex simulation code remains in `convex/` as historical reference, but it is not imported by the active local-first frontend and no environment variables are needed to run SF Town.
