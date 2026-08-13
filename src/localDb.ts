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

export type Resident = {
  id: string;
  name: string;
  role: string;
  neighborhood: string;
  bio: string;
  status: 'online' | 'wandering' | 'resting';
  accent: string;
  position: { left: number; top: number };
};

export type TownMessage = {
  id: string;
  residentId: string;
  author: 'you' | 'resident';
  authorName: string;
  text: string;
  createdAt: number;
};

export type TownEvent = {
  id: string;
  text: string;
  kind: 'visit' | 'chat' | 'town';
  createdAt: number;
};

export type TownState = {
  version: 1;
  visitorName: string;
  visitorBio: string;
  visitorAccent: string;
  residents: Resident[];
  places: TownPlace[];
  messages: TownMessage[];
  events: TownEvent[];
  visitedPlaceIds: string[];
};

const STORAGE_KEY = 'sf-town.local-db.v1';
const listeners = new Set<() => void>();

const places: TownPlace[] = [
  {
    id: 'golden-gate',
    name: 'Golden Gate Overlook',
    neighborhood: 'Presidio',
    category: 'Landmark',
    description: 'A fog-softened overlook where the bridge turns orange at sunset.',
    position: { left: 16, top: 18 },
    accent: '#f06b4f',
    sheetIndex: 0,
  },
  {
    id: 'cable-car',
    name: 'Powell Cable Car',
    neighborhood: 'Nob Hill',
    category: 'Transit',
    description: 'The bell rings twice before the car takes the next steep corner.',
    position: { left: 39, top: 32 },
    accent: '#e7ad45',
    sheetIndex: 1,
  },
  {
    id: 'coit-tower',
    name: 'Coit Tower Steps',
    neighborhood: 'Telegraph Hill',
    category: 'Viewpoint',
    description: 'A hillside perch above the bay with a perfect view of passing ferries.',
    position: { left: 69, top: 17 },
    accent: '#8da8b6',
    sheetIndex: 2,
  },
  {
    id: 'painted-ladies',
    name: 'Alamo Square Row',
    neighborhood: 'Alamo Square',
    category: 'Neighborhood',
    description: 'Colorful Victorian facades and a patch of grass made for lingering.',
    position: { left: 35, top: 70 },
    accent: '#dd6f68',
    sheetIndex: 3,
  },
  {
    id: 'mission-mural',
    name: 'Balmy Alley Murals',
    neighborhood: 'Mission',
    category: 'Arts',
    description: 'A bright corridor of community murals, tacos, and late afternoon sun.',
    position: { left: 75, top: 65 },
    accent: '#28b7ad',
    sheetIndex: 4,
  },
  {
    id: 'fog-pier',
    name: 'Ferry Building Pier',
    neighborhood: 'Embarcadero',
    category: 'Waterfront',
    description: 'Wooden boards, salty air, and a clear line toward the East Bay hills.',
    position: { left: 87, top: 30 },
    accent: '#5da8cb',
    sheetIndex: 5,
  },
];

const residents: Resident[] = [
  {
    id: 'maya',
    name: 'Maya Chen',
    role: 'Ceramicist',
    neighborhood: 'Mission',
    bio: 'Makes tiny blue houses and knows where the fog is thickest.',
    status: 'online',
    accent: '#f08a5d',
    position: { left: 57, top: 58 },
  },
  {
    id: 'rio',
    name: 'Rio Alvarez',
    role: 'Bike courier',
    neighborhood: 'SOMA',
    bio: 'Collects neighborhood sounds and takes the long way home.',
    status: 'wandering',
    accent: '#38b7a5',
    position: { left: 46, top: 45 },
  },
  {
    id: 'jun',
    name: 'Jun Park',
    role: 'Night baker',
    neighborhood: 'Richmond',
    bio: 'Will trade a still-warm sesame bun for a good local story.',
    status: 'resting',
    accent: '#e6b84f',
    position: { left: 80, top: 44 },
  },
  {
    id: 'tasha',
    name: 'Tasha Brooks',
    role: 'Garden steward',
    neighborhood: 'Alamo Square',
    bio: 'Keeps the city gardens blooming through every season of fog.',
    status: 'online',
    accent: '#c771d3',
    position: { left: 28, top: 56 },
  },
  {
    id: 'omar',
    name: 'Omar Haddad',
    role: 'Record collector',
    neighborhood: 'Nob Hill',
    bio: 'Has a record for every kind of fog and a story for every record.',
    status: 'wandering',
    accent: '#7c8ee8',
    position: { left: 62, top: 36 },
  },
  {
    id: 'lena',
    name: 'Lena Ortiz',
    role: 'Muralist',
    neighborhood: 'Mission',
    bio: 'Paints bright portals into the places the city keeps in its memory.',
    status: 'online',
    accent: '#ed6b8e',
    position: { left: 76, top: 79 },
  },
];

const starterMessages: TownMessage[] = [
  {
    id: 'msg-starter-1',
    residentId: 'maya',
    author: 'resident',
    authorName: 'Maya Chen',
    text: 'The fog is lifting over the bridge. Meet me by the overlook?',
    createdAt: Date.now() - 1000 * 60 * 8,
  },
  {
    id: 'msg-starter-2',
    residentId: 'rio',
    author: 'resident',
    authorName: 'Rio Alvarez',
    text: 'I just found a mural you have to see. It is glowing in this light.',
    createdAt: Date.now() - 1000 * 60 * 21,
  },
  {
    id: 'msg-starter-3',
    residentId: 'jun',
    author: 'resident',
    authorName: 'Jun Park',
    text: 'Fresh sesame buns are out. The good kind of neighborhood emergency.',
    createdAt: Date.now() - 1000 * 60 * 37,
  },
];

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultState(): TownState {
  const now = Date.now();
  return {
    version: 1,
    visitorName: 'Dylan',
    visitorBio: 'Exploring San Francisco one neighborhood at a time.',
    visitorAccent: '#f6c453',
    residents,
    places,
    messages: starterMessages,
    events: [
      {
        id: 'event-starter-1',
        text: 'The town woke up under a layer of blue-gray fog.',
        kind: 'town',
        createdAt: now - 1000 * 60 * 12,
      },
      {
        id: 'event-starter-2',
        text: 'Maya pinned the Golden Gate Overlook to the afternoon route.',
        kind: 'visit',
        createdAt: now - 1000 * 60 * 28,
      },
      {
        id: 'event-starter-3',
        text: 'Rio and Lena compared Mission mural palettes.',
        kind: 'chat',
        createdAt: now - 1000 * 60 * 46,
      },
    ],
    visitedPlaceIds: [],
  };
}

function readState(): TownState {
  if (typeof window === 'undefined') return createDefaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as TownState;
    if (parsed.version !== 1 || !Array.isArray(parsed.residents) || !Array.isArray(parsed.places)) {
      return createDefaultState();
    }
    return parsed;
  } catch {
    return createDefaultState();
  }
}

let state = readState();
const serverSnapshot = createDefaultState();

function persist(nextState: TownState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // The app remains usable in private browsing or when storage is disabled.
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
    draft.events.unshift({
      id: makeId('event'),
      text: `${draft.visitorName} checked in at ${place.name}.`,
      kind: 'visit',
      createdAt: Date.now(),
    });
    draft.events = draft.events.slice(0, 20);
  });
}

const replies = [
  'That sounds like a perfect fog-hour plan. I know a quieter route there.',
  'I am in. San Francisco is best when the plan leaves room for a surprise.',
  'Meet you there! Bring a jacket; the bay breeze has opinions today.',
  'That reminds me of a little corner near the water. I will tell you about it.',
];

export function sendChatMessage(resident: Resident, text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const reply = replies[trimmed.length % replies.length];
  updateTownState((draft) => {
    draft.messages.push({
      id: makeId('message'),
      residentId: resident.id,
      author: 'you',
      authorName: draft.visitorName,
      text: trimmed,
      createdAt: Date.now(),
    });
    draft.events.unshift({
      id: makeId('event'),
      text: `${draft.visitorName} sent a note to ${resident.name}.`,
      kind: 'chat',
      createdAt: Date.now(),
    });
    draft.events = draft.events.slice(0, 20);
  });

  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      updateTownState((draft) => {
        draft.messages.push({
          id: makeId('message'),
          residentId: resident.id,
          author: 'resident',
          authorName: resident.name,
          text: reply,
          createdAt: Date.now(),
        });
        draft.messages = draft.messages.slice(-40);
      });
    }, 650);
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
