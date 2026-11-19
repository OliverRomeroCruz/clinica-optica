// 3D Eyewear Viewer - Three.js PBR Studio Experience
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

class GlassesViewer3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.glassesGroup = null;
    this.frameMeshes = [];
    this.lensMeshes = [];
    this.idleTimer = null;
    this.isResetting = false;

    this.initialCameraPos = new THREE.Vector3(0, 0.6, 4.6);
    this.initialTarget = new THREE.Vector3(0, 0, 0);

    // Color definitions
    this.frameFinishes = {
      black: { color: 0x1c1c1e, metalness: 0.88, roughness: 0.22, name: 'Titanio Negro Mate' },
      gold: { color: 0xd4af37, metalness: 0.94, roughness: 0.16, name: 'Oro Champagne Satinado' },
      silver: { color: 0xe5e7eb, metalness: 0.96, roughness: 0.14, name: 'Plata Quirúrgica' },
      amber: { color: 0x964b00, metalness: 0.15, roughness: 0.25, name: 'Bio-Acetato Ámbar' }
    };

    this.lensFinishes = {
      clear: { color: 0xf3f4f6, opacity: 0.32, transmission: 0.92, roughness: 0.02, name: 'Transparente HD' },
      green: { color: 0x1e3a2f, opacity: 0.78, transmission: 0.38, roughness: 0.05, name: 'Solar Mineral Verde' },
      blue: { color: 0x1e293b, opacity: 0.72, transmission: 0.42, roughness: 0.05, name: 'Degradé Azul Noche' }
    };

    this.currentFrameFinish = 'black';
    this.currentLensFinish = 'clear';

    this.init();
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight || 620;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e0e10);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    this.camera.position.copy(this.initialCameraPos);

    // 3. Renderer with PBR settings
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    // 4. Studio Lighting
    this.setupLighting();

    // 5. Controls
    this.setupControls();

    // 6. Build Procedural 3D Glasses Model
    this.createProceduralGlasses();

    // 7. Soft Ground Shadow
    this.createGroundShadow();

    // 8. Event Listeners & UI Binding
    this.setupUI();
    window.addEventListener('resize', () => this.onResize());

    // 9. Animation Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupLighting() {
    // Ambient soft studio fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambientLight);

    // Key Light (Warm top-right)
    const keyLight = new THREE.DirectionalLight(0xfff5eb, 2.4);
    keyLight.position.set(4, 7, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    // Fill Light (Cool soft fill from left)
    const fillLight = new THREE.DirectionalLight(0xebf2ff, 1.4);
    fillLight.position.set(-5, 3, 4);
    this.scene.add(fillLight);

    // Rim/Back Highlight Light (Sharp silhouette on titanium rims)
    const rimLight = new THREE.DirectionalLight(0xffffff, 3.2);
    rimLight.position.set(0, 5, -5);
    this.scene.add(rimLight);

    // Bottom bounce light for realistic ground reflection
    const bounceLight = new THREE.PointLight(0xffffff, 0.8, 10);
    bounceLight.position.set(0, -2, 1);
    this.scene.add(bounceLight);
  }

  setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 1.0;
    this.controls.enablePan = false;

    // Movement limits as requested
    this.controls.minDistance = 2.4;
    this.controls.maxDistance = 7.0;
    this.controls.minPolarAngle = Math.PI / 4.2;      // Prevent extreme top-down
    this.controls.maxPolarAngle = Math.PI / 1.78;     // Prevent looking completely from below

    const hint = document.getElementById('drag-hint-badge');

    this.controls.addEventListener('start', () => {
      this.controls.autoRotate = false;
      if (this.idleTimer) clearTimeout(this.idleTimer);
      if (hint) hint.classList.add('opacity-0', 'pointer-events-none');
    });

    this.controls.addEventListener('end', () => {
      if (this.idleTimer) clearTimeout(this.idleTimer);
      // Smoothly resume auto rotation after 2.4 seconds of inactivity
      this.idleTimer = setTimeout(() => {
        this.controls.autoRotate = true;
      }, 2400);
    });
  }

  createGroundShadow() {
    // Soft radial ground shadow disc
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
    grad.addColorStop(0.4, 'rgba(0, 0, 0, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const shadowTex = new THREE.CanvasTexture(canvas);
    const shadowGeo = new THREE.PlaneGeometry(5.2, 5.2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false
    });

    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -1.15;
    this.scene.add(shadowMesh);
  }

  createProceduralGlasses() {
    this.glassesGroup = new THREE.Group();
    this.frameMeshes = [];
    this.lensMeshes = [];

    // Frame PBR Material
    const frameConf = this.frameFinishes[this.currentFrameFinish];
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: frameConf.color,
      metalness: frameConf.metalness,
      roughness: frameConf.roughness,
      envMapIntensity: 1.5
    });

    // Glass Lenses PBR Material
    const lensConf = this.lensFinishes[this.currentLensFinish];
    const lensMaterial = new THREE.MeshPhysicalMaterial({
      color: lensConf.color,
      transparent: true,
      opacity: lensConf.opacity,
      transmission: lensConf.transmission,
      roughness: lensConf.roughness,
      metalness: 0.05,
      ior: 1.52,
      reflectivity: 0.9,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04
    });

    // Nosepad & Hinge Detail Material (High-Polish Chrome)
    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.95,
      roughness: 0.1
    });

    const rimRadiusX = 0.88;
    const rimRadiusY = 0.78;
    const rimThickness = 0.038;
    const rimCenterOffset = 1.08;

    // Helper to create an aerodynamic oval panto rim
    const createRim = (offsetX) => {
      // Create curved tube along oval path
      const curvePoints = [];
      const segments = 64;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const x = Math.cos(theta) * rimRadiusX;
        const y = Math.sin(theta) * rimRadiusY;
        const z = -Math.pow(x, 2) * 0.04; // Gentle facial wrap curvature
        curvePoints.push(new THREE.Vector3(x, y, z));
      }
      const path = new THREE.CatmullRomCurve3(curvePoints);
      const rimGeo = new THREE.TubeGeometry(path, 64, rimThickness, 12, true);
      const rimMesh = new THREE.Mesh(rimGeo, frameMaterial);
      rimMesh.position.x = offsetX;
      rimMesh.castShadow = true;
      this.frameMeshes.push(rimMesh);
      this.glassesGroup.add(rimMesh);

      // Glass Lens
      const lensGeo = new THREE.CylinderGeometry(rimRadiusX * 0.97, rimRadiusX * 0.97, 0.015, 48);
      const lensMesh = new THREE.Mesh(lensGeo, lensMaterial);
      lensMesh.rotation.x = Math.PI / 2;
      lensMesh.scale.set(1.0, 1.0, rimRadiusY / rimRadiusX);
      lensMesh.position.set(offsetX, 0, 0);
      this.lensMeshes.push(lensMesh);
      this.glassesGroup.add(lensMesh);

      // Nose Pad assembly
      const padSign = offsetX > 0 ? -1 : 1;
      const padStemCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(offsetX + padSign * 0.65, -0.05, -0.05),
        new THREE.Vector3(offsetX + padSign * 0.52, -0.15, -0.2),
        new THREE.Vector3(offsetX + padSign * 0.45, -0.25, -0.3)
      ]);
      const padStemGeo = new THREE.TubeGeometry(padStemCurve, 16, 0.016, 8, false);
      const padStemMesh = new THREE.Mesh(padStemGeo, chromeMaterial);
      this.glassesGroup.add(padStemMesh);

      // Pad itself (silicone / titanium capsule)
      const padGeo = new THREE.CapsuleGeometry(0.048, 0.12, 8, 16);
      const padMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.3, metalness: 0.1 });
      const padMesh = new THREE.Mesh(padGeo, padMat);
      padMesh.position.set(offsetX + padSign * 0.45, -0.25, -0.32);
      padMesh.rotation.set(0.2, padSign * 0.3, 0);
      this.glassesGroup.add(padMesh);
    };

    // 1. Create Left and Right Rims
    createRim(-rimCenterOffset);
    createRim(rimCenterOffset);

    // 2. Central Arch Bridge (Puente)
    const bridgeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-rimCenterOffset + rimRadiusX * 0.85, 0.18, -0.02),
      new THREE.Vector3(0, 0.38, 0.06),
      new THREE.Vector3(rimCenterOffset - rimRadiusX * 0.85, 0.18, -0.02)
    ]);
    const bridgeGeo = new THREE.TubeGeometry(bridgeCurve, 32, 0.034, 10, false);
    const bridgeMesh = new THREE.Mesh(bridgeGeo, frameMaterial);
    bridgeMesh.castShadow = true;
    this.frameMeshes.push(bridgeMesh);
    this.glassesGroup.add(bridgeMesh);

    // 3. Hinges & Temples (Patillas / Varillas laterales)
    const createTemple = (sideSign) => {
      const hingeX = sideSign * (rimCenterOffset + rimRadiusX * 0.98);

      // Metallic Hinge Cylinder
      const hingeGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.1, 16);
      const hingeMesh = new THREE.Mesh(hingeGeo, chromeMaterial);
      hingeMesh.position.set(hingeX, 0.12, -0.08);
      this.glassesGroup.add(hingeMesh);

      // Long ergonomic temple curve
      const templeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(hingeX, 0.12, -0.08),
        new THREE.Vector3(hingeX + sideSign * 0.04, 0.12, -1.2),
        new THREE.Vector3(hingeX + sideSign * 0.02, 0.10, -2.4),
        new THREE.Vector3(hingeX - sideSign * 0.02, -0.05, -3.1),
        new THREE.Vector3(hingeX - sideSign * 0.06, -0.42, -3.45) // Ergonomic ear bend
      ]);

      const templeGeo = new THREE.TubeGeometry(templeCurve, 64, 0.032, 10, false);
      const templeMesh = new THREE.Mesh(templeGeo, frameMaterial);
      templeMesh.castShadow = true;
      this.frameMeshes.push(templeMesh);
      this.glassesGroup.add(templeMesh);
    };

    createTemple(-1); // Left temple
    createTemple(1);  // Right temple

    // Center and raise glasses slightly above ground
    this.glassesGroup.position.set(0, 0.1, 0);
    this.scene.add(this.glassesGroup);
  }

  setFrameFinish(key) {
    const conf = this.frameFinishes[key];
    if (!conf) return;
    this.currentFrameFinish = key;

    this.frameMeshes.forEach(mesh => {
      mesh.material.color.setHex(conf.color);
      mesh.material.metalness = conf.metalness;
      mesh.material.roughness = conf.roughness;
      mesh.material.needsUpdate = true;
    });

    const label = document.getElementById('current-frame-label');
    if (label) label.textContent = conf.name;
  }

  setLensFinish(key) {
    const conf = this.lensFinishes[key];
    if (!conf) return;
    this.currentLensFinish = key;

    this.lensMeshes.forEach(mesh => {
      mesh.material.color.setHex(conf.color);
      mesh.material.opacity = conf.opacity;
      mesh.material.transmission = conf.transmission;
      mesh.material.roughness = conf.roughness;
      mesh.material.needsUpdate = true;
    });

    const label = document.getElementById('current-lens-label');
    if (label) label.textContent = conf.name;
  }

  resetView() {
    this.isResetting = true;
    const startPos = this.camera.position.clone();
    const targetPos = this.initialCameraPos.clone();
    const duration = 800; // ms
    const startTime = performance.now();

    const animateReset = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      this.camera.position.lerpVectors(startPos, targetPos, ease);
      this.controls.target.lerp(this.initialTarget, ease);
      this.controls.update();

      if (progress < 1.0) {
        requestAnimationFrame(animateReset);
      } else {
        this.isResetting = false;
        this.controls.autoRotate = true;
      }
    };

    requestAnimationFrame(animateReset);
  }

  setupUI() {
    // Reset view button
    const resetBtn = document.getElementById('btn-reset-view');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetView());
    }

    // Frame finish buttons
    const frameButtons = document.querySelectorAll('.frame-color-btn');
    frameButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        frameButtons.forEach(b => b.classList.remove('ring-2', 'ring-white', 'scale-110'));
        btn.classList.add('ring-2', 'ring-white', 'scale-110');
        this.setFrameFinish(btn.dataset.frame);
      });
    });

    // Lens finish buttons
    const lensButtons = document.querySelectorAll('.lens-color-btn');
    lensButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        lensButtons.forEach(b => b.classList.remove('border-white', 'text-white'));
        lensButtons.forEach(b => b.classList.add('border-neutral-700', 'text-neutral-400'));
        btn.classList.remove('border-neutral-700', 'text-neutral-400');
        btn.classList.add('border-white', 'text-white');
        this.setLensFinish(btn.dataset.lens);
      });
    });
  }

  onResize() {
    if (!this.container || !this.camera || !this.renderer) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight || 620;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(this.animate);

    if (this.controls && !this.isResetting) {
      this.controls.update();
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new GlassesViewer3D('glasses-canvas-container');
});
