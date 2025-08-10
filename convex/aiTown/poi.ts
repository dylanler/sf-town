import { v } from 'convex/values';
import { ActionCtx, internalAction, internalMutation, mutation, query } from '../_generated/server';
import { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';

type ImportedPlace = {
  name: string;
  category?: string;
  address?: string;
  description?: string;
  place_id: string;
};

export const importPointsOfInterest = mutation({
  args: {
    worldId: v.id('worlds'),
    centerLat: v.number(),
    centerLng: v.number(),
    radiusMiles: v.number(),
    places: v.array(
      v.object({
        name: v.string(),
        category: v.optional(v.string()),
        address: v.optional(v.string()),
        description: v.optional(v.string()),
        place_id: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // Note: center/radius reserved for later geofiltering when lat/lng available.
    const { worldId, places } = args as {
      worldId: Id<'worlds'>;
      centerLat: number;
      centerLng: number;
      radiusMiles: number;
      places: ImportedPlace[];
    };

    for (const p of places) {
      // Skip duplicates by worldId + placeId
      const existing = await ctx.db
        .query('pointsOfInterest')
        .withIndex('world_place', (q) => q.eq('worldId', worldId).eq('placeId', p.place_id))
        .first();
      if (existing) continue;
      await ctx.db.insert('pointsOfInterest', {
        worldId,
        placeId: p.place_id,
        name: p.name,
        category: p.category,
        address: p.address,
        description: p.description,
      });
    }
  },
});

export const listPointsOfInterest = query({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, { worldId }: { worldId: Id<'worlds'> }) => {
    return ctx.db
      .query('pointsOfInterest')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();
  },
});

export const listPoiActions = query({
  args: { worldId: v.id('worlds'), limit: v.optional(v.number()) },
  handler: async (
    ctx,
    { worldId, limit = 25 }: { worldId: Id<'worlds'>; limit?: number },
  ) => {
    const actions = await ctx.db
      .query('poiActions')
      .withIndex('world_time', (q) => q.eq('worldId', worldId))
      .order('desc')
      .take(limit);
    return actions;
  },
});

export const agentInteractWithPoi = internalAction({
  args: {
    worldId: v.id('worlds'),
    agentId: v.string(),
    playerId: v.string(),
    poiId: v.id('pointsOfInterest'),
  },
  handler: async (ctx: ActionCtx, args) => {
    // Minimal internal thought text without LLM dependency to keep this self-contained.
    // Future: enrich with LLM prompt using player and POI descriptions.
    const timestamp = Date.now();
    await ctx.runMutation(internal.aiTown.poi._insertPoiAction, {
      worldId: args.worldId,
      agentId: args.agentId,
      playerId: args.playerId,
      poiId: args.poiId,
      text: 'observes and reflects on this place quietly.',
      timestamp,
    });
  },
});

export const _insertPoiAction = internalMutation({
  args: {
    worldId: v.id('worlds'),
    agentId: v.string(),
    playerId: v.string(),
    poiId: v.id('pointsOfInterest'),
    text: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('poiActions', args);
  },
});


