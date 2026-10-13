# ステージの作り方（ステージ担当向け）

1ステージ = **配置（layout）＋ルール（rules）＋見た目（theme）＋音（music / sfx）**。
`src/stages/<id>.ts` を1つ書けば完成する。お手本は **`src/stages/modern.ts`**。

## 触ってよいファイル / いけないファイル

- 触ってよい：自分の `src/stages/<id>.ts`、必要なら自分専用のフォルダ `src/stages/<id>/`（描画・音の補助ファイル）。
- **触ってはいけない**：`src/physics/` `src/core/` `src/table/` `src/render/` `src/audio/` `src/ui/` 他のステージ、`tests/`（自分用の追加テスト `tests/<id>.test.ts` はOK）。
- 共通部分に足りない機能があれば、自分で直さず「要望」としてメインに返す。

## 座標

- ボール直径 = 1。x：左 -8.6 〜 右 8.6 が遊ぶ範囲（右の 8.8〜10.1 は発射レーン）。y：手前 0 〜 奥 40。
- 角度は度。x軸+方向が0、反時計回りが+（90 = 奥へ向かう）。
- 上部アーチ：中心 (0.75, 30.5) 半径 9.45。フリッパーの支点は (±4.0, 4.6)。
- `chassis(options)`（`src/table/chassis.ts`）が外枠・発射レーン・アーチ・フリッパー・スリング・インレーン/アウトレーン・オービット出入口を作る。
  - 主なオプション：`flipperLength` `flipperPower` `kickbackLeft/Right` `outlanePosts` `orbits:false` `orbitTop` `slingKick` `plungerMin/Max` `noLower`（下側を自前で作る）。
  - 下側が作る部品ID：`flipperL/R` `slingL/R` `inlaneL/R` `outlaneL/R`（ロールオーバーとライト）、`kickbackL/R`、`shootAgain`。

## 部品（`src/table/types.ts`）

`wall`（折れ線の壁。style: wall/guide/rubber/metal/invisible、`dynamic:true` で動かせる・消せる）、`arc`、`post`、
`bumper`（ポップバンパー。`dynamic:true` で歩かせられる）、`sling`、`drop`（バンクで全部倒すと `bank` イベント）、
`standup`（`big:true` で大きな的）、`spinner`、`rollover`、`gate`（一方通行）、`scoop`（捕まえて吐き出す）、
`kickback`、`magnet`、`ramp`（レイヤー。path と高さ h）、`flipper`（追加フリッパーもOK）、`warp`（ワープ。tube で管を描く）、
`trigger`（通過判定の線）、`light`（床の光る印。shape/rot/color/label）、`deco`（当たり判定なしの飾り：box/text/sign/bulbs）。

**ランプのコツ**：急なUターンは失速して戻ってくる。Uターンは半径1.8以上の円弧（modern.ts の `uturn()`）。高さは 2.5 前後。

**詰まり防止**：ボールより狭いすき間（1未満）・V字のくぼみ・平らな棚を作らない。並んだドロップターゲットは1枚倒れたらボールが通れる間隔に。

## ルール（`StageRules`）

`init / onBallStart / onEvent(g, e) / onFlip / update(g, dt)（約60Hz） / onBallEnd / onMultiballEnd / bonus()` を必要なだけ書く。
イベント `e.type`：bumper sling drop bank standup spinner rollover gate scoop scoop-eject kickback magnet ramp ramp-enter ramp-fail warp trigger launch flipper …

ゲーム（`g: Game`、`src/core/game.ts`）の主な道具：
- 得点・表示：`g.addScore(n, x, y)`、`g.msg(英語, 日本語, 秒, 'normal'|'big'|'flash'|'small')`、`g.hud.mission / missionSub / progress / extra(HTML)`
- ライト：`g.light(id, 'off'|'on'|'blink'|'fast'|'slow')`
- 進行：`g.rankUp()`、`g.startMultiball(追加数, ボールセーブ秒)`、`g.jackpot(点, x, y)`、`g.extraBall()`、`g.ballSave(秒)`、`g.after(秒, fn)`
- 倍率：`g.pfMult`（得点倍率）、`g.bonusMult`（ボーナス倍率）
- 部品：`g.part<ScoopRT>('id').holdFor(秒) / lock() / release()`、`KickbackRT.lit`、`MagnetRT.active/mode/throwAngle/throwSpeed`、
  `BumperRT.moveTo(x, y, dt)`、`g.table.resetBank(bank, 秒)`、`g.table.shapesByTag(id)`（壁の `enabled` を切替・座標を書き換え）
- 物理：`g.world.gx / gy / gravityScale`（重力）、`g.flippers[i].scale`（長さ倍率）、`g.swapFlippers`（左右入れ替え）
- 演出：`g.fx('cutin'|'comic'|'stars'|'petals'|'confetti'|'burst'|'text'|'glitch', x, y, {text, color, value})`、`g.shake(量)`、`g.rumble(強, 弱, ms)`、
  `g.sfx(名前)`、`g.music(0|1|-1)`、`g.song(番号)`（ジュークボックス）、
  `g.emit({ t: 'gimmick', name, text, sub, phase: 'warn'|'start'|'end' })`（予告の帯）
- 描画に効く値：`g.vars.rot`（台の回転, rad）`g.vars.pitch` `g.vars.darkness`（0..1 停電）`g.vars.alarm`（赤い非常灯）`g.vars.glitch`
- 共通部品：`Missions`（ミッション→ランク。テーブル以外のきっかけで進めるときは `advance(g, n)`）、`LaneSet`（そろえるレーン＋レーンチェンジ）… `src/core/missions.ts`
- 浮世絵用（style: 'ukiyoe'）：`g.fx('brush', x, y, { text: 'ドン！', color: 墨の色, value: 大きさ(1.6) })`（筆文字の擬音）、
  `g.fx('mie', 0, 0, { text: '大技名', color: 隈の色 })`（歌舞伎の見得：定式幕＋隈取＋縦書き。音の「ツケ」は `g.sfx('…')` で自分で鳴らす）。
  `theme.scoreDisplay: 'fuda'` で得点が木札の漢数字に、`theme.bokashi` でぼかし摺りの色。25,000点以上の得点表示は自動で漢数字の筆文字。
  漢数字の変換は `src/ui/kanji.ts`（`kanjiNumber(25000)` → 二万五千、`kanjiDigits`）。筆文字を自分のキャンバスに描くなら `drawBrushText`（`src/render/effects.ts`）。
- 注意：`g.fx('cutin')` は絵だけ。音は `g.sfx('cutin')` を一緒に呼ぶ。技名は長くても自動で縮むが、7〜10文字くらいが見栄えがよい。
- 注意：重力・フリッパーの長さ・左右入れ替えはボール開始時に自動で元に戻る。マルチボール中に全部落ちたときも `onMultiballEnd` が呼ばれる。

## 見た目（`ThemeDef`）

`style`（modern/anime/comic/route50s/cyber/ukiyoe/impossible：ポストエフェクトが変わる。ukiyoe は太い輪郭線＋平塗り＋和紙＋ぼかし摺り）、`colors`、`wallMaterial`（glass/metal/toon/wood/neon/hazard）、
`paint(api)`（床の絵をキャンバスに描く）、`paintBackboard`、`decorate(api)`（ステージ専用の3D：`api.THREE` `api.group` `api.at(x,y,h)` `api.onFrame` `api.glow(color)`）、
`bloom` `bloomThreshold`（明るい台は高く）`light` `scoreDisplay:'reels'`（スコアリール）/`'fuda'`（木札に漢数字）。

## 音

- `music.songs[]`：`kit` は用意された編成名（electro/anime/brass/rockabilly/synthwave/chaos）か、自作関数 `(k: KitApi) => void`。
- `sfx`：`wave pitch bright chime glitch punchy`、`custom: { 名前: (s, o) => s.tone(...)/s.noiseHit(...)/s.bell(...) }` で専用の効果音（標準の名前を上書きもできる）。

## 確認方法（全部通すこと）

```
npx tsc --noEmit -p tsconfig.json
STAGE=<id> npx vitest run tests/stages.test.ts --silent=false   # 10分の耐久＋全部の的・ランプへの到達
npx vitest run                                                  # 全テスト
STAGE=<id> npx vitest run -c tests/tools/vitest.config.mts tests/tools/shotmap.test.ts --silent=false  # 角度ごとの行き先
STAGE=<id> npx vitest run -c tests/tools/vitest.config.mts tests/tools/stuck.test.ts --silent=false    # 止まる場所
npm run build
node scripts/shot.mjs out.png "window.__pinball.app.startStage(window.__pinball.stageDefs.find(s=>s.id==='<id>'))" 3
node scripts/e2e.mjs <id>                                       # 画面テスト（コンソールエラー0件）
```
