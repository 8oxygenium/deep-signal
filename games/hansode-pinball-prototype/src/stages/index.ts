// ステージの一覧。ステージを増やすときは stages/ にファイルを1つ作ってここに並べる。
import type { StageDef } from './types';
import { modernStage } from './modern';
import { animeStage } from './anime';
import { comicStage } from './comic';
import { route50sStage } from './route50s';
import { cyberStage } from './cyber';
import { impossibleStage } from './impossible';
import { testStage } from './test';

export const STAGES: StageDef[] = [modernStage, animeStage, comicStage, route50sStage, cyberStage, impossibleStage];

export function stageById(id: string): StageDef | undefined {
  return [...STAGES, testStage].find((s) => s.id === id);
}
