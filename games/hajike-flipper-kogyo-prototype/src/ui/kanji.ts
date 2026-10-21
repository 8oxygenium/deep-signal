// 漢数字（浮世絵の台の木札・筆文字の得点表示）
const DIGITS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const SMALL = ['', '十', '百', '千'];
const BIG = ['', '万', '億', '兆'];

/** 位取りの漢数字（例：12034 → 一二〇三四）。木札に1文字ずつ書く用 */
export function kanjiDigits(n: number): string {
  return Math.max(0, Math.floor(n))
    .toString()
    .split('')
    .map((d) => DIGITS[Number(d)])
    .join('');
}

/** 1桁の漢数字 */
export function kanjiDigit(d: number): string {
  return DIGITS[Math.max(0, Math.min(9, Math.floor(d)))];
}

/** 読みの漢数字（例：25000 → 二万五千、1200300 → 百二十万三百） */
export function kanjiNumber(n: number): string {
  n = Math.max(0, Math.floor(n));
  if (n === 0) return '〇';
  let out = '';
  for (let g = BIG.length - 1; g >= 0; g--) {
    const unit = 10 ** (g * 4);
    const part = Math.floor(n / unit) % 10000;
    if (!part) continue;
    let s = '';
    for (let k = 3; k >= 0; k--) {
      const d = Math.floor(part / 10 ** k) % 10;
      if (!d) continue;
      // 十・百・千の前の「一」は省く（一万・一億は残す）
      s += (d === 1 && k > 0 ? '' : DIGITS[d]) + SMALL[k];
    }
    out += s + BIG[g];
  }
  return out;
}
