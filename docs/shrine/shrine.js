import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";

/**
 * Shrine MVP:
 * - Pretty-lit 3D scene (placeholder idol)
 * - 2D collage overlay (HTML)
 * - Donation event handler -> spawns mini tiles for 60s
 * - Speech on donation (enabled after user gesture)
 */

// ---------- 3D SETUP ----------
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07070a);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 1.2, 3.2);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 1.0, 0);

// Lights (altar-ish)
scene.add(new THREE.AmbientLight(0xffffff, 0.15));

const key = new THREE.SpotLight(0xffe0c0, 2.2, 12, Math.PI * 0.22, 0.5, 1.0);
key.position.set(1.8, 3.6, 2.4);
key.target.position.set(0, 1.0, 0);
scene.add(key, key.target);

const rim = new THREE.DirectionalLight(0x9fb7ff, 0.55);
rim.position.set(-2.5, 2.0, -2.0);
scene.add(rim);

// Pedestal + placeholder “idol”
const pedestal = new THREE.Mesh(
  new THREE.CylinderGeometry(0.65, 0.85, 0.45, 48),
  new THREE.MeshStandardMaterial({ color: 0x1a1412, metalness: 0.2, roughness: 0.85 })
);
pedestal.position.set(0, 0.22, 0);
scene.add(pedestal);

const idol = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.55, 2),
  new THREE.MeshStandardMaterial({ color: 0xf2d5b3, metalness: 0.15, roughness: 0.35 })
);
idol.position.set(0, 1.05, 0);
scene.add(idol);

// Ground haze
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x07060a, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
scene.add(ground);

// Resize
function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// Animate
renderer.setAnimationLoop(() => {
  controls.update();
  idol.rotation.y += 0.0022;
  idol.rotation.x += 0.0011;
  renderer.render(scene, camera);
});

// ---------- DONATION WALL ----------
const tilesEl = document.getElementById("tiles");

function spawnBlessingTile({ username, amount }) {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.innerHTML = `<div class="glow"></div><div class="name">${escapeHtml(username)} · ¥${amount}</div>`;
  tilesEl.prepend(tile);

  // remove after 60 seconds
  setTimeout(() => {
    tile.style.transition = "opacity 600ms ease, transform 600ms ease";
    tile.style.opacity = "0";
    tile.style.transform = "scale(0.9)";
    setTimeout(() => tile.remove(), 650);
  }, 60_000);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

// ---------- SPEECH ----------
let speechEnabled = false;

document.getElementById("enable-audio").addEventListener("click", () => {
  speechEnabled = true;
  speak("功德系统已启动。欢迎供奉。");
});

function speak(text) {
  if (!speechEnabled || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.02;
  u.pitch = 0.7;
  // Voice selection is OS-dependent; we keep it simple.
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function onDonationEvent({ username, amount }) {
  spawnBlessingTile({ username, amount });

  // Blessing lines (mix CN/EN vibe)
  const msg = `感谢善信 ${username}，供奉 ${amount} 元。功德无量，福报增长。`;
  speak(msg);
}

// Debug button (remove later)
document.getElementById("test-donate").addEventListener("click", () => {
  const username = "善信_" + Math.random().toString(16).slice(2, 6).toUpperCase();
  const amount = (Math.random() * 90 + 1).toFixed(2);
  onDonationEvent({ username, amount });
});

// ---------- LATER: realtime hookup ----------
// When we add the backend, we’ll replace this with:
// const es = new EventSource(BACKEND_URL + "/events");
// es.onmessage = (e) => onDonationEvent(JSON.parse(e.data));
