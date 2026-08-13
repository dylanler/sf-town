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

function fallbackPulse(body) {
  const residents = Array.isArray(body.residents) ? body.residents : [];
  const places = Array.isArray(body.places) ? body.places : [];
  const first = residents[0];
  const second = residents.find((resident) => resident.id !== first?.id) || residents[1];
  const place = places.find((candidate) => candidate.id === first?.destinationId) || places[0] || { id: 'town', name: 'the fog' };
  if (!first || !second) return { mode: 'fallback', event: 'The fog rearranged itself around the rooftops.' };
  return {
    mode: 'fallback',
    event: `${first.name} noticed ${second.name} moving through ${place.name}; a small plan is taking shape.`,
    interactions: [{ participants: [first.id, second.id], locationId: place.id, summary: `${first.name} and ${second.name} trade a quick hello while their routes overlap.`, dialogue: ['“See you around the neighborhood,” one says.'] }],
    decisions: [{ residentId: first.id, need: first.goals?.[0] || 'stay connected', options: [first.activity || 'keep moving', 'say hello', 'take the scenic route'], choice: 'say hello', reason: 'a nearby familiar face', outcome: `shared a moment at ${place.name}`, locationId: place.id }],
  };
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

async function simulation(body) {
  const residents = Array.isArray(body.residents) ? body.residents.slice(0, 12) : [];
  const places = Array.isArray(body.places) ? body.places : [];
  const population = residents.map((resident) => ({ id: resident.id, name: resident.name, role: resident.role, neighborhood: resident.neighborhood, activity: resident.activity, mood: resident.mood, goals: resident.goals, destinationId: resident.destinationId }));
  const prompt = `Advance one social pulse in a fictional 2D pixel-art San Francisco town. Return ONLY compact valid JSON: {"event":"one sentence under 140 chars","interactions":[{"participants":["id","id"],"locationId":"place id","summary":"one sentence","dialogue":["one short natural line"]}],"decisions":[{"residentId":"id","need":"short need","options":["three options"],"choice":"exact option","reason":"short reason","outcome":"short consequence","locationId":"place id"}]}. Include 1-2 neighbor interactions and 3-5 decisions. Only use supplied IDs. No markdown, no narration, no unsafe events. Time: ${body.minuteOfDay}. Places: ${JSON.stringify(places.map((place) => ({ id: place.id, name: place.name })))}. Residents: ${JSON.stringify(population)}. Recent memory: ${JSON.stringify(body.recentInteractions || [])}`;
  try {
    const parsed = parseJson(await callModel([{ role: 'system', content: 'Return only compact valid JSON. Do not include reasoning or markdown.' }, { role: 'user', content: prompt }], { temperature: 0.88, max_tokens: 1200, timeout_ms: 30_000, json: true }));
    return { ...parsed, mode: 'llm', model };
  } catch (error) {
    console.warn(`SF Town simulation fallback: ${error instanceof Error ? error.message : 'unknown error'}`);
    return fallbackPulse(body);
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
