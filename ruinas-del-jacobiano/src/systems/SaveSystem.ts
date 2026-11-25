import { SAVE_KEY } from '../config';
import { ItemId, QuestId, RelicId, ZoneId } from '../data/types';
import type { KeyBindings } from './actions';

export interface SaveData {
  version: 2;
  hearts: number;
  maxHearts: number;
  items: Record<ItemId, number>;
  equipped: { weapon: 'hoja_oxidada' | ItemId; relic: RelicId | null };
  completed: Partial<Record<ZoneId, boolean>>;
  solvedRunes: Record<string, boolean>;
  bossPhase: Record<string, number>;
  seenIntro: Record<string, boolean>;
  currentZone: ZoneId;
  position: Partial<Record<ZoneId, { x: number; y: number }>>;
  stats: { correct: number; wrong: number; kills: number; deaths: number; gold: number };
  victory: boolean;
  flags: Record<string, boolean>;
  counters: Record<string, number>;
  openedChests: Record<string, boolean>;
  mechanisms: Record<string, boolean>;
  quests: Record<QuestId, { progress: number; done: boolean }>;
  discovered: Partial<Record<ZoneId, boolean>>;
  settings: { music: number; sfx: number; typewriter: boolean; shake: boolean; keymap?: Partial<KeyBindings> };
  playtime: number;
}

const ALL_ITEMS: ItemId[] = [
  'fubini', 'polar', 'lente', 'pocion',
  'fragmento_norte', 'fragmento_este', 'fragmento_sur', 'reliquia_carton',
];

const zeroItems = (): Record<ItemId, number> =>
  Object.fromEntries(ALL_ITEMS.map((i) => [i, 0])) as Record<ItemId, number>;

export const defaults = (): SaveData => ({
  version: 2,
  hearts: 6,
  maxHearts: 6,
  items: zeroItems(),
  equipped: { weapon: 'hoja_oxidada', relic: null },
  completed: {},
  solvedRunes: {},
  bossPhase: {},
  seenIntro: {},
  currentZone: 'cartesia',
  position: {},
  stats: { correct: 0, wrong: 0, kills: 0, deaths: 0, gold: 0 },
  victory: false,
  flags: {},
  counters: {},
  openedChests: {},
  mechanisms: {},
  quests: {
    llamada_cartografo: { progress: 0, done: false },
    ecos_del_bosque: { progress: 0, done: false },
    fragmentos_reliquia: { progress: 0, done: false },
    archivo_prohibido: { progress: 0, done: false },
  },
  discovered: { cartesia: true },
  settings: { music: 0.55, sfx: 0.7, typewriter: true, shake: true, keymap: {} },
  playtime: 0,
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
      const parsed = JSON.parse(raw) as Partial<Omit<SaveData, 'version'>> & { version?: number };
      const base = defaults();
      if (parsed.version === 1) {
        const oldItems = (parsed.items ?? {}) as unknown as Record<string, boolean>;
        const migrated = zeroItems();
        (['fubini', 'polar', 'lente'] as ItemId[]).forEach((id) => {
          migrated[id] = oldItems[id] ? 1 : 0;
        });
        parsed.items = migrated;
        parsed.version = 2;
      }
      return {
        ...base,
        ...parsed,
        version: 2,
        items: { ...base.items, ...(parsed.items ?? {}) },
        equipped: { ...base.equipped, ...(parsed.equipped ?? {}) },
        stats: { ...base.stats, ...(parsed.stats ?? {}) },
        settings: {
          ...base.settings,
          ...(parsed.settings ?? {}),
          keymap: { ...(base.settings.keymap ?? {}), ...(parsed.settings?.keymap ?? {}) },
        },
        quests: { ...base.quests, ...(parsed.quests ?? {}) },
        flags: { ...base.flags, ...(parsed.flags ?? {}) },
        counters: { ...base.counters, ...(parsed.counters ?? {}) },
        openedChests: { ...base.openedChests, ...(parsed.openedChests ?? {}) },
        mechanisms: { ...base.mechanisms, ...(parsed.mechanisms ?? {}) },
        position: { ...base.position, ...(parsed.position ?? {}) },
        discovered: { ...base.discovered, ...(parsed.discovered ?? {}) },
      } as SaveData;
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

  addItem(id: ItemId, n = 1): void {
    this.data.items[id] = (this.data.items[id] ?? 0) + n;
    this.save();
  }

  consume(id: ItemId): boolean {
    if ((this.data.items[id] ?? 0) <= 0) return false;
    this.data.items[id]--;
    this.save();
    return true;
  }

  heal(n: number): number {
    const before = this.data.hearts;
    this.data.hearts = Math.min(this.data.maxHearts, this.data.hearts + n);
    this.save();
    return this.data.hearts - before;
  }

  setFlag(key: string, value = true): void {
    this.data.flags[key] = value;
    this.save();
  }

  advanceQuest(id: QuestId, progress: number): void {
    const q = this.data.quests[id];
    if (!q) return;
    q.progress = Math.max(q.progress, progress);
    this.save();
  }
}

export const Save = new SaveSystemImpl();
