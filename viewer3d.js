// 3D Eyewear Viewer - Three.js PBR Studio Experience with GLTFLoader & Procedural Fallback
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

    this.initialCameraPos = new THREE.Vector3(0, 0.45, 4.4);
    this.initialTarget = new THREE.Vector3(0, 0, 0);

    // Color and Material PBR definitions
    this.frameFinishes = {
      black: { color: 0x141416, metalness: 0.82, roughness: 0.28, name: 'Negro Acetato / Titanio' },
      gold: { color: 0xd4af37, metalness: 0.94, roughness: 0.16, name: 'Oro Champagne Satinado' },
      silver: { color: 0xe5e7eb, metalness: 0.96, roughness: 0.14, name: 'Plata Quirúrgica' },
      amber: { color: 0x8a4500, metalness: 0.15, roughness: 0.22, name: 'Bio-Acetato Ámbar' }
    };

    this.lensFinishes = {
      clear: { color: 0xf3f4f6, opacity: 0.35, transmission: 0.92, roughness: 0.02, name: 'Transparente HD' },
      green: { color: 0x162c22, opacity: 0.82, transmission: 0.35, roughness: 0.04, name: 'Solar Mineral Verde' },
      blue: { color: 0x152238, opacity: 0.78, transmission: 0.38, roughness: 0.04, name: 'Degradé Azul Noche' }
    };

    this.currentFrameFinish = 'black';
    this.currentLensFinish = 'clear';

    this.init();
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight || 640;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e0e10);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    this.camera.position.copy(this.initialCameraPos);

    // 3. Renderer with PBR settings
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    // 4. Studio Lighting
    this.setupLighting();

    // 5. Controls
    this.setupControls();

    // 6. Soft Ground Contact Shadow
    this.createGroundShadow();

    // 7. Load GLB Model (with procedural geometry fallback)
    this.loadGlassesModel('assets/plastic_sunglasses.glb');

    // 8. Event Listeners & UI Binding
    this.setupUI();
    window.addEventListener('resize', () => this.onResize());

    // 9. Animation Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupLighting() {
    // Ambient soft studio fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
    this.scene.add(ambientLight);

    // Key Light (Warm top-right)
    const keyLight = new THREE.DirectionalLight(0xfff8ee, 2.8);
    keyLight.position.set(4, 6, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    // Fill Light (Cool soft fill from left)
    const fillLight = new THREE.DirectionalLight(0xedf4ff, 1.6);
    fillLight.position.set(-5, 3, 4);
    this.scene.add(fillLight);

    // Rim/Back Highlight Light (Outlines frame contours)
    const rimLight = new THREE.DirectionalLight(0xffffff, 3.6);
    rimLight.position.set(0, 5, -5);
    this.scene.add(rimLight);

    // Subtle bottom bounce light
    const bounceLight = new THREE.PointLight(0xffffff, 0.9, 10);
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
    this.controls.maxDistance = 6.8;
    this.controls.minPolarAngle = Math.PI / 4.2;      // Prevent extreme top-down
    this.controls.maxPolarAngle = Math.PI / 1.76;     // Prevent looking completely from below

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
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.28)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const shadowTex = new THREE.CanvasTexture(canvas);
    const shadowGeo = new THREE.PlaneGeometry(5.4, 5.4);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false
    });

    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.95;
    this.scene.add(shadowMesh);
  }

  loadGlassesModel(modelPath) {
    const loader = new GLTFLoader();

    loader.load(
      modelPath,
      (gltf) => {
        console.log('GLB model loaded successfully:', modelPath);
        this.processLoadedModel(gltf.scene);
      },
      (xhr) => {
        // Progress
        const percent = xhr.total ? (xhr.loaded / xhr.total) * 100 : 0;
        console.log(`Loading 3D model: ${Math.round(percent)}%`);
      },
      (error) => {
        console.warn('Could not load external GLB model, falling back to procedural 3D geometry:', error);
        this.createProceduralGlasses();
      }
    );
  }

  processLoadedModel(modelScene) {
    this.glassesGroup = new THREE.Group();
    this.frameMeshes = [];
    this.lensMeshes = [];

    // Calculate Bounding Box to auto-center and scale
    const box = new THREE.Box3().setFromObject(modelScene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Center model at origin
    modelScene.position.sub(center);

    // Scale to standardized protagonist viewport size (width ~ 3.4 units)
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 3.4 / (maxDim || 1);
    this.glassesGroup.scale.setScalar(scale);

    // Frame & Lens PBR Materials
    const frameConf = this.frameFinishes[this.currentFrameFinish];
    const lensConf = this.lensFinishes[this.currentLensFinish];

    const upgradedFrameMat = new THREE.MeshStandardMaterial({
      color: frameConf.color,
      metalness: frameConf.metalness,
      roughness: frameConf.roughness,
      envMapIntensity: 1.5
    });

    const upgradedLensMat = new THREE.MeshPhysicalMaterial({
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

    // Traverse and identify frame vs lenses
    modelScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        const matName = child.material ? child.material.name : '';
        const meshName = (child.name || '').toLowerCase();

        // Check if mesh is a lens (by material name 'material_3' or transparency)
        const isLens = matName === 'material_3' || 
                       meshName.includes('lens') || 
                       meshName.includes('glass') || 
                       meshName.includes('cristal') ||
                       (child.material && child.material.transparent && child.material.opacity < 0.8);

        if (isLens) {
          child.material = upgradedLensMat.clone();
          this.lensMeshes.push(child);
        } else {
          // Frame or temple mesh
          child.material = upgradedFrameMat.clone();
          this.frameMeshes.push(child);
        }
      }
    });

    this.glassesGroup.add(modelScene);
    // Slight elevation above ground
    this.glassesGroup.position.set(0, 0.08, 0);
    this.scene.add(this.glassesGroup);

    // Update labels if needed
    const modelBadge = document.getElementById('viewer-model-title');
    if (modelBadge) modelBadge.textContent = 'Montura Sol / Acetato Pulido';
  }

  createProceduralGlasses() {
    this.glassesGroup = new THREE.Group();
    this.frameMeshes = [];
    this.lensMeshes = [];

    const frameConf = this.frameFinishes[this.currentFrameFinish];
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: frameConf.color,
      metalness: frameConf.metalness,
      roughness: frameConf.roughness,
      envMapIntensity: 1.5
    });

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

    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.95,
      roughness: 0.1
    });

    const rimRadiusX = 0.88;
    const rimRadiusY = 0.78;
    const rimThickness = 0.038;
    const rimCenterOffset = 1.08;

    const createRim = (offsetX) => {
      const curvePoints = [];
      const segments = 64;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const x = Math.cos(theta) * rimRadiusX;
        const y = Math.sin(theta) * rimRadiusY;
        const z = -Math.pow(x, 2) * 0.04;
        curvePoints.push(new THREE.Vector3(x, y, z));
      }
      const path = new THREE.CatmullRomCurve3(curvePoints);
      const rimGeo = new THREE.TubeGeometry(path, 64, rimThickness, 12, true);
      const rimMesh = new THREE.Mesh(rimGeo, frameMaterial);
      rimMesh.position.x = offsetX;
      rimMesh.castShadow = true;
      this.frameMeshes.push(rimMesh);
      this.glassesGroup.add(rimMesh);

      const lensGeo = new THREE.CylinderGeometry(rimRadiusX * 0.97, rimRadiusX * 0.97, 0.015, 48);
      const lensMesh = new THREE.Mesh(lensGeo, lensMaterial);
      lensMesh.rotation.x = Math.PI / 2;
      lensMesh.scale.set(1.0, 1.0, rimRadiusY / rimRadiusX);
      lensMesh.position.set(offsetX, 0, 0);
      this.lensMeshes.push(lensMesh);
      this.glassesGroup.add(lensMesh);

      const padSign = offsetX > 0 ? -1 : 1;
      const padStemCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(offsetX + padSign * 0.65, -0.05, -0.05),
        new THREE.Vector3(offsetX + padSign * 0.52, -0.15, -0.2),
        new THREE.Vector3(offsetX + padSign * 0.45, -0.25, -0.3)
      ]);
      const padStemGeo = new THREE.TubeGeometry(padStemCurve, 16, 0.016, 8, false);
      const padStemMesh = new THREE.Mesh(padStemGeo, chromeMaterial);
      this.glassesGroup.add(padStemMesh);

      const padGeo = new THREE.CapsuleGeometry(0.048, 0.12, 8, 16);
      const padMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.3, metalness: 0.1 });
      const padMesh = new THREE.Mesh(padGeo, padMat);
      padMesh.position.set(offsetX + padSign * 0.45, -0.25, -0.32);
      padMesh.rotation.set(0.2, padSign * 0.3, 0);
      this.glassesGroup.add(padMesh);
    };

    createRim(-rimCenterOffset);
    createRim(rimCenterOffset);

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

    const createTemple = (sideSign) => {
      const hingeX = sideSign * (rimCenterOffset + rimRadiusX * 0.98);

      const hingeGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.1, 16);
      const hingeMesh = new THREE.Mesh(hingeGeo, chromeMaterial);
      hingeMesh.position.set(hingeX, 0.12, -0.08);
      this.glassesGroup.add(hingeMesh);

      const templeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(hingeX, 0.12, -0.08),
        new THREE.Vector3(hingeX + sideSign * 0.04, 0.12, -1.2),
        new THREE.Vector3(hingeX + sideSign * 0.02, 0.10, -2.4),
        new THREE.Vector3(hingeX - sideSign * 0.02, -0.05, -3.1),
        new THREE.Vector3(hingeX - sideSign * 0.06, -0.42, -3.45)
      ]);

      const templeGeo = new THREE.TubeGeometry(templeCurve, 64, 0.032, 10, false);
      const templeMesh = new THREE.Mesh(templeGeo, frameMaterial);
      templeMesh.castShadow = true;
      this.frameMeshes.push(templeMesh);
      this.glassesGroup.add(templeMesh);
    };

    createTemple(-1);
    createTemple(1);

    this.glassesGroup.position.set(0, 0.1, 0);
    this.scene.add(this.glassesGroup);
  }

  setFrameFinish(key) {
    const conf = this.frameFinishes[key];
    if (!conf) return;
    this.currentFrameFinish = key;

    this.frameMeshes.forEach(mesh => {
      if (mesh.material) {
        mesh.material.color.setHex(conf.color);
        mesh.material.metalness = conf.metalness;
        mesh.material.roughness = conf.roughness;
        mesh.material.needsUpdate = true;
      }
    });

    const label = document.getElementById('current-frame-label');
    if (label) label.textContent = conf.name;
  }

  setLensFinish(key) {
    const conf = this.lensFinishes[key];
    if (!conf) return;
    this.currentLensFinish = key;

    this.lensMeshes.forEach(mesh => {
      if (mesh.material) {
        mesh.material.color.setHex(conf.color);
        mesh.material.opacity = conf.opacity;
        mesh.material.transmission = conf.transmission;
        mesh.material.roughness = conf.roughness;
        mesh.material.needsUpdate = true;
      }
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
    const resetBtn = document.getElementById('btn-reset-view');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetView());
    }

    const frameButtons = document.querySelectorAll('.frame-color-btn');
    frameButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        frameButtons.forEach(b => b.classList.remove('ring-2', 'ring-white', 'scale-110'));
        btn.classList.add('ring-2', 'ring-white', 'scale-110');
        this.setFrameFinish(btn.dataset.frame);
      });
    });

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
    const height = this.container.clientHeight || 640;

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
