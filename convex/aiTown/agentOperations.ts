import { v } from 'convex/values';
import { ActionCtx, internalAction } from '../_generated/server';
import { WorldMap, serializedWorldMap } from './worldMap';
import { rememberConversation } from '../agent/memory';
import { GameId, agentId, conversationId, playerId } from './ids';
import {
  continueConversationMessage,
  leaveConversationMessage,
  startConversationMessage,
} from '../agent/conversation';
import { assertNever } from '../util/assertNever';
import { serializedAgent } from './agent';
import { ACTIVITIES, ACTIVITY_COOLDOWN, CONVERSATION_COOLDOWN } from '../constants';
import { api, internal } from '../_generated/api';
import { sleep } from '../util/sleep';
import { serializedPlayer } from './player';
import { Id } from '../_generated/dataModel';

async function sendInputWithRetry(
  ctx: ActionCtx,
  params: { worldId: Id<'worlds'>; name: string; args: any },
  maxAttempts = 8,
) {
  let attempt = 0;
  // Start with some jitter to avoid thundering herd and gradually back off.
  let delayMs = 150 + Math.random() * 350;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await ctx.runMutation(api.aiTown.main.sendInput, params);
    } catch (e: any) {
      const message: string = e?.message ?? '';
      const isOCC = message.includes('Documents read from or written to the "inputs" table changed');
      if (!isOCC || attempt >= maxAttempts - 1) {
        throw e;
      }
      await sleep(delayMs);
      delayMs = Math.min(2000, delayMs * 1.7 + Math.random() * 200);
      attempt += 1;
    }
  }
}

export const agentRememberConversation = internalAction({
  args: {
    worldId: v.id('worlds'),
    playerId,
    agentId,
    conversationId,
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Archived conversation writes may not be visible immediately when this action runs.
    // Retry a few times before surfacing the error.
    const maxAttempts = 6;
    let attempt = 0;
    let delayMs = 200 + Math.random() * 300;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await rememberConversation(
          ctx,
          args.worldId,
          args.agentId as GameId<'agents'>,
          args.playerId as GameId<'players'>,
          args.conversationId as GameId<'conversations'>,
        );
        break;
      } catch (e: any) {
        const message: string = e?.message ?? '';
        const notFound = message.includes('Conversation') && message.includes('not found');
        if (!notFound || attempt >= maxAttempts - 1) {
          throw e;
        }
        await sleep(delayMs);
        delayMs = Math.min(1500, delayMs * 1.6 + Math.random() * 200);
        attempt += 1;
      }
    }
    await sleep(Math.random() * 1000);
    await sendInputWithRetry(ctx, {
      worldId: args.worldId,
      name: 'finishRememberConversation',
      args: {
        agentId: args.agentId,
        operationId: args.operationId,
      },
    });
  },
});

export const agentGenerateMessage = internalAction({
  args: {
    worldId: v.id('worlds'),
    playerId,
    agentId,
    conversationId,
    otherPlayerId: playerId,
    operationId: v.string(),
    type: v.union(v.literal('start'), v.literal('continue'), v.literal('leave')),
    messageUuid: v.string(),
  },
  handler: async (ctx, args) => {
    let completionFn;
    switch (args.type) {
      case 'start':
        completionFn = startConversationMessage;
        break;
      case 'continue':
        completionFn = continueConversationMessage;
        break;
      case 'leave':
        completionFn = leaveConversationMessage;
        break;
      default:
        assertNever(args.type);
    }
    const text = await completionFn(
      ctx,
      args.worldId,
      args.conversationId as GameId<'conversations'>,
      args.playerId as GameId<'players'>,
      args.otherPlayerId as GameId<'players'>,
    );

    await ctx.runMutation(internal.aiTown.agent.agentSendMessage, {
      worldId: args.worldId,
      conversationId: args.conversationId,
      agentId: args.agentId,
      playerId: args.playerId,
      text,
      messageUuid: args.messageUuid,
      leaveConversation: args.type === 'leave',
      operationId: args.operationId,
    });
  },
});

export const agentDoSomething = internalAction({
  args: {
    worldId: v.id('worlds'),
    player: v.object(serializedPlayer),
    agent: v.object(serializedAgent),
    map: v.object(serializedWorldMap),
    otherFreePlayers: v.array(v.object(serializedPlayer)),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    const { player, agent } = args;
    const map = new WorldMap(args.map);
    const now = Date.now();
    // Don't try to start a new conversation if we were just in one.
    const justLeftConversation =
      agent.lastConversation && now < agent.lastConversation + CONVERSATION_COOLDOWN;
    // Don't try again if we recently tried to find someone to invite.
    const recentlyAttemptedInvite =
      agent.lastInviteAttempt && now < agent.lastInviteAttempt + CONVERSATION_COOLDOWN;
    const recentActivity = player.activity && now < player.activity.until + ACTIVITY_COOLDOWN;
    // Decide whether to do an activity or wander somewhere.
    if (!player.pathfinding) {
      if (recentActivity || justLeftConversation) {
        await sleep(Math.random() * 1000);
        await sendInputWithRetry(ctx, {
          worldId: args.worldId,
          name: 'finishDoSomething',
          args: {
            operationId: args.operationId,
            agentId: agent.id,
            destination: wanderDestination(map),
          },
        });
        return;
      } else {
        // Occasionally interact with a POI instead of a random activity
        const pois = await ctx.runQuery(api.aiTown.poi.listPointsOfInterest, { worldId: args.worldId });
        if (pois.length > 0 && Math.random() < 0.33) {
          const poi = pois[Math.floor(Math.random() * pois.length)];
          // Fire-and-forget internal thought/action log
          await ctx.runAction(internal.aiTown.poi.agentInteractWithPoi, {
            worldId: args.worldId,
            agentId: agent.id,
            playerId: player.id,
            poiId: poi._id,
          });
          await sleep(Math.random() * 300);
          await sendInputWithRetry(ctx, {
            worldId: args.worldId,
            name: 'finishDoSomething',
            args: {
              operationId: args.operationId,
              agentId: agent.id,
              activity: {
                description: `Thinking about ${poi.name}`,
                emoji: '🧭',
                until: Date.now() + 2000,
              },
            },
          });
          return;
        } else {
          // TODO: have LLM choose the activity & emoji
          const activity = ACTIVITIES[Math.floor(Math.random() * ACTIVITIES.length)];
          await sleep(Math.random() * 1000);
          await sendInputWithRetry(ctx, {
            worldId: args.worldId,
            name: 'finishDoSomething',
            args: {
              operationId: args.operationId,
              agentId: agent.id,
              activity: {
                description: activity.description,
                emoji: activity.emoji,
                until: Date.now() + activity.duration,
              },
            },
          });
          return;
        }
      }
    }
    const invitee =
      justLeftConversation || recentlyAttemptedInvite
        ? undefined
        : await ctx.runQuery(internal.aiTown.agent.findConversationCandidate, {
            now,
            worldId: args.worldId,
            player: args.player,
            otherFreePlayers: args.otherFreePlayers,
          });

    // TODO: We hit a lot of OCC errors on sending inputs in this file. It's
    // easy for them to get scheduled at the same time and line up in time.
    await sleep(Math.random() * 1000);
    await sendInputWithRetry(ctx, {
      worldId: args.worldId,
      name: 'finishDoSomething',
      args: {
        operationId: args.operationId,
        agentId: args.agent.id,
        invitee,
      },
    });
  },
});

function wanderDestination(worldMap: WorldMap) {
  // Wander someonewhere at least one tile away from the edge.
  return {
    x: 1 + Math.floor(Math.random() * (worldMap.width - 2)),
    y: 1 + Math.floor(Math.random() * (worldMap.height - 2)),
  };
}
