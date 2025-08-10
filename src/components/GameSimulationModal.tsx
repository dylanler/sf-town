import { useEffect, useMemo, useRef, useState } from 'react';
import ReactModal from 'react-modal';

export type GameConfig = {
  gameType: 'tic-tac-toe' | 'rock-paper-scissors';
  agentOneName: string;
  agentTwoName: string;
};

export default function GameSimulationModal(props: {
  isOpen: boolean;
  onRequestClose: () => void;
  config?: GameConfig;
}) {
  const { config } = props;
  return (
    <ReactModal isOpen={props.isOpen} onRequestClose={props.onRequestClose} style={modalStyles} ariaHideApp={false}>
      {!config ? null : (
        <div className="font-body text-white">
          <h2 className="text-3xl font-bold text-center mb-2">{config.gameType === 'rock-paper-scissors' ? 'Rock / Paper / Scissors' : 'Tic Tac Toe'}</h2>
          <div className="text-center mb-4">
            <span className="font-semibold">{config.agentOneName}</span> vs <span className="font-semibold">{config.agentTwoName}</span>
          </div>
          {config.gameType === 'rock-paper-scissors' ? (
            <RPSView aName={config.agentOneName} bName={config.agentTwoName} />
          ) : (
            <TicTacToeView aName={config.agentOneName} bName={config.agentTwoName} />
          )}
          <div className="mt-6 text-right">
            <button className="button bg-clay-700 px-4 py-2" onClick={props.onRequestClose}>
              Close
            </button>
          </div>
        </div>
      )}
    </ReactModal>
  );
}

function RPSView({ aName, bName }: { aName: string; bName: string }) {
  const choices = ['rock', 'paper', 'scissors'] as const;
  const [countdown, setCountdown] = useState(3);
  const [aChoice, setAChoice] = useState<string | null>(null);
  const [bChoice, setBChoice] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    setCountdown(3);
    setAChoice(null);
    setBChoice(null);
    setResult(null);
  }, [aName, bName]);

  useEffect(() => {
    if (result) return;
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 700);
      return () => clearTimeout(t);
    }
    if (countdown === 0 && aChoice === null && bChoice === null) {
      const a = choices[Math.floor(Math.random() * choices.length)];
      const b = choices[Math.floor(Math.random() * choices.length)];
      setAChoice(a);
      setBChoice(b);
      const r =
        a === b
          ? 'Draw'
          : (a === 'rock' && b === 'scissors') ||
            (a === 'paper' && b === 'rock') ||
            (a === 'scissors' && b === 'paper')
          ? `${aName} wins`
          : `${bName} wins`;
      const t = setTimeout(() => setResult(r), 400);
      return () => clearTimeout(t);
    }
  }, [countdown, aChoice, bChoice, result, aName, bName]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-5xl font-display tracking-wider h-16 flex items-center justify-center w-full">
        {result ? '' : countdown > 0 ? countdown : 'Reveal!'}
      </div>
      <div className="grid grid-cols-2 gap-8 items-center">
        <RPSCard name={aName} choice={aChoice} highlight={result?.includes(aName) ?? false} />
        <RPSCard name={bName} choice={bChoice} highlight={result?.includes(bName) ?? false} />
      </div>
      {result && <div className="text-2xl mt-2">{result}</div>}
    </div>
  );
}

function RPSCard({ name, choice, highlight }: { name: string; choice: string | null; highlight: boolean }) {
  const color = highlight ? 'border-green-400' : 'border-brown-700';
  return (
    <div className={`box p-4 border ${color} min-w-[200px] text-center`}>
      <div className="font-semibold mb-2">{name}</div>
      <div className="text-xl h-6 opacity-80">{choice ? choice : '...'}</div>
    </div>
  );
}

function TicTacToeView({ aName, bName }: { aName: string; bName: string }) {
  const [board, setBoard] = useState<string[]>(Array(9).fill(''));
  const [turn, setTurn] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [winLine, setWinLine] = useState<number[] | null>(null);
  const intervalRef = useRef<number | null>(null);

  const players = useMemo(() => [aName, bName], [aName, bName]);
  const marks = ['X', 'O'] as const;
  const wins = useMemo(
    () => [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ],
    [],
  );

  useEffect(() => {
    setBoard(Array(9).fill(''));
    setTurn(0);
    setWinner(null);
    setWinLine(null);
  }, [aName, bName]);

  useEffect(() => {
    if (winner || turn >= 9) return;
    intervalRef.current = window.setTimeout(() => {
      setBoard((prev) => {
        const empty = prev.map((v, i) => (v ? -1 : i)).filter((i) => i !== -1);
        if (!empty.length) return prev;
        const idx = empty[Math.floor(Math.random() * empty.length)];
        const next = [...prev];
        next[idx] = marks[turn % 2];
        return next;
      });
      setTurn((t) => t + 1);
    }, 500) as unknown as number;
    return () => {
      if (intervalRef.current) window.clearTimeout(intervalRef.current);
    };
  }, [turn, winner]);

  useEffect(() => {
    // Check winner whenever board changes
    for (const w of wins) {
      const [a, b, c] = w;
      if (board[a] && board[a] === board[b] && board[b] === board[c]) {
        setWinner(players[(turn - 1) % 2]);
        setWinLine(w);
        return;
      }
    }
    if (turn >= 9 && !winner) {
      setWinner('Draw');
    }
  }, [board, wins, players, turn, winner]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="grid grid-cols-3 gap-1">
        {board.map((cell, i) => {
          const isWinCell = !!winLine?.includes(i);
          return (
            <div
              key={i}
              className={`w-20 h-20 flex items-center justify-center text-3xl font-bold box ${
                isWinCell ? 'bg-green-600' : 'bg-brown-900/60'
              }`}
            >
              {cell}
            </div>
          );
        })}
      </div>
      {winner && (
        <div className="text-2xl mt-2">
          {winner === 'Draw' ? 'Draw' : `Winner: ${winner}`}
        </div>
      )}
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


