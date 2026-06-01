# DEEP SIGNAL v0.4.1 宇宙エンドレス調整計画

## 位置づけ

v0.4.1 は、v0.4.0 で追加した `ORBITAL SIGNAL MODE` の調整版です。
大きな新機能追加ではなく、wave進行、敵挙動、ENERGY、SCANNER、補給、視認性、GAME OVER表示を整えます。

## wave 1〜10 の難易度方針

- wave 1: 3体構成で開始し、asteroid / orbitalDrone / signalWisp の基本を見せる
- wave 2〜3: 敵数を少し増やし、弾を撃つ敵と見えにくい敵に慣れさせる
- wave 3〜5: hunterUFO を少数だけ混ぜ、追尾敵の存在を段階的に導入する
- wave 6以降: 敵数、速度、弾頻度を少しずつ上げる
- wave 10前後: 緊張感は上げるが、急に敵数や弾速が跳ねないようにする

## space敵ごとの調整方針

- asteroid: 遅めに漂う接触ダメージ敵。序盤は少数、スコアは低〜中程度
- orbitalDrone: 横・斜め移動と弾撃ちを担当。序盤から出すが弾頻度は控えめ
- signalWisp: 見えにくい敵。SCANNERで輪郭を強く見せ、接触判定は小さめにする
- hunterUFO: ゆるい追尾敵。wave 3以降に少数から出し、速すぎないようにする

## ENERGY / SCANNER / 補給

- ビームは少し当てやすくするため、弾速と判定幅を調整
- クールダウンを残して、連射しすぎによる処理負荷を避ける
- SCANNERは宇宙ではグリッド線を重ね、signalWispの発見感を強める
- 宇宙補給ポッドは通常ステージよりやや遅めだが、ENERGY 0〜2では早めに戻す
- 5waveごとに補給が出やすくなるようにし、長期プレイで弾切れ詰みを避ける

## wave進行テンポ

- waveクリア後に短く `WAVE CLEAR / NEXT WAVE` を表示
- 自動で次waveへ進む
- Space / Enter / Z で早送りできる
- 待ち時間は短くし、エンドレスモードのテンポを保つ

## 宇宙GAME OVER表示

宇宙エンドレスでは通常のGAME OVERに加えて、到達waveを明示します。

- `GAME OVER`
- `FINAL SCORE`
- `REACHED WAVE`
- `PRESS R TO RESTART`
- `PRESS SPACE TO TITLE`

## 今後

v0.4.2以降で検討する内容:

- 宇宙ボス
- スコアランキング
- スマホ操作
- 宇宙専用の危険地帯や背景演出
- エンドレスモード用の簡易リザルト
