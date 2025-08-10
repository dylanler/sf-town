import { v } from 'convex/values';
import { ActionCtx, internalAction, internalMutation, mutation, query } from '../_generated/server';
import { Id } from '../_generated/dataModel';
import { api, internal } from '../_generated/api';

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

    const map = await ctx.db
      .query('maps')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .unique();

    for (const p of places) {
      // Skip duplicates by worldId + placeId
      const existing = await ctx.db
        .query('pointsOfInterest')
        .withIndex('world_place', (q) => q.eq('worldId', worldId).eq('placeId', p.place_id))
        .first();
      if (existing) continue;
      let tileX = 1;
      let tileY = 1;
      if (map) {
        const w = Math.max(1, map.width - 2);
        const h = Math.max(1, map.height - 2);
        const hash = Array.from(p.place_id).reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7);
        tileX = 1 + Math.abs(hash) % w;
        tileY = 1 + Math.abs(Math.floor(hash / 997)) % h;
      }
      await ctx.db.insert('pointsOfInterest', {
        worldId,
        placeId: p.place_id,
        name: p.name,
        category: p.category,
        address: p.address,
        description: p.description,
        tileX,
        tileY,
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
    const timestamp = Date.now();
    const convo = await ctx.runMutation(api.aiTown.poi._ensurePoiConversation, {
      worldId: args.worldId,
      playerId: args.playerId,
      poiId: args.poiId,
    });
    await ctx.runMutation(internal.aiTown.poi._insertPoiAction, {
      worldId: args.worldId,
      agentId: args.agentId,
      playerId: args.playerId,
      poiId: args.poiId,
      text: 'observes and reflects on this place quietly.',
      timestamp,
      actor: 'agent',
      poiConversationId: (convo?._id as any),
    });
    await ctx.runAction(internal.aiTown.poi.poiRespond, {
      worldId: args.worldId,
      playerId: args.playerId,
      poiId: args.poiId,
      poiConversationId: (convo?._id as any),
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
    actor: v.optional(v.union(v.literal('agent'), v.literal('poi'), v.literal('player'))),
    poiConversationId: v.optional(v.id('poiConversations')),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('poiActions', args);
  },
});

export const _loadPoi = query({
  args: { poiId: v.id('pointsOfInterest') },
  handler: async (ctx, { poiId }) => ctx.db.get(poiId),
});

export const _ensurePoiConversation = mutation({
  args: { worldId: v.id('worlds'), playerId: v.string(), poiId: v.id('pointsOfInterest') },
  handler: async (ctx, { worldId, playerId, poiId }) => {
    const existing = await ctx.db
      .query('poiConversations')
      .withIndex('world_player_poi', (q) => q.eq('worldId', worldId).eq('playerId', playerId).eq('poiId', poiId))
      .first();
    if (existing) return existing;
    const _id = await ctx.db.insert('poiConversations', {
      worldId,
      playerId,
      poiId,
      created: Date.now(),
    });
    return await ctx.db.get(_id);
  },
});

export const poiRespond = internalAction({
  args: {
    worldId: v.id('worlds'),
    playerId: v.string(),
    poiId: v.id('pointsOfInterest'),
    poiConversationId: v.id('poiConversations'),
  },
  handler: async (ctx, args) => {
    const poi = await ctx.runQuery(api.aiTown.poi._loadPoi, { poiId: args.poiId });
    const reply = poi?.description ? `${poi.name}: ${poi.description}` : `${poi?.name ?? 'POI'} acknowledges.`;
    await ctx.runMutation(internal.aiTown.poi._insertPoiAction, {
      worldId: args.worldId,
      agentId: '',
      playerId: args.playerId,
      poiId: args.poiId,
      text: reply,
      timestamp: Date.now(),
      actor: 'poi',
      poiConversationId: args.poiConversationId,
    });
  },
});


