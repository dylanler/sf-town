# SF Town

SF Town is a top-down 2D pixel-art social simulation set across a foggy, colorful San Francisco. One hundred DeepSeek-planned residents follow routines, navigate collision-safe streets, make decisions, and hold multi-turn conversations only when their paths physically cross. Move your own character with the arrow keys or WASD.

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

The `SIMULATION CONTROL ROOM` exposes pause/resume, step, speed, full-population model coverage, active encounter counts, resident trajectory tracking, social memory, and a searchable event log. Each model pulse sends all 100 residents to DeepSeek in parallel planning batches, then applies one validated decision per resident. Local pathfinding executes those plans on an explicit walkability graph. When two residents become co-located, their verified encounter is sent to DeepSeek for a 4–8 turn conversation and stored in the memory stream. Use `RESET` to restore the starter population.

The map's `SHOW WALK GRID` control reveals the same path graph used for NPC pathfinding and visitor collision checks. Water, cliffs, buildings, trees, fences, transit objects, and street furniture are outside this graph and cannot be crossed.

The model proxy runs at `http://localhost:8787` and Vite proxies `/api/town/*` to it. The active model defaults to `deepseek/deepseek-v4-flash-0731` and can be changed in `.env.local` without changing the client.

## Visuals

The top-down San Francisco town map, landmark postcard sheet, and resident sprite sheet in `assets/generated/` were created with the built-in image generator for this project. They are used as the playable plane, landmark cards, and 100 resident markers; deterministic navigation and collision data remain in code so movement can be validated independently from the artwork.

## Project notes

The repository began as an AI Town/Convex prototype. The original Convex simulation code remains in `convex/` as historical reference, but it is not imported by the active local-first frontend and no environment variables are needed to run SF Town.
