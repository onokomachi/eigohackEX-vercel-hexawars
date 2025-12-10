
import React from 'react';
import { HexData, HexType } from '../types';
import { hexToPixel, getHexKey } from '../utils';
import { HEX_SIZE, PLAYER_CONFIGS, CITADEL_MAX_HEALTH } from '../constants';
import { Landmark, Zap, Shield, Crosshair, Bomb, Crown } from 'lucide-react';

interface HexGridProps {
    grid: Map<string, HexData>;
    onHexClick: (q: number, r: number) => void;
    validMoves: Set<string>;
    interactive: boolean;
    buildMode: HexType | null | undefined;
}

const HexGrid: React.FC<HexGridProps> = ({ grid, onHexClick, validMoves, interactive, buildMode }) => {
    const hexes: HexData[] = Array.from(grid.values());

    const width = 600;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;

    return (
        <div className="relative flex items-center justify-center select-none">
            <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                className="max-w-full h-auto drop-shadow-2xl"
            >
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                {hexes.map((hex) => {
                    const { x, y } = hexToPixel(hex, HEX_SIZE);
                    const key = getHexKey(hex.q, hex.r);

                    const owner = hex.owner !== null ? PLAYER_CONFIGS[hex.owner] : null;

                    // Validity Check
                    let isMoveValid = false;
                    let isActionable = false;

                    if (interactive) {
                        if (buildMode) {
                            // In build mode, we can only click OUR OWN hexes that are not already special
                            isMoveValid = hex.owner !== null && hex.owner === (grid.get(key)?.owner ?? -999) && hex.type === HexType.NORMAL;
                            isActionable = isMoveValid;
                        } else {
                            // In move mode, check the pre-calculated valid moves
                            isMoveValid = validMoves.has(key);
                            // Can always click KING to check HP
                            isActionable = isMoveValid || hex.type === HexType.KING;
                        }
                    }

                    // Determine Fill Color
                    let fillColor = '#1e293b'; // Default neutral slate
                    if (owner) {
                        if (hex.type === HexType.KING) {
                            fillColor = '#0f172a'; // King background is Darker
                        } else {
                            fillColor = owner.color; // Normal is Team Color
                        }
                    }

                    // Determine Stroke Color
                    let strokeColor = '#0f172a';
                    if (isMoveValid) {
                        strokeColor = '#ffffff';
                    } else if (hex.type === HexType.WALL) {
                        strokeColor = '#94a3b8';
                    } else if (hex.type === HexType.KING && owner) {
                        strokeColor = owner.color; // King gets a team-colored border
                    }

                    // Hexagon points
                    const points = [];
                    for (let i = 0; i < 6; i++) {
                        const angle_deg = 60 * i - 30;
                        const angle_rad = (Math.PI / 180) * angle_deg;
                        points.push(
                            `${HEX_SIZE * Math.cos(angle_rad)},${HEX_SIZE * Math.sin(angle_rad)}`
                        );
                    }

                    // Turret placement logic for King
                    const getTurretTransform = (index: number) => {
                        // Place 3 turrets in a triangle formation around the center
                        const r = 8;
                        const angles = [-90, 30, 150]; // Top, Bottom Right, Bottom Left
                        const rad = (angles[index] * Math.PI) / 180;
                        return { x: r * Math.cos(rad), y: r * Math.sin(rad) };
                    };

                    return (
                        <g
                            key={key}
                            transform={`translate(${centerX + x}, ${centerY + y})`}
                            onClick={() => interactive && isActionable ? onHexClick(hex.q, hex.r) : undefined}
                            className={`${interactive && isActionable ? 'cursor-pointer' : ''} transition-all duration-300 ease-in-out`}
                            style={{ pointerEvents: 'all' }}
                        >
                            {/* Main Hexagon Shape */}
                            <polygon
                                points={points.join(' ')}
                                fill={fillColor}
                                stroke={strokeColor}
                                strokeWidth={hex.type === HexType.WALL || hex.type === HexType.KING ? 3 : (isMoveValid ? 2 : 1)}
                                className={isMoveValid ? "animate-pulse" : ""}
                                opacity={0.95}
                            />

                            {/* Special Hex Icons */}
                            {hex.type === HexType.BANK && (
                                <foreignObject x={-8} y={-8} width={16} height={16} className="pointer-events-none">
                                    <Landmark size={16} className="text-yellow-400 drop-shadow-md" />
                                </foreignObject>
                            )}
                            {hex.type === HexType.WARP && (
                                <foreignObject x={-8} y={-8} width={16} height={16} className="pointer-events-none">
                                    <Zap size={16} className="text-cyan-400 drop-shadow-md" />
                                </foreignObject>
                            )}
                            {hex.type === HexType.WALL && (
                                <foreignObject x={-8} y={-8} width={16} height={16} className="pointer-events-none">
                                    <Shield size={16} className="text-white drop-shadow-md opacity-80" />
                                </foreignObject>
                            )}
                            {hex.type === HexType.TURRET && (
                                <g className="pointer-events-none">
                                    <circle cx={0} cy={0} r={9} fill="rgba(0,0,0,0.75)" stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                                    <foreignObject x={-8} y={-8} width={16} height={16}>
                                        <Crosshair size={16} className="text-red-500 drop-shadow-[0_0_3px_rgba(255,0,0,0.8)]" />
                                    </foreignObject>
                                </g>
                            )}
                            {hex.type === HexType.MINE && owner && (
                                <foreignObject x={-8} y={-8} width={16} height={16} className="pointer-events-none">
                                    <Bomb size={16} className="text-orange-500 drop-shadow-md" />
                                </foreignObject>
                            )}
                            {hex.type === HexType.KING && (
                                <g className="pointer-events-none">
                                    {/* King/Citadel Icon */}
                                    <foreignObject x={-8} y={-9} width={16} height={16}>
                                        <Crown
                                            size={16}
                                            color={owner ? owner.color : '#ffffff'}
                                            fill={owner ? owner.color : 'none'}
                                            className="drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]"
                                        />
                                    </foreignObject>

                                    {/* Attached Turrets */}
                                    {hex.turretCount && hex.turretCount > 0 && Array.from({ length: hex.turretCount }).map((_, i) => {
                                        const pos = getTurretTransform(i);
                                        return (
                                            <g key={`turret-${i}`} transform={`translate(${pos.x}, ${pos.y})`}>
                                                <circle r={3} fill="#000" stroke={owner?.color} strokeWidth={1} />
                                                <circle r={1.5} fill="red" className="animate-pulse" />
                                            </g>
                                        );
                                    })}
                                </g>
                            )}

                            {/* Owner Indicator */}
                            {owner && hex.type === HexType.NORMAL && (
                                <circle r={2} fill="rgba(255,255,255,0.2)" />
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

export default HexGrid;
