// ステージの一覧。ステージを増やすときは stages/ にファイルを1つ作ってここに並べる。
import type { StageDef } from './types';
import { testStage } from './test';

export const STAGES: StageDef[] = [testStage];

export function stageById(id: string): StageDef | undefined {
  return [...STAGES, testStage].find((s) => s.id === id);
}
