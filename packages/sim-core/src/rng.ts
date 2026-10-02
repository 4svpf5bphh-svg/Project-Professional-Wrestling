export function deterministicSeedFromText(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export class DeterministicRng {
  private state: number;

  constructor(seed: number) {
    this.state = (seed >>> 0) || 0x6d2b79f5;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(minInclusive: number, maxInclusive: number): number {
    if (maxInclusive < minInclusive) throw new Error("invalid integer range");
    return minInclusive + Math.floor(this.next() * (maxInclusive - minInclusive + 1));
  }

  float(minInclusive: number, maxExclusive: number): number {
    return minInclusive + this.next() * (maxExclusive - minInclusive);
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("cannot pick from empty collection");
    return items[this.int(0, items.length - 1)]!;
  }

  weightedPick<T>(items: readonly { value: T; weight: number }[]): T {
    if (items.length === 0) throw new Error("cannot pick from empty weighted collection");
    const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
    if (total <= 0) return items[0]!.value;
    let roll = this.float(0, total);
    for (const item of items) {
      roll -= Math.max(0, item.weight);
      if (roll <= 0) return item.value;
    }
    return items[items.length - 1]!.value;
  }
}
