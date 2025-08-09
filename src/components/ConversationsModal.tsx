import { useMemo, useState } from 'react';
import ReactModal from 'react-modal';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

export default function ConversationsModal(props: {
  isOpen: boolean;
  onRequestClose: () => void;
}) {
  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId: Id<'worlds'> | undefined = worldStatus?.worldId;

  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');

  const playerDescriptions = useQuery(
    api.world.gameDescriptions,
    worldId ? { worldId } : 'skip',
  )?.playerDescriptions;

  const listArgs = useMemo(() => {
    if (!worldId) return 'skip' as const;
    const startTime = start ? new Date(start).getTime() : undefined;
    const endTime = end ? new Date(end).getTime() : undefined;
    return {
      worldId,
      participantNames: selectedNames.length > 0 ? selectedNames : undefined,
      startTime,
      endTime,
    } as const;
  }, [worldId, selectedNames, start, end]);

  const conversations = useQuery(api.world.listConversations, listArgs);

  // Selected conversation to preview messages
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const messages = useQuery(
    api.messages.listMessages,
    worldId && selectedConversationId
      ? { worldId, conversationId: selectedConversationId as any }
      : 'skip',
  );

  return (
    <ReactModal isOpen={props.isOpen} onRequestClose={props.onRequestClose} style={modalStyles} ariaHideApp={false}>
      <div className="font-body text-white">
        <h2 className="text-3xl font-bold text-center mb-4">Conversations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="text-sm uppercase opacity-80">Characters</label>
            <div className="mt-2 max-h-40 overflow-auto bg-brown-900/60 p-2 rounded">
              {playerDescriptions?.map((d) => {
                const checked = selectedNames.includes(d.name);
                return (
                  <label key={d.playerId} className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedNames((prev) =>
                          e.target.checked ? [...prev, d.name] : prev.filter((n) => n !== d.name),
                        );
                      }}
                    />
                    <span>{d.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-sm uppercase opacity-80">Start</label>
            <input
              type="datetime-local"
              className="w-full mt-2 px-3 py-2 text-black rounded"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm uppercase opacity-80">End</label>
            <input
              type="datetime-local"
              className="w-full mt-2 px-3 py-2 text-black rounded"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-brown-900/60 rounded p-3 max-h-[50vh] overflow-auto">
            <div className="text-sm uppercase opacity-80 mb-2">Results</div>
            {conversations?.length === 0 && <div className="opacity-80">No conversations found.</div>}
            <ul className="divide-y divide-brown-800">
              {conversations?.map((c) => (
                <li
                  key={c.id as any}
                  className="py-2 cursor-pointer hover:bg-brown-800/60 px-2 rounded"
                  onClick={() => setSelectedConversationId(c.id as any)}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-white">
                      {c.participants.map((p) => p.name).join(' & ')}
                    </div>
                    <div className="text-xs opacity-80">
                      {new Date(c.created).toLocaleString()} – {new Date(c.ended).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-sm opacity-90">
                    Last message at {new Date(c.lastMessage?.timestamp || c.ended).toLocaleString()}
                  </div>
                  <div className="text-xs opacity-70">{c.numMessages} messages</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-brown-900/60 rounded p-3 max-h-[50vh] overflow-auto">
            <div className="text-sm uppercase opacity-80 mb-2">Messages</div>
            {!selectedConversationId && <div className="opacity-80">Select a conversation to view messages.</div>}
            {messages && messages.length === 0 && selectedConversationId && (
              <div className="opacity-80">No messages in this conversation.</div>
            )}
            {messages && messages.length > 0 && (
              <ul className="space-y-3">
                {messages.map((m) => (
                  <li key={(m as any)._id} className="border border-brown-800 rounded p-2">
                    <div className="flex items-center justify-between">
                      <div className="uppercase">{(m as any).authorName}</div>
                      <time className="text-xs opacity-80">{new Date(m._creationTime).toLocaleString()}</time>
                    </div>
                    <div className="bg-white text-black -mx-2 -mb-2 mt-2 p-2">{m.text}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-4 text-right">
          <button className="button bg-clay-700 px-4 py-2" onClick={props.onRequestClose}>
            Close
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


