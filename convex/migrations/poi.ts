import { mutation } from "../_generated/server";

/**
 * Backfill tile coordinates for existing points of interest so they render as pins on the map.
 *
 * We deterministically assign a tile position within the world map's interior using a hash of
 * the POI's placeId. This mirrors the logic used when importing new POIs.
 *
 * Run:
 *   npx convex run migrations:backfillPoiTileCoordinates
 */
export const backfillPoiTileCoordinates = mutation({
  args: {},
  handler: async (ctx) => {
    const pois = await ctx.db.query("pointsOfInterest").collect();
    let updated = 0;
    for (const poi of pois) {
      // Skip if already populated
      if (typeof (poi as any).tileX === "number" && typeof (poi as any).tileY === "number") {
        continue;
      }
      // Fetch the world map to determine bounds
      const map = await ctx.db
        .query("maps")
        .withIndex("worldId", (q) => q.eq("worldId", (poi as any).worldId))
        .unique();
      if (!map) {
        continue;
      }
      const w = Math.max(1, (map as any).width - 2);
      const h = Math.max(1, (map as any).height - 2);
      const placeId: string = (poi as any).placeId;
      const hash = Array.from(placeId).reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7);
      const tileX = 1 + Math.abs(hash) % w;
      const tileY = 1 + Math.abs(Math.floor(hash / 997)) % h;
      await ctx.db.patch((poi as any)._id, { tileX, tileY });
      updated++;
    }
    return { updated };
  },
});


