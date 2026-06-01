# DEEP SIGNAL v0.4.0 ORBITAL SIGNAL MODE 計画

## 位置づけ

v0.4.0 は、STAGE 8 `SKY SIGNAL MOTHERSHIP` 撃破後に宇宙へ移行する `ORBITAL SIGNAL MODE` 追加版です。
海中編と空中迎撃編をクリアした後の、スコアアタック型エンドレスモードとして扱います。

## 進行

- STAGE 8撃破後、すぐ完全終了せず `SIGNAL ASCENDING...` を表示
- `ORBITAL SIGNAL MODE UNLOCKED` 表示後、Space / Enter / Z で宇宙モード開始
- 入力しない場合も短い待機時間後に自動開始
- 宇宙モードは `WAVE 1` から始まり、敵全滅ごとに次waveへ進む
- 明確な最終クリアはなく、GAME OVER時に最終到達waveを表示する

## stage.type: space

`space` は、既存の `sea` / `seaBoss` / `air` / `airBoss` と分けた専用タイプです。

- 海面なし
- 深度なし
- 全方向自由移動
- 自機は宇宙艇 / 軌道戦闘艇として描画
- 背景は星、ノイズ、軌道線、遠くの惑星風
- 補給は宇宙補給ポッド
- センサー表示は `SCANNER`
- 弾薬表示は `ENERGY`

重要な設計方針として、全方向自由移動は `space` タイプ専用です。
`sea` / `seaBoss` は潜航艇として海面より上へ出られず、`air` / `airBoss` は浮上潜水艦として海面付近から迎撃します。

## 宇宙モードの攻撃

- Spaceキーで上方向へ高速ビーム / パルス弾を撃つ
- 既存AMMOを `ENERGY` として流用
- 連射しやすいが、短いクールダウンを入れて弾数と描画負荷を制御
- 宇宙補給ポッドでENERGYを最大まで回復

## 敵タイプ案

実装対象:

- `asteroid`: ゆっくり漂う隕石。接触ダメージあり。破壊でスコア加算
- `orbitalDrone`: 横または斜めに移動し、ときどき弾を撃つ
- `signalWisp`: ふらふら移動する信号体。SCANNERで輪郭がはっきり出る
- `hunterUFO`: プレイヤーをゆるく追尾するUFO。高速度にしすぎない

waveが進むごとに敵数、速度、弾頻度を少しずつ上げます。
序盤は3種類を中心にし、途中から `hunterUFO` を混ぜて密度を上げます。

## UI

space中のHUD:

- `SCORE`
- `LIVES 3/5`
- `MODE: ORBITAL SIGNAL`
- `WAVE`
- `ENERGY`
- `SCANNER READY / CHARGING`

GAME OVER時:

- `FINAL SCORE`
- `REACHED WAVE`
- `PRESS R TO RESTART`
- `PRESS SPACE TO TITLE`

## 補給と1UP

- 補給は宇宙空間に浮かぶ補給ポッドとしてランダム出現
- 取得するとENERGYを最大まで回復
- 低AMMO時は既存補給仕様と同じく、再出現を少し早めて詰みを避ける
- 1UPドロップはspaceでも継承
- 最大残機5と、最大残機時のスコアボーナス仕様も継承

## 今後の検討

v0.4.1以降で検討する内容:

- 宇宙ボス
- wave到達数やスコアのランキング
- スマホ向け仮想パッド / タッチ操作
- 宇宙専用の補給、危険地帯、背景演出の追加
- GB Demake版へ落とし込むための160x144表示検証
