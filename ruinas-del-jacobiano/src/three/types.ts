import type { EnemyKind, NpcId, ZoneId } from '../data/types';
import type { BossDef } from '../data/zones';

export interface PlayerSnapshot {
  x: number;
  y: number;
  speed: number;
  facingX: number;
  facingY: number;
  pose: string;
  hurt: boolean;
  dodge: boolean;
  guard: boolean;
  action: string;
  actionProgress: number;
}

export interface EnemySnapshot {
  id: string;
  kind: EnemyKind;
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  speed: number;
  state: string;
  hurt: boolean;
  dead: boolean;
}

export interface BossSnapshot {
  kind: BossDef['kind'];
  x: number;
  y: number;
  phase: number;
  state: string;
  dead: boolean;
  hurt: boolean;
}

export interface NpcSnapshot {
  id: NpcId;
  x: number;
  y: number;
}

export interface ProjectileSnapshot {
  x: number;
  y: number;
  color: number;
  home: boolean;
}

export interface WorldSnapshot {
  time: number;
  zoneId: ZoneId;
  player: PlayerSnapshot;
  enemies: EnemySnapshot[];
  boss: BossSnapshot | null;
  npcs: NpcSnapshot[];
  projectiles: ProjectileSnapshot[];
  solvedRunes: Record<string, boolean>;
  openedChests: Record<string, boolean>;
  mechanisms: Record<string, boolean>;
  switchStates: Record<string, boolean>;
  gateOpen: Record<string, boolean>;
  lens: boolean;
}
