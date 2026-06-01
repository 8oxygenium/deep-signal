# DEEP SIGNAL v0.4.2 SIGNAL CORE / Stage Select Unlock 計画

## 位置づけ

v0.4.2 は、v0.4.1 の ORBITAL SIGNAL MODE を維持しつつ、宇宙ボスと解放要素を追加する版です。
wave 10で `SIGNAL CORE` を出し、撃破後にSTAGE SELECTとORBITAL SIGNAL MODE直接開始を解放します。

## SIGNAL CORE

- ORBITAL SIGNAL MODE の wave 10 開始時に通常敵ではなく `SIGNAL CORE` が出現
- 大型の宇宙信号コアとして描画
- HPを持ち、ビーム攻撃でダメージを受ける
- 弱点が開いている時、またはSCANNER反応中に弱点が見えやすくなる
- 放射状の弾を撃つ
- 少数の `orbitalDrone` を召喚する
- 接触ダメージあり
- 撃破時は大きめの爆発演出
- 撃破後、ORBITAL SIGNAL MODE は wave 11 以降へ継続

## 解放要素

SIGNAL CORE撃破で以下を解放します。

- STAGE SELECT
- タイトル画面からの ORBITAL SIGNAL MODE 直接開始

STAGE 8撃破時点でも、ORBITAL SIGNAL MODE の直接開始は解放されます。
STAGE SELECTはSIGNAL CORE撃破後に解放される想定です。

## localStorage

保存キー:

- `DEEP_SIGNAL_UNLOCKS`

保存する値:

- `orbitalUnlocked`
- `stageSelectUnlocked`
- `bestScore`
- `bestWave`

localStorageが使えない環境でもゲーム本体は止まらないようにします。

## タイトル画面

未解放時:

- `SPACE: START STORY`
- `O: ORBITAL SIGNAL [LOCKED]`
- `S: STAGE SELECT [LOCKED]`

解放後:

- `SPACE: START STORY`
- `O: ORBITAL SIGNAL`
- `S: STAGE SELECT`

BEST SCORE / BEST WAVE もタイトル画面に表示します。

## STAGE SELECT

表示項目:

- `1 COASTAL TEST AREA`
- `2 SUNKEN GRID`
- `3 MIDNIGHT TRENCH`
- `4 GHOST CURRENT`
- `5 BLACK SIGNAL ZONE`
- `6 ABYSS CORE`
- `7 SURFACE ALERT`
- `8 SKY SIGNAL MOTHERSHIP`
- `ORBITAL SIGNAL MODE`
- `SECRET: ??? [LOCKED]`

操作:

- ArrowUp / ArrowDown または W / S で選択
- Space / Enter / Z で開始
- Escape / Backspace でタイトルに戻る

## SECRET STAGE

SECRET STAGEは今回は未実装・未解放です。

- 最初は `??? [LOCKED]` 表示
- 解放条件は未定
- 候補: `LAND SIGNAL MODE` / タイヤ付き潜水艦

## 今後

v0.4.3以降で検討する内容:

- SIGNAL CORE再登場パターン
- 宇宙ボス第2形態
- スコアランキング
- スマホ操作
- SECRET STAGE解放条件
