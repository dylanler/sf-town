# SF Town

SF Town is a small 2D pixel-art social simulation set across a foggy, colorful San Francisco. Pick a neighborhood, check in at landmarks, and leave notes for the residents who live there.

The runnable experience is local-first: town state is persisted in the browser with `localStorage`. There is no Convex deployment, hosted database, auth provider, or required LLM connection in the app path.

## Run it

```bash
npm install
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

## Local data

The app seeds a starter town on first load and stores edits, check-ins, profile changes, messages, and town events under the `sf-town.local-db.v1` browser storage key. Use the `RESET` control in the top bar to restore the starter scene.

## Visuals

The San Francisco panorama and landmark postcard sheet in `assets/generated/` were created with the built-in image generator for this project. They are used as the map scene and the landmark cards; the map overlays and resident markers are deliberately rendered as crisp pixel-style UI elements.

## Project notes

The repository began as an AI Town/Convex prototype. The original Convex simulation code remains in `convex/` as historical reference, but it is not imported by the active local-first frontend and no environment variables are needed to run SF Town.
