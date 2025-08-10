import { movementSpeed } from '../../data/characters';
import { COLLISION_THRESHOLD } from '../constants';
import { compressPath, distance, manhattanDistance, pointsEqual } from '../util/geometry';
import { MinHeap } from '../util/minheap';
import { Point, Vector, Path, PathComponent } from '../util/types';
import { Game } from './game';
import { GameId } from './ids';
import { Player } from './player';
import { WorldMap } from './worldMap';

type PathCandidate = {
  position: Point;
  facing?: Vector;
  t: number;
  length: number;
  cost: number;
  prev?: PathCandidate;
};

interface PathCacheKey {
  startX: number;
  startY: number;
  destX: number;
  destY: number;
  worldStateHash: string;
}

interface CachedPathResult {
  path: Path | null;
  newDestination: Point | null;
  timestamp: number;
  hitCount: number;
}

class PathfindingCache {
  private cache = new Map<string, CachedPathResult>();
  private maxSize = 100;
  private maxAge = 5000;

  private keyToString(key: PathCacheKey): string {
    return `${key.startX},${key.startY}->${key.destX},${key.destY}:${key.worldStateHash}`;
  }

  get(key: PathCacheKey): CachedPathResult | null {
    const keyStr = this.keyToString(key);
    const result = this.cache.get(keyStr);

    if (!result) return null;

    if (Date.now() - result.timestamp > this.maxAge) {
      this.cache.delete(keyStr);
      return null;
    }

    this.cache.delete(keyStr);
    this.cache.set(keyStr, { ...result, hitCount: result.hitCount + 1 });

    return result;
  }

  set(key: PathCacheKey, result: { path: Path | null; newDestination: Point | null }): void {
    const keyStr = this.keyToString(key);

    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(keyStr, {
      ...result,
      timestamp: Date.now(),
      hitCount: 0
    });
  }

  getStats() {
    const totalHits = Array.from(this.cache.values()).reduce((sum, item) => sum + item.hitCount, 0);
    return {
      size: this.cache.size,
      totalHits,
      hitRate: totalHits / (totalHits + this.cache.size)
    };
  }
}

class MinDistancesPool {
  private pools: PathCandidate[][][] = [];

  get(width: number, height: number): PathCandidate[][] {
    let pool = this.pools.find(p => p.length >= height && p[0]?.length >= width);

    if (!pool) {
      pool = Array(height).fill(null).map(() => Array(width).fill(null));
      this.pools.push(pool);
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        pool[y][x] = null;
      }
    }

    return pool;
  }
}

const pathfindingCache = new PathfindingCache();
const minDistancesPool = new MinDistancesPool();

export function stopPlayer(player: Player) {
  delete player.pathfinding;
  player.speed = 0;
}

export function movePlayer(
  game: Game,
  now: number,
  player: Player,
  destination: Point,
  allowInConversation?: boolean,
) {
  if (Math.floor(destination.x) !== destination.x || Math.floor(destination.y) !== destination.y) {
    throw new Error(`Non-integral destination: ${JSON.stringify(destination)}`);
  }
  const { position } = player;
  // Close enough to current position or destination => no-op.
  if (pointsEqual(position, destination)) {
    return;
  }
  // Don't allow players in a conversation to move.
  const inConversation = [...game.world.conversations.values()].some(
    (c) => c.participants.get(player.id)?.status.kind === 'participating',
  );
  if (inConversation && !allowInConversation) {
    throw new Error(`Can't move when in a conversation. Leave the conversation first!`);
  }
  player.pathfinding = {
    destination: destination,
    started: now,
    state: {
      kind: 'needsPath',
    },
  };
  return;
}

export function findRoute(game: Game, now: number, player: Player, destination: Point) {
  const worldStateHash = `${game.world.players.size}-${game.world.conversations.size}-${Math.floor(now / 1000)}`;
  const cacheKey: PathCacheKey = {
    startX: Math.floor(player.position.x * 100) / 100,
    startY: Math.floor(player.position.y * 100) / 100,
    destX: destination.x,
    destY: destination.y,
    worldStateHash
  };

  const cached = pathfindingCache.get(cacheKey);
  if (cached) {
    console.debug(`Pathfinding cache hit for ${player.id}`);
    return { path: cached.path, newDestination: cached.newDestination };
  }

  const minDistances = minDistancesPool.get(game.worldMap.width, game.worldMap.height);
  const explore = (current: PathCandidate): Array<PathCandidate> => {
    const { x, y } = current.position;
    const neighbors = [];

    // If we're not on a grid point, first try to move horizontally
    // or vertically to a grid point. Note that this can create very small
    // deltas between the current position and the nearest grid point so
    // be careful to preserve the `facing` vectors rather than trying to
    // derive them anew.
    if (x !== Math.floor(x)) {
      neighbors.push(
        { position: { x: Math.floor(x), y }, facing: { dx: -1, dy: 0 } },
        { position: { x: Math.floor(x) + 1, y }, facing: { dx: 1, dy: 0 } },
      );
    }
    if (y !== Math.floor(y)) {
      neighbors.push(
        { position: { x, y: Math.floor(y) }, facing: { dx: 0, dy: -1 } },
        { position: { x, y: Math.floor(y) + 1 }, facing: { dx: 0, dy: 1 } },
      );
    }
    // Otherwise, just move to adjacent grid points.
    if (x == Math.floor(x) && y == Math.floor(y)) {
      neighbors.push(
        { position: { x: x + 1, y }, facing: { dx: 1, dy: 0 } },
        { position: { x: x - 1, y }, facing: { dx: -1, dy: 0 } },
        { position: { x, y: y + 1 }, facing: { dx: 0, dy: 1 } },
        { position: { x, y: y - 1 }, facing: { dx: 0, dy: -1 } },
      );
    }
    const next = [];
    for (const { position, facing } of neighbors) {
      const segmentLength = distance(current.position, position);
      const length = current.length + segmentLength;
      if (blocked(game, now, position, player.id)) {
        continue;
      }
      const remaining = manhattanDistance(position, destination);
      const path = {
        position,
        facing,
        // Movement speed is in tiles per second.
        t: current.t + (segmentLength / movementSpeed) * 1000,
        length,
        cost: length + remaining,
        prev: current,
      };
      const existingMin = minDistances[position.y]?.[position.x];
      if (existingMin && existingMin.cost <= path.cost) {
        continue;
      }
      minDistances[position.y] ??= [];
      minDistances[position.y][position.x] = path;
      next.push(path);
    }
    return next;
  };

  const startingLocation = player.position;
  const startingPosition = { x: startingLocation.x, y: startingLocation.y };
  let current: PathCandidate | undefined = {
    position: startingPosition,
    facing: player.facing,
    t: now,
    length: 0,
    cost: manhattanDistance(startingPosition, destination),
    prev: undefined,
  };
  let bestCandidate = current;
  const minheap = MinHeap<PathCandidate>((p0, p1) => p0.cost > p1.cost);
  while (current) {
    if (pointsEqual(current.position, destination)) {
      break;
    }
    if (
      manhattanDistance(current.position, destination) <
      manhattanDistance(bestCandidate.position, destination)
    ) {
      bestCandidate = current;
    }
    for (const candidate of explore(current)) {
      minheap.push(candidate);
    }
    current = minheap.pop();
  }
  let newDestination = null;
  if (!current) {
    if (bestCandidate.length === 0) {
      return null;
    }
    current = bestCandidate;
    newDestination = current.position;
  }
  const densePath = [];
  let facing = current.facing!;
  while (current) {
    densePath.push({ position: current.position, t: current.t, facing });
    facing = current.facing!;
    current = current.prev;
  }
  densePath.reverse();

  const result = { path: compressPath(densePath), newDestination };
  pathfindingCache.set(cacheKey, result);

  if (Math.random() < 0.01) {
    const stats = pathfindingCache.getStats();
    console.debug(`Pathfinding cache stats:`, stats);
  }

  return result;
}

export function blocked(game: Game, now: number, pos: Point, playerId?: GameId<'players'>) {
  const otherPositions = [...game.world.players.values()]
    .filter((p) => p.id !== playerId)
    .map((p) => p.position);
  return blockedWithPositions(pos, otherPositions, game.worldMap);
}

export function blockedWithPositions(position: Point, otherPositions: Point[], map: WorldMap) {
  if (isNaN(position.x) || isNaN(position.y)) {
    throw new Error(`NaN position in ${JSON.stringify(position)}`);
  }
  if (position.x < 0 || position.y < 0 || position.x >= map.width || position.y >= map.height) {
    return 'out of bounds';
  }
  for (const layer of map.objectTiles) {
    if (layer[Math.floor(position.x)][Math.floor(position.y)] !== -1) {
      return 'world blocked';
    }
  }
  for (const otherPosition of otherPositions) {
    if (distance(otherPosition, position) < COLLISION_THRESHOLD) {
      return 'player';
    }
  }
  return null;
}
