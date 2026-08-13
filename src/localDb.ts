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
  source: 'llm' | 'fallback';
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
};

export type SimulationState = {
  tick: number;
  minuteOfDay: number;
  running: boolean;
  speed: 0.5 | 1 | 2;
  trackedResidentId: string;
  lastPulseAt: number;
};

export type TownState = {
  version: 3;
  visitorName: string;
  visitorBio: string;
  visitorAccent: string;
  residents: Resident[];
  places: TownPlace[];
  messages: TownMessage[];
  events: TownEvent[];
  interactions: TownInteraction[];
  decisions: DecisionStep[];
  visitedPlaceIds: string[];
  simulation: SimulationState;
};

const STORAGE_KEY = 'sf-town.local-db.v3';
const LEGACY_STORAGE_KEYS = ['sf-town.local-db.v2', 'sf-town.local-db.v1'];
const listeners = new Set<() => void>();

export const places: TownPlace[] = [
  {
    id: 'golden-gate', name: 'Golden Gate Overlook', neighborhood: 'Presidio', category: 'Landmark',
    description: 'A fog-softened overlook where the bridge turns orange at sunset.', position: { left: 16, top: 18 }, accent: '#f06b4f', sheetIndex: 0,
  },
  {
    id: 'cable-car', name: 'Powell Cable Car', neighborhood: 'Nob Hill', category: 'Transit',
    description: 'The bell rings twice before the car takes the next steep corner.', position: { left: 39, top: 32 }, accent: '#e7ad45', sheetIndex: 1,
  },
  {
    id: 'coit-tower', name: 'Coit Tower Steps', neighborhood: 'Telegraph Hill', category: 'Viewpoint',
    description: 'A hillside perch above the bay with a perfect view of passing ferries.', position: { left: 69, top: 17 }, accent: '#8da8b6', sheetIndex: 2,
  },
  {
    id: 'painted-ladies', name: 'Alamo Square Row', neighborhood: 'Alamo Square', category: 'Neighborhood',
    description: 'Colorful Victorian facades and a patch of grass made for lingering.', position: { left: 35, top: 70 }, accent: '#dd6f68', sheetIndex: 3,
  },
  {
    id: 'mission-mural', name: 'Balmy Alley Murals', neighborhood: 'Mission', category: 'Arts',
    description: 'A bright corridor of community murals, tacos, and late afternoon sun.', position: { left: 75, top: 65 }, accent: '#28b7ad', sheetIndex: 4,
  },
  {
    id: 'fog-pier', name: 'Ferry Building Pier', neighborhood: 'Embarcadero', category: 'Waterfront',
    description: 'Wooden boards, salty air, and a clear line toward the East Bay hills.', position: { left: 87, top: 30 }, accent: '#5da8cb', sheetIndex: 5,
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

export function createDefaultState(): TownState {
  const now = Date.now();
  return {
    version: 3,
    visitorName: 'Dylan',
    visitorBio: 'Exploring San Francisco one neighborhood at a time.',
    visitorAccent: '#f6c453',
    residents,
    places,
    messages: [],
    events: [
      { id: 'event-starter-1', text: 'One hundred neighbors woke up under a layer of blue-gray fog.', kind: 'town', createdAt: now - 1000 * 60 * 12 },
      { id: 'event-starter-2', text: 'The first cable car bell set the town’s morning routes in motion.', kind: 'town', createdAt: now - 1000 * 60 * 28 },
    ],
    interactions: [],
    decisions: [],
    visitedPlaceIds: [],
    simulation: { tick: 0, minuteOfDay: 19 * 60 + 42, running: true, speed: 1, trackedResidentId: 'maya', lastPulseAt: 0 },
  };
}

function normalizeState(value: Partial<TownState>): TownState {
  const fresh = createDefaultState();
  const storedResidents = Array.isArray(value.residents) ? value.residents : [];
  const storedSimulation = (value.simulation || {}) as Partial<SimulationState>;
  const storedMessages = Array.isArray(value.messages) ? value.messages : [];
  return {
    ...fresh,
    visitorName: value.visitorName || fresh.visitorName,
    visitorBio: value.visitorBio || fresh.visitorBio,
    visitorAccent: value.visitorAccent || fresh.visitorAccent,
    residents: fresh.residents.map((resident) => ({
      ...resident,
      ...(storedResidents.find((stored) => stored.id === resident.id) || {}),
      spriteIndex: resident.spriteIndex,
      routine: resident.routine,
      traits: resident.traits,
      goals: resident.goals,
    })),
    messages: storedMessages.filter((message) => !message.id.startsWith('msg-starter')),
    events: Array.isArray(value.events) && value.events.length > 0 ? value.events : fresh.events,
    interactions: Array.isArray(value.interactions) ? value.interactions : fresh.interactions,
    decisions: Array.isArray(value.decisions) ? value.decisions : fresh.decisions,
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

function movementEvent(resident: Resident, place: TownPlace, minute: number) {
  const clock = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  return `${clock} · ${resident.name} is ${resident.activity} near ${place.name}.`;
}

export function advanceSimulation() {
  updateTownState((draft) => {
    const minutes = Math.max(4, Math.round(8 * draft.simulation.speed));
    const minuteOfDay = (draft.simulation.minuteOfDay + minutes) % 1440;
    const tick = draft.simulation.tick + 1;
    const placeById = new Map(draft.places.map((place) => [place.id, place]));
    const nextResidents = draft.residents.map((resident) => {
      const block = routineFor(resident, minuteOfDay);
      const destination = placeById.get(block.placeId) || draft.places[0];
      const wobble = ((hash(`${resident.id}-${tick}`) % 9) - 4) * 0.22;
      const left = resident.position.left + (destination.position.left + wobble - resident.position.left) * 0.18;
      const top = resident.position.top + (destination.position.top - resident.position.top) * 0.18;
      const energy = clamp(resident.energy + (resident.status === 'resting' ? 2 : -1), 35, 100);
      const status: Resident['status'] = energy < 48 ? 'resting' : hash(`${resident.id}-${tick}`) % 4 === 0 ? 'wandering' : 'online';
      return { ...resident, position: { left, top }, destinationId: destination.id, activity: block.activity, energy, status };
    });
    const decisionSteps = nextResidents.slice(0, 100).map((resident) => {
      const place = placeById.get(resident.destinationId) || draft.places[0];
      const options = [resident.activity, 'take a scenic detour', 'look for a neighbor who needs help'];
      const choiceIndex = hash(`${resident.id}-${tick}`) % options.length;
      return {
        id: makeId('decision'), residentId: resident.id, createdAt: Date.now(), need: resident.goals[tick % resident.goals.length], options,
        choice: options[choiceIndex], reason: `${resident.mood} instincts and the shape of the fog`, outcome: `route continues toward ${place.name}`, locationId: place.id,
      };
    });
    draft.residents = nextResidents;
    draft.decisions = [...decisionSteps, ...draft.decisions].slice(0, 600);
    draft.simulation.tick = tick;
    draft.simulation.minuteOfDay = minuteOfDay;
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
  interactions?: Array<{ participants?: string[]; locationId?: string; summary?: string; dialogue?: string[] }>;
  decisions?: Array<{ residentId?: string; need?: string; options?: string[]; choice?: string; reason?: string; outcome?: string; locationId?: string }>;
  mode?: 'llm' | 'fallback';
};

function fallbackInteraction(current: TownState): TownInteraction | undefined {
  const groups = new Map<string, Resident[]>();
  current.residents.forEach((resident) => groups.set(resident.destinationId, [...(groups.get(resident.destinationId) || []), resident]));
  const group = [...groups.values()].find((members) => members.length > 1) || current.residents.slice(0, 2);
  if (group.length < 2) return undefined;
  const location = current.places.find((place) => place.id === group[0].destinationId) || current.places[0];
  return {
    id: makeId('interaction'), participantIds: group.slice(0, 2).map((resident) => resident.id), participantNames: group.slice(0, 2).map((resident) => resident.name), locationId: location.id, locationName: location.name,
    summary: `${group[0].name} and ${group[1].name} crossed paths while the fog shifted.`, dialogue: ['A small hello becomes a shared plan for later.'], createdAt: Date.now(), source: 'fallback',
  };
}

export async function requestSimulationPulse() {
  if (pulseInFlight) return;
  pulseInFlight = true;
  try {
    const current = getTownState();
    const sampledResidents = current.residents.filter((_, index) => index % 4 === 0).slice(0, 28);
    const response = await fetch('/api/town/simulation', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ minuteOfDay: current.simulation.minuteOfDay, residents: sampledResidents, places: current.places, recentInteractions: current.interactions.slice(0, 8) }),
    });
    if (!response.ok) throw new Error(`Simulation request failed: ${response.status}`);
    const data = (await response.json()) as SimulationResponse;
    updateTownState((draft) => {
      const residentById = new Map(draft.residents.map((resident) => [resident.id, resident]));
      const placeById = new Map(draft.places.map((place) => [place.id, place]));
      const interactions: TownInteraction[] = (data.interactions || []).slice(0, 4).flatMap((item) => {
        const participants = (item.participants || []).map((id) => residentById.get(id)).filter(Boolean) as Resident[];
        const location = placeById.get(item.locationId || '') || placeById.get(participants[0]?.destinationId || '') || draft.places[0];
        if (participants.length < 2 || !item.summary?.trim()) return [];
        return [{ id: makeId('interaction'), participantIds: participants.map((resident) => resident.id), participantNames: participants.map((resident) => resident.name), locationId: location.id, locationName: location.name, summary: item.summary.trim(), dialogue: (item.dialogue || []).map((line) => line.trim()).filter(Boolean).slice(0, 4), createdAt: Date.now(), source: data.mode === 'llm' ? 'llm' : 'fallback' }];
      });
      const fallback = interactions.length === 0 ? fallbackInteraction(draft) : undefined;
      draft.interactions = [...(fallback ? [fallback] : []), ...interactions, ...draft.interactions].slice(0, 300);
      interactions.forEach((interaction) => draft.events.unshift({ id: makeId('event'), text: `${interaction.participantNames.join(' and ')} talked at ${interaction.locationName}.`, kind: 'interaction', createdAt: Date.now() }));
      (data.decisions || []).slice(0, 30).forEach((item) => {
        if (!item.residentId || !residentById.has(item.residentId) || !item.choice || !item.need) return;
        draft.decisions.unshift({ id: makeId('decision'), residentId: item.residentId, createdAt: Date.now(), need: item.need, options: item.options || [], choice: item.choice, reason: item.reason || 'context and memory', outcome: item.outcome || 'the town keeps moving', locationId: item.locationId || residentById.get(item.residentId)!.destinationId });
      });
      if (data.event?.trim()) draft.events.unshift({ id: makeId('event'), text: data.event.trim(), kind: 'town', createdAt: Date.now() });
      draft.events = draft.events.slice(0, 80);
      draft.decisions = draft.decisions.slice(0, 600);
      draft.simulation.lastPulseAt = Date.now();
    });
  } catch {
    updateTownState((draft) => {
      const fallback = fallbackInteraction(draft);
      if (fallback) draft.interactions = [fallback, ...draft.interactions].slice(0, 300);
      draft.simulation.lastPulseAt = Date.now();
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
