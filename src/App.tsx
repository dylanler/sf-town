import Game from './components/Game.tsx';

import { ToastContainer } from 'react-toastify';
import starImg from '../assets/star.svg';
import helpImg from '../assets/help.svg';
import chatsImg from '../assets/ui/chats.svg';
// import { UserButton } from '@clerk/clerk-react';
// import { Authenticated, Unauthenticated } from 'convex/react';
// import LoginButton from './components/buttons/LoginButton.tsx';
import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import POIImport from './components/POIImport';
import ReactModal from 'react-modal';
import MusicButton from './components/buttons/MusicButton.tsx';
import Button from './components/buttons/Button.tsx';
import InteractButton from './components/buttons/InteractButton.tsx';
import FreezeButton from './components/FreezeButton.tsx';
import { MAX_HUMAN_PLAYERS } from '../convex/constants.ts';
import CharacterInitForm from './components/CharacterInitForm.tsx';
import ConversationsModal from './components/ConversationsModal.tsx';
import GenerateGameModal from './components/GenerateGameModal';
import GameSimulationModal, { type GameConfig } from './components/GameSimulationModal';
import { toast } from 'react-toastify';
import DailyReportModal from './components/DailyReportModal';
 

export default function Home() {
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [playerName, setPlayerName] = useState('Dylan');
  const [playerCharacter, setPlayerCharacter] = useState('f1');
  const [playerDescription, setPlayerDescription] = useState('25 years old, I love hackathons');
  const [conversationsOpen, setConversationsOpen] = useState(false);
  const [generateGameOpen, setGenerateGameOpen] = useState(false);
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [simulationConfig, setSimulationConfig] = useState<GameConfig | undefined>(undefined);
  const [dailyReportOpen, setDailyReportOpen] = useState(false);
  const defaultWorld = useQuery(api.world.defaultWorldStatus);
  const worldId = defaultWorld?.worldId;
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between font-body game-background">
      

      <ReactModal
        isOpen={helpModalOpen}
        onRequestClose={() => setHelpModalOpen(false)}
        style={modalStyles}
        contentLabel="Help modal"
        ariaHideApp={false}
      >
        <div className="font-body">
          <h1 className="text-center text-6xl font-bold font-display game-title">Help</h1>
          <p>
            Welcome to AI town. AI town supports both anonymous <i>spectators</i> and logged in{' '}
            <i>interactivity</i>.
          </p>
          <h2 className="text-4xl mt-4">Spectating</h2>
          <p>
            Click and drag to move around the town, and scroll in and out to zoom. You can click on
            an individual character to view its chat history.
          </p>
          <h2 className="text-4xl mt-4">Interactivity</h2>
          <p>
            If you log in, you can join the simulation and directly talk to different agents! After
            logging in, click the "Interact" button, and your character will appear somewhere on the
            map with a highlighted circle underneath you.
          </p>
          <p className="text-2xl mt-2">Controls:</p>
          <p className="mt-4">Click to navigate around.</p>
          <p className="mt-4">
            To talk to an agent, click on them and then click "Start conversation," which will ask
            them to start walking towards you. Once they're nearby, the conversation will start, and
            you can speak to each other. You can leave at any time by closing the conversation pane
            or moving away. They may propose a conversation to you - you'll see a button to accept
            in the messages panel.
          </p>
          <p className="mt-4">
            AI town only supports {MAX_HUMAN_PLAYERS} humans at a time. If you're idle for five
            minutes, you'll be automatically removed from the simulation.
          </p>
        </div>
      </ReactModal>
      {/*<div className="p-3 absolute top-0 right-0 z-10 text-2xl">
        <Authenticated>
          <UserButton afterSignOutUrl="/ai-town" />
        </Authenticated>

        <Unauthenticated>
          <LoginButton />
        </Unauthenticated>
      </div> */}

      <div className="w-full lg:h-screen min-h-screen relative isolate overflow-hidden lg:p-8 shadow-2xl flex flex-col justify-start">
        <h1 className="mx-auto text-4xl p-3 sm:text-8xl lg:text-9xl font-bold font-display leading-none tracking-wide game-title w-full text-left sm:text-center sm:w-auto">
          San Francisco Simulacra
        </h1>

        <div className="max-w-xs md:max-w-xl lg:max-w-none mx-auto my-4 text-center text-base sm:text-xl md:text-2xl text-white leading-tight shadow-solid">
          A virtual town where digital twins of real people live, chat, game, and socialize.
          {/* <Unauthenticated>
            <div className="my-1.5 sm:my-0" />
            Log in to join the town
            <br className="block sm:hidden" /> and the conversation!
          </Unauthenticated> */}
        </div>

        <div className="mb-4 w-full flex flex-col items-center gap-3">
          <CharacterInitForm
            name={playerName}
            setName={setPlayerName}
            character={playerCharacter}
            setCharacter={setPlayerCharacter}
            description={playerDescription}
            setDescription={setPlayerDescription}
          />
        </div>

        {/* Import POIs */}
        {worldId && (
          <div className="w-full flex flex-col items-center gap-3">
            <POIImport worldId={worldId} />
          </div>
        )}

        <Game />

        <footer className="justify-end bottom-0 left-0 w-full flex items-center mt-4 gap-3 p-6 flex-wrap pointer-events-none">
          <div className="flex gap-4 flex-grow pointer-events-none">
            <FreezeButton />
            <MusicButton />
            <Button href="https://github.com/a16z-infra/ai-town" imgUrl={starImg}>
              Star
            </Button>
            <InteractButton
              name={playerName}
              character={playerCharacter}
              description={playerDescription}
            />
            <Button imgUrl={chatsImg} onClick={() => setConversationsOpen(true)}>
              Conversations
            </Button>
            <Button imgUrl={helpImg} onClick={() => setHelpModalOpen(true)}>
              Help
            </Button>
            <Button imgUrl={starImg} onClick={() => setGenerateGameOpen(true)}>
              Generate a game
            </Button>
          <Button imgUrl={starImg} onClick={() => setDailyReportOpen(true)}>
            Generate Daily Report
          </Button>
          </div>
          
        </footer>
        <ToastContainer position="bottom-right" autoClose={2000} closeOnClick theme="dark" />
        <ConversationsModal isOpen={conversationsOpen} onRequestClose={() => setConversationsOpen(false)} />
        <GenerateGameModal
          isOpen={generateGameOpen}
          onRequestClose={() => setGenerateGameOpen(false)}
          onGenerate={(config) => {
            // Open visual simulation modal with selected config
            setSimulationConfig({
              gameType: config.gameType,
              agentOneName: config.agentOneName,
              agentTwoName: config.agentTwoName,
            });
            setGenerateGameOpen(false);
            setSimulationOpen(true);
          }}
        />
        <GameSimulationModal
          isOpen={simulationOpen}
          onRequestClose={() => setSimulationOpen(false)}
          config={simulationConfig}
        />
        <DailyReportModal isOpen={dailyReportOpen} onRequestClose={() => setDailyReportOpen(false)} />
      </div>
    </main>
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
    maxWidth: '50%',

    border: '10px solid rgb(23, 20, 33)',
    borderRadius: '0',
    background: 'rgb(35, 38, 58)',
    color: 'white',
    fontFamily: '"Upheaval Pro", "sans-serif"',
  },
};
