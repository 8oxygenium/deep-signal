// フェーズ2の確認用（灰色の仮の台）
import './core/bridge';
import { Game } from './core/game';
import { Input, DEFAULT_BINDINGS } from './core/input';
import { Renderer } from './render/renderer';
import { testStage } from './stages/test';

const app = document.getElementById('app')!;
app.style.cssText = 'position:fixed;inset:0;background:#000';
const r = new Renderer(app, { quality: 'high', camera: 'fixed', shake: 1 });
let game = new Game(testStage);
r.setGame(game);
const hud = document.createElement('div');
hud.style.cssText = 'position:fixed;left:10px;top:10px;color:#fff;font:14px monospace;white-space:pre;text-shadow:0 0 3px #000';
document.body.appendChild(hud);
const input = new Input(DEFAULT_BINDINGS);
input.setHandler((a, down) => {
  if (a === 'left' || a === 'right') game.setFlipper(a, down);
  else if (a === 'launch') game.setLaunch(down);
  else if (a === 'nudgeLeft' && down) game.nudge('left');
  else if (a === 'nudgeRight' && down) game.nudge('right');
  else if (a === 'nudgeUp' && down) game.nudge('up');
  else if (a === 'debug') r.setDebug(!(r as unknown as { debug: boolean }).debug);
});
game.on((e) => e.t === 'rumble' && input.rumble(e.strong, e.weak, e.ms));
(window as unknown as { __pinball: unknown }).__pinball = { get game() { return game; }, r, reset() { game = new Game(testStage); r.setGame(game); } };
let last = performance.now();
function frame(now: number) {
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
  last = now;
  input.pollGamepads();
  game.update(dt);
  r.render(dt);
  hud.textContent = `SCORE ${game.score}  BALL ${game.ball}  state ${game.state}\ntilt ${game.tiltMeter.toFixed(2)} warn ${game.tiltWarnings} ${game.tilted ? 'TILT' : ''}  save ${game.ballSaveTimer.toFixed(1)}\npull ${game.plungerPull.toFixed(2)} skill ${game.skillWindow.map((v) => v.toFixed(2)).join('-')}`;
  if (!e2e) requestAnimationFrame(frame);
}
const e2e = !!window.hansode?.info.e2e;
if (e2e) setInterval(() => frame(performance.now()), 16);
else requestAnimationFrame(frame);
