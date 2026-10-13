// ステージの一覧。ステージを増やすときは stages/ にファイルを1つ作ってここに並べる。
import type { StageDef } from './types';
import { modernStage } from './modern';
import { animeStage } from './anime';
import { comicStage } from './comic';
import { route50sStage } from './route50s';
import { cyberStage } from './cyber';
import { ukiyoeStage } from './ukiyoe';
import { impossibleStage } from './impossible';
import { testStage } from './test';

// 並び順：IMPOSSIBLE はいつも最後（選択画面でドキッとさせる演出）
export const STAGES: StageDef[] = [modernStage, animeStage, comicStage, route50sStage, cyberStage, ukiyoeStage, impossibleStage];

export function stageById(id: string): StageDef | undefined {
  return [...STAGES, testStage].find((s) => s.id === id);
}
