import { useMemo, useState } from 'react';
import ReactModal from 'react-modal';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

export default function GenerateGameModal(props: {
  isOpen: boolean;
  onRequestClose: () => void;
  onGenerate: (config: {
    gameType: 'tic-tac-toe' | 'rock-paper-scissors';
    autoAgents: boolean;
    agentOneName: string;
    agentTwoName: string;
    freestylePrompt: string;
  }) => void;
}) {
  const [gameType, setGameType] = useState<'tic-tac-toe' | 'rock-paper-scissors'>('tic-tac-toe');
  const [autoAgents, setAutoAgents] = useState(true);
  const [agentOneName, setAgentOneName] = useState('');
  const [agentTwoName, setAgentTwoName] = useState('');
  const [freestylePrompt, setFreestylePrompt] = useState('');

  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId: Id<'worlds'> | undefined = worldStatus?.worldId;
  const playerDescriptions = useQuery(
    api.world.gameDescriptions,
    worldId ? { worldId } : 'skip',
  )?.playerDescriptions;
  const nameOptions = useMemo(() => (playerDescriptions || []).map((d) => d.name), [playerDescriptions]);

  const canGenerate = gameType && agentOneName && agentTwoName && agentOneName !== agentTwoName;

  const onGenerate = () => {
    // TODO: Integrate Freestyle to generate/deploy games and spawn agents
    if (!canGenerate) return;
    props.onGenerate({ gameType, autoAgents, agentOneName, agentTwoName, freestylePrompt });
  };

  return (
    <ReactModal isOpen={props.isOpen} onRequestClose={props.onRequestClose} style={modalStyles} ariaHideApp={false}>
      <div className="font-body text-white">
        <h2 className="text-3xl font-bold text-center mb-4">Generate a game with Freestyle.sh</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm uppercase tracking-wide opacity-80">Game type</span>
            <select
              className="px-3 py-2 text-black rounded"
              value={gameType}
              onChange={(e) => setGameType(e.target.value as any)}
            >
              <option value="tic-tac-toe">Tic Tac Toe</option>
              <option value="rock-paper-scissors">Rock / Paper / Scissors</option>
            </select>
          </label>

          <label className="flex items-center gap-3 mt-6 sm:mt-0">
            <input
              type="checkbox"
              checked={autoAgents}
              onChange={(e) => setAutoAgents(e.target.checked)}
            />
            <span className="text-sm uppercase tracking-wide opacity-80">Summon 2 AI agents to auto-play</span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm uppercase tracking-wide opacity-80">Agent 1</span>
            <select
              className="px-3 py-2 text-black rounded"
              value={agentOneName}
              onChange={(e) => setAgentOneName(e.target.value)}
            >
              <option value="" disabled>
                Select agent
              </option>
              {nameOptions.map((n) => (
                <option key={`a1-${n}`} value={n} disabled={n === agentTwoName}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm uppercase tracking-wide opacity-80">Agent 2</span>
            <select
              className="px-3 py-2 text-black rounded"
              value={agentTwoName}
              onChange={(e) => setAgentTwoName(e.target.value)}
            >
              <option value="" disabled>
                Select agent
              </option>
              {nameOptions.map((n) => (
                <option key={`a2-${n}`} value={n} disabled={n === agentOneName}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 bg-brown-900/60 rounded p-3">
          <div className="text-sm uppercase opacity-80 mb-2">Generate a game with Freestyle.sh</div>
          <label className="flex flex-col gap-1">
            <span className="opacity-80">Prompt (for future backend container)</span>
            <textarea
              className="px-3 py-2 text-black rounded min-h-[96px]"
              placeholder="Describe the game, rules, visuals, or special constraints you want Freestyle to generate..."
              value={freestylePrompt}
              onChange={(e) => setFreestylePrompt(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button className="button bg-clay-700 px-4 py-2" onClick={props.onRequestClose}>
            Cancel
          </button>
          <button
            className="button bg-purple-600 px-4 py-2"
            onClick={onGenerate}
            title="Prepare a simple PvP game; backend deploy will be added next"
            disabled={!canGenerate}
          >
            Generate
          </button>
        </div>
      </div>
    </ReactModal>
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
    width: '720px',
    maxHeight: '85vh',
    overflow: 'auto',
    border: '10px solid rgb(23, 20, 33)',
    borderRadius: '0',
    background: 'rgb(35, 38, 58)',
    color: 'white',
    fontFamily: '"Upheaval Pro", "sans-serif"',
  },
} as const;


