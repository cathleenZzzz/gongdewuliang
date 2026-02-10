import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

console.log("SHRINE JS — white + glowing wall", Date.now());

// ====== CONFIG ======
const BASE = "/gongdewuliang";
const MODEL_DIR = `${BASE}/assets/models/gen_god/`;

const PATHS = {
  obj: `${MODEL_DIR}base.obj`,
  diffuse: `${MODEL_DIR}texture_diffuse.png`,
  normal: `${MODEL_DIR}texture_normal.png`,
  roughness: `${MODEL_DIR}texture_roughness.png`,
  metallic: `${MODEL_DIR}texture_metallic.png`,
};

// Main idol size
const MAIN_TARGET = 18.0;

// Wall layout (grid behind main idol)
const WALL = {
  cols: 30,
  rows: 14,
  spacingX: 1.15,
  spacingY: 1.05,
  z: -14,          // behind main statue
  yBase: 1.1,      // start height
  jitter: 0.06,    // tiny random variance so it feels alive
};

// ====== DOM ======
const canvas = document.getElementById("scene");

// ====== THREE SETUP ======
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
// ✅ white background
scene.background = new THREE.Color(0xffffff);

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 5000);
// pulled back to fit main + wall
camera.position.set(0, 10.5, 46);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.target.set(0, 7.0, 0);
controls.update();

// ====== LIGHTS (slightly warmer) ======
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const warmKey = new THREE.DirectionalLight(0xfff1dd, 1.15); // warm-ish
warmKey.position.set(5, 9, 7);
scene.add(warmKey);

const coolFill = new THREE.DirectionalLight(0xeaf0ff, 0.35);
coolFill.position.set(-6, 5, -6);
scene.add(coolFill);

// ====== GLOWING 千佛墙 (behind main figure) ======
const smallGeo = new THREE.IcosahedronGeometry(0.18, 1);
// Bright emissive so it glows even on white background
const smallMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: new THREE.Color(0xffffff),
  emissiveIntensity: 1.6,
  metalness: 0.0,
  roughness: 0.35,
});

const count = WALL.cols * WALL.rows;
const wall = new THREE.InstancedMesh(smallGeo, smallMat, count);
wall.instanceMatrix.setUsage(THREE.StaticDrawUsage);

const dummy = new THREE.Object3D();
let i = 0;

const totalW = (WALL.cols - 1) * WALL.spacingX;
const totalH = (WALL.rows - 1) * WALL.spacingY;

for (let r = 0; r < WALL.rows; r++) {
  for (let c = 0; c < WALL.cols; c++) {
    const x = (c * WALL.spacingX) - totalW / 2;
    const y = WALL.yBase + (r * WALL.spacingY);
    const z = WALL.z;

    // tiny jitter to avoid perfect grid feel
    const jx = (Math.random() - 0.5) * WALL.jitter;
    const jy = (Math.random() - 0.5) * WALL.jitter;
    const jz = (Math.random() - 0.5) * WALL.jitter;

    dummy.position.set(x + jx, y + jy, z + jz);

    // no rotation (static), but give slight random facing variance
    dummy.rotation.set(0, (Math.random() - 0.5) * 0.25, 0);

    // slight size variation
    const s = 0.8 + Math.random() * 0.5;
    dummy.scale.setScalar(s);

    dummy.updateMatrix();
    wall.setMatrixAt(i++, dummy.matrix);
  }
}
scene.add(wall);

// ====== LOAD TEXTURES + MAIN OBJ ======
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

const mainMat = new THREE.MeshStandardMaterial({
  map: diffuseMap,
  normalMap,
  roughnessMap,
  metalnessMap,
  roughness: 0.9,
  metalness: 0.05,
});

const objLoader = new OBJLoader(manager);
let godObj = null;

objLoader.load(
  PATHS.obj,
  (obj) => {
    obj.traverse((child) => {
      if (child && child.isMesh) {
        child.material = mainMat;
        if (child.geometry) child.geometry.computeVertexNormals();
      }
    });

    // bounds before scaling
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // center X/Z
    obj.position.x -= center.x;
    obj.position.z -= center.z;

    // scale big
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = MAIN_TARGET / maxDim;
    obj.scale.setScalar(s);

    // re-bounds after scaling
    const box2 = new THREE.Box3().setFromObject(obj);
    const minY = box2.min.y;

    // set base on a “floor” around y=0 (white stage)
    obj.position.y += (0.0 - minY);

    // face forward
    obj.rotation.y = Math.PI;

    scene.add(obj);
    godObj = obj;

    // set view nicely (no need to move wall)
    controls.reset();
    controls.target.set(0, 8.0, 0);
    camera.position.set(0, 11.0, 46.0);
    camera.lookAt(controls.target);
    controls.update();

    console.log("[obj] loaded main idol:", PATHS.obj);
  },
  undefined,
  (err) => console.error("[obj] FAILED:", err)
);

// ====== AUDIO (default ON) ======
let speechEnabled = true;

function speak(text) {
  if (!speechEnabled || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.02;
  u.pitch = 0.72;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

// ====== DONATION “TEST” (kept, no UI text wall) ======
function onDonationEvent({ username, amount }) {
  // brief “flash blessing” effect on the wall
  const prev = smallMat.emissiveIntensity;
  smallMat.emissiveIntensity = 2.8;
  setTimeout(() => (smallMat.emissiveIntensity = prev), 240);

  speak(`感谢善信 ${username}，供奉 ${amount} 元。功德无量。`);
}

document.getElementById("test-donate").addEventListener("click", () => {
  const username = "善信_" + Math.random().toString(16).slice(2, 6).toUpperCase();
  const amount = (Math.random() * 90 + 1).toFixed(2);
  onDonationEvent({ username, amount });
});

// ====== Resize ======
function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// ====== RENDER LOOP ======
renderer.setAnimationLoop(() => {
  controls.update();

  // Main idol can stay still; wall should not rotate
  // If you later want slow ceremonial rotation, we can add it back.

  renderer.render(scene, camera);
});
