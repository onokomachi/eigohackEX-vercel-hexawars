
import React, { useState, useEffect, useRef } from 'react';
import {
    GameState,
    GamePhase,
    Player,
    HexData,
    HexType,
    DIRECTIONS
} from './types';
import {
    PLAYER_CONFIGS,
    STARTING_POSITIONS,
    COST_MOVE_NEUTRAL,
    COST_MOVE_ENEMY,
    COST_EXTRA_WALL,
    BANK_AP_BONUS,
    BUILD_COSTS,
    COST_ATTACK_CITADEL,
    CITADEL_MAX_HEALTH,
    COST_REPAIR_CITADEL,
    COST_UPGRADE_CITADEL_TURRET,
    MAX_CITADEL_TURRETS
} from './constants';
import {
    generateGrid,
    getHexKey,
    getPlayableNeighbors,
    getNeighbors
} from './utils';
import HexGrid from './components/HexGrid';
import Roulette from './components/Roulette';
import PlayerList from './components/PlayerList';
import GameGuide from './components/GameGuide';
import { RotateCw, SkipForward, Shield, Crosshair, Bomb, Hammer, Crown, X, PlusCircle, BookOpen, ArrowLeft } from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { UserInfo } from '../types';

interface HexaconquestWrapperProps {
    userInfo: UserInfo;
    onBack: () => void;
    deductCoins: (amount: number) => boolean; // Function to deduct coins from Eigo Hack state
    currentCoins: number;
}

const HexaconquestWrapper: React.FC<HexaconquestWrapperProps> = ({ userInfo, onBack, deductCoins, currentCoins }) => {
    // --- State ---
    const [gameState, setGameState] = useState<GameState | null>(null);

    // Local Phase Management for Asynchronous Play
    const [localPhase, setLocalPhase] = useState<GamePhase>(GamePhase.ROLLING);

    const [spinning, setSpinning] = useState(false);
    const [spinResult, setSpinResult] = useState<number | null>(null);
    const [validMoves, setValidMoves] = useState<Set<string>>(new Set());
    const [selectedCitadel, setSelectedCitadel] = useState<HexData | null>(null);
    const [showRules, setShowRules] = useState(false);
    const [showIntro, setShowIntro] = useState(true);

    // Determine User's Team based on Class (1-6)
    // userInfo.class is string "1" to "6". Convert to index 0-5.
    const userClassIndex = (parseInt(userInfo.class) || 1) - 1;
    const userTeam = PLAYER_CONFIGS[userClassIndex];

    // Firestore Ref
    // We use a single document for the grade. e.g. "games/grade-2"
    const gameId = `grade-${userInfo.grade}`;
    const gameRef = doc(db, 'games', gameId);

    // --- Initialization & Sync ---
    useEffect(() => {
        const unsubscribe = onSnapshot(gameRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                // Deserialize Grid (Firestore stores as object, we need Map)
                const gridMap = new Map<string, HexData>();
                if (data.grid) {
                    Object.entries(data.grid).forEach(([k, v]) => {
                        gridMap.set(k, v as HexData);
                    });
                }

                setGameState({
                    players: data.players,
                    grid: gridMap,
                    currentPlayerIndex: data.currentPlayerIndex, // Kept for legacy compatibility but ignored for logic
                    phase: data.phase as GamePhase, // Kept for legacy but we use localPhase
                    turnCount: data.turnCount,
                    logs: data.logs,
                    buildMode: null
                });
            } else {
                // Initialize Game if not exists
                initializeGame();
            }
        });
        return () => unsubscribe();
    }, [gameId]);

    const initializeGame = async () => {
        const newGrid = generateGrid();
        const newPlayers = JSON.parse(JSON.stringify(PLAYER_CONFIGS));

        // Assign Citadels
        STARTING_POSITIONS.forEach((pos, index) => {
            if (index < newPlayers.length) {
                const key = getHexKey(pos.q, pos.r);
                const hex = newGrid.get(key);
                if (hex) {
                    newGrid.set(key, {
                        ...hex,
                        owner: newPlayers[index].id,
                        type: HexType.KING,
                        health: CITADEL_MAX_HEALTH,
                        turretCount: 0
                    });
                }
            }
        });

        // Serialize Grid for Firestore
        // Serialize Grid for Firestore
        const gridObj: Record<string, HexData> = {};
        newGrid.forEach((v, k) => {
            gridObj[k] = v;
        });

        await setDoc(gameRef, {
            players: newPlayers,
            grid: JSON.parse(JSON.stringify(gridObj)),
            currentPlayerIndex: 0,
            phase: GamePhase.ROLLING,
            turnCount: 1,
            logs: []
        });
    };

    // --- Helpers ---
    const saveGameState = async (newState: GameState) => {
        // Optimistic Update
        setGameState(newState);

        // Firestore Update
        // Firestore Update
        // Convert Map to Object manually to avoid TS/Env issues
        const gridObj: Record<string, HexData> = {};
        newState.grid.forEach((v, k) => {
            gridObj[k] = v;
        });
        const gridObjSafe = JSON.parse(JSON.stringify(gridObj));
        await updateDoc(gameRef, {
            players: newState.players,
            grid: gridObjSafe,
            // We do NOT update phase or currentPlayerIndex globally to avoid messing with other players
        });
    };

    // --- Game Logic (Real-time Adapted) ---
    // Calculate valid moves based on LOCAL phase
    useEffect(() => {
        if (!gameState) return;

        const currentPlayer = gameState.players[userClassIndex]; // Always look at OWN player

        if (localPhase === GamePhase.EXPANDING) {
            if (gameState.buildMode) {
                setValidMoves(new Set());
                return;
            }

            const allNeighbors = getPlayableNeighbors(userClassIndex, gameState.grid);
            const affordableMoves = allNeighbors.filter(key => {
                const hex = gameState.grid.get(key);
                if (!hex) return false;

                let cost = hex.owner === null ? COST_MOVE_NEUTRAL : COST_MOVE_ENEMY;
                if (hex.type === HexType.WALL) cost += COST_EXTRA_WALL;
                if (hex.type === HexType.KING && hex.owner !== userClassIndex) cost = COST_ATTACK_CITADEL;

                return currentPlayer.actionPoints >= cost;
            });
            setValidMoves(new Set(affordableMoves));
        } else {
            setValidMoves(new Set());
        }
    }, [gameState, userClassIndex, localPhase]); // Added localPhase dependency

    // --- Actions ---
    const handleSpin = async () => {
        if (spinning || !gameState || localPhase !== GamePhase.ROLLING) return;

        // Removed Turn Check
        // Removed validation: if (gameState.players[gameState.currentPlayerIndex].id !== userClassIndex) ...

        // Check Coins
        if (!deductCoins(1000)) {
            alert("コインが足りません！(必要: 1000コイン)");
            return;
        }

        setSpinning(true);
        const result = Math.floor(Math.random() * 6) + 1;
        setSpinResult(result);

        // Wait for animation
        setTimeout(async () => {
            setSpinning(false);
            setSpinResult(null);

            // Apply AP
            const newPlayers = [...gameState.players];
            let bonusAP = 0;
            gameState.grid.forEach((hex) => {
                if (hex.owner === userClassIndex && hex.type === HexType.BANK) {
                    bonusAP += BANK_AP_BONUS;
                }
            });

            newPlayers[userClassIndex].actionPoints += (result + bonusAP);

            // Update local phase
            setLocalPhase(GamePhase.EXPANDING);

            await saveGameState({
                ...gameState,
                players: newPlayers,
                // phase: GamePhase.EXPANDING <-- Don't save this global
            });
        }, 1500);
    };

    const handleHexClick = async (q: number, r: number) => {
        if (!gameState || localPhase !== GamePhase.EXPANDING) return;

        // Removed Turn Check

        const key = getHexKey(q, r);
        const hex = gameState.grid.get(key);
        if (!hex) return;

        // Citadel Selection
        if (hex.type === HexType.KING && !gameState.buildMode) {
            setSelectedCitadel(hex);
            return;
        }

        // Build Mode
        if (gameState.buildMode) {
            if (hex.owner !== userClassIndex) return;
            if (hex.type !== HexType.NORMAL) return;

            const cost = BUILD_COSTS[gameState.buildMode];
            if (gameState.players[userClassIndex].actionPoints < cost) return;

            const newGrid = new Map<string, HexData>(gameState.grid);
            const newPlayers = [...gameState.players];
            newPlayers[userClassIndex].actionPoints -= cost;
            newGrid.set(key, { ...hex, type: gameState.buildMode });

            await saveGameState({
                ...gameState,
                grid: newGrid,
                players: newPlayers,
                buildMode: null
            });
            return;
        }

        // Move/Attack
        if (validMoves.has(key)) {
            await executeMove(q, r);
        }
    };

    const executeMove = async (q: number, r: number) => {
        if (!gameState) return;
        const currentPlayer = gameState.players[userClassIndex];
        if (!currentPlayer) return;
        const key = getHexKey(q, r);
        const newGrid = new Map<string, HexData>(gameState.grid);
        const hex = newGrid.get(key);
        if (!hex) return;

        const isSteal = hex.owner !== null && hex.owner !== currentPlayer.id;
        let cost = isSteal ? COST_MOVE_ENEMY : COST_MOVE_NEUTRAL;
        if (hex.type === HexType.WALL) cost += COST_EXTRA_WALL;
        if (hex.type === HexType.KING && isSteal) cost = COST_ATTACK_CITADEL;

        const newPlayers = [...gameState.players];

        // Mine Logic
        if (hex.type === HexType.MINE && hex.owner !== currentPlayer.id) {
            newPlayers[userClassIndex].actionPoints = 0;
            newGrid.set(key, { ...hex, type: HexType.NORMAL, owner: null });
            await saveGameState({ ...gameState, grid: newGrid, players: newPlayers });
            setTimeout(() => finishTurn(), 500); // endTurn -> finishTurn
            return;
        }

        // Citadel Siege
        if (hex.type === HexType.KING && isSteal) {
            const currentHealth = hex.health || 1;
            newPlayers[userClassIndex].actionPoints -= cost;

            if (currentHealth > 1) {
                newGrid.set(key, { ...hex, health: currentHealth - 1 });
                await saveGameState({ ...gameState, grid: newGrid, players: newPlayers });
                if (newPlayers[userClassIndex].actionPoints === 0) setTimeout(() => finishTurn(), 500);
                return;
            }
        } else {
            newPlayers[userClassIndex].actionPoints -= cost;
        }

        // Capture
        newPlayers[userClassIndex].score += 1;
        if (isSteal) {
            const prevOwnerId = hex.owner!;
            const prevOwnerIndex = newPlayers.findIndex(p => p.id === prevOwnerId);
            if (hex.type === HexType.KING && prevOwnerIndex !== -1) {
                // Elimination
                newPlayers[prevOwnerIndex].isDead = true;
                newPlayers[prevOwnerIndex].score = 0;
                newPlayers[prevOwnerIndex].actionPoints = 0;
                newGrid.forEach((tile, tileKey) => {
                    if (tile.owner === prevOwnerId && tileKey !== key) {
                        newGrid.set(tileKey, { ...tile, owner: null, type: HexType.NORMAL });
                    }
                });
            } else if (prevOwnerIndex !== -1) {
                newPlayers[prevOwnerIndex].score = Math.max(0, newPlayers[prevOwnerIndex].score - 1);
            }
        }

        const newType = hex.type === HexType.KING ? HexType.NORMAL : hex.type;
        newGrid.set(key, { ...hex, owner: currentPlayer.id, type: newType, health: undefined, turretCount: undefined });

        await saveGameState({ ...gameState, grid: newGrid, players: newPlayers });

        if (newPlayers[userClassIndex].actionPoints === 0) {
            setTimeout(() => finishTurn(), 500);
        }
    };

    // Renamed from endTurn to finishTurn (Local action)
    const finishTurn = async () => {
        if (!gameState) return;

        // Reset local phase to ROLLING so user can spin again if they have coins
        setLocalPhase(GamePhase.ROLLING);

        // Note: usage of 'turnCount' in global state is now ambiguous in real-time. 
        // We might want to remove it or just increment it arbitrarily for "activity" tracking, but let's leave it alone for now to minimize conflicts.
    };

    const handleSkip = () => finishTurn();

    const toggleBuildMode = (type: HexType) => {
        if (!gameState) return;
        setGameState({ ...gameState, buildMode: gameState.buildMode === type ? null : type });
    };

    if (!gameState) return <div className="text-white text-center p-10">Loading Battle Data...</div>;

    const currentPlayer = gameState.players[userClassIndex]; // Always show OWN status

    // Check if we can afford spin
    // Note: We don't need 'isMyTurn' anymore because it's ALWAYS effectively your turn if you have AP or Coins.

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center py-6 px-4 pb-48">
            {/* Header */}
            <div className="w-full max-w-4xl flex justify-between items-center mb-4">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white">
                    <ArrowLeft size={20} /> 戻る
                </button>
                <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-purple-500">
                    Hexa-wars - Class Battle
                </h1>
                <button onClick={() => setShowRules(true)} className="px-3 py-1 bg-slate-800 rounded-lg text-sm font-bold text-slate-300 hover:text-white border border-slate-600 hover:border-slate-400 transition-all">
                    ゲーム説明
                </button>
            </div>


            {/* Coin Display */}
            <div className="absolute top-6 right-20 bg-yellow-500/20 border border-yellow-500/50 px-4 py-1 rounded-full text-yellow-300 font-bold font-orbitron flex items-center gap-2">
                <span className="text-lg">🪙</span>
                <span>{currentCoins}</span>
            </div>

            {showIntro && <GameGuide mode="intro" onClose={() => setShowIntro(false)} onStart={() => setShowIntro(false)} />}
            {showRules && <GameGuide mode="full" onClose={() => setShowRules(false)} />}

            {/* Changed PlayerList to just show list, logic internal to it might highlight current player index, we might want to ignore that for now or just accept it flashes sometimes */}
            <PlayerList players={gameState.players} currentPlayerIndex={userClassIndex} />

            <div className="relative">
                <HexGrid
                    grid={gameState.grid}
                    onHexClick={handleHexClick}
                    validMoves={validMoves}
                    interactive={localPhase === GamePhase.EXPANDING}
                    buildMode={gameState.buildMode}
                />

                {/* Citadel Modal (Simplified) */}
                {selectedCitadel && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                        <div className="bg-slate-800/95 p-6 rounded-2xl pointer-events-auto border border-slate-600">
                            <div className="flex justify-between mb-4">
                                <h3 className="font-bold">要塞</h3>
                                <button onClick={() => setSelectedCitadel(null)}><X size={20} /></button>
                            </div>
                            <div className="text-sm mb-4">耐久: {selectedCitadel.health} / {CITADEL_MAX_HEALTH}</div>
                            {/* Repair/Upgrade Buttons */}
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="fixed bottom-6 z-40 flex flex-col items-center gap-4 w-full px-4 pointer-events-none">
                {/* Build Menu */}
                {localPhase === GamePhase.EXPANDING && (
                    <div className="pointer-events-auto flex gap-2 mb-2">
                        <button onClick={() => toggleBuildMode(HexType.WALL)} className={`p-2 rounded border-2 ${gameState.buildMode === HexType.WALL ? 'border-white bg-blue-600' : 'border-slate-700 bg-slate-800'}`}>
                            <Shield size={20} />
                        </button>
                        <button onClick={() => toggleBuildMode(HexType.TURRET)} className={`p-2 rounded border-2 ${gameState.buildMode === HexType.TURRET ? 'border-white bg-red-600' : 'border-slate-700 bg-slate-800'}`}>
                            <Crosshair size={20} />
                        </button>
                        <button onClick={() => toggleBuildMode(HexType.MINE)} className={`p-2 rounded border-2 ${gameState.buildMode === HexType.MINE ? 'border-white bg-orange-600' : 'border-slate-700 bg-slate-800'}`}>
                            <Bomb size={20} />
                        </button>
                    </div>
                )}

                <div className="pointer-events-auto flex items-center gap-6 bg-slate-800/90 backdrop-blur-md p-4 rounded-3xl border border-slate-700 shadow-2xl">
                    <Roulette spinning={spinning} result={spinResult} onSpinComplete={() => { }} />

                    <div className="w-[1px] h-16 bg-slate-700"></div>

                    <div className="flex flex-col items-center min-w-[180px]">
                        <div className="text-sm text-slate-400 mb-1 font-bold">
                            Player: <span style={{ color: currentPlayer.color }}>{currentPlayer.name}</span>
                        </div>

                        {/* Always show controls for yourself */}
                        {localPhase === GamePhase.ROLLING ? (
                            <button
                                onClick={handleSpin}
                                disabled={spinning}
                                className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-slate-900 font-black py-3 px-6 rounded-xl"
                            >
                                <RotateCw size={20} className={spinning ? "animate-spin" : ""} />
                                1000コインでスピン
                            </button>
                        ) : (
                            <div className="flex flex-col gap-2 w-full">
                                <div className="text-center">
                                    <span className="text-xs text-slate-300">AP:</span>
                                    <div className="text-3xl font-black text-white leading-none">{currentPlayer.actionPoints}</div>
                                </div>
                                <button onClick={handleSkip} className="text-xs bg-slate-700 px-3 py-1.5 rounded-lg">
                                    行動終了 (コイン画面へ)
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HexaconquestWrapper;
