import seedrandom from 'seedrandom';

export class SeededRandom {
  private rng: seedrandom.PRNG;

  constructor(seed: number | string) {
    this.rng = seedrandom(String(seed));
  }

  /** Returns a float in [0, 1) */
  next(): number {
    return this.rng();
  }

  /** Returns an integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Pick a random element from an array */
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  /** Shuffle an array in-place (Fisher-Yates) */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Generate a random identifier */
  identifier(length: number = 8): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[this.int(0, chars.length - 1)];
    }
    return result;
  }

  /** Generate a camelCase name */
  camelCase(): string {
    const adjectives = ['fast', 'slow', 'big', 'small', 'red', 'blue', 'new', 'old', 'hot', 'cold',
      'smart', 'safe', 'rich', 'poor', 'dark', 'light', 'deep', 'flat', 'raw', 'dry'];
    const nouns = ['handler', 'manager', 'service', 'factory', 'builder', 'parser', 'loader',
      'mapper', 'filter', 'sorter', 'counter', 'tracker', 'logger', 'sender', 'reader',
      'writer', 'checker', 'finder', 'runner', 'worker'];
    const adj = this.pick(adjectives);
    const noun = this.pick(nouns);
    return adj + noun.charAt(0).toUpperCase() + noun.slice(1);
  }

  /** Generate a PascalCase class name */
  pascalCase(): string {
    const prefixes = ['Base', 'Abstract', 'Default', 'Custom', 'Internal', 'Core', 'Main', 'Primary'];
    const names = ['Controller', 'Repository', 'Validator', 'Transformer', 'Processor',
      'Aggregator', 'Dispatcher', 'Resolver', 'Adapter', 'Decorator', 'Observer',
      'Mediator', 'Strategy', 'Iterator', 'Command', 'Provider', 'Gateway', 'Proxy'];
    return this.pick(prefixes) + this.pick(names);
  }
}
