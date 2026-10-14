// UKIYO-E 専用の3D装飾：提灯・太鼓・鳥居・社殿・七福神の立て札、鯉の滝・龍のランプ、地面の版画、屏風、大波の演出
import type { DecorateApi } from '../types';
import { Kit } from './kit';
import { buildGround } from './ground';
import { buildProps } from './props';
import { buildDragon, buildKoiRamp } from './ramps';
import { buildScreen } from './scenery';
import { buildWave } from './wave';

export function decorateUkiyoe(api: DecorateApi): void {
  const kit = new Kit(api);
  const { game } = api;
  buildGround(kit);
  buildScreen(kit);
  const props = buildProps(kit, game);
  const koi = buildKoiRamp(kit);
  const dragon = buildDragon(kit, game);
  const wave = buildWave(kit, game);

  api.onFrame((t, dt) => {
    koi.update(t, dt);
    dragon.update(t, dt);
    wave.update();
  });

  // 台を作り直す・切り替えるときに購読を外す（画質を変えるたびに増えないように）
  api.onDispose(
    game.on((e) => {
      if (e.t === 'table') {
        const te = e.e;
        if (te.type === 'trigger' && te.id === 'torii') props.toriiPulse();
        if (te.type === 'scoop' && te.id === 'shrine') props.shrineShake();
        if (te.type === 'ramp-enter') {
          if (te.id === 'koi') koi.rush();
          else if (te.id === 'ryu') dragon.rush();
        }
      } else if (e.t === 'fx' && e.name === 'wave') {
        wave.start();
      }
    }),
  );
}
