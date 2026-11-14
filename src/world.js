import * as THREE from 'three';

const SAND = new THREE.Color('#dfc79a');
const GRASS = new THREE.Color('#5f8a54');
const DEEP_GRASS = new THREE.Color('#3d6a45');
const ROCK = new THREE.Color('#7d7a6c');

function seeded(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function islandHeight(x, z) {
  const radius = Math.sqrt(x * x + z * z);
  const hill = Math.max(0, 1 - radius / 42);
  const ridge = Math.max(0, 1 - Math.abs(x * 0.55 + z * 0.3) / 30);
  const base = Math.pow(hill, 1.35) * 9 + ridge * hill * 4.5;
  const ripple =
    Math.sin(x * 0.29) * Math.cos(z * 0.24) * 0.7 + Math.sin((x + z) * 0.62) * 0.32 + Math.cos(x * 0.11 - z * 0.17) * 0.5;
  const height = base + ripple * Math.min(1, hill * 2.4);
  return height - 1.1;
}

function makeTerrain() {
  const geometry = new THREE.PlaneGeometry(150, 150, 120, 120);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const colors = [];
  const noise = seeded(7);
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = islandHeight(x, z) + (noise() - 0.5) * 0.16;
    position.setY(i, y);
    const color = new THREE.Color();
    if (y < 0.35) color.copy(SAND);
    else if (y < 1.6) color.copy(SAND).lerp(GRASS, Math.min(1, (y - 0.35) / 1.4));
    else if (y < 6.4) color.copy(GRASS).lerp(DEEP_GRASS, (y - 1.6) / 4.8);
    else color.copy(DEEP_GRASS).lerp(ROCK, Math.min(1, (y - 6.4) / 3.2));
    color.offsetHSL((noise() - 0.5) * 0.02, (noise() - 0.5) * 0.06, (noise() - 0.5) * 0.05);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.94,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

function makeWater() {
  const geometry = new THREE.PlaneGeometry(600, 600, 64, 64);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    color: '#1f6f78',
    roughness: 0.18,
    metalness: 0.35,
    transparent: true,
    opacity: 0.94,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = -0.15;
  mesh.receiveShadow = false;
  const base = Float32Array.from(geometry.attributes.position.array);
  mesh.userData.base = base;
  mesh.userData.tick = (time) => {
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const x = base[i * 3];
      const z = base[i * 3 + 2];
      pos.setY(
        i,
        Math.sin(x * 0.08 + time * 0.9) * 0.32 +
          Math.sin(z * 0.11 - time * 0.7) * 0.26 +
          Math.sin((x + z) * 0.05 + time * 1.4) * 0.12
      );
    }
    pos.needsUpdate = true;
  };
  return mesh;
}

function makePalm(rand) {
  const group = new THREE.Group();
  const height = 6 + rand() * 3;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.44, height, 6, 1),
    new THREE.MeshStandardMaterial({ color: '#7a5a3d', roughness: 0.95, flatShading: true })
  );
  trunk.position.y = height / 2;
  trunk.rotation.z = (rand() - 0.5) * 0.24;
  trunk.castShadow = true;
  group.add(trunk);

  const frondMaterial = new THREE.MeshStandardMaterial({
    color: rand() > 0.5 ? '#4f8a4a' : '#3f7a46',
    roughness: 0.85,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const crown = new THREE.Group();
  crown.position.set(trunk.rotation.z * height * 0.5, height, 0);
  for (let i = 0; i < 8; i += 1) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.6, 4, 1), frondMaterial);
    frond.rotation.z = Math.PI / 2.1;
    frond.rotation.y = (i / 8) * Math.PI * 2 + rand() * 0.2;
    frond.position.set(Math.cos((i / 8) * Math.PI * 2) * 1.5, -0.1 - rand() * 0.4, Math.sin((i / 8) * Math.PI * 2) * 1.5);
    frond.scale.set(1, 1, 0.18);
    frond.castShadow = true;
    crown.add(frond);
  }
  group.add(crown);
  group.userData.perchHeight = height + 0.9;
  group.userData.perchLean = trunk.rotation.z * height * 0.5;
  return group;
}

function makeBroadleaf(rand) {
  const group = new THREE.Group();
  const height = 3.4 + rand() * 2.4;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.34, height, 5),
    new THREE.MeshStandardMaterial({ color: '#6a4f38', roughness: 0.95, flatShading: true })
  );
  trunk.position.y = height / 2;
  trunk.castShadow = true;
  group.add(trunk);
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: rand() > 0.4 ? '#48794b' : '#5c8c4f',
    roughness: 0.9,
    flatShading: true,
  });
  for (let i = 0; i < 3; i += 1) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 + rand() * 0.7, 0), leafMaterial);
    blob.position.set((rand() - 0.5) * 1.7, height + 0.5 + i * 0.6, (rand() - 0.5) * 1.7);
    blob.scale.y = 0.82;
    blob.castShadow = true;
    group.add(blob);
  }
  group.userData.perchHeight = height + 2.1;
  group.userData.perchLean = 0;
  return group;
}

function makeRock(rand, scale = 1) {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1.2 * scale, 0),
    new THREE.MeshStandardMaterial({ color: '#8a8777', roughness: 0.95, flatShading: true })
  );
  rock.scale.set(1 + rand() * 0.6, 0.7 + rand() * 0.7, 1 + rand() * 0.4);
  rock.rotation.set(rand() * 0.4, rand() * Math.PI, rand() * 0.3);
  rock.castShadow = true;
  rock.receiveShadow = true;
  return rock;
}

function makeNest() {
  const group = new THREE.Group();
  const stone = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 3.4, 6.2, 7),
    new THREE.MeshStandardMaterial({ color: '#6f6d61', roughness: 0.95, flatShading: true })
  );
  stone.castShadow = true;
  stone.receiveShadow = true;
  group.add(stone);
  const bowl = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.34, 6, 12),
    new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.95, flatShading: true })
  );
  bowl.rotation.x = Math.PI / 2;
  bowl.position.y = 3.2;
  bowl.castShadow = true;
  group.add(bowl);
  for (let i = 0; i < 9; i += 1) {
    const twig = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 2.2 + Math.random(), 4),
      new THREE.MeshStandardMaterial({ color: '#6d5334', roughness: 1 })
    );
    twig.position.set((Math.random() - 0.5) * 1.8, 3.2 + Math.random() * 0.16, (Math.random() - 0.5) * 1.8);
    twig.rotation.set(Math.PI / 2 - 0.2 + Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
    group.add(twig);
  }
  return group;
}

function makeCloud(rand) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: '#f7f3e8',
    roughness: 1,
    emissive: '#f3e6c8',
    emissiveIntensity: 0.25,
    flatShading: true,
  });
  const puffs = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < puffs; i += 1) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 + rand() * 1.8, 0), material);
    puff.position.set((i - puffs / 2) * 1.9, (rand() - 0.5) * 1.2, (rand() - 0.5) * 2);
    puff.scale.y = 0.7;
    group.add(puff);
  }
  return group;
}

export function buildWorld(scene) {
  const rand = seeded(23);
  const perches = [];
  const trees = [];

  scene.fog = new THREE.FogExp2('#c9dfdb', 0.0072);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(320, 24, 18),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color('#2f6473') },
        mid: { value: new THREE.Color('#9dc6c1') },
        low: { value: new THREE.Color('#f2cf9a') },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 top; uniform vec3 mid; uniform vec3 low;
        varying vec3 vWorld;
        void main() {
          float h = normalize(vWorld).y;
          vec3 col = mix(low, mid, smoothstep(-0.08, 0.28, h));
          col = mix(col, top, smoothstep(0.2, 0.85, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );
  sky.name = 'sky';
  scene.add(sky);

  const terrain = makeTerrain();
  scene.add(terrain);

  const water = makeWater();
  scene.add(water);

  const nest = makeNest();
  nest.position.set(2, islandHeight(2, 2) - 0.4, 2);
  scene.add(nest);
  const nestTop = new THREE.Vector3(nest.position.x, nest.position.y + 3.7, nest.position.z);

  const hemi = new THREE.HemisphereLight('#cfe6ff', '#5a6a3f', 1.15);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#ffe2b0', 2.1);
  sun.position.set(-42, 54, 28);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.camera.far = 220;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(new THREE.AmbientLight('#bcd6cf', 0.35));

  // Trees cluster away from the nest and keep their feet on the island.
  const placements = [];
  for (let attempt = 0; attempt < 220 && placements.length < 26; attempt += 1) {
    const angle = rand() * Math.PI * 2;
    const radius = 7 + rand() * 27;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = islandHeight(x, z);
    if (y < 1.1) continue;
    if (Math.hypot(x - nest.position.x, z - nest.position.z) < 7.5) continue;
    if (placements.some((p) => Math.hypot(p.x - x, p.z - z) < 4.2)) continue;
    placements.push({ x, y, z });
  }

  placements.forEach((spot, index) => {
    const tree = index % 3 === 0 ? makeBroadleaf(rand) : makePalm(rand);
    tree.position.set(spot.x, spot.y - 0.35, spot.z);
    tree.rotation.y = rand() * Math.PI * 2;
    const scale = 0.85 + rand() * 0.5;
    tree.scale.setScalar(scale);
    scene.add(tree);
    trees.push(tree);
    perches.push(
      new THREE.Vector3(
        spot.x + (tree.userData.perchLean || 0) * scale,
        spot.y + tree.userData.perchHeight * scale,
        spot.z
      )
    );
  });

  // Shore rocks, plus one tall lookout.
  for (let i = 0; i < 16; i += 1) {
    const angle = rand() * Math.PI * 2;
    const radius = 12 + rand() * 26;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = islandHeight(x, z);
    if (y < 0.2) continue;
    const rock = makeRock(rand, 0.5 + rand() * 0.9);
    rock.position.set(x, y + 0.1, z);
    scene.add(rock);
  }

  const lookout = new THREE.Group();
  const stack = [makeRock(rand, 1.9), makeRock(rand, 1.5), makeRock(rand, 1.1)];
  stack.forEach((rock, i) => {
    rock.position.y = i * 1.9;
    rock.scale.set(1.5 - i * 0.25, 1.7, 1.4 - i * 0.2);
    stack[i] = rock;
    lookout.add(rock);
  });
  const lookoutX = -16;
  const lookoutZ = -11;
  lookout.position.set(lookoutX, islandHeight(lookoutX, lookoutZ) - 0.6, lookoutZ);
  scene.add(lookout);
  perches.push(new THREE.Vector3(lookoutX, lookout.position.y + 6.4, lookoutZ));
  const lookoutTop = new THREE.Vector3(lookoutX, lookout.position.y + 6.2, lookoutZ);

  const clouds = [];
  for (let i = 0; i < 7; i += 1) {
    const cloud = makeCloud(rand);
    cloud.position.set((rand() - 0.5) * 180, 34 + rand() * 22, (rand() - 0.5) * 180);
    cloud.scale.setScalar(1.4 + rand() * 2.2);
    scene.add(cloud);
    clouds.push({ mesh: cloud, drift: 0.4 + rand() * 0.7 });
  }

  const shore = new THREE.Vector3(0, islandHeight(0, 26) + 0.4, 26);
  const grove = new THREE.Vector3(-9, islandHeight(-9, 12) + 7, 12);

  return {
    terrain,
    water,
    perches,
    nest: nestTop,
    spots: { nest: nestTop, lookout: lookoutTop, shore, grove },
    update(time, dt) {
      water.userData.tick(time);
      clouds.forEach((cloud) => {
        cloud.mesh.position.x += cloud.drift * dt;
        if (cloud.mesh.position.x > 150) cloud.mesh.position.x = -150;
      });
    },
    addTree(position) {
      const tree = makePalm(rand);
      tree.position.copy(position);
      tree.scale.setScalar(0.28);
      scene.add(tree);
      trees.push(tree);
      const target = new THREE.Vector3(position.x, position.y + tree.userData.perchHeight * 1.0, position.z);
      perches.push(target);
      return {
        mesh: tree,
        grow(dt) {
          tree.scale.setScalar(Math.min(1, tree.scale.x + dt * 0.22));
        },
      };
    },
  };
}
