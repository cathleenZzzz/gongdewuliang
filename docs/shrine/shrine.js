import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

/**
 * Shrine main page (GitHub Pages safe)
 * - Loads OBJ model: /gongdewuliang/models/gen_god/base.obj
 * - Applies textures: diffuse/normal/roughness/metallic
 * - 2D collage overlay handled by HTML/CSS
 * - Donation tiles + speech
 */

// ====== CONFIG ======
const BASE = "/gongdewuliang"; // repo name on GitHub Pages
const MODEL_DIR = `${BASE}/models/gen_god/`;

const PATHS = {
  obj: `${MODEL_DIR}base.obj`,
  diffuse: `${MODEL_DIR}texture_diffuse.png`,
  normal: `${MODEL_DIR}texture_normal.png`,
  roughness: `${MODEL_DIR}texture_roughness.png`,
  metallic: `${MODEL_DIR}texture_metallic.png`,
  // optional extras you uploaded (not required):
  // shaded: `${MODEL_DIR}shaded.png`,
  // pbr: `${MODEL_DIR}texture_pbr.png`,
};

// ====== DOM ======
const canvas = document.getElementById("scene");
const tilesEl = document.getElementById("tiles");

// ====== THREE SETUP ======
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Some devices look nicer with this:
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07070a);

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
camera.position.set(0, 1.2, 3.2);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 1.0, 0);

// ---- Lights (altar vibe) ----
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

// ---- Pedestal ----
const pedestal = new THREE.Mesh(
  new THREE.CylinderGeometry(0.65, 0.85, 0.45, 48),
  new THREE.MeshStandardMaterial({ color: 0x1a1412, metalness: 0.15, roughness: 0.9 })
);
pedestal.position.set(0, 0.22, 0);
scene.add(pedestal);

// ---- Ground ----
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.MeshStandardMaterial({ color: 0x07060a, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
scene.add(ground);

// ====== Resize handling ======
function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// ====== Load OBJ + textures ======
const manager = new THREE.LoadingManager();
manager.onStart = () => console.log("[load] started");
manager.onProgress = (url, loaded, total) => console.log(`[load] ${loaded}/${total}`, url);
manager.onError = (url) => console.error("[load] failed:", url);
manager.onLoad = () => console.log("[load] all done");

const texLoader = new THREE.TextureLoader(manager);

function safeLoadTexture(url, { srgb = false } = {}) {
  try {
    const t = texLoader.load(
      url,
      () => console.log("[tex] ok:", url),
      undefined,
      () => console.warn("[tex] miss
