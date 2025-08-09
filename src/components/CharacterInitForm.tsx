import { useMemo } from 'react';
import { characters } from '../../data/characters';

export default function CharacterInitForm(props: {
  name: string;
  setName: (v: string) => void;
  character: string;
  setCharacter: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
}) {
  const characterOptions = useMemo(() => characters.map((c) => c.name), []);

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
    </div>
  );
}


