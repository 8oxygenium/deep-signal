// 設定・ハイスコアの保存（Electron のユーザーデータ領域に JSON で保存）
import type { CameraMode } from '../render/renderer';
import type { Quality } from '../render/materials';
import { bridge } from './bridge';
import { DEFAULT_BINDINGS, type Bindings, type GameAction } from './input';

export interface Settings {
  bgm: number;
  sfx: number;
  /** 画面揺れの強さ 0..1（0 = オフ） */
  shake: number;
  camera: CameraMode;
  quality: Quality;
  fullscreen: boolean;
  rumble: boolean;
  bindings: Bindings;
}

export const DEFAULT_SETTINGS: Settings = {
  bgm: 0.6,
  sfx: 0.8,
  shake: 0.8,
  camera: 'fixed',
  quality: 'high',
  fullscreen: false,
  rumble: true,
  bindings: DEFAULT_BINDINGS,
};

export interface ScoreEntry {
  name: string;
  score: number;
  /** 生存時間（秒、IMPOSSIBLE） */
  time?: number;
  date: string;
}

export type HighScores = Record<string, ScoreEntry[]>;

export interface AppState {
  /** 固定キーの案内を次から表示しない */
  guideHidden: boolean;
  lastStage: string;
}

function clamp01(v: unknown, d: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d;
}

export async function loadSettings(): Promise<Settings> {
  const raw = ((await bridge.load('settings')) ?? {}) as Partial<Settings>;
  const b = { ...DEFAULT_BINDINGS } as Bindings;
  if (raw.bindings && typeof raw.bindings === 'object') {
    for (const k of Object.keys(DEFAULT_BINDINGS) as GameAction[]) {
      const v = (raw.bindings as Bindings)[k];
      if (Array.isArray(v) && v.every((x) => typeof x === 'string') && v.length) b[k] = v.slice(0, 3);
    }
  }
  return {
    bgm: clamp01(raw.bgm, DEFAULT_SETTINGS.bgm),
    sfx: clamp01(raw.sfx, DEFAULT_SETTINGS.sfx),
    shake: clamp01(raw.shake, DEFAULT_SETTINGS.shake),
    camera: raw.camera === 'follow' || raw.camera === 'top' ? raw.camera : 'fixed',
    quality: raw.quality === 'low' || raw.quality === 'mid' ? raw.quality : 'high',
    fullscreen: !!raw.fullscreen,
    rumble: raw.rumble !== false,
    bindings: b,
  };
}

export function saveSettings(s: Settings): Promise<boolean> {
  return bridge.save('settings', s);
}

export async function loadScores(): Promise<HighScores> {
  const raw = (await bridge.load('highscores')) as HighScores | null;
  const out: HighScores = {};
  if (raw && typeof raw === 'object') {
    for (const [k, list] of Object.entries(raw)) {
      if (!Array.isArray(list)) continue;
      out[k] = list
        .filter((e) => e && typeof e.name === 'string' && typeof e.score === 'number')
        .map((e) => ({ name: String(e.name).slice(0, 8), score: Math.max(0, Math.floor(e.score)), time: typeof e.time === 'number' ? e.time : undefined, date: String(e.date ?? '') }))
        .slice(0, 10);
    }
  }
  return out;
}

export function saveScores(s: HighScores): Promise<boolean> {
  return bridge.save('highscores', s);
}

export async function loadState(): Promise<AppState> {
  const raw = ((await bridge.load('state')) ?? {}) as Partial<AppState>;
  return { guideHidden: !!raw.guideHidden, lastStage: typeof raw.lastStage === 'string' ? raw.lastStage : '' };
}

export function saveState(s: AppState): Promise<boolean> {
  return bridge.save('state', s);
}

/** ハイスコアの何位に入るか（入らなければ -1） */
export function rankOf(list: ScoreEntry[] | undefined, score: number): number {
  const l = list ?? [];
  if (score <= 0) return -1;
  let i = 0;
  while (i < l.length && l[i].score >= score) i++;
  return i < 10 ? i : -1;
}

export function insertScore(scores: HighScores, stage: string, e: ScoreEntry): number {
  const list = scores[stage] ?? [];
  const i = rankOf(list, e.score);
  if (i < 0) return -1;
  list.splice(i, 0, e);
  scores[stage] = list.slice(0, 10);
  return i;
}
