// 台の下に敷く、大きな一枚の版画：藍の青海波の海に、北斎風の大波、赤富士、金雲、松、朝日、桜
import { blossom, fibres, fuji, goldCloud, greatWave, pine, rng, seigaiha } from './art';
import type { Kit } from './kit';
import { INK } from './palette';

/** 地面の大きさ（台の座標の単位）と中心 */
const SIZE = 150;
const CX = 0.75;
const CY = 20;

export function buildGround(kit: Kit): void {
  const THREE = kit.THREE;
  const N = kit.low ? 1024 : 2048;
  const k = N / SIZE;
  // 台の座標 → キャンバスの座標
  const X = (x: number) => (x - (CX - SIZE / 2)) * k;
  const Y = (y: number) => (CY + SIZE / 2 - y) * k;
  const U = (v: number) => v * k;

  const tex = kit.api.canvasTexture(N, N, (g) => {
    g.fillStyle = '#2a5da6';
    g.fillRect(0, 0, N, N);
    // 海：青海波
    seigaiha(g, 0, 0, N, N, U(1.55), { line: 'rgba(214,232,250,0.85)', fill: '#3a74bb', lw: Math.max(2, U(0.09)), rings: 4 });
    // 波の濃淡（遠くほど暗く、ぼかし摺り）
    const vg = g.createRadialGradient(X(CX), Y(CY), U(18), X(CX), Y(CY), U(70));
    vg.addColorStop(0, 'rgba(10,22,60,0)');
    vg.addColorStop(1, 'rgba(16,36,90,0.5)');
    g.fillStyle = vg;
    g.fillRect(0, 0, N, N);

    // 左下：大波（右へ巻く）／右下：小さな大波（左へ巻く）
    greatWave(g, X(-39), Y(-6), U(3.1), { seed: 3, lw: U(0.22) });
    greatWave(g, X(41), Y(-1), U(2.1), { flip: true, seed: 12, lw: U(0.16) });
    // 左上：朝日と金雲
    g.fillStyle = '#e4502c';
    g.strokeStyle = INK;
    g.lineWidth = U(0.25);
    g.beginPath();
    g.arc(X(-24), Y(52), U(4.2), 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.strokeStyle = 'rgba(224,178,56,0.85)';
    g.lineWidth = U(0.4);
    g.beginPath();
    g.arc(X(-24), Y(52), U(5.6), 0, Math.PI * 2);
    g.stroke();
    goldCloud(g, X(-40), Y(36), U(20), U(4.8), 21);
    goldCloud(g, X(-33), Y(62), U(22), U(5.2), 22);
    // 右上：赤富士と金雲、松
    fuji(g, X(30), Y(40), U(15), U(17), { body: '#c9674a', shade: '#8f3b33', snow: '#f8f2de', line: INK, lw: U(0.3), seed: 6 });
    goldCloud(g, X(14), Y(44), U(22), U(5), 23);
    goldCloud(g, X(22), Y(26), U(20), U(4.6), 24);
    pine(g, X(42), Y(22), U(4), 5);
    pine(g, X(-36), Y(26), U(3.6), 8);
    // 桜
    const r = rng(33);
    for (let i = 0; i < 90; i++) {
      const x = CX - 46 + r() * 92, y = CY - 32 + r() * 76;
      // 台の上は描いても見えないが、数を抑えるため台の外だけ
      if (x > -11 && x < 12.5 && y > -4 && y < 43) continue;
      blossom(g, X(x), Y(y), U(0.55 + r() * 0.6), r() * 6.28, '#f6c3cf', '#9b4659');
    }
    fibres(g, N, N, 2400, 7, 0.06);
  });
  tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: '#d4def5' });
  mat.userData.outlineParameters = { visible: false };
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.copy(kit.api.at(CX, CY, -0.9));
  kit.api.group.add(plane);
}
