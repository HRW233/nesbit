import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

function wingShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.75, 0.34, 1.65, 0.02);
  shape.quadraticCurveTo(1.25, -0.42, 0.42, -0.36);
  shape.lineTo(0, 0);
  return new THREE.ShapeGeometry(shape, 8);
}

function makeBird() {
  const group = new THREE.Group();
  const bodyColor = '#eab948';
  const darkColor = '#28383a';
  const bellyColor = '#f6e3ae';

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.72, flatShading: true });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: darkColor, roughness: 0.6, flatShading: true });
  const bellyMaterial = new THREE.MeshStandardMaterial({ color: bellyColor, roughness: 0.8, flatShading: true });
  const beakMaterial = new THREE.MeshStandardMaterial({ color: '#e2683f', roughness: 0.5, flatShading: true });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 14), bodyMaterial);
  body.scale.set(0.94, 0.86, 1.3);
  body.castShadow = true;
  group.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), bellyMaterial);
  belly.scale.set(0.9, 0.7, 1.05);
  belly.position.set(0, -0.16, 0.16);
  group.add(belly);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 18, 14), darkMaterial);
  head.position.set(0, 0.34, 0.48);
  head.castShadow = true;
  group.add(head);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.355, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), bodyMaterial);
  cap.position.set(0, 0.36, 0.47);
  cap.castShadow = true;
  group.add(cap);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 4), beakMaterial);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.26, 0.86);
  beak.castShadow = true;
  group.add(beak);

  const eyeMaterial = new THREE.MeshStandardMaterial({ color: '#111a1a', roughness: 0.2 });
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), eyeMaterial);
    eye.position.set(0.19 * side, 0.4, 0.72);
    group.add(eye);
  });

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.1, 4), darkMaterial);
  tail.rotation.x = -Math.PI / 2.3;
  tail.scale.set(1, 1, 0.36);
  tail.position.set(0, 0.1, -0.78);
  tail.castShadow = true;
  group.add(tail);

  const wingGeometry = wingShape();
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: '#dda63a',
    roughness: 0.75,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const wings = [];
  [-1, 1].forEach((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.34 * side, 0.14, 0.08);
    const wing = new THREE.Mesh(wingGeometry, wingMaterial);
    wing.rotation.x = -Math.PI / 2;
    wing.scale.set(side * 1.0, 1.0, 1.0);
    wing.position.x = 0;
    wing.castShadow = true;
    pivot.add(wing);
    group.add(pivot);
    wings.push({ pivot, side });
  });

  const legs = [];
  [-1, 1].forEach((side) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 4), beakMaterial);
    leg.position.set(0.13 * side, -0.42, 0.02);
    group.add(leg);
    legs.push(leg);
  });

  return { group, wings, legs };
}

export class Bird {
  constructor(scene, perches, home) {
    const { group, wings, legs } = makeBird();
    this.group = group;
    this.wings = wings;
    this.legs = legs;
    this.perches = perches;
    this.home = home.clone();
    this.position = home.clone().add(new THREE.Vector3(0, 1.2, 0));
    this.velocity = new THREE.Vector3();
    this.target = home.clone();
    this.state = 'perch';
    this.perch = null;
    this.wanderTimer = 0;
    this.flap = 0;
    this.group.position.copy(this.position);
    scene.add(group);

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 20),
      new THREE.MeshBasicMaterial({ color: '#1d2b20', transparent: true, opacity: 0.18, depthWrite: false })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.shadow);
  }

  setStatus(cb) {
    this.onStatus = cb;
  }

  announce() {
    if (this.onStatus) this.onStatus(this.state);
  }

  sendTo(point, options = {}) {
    this.target.copy(point);
    this.state = 'fly';
    this.perch = options.perch || null;
    this.wanderTimer = 0;
    this.announce();
  }

  randomPerch() {
    const list = this.perches;
    if (!list.length) return this.home.clone();
    return list[Math.floor(Math.random() * list.length)].clone();
  }

  wander() {
    const perch = this.randomPerch();
    this.sendTo(perch.clone().add(new THREE.Vector3(0, 1, 0)), { perch });
  }

  perchAt(point) {
    this.sendTo(point.clone().add(new THREE.Vector3(0, 0.9, 0)), { perch: point.clone() });
  }

  update(dt, elapsed) {
    const pos = this.group.position;
    const delta = this.target.clone().sub(pos);
    const distance = delta.length();

    if (this.state === 'fly') {
      if (distance < 0.9) {
        this.state = 'perch';
        this.velocity.multiplyScalar(0.2);
        this.announce();
      } else {
        const direction = delta.normalize();
        const speed = Math.min(19, 2.2 + distance * 1.5);
        const desired = direction.multiplyScalar(speed);
        desired.y += Math.sin(elapsed * 1.7) * 0.35;
        this.velocity.lerp(desired, 1 - Math.exp(-2.6 * dt));
      }
    } else {
      this.velocity.multiplyScalar(Math.exp(-4 * dt));
      pos.lerp(this.target, Math.min(1, dt * 1.6));
      // Hover just above whatever ledge he chose; never sink toward the nest.
      pos.y = this.target.y + Math.sin(elapsed * 1.9) * 0.07;
      this.wanderTimer += dt;
    }

    pos.addScaledVector(this.velocity, dt);

    const groundY = this.groundHeightAt(pos.x, pos.z);
    if (pos.y < groundY + 0.8) pos.y = groundY + 0.8;

    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizontalSpeed > 0.15) {
      const yaw = Math.atan2(this.velocity.x, this.velocity.z);
      const turn = ((yaw - this.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.group.rotation.y += turn * Math.min(1, dt * 6);
    }
    this.group.rotation.z = THREE.MathUtils.lerp(
      this.group.rotation.z,
      THREE.MathUtils.clamp(-this.velocity.x * 0.035, -0.45, 0.45),
      Math.min(1, dt * 4)
    );
    this.group.rotation.x = THREE.MathUtils.lerp(
      this.group.rotation.x,
      THREE.MathUtils.clamp(-this.velocity.y * 0.03, -0.3, 0.3),
      Math.min(1, dt * 4)
    );

    const flapRate = this.state === 'fly' ? 11 : 2.2;
    this.flap += dt * flapRate;
    const amplitude = this.state === 'fly' ? 0.72 : 0.16;
    const flapAngle = Math.sin(this.flap) * amplitude;
    this.wings.forEach(({ pivot, side }) => {
      pivot.rotation.z = side * -flapAngle;
      pivot.rotation.x = Math.cos(this.flap) * 0.08;
    });

    this.legs.forEach((leg) => {
      leg.visible = this.state !== 'fly';
    });

    if (this.state === 'fly') {
      this.group.position.y += Math.sin(this.flap * 0.9) * 0.045 * dt * 2;
    }

    this.shadow.position.set(pos.x, this.groundHeightAt(pos.x, pos.z) + 0.05, pos.z);
    const height = Math.max(0, pos.y - this.shadow.position.y);
    this.shadow.scale.setScalar(THREE.MathUtils.clamp(1 - height / 26, 0.35, 1.4));
    this.shadow.material.opacity = THREE.MathUtils.clamp(0.22 - height / 130, 0.04, 0.22);
  }

  groundHeightAt(x, z) {
    if (this.sampler) return this.sampler(x, z);
    return 0;
  }
}
