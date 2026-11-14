import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildWorld, islandHeight } from './world.js';
import { Bird } from './bird.js';
import { Ui } from './ui.js';
import { createBrain } from './brain.js';
import { loadState, saveState } from './store.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.5, 600);
camera.position.set(42, 29, 46);
if (window.innerWidth / window.innerHeight < 1.15) camera.position.set(58, 38, 64);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 5, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 9;
controls.maxDistance = 120;
controls.maxPolarAngle = Math.PI * 0.485;
controls.enablePan = false;
controls.rotateSpeed = 0.7;
controls.zoomSpeed = 0.8;
controls.update();

const world = buildWorld(scene);
const bird = new Bird(scene, world.perches, world.spots.nest);
bird.sampler = islandHeight;

const state = loadState();
const ui = new Ui();
const brain = createBrain({
  state,
  ui,
  bird,
  world,
  save: () => saveState(state),
});

ui.setGhUser(state.githubUser || '');

let follow = false;
let busy = false;
let lastInteraction = 0;
let nextWander = 14;
let nextHobby = 38;

bird.setStatus((status) => {
  ui.setStatus(status === 'fly' ? 'gliding' : 'perched', status);
});

async function run(text) {
  if (busy) {
    ui.toast('He is mid-thought. One thing at a time.');
    return;
  }
  busy = true;
  lastInteraction = clock.elapsedTime;
  try {
    await brain.handle(text);
  } catch (error) {
    ui.setTyping(false);
    await ui.message('bird', `Something in the works jammed: ${error.message}. Try that once more.`);
    ui.setStatus('perched', 'perched');
  } finally {
    busy = false;
    lastInteraction = clock.elapsedTime;
  }
}

ui.handlers.onSend = run;
ui.handlers.onGithub = (handle) => {
  if (busy) return;
  busy = true;
  lastInteraction = clock.elapsedTime;
  brain
    .loadGithub(handle)
    .catch((error) => ui.message('bird', `GitHub did not answer: ${error.message}`))
    .finally(() => {
      busy = false;
      lastInteraction = clock.elapsedTime;
    });
};
ui.handlers.onRepo = (name) => {
  if (busy) return;
  busy = true;
  brain
    .readRepo(name)
    .catch((error) => ui.message('bird', `That repository would not open: ${error.message}`))
    .finally(() => {
      busy = false;
    });
};
ui.handlers.onPractise = (name) => run(`practise ${name}`);
ui.handlers.onFollow = (on) => {
  follow = on;
};
ui.handlers.onCall = () => {
  follow = true;
  ui.setFollow(true);
  bird.perchAt(world.spots.nest);
  ui.toast('He is coming back to the nest.');
};

// Click the island to send him somewhere. Drags stay with the camera.
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let press = null;

canvas.addEventListener('pointerdown', (event) => {
  press = { x: event.clientX, y: event.clientY, at: performance.now() };
});

canvas.addEventListener('pointerup', (event) => {
  if (!press) return;
  const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
  const held = performance.now() - press.at;
  press = null;
  if (moved > 7 || held > 600) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(world.terrain, false);
  if (!hits.length) return;
  const point = hits[0].point;
  if (point.y < 0.25) {
    ui.toast('That is water. He would rather not.');
    return;
  }
  bird.sendTo(new THREE.Vector3(point.x, point.y + 1.4, point.z));
  document.getElementById('ground-hint')?.classList.add('fade');
});

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

const clock = new THREE.Clock();
const planted = [];

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  world.update(elapsed, dt);
  bird.update(dt, elapsed);

  if (follow) {
    controls.target.lerp(bird.group.position, Math.min(1, dt * 3.2));
  }
  controls.update();

  if (!busy && elapsed > lastInteraction + 26 && elapsed > nextHobby) {
    nextHobby = elapsed + 42 + Math.random() * 30;
    busy = true;
    brain
      .autonomous()
      .catch(() => {})
      .finally(() => {
        busy = false;
        lastInteraction = Math.max(lastInteraction, elapsed - 12);
      });
  }

  if (!busy && bird.state === 'perch' && elapsed > nextWander) {
    nextWander = elapsed + 20 + Math.random() * 24;
    bird.wander();
  }

  // Newly planted trees grow every frame until they reach full size.
  for (const item of planted) item.grow(dt);

  renderer.render(scene, camera);
}

const treeHook = world.addTree.bind(world);
world.addTree = (position) => {
  const plantedTree = treeHook(position);
  planted.push(plantedTree);
  return plantedTree;
};

animate();
brain.greet().catch(() => {
  ui.message('bird', 'Morning. The island is up, but the server behind it is not answering. I can still build and draw locally — the web and GitHub will have to wait.');
});
