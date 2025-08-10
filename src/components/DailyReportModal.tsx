import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import ReactModal from 'react-modal';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import uPlot, { AlignedData, Options } from 'uplot';

export default function DailyReportModal(props: {
  isOpen: boolean;
  onRequestClose: () => void;
}) {
  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId: Id<'worlds'> | undefined = worldStatus?.worldId;

  const report = useQuery(api.world.generateDailyReport, worldId ? { worldId } : 'skip');

  // uPlot setup
  const [plotElement, setPlotElement] = useState<HTMLDivElement | null>(null);
  const [plot, setPlot] = useState<uPlot>();

  const timelineData: AlignedData | null = useMemo(() => {
    if (!report?.timeline) return null;
    // uPlot expects x in seconds
    const x = report.timeline.t.map((ms: number) => ms / 1000);
    const y = report.timeline.counts;
    return [x, y];
  }, [report]);

  useLayoutEffect(() => {
    if (!plotElement) return;
    const opts: Options = {
      width: 900,
      height: 200,
      series: [
        {},
        {
          label: 'Interactions',
          stroke: '#a7f3d0',
          spanGaps: true,
          pxAlign: 0,
          points: { show: false },
        },
      ],
      axes: [
        { show: false },
        { stroke: 'white' },
      ],
      scales: { y: { distr: 1 } },
      legend: { show: false },
    };
    const initial: AlignedData = [[], []];
    const p = new uPlot(opts, initial, plotElement);
    setPlot(p);
  }, [plotElement]);

  useEffect(() => {
    if (!plot || !timelineData) return;
    plot.setData(timelineData as any);
    // Autoscale x to full window
    const xs = timelineData[0] as number[];
    if (xs.length > 1) {
      plot.setScale('x', { min: xs[0], max: xs[xs.length - 1] });
    }
  }, [plot, timelineData]);

  const relationships = report?.relationships || [];
  const pois = report?.pois || [];
  const actions = report?.actions || [];

  // Frontend-only examples (no DB writes) to showcase POI interactions & actions
  const examplePois = [
    {
      poiId: 'demo-1',
      name: 'Blue Bottle Coffee',
      category: 'Cafe / Restaurant',
      address: '66 Mint St, San Francisco',
      description: 'Minimalist cafe known for pour-overs and great pastries.',
      created: Date.now() - 2 * 60 * 60 * 1000,
      suggestion: 'Grab a cappuccino and a pastry this afternoon.',
      __example: true,
    },
    {
      poiId: 'demo-2',
      name: 'Mission Dolores Park',
      category: 'Park',
      address: 'Dolores St & 19th St, San Francisco',
      description: 'Sunny park with skyline views; a classic weekend hangout.',
      created: Date.now() - 5 * 60 * 60 * 1000,
      suggestion: 'Take a sunset walk and invite a friend for a chat.',
      __example: true,
    },
    {
      poiId: 'demo-3',
      name: 'Burma Superstar',
      category: 'Restaurant',
      address: '309 Clement St, San Francisco',
      description: 'Beloved Burmese restaurant; tea leaf salad is a must.',
      created: Date.now() - 20 * 60 * 60 * 1000,
      suggestion: 'Book a table this week and try the tea leaf salad.',
      __example: true,
    },
  ];
  const exampleActions = [
    { type: 'relationship', text: 'Message Alex to plan a coffee catch-up.' },
    { type: 'poi', text: 'Try Blue Bottle Coffee on Mint St today.' },
    { type: 'poi', text: 'Plan a sunset walk at Dolores Park.' },
  ];

  const displayPois = pois.length > 0 ? pois : examplePois;
  const displayActions = actions.length > 0 ? actions : exampleActions;

  return (
    <ReactModal isOpen={props.isOpen} onRequestClose={props.onRequestClose} style={modalStyles} ariaHideApp={false}>
      <div className="font-body text-white">
        <h2 className="text-4xl font-bold text-center mb-2">Daily Relationship Report</h2>
        <div className="text-center opacity-80 mb-6">
          {report?.range && (
            <span>
              {new Date(report.range.start).toLocaleString()} — {new Date(report.range.end).toLocaleString()}
            </span>
          )}
        </div>

        {/* Timeline */}
        <section className="bg-brown-900/60 rounded p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold">Conversation Activity</h3>
            <span className="text-sm opacity-80">last 24 hours</span>
          </div>
          <div className="overflow-x-auto">
            <div ref={setPlotElement} className="min-w-[900px]" />
          </div>
          {!timelineData && <div className="opacity-80 mt-2">No activity yet. Start a conversation today.</div>}
        </section>

        {/* Relationships */}
        <section className="mb-6">
          <h3 className="text-xl font-semibold mb-3">People You Connected With</h3>
          {relationships.length === 0 && <div className="opacity-80">No relationships to show yet.</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {relationships.map((r: any) => (
              <div key={r.playerId} className="rounded p-4 bg-gradient-to-br from-brown-900/60 to-brown-800/60 border border-brown-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-lg font-bold">{r.name}</div>
                  <CompatibilityGauge score={r.compatibility} />
                </div>
                <div className="text-sm opacity-90">
                  {r.conversationCount} conversation{r.conversationCount === 1 ? '' : 's'} · {r.messageCount} messages
                </div>
                <div className="text-xs opacity-70 mt-1">Last talked: {new Date(r.lastInteraction).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </section>

        {/* POI Suggestions */}
        <section className="mb-6">
          <h3 className="text-xl font-semibold mb-3">Places You Interacted With</h3>
          {pois.length === 0 && (
            <div className="opacity-80 mb-2">
              No places yet. Showing examples — explore the town to get personalized picks.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayPois.map((p: any) => (
              <div key={(p.poiId as string)} className="rounded p-4 bg-brown-900/60 border border-brown-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold">{p.name}</div>
                    <div className="text-sm opacity-80">{p.category || 'General'}</div>
                  </div>
                  <div className="text-xs opacity-70">{new Date(p.created).toLocaleDateString()}</div>
                </div>
                {p.address && <div className="text-sm mt-2 opacity-90">{p.address}</div>}
                {p.description && <div className="text-sm mt-1 opacity-80">{p.description}</div>}
                <div className="mt-3 text-sm bg-clay-700/60 rounded p-2">Suggestion: {p.suggestion}</div>
                {p.__example && (
                  <div className="mt-2 text-xs uppercase tracking-wide text-white/70">Example</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Actions */}
        <section className="mb-4">
          <h3 className="text-xl font-semibold mb-3">Suggested Actions</h3>
          {actions.length === 0 && (
            <div className="opacity-80 mb-2">No suggestions yet. Showing examples for inspiration.</div>
          )}
          <ul className="space-y-2">
            {displayActions.map((a: any, idx: number) => (
              <li key={idx} className="bg-brown-900/60 border border-brown-800 rounded p-3">{a.text}</li>
            ))}
          </ul>
        </section>

        <div className="mt-6 text-right">
          <button className="button bg-clay-700 px-4 py-2" onClick={props.onRequestClose}>
            Close
          </button>
        </div>
      </div>
    </ReactModal>
  );
}

function CompatibilityGauge(props: { score: number }) {
  const { score } = props;
  const hue = 120 * (score / 100); // green to red
  return (
    <div className="flex items-center gap-2">
      <div className="text-sm">{score}%</div>
      <div className="w-20 h-2 bg-brown-800 rounded">
        <div
          className="h-2 rounded"
          style={{ width: `${score}%`, backgroundColor: `hsl(${hue}, 70%, 55%)` }}
        />
      </div>
    </div>
  );
}

const modalStyles = {
  overlay: {
    backgroundColor: 'rgb(0, 0, 0, 75%)',
    zIndex: 12,
  },
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    maxWidth: '90%',
    width: '1200px',
    maxHeight: '85vh',
    overflow: 'auto',
    border: '10px solid rgb(23, 20, 33)',
    borderRadius: '0',
    background: 'rgb(35, 38, 58)',
    color: 'white',
    fontFamily: '"Upheaval Pro", "sans-serif"',
  },
} as const;


