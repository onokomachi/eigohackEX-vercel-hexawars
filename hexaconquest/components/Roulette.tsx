import React, { useState, useEffect } from 'react';

interface RouletteProps {
    spinning: boolean;
    onSpinComplete: (value: number) => void;
    result: number | null;
}

const Roulette: React.FC<RouletteProps> = ({ spinning, onSpinComplete, result }) => {
    const [displayValue, setDisplayValue] = useState(1);

    useEffect(() => {
        let interval: any;
        if (spinning) {
            interval = setInterval(() => {
                setDisplayValue(Math.floor(Math.random() * 6) + 1);
            }, 80);

            // Stop automatically after random time if triggered by parent, 
            // but parent controls logic. We'll simulate the "landing" effect here.
            setTimeout(() => {
                if (result) {
                    setDisplayValue(result);
                    onSpinComplete(result);
                }
            }, 1500);
        }
        return () => clearInterval(interval);
    }, [spinning, result, onSpinComplete]);

    // If not spinning and we have a result, show it. Otherwise show default or last value.
    const val = spinning ? displayValue : (result || displayValue);

    return (
        <div className="flex flex-col items-center justify-center p-4">
            <div className={`
        relative w-24 h-24 rounded-full border-4 border-slate-700 bg-slate-800 
        flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.5)]
        ${spinning ? 'animate-bounce' : ''}
      `}>
                <div className="absolute inset-0 rounded-full border-t-4 border-blue-500 w-full h-full animate-spin opacity-20"></div>
                <span className={`text-5xl font-black text-white ${spinning ? 'blur-[1px]' : ''}`}>
                    {val}
                </span>
            </div>
            <div className="mt-2 text-xs text-slate-400 font-mono tracking-widest">
                {spinning ? '回転中...' : 'アクションポイント'}
            </div>
        </div>
    );
};

export default Roulette;
