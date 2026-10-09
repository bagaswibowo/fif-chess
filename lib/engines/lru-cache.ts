/**
 * In-memory LRU Cache for evaluated chess positions.
 * Eliminates redundant MCTS/engine calculations for popular transpositions (<1ms response).
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

export class FenLruCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxEntries: number;

  constructor(maxEntries = 5000) {
    this.maxEntries = maxEntries;
  }

  get(fen: string): T | undefined {
    const entry = this.cache.get(fen);
    if (!entry) return undefined;
    // Refresh position to back of Map for LRU
    this.cache.delete(fen);
    this.cache.set(fen, entry);
    return entry.value;
  }

  set(fen: string, value: T): void {
    if (this.cache.has(fen)) {
      this.cache.delete(fen);
    } else if (this.cache.size >= this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(fen, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

export const fenEngineCache = new FenLruCache<any>(5000);
