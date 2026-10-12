// 物理の定数。単位は「ボール直径 = 1」。台の平面上の2D座標で計算する。
// x: 左右（右が+）、y: 台の奥行き（奥が+、フリッパー側が0付近）。

/** 固定ステップ（秒）。描画フレームレートに関係なく同じ挙動にする */
export const STEP = 1 / 480;
/** 1フレームで回す最大ステップ数（処理落ち時の暴走防止。約0.1秒分） */
export const MAX_STEPS_PER_FRAME = 48;

export const BALL_RADIUS = 0.5;
/** 台の傾きによる重力（平面方向の成分、単位/秒²）。実機は約29だが少しキビキビさせる */
export const GRAVITY = 42;
/** ボールの最高速度。1ステップの移動量 = 132/480 ≈ 0.28 で、ボール半径0.5を超えない */
export const MAX_SPEED = 132;
/** 転がり抵抗（指数減衰 /秒） */
export const LINEAR_DAMPING = 0.06;
/** これより遅い衝突は跳ね返さない（静止接触のガタつき防止） */
export const RESTING_SPEED = 2.2;

/** 1ステップで1つのボールに許す衝突解決の反復回数 */
export const SOLVER_ITERATIONS = 4;

/** 床レイヤー。ランプはそれぞれ 1 以上のレイヤー番号を持つ */
export const FLOOR = 0;
