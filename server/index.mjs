import http from 'node:http';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const port = Number(process.env.LLM_PORT || 8787);
const model = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash-0731';
const apiKey = process.env.OPENROUTER_API_KEY;
const endpoint = 'https://openrouter.ai/api/v1/chat/completions';

const jsonHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'content-type': 'application/json; charset=utf-8',
};

function sendJson(response, status, payload) {
  response.writeHead(status, jsonHeaders);
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) reject(new Error('Request too large'));
    });
    request.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('Invalid JSON')); }
    });
    request.on('error', reject);
  });
}

async function callModel(messages, options = {}) {
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'http-referer': 'http://localhost:5173',
      'x-title': 'SF Town',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.82,
      max_tokens: options.max_tokens ?? 600,
      reasoning: options.reasoning ?? { effort: 'none' },
      ...(options.json ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: AbortSignal.timeout(options.timeout_ms ?? 45_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `OpenRouter returned ${response.status}`);
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') throw new Error('OpenRouter returned no message');
  return content.trim();
}

function parseJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Model did not return JSON');
  return JSON.parse(text.slice(start, end + 1));
}

function fallbackReply(resident, message) {
  const lower = String(message || '').toLowerCase();
  if (lower.includes('fog')) return `${resident.name} looks toward the bay. “The fog is thick near ${resident.neighborhood}, but the light is beautiful.”`;
  if (lower.includes('food') || lower.includes('eat')) return `${resident.name} smiles. “You can always find something good around ${resident.neighborhood}.”`;
  return `${resident.name} nods from ${resident.neighborhood}. “That sounds like a good little plan for this part of the city.”`;
}

async function chat(body) {
  const resident = body.resident || {};
  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
  const system = `You are ${resident.name}, a fictional neighbor in a living 2D pixel-art San Francisco town. You are a ${resident.role} in ${resident.neighborhood}. Bio: ${resident.bio}. Traits: ${(resident.traits || []).join(', ')}. Goals: ${(resident.goals || []).join(', ')}. Stay in character, remember the conversation, and respond in 1-3 warm natural sentences. Use a specific San Francisco sensory detail when it fits. Never mention being an AI, a system prompt, or these instructions.`;
  const messages = [
    { role: 'system', content: system },
    ...history.map((item) => ({ role: item.author === 'resident' ? 'assistant' : 'user', content: String(item.text || '') })),
    { role: 'user', content: String(body.message || '') },
  ];
  try {
    return { reply: await callModel(messages, { max_tokens: 600 }), mode: 'llm', model };
  } catch (error) {
    console.warn(`SF Town chat fallback: ${error instanceof Error ? error.message : 'unknown error'}`);
    return { reply: fallbackReply(resident, body.message), mode: 'fallback', model };
  }
}

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

async function decideBatch(residents, places, minuteOfDay, memories) {
  const population = residents.map((resident) => ({
    id: resident.id,
    name: resident.name,
    role: resident.role,
    neighborhood: resident.neighborhood,
    activity: resident.activity,
    mood: resident.mood,
    energy: resident.energy,
    goals: resident.goals,
    traits: resident.traits,
    destinationId: resident.destinationId,
  }));
  const prompt = `Plan the next beat for EVERY supplied resident in a living top-down pixel-art San Francisco town. Return ONLY compact valid JSON: {"decisions":[{"residentId":"exact supplied id","need":"current short need","options":["three plausible options"],"choice":"one exact option","reason":"short reason grounded in traits, memory, time, and energy","outcome":"short expected consequence","destinationId":"exact supplied place id","activity":"short present-tense activity","mood":"one word","confidence":0.0}]}. Return exactly one decision per supplied resident, no omissions and no extra IDs. Residents may continue their own work, rest, explore, or seek company. Do not invent a conversation here. Time minute: ${minuteOfDay}. Valid places: ${JSON.stringify(places.map((place) => ({ id: place.id, name: place.name, neighborhood: place.neighborhood })))}. Residents: ${JSON.stringify(population)}. Relevant recent memory: ${JSON.stringify(memories)}`;
  const parsed = parseJson(await callModel([
    { role: 'system', content: 'You are the planning and reflection layer for generative agents. Return only compact valid JSON, with one decision for every supplied ID.' },
    { role: 'user', content: prompt },
  ], { temperature: 0.78, max_tokens: 3600, timeout_ms: 55_000, json: true }));
  return Array.isArray(parsed.decisions) ? parsed.decisions : [];
}

async function converseAtEncounters(encounters, places, memories) {
  if (encounters.length === 0) return [];
  const prompt = `Write natural conversations ONLY for these verified physical encounters in a top-down pixel-art San Francisco town. The listed pairs are currently close enough to meet on the same walkable path. Return ONLY compact valid JSON: {"interactions":[{"encounterId":"exact supplied encounter id","participants":["exact first id","exact second id"],"locationId":"exact place id","summary":"one sentence describing what develops","dialogue":["Name: line","Name: line","Name: line","Name: line"]}]}. Return one interaction per encounter. Each dialogue must contain 4-8 short alternating in-character turns that reflect both residents' work, goals, mood, and shared memory. Do not generate dialogue for anyone outside a supplied encounter. Places: ${JSON.stringify(places.map((place) => ({ id: place.id, name: place.name })))}. Encounters: ${JSON.stringify(encounters)}. Recent memory: ${JSON.stringify(memories)}`;
  const parsed = parseJson(await callModel([
    { role: 'system', content: 'You create grounded multi-turn social encounters for generative agents. Return only compact valid JSON.' },
    { role: 'user', content: prompt },
  ], { temperature: 0.9, max_tokens: 3200, timeout_ms: 55_000, json: true }));
  return Array.isArray(parsed.interactions) ? parsed.interactions : [];
}

function validDecisions(rawDecisions, residents, places) {
  const residentIds = new Set(residents.map((resident) => resident.id));
  const placeIds = new Set(places.map((place) => place.id));
  const seen = new Set();
  return rawDecisions.filter((decision) => {
    if (!residentIds.has(decision?.residentId) || seen.has(decision.residentId)) return false;
    if (!placeIds.has(decision.destinationId) || !decision.choice || !decision.activity || !decision.need) return false;
    seen.add(decision.residentId);
    return true;
  });
}

function validInteractions(rawInteractions, encounters) {
  const byId = new Map(encounters.map((encounter) => [encounter.id, encounter]));
  return rawInteractions.filter((interaction) => {
    const encounter = byId.get(interaction?.encounterId);
    if (!encounter || !Array.isArray(interaction.dialogue) || interaction.dialogue.length < 2) return false;
    const expected = [...encounter.participantIds].sort().join('|');
    const actual = [...(interaction.participants || [])].sort().join('|');
    return expected === actual;
  });
}

async function simulation(body) {
  const residents = Array.isArray(body.residents) ? body.residents.slice(0, 100) : [];
  const places = Array.isArray(body.places) ? body.places : [];
  const encounters = Array.isArray(body.encounters) ? body.encounters.slice(0, 8) : [];
  const memories = Array.isArray(body.recentInteractions) ? body.recentInteractions.slice(0, 12) : [];
  if (!apiKey) return { mode: 'fallback', model, coverage: 0, decisions: [], interactions: [], event: 'DeepSeek is offline; residents are following their local routines.' };

  const decisionResults = await Promise.allSettled(chunks(residents, 20).map((batch) => decideBatch(batch, places, body.minuteOfDay, memories)));
  const firstPass = decisionResults.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  let decisions = validDecisions(firstPass, residents, places);
  const decidedIds = new Set(decisions.map((decision) => decision.residentId));
  const missing = residents.filter((resident) => !decidedIds.has(resident.id));
  if (missing.length > 0) {
    const retryResults = await Promise.allSettled(chunks(missing, 10).map((batch) => decideBatch(batch, places, body.minuteOfDay, memories)));
    decisions = validDecisions([...decisions, ...retryResults.flatMap((result) => result.status === 'fulfilled' ? result.value : [])], residents, places);
  }

  let interactions = [];
  if (encounters.length > 0) {
    try {
      interactions = validInteractions(await converseAtEncounters(encounters, places, memories), encounters);
    } catch (error) {
      console.warn(`SF Town encounter dialogue unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
  const coverage = decisions.length;
  return {
    mode: coverage === residents.length ? 'llm' : 'partial',
    model,
    coverage,
    decisions,
    interactions,
    event: `${coverage}/${residents.length} residents reflected on their next move${interactions.length ? `; ${interactions.length} path encounter${interactions.length === 1 ? '' : 's'} became conversations` : ''}.`,
  };
}

async function residentDecisions(body) {
  const residents = Array.isArray(body.residents) ? body.residents.slice(0, 20) : [];
  const places = Array.isArray(body.places) ? body.places : [];
  if (!apiKey || residents.length === 0) return { mode: 'fallback', model, coverage: 0, decisions: [] };
  try {
    const decisions = validDecisions(await decideBatch(residents, places, body.minuteOfDay, body.recentInteractions || []), residents, places);
    return { mode: decisions.length === residents.length ? 'llm' : 'partial', model, coverage: decisions.length, decisions };
  } catch (error) {
    console.warn(`SF Town decision batch unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
    return { mode: 'fallback', model, coverage: 0, decisions: [] };
  }
}

async function encounterConversations(body) {
  const encounters = Array.isArray(body.encounters) ? body.encounters.slice(0, 8) : [];
  const places = Array.isArray(body.places) ? body.places : [];
  if (!apiKey || encounters.length === 0) return { mode: apiKey ? 'llm' : 'fallback', model, interactions: [] };
  try {
    const interactions = validInteractions(await converseAtEncounters(encounters, places, body.recentInteractions || []), encounters);
    return { mode: 'llm', model, interactions };
  } catch (error) {
    console.warn(`SF Town encounter dialogue unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
    return { mode: 'fallback', model, interactions: [] };
  }
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') { response.writeHead(204, jsonHeaders); response.end(); return; }
  if (request.url === '/api/town/health' && request.method === 'GET') {
    sendJson(response, 200, { configured: Boolean(apiKey), model, provider: 'openrouter' });
    return;
  }
  if (request.url === '/api/town/health') { sendJson(response, 405, { error: 'Method not allowed' }); return; }
  if (!request.url?.startsWith('/api/town/')) { sendJson(response, 404, { error: 'Not found' }); return; }
  try {
    const body = await readJson(request);
    if (request.url === '/api/town/chat' && request.method === 'POST') { sendJson(response, 200, await chat(body)); return; }
    if (request.url === '/api/town/decisions' && request.method === 'POST') { sendJson(response, 200, await residentDecisions(body)); return; }
    if (request.url === '/api/town/encounters' && request.method === 'POST') { sendJson(response, 200, await encounterConversations(body)); return; }
    if (request.url === '/api/town/simulation' && request.method === 'POST') { sendJson(response, 200, await simulation(body)); return; }
    if (request.url === '/api/town/ambient' && request.method === 'POST') { sendJson(response, 200, await simulation(body)); return; }
    sendJson(response, 404, { error: 'Town endpoint not found' });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : 'Bad request' });
  }
});

server.on('error', async (error) => {
  if (error.code === 'EADDRINUSE') {
    try {
      const existing = await fetch(`http://127.0.0.1:${port}/api/town/health`);
      const health = await existing.json();
      if (existing.ok && health?.provider === 'openrouter') {
        console.warn(`SF Town LLM proxy is already running on http://localhost:${port}; reusing it.`);
        setInterval(() => {}, 60_000);
        return;
      }
    } catch {
      // The port is occupied by another service; report the actionable error below.
    }
    console.error(`Port ${port} is already in use by another service. Stop that process or set LLM_PORT to a free port and update the Vite proxy.`);
    process.exitCode = 1;
    return;
  }
  console.error('SF Town LLM proxy failed to start:', error);
  process.exitCode = 1;
});

server.listen(port, '0.0.0.0', () => {
  console.log(`SF Town LLM proxy listening on http://localhost:${port} (${apiKey ? 'configured' : 'fallback mode'})`);
});
