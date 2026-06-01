# DEEP SIGNAL v0.4.3 宇宙ダメージフリーズ修正

## 目的

v0.4.3 は、ORBITAL SIGNAL MODEでダメージを受けたときにゲームが止まることがある問題のホットフィックスです。
新機能は追加せず、space中の被弾、接触、ノックバック、GAME OVER周辺の安全性を上げます。

## 修正対象

- `damagePlayer()`
- `applyKnockback()`
- `clampPlayerToStage()`
- 宇宙敵弾の衝突判定
- 宇宙敵本体の接触判定
- SIGNAL CORE撃破演出中の残留判定
- 宇宙GAME OVER表示

## 方針

- `reason` が文字列でない場合は `"damage"` として扱う
- `source` がない、または `source.x` / `source.y` が数値でない場合も落とさない
- `source` がない場合はデフォルト方向へ小さくノックバックする
- プレイヤー座標がNaNになった場合はワールド内の安全な位置へ戻す
- space中はsea / air用の海面制限を通らず、宇宙用boundsだけでclampする
- 敵弾や敵本体の座標が不正な場合は衝突判定から除外する
- SIGNAL CORE撃破演出中は被弾判定を止める
- localStorage保存失敗時もゲーム進行を止めない

## 確認方針

- 宇宙敵弾を受けても止まらない
- asteroid / orbitalDrone / signalWisp / hunterUFO / SIGNAL CORE に接触しても止まらない
- SIGNAL CORE放射弾を受けても止まらない
- ダメージ後に無敵時間へ入る
- ダメージ後も移動、攻撃、SCANNERが使える
- livesが0になったらGAME OVERへ遷移し、REACHED WAVEを表示する
- STAGE SELECTとORBITAL直接開始は維持する
