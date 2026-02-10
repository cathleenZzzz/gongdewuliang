import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

console.log("shrine.js loaded OK");

// ====== CONFIG ======
const BASE = "/gongdewuliang"; // repo name
const MODEL_DIR = `${BASE}/assets/models/gen_god/`;

const PATHS = {
  obj: `${MODEL_DIR}base.obj`,
  diffuse: `${MODEL_DIR}texture_diffuse.png`,
  normal: `${MODEL_DIR}texture_normal.png`,
  roughness: `${MODEL_DIR}texture_roughness.png`,
  metallic: `${MODEL_DIR}texture_metallic.png`,
};

// ====== DOM ======
const canvas = document.getElementById("scene");
const tilesEl = document.getElementById("tiles");

// ====== THREE SETUP ======
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07070a);

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
camera.position.set(0, 1.2, 3.2);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 1.0, 0);

// Lights (altar vibe)
scene.add(new THREE.AmbientLight(0xffffff, 0.18));

const key = new THREE.SpotLight(0xffe0c0, 2.6, 20, Math.PI * 0.22, 0.5, 1.0);
key.position.set(1.8, 3.6, 2.4);
key.target.position.set(0, 1.0, 0);
scene.add(key, key.target);

const fill = new THREE.DirectionalLight(0xb7c9ff, 0.55);
fill.position.set(-2.5, 2.0, -2.0);
scene.add(fill);

const candle = new THREE.PointLight(0xffb07a, 0.6, 6);
candle.position.set(0.0, 0.9, 1.0);
scene.add(candle);

// Pedestal
const pedestal = new THREE.Mesh(
  new THREE.CylinderGeometry(0.65, 0.85, 0.45, 48),
  new THREE.MeshStandardMaterial({ color: 0x1a1412, metalness: 0.15, roughness: 0.9 })
);
pedestal.position.set(0, 0.22, 0);
scene.add(pedestal);

// Ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
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

// ====== LOAD TEXTURES + OBJ ======
const manager = new THREE.LoadingManager();
manager.onError = (url) => console.error("[load] failed:", url);

const texLoader = new THREE.TextureLoader(manager);

function loadTex(url, { srgb = false } = {}) {
  const t = texLoader.load(
    url,
    () => console.log("[tex] ok:", url),
    undefined,
    () => console.warn("[tex] missing:", url)
  );
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const diffuseMap = loadTex(PATHS.diffuse, { srgb: true });
const normalMap = loadTex(PATHS.normal);
const roughnessMap = loadTex(PATHS.roughness);
const metalnessMap = loadTex(PATHS.metallic);

const godMaterial = new THREE.MeshStandardMaterial({
  map: diffuseMap,
  normalMap,
  roughnessMap,
  metalnessMap,
  roughness: 1.0,
  metalness: 0.0,
});

const objLoader = new OBJLoader(manager);
let godObj = null;

objLoader.load(
  PATHS.obj,
  (obj) => {
    godObj = obj;

    obj.traverse((child) => {
      if (child.isMesh) child.material = godMaterial;
    });

    // OBJ scale is unpredictable — tweak if needed
    obj.scale.setScalar(0.01);
    obj.position.set(0, 0.45, 0);
    obj.rotation.y = Math.PI;

    scene.add(obj);
    console.log("[obj] loaded:", PATHS.obj);
  },
  undefined,
  (err) => console.error("[obj] FAILED:", err)
);

// ====== DONATION WALL ======
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

function spawnBlessingTile({ username, amount }) {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.innerHTML = `<div class="glow"></div><div class="name">${escapeHtml(username)} · ¥${amount}</div>`;
  tilesEl.prepend(tile);

  setTimeout(() => {
    tile.style.transition = "opacity 600ms ease, transform 600ms ease";
    tile.style.opacity = "0";
    tile.style.transform = "scale(0.9)";
    setTimeout(() => tile.remove(), 650);
  }, 60_000);
}

// ====== SPEECH ======
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
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function onDonationEvent({ username, amount }) {
  spawnBlessingTile({ username, amount });
  speak(`感谢善信 ${username}，供奉 ${amount} 元。功德无量，福报增长。`);
}

// Debug button
document.getElementById("test-donate").addEventListener("click", () => {
  const username = "善信_" + Math.random().toString(16).slice(2, 6).toUpperCase();
  const amount = (Math.random() * 90 + 1).toFixed(2);
  onDonationEvent({ username, amount });
});

// Render loop
renderer.setAnimationLoop(() => {
  controls.update();
  if (godObj) godObj.rotation.y += 0.0012;
  candle.intensity = 0.55 + Math.random() * 0.12;
  renderer.render(scene, camera);
});
