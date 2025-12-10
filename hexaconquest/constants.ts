
import { Player, HexType } from './types';

export const MAP_RADIUS = 13; // Increased size to 13 for 30-player teams
export const HEX_SIZE = 11; // Smaller hexes to fit the larger grid

// Gameplay Constants (Inflated for Team AP Pools)
export const COST_MOVE_NEUTRAL = 5;
export const COST_MOVE_ENEMY = 10;
export const COST_EXTRA_WALL = 15; // Walls are very tough
export const BANK_AP_BONUS = 5; // Banks are more valuable
export const COST_ATTACK_CITADEL = 12; // Cost to damage the Citadel (needs 3 hits = 36 total)
export const COST_REPAIR_CITADEL = 5; // Cost to repair 1 HP
export const COST_UPGRADE_CITADEL_TURRET = 30; // Cost to add a turret to Citadel

export const CITADEL_MAX_HEALTH = 5;
export const MAX_CITADEL_TURRETS = 3;

export const BUILD_COSTS = {
    [HexType.WALL]: 20,
    [HexType.TURRET]: 50,
    [HexType.MINE]: 15,
};

// Initial Special Hexes
// Central Bank and 3 Pairs of Warps (Pushed out to ring 8)
export const INITIAL_SPECIALS = [
    { q: 0, r: 0, type: HexType.BANK },
    // Warp Pair 1 (Vertical Axis)
    { q: 0, r: -8, type: HexType.WARP, warpId: 1 },
    { q: 0, r: 8, type: HexType.WARP, warpId: 1 },
    // Warp Pair 2 (Diagonal)
    { q: 8, r: -8, type: HexType.WARP, warpId: 2 },
    { q: -8, r: 8, type: HexType.WARP, warpId: 2 },
    // Warp Pair 3 (Diagonal)
    { q: 8, r: 0, type: HexType.WARP, warpId: 3 },
    { q: -8, r: 0, type: HexType.WARP, warpId: 3 },
];

export const PLAYER_CONFIGS: Player[] = [
    { id: 0, name: 'class1', color: '#f8fafc', score: 1, isAi: false, actionPoints: 0, isDead: false }, // White
    { id: 1, name: 'class2', color: '#3b82f6', score: 1, isAi: false, actionPoints: 0, isDead: false }, // Blue
    { id: 2, name: 'class3', color: '#f97316', score: 1, isAi: false, actionPoints: 0, isDead: false }, // Orange
    { id: 3, name: 'class4', color: '#ef4444', score: 1, isAi: false, actionPoints: 0, isDead: false }, // Red
    { id: 4, name: 'class5', color: '#22c55e', score: 1, isAi: false, actionPoints: 0, isDead: false }, // Green
    { id: 5, name: 'class6', color: '#ec4899', score: 1, isAi: false, actionPoints: 0, isDead: false }, // Pink
];

// Starting positions at the new edge (Ring 13)
export const STARTING_POSITIONS = [
    { q: 0, r: -13, s: 13 }, // Top
    { q: 13, r: -13, s: 0 }, // Top Right
    { q: 13, r: 0, s: -13 }, // Bottom Right
    { q: 0, r: 13, s: -13 }, // Bottom
    { q: -13, r: 13, s: 0 }, // Bottom Left
    { q: -13, r: 0, s: 13 }, // Top Left
];
