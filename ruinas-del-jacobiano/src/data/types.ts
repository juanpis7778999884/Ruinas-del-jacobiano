export type ZoneId = 'cartesia' | 'llanura' | 'valle' | 'ciudad' | 'templo';

export type ItemId =
  | 'fubini'
  | 'polar'
  | 'lente'
  | 'pocion'
  | 'fragmento_norte'
  | 'fragmento_este'
  | 'fragmento_sur'
  | 'reliquia_carton';

export type RelicId = 'corazon_roto' | 'brujula_giros' | 'ojo_cartografo';

export type QuestId = 'llamada_cartografo' | 'ecos_del_bosque' | 'fragmentos_reliquia' | 'archivo_prohibido';

export type EnemyKind = 'espiritu' | 'espino' | 'centinela' | 'arquero' | 'sombra';

export type NpcId =
  | 'anciana'
  | 'fubini'
  | 'guardiana'
  | 'cartografa'
  | 'sabio'
  | 'errante'
  | 'recaudador';

export type LoreId = 'tabla_origen' | 'carta_exilio' | 'diario_ultimo' | 'inscripcion_singular';

export interface GridPos {
  x: number;
  y: number;
}
