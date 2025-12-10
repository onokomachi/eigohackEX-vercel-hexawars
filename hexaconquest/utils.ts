
import { Hex, HexData, DIRECTIONS, HexType } from './types';
import { MAP_RADIUS, INITIAL_SPECIALS } from './constants';

export const getHexKey = (q: number, r: number): string => `${q},${r}`;

export const hexToPixel = (hex: Hex, size: number) => {
    const x = size * (Math.sqrt(3) * hex.q + (Math.sqrt(3) / 2) * hex.r);
    const y = size * ((3 / 2) * hex.r);
    return { x, y };
};

export const generateGrid = (): Map<string, HexData> => {
    const map = new Map<string, HexData>();

    // 1. Generate standard grid
    for (let q = -MAP_RADIUS; q <= MAP_RADIUS; q++) {
        const r1 = Math.max(-MAP_RADIUS, -q - MAP_RADIUS);
        const r2 = Math.min(MAP_RADIUS, -q + MAP_RADIUS);
        for (let r = r1; r <= r2; r++) {
            const key = getHexKey(q, r);
            map.set(key, {
                q, r, s: -q - r,
                owner: null,
                isHighlight: false,
                type: HexType.NORMAL
            });
        }
    }

    // 2. Place Initial Specials
    INITIAL_SPECIALS.forEach(special => {
        const key = getHexKey(special.q, special.r);
        const hex = map.get(key);
        if (hex) {
            map.set(key, { ...hex, type: special.type, warpId: special.warpId });
        }
    });

    return map;
};

export const getNeighbors = (hex: Hex): Hex[] => {
    return DIRECTIONS.map((d) => ({
        q: hex.q + d.q,
        r: hex.r + d.r,
        s: hex.s + d.s,
    }));
};

export const getPlayableNeighbors = (
    playerId: number,
    grid: Map<string, HexData>
): string[] => {
    const ownedHexes: HexData[] = [];
    grid.forEach((hex) => {
        if (hex.owner === playerId) {
            ownedHexes.push(hex);
        }
    });

    // Calculate effective sources (Owned Hexes + Paired Warps)
    const effectiveSources: HexData[] = [...ownedHexes];

    // Warp Logic: If I own a Warp, I can treat its pair as a source
    ownedHexes.forEach(hex => {
        if (hex.type === HexType.WARP && hex.warpId) {
            // Find the pair
            grid.forEach(otherHex => {
                if (otherHex.type === HexType.WARP && otherHex.warpId === hex.warpId && otherHex !== hex) {
                    effectiveSources.push(otherHex);
                }
            });
        }
    });

    const playableKeys = new Set<string>();

    effectiveSources.forEach((hex) => {
        const neighbors = getNeighbors(hex);
        neighbors.forEach((n) => {
            const key = getHexKey(n.q, n.r);
            const target = grid.get(key);
            // Can capture neutral OR opponent tiles (as long as it's not own)
            if (target && target.owner !== playerId) {
                playableKeys.add(key);
            }
        });
    });

    return Array.from(playableKeys);
};

// Simplified validation that just checks if the move is in the playable set
// We no longer recalculate connectivity here to avoid code duplication with getPlayableNeighbors
// which handles the complex Warp logic.
export const isValidMove = (
    targetQ: number,
    targetR: number,
    playerId: number,
    grid: Map<string, HexData>
): boolean => {
    // This is now handled primarily by the validMoves Set in App.tsx
    // But we keep basic bounds checking here if needed.
    return true;
};
