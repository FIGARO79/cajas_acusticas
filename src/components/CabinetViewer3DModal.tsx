import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { type Lang, translate } from '../utils/translations';
import { type UnitSystem, convertTo, getUnitLabel } from '../utils/units';
import type { WoodCabinetData } from '../types';

interface CabinetViewer3DModalProps {
  theme?: 'dark' | 'light';
  isOpen: boolean;
  onClose: () => void;
  lang: Lang;
  unitSystem: UnitSystem;
  shape: 'rectangular' | 'trapezoidal';
  cabinetData: WoodCabinetData | null;
  boxType: 'sealed' | 'ported' | 'bandpass';
  portShape: 'round' | 'rectangular' | 'custom';
  portDiameter: number;
  portWidth: number;
  portHeight: number;
  portLength: number;
  portCount: number;
  flaredEnds?: 0 | 1 | 2 | 3;
  speakerYPct?: number;
  tweeterYPct?: number;
  midrangeYPct?: number;
  crossoverWays?: number;
  midSealed?: boolean;
  overallDiameter?: number;
  baffleCutout?: number;
  driverDepth?: number;
  portYPct?: number;
  portLocation?: 'front' | 'rear';
  bandpassOrder?: 4 | 6;
  bandpassRatio?: number;
  bandpassVf?: number;
  bandpassVr?: number;
  dampingType?: 'none' | 'light' | 'moderate' | 'heavy';
}

export const CabinetViewer3DModal: React.FC<CabinetViewer3DModalProps> = ({
  theme = 'dark',
  isOpen,
  onClose,
  lang,
  unitSystem,
  shape,
  cabinetData,
  boxType,
  portShape,
  portDiameter,
  portWidth,
  portHeight,
  portLength,
  portCount,
  flaredEnds = 0,
  speakerYPct = 50,
  tweeterYPct = 20,
  midrangeYPct = 40,
  crossoverWays = 2,
  midSealed = true,
  overallDiameter,
  baffleCutout,
  driverDepth,
  portYPct = 85,
  portLocation = 'front',
  bandpassOrder = 4,
  bandpassRatio = 0.5,
  bandpassVf,
  bandpassVr,
  dampingType = 'none',
}) => {
  const t = (text: string) => translate(text, lang);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Active theme detection
  const [effectiveTheme, setEffectiveTheme] = useState<'dark' | 'light'>(theme);

  useEffect(() => {
    setEffectiveTheme(theme);
  }, [theme]);

  useEffect(() => {
    const checkDomTheme = () => {
      const domTheme = document.documentElement.getAttribute('data-theme') as 'dark' | 'light' | null;
      if (domTheme) setEffectiveTheme(domTheme);
    };
    checkDomTheme();

    const observer = new MutationObserver(checkDomTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const isLight = effectiveTheme === 'light';

  // Group references for interactive explosion
  const panelsGroupRef = useRef<THREE.Group | null>(null);
  const panelMeshesRef = useRef<{
    top?: THREE.Mesh;
    bottom?: THREE.Mesh;
    left?: THREE.Mesh;
    right?: THREE.Mesh;
    rear?: THREE.Group;
    front?: THREE.Group;
    divider?: THREE.Group | THREE.Mesh;
  }>({});
  const dividerBaseZRef = useRef<number>(0);
  const chambersRef = useRef<{ vr?: THREE.Mesh; vf?: THREE.Mesh }>({});

  // UI States
  const [renderMode, setRenderMode] = useState<'solid' | 'xray' | 'wireframe'>(
    boxType === 'bandpass' ? 'xray' : 'solid'
  );
  const [explodedPct, setExplodedPct] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showWireEdges, setShowWireEdges] = useState<boolean>(true);

  // En cajas paso banda, abrir en modo rayos X para ver de inmediato el divisor, woofer y cámaras interiores
  useEffect(() => {
    if (isOpen && boxType === 'bandpass') {
      setRenderMode('xray');
    }
  }, [isOpen, boxType]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Dimension helpers in centimeters
  const wExt = cabinetData?.wExt || 35;
  const hExt = cabinetData?.hExt || 50;
  const dExt = shape === 'rectangular' 
    ? (cabinetData?.dExt || 30) 
    : Math.max(cabinetData?.dTrapTopExt || 20, cabinetData?.dTrapBotExt || 35);
  const dTrapTop = cabinetData?.dTrapTopExt || 20;
  const dTrapBot = cabinetData?.dTrapBotExt || 35;
  const thickness = (cabinetData?.thickness || 19) / 10; // mm to cm

  // Camera presets
  const applyPreset = useCallback((preset: 'iso' | 'front' | 'side' | 'top') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const maxDim = Math.max(wExt, hExt, dExt);
    const dist = maxDim * 2.2;

    switch (preset) {
      case 'iso':
        cameraRef.current.position.set(dist * 0.7, dist * 0.6, dist * 0.9);
        break;
      case 'front':
        cameraRef.current.position.set(0, 0, dist * 1.3);
        break;
      case 'side':
        cameraRef.current.position.set(dist * 1.3, 0, 0);
        break;
      case 'top':
        cameraRef.current.position.set(0, dist * 1.3, 0.001);
        break;
    }
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  }, [wExt, hExt, dExt]);

  // Update exploded transformation
  useEffect(() => {
    const meshes = panelMeshesRef.current;
    const maxDim = Math.max(wExt, hExt, dExt);
    const offset = (explodedPct / 100) * (maxDim * 0.45);

    if (meshes.top) meshes.top.position.y = (hExt - thickness) / 2 + offset;
    if (meshes.bottom) meshes.bottom.position.y = -(hExt - thickness) / 2 - offset;
    if (meshes.left) meshes.left.position.x = -(wExt - thickness) / 2 - offset;
    if (meshes.right) meshes.right.position.x = (wExt - thickness) / 2 + offset;
    if (meshes.rear) meshes.rear.position.z = -(dExt - thickness) / 2 - offset;
    if (meshes.front) meshes.front.position.z = (dExt - thickness) / 2 + offset;
    if (meshes.divider) meshes.divider.position.z = dividerBaseZRef.current + offset * 0.22;

    if (chambersRef.current.vr) chambersRef.current.vr.visible = explodedPct < 15;
    if (chambersRef.current.vf) chambersRef.current.vf.visible = explodedPct < 15;
  }, [explodedPct, wExt, hExt, dExt, thickness]);

  // Main Three.js Scene Setup & Rebuild
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    // 1. Scene with theme-aware background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isLight ? 0xf8fafc : 0x060f1d);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxDistance = 1500;
    controls.minDistance = 10;
    controlsRef.current = controls;

    // Initial Camera positioning (slightly elevated target so cabinet & grid sit higher above bottom bar)
    const maxDim = Math.max(wExt, hExt, dExt);
    camera.position.set(maxDim * 1.55, maxDim * 1.2, maxDim * 1.95);
    controls.target.set(0, -maxDim * 0.12, 0);
    controls.update();

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, isLight ? 0.95 : 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(isLight ? 0xffffff : 0x38bdf8, isLight ? 1.2 : 1.4);
    dirLight1.position.set(maxDim * 2, maxDim * 3, maxDim * 2);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(isLight ? 0x0284c7 : 0x10b981, isLight ? 0.5 : 0.7);
    dirLight2.position.set(-maxDim * 2, -maxDim, -maxDim * 2);
    scene.add(dirLight2);

    const hemiLight = new THREE.HemisphereLight(
      isLight ? 0xffffff : 0x1e293b,
      isLight ? 0xe2e8f0 : 0x0f172a,
      0.6
    );
    scene.add(hemiLight);

    // 6. CAD Grid Floor
    const gridSize = Math.max(wExt, dExt, hExt) * 3;
    const gridHelper = new THREE.GridHelper(
      gridSize,
      30,
      isLight ? 0x0284c7 : 0x0284c7,
      isLight ? 0xcbd5e1 : 0x0f2a4a
    );
    gridHelper.position.y = -hExt / 2 - 2;
    scene.add(gridHelper);

    // 7. Cabinet Geometry & Materials
    const panelsGroup = new THREE.Group();
    scene.add(panelsGroup);
    panelsGroupRef.current = panelsGroup;
    panelMeshesRef.current = {};

    // Determine panel material based on renderMode
    const getWoodMaterial = () => {
      if (renderMode === 'wireframe') {
        return new THREE.MeshBasicMaterial({
          color: isLight ? 0x0284c7 : 0x0284c7,
          wireframe: true,
        });
      }
      if (renderMode === 'xray') {
        return new THREE.MeshStandardMaterial({
          color: isLight ? 0x0284c7 : 0x38bdf8,
          transparent: true,
          opacity: isLight ? 0.22 : 0.25,
          roughness: 0.2,
          metalness: 0.1,
          depthWrite: false,
        });
      }
      // Solid MDF Finish
      return new THREE.MeshStandardMaterial({
        color: isLight ? 0xc89f6d : 0xbe8a54,
        roughness: 0.65,
        metalness: 0.08,
      });
    };

    const edgeLineMaterial = new THREE.LineBasicMaterial({
      color: isLight ? 0x0284c7 : (renderMode === 'xray' ? 0x38bdf8 : 0x10b981),
      linewidth: 1,
    });

    const addEdgeLines = (mesh: THREE.Mesh) => {
      if (!showWireEdges) return;
      const edges = new THREE.EdgesGeometry(mesh.geometry, 28);
      const line = new THREE.LineSegments(edges, edgeLineMaterial);
      mesh.add(line);
    };

    const innerH = hExt - 2 * thickness;
    const innerW = wExt - 2 * thickness;
    const innerD = dExt - 2 * thickness;

    // Pre-calculate driver & port positions/radii for true 3D baffle cutouts
    const isBandpass = boxType === 'bandpass';
    const defaultWooferDia = crossoverWays === 3
      ? Math.min(innerW * 0.68, innerH * 0.34)
      : Math.min(innerW * 0.74, innerH * 0.42);
    const wooferDiameter = overallDiameter && overallDiameter > 0
      ? Math.min(overallDiameter / 10, innerW - 1)
      : defaultWooferDia;
    const wooferRadius = wooferDiameter / 2;
    const wooferY = innerH * (0.5 - speakerYPct / 100);
    const cutoutRadius = baffleCutout && baffleCutout > 0
      ? Math.min(baffleCutout / 20, wooferRadius * 0.88)
      : wooferRadius * 0.84;

    const tweeterRadius = Math.min(innerW * 0.26, innerH * 0.13, wooferDiameter * 0.42) / 2;
    const tweeterY = innerH * (0.5 - tweeterYPct / 100);

    const midDiameter = Math.min(innerW * 0.42, innerH * 0.20, wooferDiameter * 0.60);
    const midRadius = midDiameter / 2;
    const midY = innerH * (0.5 - midrangeYPct / 100);

    // Helper to build a panel with circular/rectangular cutout holes
    const createPerforatedPanelGeo = (
      panelW: number,
      panelH: number,
      panelT: number,
      circles: Array<{ x: number; y: number; r: number }>,
      rects: Array<{ x: number; y: number; w: number; h: number }> = []
    ) => {
      if (circles.length === 0 && rects.length === 0) {
        return new THREE.BoxGeometry(panelW, panelH, panelT);
      }
      const shape = new THREE.Shape();
      const hw = panelW / 2;
      const hh = panelH / 2;
      shape.moveTo(-hw, -hh);
      shape.lineTo(hw, -hh);
      shape.lineTo(hw, hh);
      shape.lineTo(-hw, hh);
      shape.closePath();

      const addedCircles: Array<{ x: number; y: number; r: number }> = [];
      for (const c of circles) {
        const safeR = Math.min(c.r, hw - Math.abs(c.x) - 0.3, hh - Math.abs(c.y) - 0.3);
        if (safeR <= 0.4) continue;
        const overlaps = addedCircles.some(
          (other) => Math.hypot(c.x - other.x, c.y - other.y) < safeR + other.r + 0.2
        );
        if (overlaps) continue;
        addedCircles.push({ x: c.x, y: c.y, r: safeR });
        const holePath = new THREE.Path();
        holePath.absarc(c.x, c.y, safeR, 0, Math.PI * 2, true);
        shape.holes.push(holePath);
      }

      for (const rc of rects) {
        const rhw = Math.min(rc.w / 2, hw - Math.abs(rc.x) - 0.3);
        const rhh = Math.min(rc.h / 2, hh - Math.abs(rc.y) - 0.3);
        if (rhw <= 0.3 || rhh <= 0.3) continue;
        const overlapsCircle = addedCircles.some(
          (other) => Math.hypot(rc.x - other.x, rc.y - other.y) < Math.hypot(rhw, rhh) + other.r + 0.2
        );
        if (overlapsCircle) continue;
        const holePath = new THREE.Path();
        holePath.moveTo(rc.x - rhw, rc.y - rhh);
        holePath.lineTo(rc.x - rhw, rc.y + rhh);
        holePath.lineTo(rc.x + rhw, rc.y + rhh);
        holePath.lineTo(rc.x + rhw, rc.y - rhh);
        holePath.closePath();
        shape.holes.push(holePath);
      }

      const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
        depth: panelT,
        bevelEnabled: false,
        curveSegments: 48,
      });
      extrudeGeo.translate(0, 0, -panelT / 2);
      return extrudeGeo;
    };

    const frontHoleCircles: Array<{ x: number; y: number; r: number }> = [];
    const frontHoleRects: Array<{ x: number; y: number; w: number; h: number }> = [];
    const rearHoleCircles: Array<{ x: number; y: number; r: number }> = [];
    const rearHoleRects: Array<{ x: number; y: number; w: number; h: number }> = [];

    if (!isBandpass) {
      frontHoleCircles.push({ x: 0, y: wooferY, r: cutoutRadius });
      if (crossoverWays === 3) {
        frontHoleCircles.push({ x: 0, y: midY, r: midRadius * 0.84 });
      }
      if (crossoverWays >= 2) {
        frontHoleCircles.push({ x: 0, y: tweeterY, r: tweeterRadius * 0.62 });
      }
    }

    if (boxType === 'ported' || boxType === 'bandpass') {
      const portY = innerH * (0.5 - portYPct / 100);
      const count = Math.max(Number(portCount) || 1, 1);
      const portSpacing = count > 1 ? Math.min((innerW * 0.45) / count, 12) : 0;
      const isRearPort = boxType === 'bandpass' ? false : portLocation === 'rear';
      for (let pIdx = 0; pIdx < count; pIdx++) {
        const pCurX = count === 1 ? 0 : -((count - 1) * portSpacing) / 2 + pIdx * portSpacing;
        if (portShape === 'round' || portShape === 'custom') {
          const pRadius = Math.max((portDiameter || 7.5) / 2, 1.5);
          (isRearPort ? rearHoleCircles : frontHoleCircles).push({ x: pCurX, y: portY, r: pRadius });
          if (boxType === 'bandpass' && bandpassOrder === 6) {
            rearHoleCircles.push({ x: pCurX, y: portY, r: pRadius });
          }
        } else {
          const pW = Math.max(portWidth || 10, 2);
          const pH = Math.max(portHeight || 4, 1.5);
          (isRearPort ? rearHoleRects : frontHoleRects).push({ x: pCurX, y: portY, w: pW, h: pH });
          if (boxType === 'bandpass' && bandpassOrder === 6) {
            rearHoleRects.push({ x: pCurX, y: portY, w: pW, h: pH });
          }
        }
      }
    }

    // --- TAPA SUPERIOR ---
    const topGeo = new THREE.BoxGeometry(wExt, thickness, dExt);
    const topMesh = new THREE.Mesh(topGeo, getWoodMaterial());
    topMesh.position.set(0, (hExt - thickness) / 2, 0);
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    addEdgeLines(topMesh);
    panelsGroup.add(topMesh);
    panelMeshesRef.current.top = topMesh;

    // --- TAPA INFERIOR ---
    const botGeo = new THREE.BoxGeometry(wExt, thickness, dExt);
    const botMesh = new THREE.Mesh(botGeo, getWoodMaterial());
    botMesh.position.set(0, -(hExt - thickness) / 2, 0);
    botMesh.castShadow = true;
    botMesh.receiveShadow = true;
    addEdgeLines(botMesh);
    panelsGroup.add(botMesh);
    panelMeshesRef.current.bottom = botMesh;

    // --- LATERAL IZQUIERDO ---
    const leftGeo = new THREE.BoxGeometry(thickness, innerH, dExt);
    const leftMesh = new THREE.Mesh(leftGeo, getWoodMaterial());
    leftMesh.position.set(-(wExt - thickness) / 2, 0, 0);
    leftMesh.castShadow = true;
    leftMesh.receiveShadow = true;
    addEdgeLines(leftMesh);
    panelsGroup.add(leftMesh);
    panelMeshesRef.current.left = leftMesh;

    // --- LATERAL DERECHO ---
    const rightGeo = new THREE.BoxGeometry(thickness, innerH, dExt);
    const rightMesh = new THREE.Mesh(rightGeo, getWoodMaterial());
    rightMesh.position.set((wExt - thickness) / 2, 0, 0);
    rightMesh.castShadow = true;
    rightMesh.receiveShadow = true;
    addEdgeLines(rightMesh);
    panelsGroup.add(rightMesh);
    panelMeshesRef.current.right = rightMesh;

    // --- CARA TRASERA ---
    const rearGroup = new THREE.Group();
    rearGroup.position.set(0, 0, -(dExt - thickness) / 2);

    const rearGeo = createPerforatedPanelGeo(innerW, innerH, thickness, rearHoleCircles, rearHoleRects);
    const rearMesh = new THREE.Mesh(rearGeo, getWoodMaterial());
    rearMesh.castShadow = true;
    rearMesh.receiveShadow = true;
    addEdgeLines(rearMesh);
    rearGroup.add(rearMesh);
    panelsGroup.add(rearGroup);
    panelMeshesRef.current.rear = rearGroup;

    // --- BAFLE FRONTAL + COMPONENTES ---
    const frontGroup = new THREE.Group();
    frontGroup.position.set(0, 0, (dExt - thickness) / 2);

    const frontGeo = createPerforatedPanelGeo(innerW, innerH, thickness, frontHoleCircles, frontHoleRects);
    const frontMesh = new THREE.Mesh(frontGeo, getWoodMaterial());
    frontMesh.castShadow = true;
    frontMesh.receiveShadow = true;
    addEdgeLines(frontMesh);
    frontGroup.add(frontMesh);

    // Helper function to build a realistic 3D Loudspeaker Driver (Woofer or Midrange)
    const buildRealisticConeDriver = (
      outerRadius: number,
      holeRadius: number,
      totalDepthCm: number,
      boltCount: number
    ) => {
      const driverGroup = new THREE.Group();

      const chassisMat = new THREE.MeshStandardMaterial({
        color: isLight ? 0x1e293b : 0x0f172a,
        metalness: 0.78,
        roughness: 0.28,
        side: THREE.DoubleSide,
      });
      const surroundMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.36,
        metalness: 0.16,
      });
      const coneMat = new THREE.MeshStandardMaterial({
        color: isLight ? 0x1e293b : 0x111827,
        roughness: 0.56,
        metalness: 0.2,
        side: THREE.DoubleSide,
      });
      const chromeMat = new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        metalness: 0.92,
        roughness: 0.16,
      });
      const ferriteMat = new THREE.MeshStandardMaterial({
        color: isLight ? 0x334155 : 0x1e293b,
        metalness: 0.55,
        roughness: 0.42,
      });

      // 1. Aro Exterior de Montaje + Junta (queda a ras del bafle z = 0..+0.22)
      const flangeThickness = 0.22;
      const flangeOuterGeo = new THREE.CylinderGeometry(outerRadius, outerRadius, flangeThickness, 48, 1, true);
      flangeOuterGeo.rotateX(Math.PI / 2);
      const flangeOuterMesh = new THREE.Mesh(flangeOuterGeo, chassisMat);
      flangeOuterMesh.position.z = flangeThickness / 2;
      driverGroup.add(flangeOuterMesh);

      const flangeFaceGeo = new THREE.RingGeometry(holeRadius * 0.96, outerRadius, 48);
      const flangeFaceMesh = new THREE.Mesh(flangeFaceGeo, chassisMat);
      flangeFaceMesh.position.z = flangeThickness;
      driverGroup.add(flangeFaceMesh);

      const gasketLipGeo = new THREE.TorusGeometry(outerRadius * 0.93, outerRadius * 0.042, 14, 48);
      const gasketLipMesh = new THREE.Mesh(gasketLipGeo, chassisMat);
      gasketLipMesh.position.z = flangeThickness;
      driverGroup.add(gasketLipMesh);

      // Tornillos perimetrales de fijación
      const boltGeo = new THREE.CylinderGeometry(outerRadius * 0.025, outerRadius * 0.025, 0.12, 12);
      boltGeo.rotateX(Math.PI / 2);
      for (let b = 0; b < boltCount; b++) {
        const angle = (b * Math.PI * 2) / boltCount + Math.PI / boltCount;
        const boltMesh = new THREE.Mesh(boltGeo, chromeMat);
        boltMesh.position.set(
          Math.cos(angle) * (outerRadius * 0.93),
          Math.sin(angle) * (outerRadius * 0.93),
          flangeThickness + 0.06
        );
        driverGroup.add(boltMesh);
      }

      // 2. Suspensión Perimetral Half-Roll (Surround a ras del bafle, sin sobresalir)
      const surroundR = holeRadius * 0.90;
      const surroundTubeR = Math.max((holeRadius - surroundR) * 0.55, outerRadius * 0.048);
      const surroundGeo = new THREE.TorusGeometry(surroundR, surroundTubeR, 20, 48);
      const surroundMesh = new THREE.Mesh(surroundGeo, surroundMat);
      surroundMesh.position.z = 0.12;
      driverGroup.add(surroundMesh);

      // 3. Cono Curvo Exponencial que ENTRA hacia el interior de la caja (-Z)
      const magLen = Math.max(totalDepthCm * 0.36, outerRadius * 0.28);
      const magRadius = Math.min(outerRadius * 0.48, holeRadius * 0.68);
      const basketEndZ = Math.max(totalDepthCm - magLen, thickness + outerRadius * 0.32);
      const coneDepth = Math.min(basketEndZ * 0.72, outerRadius * 0.44);
      const coneOuterR = surroundR - surroundTubeR * 0.65;
      const coneInnerR = Math.max(outerRadius * 0.19, magRadius * 0.38);

      const lathePoints: THREE.Vector2[] = [];
      const segments = 18;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        // Perfil exponencial realista: desde el cuello (-coneDepth) hasta la suspensión (+0.08)
        const r = coneInnerR + (coneOuterR - coneInnerR) * Math.pow(t, 0.76);
        const z = -coneDepth + (coneDepth + 0.08) * t;
        lathePoints.push(new THREE.Vector2(r, z));
      }
      const coneGeo = new THREE.LatheGeometry(lathePoints, 48);
      coneGeo.rotateX(Math.PI / 2);
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      driverGroup.add(coneMesh);

      // Anillos concéntricos de rigidez dentro del cono
      const ribMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.45,
        metalness: 0.3,
      });
      [0.35, 0.6, 0.82].forEach((t) => {
        const rRib = coneInnerR + (coneOuterR - coneInnerR) * Math.pow(t, 0.76);
        const zRib = -coneDepth + (coneDepth + 0.08) * t + 0.02;
        const ribGeo = new THREE.TorusGeometry(rRib, outerRadius * 0.007, 10, 48);
        const ribMesh = new THREE.Mesh(ribGeo, ribMat);
        ribMesh.position.z = zRib;
        driverGroup.add(ribMesh);
      });

      // 4. Domo Central Guardapolvo (Dustcap convexo alojado al fondo del cono)
      const capTheta = Math.PI * 0.38;
      const capSphereR = (coneInnerR * 1.05) / Math.sin(capTheta);
      const dustcapGeo = new THREE.SphereGeometry(capSphereR, 32, 16, 0, Math.PI * 2, 0, capTheta);
      dustcapGeo.rotateX(Math.PI / 2);
      const dustcapMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.32,
        metalness: 0.42,
        side: THREE.DoubleSide,
      });
      const dustcapMesh = new THREE.Mesh(dustcapGeo, dustcapMat);
      dustcapMesh.position.z = -coneDepth - capSphereR * Math.cos(capTheta) + 0.04;
      driverGroup.add(dustcapMesh);

      // 5. Bobina Móvil (Voice Coil Former) + Araña Corrugada (Spider)
      const vcLen = Math.max(basketEndZ - coneDepth, 0.4);
      const vcGeo = new THREE.CylinderGeometry(coneInnerR * 0.96, coneInnerR * 0.96, vcLen, 32);
      vcGeo.rotateX(Math.PI / 2);
      const vcMat = new THREE.MeshStandardMaterial({
        color: 0xb45309,
        metalness: 0.65,
        roughness: 0.35,
      });
      const vcMesh = new THREE.Mesh(vcGeo, vcMat);
      vcMesh.position.z = -coneDepth - vcLen / 2;
      driverGroup.add(vcMesh);

      const spiderOuterR = magRadius * 0.88;
      const spiderGeo = new THREE.RingGeometry(coneInnerR * 0.95, spiderOuterR, 36, 3);
      const spiderMat = new THREE.MeshStandardMaterial({
        color: 0xd97706,
        roughness: 0.6,
        metalness: 0.15,
        side: THREE.DoubleSide,
      });
      const spiderMesh = new THREE.Mesh(spiderGeo, spiderMat);
      spiderMesh.position.z = -basketEndZ + 0.25;
      driverGroup.add(spiderMesh);

      // 6. Canasta Abierta con Brazos/Costillas (Open-Frame Spoked Basket)
      // Anillo en el calado del bafle + anillo de asiento de araña + 8 brazos inclinados
      const throatRingGeo = new THREE.CylinderGeometry(holeRadius * 0.97, holeRadius * 0.94, Math.min(thickness, 1.2), 48, 1, true);
      throatRingGeo.rotateX(Math.PI / 2);
      const throatRingMesh = new THREE.Mesh(throatRingGeo, chassisMat);
      throatRingMesh.position.z = -Math.min(thickness, 1.2) / 2;
      driverGroup.add(throatRingMesh);

      const landingRingGeo = new THREE.CylinderGeometry(magRadius * 0.92, magRadius * 0.92, 0.32, 36);
      landingRingGeo.rotateX(Math.PI / 2);
      const landingRingMesh = new THREE.Mesh(landingRingGeo, chassisMat);
      landingRingMesh.position.z = -basketEndZ + 0.16;
      driverGroup.add(landingRingMesh);

      const spokeCount = boltCount;
      const spokeStartR = holeRadius * 0.92;
      const spokeStartZ = -Math.min(thickness * 0.6, 0.8);
      const spokeEndR = magRadius * 0.86;
      const spokeEndZ = -basketEndZ + 0.2;
      const dR = spokeEndR - spokeStartR;
      const dZ = spokeEndZ - spokeStartZ;
      const spokeLen = Math.hypot(dR, dZ);
      const spokeWidth = Math.max(outerRadius * 0.085, 0.45);
      const spokeThickness = Math.max(outerRadius * 0.035, 0.22);

      for (let s = 0; s < spokeCount; s++) {
        const angle = (s * Math.PI * 2) / spokeCount;
        const spokePivot = new THREE.Group();
        spokePivot.rotation.z = angle;

        const spokeGeo = new THREE.BoxGeometry(spokeThickness, spokeWidth, spokeLen);
        const spokeMesh = new THREE.Mesh(spokeGeo, chassisMat);
        const midR = (spokeStartR + spokeEndR) / 2;
        const midZ = (spokeStartZ + spokeEndZ) / 2;
        spokeMesh.position.set(midR, 0, midZ);
        spokeMesh.rotation.y = -Math.atan2(dR, -dZ);
        spokePivot.add(spokeMesh);
        driverGroup.add(spokePivot);
      }

      // 7. Motor Magnético en 3 Piezas (Placa Polar Superior + Imán de Ferrita + T-Yoke Biselado)
      const plateThickness = Math.max(magLen * 0.18, 0.35);
      const ferriteLen = Math.max(magLen - 2 * plateThickness, 0.7);

      const topPlateGeo = new THREE.CylinderGeometry(magRadius * 0.92, magRadius * 0.92, plateThickness, 36);
      topPlateGeo.rotateX(Math.PI / 2);
      const topPlateMesh = new THREE.Mesh(topPlateGeo, chromeMat);
      topPlateMesh.position.z = -basketEndZ - plateThickness / 2;
      driverGroup.add(topPlateMesh);

      const magnetGeo = new THREE.CylinderGeometry(magRadius * 1.02, magRadius * 1.02, ferriteLen, 36);
      magnetGeo.rotateX(Math.PI / 2);
      const magnetMesh = new THREE.Mesh(magnetGeo, ferriteMat);
      magnetMesh.position.z = -basketEndZ - plateThickness - ferriteLen / 2;
      driverGroup.add(magnetMesh);

      const backPlateGeo = new THREE.CylinderGeometry(magRadius * 0.92, magRadius * 0.84, plateThickness * 1.15, 36);
      backPlateGeo.rotateX(Math.PI / 2);
      const backPlateMesh = new THREE.Mesh(backPlateGeo, chromeMat);
      const backPlateZ = -basketEndZ - plateThickness - ferriteLen - (plateThickness * 1.15) / 2;
      backPlateMesh.position.z = backPlateZ;
      driverGroup.add(backPlateMesh);

      // Orificio de ventilación del núcleo polar (Pole Piece Vent)
      const poleVentGeo = new THREE.CircleGeometry(magRadius * 0.22, 24);
      const poleVentMat = new THREE.MeshBasicMaterial({ color: 0x030712, side: THREE.DoubleSide });
      const poleVentMesh = new THREE.Mesh(poleVentGeo, poleVentMat);
      poleVentMesh.position.z = backPlateZ - (plateThickness * 1.15) / 2 - 0.02;
      driverGroup.add(poleVentMesh);

      return driverGroup;
    };

    // 1. TWEETER (2-Way & 3-Way)
    if (crossoverWays >= 2 && !isBandpass) {
      const tweeterGroup = new THREE.Group();
      tweeterGroup.position.set(0, tweeterY, thickness / 2);

      // Faceplate ring flush on baffle
      const twPlateGeo = new THREE.CylinderGeometry(tweeterRadius, tweeterRadius, 0.22, 36);
      twPlateGeo.rotateX(Math.PI / 2);
      const twPlateMat = new THREE.MeshStandardMaterial({
        color: isLight ? 0x1e293b : 0x0f172a,
        metalness: 0.78,
        roughness: 0.28,
      });
      const twPlateMesh = new THREE.Mesh(twPlateGeo, twPlateMat);
      twPlateMesh.position.z = 0.11;
      tweeterGroup.add(twPlateMesh);

      // Tweeter mounting screws (4 screws)
      const twScrewGeo = new THREE.CylinderGeometry(tweeterRadius * 0.045, tweeterRadius * 0.045, 0.08, 10);
      twScrewGeo.rotateX(Math.PI / 2);
      const twScrewMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.2 });
      for (let s = 0; s < 4; s++) {
        const angle = (s * Math.PI) / 2 + Math.PI / 4;
        const screw = new THREE.Mesh(twScrewGeo, twScrewMat);
        screw.position.set(Math.cos(angle) * tweeterRadius * 0.84, Math.sin(angle) * tweeterRadius * 0.84, 0.24);
        tweeterGroup.add(screw);
      }

      // Waveguide trim ring
      const twRingGeo = new THREE.TorusGeometry(tweeterRadius * 0.62, tweeterRadius * 0.065, 16, 36);
      const twRingMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.65, roughness: 0.28 });
      const twRingMesh = new THREE.Mesh(twRingGeo, twRingMat);
      twRingMesh.position.z = 0.22;
      tweeterGroup.add(twRingMesh);

      // Silk/Titanium Dome
      const twDomeGeo = new THREE.SphereGeometry(tweeterRadius * 0.38, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.42);
      twDomeGeo.rotateX(Math.PI / 2);
      const twDomeMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.22,
        metalness: 0.55,
      });
      const twDomeMesh = new THREE.Mesh(twDomeGeo, twDomeMat);
      twDomeMesh.position.z = -0.05;
      tweeterGroup.add(twDomeMesh);

      // Tweeter Baffle Neck + Rear Magnet Assembly (continuous through baffle cutout)
      const twNeckLen = thickness + tweeterRadius * 0.25;
      const twNeckGeo = new THREE.CylinderGeometry(tweeterRadius * 0.58, tweeterRadius * 0.58, twNeckLen, 28);
      twNeckGeo.rotateX(Math.PI / 2);
      const twNeckMesh = new THREE.Mesh(twNeckGeo, twPlateMat);
      twNeckMesh.position.z = -twNeckLen / 2;
      tweeterGroup.add(twNeckMesh);

      const twMagLen = tweeterRadius * 0.65;
      const twMagGeo = new THREE.CylinderGeometry(tweeterRadius * 0.64, tweeterRadius * 0.64, twMagLen, 28);
      twMagGeo.rotateX(Math.PI / 2);
      const twMagMat = new THREE.MeshStandardMaterial({
        color: isLight ? 0x475569 : 0x334155,
        metalness: 0.75,
        roughness: 0.28,
      });
      const twMagMesh = new THREE.Mesh(twMagGeo, twMagMat);
      twMagMesh.position.z = -twNeckLen - twMagLen / 2;
      tweeterGroup.add(twMagMesh);

      const twBackPlateGeo = new THREE.CylinderGeometry(tweeterRadius * 0.6, tweeterRadius * 0.56, 0.22, 28);
      twBackPlateGeo.rotateX(Math.PI / 2);
      const twBackPlateMesh = new THREE.Mesh(twBackPlateGeo, twScrewMat);
      twBackPlateMesh.position.z = -twNeckLen - twMagLen - 0.11;
      tweeterGroup.add(twBackPlateMesh);

      frontGroup.add(tweeterGroup);
    }

    // 2. MIDRANGE DRIVER & SUB-ENCLOSURE (3-Way)
    if (crossoverWays === 3 && !isBandpass) {
      const midGroup = buildRealisticConeDriver(
        midRadius,
        midRadius * 0.84,
        Math.max(midRadius * 0.95, thickness + 3.5),
        6
      );
      midGroup.position.set(0, midY, thickness / 2);

      // Internal Midrange Chamber (if !midSealed)
      if (!midSealed) {
        const dMidVal = Math.min(cabinetData?.dMid ?? Math.min(innerD * 0.45, 13), innerD - 2);
        const hMidVal = Math.min(cabinetData?.hMid ?? Math.max(midDiameter + 3, 12), innerH * 0.42);
        const midChamberMat = getWoodMaterial();

        const mTopGeo = new THREE.BoxGeometry(innerW, thickness, dMidVal);
        const mTopMesh = new THREE.Mesh(mTopGeo, midChamberMat);
        mTopMesh.position.set(0, hMidVal / 2 + thickness / 2, -thickness - dMidVal / 2);
        addEdgeLines(mTopMesh);
        midGroup.add(mTopMesh);

        const mBotMesh = new THREE.Mesh(mTopGeo, midChamberMat);
        mBotMesh.position.set(0, -hMidVal / 2 - thickness / 2, -thickness - dMidVal / 2);
        addEdgeLines(mBotMesh);
        midGroup.add(mBotMesh);

        const mBackGeo = new THREE.BoxGeometry(innerW, hMidVal + 2 * thickness, thickness);
        const mBackMesh = new THREE.Mesh(mBackGeo, midChamberMat);
        mBackMesh.position.set(0, 0, -thickness - dMidVal - thickness / 2);
        addEdgeLines(mBackMesh);
        midGroup.add(mBackMesh);
      }

      frontGroup.add(midGroup);
    }

    // 3. WOOFER PRINCIPAL (ALTA PRECISIÓN 3D)
    const realDepthCm = driverDepth && driverDepth > 0
      ? Math.max(driverDepth / 10, thickness + 3.5)
      : Math.max(wooferRadius * 0.92, thickness + 4.5);
    const speakerGroup = buildRealisticConeDriver(wooferRadius, cutoutRadius, realDepthCm, 8);
    speakerGroup.position.set(0, wooferY, thickness / 2);

    if (!isBandpass) {
      frontGroup.add(speakerGroup);
    }

    // PUERTO DE SINTONÍA (VENT / PORT)
    const buildPortAssembly = (targetGroup: THREE.Group, isRear: boolean, effectiveLength: number) => {
      const portY = innerH * (0.5 - portYPct / 100);
      const count = Math.max(Number(portCount) || 1, 1);
      const portSpacing = count > 1 ? Math.min((innerW * 0.45) / count, 12) : 0;
      const tubeZ = isRear
        ? effectiveLength / 2 - thickness / 2
        : -effectiveLength / 2 + thickness / 2;
      const collarZ = isRear ? -thickness / 2 : thickness / 2;
      const innerEndZ = isRear
        ? effectiveLength - thickness / 2
        : -effectiveLength + thickness / 2;

      for (let pIdx = 0; pIdx < count; pIdx++) {
        const pCurX = count === 1 
          ? 0 
          : -((count - 1) * portSpacing) / 2 + pIdx * portSpacing;

        if (portShape === 'round' || portShape === 'custom') {
          const pRadius = Math.max((portDiameter || 7.5) / 2, 1.5);

          // Borde del tubo en el bafle
          const portLipGeo = new THREE.RingGeometry(pRadius * 0.92, pRadius * 1.06, 32);
          const portLipMat = new THREE.MeshStandardMaterial({
            color: 0x0284c7,
            roughness: 0.3,
            metalness: 0.4,
            side: THREE.DoubleSide,
          });
          const portLipMesh = new THREE.Mesh(portLipGeo, portLipMat);
          portLipMesh.position.set(pCurX, portY, collarZ + (isRear ? -0.07 : 0.07));
          targetGroup.add(portLipMesh);

          const portTubeGeo = new THREE.CylinderGeometry(pRadius, pRadius, effectiveLength, 32, 1, true);
          portTubeGeo.rotateX(Math.PI / 2);
          const portTubeMat = new THREE.MeshStandardMaterial({
            color: 0x0284c7,
            roughness: 0.3,
            metalness: 0.4,
            side: THREE.DoubleSide,
          });
          const portTubeMesh = new THREE.Mesh(portTubeGeo, portTubeMat);
          portTubeMesh.position.set(pCurX, portY, tubeZ);
          targetGroup.add(portTubeMesh);

          if (flaredEnds === 1) {
            const flangeRingGeo = new THREE.RingGeometry(pRadius * 0.95, pRadius * 1.32, 32);
            const flangeMat = new THREE.MeshStandardMaterial({
              color: 0x0369a1,
              roughness: 0.35,
              metalness: 0.3,
              side: THREE.DoubleSide,
            });
            const outerFlange = new THREE.Mesh(flangeRingGeo, flangeMat);
            outerFlange.position.set(pCurX, portY, collarZ + (isRear ? -0.09 : 0.09));
            targetGroup.add(outerFlange);

            const innerFlange = new THREE.Mesh(flangeRingGeo, flangeMat);
            innerFlange.position.set(pCurX, portY, innerEndZ);
            targetGroup.add(innerFlange);
          } else if (flaredEnds === 2 || flaredEnds === 3) {
            const collarGeo = new THREE.TorusGeometry(pRadius * 1.12, Math.max(thickness * 0.22, pRadius * 0.16), 16, 32);
            const collarMat = new THREE.MeshStandardMaterial({
              color: 0x0369a1,
              roughness: 0.25,
              metalness: 0.45,
            });
            const outerCollar = new THREE.Mesh(collarGeo, collarMat);
            outerCollar.position.set(pCurX, portY, collarZ + (isRear ? -0.1 : 0.1));
            targetGroup.add(outerCollar);

            if (flaredEnds === 2) {
              const innerCollar = new THREE.Mesh(collarGeo, collarMat);
              innerCollar.position.set(pCurX, portY, innerEndZ);
              targetGroup.add(innerCollar);
            }
          }
        } else {
          const pW = Math.max(portWidth || 10, 2);
          const pH = Math.max(portHeight || 4, 1.5);

          if (renderMode === 'solid') {
            const rectHoleGeo = new THREE.PlaneGeometry(pW * 0.96, pH * 0.96);
            const rectHoleMat = new THREE.MeshBasicMaterial({
              color: 0x030712,
              side: THREE.DoubleSide,
            });
            const rectHoleMesh = new THREE.Mesh(rectHoleGeo, rectHoleMat);
            rectHoleMesh.position.set(pCurX, portY, collarZ + (isRear ? -0.06 : 0.06));
            targetGroup.add(rectHoleMesh);
          }

          const portBoxGeo = new THREE.BoxGeometry(pW, pH, effectiveLength);
          const portBoxMat = new THREE.MeshStandardMaterial({
            color: 0x0284c7,
            roughness: 0.4,
            metalness: 0.2,
            wireframe: renderMode === 'wireframe',
          });
          const portBoxMesh = new THREE.Mesh(portBoxGeo, portBoxMat);
          portBoxMesh.position.set(pCurX, portY, tubeZ);
          targetGroup.add(portBoxMesh);

          if (flaredEnds === 1 || flaredEnds === 2 || flaredEnds === 3) {
            const fScale = (flaredEnds === 2 || flaredEnds === 3) ? 1.28 : 1.18;
            const fDepth = (flaredEnds === 2 || flaredEnds === 3) ? Math.max(thickness * 0.35, 0.6) : 0.25;
            const rectCollarGeo = new THREE.BoxGeometry(pW * fScale, pH * fScale, fDepth);
            const rectCollarMat = new THREE.MeshStandardMaterial({
              color: 0x0369a1,
              roughness: 0.3,
              metalness: 0.35,
              wireframe: renderMode === 'wireframe',
            });
            const outerRectCollar = new THREE.Mesh(rectCollarGeo, rectCollarMat);
            outerRectCollar.position.set(pCurX, portY, collarZ);
            targetGroup.add(outerRectCollar);

            if (flaredEnds === 1 || flaredEnds === 2) {
              const innerRectCollar = new THREE.Mesh(rectCollarGeo, rectCollarMat);
              innerRectCollar.position.set(pCurX, portY, innerEndZ);
              targetGroup.add(innerRectCollar);
            }
          }
        }
      }
    };

    if (boxType === 'ported') {
      const isRearPort = portLocation === 'rear';
      buildPortAssembly(isRearPort ? rearGroup : frontGroup, isRearPort, Math.max(portLength || 15, 5));
    } else if (boxType === 'bandpass') {
      // En caja paso banda: la cámara frontal Vf siempre ventila a través del bafle frontal
      buildPortAssembly(frontGroup, false, Math.max(portLength || 15, 5));
      // Si es paso banda de 6.º orden, la cámara trasera Vr también ventila al exterior a través del bafle trasero
      if (bandpassOrder === 6) {
        buildPortAssembly(rearGroup, true, Math.max(portLength || 15, 5));
      }
    }

    // TABIQUE INTERNO DIVISOR Y ARQUITECTURA BANDPASS (Vr / Vf)
    if (isBandpass) {
      const vrRatio = Math.max(0.12, Math.min(0.88, Number(bandpassRatio) || 0.5));
      const netDepth = Math.max(innerD - thickness, 5);
      const depthRear = netDepth * vrRatio;
      const depthFront = netDepth * (1 - vrRatio);
      const zDivider = -innerD / 2 + depthRear + thickness / 2;
      dividerBaseZRef.current = zDivider;

      const isDriverInverted = depthRear < realDepthCm + 2.0;

      const dividerGroup = new THREE.Group();
      dividerGroup.position.set(0, 0, zDivider);

      // 1. Tabique estructural con calado pasante para el altavoz (Woofer Cutout)
      const dividerCutoutCircles = [{ x: 0, y: wooferY, r: cutoutRadius }];
      const dividerGeo = createPerforatedPanelGeo(innerW, innerH, thickness, dividerCutoutCircles, []);
      const dividerMat = renderMode === 'wireframe'
        ? new THREE.MeshBasicMaterial({ color: 0x0284c7, wireframe: true })
        : renderMode === 'xray'
        ? new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.35,
            roughness: 0.25,
            metalness: 0.1,
            depthWrite: false,
          })
        : new THREE.MeshStandardMaterial({
            color: isLight ? 0xb45309 : 0x92400e, // Tono madera estructural contrastada
            roughness: 0.6,
            metalness: 0.1,
          });

      const dividerMesh = new THREE.Mesh(dividerGeo, dividerMat);
      dividerMesh.castShadow = true;
      dividerMesh.receiveShadow = true;
      addEdgeLines(dividerMesh);
      dividerGroup.add(dividerMesh);

      // Junta perimetral de estanqueidad entre el woofer y el tabique
      const gasketGeo = new THREE.TorusGeometry(cutoutRadius * 1.01, Math.max(thickness * 0.12, 0.18), 12, 48);
      const gasketMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.88,
        metalness: 0.1,
      });
      const gasketMesh = new THREE.Mesh(gasketGeo, gasketMat);
      if (!isDriverInverted) {
        gasketMesh.position.set(0, wooferY, thickness / 2 + 0.08);
      } else {
        gasketMesh.position.set(0, wooferY, -thickness / 2 - 0.08);
      }
      dividerGroup.add(gasketMesh);

      // Listones de refuerzo estructural en los laterales del tabique
      const cleatMat = getWoodMaterial();
      const cleatW = Math.max(thickness * 1.1, 1.8);
      [-innerW / 2 + cleatW / 2, innerW / 2 - cleatW / 2].forEach((cleatX) => {
        const cleatGeo = new THREE.BoxGeometry(cleatW, innerH * 0.9, cleatW);
        const cleatMesh = new THREE.Mesh(cleatGeo, cleatMat);
        cleatMesh.position.set(cleatX, 0, -thickness / 2 - cleatW / 2);
        dividerGroup.add(cleatMesh);
      });

      // Montar el woofer herméticamente en el tabique
      if (!isDriverInverted) {
        // MONTAJE ESTÁNDAR: Brida en cara frontal del tabique (+thickness/2), cono dispara hacia Vf (+Z), imán hacia Vr (-Z)
        speakerGroup.position.set(0, wooferY, thickness / 2);
        speakerGroup.rotation.y = 0;
      } else {
        // MONTAJE INVERTIDO: Para cuando la cámara trasera Vr es menos profunda que el altavoz
        // Brida en cara trasera del tabique (-thickness/2), cono hacia Vr (-Z), imán hacia Vf (+Z)
        speakerGroup.position.set(0, wooferY, -thickness / 2);
        speakerGroup.rotation.y = Math.PI;
      }
      dividerGroup.add(speakerGroup);

      panelsGroup.add(dividerGroup);
      panelMeshesRef.current.divider = dividerGroup;

      // 2. Delimitación Volumétrica 3D de las dos cámaras (Vr y Vf)
      const chamberVrGeo = new THREE.BoxGeometry(innerW * 0.992, innerH * 0.992, depthRear * 0.992);
      const chamberVrMat = new THREE.MeshBasicMaterial({
        color: 0x0284c7, // Azul cian para Vr
        transparent: true,
        opacity: renderMode === 'wireframe' ? 0 : (isLight ? 0.07 : 0.11),
        depthWrite: false,
      });
      const chamberVrMesh = new THREE.Mesh(chamberVrGeo, chamberVrMat);
      chamberVrMesh.position.set(0, 0, -innerD / 2 + depthRear / 2);
      panelsGroup.add(chamberVrMesh);
      chambersRef.current.vr = chamberVrMesh;

      const chamberVfGeo = new THREE.BoxGeometry(innerW * 0.992, innerH * 0.992, depthFront * 0.992);
      const chamberVfMat = new THREE.MeshBasicMaterial({
        color: 0x10b981, // Verde esmeralda para Vf
        transparent: true,
        opacity: renderMode === 'wireframe' ? 0 : (isLight ? 0.07 : 0.11),
        depthWrite: false,
      });
      const chamberVfMesh = new THREE.Mesh(chamberVfGeo, chamberVfMat);
      chamberVfMesh.position.set(0, 0, zDivider + thickness / 2 + depthFront / 2);
      panelsGroup.add(chamberVfMesh);
      chambersRef.current.vf = chamberVfMesh;

      // 3. Material de Amortiguamiento Acústico (Damping) en la Cámara Trasera (Vr)
      if (dampingType !== 'none' || bandpassOrder === 4) {
        const liningThick = Math.min(1.6, depthRear * 0.15);
        const liningMat = new THREE.MeshStandardMaterial({
          color: isLight ? 0x64748b : 0x475569,
          roughness: 0.96,
          metalness: 0.05,
          wireframe: renderMode === 'wireframe',
        });

        // Placa trasera de damping (en cara interna del bafle trasero)
        const rearLiningGeo = createPerforatedPanelGeo(
          innerW * 0.94,
          innerH * 0.94,
          liningThick,
          rearHoleCircles,
          rearHoleRects
        );
        const rearLiningMesh = new THREE.Mesh(rearLiningGeo, liningMat);
        rearLiningMesh.position.set(0, 0, thickness / 2 + liningThick / 2);
        rearGroup.add(rearLiningMesh);

        // Paneles laterales de damping en Vr
        const zRearCenter = -innerD / 2 + depthRear / 2;
        const sideLiningGeo = new THREE.BoxGeometry(liningThick, innerH * 0.92, Math.max(depthRear - liningThick, 2));
        const leftLiningMesh = new THREE.Mesh(sideLiningGeo, liningMat);
        leftLiningMesh.position.set(thickness / 2 + liningThick / 2, 0, zRearCenter);
        if (panelMeshesRef.current.left) panelMeshesRef.current.left.add(leftLiningMesh);

        const rightLiningMesh = new THREE.Mesh(sideLiningGeo, liningMat);
        rightLiningMesh.position.set(-thickness / 2 - liningThick / 2, 0, zRearCenter);
        if (panelMeshesRef.current.right) panelMeshesRef.current.right.add(rightLiningMesh);

        // Paneles superior e inferior de damping en Vr
        const topBotLiningGeo = new THREE.BoxGeometry(innerW * 0.92, liningThick, Math.max(depthRear - liningThick, 2));
        const topLiningMesh = new THREE.Mesh(topBotLiningGeo, liningMat);
        topLiningMesh.position.set(0, -thickness / 2 - liningThick / 2, zRearCenter);
        if (panelMeshesRef.current.top) panelMeshesRef.current.top.add(topLiningMesh);

        const botLiningMesh = new THREE.Mesh(topBotLiningGeo, liningMat);
        botLiningMesh.position.set(0, thickness / 2 + liningThick / 2, zRearCenter);
        if (panelMeshesRef.current.bottom) panelMeshesRef.current.bottom.add(botLiningMesh);
      }
    }

    panelsGroup.add(frontGroup);
    panelMeshesRef.current.front = frontGroup;

    // 8. Animation Loop
    let isRunning = true;
    const animate = () => {
      if (!isRunning) return;
      animFrameIdRef.current = requestAnimationFrame(animate);

      if (autoRotate && controlsRef.current) {
        panelsGroup.rotation.y += 0.006;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 9. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = newW / newH;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(newW, newH);
        }
      }
    });
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      isRunning = false;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
    };
  }, [
    isOpen,
    isLight,
    wExt,
    hExt,
    dExt,
    thickness,
    renderMode,
    showWireEdges,
    autoRotate,
    boxType,
    shape,
    speakerYPct,
    tweeterYPct,
    midrangeYPct,
    crossoverWays,
    midSealed,
    overallDiameter,
    driverDepth,
    portYPct,
    portLocation,
    portShape,
    portDiameter,
    portWidth,
    portHeight,
    portLength,
    portCount,
    flaredEnds,
    bandpassOrder,
    bandpassRatio,
    bandpassVf,
    bandpassVr,
    dampingType,
  ]);

  // Export Screenshot
  const handleExportScreenshot = () => {
    if (!rendererRef.current) return;
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `caja_acustica_3d_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  if (!isOpen) return null;

  const uLabel = getUnitLabel('length', unitSystem);
  const vLabel = getUnitLabel('volume', unitSystem);

  const innerDVal = dExt - 2 * thickness;
  const netDepthVal = Math.max(innerDVal - thickness, 5);
  const vrRatioVal = Math.max(0.12, Math.min(0.88, Number(bandpassRatio) || 0.5));
  const depthRearVal = netDepthVal * vrRatioVal;
  const depthFrontVal = netDepthVal * (1 - vrRatioVal);
  const driverDepthCmVal = driverDepth && driverDepth > 0
    ? Math.max(driverDepth / 10, thickness + 3.5)
    : Math.max(overallDiameter ? (overallDiameter / 10) * 0.45 : 12, thickness + 4.5);
  const isDriverInvertedVal = boxType === 'bandpass' && (depthRearVal < driverDepthCmVal + 2.0);
  const clearanceVal = isDriverInvertedVal 
    ? Math.max(0, depthFrontVal - driverDepthCmVal)
    : Math.max(0, depthRearVal - driverDepthCmVal);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: isLight ? 'rgba(15, 23, 42, 0.65)' : 'rgba(2, 6, 17, 0.88)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '0.4rem',
        boxSizing: 'border-box',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1360px',
          height: 'min(78vh, 640px)',
          maxHeight: 'calc(100% - 0.8rem)',
          background: isLight ? '#ffffff' : '#070f1e',
          border: `1px solid ${isLight ? '#cbd5e1' : '#1e3a5f'}`,
          borderRadius: '0px',
          boxShadow: isLight
            ? '0 25px 60px -15px rgba(0, 0, 0, 0.25), 0 0 30px rgba(2, 132, 199, 0.1)'
            : '0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 40px rgba(2, 132, 199, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.4rem',
            padding: '0.45rem 0.75rem',
            background: isLight 
              ? 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)' 
              : 'linear-gradient(90deg, #091528 0%, #0c1c36 100%)',
            borderBottom: `1px solid ${isLight ? '#cbd5e1' : '#1e3a5f'}`,
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.65rem',
                letterSpacing: '0.06em',
                background: '#0284c7',
                color: '#ffffff',
                padding: '0.15rem 0.45rem',
                borderRadius: '0px',
                fontWeight: 700,
              }}
            >
              3D CAD
            </span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isLight ? '#0f172a' : '#f1f5f9', letterSpacing: '0.01em' }}>
                {t("Inspección Espacial 3D del Gabinete")}
              </span>
              <span style={{ fontSize: '0.62rem', color: isLight ? '#64748b' : '#64748b', fontFamily: 'monospace' }}>
                | {boxType.toUpperCase()} | VOL NETO: {cabinetData?.valid ? convertTo(cabinetData.vNeto, 'volume', unitSystem).toFixed(1) : '--'} {vLabel}
              </span>
            </div>
          </div>

          {/* Quick HUD Metrics */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                display: 'flex',
                gap: '0.35rem',
                fontSize: '0.65rem',
                color: isLight ? '#334155' : '#94a3b8',
                background: isLight ? '#f1f5f9' : 'rgba(15, 23, 42, 0.7)',
                padding: '0.2rem 0.5rem',
                borderRadius: '0px',
                border: `1px solid ${isLight ? '#cbd5e1' : '#1e293b'}`,
                fontFamily: 'monospace',
              }}
            >
              {shape === 'trapezoidal' ? (
                <span>{convertTo(wExt, 'length', unitSystem).toFixed(1)} x {convertTo(hExt, 'length', unitSystem).toFixed(1)} x [Sup:{convertTo(dTrapTop, 'length', unitSystem).toFixed(1)} / Inf:{convertTo(dTrapBot, 'length', unitSystem).toFixed(1)}] {uLabel}</span>
              ) : (
                <span>{convertTo(wExt, 'length', unitSystem).toFixed(1)} x {convertTo(hExt, 'length', unitSystem).toFixed(1)} x {convertTo(dExt, 'length', unitSystem).toFixed(1)} {uLabel}</span>
              )}
              <span style={{ color: '#0284c7' }}>|</span>
              <span>ESP: {cabinetData?.thickness || 19} mm</span>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              style={{
                background: isLight ? '#f1f5f9' : '#1e293b',
                border: `1px solid ${isLight ? '#cbd5e1' : '#334155'}`,
                color: isLight ? '#0f172a' : '#f8fafc',
                fontSize: '0.68rem',
                fontWeight: 600,
                padding: '0.25rem 0.6rem',
                borderRadius: '0px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#ef4444';
                e.currentTarget.style.borderColor = '#dc2626';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isLight ? '#f1f5f9' : '#1e293b';
                e.currentTarget.style.borderColor = isLight ? '#cbd5e1' : '#334155';
                e.currentTarget.style.color = isLight ? '#0f172a' : '#f8fafc';
              }}
            >
              {t("Cerrar (ESC)")}
            </button>
          </div>
        </div>

        {/* 3D Viewport Area */}
        <div style={{ position: 'relative', flex: '1 1 0%', minHeight: 0, width: '100%', overflow: 'hidden' }}>
          <div
            ref={containerRef}
            style={{
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              cursor: 'grab',
            }}
            onMouseDown={(e) => {
              if (e.button === 0) e.currentTarget.style.cursor = 'grabbing';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.cursor = 'grab';
            }}
          />

          {/* Overlay HUD Técnico para Cajas Paso Banda */}
          {boxType === 'bandpass' && (
            <div
              style={{
                position: 'absolute',
                top: '0.6rem',
                left: '0.75rem',
                background: isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(7, 15, 30, 0.92)',
                border: `1px solid ${isLight ? '#cbd5e1' : '#1e3a5f'}`,
                padding: '0.45rem 0.7rem',
                fontFamily: 'monospace',
                fontSize: '0.62rem',
                lineHeight: '1.45',
                zIndex: 5,
                pointerEvents: 'none',
                backdropFilter: 'blur(6px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.22rem',
                boxShadow: isLight ? '0 4px 12px rgba(0,0,0,0.06)' : '0 4px 12px rgba(0,0,0,0.4)',
              }}
            >
              <div style={{ fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t("Arquitectura Paso Banda")} ({bandpassOrder || 4}.º {t("Orden")})
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '8px', height: '8px', background: '#0284c7', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ color: isLight ? '#0f172a' : '#e2e8f0' }}>
                  {t("Cámara Trasera")} (Vr): <strong>{bandpassVr ? `${convertTo(bandpassVr, 'volume', unitSystem).toFixed(1)} ${vLabel}` : `${((Number(bandpassRatio) || 0.5) * 100).toFixed(0)}%`}</strong>
                  <span style={{ color: isLight ? '#64748b' : '#94a3b8' }}> ({convertTo(depthRearVal, 'length', unitSystem).toFixed(1)} {uLabel} — {bandpassOrder === 6 ? t("Ventilada") : t("Sellada / Amortiguada")})</span>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '8px', height: '8px', background: '#10b981', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ color: isLight ? '#0f172a' : '#e2e8f0' }}>
                  {t("Cámara Frontal")} (Vf): <strong>{bandpassVf ? `${convertTo(bandpassVf, 'volume', unitSystem).toFixed(1)} ${vLabel}` : `${((1 - (Number(bandpassRatio) || 0.5)) * 100).toFixed(0)}%`}</strong>
                  <span style={{ color: isLight ? '#64748b' : '#94a3b8' }}> ({convertTo(depthFrontVal, 'length', unitSystem).toFixed(1)} {uLabel} — {t("Sintonizada")})</span>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderTop: `1px dashed ${isLight ? '#cbd5e1' : '#1e3a5f'}`, paddingTop: '0.25rem', marginTop: '0.08rem' }}>
                <span style={{ color: isDriverInvertedVal ? (isLight ? '#b45309' : '#f59e0b') : (isLight ? '#0369a1' : '#38bdf8'), fontWeight: 700 }}>
                  {isDriverInvertedVal ? t("Montaje Invertido") : t("Montaje Estándar")}:
                </span>
                <span style={{ color: isLight ? '#334155' : '#cbd5e1' }}>
                  {isDriverInvertedVal 
                    ? t("Imán hacia Vf (Despeje y Ventilación)") 
                    : t("Imán hacia Vr")}
                  {' | '}{t("Despeje")}: {convertTo(clearanceVal, 'length', unitSystem).toFixed(1)} {uLabel}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Interactive CAD Toolbar (Fijada al borde inferior del modal) */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: isLight ? 'rgba(248, 250, 252, 0.94)' : 'rgba(9, 21, 40, 0.94)',
            borderTop: `1px solid ${isLight ? '#cbd5e1' : '#1e3a5f'}`,
            padding: '0.35rem 0.55rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem 0.6rem',
            backdropFilter: 'blur(8px)',
            zIndex: 10,
            flexWrap: 'wrap',
            boxSizing: 'border-box',
          }}
        >
          {/* Modo de Visualización */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <span style={{ fontSize: '0.6rem', color: isLight ? '#475569' : '#64748b', fontWeight: 700, fontFamily: 'monospace' }}>
              MODO:
            </span>
            {(['solid', 'xray', 'wireframe'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setRenderMode(mode)}
                style={{
                  background: renderMode === mode ? '#0284c7' : (isLight ? '#ffffff' : '#0f172a'),
                  border: `1px solid ${renderMode === mode ? '#0284c7' : (isLight ? '#cbd5e1' : '#1e293b')}`,
                  color: renderMode === mode ? '#ffffff' : (isLight ? '#334155' : '#94a3b8'),
                  padding: '0.18rem 0.42rem',
                  borderRadius: '0px',
                  fontSize: '0.6rem',
                  fontWeight: renderMode === mode ? 700 : 500,
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                }}
              >
                {mode === 'solid' ? 'Sólido' : mode === 'xray' ? 'Rayos X' : 'Alámbrico'}
              </button>
            ))}
          </div>

          {/* Despiece 3D (Exploded View Slider) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.6rem', color: isLight ? '#475569' : '#64748b', fontWeight: 700, fontFamily: 'monospace' }}>
              DESPIECE:
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={explodedPct}
              onChange={(e) => setExplodedPct(Number(e.target.value))}
              style={{
                width: '68px',
                accentColor: '#0284c7',
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: '0.6rem', color: '#0284c7', fontFamily: 'monospace', minWidth: '2rem', fontWeight: 700 }}>
              {explodedPct}%
            </span>
          </div>

          {/* Vistas Predefinidas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <span style={{ fontSize: '0.6rem', color: isLight ? '#475569' : '#64748b', fontWeight: 700, fontFamily: 'monospace' }}>
              CÁMARA:
            </span>
            {(['iso', 'front', 'side', 'top'] as const).map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                style={{
                  background: isLight ? '#ffffff' : '#0f172a',
                  border: `1px solid ${isLight ? '#cbd5e1' : '#1e293b'}`,
                  color: isLight ? '#334155' : '#94a3b8',
                  padding: '0.18rem 0.38rem',
                  borderRadius: '0px',
                  fontSize: '0.6rem',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#0284c7';
                  e.currentTarget.style.color = isLight ? '#0284c7' : '#f8fafc';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = isLight ? '#cbd5e1' : '#1e293b';
                  e.currentTarget.style.color = isLight ? '#334155' : '#94a3b8';
                }}
              >
                {p === 'iso' ? 'Iso' : p === 'front' ? 'Frontal' : p === 'side' ? 'Lateral' : 'Planta'}
              </button>
            ))}
          </div>

          {/* Auto-Rotación, Aristas & Captura */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <button
              onClick={() => setShowWireEdges(!showWireEdges)}
              style={{
                background: showWireEdges 
                  ? (isLight ? 'rgba(2, 132, 199, 0.12)' : 'rgba(56, 189, 248, 0.2)') 
                  : (isLight ? '#ffffff' : '#0f172a'),
                border: `1px solid ${showWireEdges ? '#0284c7' : (isLight ? '#cbd5e1' : '#1e293b')}`,
                color: showWireEdges ? '#0284c7' : (isLight ? '#64748b' : '#64748b'),
                padding: '0.18rem 0.42rem',
                borderRadius: '0px',
                fontSize: '0.6rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'monospace',
              }}
            >
              {showWireEdges ? 'ARISTAS: SÍ' : 'ARISTAS: NO'}
            </button>

            <button
              onClick={() => setAutoRotate(!autoRotate)}
              style={{
                background: autoRotate ? 'rgba(16, 185, 129, 0.2)' : (isLight ? '#ffffff' : '#0f172a'),
                border: `1px solid ${autoRotate ? '#10b981' : (isLight ? '#cbd5e1' : '#1e293b')}`,
                color: autoRotate ? '#10b981' : (isLight ? '#334155' : '#94a3b8'),
                padding: '0.18rem 0.42rem',
                borderRadius: '0px',
                fontSize: '0.6rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'monospace',
              }}
            >
              {autoRotate ? 'ROTACIÓN: ACTIVA' : 'ROTACIÓN: PAUSA'}
            </button>

            <button
              onClick={handleExportScreenshot}
              style={{
                background: '#0369a1',
                border: '1px solid #0284c7',
                color: '#ffffff',
                padding: '0.18rem 0.48rem',
                borderRadius: '0px',
                fontSize: '0.6rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'monospace',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#0284c7')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#0369a1')}
            >
              CAPTURAR PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
