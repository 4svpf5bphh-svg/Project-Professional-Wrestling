export class DeterministicRng {
  private state: number;

  constructor(seed: number) {
    this.state = (seed >>> 0) || 0x6d2b79f5;
  }

  next(): number {
    // Mulberry32: compact, deterministic and suitable for simulation prototyping.
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
}
