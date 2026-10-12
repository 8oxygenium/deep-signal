import './ui/style.css';
import { App } from './core/app';
import { bridge } from './core/bridge';
import { STAGES } from './stages';

const root = document.getElementById('app')!;
const app = new App();
void app.init(root);

// 自動テスト（Playwright）用のフック
if (bridge.info.e2e || bridge.info.isDev) {
  (window as unknown as { __pinball: unknown }).__pinball = {
    app,
    stages: STAGES.map((s) => s.id),
    stageDefs: STAGES,
    get screen() {
      return app.screen;
    },
    get game() {
      return app.game;
    },
    get fps() {
      return app.fps;
    },
  };
}
