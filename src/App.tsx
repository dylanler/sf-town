import { FormEvent, type CSSProperties, useMemo, useState } from 'react';
import panoramaUrl from '../assets/generated/sf-town-panorama.png';
import landmarkSheetUrl from '../assets/generated/sf-landmark-sheet.png';
import {
  resetTown,
  saveVisitorProfile,
  sendChatMessage,
  useTownState,
  visitPlace,
  type Resident,
  type TownPlace,
} from './localDb';

const accentOptions = ['#f6c453', '#f08a5d', '#38b7a5', '#c771d3', '#7c8ee8'];

export default function App() {
  const town = useTownState();
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>();
  const [selectedResidentId, setSelectedResidentId] = useState<string | undefined>('maya');
  const [profileOpen, setProfileOpen] = useState(false);
  const [view, setView] = useState<'map' | 'districts'>('map');

  const selectedPlace = town.places.find((place) => place.id === selectedPlaceId);
  const selectedResident = town.residents.find((resident) => resident.id === selectedResidentId);
  const conversationMessages = useMemo(
    () =>
      town.messages
        .filter((message) => message.residentId === selectedResidentId)
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(-8),
    [town.messages, selectedResidentId],
  );

  const selectPlace = (place: TownPlace) => {
    setSelectedPlaceId(place.id);
    setSelectedResidentId(undefined);
  };

  const selectResident = (resident: Resident) => {
    setSelectedResidentId(resident.id);
    setSelectedPlaceId(undefined);
  };

  const resetLocalTown = () => {
    if (window.confirm('Reset this browser\'s local town data to the starter scene?')) resetTown();
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="SF Town home">
          <span className="brand-mark" aria-hidden="true">
            SF
          </span>
          <span>
            <strong>SF TOWN</strong>
            <small>LOCAL SIMULACRA</small>
          </span>
        </a>
        <div className="topbar-meta">
          <span className="sync-chip"><i /> LOCAL DB SYNCED</span>
          <button className="text-button" onClick={() => setProfileOpen(true)}>EDIT YOUR CARD</button>
          <button className="reset-button" onClick={resetLocalTown}>RESET</button>
        </div>
      </header>

      <main className="page-wrap">
        <section className="intro-row">
          <div>
            <p className="eyebrow"><span className="eyebrow-line" /> SAN FRANCISCO / 07:42 PM / FOG ROLLING IN</p>
            <h1>Every block has<br /><em>a little story.</em></h1>
            <p className="intro-copy">
              A tiny, persistent 2D pixel-art town for wandering, chatting, and finding the good light.
              Everything you do is saved in this browser.
            </p>
          </div>
          <div className="town-stats" aria-label="Town statistics">
            <div><strong>{town.residents.length}</strong><span>RESIDENTS</span></div>
            <div><strong>{town.places.length}</strong><span>LANDMARKS</span></div>
            <div><strong>{town.visitedPlaceIds.length}</strong><span>CHECK-INS</span></div>
          </div>
        </section>

        <section className="workspace-grid">
          <div className="map-column">
            <div className="section-heading">
              <div>
                <p className="section-kicker">TOWN MAP / LIVE VIEW</p>
                <h2>Find your way around</h2>
              </div>
              <div className="view-switcher" role="tablist" aria-label="Town view">
                <button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>MAP</button>
                <button className={view === 'districts' ? 'active' : ''} onClick={() => setView('districts')}>DISTRICTS</button>
              </div>
            </div>

            {view === 'map' ? (
              <TownMap
                panoramaUrl={panoramaUrl}
                places={town.places}
                residents={town.residents}
                selectedPlaceId={selectedPlaceId}
                selectedResidentId={selectedResidentId}
                visitorName={town.visitorName}
                visitorAccent={town.visitorAccent}
                onPlaceClick={selectPlace}
                onResidentClick={selectResident}
              />
            ) : (
              <DistrictGrid places={town.places} visitedPlaceIds={town.visitedPlaceIds} onPlaceClick={selectPlace} />
            )}

            <div className="map-caption">
              <span><i className="legend-dot legend-you" /> YOU / {town.visitorName.toUpperCase()}</span>
              <span><i className="legend-dot legend-resident" /> RESIDENTS</span>
              <span><i className="legend-pin" /> PLACES TO DISCOVER</span>
              <span className="caption-note">CLICK A PIN TO EXPLORE</span>
            </div>
          </div>

          <aside className="right-rail">
            {selectedPlace ? (
              <PlaceCard
                place={selectedPlace}
                visited={town.visitedPlaceIds.includes(selectedPlace.id)}
                onClose={() => setSelectedPlaceId(undefined)}
                onVisit={() => visitPlace(selectedPlace)}
              />
            ) : selectedResident ? (
              <ResidentCard
                resident={selectedResident}
                onClose={() => setSelectedResidentId(undefined)}
                onTalk={() => document.getElementById('town-chat')?.scrollIntoView({ behavior: 'smooth' })}
              />
            ) : (
              <ProfileCard town={town} onEdit={() => setProfileOpen(true)} />
            )}

            <section className="panel residents-panel">
              <div className="panel-heading">
                <div><p className="section-kicker">THE NEIGHBORS</p><h3>Residents online</h3></div>
                <span className="online-count"><i /> {town.residents.filter((resident) => resident.status === 'online').length} LIVE</span>
              </div>
              <div className="resident-list">
                {town.residents.map((resident) => (
                  <button
                    className={`resident-row ${selectedResidentId === resident.id ? 'selected' : ''}`}
                    key={resident.id}
                    onClick={() => selectResident(resident)}
                  >
                    <PixelAvatar accent={resident.accent} size="small" />
                    <span className="resident-copy"><strong>{resident.name}</strong><small>{resident.role} · {resident.neighborhood}</small></span>
                    <span className={`status-dot ${resident.status}`} title={resident.status} />
                  </button>
                ))}
              </div>
            </section>

            {selectedResident && (
              <ChatPanel
                resident={selectedResident}
                messages={conversationMessages}
                visitorName={town.visitorName}
              />
            )}

            <ActivityPanel events={town.events} />
          </aside>
        </section>

        <section className="landmark-strip">
          <div className="strip-heading">
            <div><p className="section-kicker">POSTCARD WALL</p><h2>Six ways to spend an afternoon</h2></div>
            <button className="text-button" onClick={() => setView('districts')}>VIEW ALL DISTRICTS →</button>
          </div>
          <div className="postcard-grid">
            {town.places.map((place) => (
              <button className="postcard" key={place.id} onClick={() => selectPlace(place)}>
                <LandmarkTile place={place} />
                <span><strong>{place.name}</strong><small>{place.neighborhood}</small></span>
                {town.visitedPlaceIds.includes(place.id) && <b className="visited-ribbon">VISITED</b>}
              </button>
            ))}
          </div>
        </section>

        <footer className="footer-note">
          <span>SF TOWN / MADE FOR SLOW DIGITAL WALKS</span>
          <span>DATA LIVES IN <code>localStorage</code> · NO CLOUD DATABASE REQUIRED</span>
        </footer>
      </main>

      {profileOpen && <ProfileEditor town={town} onClose={() => setProfileOpen(false)} />}
    </div>
  );
}

function TownMap({
  panoramaUrl,
  places,
  residents,
  selectedPlaceId,
  selectedResidentId,
  visitorName,
  visitorAccent,
  onPlaceClick,
  onResidentClick,
}: {
  panoramaUrl: string;
  places: TownPlace[];
  residents: Resident[];
  selectedPlaceId?: string;
  selectedResidentId?: string;
  visitorName: string;
  visitorAccent: string;
  onPlaceClick: (place: TownPlace) => void;
  onResidentClick: (resident: Resident) => void;
}) {
  return (
    <div className="town-map-frame">
      <img className="town-panorama" src={panoramaUrl} alt="Pixel-art San Francisco town with the Golden Gate Bridge and foggy bay" />
      <div className="map-vignette" />
      <div className="map-grid-overlay" />
      <div className="map-label map-label-bay">THE BAY</div>
      <div className="map-label map-label-mission">MISSION</div>
      <div className="map-label map-label-north">NORTH BEACH</div>
      {places.map((place) => (
        <button
          key={place.id}
          className={`map-marker place-marker ${selectedPlaceId === place.id ? 'selected' : ''}`}
          style={{ left: `${place.position.left}%`, top: `${place.position.top}%`, '--marker-color': place.accent } as CSSProperties}
          onClick={() => onPlaceClick(place)}
          aria-label={`Explore ${place.name}`}
        >
          <span className="marker-pin"><i /></span>
          <span className="marker-label">{place.name}</span>
        </button>
      ))}
      {residents.map((resident) => (
        <button
          key={resident.id}
          className={`map-marker resident-marker ${selectedResidentId === resident.id ? 'selected' : ''}`}
          style={{ left: `${resident.position.left}%`, top: `${resident.position.top}%`, '--marker-color': resident.accent } as CSSProperties}
          onClick={() => onResidentClick(resident)}
          aria-label={`Talk with ${resident.name}`}
        >
          <PixelAvatar accent={resident.accent} size="map" />
          <span className="resident-tag">{resident.name.split(' ')[0]}</span>
        </button>
      ))}
      <div className="visitor-marker" style={{ left: '51%', top: '53%', '--marker-color': visitorAccent } as CSSProperties}>
        <PixelAvatar accent={visitorAccent} size="map" />
        <span className="resident-tag">{visitorName.split(' ')[0]}</span>
      </div>
      <div className="map-compass" aria-hidden="true"><span>N</span><b>✦</b></div>
    </div>
  );
}

function ProfileCard({ town, onEdit }: { town: ReturnType<typeof useTownState>; onEdit: () => void }) {
  return (
    <section className="profile-card panel">
      <div className="profile-card-top"><span className="section-kicker">YOUR TOWN CARD</span><button className="tiny-link" onClick={onEdit}>EDIT</button></div>
      <div className="profile-main"><PixelAvatar accent={town.visitorAccent} size="large" /><div><h3>{town.visitorName}</h3><p>{town.visitorBio}</p></div></div>
      <div className="profile-footer"><span><i className="status-dot online" /> wandering now</span><span>CHECK-INS {town.visitedPlaceIds.length}/6</span></div>
    </section>
  );
}

function PlaceCard({ place, visited, onClose, onVisit }: { place: TownPlace; visited: boolean; onClose: () => void; onVisit: () => void }) {
  return (
    <section className="detail-card panel" style={{ '--detail-color': place.accent } as CSSProperties}>
      <div className="detail-card-image"><LandmarkTile place={place} /><button className="close-button" onClick={onClose} aria-label="Close place details">×</button></div>
      <div className="detail-card-copy"><span className="section-kicker">{place.category} / {place.neighborhood}</span><h3>{place.name}</h3><p>{place.description}</p></div>
      <button className={`primary-action ${visited ? 'visited' : ''}`} onClick={onVisit}>{visited ? '✓ CHECKED IN' : 'CHECK IN HERE'}</button>
    </section>
  );
}

function ResidentCard({ resident, onClose, onTalk }: { resident: Resident; onClose: () => void; onTalk: () => void }) {
  return (
    <section className="detail-card resident-detail panel" style={{ '--detail-color': resident.accent } as CSSProperties}>
      <div className="resident-detail-top"><PixelAvatar accent={resident.accent} size="large" /><button className="close-button" onClick={onClose} aria-label="Close resident details">×</button></div>
      <div className="detail-card-copy"><span className="section-kicker">{resident.role} / {resident.neighborhood}</span><h3>{resident.name}</h3><p>{resident.bio}</p></div>
      <button className="primary-action" onClick={onTalk}>OPEN CONVERSATION</button>
    </section>
  );
}

function ChatPanel({ resident, messages, visitorName }: { resident: Resident; messages: ReturnType<typeof useTownState>['messages']; visitorName: string }) {
  const [text, setText] = useState('');
  const residentMessages = messages.filter((message) => message.residentId === resident.id);
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    sendChatMessage(resident, text);
    setText('');
  };
  return (
    <section className="panel chat-panel" id="town-chat">
      <div className="panel-heading"><div><p className="section-kicker">LOCAL FREQUENCY</p><h3>Talk to {resident.name.split(' ')[0]}</h3></div><span className="chat-signal">● OPEN</span></div>
      <div className="messages-list">
        {residentMessages.length === 0 && <p className="empty-copy">The line is quiet. Say hello.</p>}
        {residentMessages.map((message) => (
          <div className={`message-bubble ${message.author === 'you' ? 'mine' : ''}`} key={message.id}>
            <span>{message.author === 'you' ? visitorName : resident.name}</span><p>{message.text}</p>
          </div>
        ))}
      </div>
      <form className="message-form" onSubmit={onSubmit}><input value={text} onChange={(event) => setText(event.target.value)} placeholder="Leave a note..." aria-label={`Message ${resident.name}`} /><button type="submit" aria-label="Send message">↗</button></form>
    </section>
  );
}

function ActivityPanel({ events }: { events: ReturnType<typeof useTownState>['events'] }) {
  return (
    <section className="panel activity-panel"><div className="panel-heading"><div><p className="section-kicker">TOWN RADIO</p><h3>Recent signals</h3></div><span className="signal-bars" aria-hidden="true">▂▅▇</span></div><div className="activity-list">{events.slice(0, 4).map((event) => <div className="activity-row" key={event.id}><i className={`activity-icon ${event.kind}`} /><span>{event.text}</span><time>{timeAgo(event.createdAt)}</time></div>)}</div></section>
  );
}

function DistrictGrid({ places, visitedPlaceIds, onPlaceClick }: { places: TownPlace[]; visitedPlaceIds: string[]; onPlaceClick: (place: TownPlace) => void }) {
  return <div className="district-grid">{places.map((place) => <button className="district-card" key={place.id} onClick={() => onPlaceClick(place)}><LandmarkTile place={place} /><span className="district-card-copy"><small>{place.category}</small><strong>{place.name}</strong><em>{place.neighborhood}</em>{visitedPlaceIds.includes(place.id) && <b>VISITED</b>}</span></button>)}</div>;
}

function LandmarkTile({ place }: { place: TownPlace }) {
  const column = place.sheetIndex % 2;
  const row = Math.floor(place.sheetIndex / 2);
  return <span className="landmark-tile" style={{ backgroundImage: `url(${landmarkSheetUrl})`, backgroundPosition: `${column * 100}% ${row * 100}%` }} aria-hidden="true" />;
}

function PixelAvatar({ accent, size }: { accent: string; size: 'small' | 'map' | 'large' }) {
  return <span className={`pixel-avatar ${size}`} style={{ '--avatar-color': accent } as CSSProperties} aria-hidden="true"><i className="avatar-head" /><i className="avatar-body" /><i className="avatar-leg left" /><i className="avatar-leg right" /></span>;
}

function ProfileEditor({ town, onClose }: { town: ReturnType<typeof useTownState>; onClose: () => void }) {
  const [name, setName] = useState(town.visitorName);
  const [bio, setBio] = useState(town.visitorBio);
  const [accent, setAccent] = useState(town.visitorAccent);
  const save = (event: FormEvent) => {
    event.preventDefault();
    saveVisitorProfile(name, bio, accent);
    onClose();
  };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="profile-modal" onSubmit={save}><div className="modal-top"><div><p className="section-kicker">YOUR TOWN CARD</p><h2>How should the town know you?</h2></div><button type="button" className="close-button" onClick={onClose}>×</button></div><label>NAME<input value={name} onChange={(event) => setName(event.target.value)} maxLength={32} /></label><label>ONE-LINE BIO<textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={90} rows={3} /></label><div><span className="form-label">CARD COLOR</span><div className="accent-picker">{accentOptions.map((option) => <button type="button" key={option} className={accent === option ? 'picked' : ''} style={{ background: option }} onClick={() => setAccent(option)} aria-label={`Choose ${option}`} />)}</div></div><div className="modal-actions"><button type="button" className="secondary-action" onClick={onClose}>CANCEL</button><button type="submit" className="primary-action">SAVE CARD</button></div></form></div>;
}

function timeAgo(timestamp: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
