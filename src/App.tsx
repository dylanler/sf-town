import { FormEvent, type CSSProperties, useEffect, useMemo, useState } from 'react';
import topdownTownUrl from '../assets/generated/sf-town-topdown-v2.png';
import landmarkSheetUrl from '../assets/generated/sf-landmark-sheet.png';
import residentSheetUrl from '../assets/generated/sf-resident-sheet.png';
import {
  advanceSimulation,
  getLlmHealth,
  getTownState,
  moveVisitor,
  navEdges,
  navNodes,
  requestSimulationPulse,
  resetTown,
  saveVisitorProfile,
  sendChatMessage,
  setSimulationRunning,
  setSimulationSpeed,
  setTrackedResident,
  useTownState,
  visitPlace,
  type Resident,
  type TownEvent,
  type TownInteraction,
  type TownPlace,
} from './localDb';

const accentOptions = ['#f6c453', '#f08a5d', '#38b7a5', '#c771d3', '#7c8ee8'];
type LlmStatus = 'checking' | 'online' | 'fallback';
type LogKind = 'all' | 'interaction' | 'decision' | 'chat' | 'visit' | 'town';

export default function App() {
  const town = useTownState();
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>();
  const [selectedResidentId, setSelectedResidentId] = useState<string | undefined>('maya');
  const [profileOpen, setProfileOpen] = useState(false);
  const [view, setView] = useState<'map' | 'districts' | 'observe'>('map');
  const [llmStatus, setLlmStatus] = useState<LlmStatus>('checking');
  const [residentQuery, setResidentQuery] = useState('');
  const [residentFilter, setResidentFilter] = useState<'all' | Resident['status']>('all');
  const [showPaths, setShowPaths] = useState(false);

  useEffect(() => {
    let active = true;
    void getLlmHealth().then(({ configured }) => { if (active) setLlmStatus(configured ? 'online' : 'fallback'); });
    void requestSimulationPulse();
    const simulationTimer = window.setInterval(() => {
      if (getTownState().simulation.running) advanceSimulation();
    }, 1200);
    const socialTimer = window.setInterval(() => { void requestSimulationPulse(); }, 60_000);
    return () => {
      active = false;
      window.clearInterval(simulationTimer);
      window.clearInterval(socialTimer);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, button')) return;
      const direction = event.key === 'ArrowUp' || event.key.toLowerCase() === 'w' ? [0, -1] : event.key === 'ArrowDown' || event.key.toLowerCase() === 's' ? [0, 1] : event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a' ? [-1, 0] : event.key === 'ArrowRight' || event.key.toLowerCase() === 'd' ? [1, 0] : undefined;
      if (!direction) return;
      event.preventDefault();
      moveVisitor(direction[0], direction[1]);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const selectedPlace = town.places.find((place) => place.id === selectedPlaceId);
  const selectedResident = town.residents.find((resident) => resident.id === selectedResidentId);
  const conversationMessages = useMemo(
    () => town.messages.filter((message) => message.residentId === selectedResidentId).sort((a, b) => a.createdAt - b.createdAt).slice(-10),
    [town.messages, selectedResidentId],
  );
  const visibleResidents = useMemo(() => town.residents.filter((resident) => {
    const query = residentQuery.trim().toLowerCase();
    const matchesQuery = !query || `${resident.name} ${resident.role} ${resident.neighborhood}`.toLowerCase().includes(query);
    return matchesQuery && (residentFilter === 'all' || resident.status === residentFilter);
  }).slice(0, 24), [town.residents, residentFilter, residentQuery]);

  const selectPlace = (place: TownPlace) => { setSelectedPlaceId(place.id); setSelectedResidentId(undefined); };
  const selectResident = (resident: Resident) => { setSelectedResidentId(resident.id); setSelectedPlaceId(undefined); setTrackedResident(resident.id); };
  const resetLocalTown = () => { if (window.confirm('Reset this browser\'s local town data to the starter scene?')) resetTown(); };
  const jumpToObserve = () => { setView('observe'); window.setTimeout(() => document.getElementById('simulation-console')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="SF Town home"><span className="brand-mark" aria-hidden="true">SF</span><span><strong>SF TOWN</strong><small>LOCAL SIMULACRA</small></span></a>
        <div className="topbar-meta">
          <span className="sync-chip"><i /> LOCAL DB SYNCED</span>
          <span className={`llm-chip ${llmStatus}`}><i /> {llmStatus === 'online' ? 'DEEPSEEK LIVE' : llmStatus === 'checking' ? 'LLM CHECKING' : 'LOCAL FALLBACK'}</span>
          <button className="text-button" onClick={() => setProfileOpen(true)}>EDIT YOUR CARD</button>
          <button className="reset-button" onClick={resetLocalTown}>RESET</button>
        </div>
      </header>

      <main className="page-wrap">
        <section className="intro-row">
          <div>
            <p className="eyebrow"><span className="eyebrow-line" /> SAN FRANCISCO / {formatSimTime(town.simulation.minuteOfDay)} / FOG ROLLING IN</p>
            <h1>Every block has<br /><em>a little story.</em></h1>
            <p className="intro-copy">A living 2D pixel-art San Francisco where one hundred neighbors follow routines, choose what to do next, and meet in the fog. Their memories stay in this browser.</p>
          </div>
          <div className="town-stats" aria-label="Town statistics">
            <div><strong>{town.residents.length}</strong><span>RESIDENTS</span></div>
            <div><strong>{town.interactions.length}</strong><span>INTERACTIONS</span></div>
            <div><strong>{town.places.length}</strong><span>LANDMARKS</span></div>
            <div><strong>{town.visitedPlaceIds.length}</strong><span>CHECK-INS</span></div>
          </div>
        </section>

        <section className="workspace-grid">
          <div className="map-column">
            <div className="section-heading">
              <div><p className="section-kicker">TOWN MAP / LIVE VIEW</p><h2>{view === 'observe' ? 'Watch the town think' : 'Find your way around'}</h2></div>
              <div className="view-switcher" role="tablist" aria-label="Town view">
                <button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>MAP</button>
                <button className={view === 'districts' ? 'active' : ''} onClick={() => setView('districts')}>DISTRICTS</button>
                <button className={view === 'observe' ? 'active' : ''} onClick={jumpToObserve}>OBSERVE</button>
              </div>
            </div>
            {view === 'map' && <TownMap mapUrl={topdownTownUrl} places={town.places} residents={town.residents} selectedPlaceId={selectedPlaceId} selectedResidentId={selectedResidentId} visitorName={town.visitorName} visitorAccent={town.visitorAccent} visitorPosition={town.visitorPosition} showPaths={showPaths} onTogglePaths={() => setShowPaths((value) => !value)} onPlaceClick={selectPlace} onResidentClick={selectResident} />}
            {view === 'districts' && <DistrictGrid places={town.places} visitedPlaceIds={town.visitedPlaceIds} onPlaceClick={selectPlace} />}
            {view === 'observe' && <ObservePreview town={town} llmStatus={llmStatus} />}
            <div className="map-caption"><span><i className="legend-dot legend-you" /> YOU / ARROW KEYS OR WASD</span><span><i className="legend-dot legend-resident" /> 100 LLM RESIDENTS</span><span><i className="legend-pin" /> SOLID OBJECTS BLOCK MOVEMENT</span><span className="caption-note">{town.simulation.running ? 'SIMULATION RUNNING' : 'SIMULATION PAUSED'}</span></div>
          </div>

          <aside className="right-rail">
            {selectedPlace ? <PlaceCard place={selectedPlace} visited={town.visitedPlaceIds.includes(selectedPlace.id)} onClose={() => setSelectedPlaceId(undefined)} onVisit={() => visitPlace(selectedPlace)} /> : selectedResident ? <ResidentCard resident={selectedResident} onClose={() => setSelectedResidentId(undefined)} onTalk={() => document.getElementById('town-chat')?.scrollIntoView({ behavior: 'smooth' })} /> : <ProfileCard town={town} onEdit={() => setProfileOpen(true)} />}

            <section className="panel residents-panel">
              <div className="panel-heading"><div><p className="section-kicker">THE NEIGHBORS</p><h3>Residents online</h3></div><span className="online-count"><i /> {town.residents.filter((resident) => resident.status === 'online').length} LIVE</span></div>
              <div className="resident-tools"><input value={residentQuery} onChange={(event) => setResidentQuery(event.target.value)} placeholder="Search 100 neighbors..." aria-label="Search residents" /><select value={residentFilter} onChange={(event) => setResidentFilter(event.target.value as typeof residentFilter)} aria-label="Filter residents"><option value="all">ALL STATES</option><option value="online">ONLINE</option><option value="wandering">WANDERING</option><option value="resting">RESTING</option></select></div>
              <p className="list-count">SHOWING {visibleResidents.length} OF {town.residents.length} / SELECT A RESIDENT TO FOLLOW THEIR TRAJECTORY</p>
              <div className="resident-list">{visibleResidents.map((resident) => <button className={`resident-row ${selectedResidentId === resident.id ? 'selected' : ''}`} key={resident.id} onClick={() => selectResident(resident)}><PixelAvatar accent={resident.accent} spriteIndex={resident.spriteIndex} size="small" /><span className="resident-copy"><strong>{resident.name}</strong><small>{resident.role} · {resident.neighborhood}</small></span><span className={`status-dot ${resident.status}`} title={resident.status} /></button>)}</div>
            </section>
            {selectedResident && <ChatPanel resident={selectedResident} messages={conversationMessages} visitorName={town.visitorName} llmStatus={llmStatus} />}
            <ActivityPanel events={town.events} />
          </aside>
        </section>

        <SimulationConsole town={town} llmStatus={llmStatus} />

        <section className="landmark-strip"><div className="strip-heading"><div><p className="section-kicker">POSTCARD WALL</p><h2>Six ways to spend an afternoon</h2></div><button className="text-button" onClick={() => setView('districts')}>VIEW ALL DISTRICTS →</button></div><div className="postcard-grid">{town.places.map((place) => <button className="postcard" key={place.id} onClick={() => selectPlace(place)}><LandmarkTile place={place} /><span><strong>{place.name}</strong><small>{place.neighborhood}</small></span>{town.visitedPlaceIds.includes(place.id) && <b className="visited-ribbon">VISITED</b>}</button>)}</div></section>
        <footer className="footer-note"><span>SF TOWN / MADE FOR SLOW DIGITAL WALKS</span><span>DATA LIVES IN <code>localStorage</code> · NO CLOUD DATABASE REQUIRED</span></footer>
      </main>
      {profileOpen && <ProfileEditor town={town} onClose={() => setProfileOpen(false)} />}
    </div>
  );
}

function TownMap({ mapUrl, places, residents, selectedPlaceId, selectedResidentId, visitorName, visitorAccent, visitorPosition, showPaths, onTogglePaths, onPlaceClick, onResidentClick }: { mapUrl: string; places: TownPlace[]; residents: Resident[]; selectedPlaceId?: string; selectedResidentId?: string; visitorName: string; visitorAccent: string; visitorPosition: { left: number; top: number }; showPaths: boolean; onTogglePaths: () => void; onPlaceClick: (place: TownPlace) => void; onResidentClick: (resident: Resident) => void }) {
  return <div className="town-map-frame" tabIndex={0} aria-label="Playable San Francisco town map. Use arrow keys or WASD to move your character."><img className="town-panorama" src={mapUrl} alt="Top-down 2D pixel-art San Francisco town with streets, buildings, parks, cliffs, and waterfront" /><div className="map-vignette" />{showPaths && <svg className="walkability-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Walkable path overlay">{navEdges.map((edge) => { const start = navNodes.find((node) => node.id === edge.from)!; const end = navNodes.find((node) => node.id === edge.to)!; return <line key={`${edge.from}-${edge.to}`} x1={start.left} y1={start.top} x2={end.left} y2={end.top} />; })}{navNodes.map((node) => <circle key={node.id} cx={node.left} cy={node.top} r="1.2" />)}</svg>}<button className={`collision-toggle ${showPaths ? 'active' : ''}`} onClick={onTogglePaths}>{showPaths ? 'HIDE WALK GRID' : 'SHOW WALK GRID'}</button><div className="keyboard-hint"><b>YOU</b><span>↑ ↓ ← → / WASD · {visitorPosition.left.toFixed(0)},{visitorPosition.top.toFixed(0)}</span></div>
    {places.map((place) => <button key={place.id} className={`map-marker place-marker ${selectedPlaceId === place.id ? 'selected' : ''}`} style={{ left: `${place.position.left}%`, top: `${place.position.top}%`, '--marker-color': place.accent } as CSSProperties} onClick={() => onPlaceClick(place)} aria-label={`Explore ${place.name}`}><span className="marker-pin"><i /></span><span className="marker-label">{place.name}</span></button>)}
    {residents.map((resident, index) => <button key={resident.id} className={`map-marker resident-marker ${selectedResidentId === resident.id ? 'selected' : ''}`} style={{ left: `${resident.position.left}%`, top: `${resident.position.top}%`, '--marker-color': resident.accent } as CSSProperties} onClick={() => onResidentClick(resident)} aria-label={`Talk with ${resident.name}`} title={`${resident.name} · ${resident.activity}`}><PixelAvatar accent={resident.accent} spriteIndex={resident.spriteIndex} size="map" />{(index < 12 || selectedResidentId === resident.id) && <span className="resident-tag">{resident.name.split(' ')[0]}</span>}</button>)}
    <div className="visitor-marker" role="img" aria-label={`${visitorName} at map position ${visitorPosition.left.toFixed(0)}, ${visitorPosition.top.toFixed(0)}`} style={{ left: `${visitorPosition.left}%`, top: `${visitorPosition.top}%`, '--marker-color': visitorAccent } as CSSProperties}><PixelAvatar accent={visitorAccent} spriteIndex={11} size="map" /><span className="resident-tag">{visitorName.split(' ')[0]}</span></div><div className="map-compass" aria-hidden="true"><span>N</span><b>✦</b></div>
  </div>;
}

function ProfileCard({ town, onEdit }: { town: ReturnType<typeof useTownState>; onEdit: () => void }) {
  return <section className="profile-card panel"><div className="profile-card-top"><span className="section-kicker">YOUR TOWN CARD</span><button className="tiny-link" onClick={onEdit}>EDIT</button></div><div className="profile-main"><PixelAvatar accent={town.visitorAccent} spriteIndex={11} size="large" /><div><h3>{town.visitorName}</h3><p>{town.visitorBio}</p></div></div><div className="profile-footer"><span><i className="status-dot online" /> wandering now</span><span>CHECK-INS {town.visitedPlaceIds.length}/6</span></div></section>;
}

function PlaceCard({ place, visited, onClose, onVisit }: { place: TownPlace; visited: boolean; onClose: () => void; onVisit: () => void }) {
  return <section className="detail-card panel" style={{ '--detail-color': place.accent } as CSSProperties}><div className="detail-card-image"><LandmarkTile place={place} /><button className="close-button" onClick={onClose} aria-label="Close place details">×</button></div><div className="detail-card-copy"><span className="section-kicker">{place.category} / {place.neighborhood}</span><h3>{place.name}</h3><p>{place.description}</p></div><button className={`primary-action ${visited ? 'visited' : ''}`} onClick={onVisit}>{visited ? '✓ CHECKED IN' : 'CHECK IN HERE'}</button></section>;
}

function ResidentCard({ resident, onClose, onTalk }: { resident: Resident; onClose: () => void; onTalk: () => void }) {
  return <section className="detail-card resident-detail panel" style={{ '--detail-color': resident.accent } as CSSProperties}><div className="resident-detail-top"><PixelAvatar accent={resident.accent} spriteIndex={resident.spriteIndex} size="large" /><button className="close-button" onClick={onClose} aria-label="Close resident details">×</button></div><div className="detail-card-copy"><span className="section-kicker">{resident.role} / {resident.neighborhood}</span><h3>{resident.name}</h3><p>{resident.bio}</p><div className="resident-now"><span>NOW</span>{resident.activity}<b>{resident.mood}</b></div></div><button className="primary-action" onClick={onTalk}>OPEN LLM CONVERSATION</button></section>;
}

function ChatPanel({ resident, messages, visitorName, llmStatus }: { resident: Resident; messages: ReturnType<typeof useTownState>['messages']; visitorName: string; llmStatus: LlmStatus }) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const residentMessages = messages.filter((message) => message.residentId === resident.id);
  const onSubmit = async (event: FormEvent) => { event.preventDefault(); if (!text.trim() || pending) return; const message = text; setText(''); setPending(true); await sendChatMessage(resident, message); setPending(false); };
  return <section className="panel chat-panel" id="town-chat"><div className="panel-heading"><div><p className="section-kicker">LOCAL FREQUENCY</p><h3>Talk to {resident.name.split(' ')[0]}</h3></div><span className={`chat-signal ${llmStatus}`}>● {llmStatus === 'online' ? 'DEEPSEEK LIVE' : 'FALLBACK'}</span></div><div className="messages-list">{residentMessages.length === 0 && <p className="empty-copy">No scripted lines here. Start the conversation.</p>}{residentMessages.map((message) => <div className={`message-bubble ${message.author === 'you' ? 'mine' : ''}`} key={message.id}><span>{message.author === 'you' ? visitorName : resident.name}{message.source === 'llm' && ' · LLM'}</span><p>{message.text}</p></div>)}</div><form className="message-form" onSubmit={(event) => { void onSubmit(event); }}><input value={text} onChange={(event) => setText(event.target.value)} placeholder={pending ? 'The town is thinking...' : 'Leave a note...'} aria-label={`Message ${resident.name}`} disabled={pending} /><button type="submit" aria-label="Send message" disabled={pending || !text.trim()}>↗</button></form></section>;
}

function ActivityPanel({ events }: { events: TownEvent[] }) {
  return <section className="panel activity-panel"><div className="panel-heading"><div><p className="section-kicker">TOWN RADIO</p><h3>Recent signals</h3></div><span className="signal-bars" aria-hidden="true">▂▅▇</span></div><div className="activity-list">{events.slice(0, 6).map((event) => <div className="activity-row" key={event.id}><i className={`activity-icon ${event.kind}`} /><span>{event.text}</span><time>{timeAgo(event.createdAt)}</time></div>)}</div></section>;
}

function SimulationConsole({ town, llmStatus }: { town: ReturnType<typeof useTownState>; llmStatus: LlmStatus }) {
  const [logKind, setLogKind] = useState<LogKind>('all');
  const [logQuery, setLogQuery] = useState('');
  const trackedResident = town.residents.find((resident) => resident.id === town.simulation.trackedResidentId) || town.residents[0];
  const trajectory = town.decisions.filter((decision) => decision.residentId === trackedResident?.id).slice(0, 8);
  const logRows = useMemo(() => {
    const interactionRows = town.interactions.map((interaction) => ({ id: interaction.id, kind: 'interaction' as LogKind, text: `${interaction.participantNames.join(' + ')} · ${interaction.summary}`, time: interaction.createdAt, location: interaction.locationName }));
    const eventRows = town.events.map((event) => ({ id: event.id, kind: event.kind as LogKind, text: event.text, time: event.createdAt, location: '' }));
    const query = logQuery.trim().toLowerCase();
    return [...interactionRows, ...eventRows].sort((a, b) => b.time - a.time).filter((row) => (logKind === 'all' || row.kind === logKind) && (!query || `${row.text} ${row.location}`.toLowerCase().includes(query))).slice(0, 14);
  }, [town.events, town.interactions, logKind, logQuery]);
  return <section className="simulation-console panel" id="simulation-console"><div className="simulation-header"><div><p className="section-kicker">SIMULATION CONTROL ROOM</p><h2>Observe the town think</h2><p className="simulation-subcopy">Every resident receives a DeepSeek plan. Collision-safe pathfinding moves them through the town; only residents who physically meet can begin a multi-turn conversation.</p></div><div className="simulation-badges"><span className={`llm-badge ${llmStatus}`}>● {llmStatus === 'online' ? `${town.simulation.llmCoverage}/100 LLM PLANNED` : 'MODEL OFFLINE'}</span><span className="tick-badge">{town.simulation.activeEncounters} ENCOUNTERS</span><span className="tick-badge">TICK {town.simulation.tick}</span></div></div><div className="simulation-controls"><button className="primary-action compact-action" onClick={() => setSimulationRunning(!town.simulation.running)}>{town.simulation.running ? 'Ⅱ PAUSE' : '▶ RESUME'}</button><button className="secondary-action compact-action" onClick={() => advanceSimulation()}>STEP +8 MIN</button><div className="speed-picker" aria-label="Simulation speed">{([0.5, 1, 2] as const).map((speed) => <button key={speed} className={town.simulation.speed === speed ? 'active' : ''} onClick={() => setSimulationSpeed(speed)}>{speed}×</button>)}</div><span className="sim-clock">SIM TIME {formatSimTime(town.simulation.minuteOfDay)} · {town.residents.filter((resident) => resident.status === 'wandering').length} ON THE MOVE</span></div><div className="observe-grid"><div className="trajectory-panel"><div className="observe-heading"><div><p className="section-kicker">DECISION TREE / TRAJECTORY</p><h3>{trackedResident?.name || 'Resident'}</h3></div><select value={trackedResident?.id || ''} onChange={(event) => setTrackedResident(event.target.value)} aria-label="Track resident trajectory">{town.residents.map((resident) => <option value={resident.id} key={resident.id}>{resident.name}</option>)}</select></div><p className="trajectory-caption">Need → options → choice → outcome / DeepSeek memory stream</p><div className="trajectory-tree">{trajectory.length === 0 && <p className="empty-copy">Waiting for the first full-population DeepSeek pulse.</p>}{trajectory.map((decision) => <div className="tree-node" key={decision.id}><span className="tree-time">{timeAgo(decision.createdAt)} · {decision.source === 'llm' ? 'DEEPSEEK' : 'ROUTINE'} · {Math.round((decision.confidence || 0) * 100)}%</span><strong>{decision.need}</strong><div className="tree-branches">{decision.options.map((option) => <span className={option === decision.choice ? 'chosen' : ''} key={option}>{option}{option === decision.choice && ' ✓'}</span>)}</div><p>{decision.reason} → {decision.outcome}</p></div>)}</div></div><div className="interactions-panel"><div className="observe-heading"><div><p className="section-kicker">PHYSICAL ENCOUNTER MEMORY / {town.interactions.length}</p><h3>Resident conversations</h3></div><span className="llm-mini">DEEPSEEK DIALOGUE</span></div><div className="interaction-list">{town.interactions.slice(0, 6).map((interaction) => <InteractionCard interaction={interaction} key={interaction.id} />)}{town.interactions.length === 0 && <p className="empty-copy">Residents continue their routines until two paths cross.</p>}</div></div></div><div className="log-toolbar"><div><p className="section-kicker">FULL EVENT LOG</p><h3>Trace every signal</h3></div><input value={logQuery} onChange={(event) => setLogQuery(event.target.value)} placeholder="Filter logs..." aria-label="Filter simulation log" /><select value={logKind} onChange={(event) => setLogKind(event.target.value as LogKind)} aria-label="Filter simulation event type"><option value="all">ALL SIGNALS</option><option value="interaction">INTERACTIONS</option><option value="decision">DECISIONS</option><option value="chat">CHAT</option><option value="visit">VISITS</option><option value="town">TOWN</option></select></div><div className="trace-list">{logRows.map((row) => <div className="trace-row" key={row.id}><i className={`activity-icon ${row.kind}`} /><span><b>{row.kind.toUpperCase()}</b>{row.text}{row.location && ` · ${row.location}`}</span><time>{timeAgo(row.time)}</time></div>)}{logRows.length === 0 && <p className="empty-copy">No signals match this filter.</p>}</div></section>;
}

function InteractionCard({ interaction }: { interaction: TownInteraction }) {
  return <article className="interaction-card"><div className="interaction-card-top"><strong>{interaction.participantNames.join(' + ')}</strong><span>{interaction.locationName}</span></div><p>{interaction.summary}</p>{interaction.dialogue.slice(0, 8).map((line, index) => <blockquote key={`${interaction.id}-${index}`}>{line}</blockquote>)}<small>DEEPSEEK ENCOUNTER · {timeAgo(interaction.createdAt)}</small></article>;
}

function ObservePreview({ town, llmStatus }: { town: ReturnType<typeof useTownState>; llmStatus: LlmStatus }) {
  return <div className="observe-preview"><div className="observe-preview-grid"><div><span className="section-kicker">LIVE POPULATION</span><strong>{town.residents.length} collision-aware sprites</strong><p>{town.residents.filter((resident) => resident.status === 'online').length} online · {town.residents.filter((resident) => resident.status === 'wandering').length} wandering · {town.simulation.activeEncounters} meeting now</p></div><div><span className="section-kicker">MODEL COVERAGE</span><strong className={llmStatus}>{town.simulation.llmCoverage}/100 DeepSeek planned</strong><p>{town.interactions.length} encounter memories · {town.decisions.length} decision branches</p></div></div><div className="observe-wave" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><button className="primary-action" onClick={() => document.getElementById('simulation-console')?.scrollIntoView({ behavior: 'smooth' })}>OPEN CONTROL ROOM ↓</button></div>;
}

function DistrictGrid({ places, visitedPlaceIds, onPlaceClick }: { places: TownPlace[]; visitedPlaceIds: string[]; onPlaceClick: (place: TownPlace) => void }) {
  return <div className="district-grid">{places.map((place) => <button className="district-card" key={place.id} onClick={() => onPlaceClick(place)}><LandmarkTile place={place} /><span className="district-card-copy"><small>{place.category}</small><strong>{place.name}</strong><em>{place.neighborhood}</em>{visitedPlaceIds.includes(place.id) && <b>VISITED</b>}</span></button>)}</div>;
}

function LandmarkTile({ place }: { place: TownPlace }) {
  const column = place.sheetIndex % 2;
  const row = Math.floor(place.sheetIndex / 2);
  return <span className="landmark-tile" style={{ backgroundImage: `url(${landmarkSheetUrl})`, backgroundPosition: `${column * 100}% ${row * 100}%` }} aria-hidden="true" />;
}

function PixelAvatar({ accent, size, spriteIndex }: { accent: string; size: 'small' | 'map' | 'large'; spriteIndex?: number }) {
  const column = (spriteIndex ?? 0) % 4;
  const row = Math.floor((spriteIndex ?? 0) / 4);
  const style = { '--avatar-color': accent, ...(spriteIndex === undefined ? {} : { backgroundImage: `url(${residentSheetUrl})`, backgroundPosition: `${column * 100}% ${row * 100}%` }) } as CSSProperties;
  return <span className={`pixel-avatar ${size} ${spriteIndex === undefined ? '' : 'sprite-avatar'}`} style={style} aria-hidden="true"><i className="avatar-head" /><i className="avatar-body" /><i className="avatar-leg left" /><i className="avatar-leg right" /></span>;
}

function ProfileEditor({ town, onClose }: { town: ReturnType<typeof useTownState>; onClose: () => void }) {
  const [name, setName] = useState(town.visitorName);
  const [bio, setBio] = useState(town.visitorBio);
  const [accent, setAccent] = useState(town.visitorAccent);
  const save = (event: FormEvent) => { event.preventDefault(); saveVisitorProfile(name, bio, accent); onClose(); };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="profile-modal" onSubmit={save}><div className="modal-top"><div><p className="section-kicker">YOUR TOWN CARD</p><h2>How should the town know you?</h2></div><button type="button" className="close-button" onClick={onClose}>×</button></div><label>NAME<input value={name} onChange={(event) => setName(event.target.value)} maxLength={32} /></label><label>ONE-LINE BIO<textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={90} rows={3} /></label><div><span className="form-label">CARD COLOR</span><div className="accent-picker">{accentOptions.map((option) => <button type="button" key={option} className={accent === option ? 'picked' : ''} style={{ background: option }} onClick={() => setAccent(option)} aria-label={`Choose ${option}`} />)}</div></div><div className="modal-actions"><button type="button" className="secondary-action" onClick={onClose}>CANCEL</button><button type="submit" className="primary-action">SAVE CARD</button></div></form></div>;
}

function formatSimTime(minutes: number) {
  const hour = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function timeAgo(timestamp: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
