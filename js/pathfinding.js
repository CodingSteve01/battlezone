// ===== A* PATHFINDING =====

import { hexDistance, getNeighbors } from './hexMath.js';
import { getHex, state, isHexInZone } from './state.js';
import { TERRAIN } from './config.js';

const roundMoveCost = (value) => Math.round(value * 2) / 2;

/**
 * Priority Queue implementation for A*
 */
class PriorityQueue {
    constructor() {
        this.elements = [];
    }

    enqueue(item, priority) {
        this.elements.push({ item, priority });
        this.elements.sort((a, b) => a.priority - b.priority);
    }

    dequeue() {
        return this.elements.shift()?.item;
    }

    isEmpty() {
        return this.elements.length === 0;
    }
}

/**
 * A* pathfinding algorithm
 * Returns path as array of hex coordinates and total cost
 */
export function findPath(startQ, startR, goalQ, goalR, maxCost = Infinity) {
    const startKey = `${startQ},${startR}`;
    const goalKey = `${goalQ},${goalR}`;

    // Check if goal is reachable
    const goalHex = getHex(goalQ, goalR);
    if (!goalHex || !goalHex.walkable || goalHex.unit) {
        return null;
    }

    // Block movement into the restricted zone (outside shrinking zone)
    if (state.zoneRadius > 0 && state.zoneRadius < state.maxZoneRadius) {
        if (!isHexInZone(goalQ, goalR)) {
            return null; // Can't path into restricted zone
        }
    }

    const frontier = new PriorityQueue();
    frontier.enqueue({ q: startQ, r: startR }, 0);

    const cameFrom = new Map();  // key -> previous hex
    const costSoFar = new Map(); // key -> cost to reach

    cameFrom.set(startKey, null);
    costSoFar.set(startKey, 0);

    while (!frontier.isEmpty()) {
        const current = frontier.dequeue();
        const currentKey = `${current.q},${current.r}`;

        // Reached goal
        if (currentKey === goalKey) {
            break;
        }

        // Check all neighbors
        const neighbors = getNeighbors(current.q, current.r);

        for (const next of neighbors) {
            const nextHex = getHex(next.q, next.r);
            if (!nextHex || !nextHex.walkable) continue;

            // Can't move through other units (except start position)
            const nextKey = `${next.q},${next.r}`;
            if (nextHex.unit && nextKey !== startKey && nextKey !== goalKey) continue;

            // Block movement into restricted zone
            if (state.zoneRadius > 0 && state.zoneRadius < state.maxZoneRadius) {
                if (!isHexInZone(next.q, next.r)) continue;
            }

            const terrain = TERRAIN[nextHex.type];
            const moveCost = terrain.moveCost || 1;
            const newCost = roundMoveCost(costSoFar.get(currentKey) + moveCost);

            // Skip if exceeds max cost
            if (newCost > maxCost) continue;

            if (!costSoFar.has(nextKey) || newCost < costSoFar.get(nextKey)) {
                costSoFar.set(nextKey, newCost);
                const priority = newCost + hexDistance(next, { q: goalQ, r: goalR });
                frontier.enqueue(next, priority);
                cameFrom.set(nextKey, current);
            }
        }
    }

    // Reconstruct path
    if (!cameFrom.has(goalKey)) {
        return null; // No path found
    }

    const path = [];
    let current = { q: goalQ, r: goalR };

    while (current) {
        path.unshift(current);
        const key = `${current.q},${current.r}`;
        current = cameFrom.get(key);
    }

    return {
        path,
        cost: costSoFar.get(goalKey)
    };
}

/**
 * Get all reachable hexes from a position within a cost budget
 * Returns Map of "q,r" -> { hex, cost, path }
 *
 * Uses shared AP pool system:
 * - Movement costs are paid from the shared AP pool
 */
export function getReachableHexes(unit) {
    // Movement is limited by available AP in the shared pool
    const maxCost = state.sharedAP;
    const startKey = `${unit.q},${unit.r}`;

    // Check if zone is active (shrinking has started)
    const zoneActive = state.zoneRadius > 0 && state.zoneRadius < state.maxZoneRadius;

    const frontier = new PriorityQueue();
    frontier.enqueue({ q: unit.q, r: unit.r }, 0);

    const reached = new Map();
    const costSoFar = new Map();
    const cameFrom = new Map();

    costSoFar.set(startKey, 0);
    cameFrom.set(startKey, null);

    while (!frontier.isEmpty()) {
        const current = frontier.dequeue();
        const currentKey = `${current.q},${current.r}`;

        const neighbors = getNeighbors(current.q, current.r);

        for (const next of neighbors) {
            const nextHex = getHex(next.q, next.r);
            if (!nextHex || !nextHex.walkable) continue;

            const nextKey = `${next.q},${next.r}`;

            // Can't move through other units
            if (nextHex.unit && nextKey !== startKey) continue;

            // Block movement into restricted zone
            if (zoneActive && !isHexInZone(next.q, next.r)) continue;

            const terrain = TERRAIN[nextHex.type];
            const moveCost = terrain.moveCost || 1;
            const newCost = roundMoveCost(costSoFar.get(currentKey) + moveCost);

            if (newCost > maxCost) continue;

            if (!costSoFar.has(nextKey) || newCost < costSoFar.get(nextKey)) {
                costSoFar.set(nextKey, newCost);
                frontier.enqueue(next, newCost);
                cameFrom.set(nextKey, current);

                // Don't include hexes with units (except start)
                if (!nextHex.unit) {
                    reached.set(nextKey, {
                        hex: nextHex,
                        cost: newCost
                    });
                }
            }
        }
    }

    // Add paths to reached hexes
    reached.forEach((data, key) => {
        const path = [];
        let current = { q: data.hex.q, r: data.hex.r };

        while (current) {
            path.unshift(current);
            const k = `${current.q},${current.r}`;
            current = cameFrom.get(k);
        }

        data.path = path;
    });

    return reached;
}

/**
 * Get path to specific hex from reachable hexes data
 */
export function getPathToHex(reachableHexes, targetQ, targetR) {
    const key = `${targetQ},${targetR}`;
    const data = reachableHexes.get(key);
    return data ? data : null;
}
