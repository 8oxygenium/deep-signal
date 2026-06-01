# HAPOMU / Happy Omurice Games

HAPOMU / Happy Omurice Games は、家族のアイディアとAI相談から生まれる、ちいさなブラウザゲーム置き場です。
Cloudflare Pagesで公開している個人制作ゲーム集サイトです。

Site URL:

- https://hapomu.com

Brand:

- HAPOMU / Happy Omurice Games

HAPOMU is a small browser game portal.
DEEP SIGNAL is the first browser game prototype in this archive.

## 概要

HAPOMUは、短く遊べるブラウザゲームとプロトタイプをまとめるゲーム集サイトです。
たまご色、ケチャップ赤、レトロ洋食屋、ゲームキッチン風の雰囲気で、家族のアイディアを小さなゲームとして試作しています。

DEEP SIGNAL は、HAPOMUの第1作として公開しているブラウザゲームプロトタイプです。
レトロPC / Game Boy風の見た目で、画像素材や音声素材を使わず、HTML / CSS / JavaScript / canvas / Web Audio API だけで制作しています。

プレイヤーは潜航艇を操作し、広い海域を探索しながらソナーで敵を発見し、爆雷で撃破します。
後半では浮上した潜水艦による対空迎撃、さらに ORBITAL SIGNAL MODE として宇宙エンドレスへ展開します。

現在の安定版: DEEP SIGNAL v0.4.3

## Playable Games

- DEEP SIGNAL: Retro deep-sea shooter / v0.4.3 stable
- Happy Omurice v0.1: オムライスにケチャップを描くミニゲーム
- JANKEN KITCHEN v0.1: GUU / CHOKI / PAA の3ボタンジャンケンミニゲーム
- Cup Ramen Kun v0.1: 30秒間フタを押さえて完成を目指すミニゲーム

## 今後の企画

- Happy Omurice: 娘のアイディアから生まれた、しあわせなオムライスゲーム構想
- Cup Ramen Kun: 息子のアイディアから生まれた、3分間をテーマにしたカップラーメンくんゲーム構想
- JANKEN KITCHEN: HAPOMUの小さなジャンケン筐体企画

## ゲーム一覧・企画ページ

- `games/index.html`: HAPOMUのゲーム一覧ページ
- `games/deep-signal.html`: DEEP SIGNAL の専用紹介ページとPrototype Archive
- `games/happy-omurice.html`: Happy Omurice のComing Soon企画ページ
- `games/happy-omurice-prototype/`: Happy Omurice v0.1 prototype
- `games/cup-ramen-kun.html`: Cup Ramen Kun のComing Soon企画ページ
- `games/cup-ramen-kun-prototype/`: Cup Ramen Kun v0.1 prototype
- `games/janken-kitchen.html`: JANKEN KITCHEN のComing Soon / Arcade Concept企画ページ
- `games/janken-kitchen-prototype/`: JANKEN KITCHEN v0.1 prototype

Happy Omurice v0.1 prototype added. マウス/タッチでオムライスにケチャップを描くミニゲームです。
JANKEN KITCHEN v0.1 prototype added. GUU / CHOKI / PAA の3ボタンジャンケンミニゲームです。
Cup Ramen Kun v0.1 prototype added. 30秒間フタを押さえて完成を目指すミニゲームです。
DEEP SIGNAL専用紹介ページを追加し、Prototype Archiveを `games/deep-signal.html` に整理しました。

## 現在の主な内容

- STAGE 1〜5: 海中探索ステージ
- STAGE 6: 深海ボス ABYSS CORE
- STAGE 7: 浮上潜水艦による対空迎撃ステージ
- STAGE 8: 空中ボス SKY SIGNAL MOTHERSHIP
- ORBITAL SIGNAL MODE: 宇宙エンドレスモード
- SIGNAL CORE: wave 10で出現する宇宙ボス
- STAGE SELECT: SIGNAL CORE撃破後に解放

## 操作方法

- Arrow Keys / WASD: 移動
- Space: 攻撃
- E / Shift: SONAR / RADAR / SCANNER
- P / Esc: ポーズ
- M: サウンドON/OFF
- R: リスタート
- タイトル画面で O: ORBITAL SIGNAL MODE
- タイトル画面で S: STAGE SELECT

## バージョン履歴概要

- v0.2.0: GB風ビジュアル、低解像度描画、タイトル画面、レトロSEを追加
- v0.3.2: 海中・空中ステージの見た目、ボス警告、爆発演出を強化
- v0.3.3: 低確率1UP、最大残機5、バランス調整を追加
- v0.3.4: 縦長海中ステージ、rammer、STAGE CLEARキー送りを追加
- v0.3.5: 敵本体との接触ダメージ、無敵時間、ノックバックを追加
- v0.3.6: STAGE 1〜8の通しプレイ調整
- v0.4.0: ORBITAL SIGNAL MODE / 宇宙エンドレスを追加
- v0.4.1: 宇宙エンドレスの難易度、視認性、補給、wave進行を調整
- v0.4.2: 宇宙ボス SIGNAL CORE と STAGE SELECT 解放を追加
- v0.4.3: ORBITAL SIGNAL MODE のダメージ時フリーズ対策を追加

## プロトタイプアーカイブ

root の `index.html` は Prototype Archive です。
`current/` には現在開発中の最新版、`builds/` には各バージョンの固定保存版を配置しています。

## 制作者

- HANSODE / Takao Sugiyama
