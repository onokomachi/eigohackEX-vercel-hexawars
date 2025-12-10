
import React from 'react';
import { Player } from '../types';
import { Crown, Zap } from 'lucide-react';

interface PlayerListProps {
    players: Player[];
    currentPlayerIndex: number;
}

const PlayerList: React.FC<PlayerListProps> = ({ players, currentPlayerIndex }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 w-full max-w-4xl mx-auto mb-4">
            {players.map((player, idx) => {
                const isActive = idx === currentPlayerIndex;
                // Check if color is very light to switch text color for the number
                const isLightColor = player.color.toLowerCase() === '#f8fafc' || player.color.toLowerCase() === '#ffffff';
                const numberTextColor = isLightColor ? 'text-slate-900' : 'text-white/90';

                return (
                    <div
                        key={player.id}
                        className={`
              relative flex flex-col items-center p-3 rounded-xl border-2 transition-all duration-300
              ${isActive
                                ? 'border-white bg-white/10 scale-105 shadow-[0_0_15px_rgba(255,255,255,0.2)]'
                                : 'border-transparent bg-slate-800/50 opacity-70'}
            `}
                    >
                        {isActive && (
                            <div className="absolute -top-3 animate-bounce">
                                <div className="w-2 h-2 rounded-full bg-white mb-1 mx-auto"></div>
                            </div>
                        )}

                        <div
                            className="w-8 h-8 rounded-full mb-2 flex items-center justify-center shadow-inner font-black text-lg"
                            style={{ backgroundColor: player.color }}
                        >
                            <span className={numberTextColor}>{idx + 1}</span>
                        </div>

                        <div className="text-sm font-bold truncate w-full text-center">{player.name}</div>
                        <div className="text-2xl font-black">{player.score}</div>

                        {/* AP Indicator */}
                        <div className="flex items-center gap-1 text-xs text-yellow-400 font-mono mt-1 bg-black/30 px-2 py-0.5 rounded-full">
                            <Zap size={10} fill="currentColor" />
                            <span>{player.actionPoints} AP</span>
                        </div>

                        {/* Leader Indicator */}
                        {player.score >= Math.max(...players.map(p => p.score)) && player.score > 2 && (
                            <div className="absolute -right-1 -top-1 text-yellow-400">
                                <Crown size={14} fill="currentColor" />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default PlayerList;
