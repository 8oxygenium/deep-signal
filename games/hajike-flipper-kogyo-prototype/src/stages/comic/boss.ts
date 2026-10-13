// ボスの名前・色・HPなど（ルールと3D装飾の両方から使う）

export interface BossLook {
  name: string;
  /** 肌 */
  skin: string;
  /** コート・マント */
  coat: string;
  /** 帽子・角 */
  hat: string;
  /** 目の光 */
  eye: string;
  /** 吹き出しの決めゼリフ */
  line: string;
}

export const BOSSES: BossLook[] = [
  { name: 'DR. KABOOM', skin: '#7be07a', coat: '#7a2cff', hat: '#ffd21f', eye: '#ff2d2d', line: 'MUAHAHA!' },
  { name: 'BARON BLAM', skin: '#ffb36b', coat: '#c7261d', hat: '#2a2a35', eye: '#35e0ff', line: 'BOW TO ME!' },
  { name: 'MADAME MAYHEM', skin: '#ff8fd0', coat: '#1f8f5a', hat: '#7a2cff', eye: '#ffe14a', line: 'CHAOS TIME!' },
  { name: 'GENERAL GRIM', skin: '#a6b4d8', coat: '#3a4258', hat: '#ff2d2d', eye: '#ffd21f', line: 'ATTACK!' },
  { name: 'CAPTAIN CRUSH', skin: '#6fd0ff', coat: '#ff8a1e', hat: '#14122b', eye: '#ff2d2d', line: 'SMASH!' },
  { name: 'PROFESSOR PAIN', skin: '#d6a6ff', coat: '#2f6bff', hat: '#ffffff', eye: '#7cff5a', line: 'SCIENCE!' },
  { name: 'KING KRAK', skin: '#ffd21f', coat: '#14122b', hat: '#ff2d2d', eye: '#ffffff', line: 'I AM KING!' },
];

export const bossLook = (level: number): BossLook => BOSSES[level % BOSSES.length];

/** 周回するごとにHPが増える */
export const bossMaxHp = (level: number): number => 9 + Math.min(level, 8) * 4;

/** 吹き出しのセリフ（g.vars.say の番号） */
export const SAYINGS = ['GRRR!', 'OUCH!', 'HA HA HA!', 'NOT AGAIN!', 'ARGH!', 'NOOO!!', 'YOU CANNOT WIN!', 'OOF!', 'POW?!'];
export const SAY = { GRRR: 0, OUCH: 1, HAHA: 2, AGAIN: 3, ARGH: 4, NOOO: 5, CANNOT: 6, OOF: 7, POW: 8 } as const;
