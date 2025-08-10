import { useMemo, useState } from 'react';
import { useConvex, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import googleData from '../../data/google_maps.json';
import { Id } from '../../convex/_generated/dataModel';

type GoogleData = typeof googleData;

const DEFAULT_COORDS = { lat: 37.78944, lng: -122.40151 }; // Montgomery St BART

export default function POIImport({ worldId }: { worldId: Id<'worlds'> }) {
  const convex = useConvex();
  const [lat, setLat] = useState<string>(String(DEFAULT_COORDS.lat));
  const [lng, setLng] = useState<string>(String(DEFAULT_COORDS.lng));
  const [radius, setRadius] = useState<string>('5');
  const [busy, setBusy] = useState(false);

  const places = useMemo(() => (googleData as GoogleData).places, []);

  const onImport = async () => {
    if (!worldId) return;
    setBusy(true);
    try {
      await convex.mutation(api.aiTown.poi.importPointsOfInterest as any, {
        worldId,
        centerLat: parseFloat(lat),
        centerLng: parseFloat(lng),
        radiusMiles: parseFloat(radius),
        places: places.map((p) => ({
          name: p.name,
          category: p.category,
          address: p.address,
          description: p.description,
          place_id: p.place_id,
        })),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pointer-events-auto bg-brown-900/60 rounded-md p-4 text-white w-full max-w-2xl mx-auto mt-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
        <label className="flex flex-col gap-1">
          <span className="text-sm uppercase tracking-wide opacity-80">Latitude</span>
          <input className="px-3 py-2 text-black rounded" value={lat} onChange={(e) => setLat(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm uppercase tracking-wide opacity-80">Longitude</span>
          <input className="px-3 py-2 text-black rounded" value={lng} onChange={(e) => setLng(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm uppercase tracking-wide opacity-80">Radius (miles)</span>
          <input className="px-3 py-2 text-black rounded" value={radius} onChange={(e) => setRadius(e.target.value)} />
        </label>
      </div>
      <a className={`mt-3 button text-white shadow-solid text-xl cursor-pointer inline-block ${busy ? 'opacity-50 pointer-events-none' : ''}`} onClick={onImport}>
        <div className="h-full bg-clay-700 text-center">
          <span>Import Google Maps data</span>
        </div>
      </a>
    </div>
  );
}


