import { useSyncExternalStore } from 'react';

export type TownPlace = {
  id: string;
  name: string;
  neighborhood: string;
  category: string;
  description: string;
  position: { left: number; top: number };
  accent: string;
  sheetIndex: number;
};

export type RoutineBlock = {
  start: number;
  end: number;
  placeId: string;
  activity: string;
};

export type Resident = {
  id: string;
  name: string;
  role: string;
  neighborhood: string;
  bio: string;
  status: 'online' | 'wandering' | 'resting';
  accent: string;
  position: { left: number; top: number };
  spriteIndex: number;
  routine: RoutineBlock[];
  activity: string;
  mood: string;
  energy: number;
  destinationId: string;
  traits: string[];
  goals: string[];
  lastDecisionSource?: 'llm' | 'routine';
  lastDecisionAt?: number;
};

export type TownMessage = {
  id: string;
  residentId: string;
  author: 'you' | 'resident';
  authorName: string;
  text: string;
  createdAt: number;
  source?: 'llm' | 'fallback' | 'user';
};

export type TownEvent = {
  id: string;
  text: string;
  kind: 'visit' | 'chat' | 'town' | 'interaction' | 'decision';
  createdAt: number;
};

export type TownInteraction = {
  id: string;
  participantIds: string[];
  participantNames: string[];
  locationId: string;
  locationName: string;
  summary: string;
  dialogue: string[];
  createdAt: number;
  source: 'llm';
  encounterId: string;
};

export type DecisionStep = {
  id: string;
  residentId: string;
  createdAt: number;
  need: string;
  options: string[];
  choice: string;
  reason: string;
  outcome: string;
  locationId: string;
  source: 'llm' | 'routine';
  confidence: number;
};

export type SimulationState = {
  tick: number;
  minuteOfDay: number;
  running: boolean;
  speed: 0.5 | 1 | 2;
  trackedResidentId: string;
  lastPulseAt: number;
  llmCoverage: number;
  activeEncounters: number;
};

export type TownState = {
  version: 5;
  visitorName: string;
  visitorBio: string;
  visitorAccent: string;
  visitorPosition: Point;
  residents: Resident[];
  places: TownPlace[];
  messages: TownMessage[];
  events: TownEvent[];
  interactions: TownInteraction[];
  decisions: DecisionStep[];
  visitedPlaceIds: string[];
  simulation: SimulationState;
};

export type Point = { left: number; top: number };
export type NavNode = Point & { id: string; neighbors: string[] };

const STORAGE_KEY = 'sf-town.local-db.v5';
const LEGACY_STORAGE_KEYS = ['sf-town.local-db.v4', 'sf-town.local-db.v3', 'sf-town.local-db.v2', 'sf-town.local-db.v1'];
const listeners = new Set<() => void>();

export const navNodes: NavNode[] = [
  { id: 'overlook', left: 17, top: 28, neighbors: ['west-crossing'] },
  { id: 'west-crossing', left: 28, top: 36, neighbors: ['overlook', 'cable-loop', 'north-center', 'west-mid'] },
  { id: 'cable-loop', left: 35, top: 43, neighbors: ['west-crossing', 'center-mid'] },
  { id: 'north-center', left: 47, top: 36, neighbors: ['west-crossing', 'north-east', 'center-mid'] },
  { id: 'north-east', left: 64, top: 36, neighbors: ['north-center', 'coit-plaza', 'east-crossing', 'center-east'] },
  { id: 'coit-plaza', left: 72, top: 19, neighbors: ['north-east', 'east-crossing'] },
  { id: 'east-crossing', left: 80, top: 36, neighbors: ['north-east', 'coit-plaza', 'ferry-plaza', 'east-mid'] },
  { id: 'ferry-plaza', left: 89, top: 42, neighbors: ['east-crossing', 'pier-mid'] },
  { id: 'west-mid', left: 28, top: 55, neighbors: ['west-crossing', 'center-mid', 'west-south'] },
  { id: 'center-mid', left: 47, top: 55, neighbors: ['cable-loop', 'north-center', 'west-mid', 'center-east', 'center-south'] },
  { id: 'center-east', left: 64, top: 55, neighbors: ['north-east', 'center-mid', 'east-mid', 'east-south'] },
  { id: 'east-mid', left: 80, top: 55, neighbors: ['east-crossing', 'center-east', 'pier-mid', 'east-south'] },
  { id: 'pier-mid', left: 90, top: 57, neighbors: ['ferry-plaza', 'east-mid', 'pier-south'] },
  { id: 'west-south', left: 28, top: 70, neighbors: ['west-mid', 'painted-park', 'center-south'] },
  { id: 'painted-park', left: 31, top: 78, neighbors: ['west-south', 'southwest'] },
  { id: 'center-south', left: 47, top: 70, neighbors: ['center-mid', 'west-south', 'east-south', 'southwest'] },
  { id: 'east-south', left: 64, top: 70, neighbors: ['center-east', 'center-south', 'mission-alley', 'southeast'] },
  { id: 'mission-alley', left: 72, top: 79, neighbors: ['east-south', 'southeast'] },
  { id: 'southeast', left: 80, top: 70, neighbors: ['east-mid', 'east-south', 'mission-alley', 'pier-south', 'south-east-bottom'] },
  { id: 'pier-south', left: 90, top: 72, neighbors: ['pier-mid', 'southeast'] },
  { id: 'southwest', left: 47, top: 88, neighbors: ['painted-park', 'center-south', 'south-center'] },
  { id: 'south-center', left: 64, top: 88, neighbors: ['southwest', 'mission-alley', 'south-east-bottom'] },
  { id: 'south-east-bottom', left: 80, top: 88, neighbors: ['south-center', 'southeast'] },
];

const navNodeById = new Map(navNodes.map((node) => [node.id, node]));
export const navEdges = navNodes.flatMap((node) => node.neighbors.filter((neighbor) => node.id < neighbor).map((neighbor) => ({ from: node.id, to: neighbor })));

function distance(a: Point, b: Point) {
  return Math.hypot(a.left - b.left, a.top - b.top);
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.left - start.left;
  const dy = end.top - start.top;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : clamp(((point.left - start.left) * dx + (point.top - start.top) * dy) / lengthSquared, 0, 1);
  return distance(point, { left: start.left + t * dx, top: start.top + t * dy });
}

export function isWalkable(point: Point) {
  if (point.left < 7 || point.left > 94 || point.top < 10 || point.top > 93) return false;
  if (navNodes.some((node) => distance(point, node) <= 4.2)) return true;
  return navEdges.some((edge) => {
    const start = navNodeById.get(edge.from)!;
    const end = navNodeById.get(edge.to)!;
    return distanceToSegment(point, start, end) <= 3.1;
  });
}

export const places: TownPlace[] = [
  {
    id: 'golden-gate', name: 'Golden Gate Overlook', neighborhood: 'Presidio', category: 'Landmark',
    description: 'A fog-softened overlook where the bridge turns orange at sunset.', position: { left: 17, top: 28 }, accent: '#f06b4f', sheetIndex: 0,
  },
  {
    id: 'cable-car', name: 'Powell Cable Car', neighborhood: 'Nob Hill', category: 'Transit',
    description: 'The bell rings twice before the car takes the next steep corner.', position: { left: 35, top: 43 }, accent: '#e7ad45', sheetIndex: 1,
  },
  {
    id: 'coit-tower', name: 'Coit Tower Steps', neighborhood: 'Telegraph Hill', category: 'Viewpoint',
    description: 'A hillside perch above the bay with a perfect view of passing ferries.', position: { left: 72, top: 19 }, accent: '#8da8b6', sheetIndex: 2,
  },
  {
    id: 'painted-ladies', name: 'Alamo Square Row', neighborhood: 'Alamo Square', category: 'Neighborhood',
    description: 'Colorful Victorian facades and a patch of grass made for lingering.', position: { left: 31, top: 78 }, accent: '#dd6f68', sheetIndex: 3,
  },
  {
    id: 'mission-mural', name: 'Balmy Alley Murals', neighborhood: 'Mission', category: 'Arts',
    description: 'A bright corridor of community murals, tacos, and late afternoon sun.', position: { left: 72, top: 79 }, accent: '#28b7ad', sheetIndex: 4,
  },
  {
    id: 'fog-pier', name: 'Ferry Building Pier', neighborhood: 'Embarcadero', category: 'Waterfront',
    description: 'Wooden boards, salty air, and a clear line toward the East Bay hills.', position: { left: 89, top: 42 }, accent: '#5da8cb', sheetIndex: 5,
  },
];

const accentPalette = ['#f08a5d', '#38b7a5', '#e6b84f', '#c771d3', '#7c8ee8', '#ed6b8e', '#ef6d43', '#d36b5c', '#5e9dc7', '#d79a4f', '#e2b344', '#738ed1'];

function makeRoutine(seed: number, activity: string): RoutineBlock[] {
  const morning = places[seed % places.length].id;
  const afternoon = places[(seed + 1) % places.length].id;
  const evening = places[(seed + 2) % places.length].id;
  return [
    { start: 390, end: 600, placeId: morning, activity: `morning ${activity}` },
    { start: 600, end: 1020, placeId: afternoon, activity },
    { start: 1020, end: 1320, placeId: evening, activity: `evening ${activity}` },
    { start: 1320, end: 1440, placeId: morning, activity: 'heading home through the fog' },
    { start: 0, end: 390, placeId: morning, activity: 'sleeping with the window cracked' },
  ];
}

type ResidentTemplate = {
  role: string;
  activity: string;
  traits: string[];
  goals: string[];
  bio: string;
  spriteIndex: number;
};

const residentTemplates: ResidentTemplate[] = [
  { role: 'Ceramicist', activity: 'shaping clay', traits: ['observant', 'patient'], goals: ['finish a blue house', 'find a quieter kiln'], bio: 'Makes tiny blue houses and knows where the fog is thickest.', spriteIndex: 0 },
  { role: 'Bike courier', activity: 'delivering a package', traits: ['restless', 'generous'], goals: ['take the long way home', 'learn one new block'], bio: 'Collects neighborhood sounds and takes the long way home.', spriteIndex: 1 },
  { role: 'Night baker', activity: 'testing a sesame bun', traits: ['warm', 'precise'], goals: ['feed a whole block', 'perfect the crust'], bio: 'Will trade a still-warm sesame bun for a good local story.', spriteIndex: 2 },
  { role: 'Garden steward', activity: 'watering seedlings', traits: ['grounded', 'protective'], goals: ['keep the pollinators happy', 'save a rare seed'], bio: 'Keeps the city gardens blooming through every season of fog.', spriteIndex: 3 },
  { role: 'Record collector', activity: 'digging through records', traits: ['nostalgic', 'curious'], goals: ['find a lost pressing', 'share a perfect side B'], bio: 'Has a record for every kind of fog and a story for every record.', spriteIndex: 4 },
  { role: 'Muralist', activity: 'mixing paint', traits: ['bold', 'community-minded'], goals: ['brighten a blank wall', 'make room for a new voice'], bio: 'Paints bright portals into the places the city keeps in its memory.', spriteIndex: 5 },
  { role: 'Ferry mechanic', activity: 'checking the ferry bell', traits: ['steady', 'helpful'], goals: ['keep the boats moving', 'hear every gull by name'], bio: 'Keeps the little boats moving and knows every gull by its call.', spriteIndex: 6 },
  { role: 'Taqueria cook', activity: 'balancing a salsa', traits: ['quick-witted', 'social'], goals: ['feed the night shift', 'invent a better salsa'], bio: 'Runs a late kitchen where every salsa has its own weather report.', spriteIndex: 7 },
  { role: 'Fog photographer', activity: 'framing a blue hour', traits: ['quiet', 'romantic'], goals: ['catch the clean horizon', 'make a stranger smile'], bio: 'Chases the exact blue hour when the city becomes a soft sketch.', spriteIndex: 8 },
  { role: 'Park musician', activity: 'tuning an instrument', traits: ['playful', 'brave'], goals: ['stop a passerby', 'write a song about home'], bio: 'Plays songs that make strangers stop, listen, and miss their bus.', spriteIndex: 9 },
  { role: 'Bookstore owner', activity: 'recommending a paperback', traits: ['thoughtful', 'wry'], goals: ['match a reader to a book', 'keep the lights on'], bio: 'Recommends a perfect paperback for fog, sunshine, or a long wait.', spriteIndex: 10 },
  { role: 'Community organizer', activity: 'pinning a neighborhood note', traits: ['resourceful', 'welcoming'], goals: ['connect two neighbors', 'make a block party happen'], bio: 'Turns bulletin boards into dinner plans, block parties, and new friendships.', spriteIndex: 11 },
];

const featuredResidents: Resident[] = [
  { id: 'maya', name: 'Maya Chen', role: 'Ceramicist', neighborhood: 'Mission', bio: residentTemplates[0].bio, status: 'online', accent: '#f08a5d', position: { left: 57, top: 58 }, spriteIndex: 0, routine: makeRoutine(4, 'shaping clay'), activity: 'shaping clay', mood: 'curious', energy: 82, destinationId: 'mission-mural', traits: ['observant', 'patient'], goals: ['finish a blue house', 'find a quieter kiln'] },
  { id: 'rio', name: 'Rio Alvarez', role: 'Bike courier', neighborhood: 'SOMA', bio: residentTemplates[1].bio, status: 'wandering', accent: '#38b7a5', position: { left: 46, top: 45 }, spriteIndex: 1, routine: makeRoutine(1, 'delivering a package'), activity: 'delivering a package', mood: 'restless', energy: 74, destinationId: 'cable-car', traits: ['restless', 'generous'], goals: ['take the long way home', 'learn one new block'] },
  { id: 'jun', name: 'Jun Park', role: 'Night baker', neighborhood: 'Richmond', bio: residentTemplates[2].bio, status: 'resting', accent: '#e6b84f', position: { left: 80, top: 44 }, spriteIndex: 2, routine: makeRoutine(0, 'testing a sesame bun'), activity: 'testing a sesame bun', mood: 'focused', energy: 68, destinationId: 'golden-gate', traits: ['warm', 'precise'], goals: ['feed a whole block', 'perfect the crust'] },
  { id: 'tasha', name: 'Tasha Brooks', role: 'Garden steward', neighborhood: 'Alamo Square', bio: residentTemplates[3].bio, status: 'online', accent: '#c771d3', position: { left: 28, top: 56 }, spriteIndex: 3, routine: makeRoutine(3, 'watering seedlings'), activity: 'watering seedlings', mood: 'grounded', energy: 88, destinationId: 'painted-ladies', traits: ['grounded', 'protective'], goals: ['keep the pollinators happy', 'save a rare seed'] },
  { id: 'omar', name: 'Omar Haddad', role: 'Record collector', neighborhood: 'Nob Hill', bio: residentTemplates[4].bio, status: 'wandering', accent: '#7c8ee8', position: { left: 62, top: 36 }, spriteIndex: 4, routine: makeRoutine(1, 'digging through records'), activity: 'digging through records', mood: 'nostalgic', energy: 71, destinationId: 'cable-car', traits: ['nostalgic', 'curious'], goals: ['find a lost pressing', 'share a perfect side B'] },
  { id: 'lena', name: 'Lena Ortiz', role: 'Muralist', neighborhood: 'Mission', bio: residentTemplates[5].bio, status: 'online', accent: '#ed6b8e', position: { left: 76, top: 79 }, spriteIndex: 5, routine: makeRoutine(4, 'mixing paint'), activity: 'mixing paint', mood: 'bold', energy: 84, destinationId: 'mission-mural', traits: ['bold', 'community-minded'], goals: ['brighten a blank wall', 'make room for a new voice'] },
  { id: 'mateo', name: 'Mateo Silva', role: 'Ferry mechanic', neighborhood: 'Embarcadero', bio: residentTemplates[6].bio, status: 'online', accent: '#ef6d43', position: { left: 92, top: 54 }, spriteIndex: 6, routine: makeRoutine(5, 'checking the ferry bell'), activity: 'checking the ferry bell', mood: 'steady', energy: 79, destinationId: 'fog-pier', traits: ['steady', 'helpful'], goals: ['keep the boats moving', 'hear every gull by name'] },
  { id: 'sofia', name: 'Sofia Rahman', role: 'Taqueria cook', neighborhood: 'Mission', bio: residentTemplates[7].bio, status: 'wandering', accent: '#d36b5c', position: { left: 86, top: 76 }, spriteIndex: 7, routine: makeRoutine(4, 'balancing a salsa'), activity: 'balancing a salsa', mood: 'social', energy: 77, destinationId: 'mission-mural', traits: ['quick-witted', 'social'], goals: ['feed the night shift', 'invent a better salsa'] },
  { id: 'avery', name: 'Avery Price', role: 'Fog photographer', neighborhood: 'Outer Sunset', bio: residentTemplates[8].bio, status: 'wandering', accent: '#5e9dc7', position: { left: 22, top: 35 }, spriteIndex: 8, routine: makeRoutine(0, 'framing a blue hour'), activity: 'framing a blue hour', mood: 'romantic', energy: 73, destinationId: 'golden-gate', traits: ['quiet', 'romantic'], goals: ['catch the clean horizon', 'make a stranger smile'] },
  { id: 'kai', name: 'Kai Thompson', role: 'Park musician', neighborhood: 'Golden Gate Park', bio: residentTemplates[9].bio, status: 'online', accent: '#d79a4f', position: { left: 18, top: 77 }, spriteIndex: 9, routine: makeRoutine(0, 'tuning an instrument'), activity: 'tuning an instrument', mood: 'playful', energy: 91, destinationId: 'golden-gate', traits: ['playful', 'brave'], goals: ['stop a passerby', 'write a song about home'] },
  { id: 'priya', name: 'Priya Nair', role: 'Bookstore owner', neighborhood: 'North Beach', bio: residentTemplates[10].bio, status: 'resting', accent: '#e2b344', position: { left: 49, top: 82 }, spriteIndex: 10, routine: makeRoutine(2, 'recommending a paperback'), activity: 'recommending a paperback', mood: 'thoughtful', energy: 66, destinationId: 'coit-tower', traits: ['thoughtful', 'wry'], goals: ['match a reader to a book', 'keep the lights on'] },
  { id: 'andre', name: 'Andre Williams', role: 'Community organizer', neighborhood: 'Western Addition', bio: residentTemplates[11].bio, status: 'online', accent: '#738ed1', position: { left: 61, top: 24 }, spriteIndex: 11, routine: makeRoutine(2, 'pinning a neighborhood note'), activity: 'pinning a neighborhood note', mood: 'welcoming', energy: 86, destinationId: 'coit-tower', traits: ['resourceful', 'welcoming'], goals: ['connect two neighbors', 'make a block party happen'] },
];

const extraFirstNames = ['Aaliyah', 'Ben', 'Camila', 'Diego', 'Elena', 'Farah', 'Gabe', 'Hana', 'Isaac', 'Jules', 'Kiran', 'Leah', 'Marco', 'Nadia', 'Noah', 'Olive', 'Parker', 'Quinn', 'Rina', 'Samir', 'Teo', 'Uma', 'Val', 'Wren', 'Xavier', 'Yara', 'Zane', 'Amara', 'Bo', 'Cleo', 'Darius', 'Eli', 'Freya', 'Gia', 'Hugo', 'Inez', 'Jamal', 'Kelsey', 'Luis', 'Mei', 'Nico', 'Opal', 'Rafael', 'Sana'];
const extraLastNames = ['Adams', 'Bautista', 'Carter', 'Davis', 'Ellis', 'Flores', 'Garcia', 'Green', 'Hernandez', 'Ibrahim', 'Jackson', 'Kim', 'Lewis', 'Martin', 'Nguyen', 'Owens', 'Patel', 'Reyes', 'Rivera', 'Singh', 'Taylor', 'Vega', 'Walker', 'Xu', 'Young', 'Zamora'];

function makeExtraResidents(): Resident[] {
  return Array.from({ length: 88 }, (_, index) => {
    const template = residentTemplates[(index + 3) % residentTemplates.length];
    const firstName = extraFirstNames[index % extraFirstNames.length];
    const lastName = extraLastNames[Math.floor(index / extraFirstNames.length) % extraLastNames.length];
    const place = places[(index + 2) % places.length];
    const leftWobble = ((index * 13) % 19) - 9;
    const topWobble = ((index * 7) % 17) - 8;
    return {
      id: `neighbor-${String(index + 1).padStart(3, '0')}`,
      name: `${firstName} ${lastName}`,
      role: template.role,
      neighborhood: place.neighborhood,
      bio: template.bio,
      status: index % 5 === 0 ? 'resting' : index % 3 === 0 ? 'wandering' : 'online',
      accent: accentPalette[(index + 3) % accentPalette.length],
      position: { left: clamp(place.position.left + leftWobble, 5, 95), top: clamp(place.position.top + topWobble, 8, 92) },
      spriteIndex: template.spriteIndex,
      routine: makeRoutine((index + 2) % places.length, template.activity),
      activity: template.activity,
      mood: template.traits[index % template.traits.length],
      energy: 58 + ((index * 11) % 38),
      destinationId: place.id,
      traits: template.traits,
      goals: template.goals,
    };
  });
}

const residents: Resident[] = [...featuredResidents, ...makeExtraResidents()];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hash(input: string) {
  let result = 0;
  for (let index = 0; index < input.length; index += 1) result = (result * 31 + input.charCodeAt(index)) >>> 0;
  return result;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function routineFor(resident: Resident, minuteOfDay: number) {
  return resident.routine.find((block) => minuteOfDay >= block.start && minuteOfDay < block.end) || resident.routine[0];
}

function nearestNode(point: Point) {
  return navNodes.reduce((best, node) => distance(point, node) < distance(point, best) ? node : best, navNodes[0]);
}

function seededResidents() {
  return residents.map((resident, index) => {
    const destination = places.find((place) => place.id === resident.destinationId) || places[index % places.length];
    const node = index < 12 ? nearestNode(destination.position) : navNodes[(index * 7) % navNodes.length];
    const offset = ((index % 5) - 2) * 0.38;
    return {
      ...resident,
      position: { left: node.left + offset, top: node.top + (index % 2 === 0 ? 0.55 : -0.55) },
      lastDecisionSource: 'routine' as const,
      lastDecisionAt: 0,
    };
  });
}

export function createDefaultState(): TownState {
  const now = Date.now();
  return {
    version: 5,
    visitorName: 'Dylan',
    visitorBio: 'Exploring San Francisco one neighborhood at a time.',
    visitorAccent: '#f6c453',
    visitorPosition: { left: 47, top: 55 },
    residents: seededResidents(),
    places,
    messages: [],
    events: [
      { id: 'event-starter-1', text: 'One hundred neighbors woke up under a layer of blue-gray fog.', kind: 'town', createdAt: now - 1000 * 60 * 12 },
      { id: 'event-starter-2', text: 'The first cable car bell set the town’s morning routes in motion.', kind: 'town', createdAt: now - 1000 * 60 * 28 },
    ],
    interactions: [],
    decisions: [],
    visitedPlaceIds: [],
    simulation: { tick: 0, minuteOfDay: 19 * 60 + 42, running: true, speed: 1, trackedResidentId: 'maya', lastPulseAt: 0, llmCoverage: 0, activeEncounters: 0 },
  };
}

function normalizeState(value: Partial<TownState>): TownState {
  const fresh = createDefaultState();
  const hasCurrentSimulationMemory = value.version === 5;
  const storedResidents = Array.isArray(value.residents) ? value.residents : [];
  const storedSimulation = (value.simulation || {}) as Partial<SimulationState>;
  const storedMessages = Array.isArray(value.messages) ? value.messages : [];
  return {
    ...fresh,
    visitorName: value.visitorName || fresh.visitorName,
    visitorBio: value.visitorBio || fresh.visitorBio,
    visitorAccent: value.visitorAccent || fresh.visitorAccent,
    visitorPosition: value.visitorPosition && isWalkable(value.visitorPosition) ? value.visitorPosition : fresh.visitorPosition,
    residents: fresh.residents.map((resident) => {
      const stored = storedResidents.find((candidate) => candidate.id === resident.id);
      return {
        ...resident,
        ...stored,
        position: stored?.position && isWalkable(stored.position) ? stored.position : resident.position,
        spriteIndex: resident.spriteIndex,
        routine: resident.routine,
        traits: resident.traits,
        goals: resident.goals,
        lastDecisionSource: hasCurrentSimulationMemory && stored?.lastDecisionSource === 'llm' ? 'llm' : 'routine',
        lastDecisionAt: hasCurrentSimulationMemory ? stored?.lastDecisionAt || 0 : 0,
      };
    }),
    messages: storedMessages.filter((message) => !message.id.startsWith('msg-starter')),
    events: Array.isArray(value.events) && value.events.length > 0 ? value.events : fresh.events,
    interactions: hasCurrentSimulationMemory && Array.isArray(value.interactions) ? value.interactions : fresh.interactions,
    decisions: hasCurrentSimulationMemory && Array.isArray(value.decisions) ? value.decisions : fresh.decisions,
    visitedPlaceIds: Array.isArray(value.visitedPlaceIds) ? value.visitedPlaceIds : fresh.visitedPlaceIds,
    simulation: {
      ...fresh.simulation,
      ...storedSimulation,
      running: true,
      speed: storedSimulation.speed === 0.5 || storedSimulation.speed === 2 ? storedSimulation.speed : 1,
    },
  };
}

function readState(): TownState {
  if (typeof window === 'undefined') return createDefaultState();
  try {
    const raw = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS].map((key) => window.localStorage.getItem(key)).find(Boolean);
    if (!raw) return createDefaultState();
    return normalizeState(JSON.parse(raw) as Partial<TownState>);
  } catch {
    return createDefaultState();
  }
}

let state = readState();
const serverSnapshot = createDefaultState();
let pulseInFlight = false;

function persist(nextState: TownState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // The simulation remains usable if browser storage is unavailable.
  }
}

export function getTownState() {
  return state;
}

export function subscribeToTownState(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTownState() {
  return useSyncExternalStore(subscribeToTownState, getTownState, () => serverSnapshot);
}

export function updateTownState(updater: (draft: TownState) => TownState | void) {
  const draft = JSON.parse(JSON.stringify(state)) as TownState;
  const nextState = updater(draft) ?? draft;
  state = nextState;
  persist(state);
  listeners.forEach((listener) => listener());
}

export function visitPlace(place: TownPlace) {
  updateTownState((draft) => {
    if (draft.visitedPlaceIds.includes(place.id)) return;
    draft.visitedPlaceIds.push(place.id);
    draft.events.unshift({ id: makeId('event'), text: `${draft.visitorName} checked in at ${place.name}.`, kind: 'visit', createdAt: Date.now() });
    draft.events = draft.events.slice(0, 80);
  });
}

const fallbackReplies = [
  'That sounds like a perfect fog-hour plan. I know a quieter route there.',
  'I am in. San Francisco is best when the plan leaves room for a surprise.',
  'Meet you there! Bring a jacket; the bay breeze has opinions today.',
  'That reminds me of a little corner near the water. I will tell you about it.',
];

function appendResidentMessage(resident: Resident, text: string, source: TownMessage['source'] = 'llm') {
  updateTownState((draft) => {
    draft.messages.push({ id: makeId('message'), residentId: resident.id, author: 'resident', authorName: resident.name, text, createdAt: Date.now(), source });
    draft.messages = draft.messages.slice(-160);
    draft.events.unshift({ id: makeId('event'), text: `${resident.name} replied to ${draft.visitorName}.`, kind: 'chat', createdAt: Date.now() });
    draft.events = draft.events.slice(0, 80);
  });
}

export async function sendChatMessage(resident: Resident, text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  updateTownState((draft) => {
    draft.messages.push({ id: makeId('message'), residentId: resident.id, author: 'you', authorName: draft.visitorName, text: trimmed, createdAt: Date.now(), source: 'user' });
    draft.events.unshift({ id: makeId('event'), text: `${draft.visitorName} sent a note to ${resident.name}.`, kind: 'chat', createdAt: Date.now() });
    draft.events = draft.events.slice(0, 80);
  });

  const history = getTownState().messages.filter((message) => message.residentId === resident.id).slice(-10);
  try {
    const response = await fetch('/api/town/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ resident, message: trimmed, history, places: getTownState().places }),
    });
    if (!response.ok) throw new Error(`LLM request failed: ${response.status}`);
    const data = (await response.json()) as { reply?: string; mode?: TownMessage['source'] };
    appendResidentMessage(resident, data.reply?.trim() || fallbackReplies[trimmed.length % fallbackReplies.length], data.mode === 'llm' ? 'llm' : 'fallback');
  } catch {
    appendResidentMessage(resident, fallbackReplies[trimmed.length % fallbackReplies.length], 'fallback');
  }
}

export function setSimulationRunning(running: boolean) {
  updateTownState((draft) => { draft.simulation.running = running; });
}

export function setSimulationSpeed(speed: SimulationState['speed']) {
  updateTownState((draft) => { draft.simulation.speed = speed; });
}

export function setTrackedResident(residentId: string) {
  updateTownState((draft) => { draft.simulation.trackedResidentId = residentId; });
}

export function moveVisitor(dx: number, dy: number) {
  updateTownState((draft) => {
    const magnitude = Math.hypot(dx, dy) || 1;
    const step = 1.45;
    const current = draft.visitorPosition;
    const next = { left: current.left + (dx / magnitude) * step, top: current.top + (dy / magnitude) * step };
    if (isWalkable(next)) draft.visitorPosition = next;
    else {
      const horizontal = { left: next.left, top: current.top };
      const vertical = { left: current.left, top: next.top };
      if (isWalkable(horizontal)) draft.visitorPosition = horizontal;
      else if (isWalkable(vertical)) draft.visitorPosition = vertical;
    }
  });
}

function movementEvent(resident: Resident, place: TownPlace, minute: number) {
  const clock = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  return `${clock} · ${resident.name} is ${resident.activity} near ${place.name}.`;
}

function nextNodeTowards(startId: string, targetId: string) {
  if (startId === targetId) return navNodeById.get(startId)!;
  const queue: Array<{ id: string; first: string }> = navNodeById.get(startId)!.neighbors.map((id) => ({ id, first: id }));
  const visited = new Set([startId]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    if (current.id === targetId) return navNodeById.get(current.first)!;
    visited.add(current.id);
    navNodeById.get(current.id)!.neighbors.forEach((id) => queue.push({ id, first: current.first }));
  }
  return navNodeById.get(startId)!;
}

function moveAlongPaths(position: Point, destination: Point, speed: number) {
  const currentNode = nearestNode(position);
  const targetNode = nearestNode(destination);
  const waypoint = distance(position, currentNode) > 1.5 ? currentNode : nextNodeTowards(currentNode.id, targetNode.id);
  const target = currentNode.id === targetNode.id ? destination : waypoint;
  const gap = distance(position, target);
  if (gap <= speed) return { left: target.left, top: target.top };
  const next = { left: position.left + ((target.left - position.left) / gap) * speed, top: position.top + ((target.top - position.top) / gap) * speed };
  return isWalkable(next) ? next : { left: currentNode.left, top: currentNode.top };
}

type EncounterPayload = {
  id: string;
  participantIds: [string, string];
  locationId: string;
  locationName: string;
  residents: Array<Pick<Resident, 'id' | 'name' | 'role' | 'activity' | 'mood' | 'goals' | 'traits'>>;
};

function detectEncounters(current: TownState): EncounterPayload[] {
  const recentPairs = new Set(current.interactions.filter((interaction) => Date.now() - interaction.createdAt < 90_000).map((interaction) => [...interaction.participantIds].sort().join('|')));
  const encounters: EncounterPayload[] = [];
  for (let firstIndex = 0; firstIndex < current.residents.length && encounters.length < 8; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < current.residents.length && encounters.length < 8; secondIndex += 1) {
      const first = current.residents[firstIndex];
      const second = current.residents[secondIndex];
      const pairKey = [first.id, second.id].sort().join('|');
      if (recentPairs.has(pairKey) || distance(first.position, second.position) > 2.35) continue;
      const midpoint = { left: (first.position.left + second.position.left) / 2, top: (first.position.top + second.position.top) / 2 };
      const location = current.places.reduce((best, place) => distance(midpoint, place.position) < distance(midpoint, best.position) ? place : best, current.places[0]);
      encounters.push({
        id: `encounter-${current.simulation.tick}-${first.id}-${second.id}`,
        participantIds: [first.id, second.id],
        locationId: location.id,
        locationName: location.name,
        residents: [first, second].map(({ id, name, role, activity, mood, goals, traits }) => ({ id, name, role, activity, mood, goals, traits })),
      });
    }
  }
  return encounters;
}

export function advanceSimulation() {
  updateTownState((draft) => {
    const minutes = Math.max(4, Math.round(8 * draft.simulation.speed));
    const minuteOfDay = (draft.simulation.minuteOfDay + minutes) % 1440;
    const tick = draft.simulation.tick + 1;
    const placeById = new Map(draft.places.map((place) => [place.id, place]));
    const nextResidents = draft.residents.map((resident) => {
      const block = routineFor(resident, minuteOfDay);
      const hasFreshLlmPlan = resident.lastDecisionSource === 'llm' && Date.now() - (resident.lastDecisionAt || 0) < 150_000;
      const destinationId = hasFreshLlmPlan ? resident.destinationId : block.placeId;
      const destination = placeById.get(destinationId) || draft.places[0];
      const position = moveAlongPaths(resident.position, destination.position, 0.75 + draft.simulation.speed * 0.32);
      const energy = clamp(resident.energy + (resident.status === 'resting' ? 2 : -1), 35, 100);
      const status: Resident['status'] = energy < 48 ? 'resting' : hash(`${resident.id}-${tick}`) % 4 === 0 ? 'wandering' : 'online';
      return { ...resident, position, destinationId: destination.id, activity: hasFreshLlmPlan ? resident.activity : block.activity, energy, status, lastDecisionSource: hasFreshLlmPlan ? 'llm' as const : 'routine' as const };
    });
    draft.residents = nextResidents;
    draft.simulation.tick = tick;
    draft.simulation.minuteOfDay = minuteOfDay;
    draft.simulation.activeEncounters = detectEncounters(draft).length;
    if (tick % 4 === 0) {
      const resident = nextResidents[hash(String(tick)) % nextResidents.length];
      const place = placeById.get(resident.destinationId) || draft.places[0];
      draft.events.unshift({ id: makeId('event'), text: movementEvent(resident, place, minuteOfDay), kind: 'decision', createdAt: Date.now() });
      draft.events = draft.events.slice(0, 80);
    }
  });
}

type SimulationResponse = {
  event?: string;
  interactions?: Array<{ encounterId?: string; participants?: string[]; locationId?: string; summary?: string; dialogue?: string[] }>;
  decisions?: Array<{ residentId?: string; need?: string; options?: string[]; choice?: string; reason?: string; outcome?: string; destinationId?: string; activity?: string; mood?: string; confidence?: number }>;
  mode?: 'llm' | 'partial' | 'fallback';
  coverage?: number;
};

function chunksOf<T>(values: T[], size: number) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size));
}

async function postTown<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path} failed: ${response.status}`);
  return (await response.json()) as T;
}

function recordEncounterDialogues(encounters: ReturnType<typeof detectEncounters>, rawInteractions: NonNullable<SimulationResponse['interactions']>) {
  updateTownState((draft) => {
    const residentById = new Map(draft.residents.map((resident) => [resident.id, resident]));
    const placeById = new Map(draft.places.map((place) => [place.id, place]));
    const encounterById = new Map(encounters.map((encounter) => [encounter.id, encounter]));
    const interactions: TownInteraction[] = rawInteractions.slice(0, 8).flatMap((item) => {
      const encounter = encounterById.get(item.encounterId || '');
      const participants = (item.participants || []).map((id) => residentById.get(id)).filter(Boolean) as Resident[];
      const expectedPair = encounter ? [...encounter.participantIds].sort().join('|') : '';
      const actualPair = participants.map((resident) => resident.id).sort().join('|');
      const location = placeById.get(encounter?.locationId || item.locationId || '') || draft.places[0];
      if (!encounter || expectedPair !== actualPair || !item.summary?.trim() || (item.dialogue || []).length < 2) return [];
      return [{ id: makeId('interaction'), encounterId: encounter.id, participantIds: participants.map((resident) => resident.id), participantNames: participants.map((resident) => resident.name), locationId: location.id, locationName: location.name, summary: item.summary.trim(), dialogue: (item.dialogue || []).map((line) => line.trim()).filter(Boolean).slice(0, 8), createdAt: Date.now(), source: 'llm' }];
    });
    draft.interactions = [...interactions, ...draft.interactions].slice(0, 300);
    interactions.forEach((interaction) => draft.events.unshift({ id: makeId('event'), text: `${interaction.participantNames.join(' and ')} talked at ${interaction.locationName}.`, kind: 'interaction', createdAt: Date.now() }));
    draft.events = draft.events.slice(0, 80);
  });
}

export async function requestSimulationPulse() {
  if (pulseInFlight) return;
  pulseInFlight = true;
  try {
    const current = getTownState();
    const encounters = detectEncounters(current);
    const context = { minuteOfDay: current.simulation.minuteOfDay, places: current.places, recentInteractions: current.interactions.slice(0, 12) };
    const interactionByEncounter = new Map<string, NonNullable<SimulationResponse['interactions']>[number]>();
    for (const encounterBatch of chunksOf(encounters, 2)) {
      const response = await postTown<SimulationResponse>('/api/town/encounters', { ...context, encounters: encounterBatch }).catch(() => ({ interactions: [] }));
      (response.interactions || []).forEach((interaction) => {
        if (interaction.encounterId) interactionByEncounter.set(interaction.encounterId, interaction);
      });
    }
    const missingEncounters = encounters.filter((encounter) => !interactionByEncounter.has(encounter.id));
    for (const encounter of missingEncounters) {
      const response = await postTown<SimulationResponse>('/api/town/encounters', { ...context, encounters: [encounter] }).catch(() => ({ interactions: [] }));
      (response.interactions || []).forEach((interaction) => {
        if (interaction.encounterId) interactionByEncounter.set(interaction.encounterId, interaction);
      });
    }
    recordEncounterDialogues(encounters, [...interactionByEncounter.values()]);

    const decisionResults = await Promise.allSettled(
      chunksOf(current.residents, 10).map((residents) => postTown<SimulationResponse>('/api/town/decisions', { ...context, residents })),
    );
    const decisionsByResident = new Map<string, NonNullable<SimulationResponse['decisions']>[number]>();
    decisionResults.forEach((result) => {
      if (result.status !== 'fulfilled') return;
      (result.value.decisions || []).forEach((decision) => {
        if (decision.residentId) decisionsByResident.set(decision.residentId, decision);
      });
    });

    const missingResidents = current.residents.filter((resident) => !decisionsByResident.has(resident.id));
    if (missingResidents.length) {
      const retries = await Promise.allSettled(
        chunksOf(missingResidents, 5).map((residents) => postTown<SimulationResponse>('/api/town/decisions', { ...context, residents })),
      );
      retries.forEach((result) => {
        if (result.status !== 'fulfilled') return;
        (result.value.decisions || []).forEach((decision) => {
          if (decision.residentId) decisionsByResident.set(decision.residentId, decision);
        });
      });
    }
    const finalMissingResidents = current.residents.filter((resident) => !decisionsByResident.has(resident.id));
    for (const resident of finalMissingResidents) {
      for (let attempt = 0; attempt < 2 && !decisionsByResident.has(resident.id); attempt += 1) {
        const response = await postTown<SimulationResponse>('/api/town/decisions', { ...context, residents: [resident] }).catch(() => ({ decisions: [] }));
        (response.decisions || []).forEach((decision) => {
          if (decision.residentId) decisionsByResident.set(decision.residentId, decision);
        });
      }
    }

    const data: SimulationResponse = {
      decisions: [...decisionsByResident.values()],
      coverage: decisionsByResident.size,
    };
    updateTownState((draft) => {
      const residentById = new Map(draft.residents.map((resident) => [resident.id, resident]));
      const placeById = new Map(draft.places.map((place) => [place.id, place]));
      (data.decisions || []).slice(0, 100).forEach((item) => {
        const resident = item.residentId ? residentById.get(item.residentId) : undefined;
        const destination = item.destinationId ? placeById.get(item.destinationId) : undefined;
        if (!resident || !destination || !item.choice || !item.need || !item.activity) return;
        resident.destinationId = destination.id;
        resident.activity = item.activity.trim();
        resident.mood = item.mood?.trim() || resident.mood;
        resident.lastDecisionSource = 'llm';
        resident.lastDecisionAt = Date.now();
        draft.decisions.unshift({ id: makeId('decision'), residentId: resident.id, createdAt: Date.now(), need: item.need, options: item.options || [], choice: item.choice, reason: item.reason || 'retrieved memory and current context', outcome: item.outcome || 'the plan enters the memory stream', locationId: destination.id, source: 'llm', confidence: clamp(item.confidence ?? 0.75, 0, 1) });
      });
      if (data.event?.trim()) draft.events.unshift({ id: makeId('event'), text: data.event.trim(), kind: 'town', createdAt: Date.now() });
      draft.events = draft.events.slice(0, 80);
      draft.decisions = draft.decisions.slice(0, 600);
      draft.simulation.lastPulseAt = Date.now();
      draft.simulation.llmCoverage = Math.min(data.coverage || 0, draft.residents.length);
      draft.simulation.activeEncounters = encounters.length;
    });
  } catch {
    updateTownState((draft) => {
      draft.simulation.lastPulseAt = Date.now();
      draft.simulation.llmCoverage = 0;
    });
  } finally {
    pulseInFlight = false;
  }
}

export async function getLlmHealth() {
  try {
    const response = await fetch('/api/town/health');
    if (!response.ok) return { configured: false, model: '' };
    return (await response.json()) as { configured: boolean; model: string };
  } catch {
    return { configured: false, model: '' };
  }
}

export function saveVisitorProfile(name: string, bio: string, accent: string) {
  updateTownState((draft) => {
    draft.visitorName = name.trim() || 'Dylan';
    draft.visitorBio = bio.trim() || 'Exploring San Francisco one neighborhood at a time.';
    draft.visitorAccent = accent;
  });
}

export function resetTown() {
  state = createDefaultState();
  persist(state);
  listeners.forEach((listener) => listener());
}
