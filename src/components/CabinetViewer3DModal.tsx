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
  speakerYPct?: number;
  portYPct?: number;
  bandpassOrder?: 4 | 6;
  bandpassRatio?: number;
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
  speakerYPct = 50,
  portYPct = 85,
  bandpassRatio = 0.5,
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
    rear?: THREE.Mesh;
    front?: THREE.Group;
    divider?: THREE.Mesh;
  }>({});

  // UI States
  const [renderMode, setRenderMode] = useState<'solid' | 'xray' | 'wireframe'>('solid');
  const [explodedPct, setExplodedPct] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showWireEdges, setShowWireEdges] = useState<boolean>(true);

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

    // Initial Camera positioning
    const maxDim = Math.max(wExt, hExt, dExt);
    camera.position.set(maxDim * 1.6, maxDim * 1.3, maxDim * 2.0);
    controls.target.set(0, 0, 0);
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
      const edges = new THREE.EdgesGeometry(mesh.geometry);
      const line = new THREE.LineSegments(edges, edgeLineMaterial);
      mesh.add(line);
    };

    const innerH = hExt - 2 * thickness;
    const innerW = wExt - 2 * thickness;
    const innerD = dExt - 2 * thickness;

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
    const rearGeo = new THREE.BoxGeometry(innerW, innerH, thickness);
    const rearMesh = new THREE.Mesh(rearGeo, getWoodMaterial());
    rearMesh.position.set(0, 0, -(dExt - thickness) / 2);
    rearMesh.castShadow = true;
    rearMesh.receiveShadow = true;
    addEdgeLines(rearMesh);
    panelsGroup.add(rearMesh);
    panelMeshesRef.current.rear = rearMesh;

    // --- BAFLE FRONTAL + COMPONENTES ---
    const frontGroup = new THREE.Group();
    frontGroup.position.set(0, 0, (dExt - thickness) / 2);

    const frontGeo = new THREE.BoxGeometry(innerW, innerH, thickness);
    const frontMesh = new THREE.Mesh(frontGeo, getWoodMaterial());
    frontMesh.castShadow = true;
    frontMesh.receiveShadow = true;
    addEdgeLines(frontMesh);
    frontGroup.add(frontMesh);

    // WOOFER MODEL
    const isBandpass = boxType === 'bandpass';
    const wooferDiameter = Math.min(innerW * 0.85, innerH * 0.55);
    const wooferRadius = wooferDiameter / 2;
    const wooferY = innerH * (0.5 - speakerYPct / 100);

    const speakerGroup = new THREE.Group();
    speakerGroup.position.set(0, wooferY, thickness / 2);

    // Woofer Outer Ring (Chasis)
    const ringGeo = new THREE.TorusGeometry(wooferRadius, thickness * 0.25, 12, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0x334155 : 0x1e293b,
      metalness: 0.8,
      roughness: 0.3,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    speakerGroup.add(ringMesh);

    // Woofer Inverted Cone
    const coneGeo = new THREE.ConeGeometry(wooferRadius * 0.88, wooferRadius * 0.45, 32, 1, true);
    coneGeo.rotateX(Math.PI);
    const coneMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0x1e293b : 0x0f172a,
      roughness: 0.7,
      metalness: 0.1,
    });
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    coneMesh.position.z = -wooferRadius * 0.22;
    speakerGroup.add(coneMesh);

    // Dustcap (Domo central)
    const dustcapGeo = new THREE.SphereGeometry(wooferRadius * 0.25, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const dustcapMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.4,
      metalness: 0.3,
    });
    const dustcapMesh = new THREE.Mesh(dustcapGeo, dustcapMat);
    dustcapMesh.position.z = -wooferRadius * 0.1;
    speakerGroup.add(dustcapMesh);

    // Magnet structure (Cilindro magnético dentro de la caja)
    const magnetGeo = new THREE.CylinderGeometry(wooferRadius * 0.45, wooferRadius * 0.45, wooferRadius * 0.5, 24);
    magnetGeo.rotateX(Math.PI / 2);
    const magnetMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0x64748b : 0x334155,
      metalness: 0.85,
      roughness: 0.2,
    });
    const magnetMesh = new THREE.Mesh(magnetGeo, magnetMat);
    magnetMesh.position.z = -wooferRadius * 0.55;
    speakerGroup.add(magnetMesh);

    if (!isBandpass) {
      frontGroup.add(speakerGroup);
    } else {
      speakerGroup.position.set(0, wooferY, 0);
      panelsGroup.add(speakerGroup);
    }

    // PUERTO DE SINTONÍA (VENT / PORT)
    if (boxType === 'ported' || boxType === 'bandpass') {
      const portY = innerH * (0.5 - portYPct / 100);
      const effectiveLength = Math.max(portLength || 15, 5);
      const count = Math.max(Number(portCount) || 1, 1);
      const portSpacing = count > 1 ? Math.min((innerW * 0.45) / count, 12) : 0;

      for (let pIdx = 0; pIdx < count; pIdx++) {
        const pCurX = count === 1 
          ? 0 
          : -((count - 1) * portSpacing) / 2 + pIdx * portSpacing;

        if (portShape === 'round' || portShape === 'custom') {
          const pRadius = Math.max((portDiameter || 7.5) / 2, 1.5);
          const portTubeGeo = new THREE.CylinderGeometry(pRadius, pRadius, effectiveLength, 32, 1, true);
          portTubeGeo.rotateX(Math.PI / 2);
          const portTubeMat = new THREE.MeshStandardMaterial({
            color: 0x0284c7,
            roughness: 0.3,
            metalness: 0.4,
            side: THREE.DoubleSide,
          });
          const portTubeMesh = new THREE.Mesh(portTubeGeo, portTubeMat);
          portTubeMesh.position.set(pCurX, portY, -effectiveLength / 2 + thickness / 2);
          frontGroup.add(portTubeMesh);

          // Flared Outer Collar
          const collarGeo = new THREE.TorusGeometry(pRadius * 1.15, thickness * 0.2, 12, 32);
          const collarMat = new THREE.MeshStandardMaterial({ color: 0x0369a1 });
          const collarMesh = new THREE.Mesh(collarGeo, collarMat);
          collarMesh.position.set(pCurX, portY, thickness / 2);
          frontGroup.add(collarMesh);
        } else {
          const pW = Math.max(portWidth || 10, 2);
          const pH = Math.max(portHeight || 4, 1.5);
          const portBoxGeo = new THREE.BoxGeometry(pW, pH, effectiveLength);
          const portBoxMat = new THREE.MeshStandardMaterial({
            color: 0x0284c7,
            roughness: 0.4,
            metalness: 0.2,
            wireframe: renderMode === 'wireframe',
          });
          const portBoxMesh = new THREE.Mesh(portBoxGeo, portBoxMat);
          portBoxMesh.position.set(pCurX, portY, -effectiveLength / 2 + thickness / 2);
          frontGroup.add(portBoxMesh);
        }
      }
    }

    // TABIQUE INTERNO BANDPASS (DIVIDER)
    if (isBandpass) {
      const dividerGeo = new THREE.BoxGeometry(innerW, innerH, thickness);
      const dividerMesh = new THREE.Mesh(dividerGeo, getWoodMaterial());
      const zRatio = (bandpassRatio - 0.5) * innerD;
      dividerMesh.position.set(0, 0, zRatio);
      addEdgeLines(dividerMesh);
      panelsGroup.add(dividerMesh);
      panelMeshesRef.current.divider = dividerMesh;
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
    portYPct,
    portShape,
    portDiameter,
    portWidth,
    portHeight,
    portLength,
    portCount,
    bandpassRatio,
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
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
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
          height: '90vh',
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1.25rem',
            background: isLight 
              ? 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)' 
              : 'linear-gradient(90deg, #091528 0%, #0c1c36 100%)',
            borderBottom: `1px solid ${isLight ? '#cbd5e1' : '#1e3a5f'}`,
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.7rem',
                letterSpacing: '0.08em',
                background: '#0284c7',
                color: '#ffffff',
                padding: '0.2rem 0.55rem',
                borderRadius: '0px',
                fontWeight: 700,
              }}
            >
              3D CAD WEBGL
            </span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: isLight ? '#0f172a' : '#f1f5f9', letterSpacing: '0.02em' }}>
                {t("Inspección Espacial 3D del Gabinete")}
              </span>
              <span style={{ fontSize: '0.68rem', color: isLight ? '#64748b' : '#64748b', fontFamily: 'monospace' }}>
                MOTOR THREE.JS | {boxType.toUpperCase()} | VOL NETO: {cabinetData?.valid ? convertTo(cabinetData.vNeto, 'volume', unitSystem).toFixed(1) : '--'} {vLabel}
              </span>
            </div>
          </div>

          {/* Quick HUD Metrics */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                fontSize: '0.7rem',
                color: isLight ? '#334155' : '#94a3b8',
                background: isLight ? '#f1f5f9' : 'rgba(15, 23, 42, 0.7)',
                padding: '0.3rem 0.75rem',
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
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.35rem 0.85rem',
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
        <div
          ref={containerRef}
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            position: 'relative',
            cursor: 'grab',
          }}
          onMouseDown={(e) => {
            if (e.button === 0) e.currentTarget.style.cursor = 'grabbing';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.cursor = 'grab';
          }}
        />

        {/* Interactive CAD Toolbar (Overlay Inferior) */}
        <div
          style={{
            position: 'absolute',
            bottom: '1rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(7, 16, 30, 0.92)',
            border: `1px solid ${isLight ? '#cbd5e1' : '#1e3a5f'}`,
            borderRadius: '0px',
            padding: '0.5rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            backdropFilter: 'blur(12px)',
            boxShadow: isLight ? '0 10px 30px rgba(0, 0, 0, 0.15)' : '0 10px 30px rgba(0, 0, 0, 0.6)',
            zIndex: 10,
            maxWidth: '94%',
            flexWrap: 'wrap',
          }}
        >
          {/* Modo de Visualización */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.65rem', color: isLight ? '#475569' : '#64748b', fontWeight: 700, fontFamily: 'monospace', marginRight: '0.25rem' }}>
              MODO:
            </span>
            {(['solid', 'xray', 'wireframe'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setRenderMode(mode)}
                style={{
                  background: renderMode === mode ? '#0284c7' : (isLight ? '#f1f5f9' : '#0f172a'),
                  border: `1px solid ${renderMode === mode ? '#0284c7' : (isLight ? '#cbd5e1' : '#1e293b')}`,
                  color: renderMode === mode ? '#ffffff' : (isLight ? '#334155' : '#94a3b8'),
                  padding: '0.25rem 0.6rem',
                  borderRadius: '0px',
                  fontSize: '0.68rem',
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

          <div style={{ width: '1px', height: '22px', background: isLight ? '#cbd5e1' : '#1e3a5f' }} />

          {/* Despiece 3D (Exploded View Slider) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.65rem', color: isLight ? '#475569' : '#64748b', fontWeight: 700, fontFamily: 'monospace' }}>
              DESPIECE:
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={explodedPct}
              onChange={(e) => setExplodedPct(Number(e.target.value))}
              style={{
                width: '100px',
                accentColor: '#0284c7',
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: '0.68rem', color: '#0284c7', fontFamily: 'monospace', minWidth: '2.5rem', fontWeight: 700 }}>
              {explodedPct}%
            </span>
          </div>

          <div style={{ width: '1px', height: '22px', background: isLight ? '#cbd5e1' : '#1e3a5f' }} />

          {/* Vistas Predefinidas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.65rem', color: isLight ? '#475569' : '#64748b', fontWeight: 700, fontFamily: 'monospace', marginRight: '0.25rem' }}>
              CÁMARA:
            </span>
            {(['iso', 'front', 'side', 'top'] as const).map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                style={{
                  background: isLight ? '#f1f5f9' : '#0f172a',
                  border: `1px solid ${isLight ? '#cbd5e1' : '#1e293b'}`,
                  color: isLight ? '#334155' : '#94a3b8',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '0px',
                  fontSize: '0.65rem',
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

          <div style={{ width: '1px', height: '22px', background: isLight ? '#cbd5e1' : '#1e3a5f' }} />

          {/* Auto-Rotación, Aristas & Captura */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setShowWireEdges(!showWireEdges)}
              style={{
                background: showWireEdges 
                  ? (isLight ? 'rgba(2, 132, 199, 0.12)' : 'rgba(56, 189, 248, 0.2)') 
                  : (isLight ? '#f1f5f9' : '#0f172a'),
                border: `1px solid ${showWireEdges ? '#0284c7' : (isLight ? '#cbd5e1' : '#1e293b')}`,
                color: showWireEdges ? '#0284c7' : (isLight ? '#64748b' : '#64748b'),
                padding: '0.25rem 0.6rem',
                borderRadius: '0px',
                fontSize: '0.65rem',
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
                background: autoRotate ? 'rgba(16, 185, 129, 0.2)' : (isLight ? '#f1f5f9' : '#0f172a'),
                border: `1px solid ${autoRotate ? '#10b981' : (isLight ? '#cbd5e1' : '#1e293b')}`,
                color: autoRotate ? '#10b981' : (isLight ? '#334155' : '#94a3b8'),
                padding: '0.25rem 0.6rem',
                borderRadius: '0px',
                fontSize: '0.65rem',
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
                padding: '0.25rem 0.65rem',
                borderRadius: '0px',
                fontSize: '0.65rem',
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
