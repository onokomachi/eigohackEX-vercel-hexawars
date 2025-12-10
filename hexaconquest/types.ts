
export type PlayerColor = string;

export interface Player {
    id: number;
    name: string;
    color: PlayerColor;
    score: number;
    isAi: boolean;
    actionPoints: number; // Points accumulate across turns
    isDead: boolean; // Track if player is eliminated
}

export interface Hex {
    q: number;
    r: number;
    s: number;
}

export enum HexType {
    NORMAL = 'NORMAL',
    BANK = 'BANK',
    WARP = 'WARP',
    WALL = 'WALL',
    TURRET = 'TURRET',
    MINE = 'MINE',
    KING = 'KING' // Now acts as "CITADEL"
}

export interface HexData extends Hex {
    owner: number | null; // Player ID or null if neutral
    isHighlight: boolean;
    type: HexType;
    warpId?: number; // If type is WARP, this ID links pairs (1 connects to 1)
    health?: number; // For Citadel/King tiles (Siege mechanics)
    turretCount?: number; // For Citadel upgrades (0-3)
}

export enum GamePhase {
    SETUP = 'SETUP',
    ROLLING = 'ROLLING',
    EXPANDING = 'EXPANDING',
    GAME_OVER = 'GAME_OVER',
}

export interface GameState {
    players: Player[];
    grid: Map<string, HexData>; // Key is "q,r"
    currentPlayerIndex: number;
    phase: GamePhase;
    turnCount: number;
    logs: string[];
    buildMode?: HexType | null; // Track if player is trying to build a structure
}

export const DIRECTIONS = [
    { q: 1, r: 0, s: -1 },
    { q: 1, r: -1, s: 0 },
    { q: 0, r: -1, s: 1 },
    { q: -1, r: 0, s: 1 },
    { q: -1, r: 1, s: 0 },
    { q: 0, r: 1, s: -1 },
];
