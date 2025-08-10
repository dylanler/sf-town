import { useMemo } from 'react';
import { characters } from '../../data/characters';
import { useConvex, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { toast } from 'react-toastify';
import { ConvexError } from 'convex/values';
import { waitForInput } from '../hooks/sendInput';
import { useServerGame } from '../hooks/serverGame';

export default function CharacterInitForm(props: {
  name: string;
  setName: (v: string) => void;
  character: string;
  setCharacter: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
}) {
  const characterOptions = useMemo(() => characters.map((c) => c.name), []);
  
  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId = worldStatus?.worldId;
  const game = useServerGame(worldId);
  const humanTokenIdentifier = useQuery(api.world.userStatus, worldId ? { worldId } : 'skip');
  const userPlayerId =
    game && [...game.world.players.values()].find((p) => p.human === humanTokenIdentifier)?.id;
  const isPlaying = !!userPlayerId;
  
  const convex = useConvex();
  const createDigitalTwin = useMutation(api.world.createDigitalTwin);

  const handleCreateDigitalTwin = async () => {
    if (!worldId || !isPlaying) {
      toast.error('You must be playing in the world to create a digital twin');
      return;
    }
    
    try {
      const inputId = await createDigitalTwin({
        worldId,
        name: props.name,
        character: props.character,
        description: props.description,
      });
      
      await waitForInput(convex, inputId);
      toast.success('Your digital twin has been created and is now autonomous!');
    } catch (e: any) {
      if (e instanceof ConvexError) {
        toast.error(e.data);
        return;
      }
      toast.error(e.message || 'Failed to create digital twin');
    }
  };

  return (
    <div className="pointer-events-auto bg-brown-900/60 rounded-md p-4 text-white w-full max-w-2xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
        <label className="flex flex-col gap-1">
          <span className="text-sm uppercase tracking-wide opacity-80">Name</span>
          <input
            className="px-3 py-2 text-black rounded"
            type="text"
            value={props.name}
            placeholder="Me"
            onChange={(e) => props.setName(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm uppercase tracking-wide opacity-80">Character</span>
          <select
            className="px-3 py-2 text-black rounded"
            value={props.character}
            onChange={(e) => props.setCharacter(e.target.value)}
          >
            {characterOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 sm:col-span-1 sm:col-start-auto sm:row-span-1 sm:row-start-auto">
          <span className="text-sm uppercase tracking-wide opacity-80">Description</span>
          <input
            className="px-3 py-2 text-black rounded"
            type="text"
            value={props.description}
            placeholder="I love hackathons"
            onChange={(e) => props.setDescription(e.target.value)}
          />
        </label>
      </div>
      <p className="text-xs opacity-70 mt-2">Choose a sprite (f1–f8) and your display name.</p>
      
      {/* Digital Twin Button */}
      <div className="mt-4 flex justify-center">
        <button
          onClick={handleCreateDigitalTwin}
          disabled={!isPlaying || !props.name.trim()}
          className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold rounded-md transition-colors duration-200"
          title={!isPlaying ? "You must be playing to create a digital twin" : !props.name.trim() ? "Please enter a name first" : "Convert your character to an autonomous AI agent"}
        >
          🤖 Autorun My Digital Twin
        </button>
      </div>
      
      {isPlaying && (
        <p className="text-xs opacity-70 mt-2 text-center">
          Click above to convert your character into an AI agent that will act autonomously.
        </p>
      )}
    </div>
  );
}


