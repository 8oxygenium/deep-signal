# DEEP SIGNAL バージョン履歴

## v0.1.0 - 初期シューティング試作

概要:

- 800x600のcanvasで動く1画面固定の2Dシューティング
- 自機は画面上部を左右移動
- Spaceで爆雷を投下
- 下部を移動する敵ドローンを撃破
- スコア、残機、ステージ表示
- 画像素材なし、図形描画のみ
- レトロPC風・ドット風の見た目

後続の拡張で追加された要素:

- 2400x1200の広いワールド
- カメラ追従
- 複数敵と3種類の敵タイプ
- ソナー
- 深度による視界変化
- ミニマップ
- 補給ポイント
- 3ステージ構成

## v0.2.0 - GB Style Sound Prototype

保存場所:

- `builds/v0.2.0-gb-style-sound/`

概要:

- Game Boy風の4階調グリーン調ビジュアル
- 400x300の低解像度内部描画
- CSSで800x600へ拡大表示
- タイトル画面追加
- `title / playing / paused / stageClear / gameOver / complete` の状態管理
- Web Audio APIによる効果音
- サウンドON/OFF切り替え
- ポーズ機能
- ソナー演出とクールダウン表示の強化
- 将来のWeb版、Mobile版、GB Demake版に向けた `CONFIG` 整理

操作:

- 矢印キー / WASD: 移動
- Space: ゲーム開始 / 爆雷投下
- E / Shift: ソナー
- M: サウンドON/OFF
- P / Esc: ポーズ
- R: リスタート

## v0.3.0 - Deep Sea / Surface Air Expansion

概要:

- 8ステージ構成へ拡張
- STAGE 1〜5は海中探索ステージ
- STAGE 6に深海ボス `ABYSS CORE` を追加
- STAGE 7に対空ステージ `SURFACE ALERT` を追加
- STAGE 8に空中ボス `SKY SIGNAL MOTHERSHIP` を追加
- `stage.type` による `sea / seaBoss / air / airBoss` の切り替え
- 海中では爆雷、空中では対空弾に切り替え
- 海中ではSONAR、空中ではRADARとして表示
- STAGE 8クリア後の仮エンディング表示
- 今後の宇宙エンドレスとLAND SIGNAL MODE構想を `docs/stage_plan_v0.3.0.md` に記録

## v0.3.1 - Surface Intercept / Random Supply

概要:

- 空中戦ステージを「空を飛ぶステージ」ではなく「海面から迎撃するステージ」として再整理
- STAGE 7 / STAGE 8 の背景で空を広く、海を画面下部に抑えて表示
- 空中戦では自機のY移動を海面付近に制限
- 対空弾の発射時に小さな砲口フラッシュを追加
- 補給ポイントを固定配置からランダム出現・再出現制へ変更
- sea / seaBoss / air / airBoss ごとに補給出現ルールを分離
- 空中戦の補給を海面に浮く補給ブイとして表示
- 補給時メッセージを `DEPTH CHARGE RESTORED` / `AA SHELL RESTORED` に変更

## v0.3.2 - Presentation / Boss Warning Pass

概要:

- 新ステージ追加ではなく、既存v0.3.1の演出と視認性を強化
- 海中ステージに深度暗転、海中ノイズ、泡、沈んだ残骸を追加
- 海中自機の潜航艇シルエットを強化
- 空中戦の空、水平線、雲、波、レーダー線を強化
- 補給ポッドと補給ブイの点滅・浮遊表現を調整
- STAGE 6 / STAGE 8 に `BOSS WARNING` とボス登場演出を追加
- 被弾時の画面揺れ、敵撃破時の小爆発パーティクル、ボス撃破時の大爆発を追加
- STAGE CLEAR 表示をステージ名付きに強化
- air / airBoss ではHUDの `DEPTH` を `SURFACE` 表示に変更

## v0.3.3 - Balance / 1UP Drop Pass

概要:

- v0.3.2 の演出とステージタイプ制限を維持したバランス調整版
- 最大残機を5に変更し、開始残機は3に維持
- 敵撃破時に低確率で1UPアイテムが出る処理を追加
- ボス撃破時は1UPを確定ドロップ
- 最大残機時の1UP取得はスコアボーナスに変換
- `LIVES 3/5` のように最大値付きで表示
- 弾切れ付近では補給再出現時間を少し短縮
- STAGE 1〜8の敵弾頻度、ボスHP、召喚頻度、対空弾速度を軽く調整

## v0.3.4 - Stage Identity / Tempo Pass

概要:

- sea / seaBoss のワールド高さを縦長にし、深く潜る構成を強化
- `getWorldHeight()` を追加し、ステージタイプ別のワールド高さへ対応
- 深層の暗さ、深度ライン、敵影の見えにくさを調整
- 海中に高速突撃自爆敵 `rammer` を追加
- rammer は予兆点滅後にプレイヤー方向へ突進し、接触すると自爆ダメージ
- air / airBoss の自機を浮上潜水艦と対空砲の見た目に変更
- air / airBoss のMODE表示を `SURFACED SUB` に変更
- STAGE CLEAR画面に簡易リザルトを追加
- STAGE CLEAR中に Space / Enter / Z で即次ステージへ進めるように変更
