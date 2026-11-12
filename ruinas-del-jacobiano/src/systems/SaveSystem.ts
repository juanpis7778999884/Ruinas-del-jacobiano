import { SAVE_KEY } from '../config';
import { ItemId, ZoneId } from '../data/types';

export interface SaveData {
  version: 1;
  hearts: number;
  maxHearts: number;
  items: Record<ItemId, boolean>;
  completed: Partial<Record<ZoneId, boolean>>;
  solvedRunes: Record<string, boolean>;
  bossPhase: Record<string, number>;
  seenIntro: Record<string, boolean>;
  currentZone: ZoneId;
  stats: { correct: number; wrong: number };
  victory: boolean;
}

const defaults = (): SaveData => ({
  version: 1,
  hearts: 5,
  maxHearts: 5,
  items: { fubini: false, polar: false, lente: false },
  completed: {},
  solvedRunes: {},
  bossPhase: {},
  seenIntro: {},
  currentZone: 'cartesia',
  stats: { correct: 0, wrong: 0 },
  victory: false,
});

class SaveSystemImpl {
  data: SaveData;

  constructor() {
    this.data = this.load() ?? defaults();
  }

  exists(): boolean {
    try {
      return localStorage.getItem(SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  private load(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const base = defaults();
      return {
        ...base,
        ...parsed,
        items: { ...base.items, ...(parsed.items ?? {}) },
        stats: { ...base.stats, ...(parsed.stats ?? {}) },
      };
    } catch {
      return null;
    }
  }

  save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      /* modo privado o sin espacio: se ignora */
    }
  }

  reset(): void {
    this.data = defaults();
    this.save();
  }
}

export const Save = new SaveSystemImpl();
