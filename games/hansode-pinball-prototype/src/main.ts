import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.getElementById('app')!.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 4, 8);
camera.lookAt(0, 0, 0);
const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.15 }));
scene.add(ball, new THREE.HemisphereLight(0xffffff, 0x223344, 2));
renderer.setAnimationLoop((t) => {
  ball.position.y = Math.abs(Math.sin(t / 400)) * 2;
  renderer.render(scene, camera);
});
