import React, { useRef, useEffect, useState, useCallback } from 'react';
import { type Lang, translate } from '../utils/translations';
import { type UnitSystem, convertTo, getUnitLabel } from '../utils/units';
import type { WoodCabinetData, WoodShape, Bandpass6Topology } from '../types';
import { calculatePortSpacing } from '../utils/acousticMath';

interface CabinetCad2DProps {
  lang: Lang;
  unitSystem: UnitSystem;
  shape: WoodShape;
  cabinetData: WoodCabinetData | null;
  boxType: 'sealed' | 'ported' | 'bandpass';
  portShape: 'round' | 'rectangular' | 'custom';
  portDiameter: number;
  portWidth: number;
  portHeight: number;
  portLength: number;
  portCount: number;
  flaredEnds?: 0 | 1 | 2 | 3;
  hoveredPieceIndex?: number | null;
  speakerYPct?: number;
  tweeterYPct?: number;
  midrangeYPct?: number;
  crossoverWays?: number;
  midSealed?: boolean;
  overallDiameter?: number;
  baffleCutout?: number;
  driverDepth?: number;
  portYPct?: number;
  portSpacingPct?: number;
  portLocation?: 'front' | 'rear';
  bandpassOrder?: 4 | 6;
  bandpassTopology?: Bandpass6Topology;
  bandpassFl?: number;
  bandpassFh?: number;
  bandpassRatio?: number;
  bandpassVf?: number;
  bandpassVr?: number;
  activeHpEnabled?: boolean;
  hpFx?: number;
  hpQx?: number;
  prTuning?: 'port' | 'radiator';
  prDia?: number;
  prVas?: number;
  prFs?: number;
  prMms?: number;
  prFbNatural?: number;
  prMasaAnadidaG?: number;
  dampingType?: 'none' | 'light' | 'moderate' | 'heavy';
  enableBracing?: boolean;
  bracingCount?: number;
  onOpen3DModal: () => void;
}

export const CabinetCad2D: React.FC<CabinetCad2DProps> = ({
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
  hoveredPieceIndex = null,
  speakerYPct = 50,
  tweeterYPct = 20,
  midrangeYPct = 40,
  crossoverWays = 2,
  midSealed = true,
  overallDiameter,
  baffleCutout,
  driverDepth,
  portYPct = 85,
  portSpacingPct = 50,
  portLocation = 'front',
  bandpassOrder = 4,
  bandpassTopology = 'parallel',
  bandpassFl,
  bandpassFh,
  bandpassRatio = 0.5,
  bandpassVf,
  bandpassVr,
  activeHpEnabled = false,
  hpFx,
  hpQx,
  prTuning = 'port',
  prDia = 20,
  prFbNatural = 0,
  prMasaAnadidaG = 0,
  dampingType = 'none',
  enableBracing = false,
  bracingCount = 2,
  onOpen3DModal,
}) => {
  const t = useCallback((text: string) => translate(text, lang), [lang]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isLight = true;
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [canvasHeight, setCanvasHeight] = useState<number>(440);

  const handleVerticalResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = canvasHeight;
    document.body.style.cursor = 'ns-resize';

    const onMouseMove = (ev: MouseEvent) => {
      const nextH = Math.min(1200, Math.max(260, startH + (ev.clientY - startY)));
      setCanvasHeight(nextH);
    };

    const onMouseUp = () => {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const w = el.clientWidth;
      if (w > 0) setContainerWidth(prev => (prev !== w ? w : prev));
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // CAD Navigation State
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cursorMm, setCursorMm] = useState<{ x: number; y: number } | null>(null);

  // Display toggles
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);

  const uLabel = getUnitLabel('length', unitSystem);
  const vLabel = getUnitLabel('volume', unitSystem);

  // Dimensions in cm
  const wExt = shape === 'trapezoidal'
    ? (cabinetData?.wFrontExt || cabinetData?.wExt || 35)
    : (cabinetData?.wExt || 35);
  const wRearExt = cabinetData?.wRearExt || wExt;
  const trapAngleDeg = cabinetData?.trapAngleDeg ?? 0;
  const hExt = cabinetData?.hExt || 50;
  const dExt = shape === 'trapezoidal'
    ? Math.max(cabinetData?.dTrapTopExt || 20, cabinetData?.dTrapBotExt || 35)
    : (cabinetData?.dExt || 30);
  const dTrapTop = cabinetData?.dTrapTopExt || 20;
  const dTrapBot = cabinetData?.dTrapBotExt || 35;
  const thickness = (cabinetData?.thickness || 19) / 10; // mm to cm
  const isBandpass = boxType === 'bandpass';
  const effectivePortCount = Math.max(Number(portCount) || 1, 1);

  // Reset to optimal fit
  const handleFitView = useCallback(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth || 800;
    const h = 440;

    const totalDrawingCmW = wExt + 15 + dExt;
    const totalDrawingCmH = hExt + 18;

    const scaleX = (w - 120) / totalDrawingCmW;
    const scaleY = (h - 100) / totalDrawingCmH;
    const fitScale = Math.min(scaleX, scaleY, 7);

    setZoom(fitScale);
    setPan({ x: w / 2, y: h / 2 });
  }, [wExt, hExt, dExt]);

  useEffect(() => {
    handleFitView();
  }, [handleFitView]);

  // Mouse wheel zoom centered on cursor
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const newZoom = Math.min(Math.max(zoom * factor, 0.5), 18);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setPan((prev) => ({
      x: mouseX - (mouseX - prev.x) * (newZoom / zoom),
      y: mouseY - (mouseY - prev.y) * (newZoom / zoom),
    }));
    setZoom(newZoom);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0 || e.button === 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xMm = ((mouseX - pan.x) / zoom) * 10;
    const yMm = -((mouseY - pan.y) / zoom) * 10;
    setCursorMm({ x: Math.round(xMm), y: Math.round(yMm) });

    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => {
    setIsDragging(false);
    setCursorMm(null);
  };

  // Main Canvas Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = containerWidth || containerRef.current.clientWidth || 800;
    const height = canvasHeight;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Theme-aware CAD Blueprint Background
    ctx.fillStyle = isLight ? '#f8fafc' : '#060f1d';
    ctx.fillRect(0, 0, width, height);

    // 2. Blueprint Millimetric Grid (Unified 6px fine / 30px major pitch across CAD viewports)
    if (showGrid) {
      const totalDrawingCmW = wExt + 15 + dExt;
      const totalDrawingCmH = hExt + 18;
      const baseScale = Math.min((width - 120) / totalDrawingCmW, (height - 100) / totalDrawingCmH, 7) || 1;
      const relativeZoom = Math.max(zoom / baseScale, 0.2);

      const fineSpacing = 6 * relativeZoom;
      const gridSpacing = 30 * relativeZoom;
      const offsetX = pan.x - width / 2;
      const offsetY = pan.y - height / 2;

      // Fine Grid (FreeCAD TechDraw / Sketcher pitch)
      ctx.strokeStyle = isLight ? 'rgba(100, 116, 139, 0.09)' : '#091c33';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      const startX = ((offsetX % fineSpacing) + fineSpacing) % fineSpacing;
      for (let x = startX; x < width; x += fineSpacing) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      const startY = ((offsetY % fineSpacing) + fineSpacing) % fineSpacing;
      for (let y = startY; y < height; y += fineSpacing) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Major Grid
      ctx.strokeStyle = isLight ? 'rgba(100, 116, 139, 0.22)' : '#0e294b';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      const majorStartX = ((offsetX % gridSpacing) + gridSpacing) % gridSpacing;
      for (let x = majorStartX; x < width; x += gridSpacing) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      const majorStartY = ((offsetY % gridSpacing) + gridSpacing) % gridSpacing;
      for (let y = majorStartY; y < height; y += gridSpacing) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    }

    // Transform coordinate system to center at pan position
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Geometry layout in cm
    const gap = 16;
    const totalW = wExt + gap + dExt;
    const frontStartX = -totalW / 2;
    const sideStartX = frontStartX + wExt + gap;
    const topY = -hExt / 2;
    const botY = hExt / 2;

    // Helper functions for FreeCAD TechDraw / Parametric CAD drawing
    const drawArrow = (x1: number, y1: number, x2: number, y2: number) => {
      const headlen = Math.min(Math.max(8 / zoom, 0.7), 2.0);
      const angle = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // ISO sharp arrowheads
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + headlen * Math.cos(angle + Math.PI / 8), y1 + headlen * Math.sin(angle + Math.PI / 8));
      ctx.lineTo(x1 + headlen * Math.cos(angle - Math.PI / 8), y1 + headlen * Math.sin(angle - Math.PI / 8));
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 8), y2 - headlen * Math.sin(angle + Math.PI / 8));
      ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 8), y2 - headlen * Math.sin(angle - Math.PI / 8));
      ctx.closePath();
      ctx.fill();
    };

    const drawDimension = (
      x1: number, y1: number,
      x2: number, y2: number,
      label: string,
      offset: number = 3,
      horizontal: boolean = true
    ) => {
      if (!showDimensions) return;
      ctx.save();
      const dimStroke = isLight ? '#b91c1c' : '#f87171';
      const dimText = isLight ? '#0f172a' : '#f8fafc';
      const maskBg = isLight ? '#f8fafc' : '#060f1d';
      ctx.strokeStyle = dimStroke;
      ctx.fillStyle = dimStroke;
      ctx.lineWidth = 0.75 / zoom;
      const fontSize = Math.max(9.5 / zoom, 1.8);
      ctx.font = `600 ${fontSize}px monospace`;

      if (horizontal) {
        const dy = y1 + offset;
        ctx.beginPath();
        ctx.moveTo(x1, y1 + (offset > 0 ? 0.4 : -0.4));
        ctx.lineTo(x1, dy + (offset > 0 ? 0.9 : -0.9));
        ctx.moveTo(x2, y2 + (offset > 0 ? 0.4 : -0.4));
        ctx.lineTo(x2, dy + (offset > 0 ? 0.9 : -0.9));
        ctx.stroke();

        drawArrow(x1, dy, x2, dy);

        const textW = ctx.measureText(label).width;
        const padX = 1.2 / zoom;
        const midX = (x1 + x2) / 2;
        ctx.fillStyle = maskBg;
        ctx.fillRect(midX - textW / 2 - padX, dy - fontSize * 0.58, textW + padX * 2, fontSize * 1.15);

        ctx.fillStyle = dimText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, midX, dy);
      } else {
        const dx = x1 + offset;
        ctx.beginPath();
        ctx.moveTo(x1 + (offset > 0 ? 0.4 : -0.4), y1);
        ctx.lineTo(dx + (offset > 0 ? 0.9 : -0.9), y1);
        ctx.moveTo(x2 + (offset > 0 ? 0.4 : -0.4), y2);
        ctx.lineTo(dx + (offset > 0 ? 0.9 : -0.9), y2);
        ctx.stroke();

        drawArrow(dx, y1, dx, y2);

        const textW = ctx.measureText(label).width;
        const padX = 1.2 / zoom;
        ctx.save();
        ctx.translate(dx, (y1 + y2) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = maskBg;
        ctx.fillRect(-textW / 2 - padX, -fontSize * 0.58, textW + padX * 2, fontSize * 1.15);
        ctx.fillStyle = dimText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    };

    // Wood panel hatching helper
    const hatchRect = (x: number, y: number, w: number, h: number) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.strokeStyle = isLight ? 'rgba(2, 132, 199, 0.35)' : 'rgba(56, 189, 248, 0.22)';
      ctx.lineWidth = 0.6 / zoom;
      const step = 1.2;
      const diag = w + h;
      for (let d = -diag; d < diag; d += step) {
        ctx.beginPath();
        ctx.moveTo(x + d, y);
        ctx.lineTo(x + d + h, y + h);
        ctx.stroke();
      }
      ctx.restore();
    };

    // ----------------------------------------------------
    // A. VISTA FRONTAL (BAFLE)
    // ----------------------------------------------------
    const fX = frontStartX;
    const fW = wExt;
    const fH = hExt;

    // External Perimeter
    ctx.strokeStyle = isLight ? '#0f172a' : '#38bdf8';
    ctx.lineWidth = 1.4 / zoom;
    ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.03)' : 'rgba(2, 132, 199, 0.04)';
    ctx.fillRect(fX, topY, fW, fH);
    ctx.strokeRect(fX, topY, fW, fH);

    // Eje de simetría vertical (FreeCAD TechDraw Centerline)
    ctx.save();
    ctx.strokeStyle = isLight ? 'rgba(100, 116, 139, 0.65)' : 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 0.65 / zoom;
    ctx.setLineDash([2.5, 1.0, 0.5, 1.0]);
    ctx.beginPath();
    ctx.moveTo(fX + fW / 2, topY - 1.5);
    ctx.lineTo(fX + fW / 2, botY + 1.5);
    ctx.stroke();
    ctx.restore();

    // Internal Cavity (Dashed lines representing hidden walls)
    ctx.strokeStyle = isLight ? '#64748b' : '#0284c7';
    ctx.lineWidth = 0.8 / zoom;
    ctx.setLineDash([1.5, 1]);
    ctx.strokeRect(fX + thickness, topY + thickness, fW - 2 * thickness, fH - 2 * thickness);
    if (shape === 'trapezoidal' && wRearExt > 0 && Math.abs(fW - wRearExt) > 0.2) {
      const rearX = fX + (fW - wRearExt) / 2;
      ctx.strokeStyle = isLight ? 'rgba(100, 116, 139, 0.7)' : 'rgba(56, 189, 248, 0.45)';
      ctx.strokeRect(rearX, topY, wRearExt, fH);
    }
    ctx.setLineDash([]);

    // Woofer, Midrange & Tweeter on Front Baffle
    const innerW = fW - 2 * thickness;
    const innerH = fH - 2 * thickness;
    const defaultWooferDia = crossoverWays === 3
      ? Math.min(fW * 0.68, fH * 0.34)
      : Math.min(fW * 0.74, fH * 0.42);
    const wooferDiameter = overallDiameter && overallDiameter > 0
      ? Math.min(overallDiameter / 10, fW - 2 * thickness - 0.5)
      : defaultWooferDia;
    const wooferRadius = wooferDiameter / 2;
    const wooferCutoutRadius = baffleCutout && baffleCutout > 0
      ? Math.min((baffleCutout / 10) / 2, wooferRadius * 0.94)
      : wooferRadius * 0.88;
    const wooferCenterY = topY + thickness + (speakerYPct / 100) * innerH;
    const wooferCenterX = fX + fW / 2;

    const tweeterDiameter = Math.min(fW * 0.26, fH * 0.13, wooferDiameter * 0.42);
    const tweeterRadius = tweeterDiameter / 2;
    const tweeterCenterY = topY + thickness + (tweeterYPct / 100) * innerH;

    const midDiameter = Math.min(fW * 0.42, fH * 0.20, wooferDiameter * 0.60);
    const midRadius = midDiameter / 2;
    const midCenterY = topY + thickness + (midrangeYPct / 100) * innerH;

    // 1. Tweeter on Front Baffle (2-Way & 3-Way, when not bandpass)
    if (crossoverWays >= 2 && !isBandpass) {
      // Faceplate outer ring
      ctx.strokeStyle = isLight ? '#0f172a' : '#38bdf8';
      ctx.lineWidth = 1.1 / zoom;
      ctx.beginPath();
      ctx.arc(wooferCenterX, tweeterCenterY, tweeterRadius, 0, Math.PI * 2);
      ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.04)' : 'rgba(56, 189, 248, 0.05)';
      ctx.fill();
      ctx.stroke();

      // Waveguide ring
      ctx.strokeStyle = isLight ? '#0284c7' : '#0ea5e9';
      ctx.lineWidth = 0.75 / zoom;
      ctx.beginPath();
      ctx.arc(wooferCenterX, tweeterCenterY, tweeterRadius * 0.68, 0, Math.PI * 2);
      ctx.stroke();

      // Central Silk/Titanium Dome
      ctx.beginPath();
      ctx.arc(wooferCenterX, tweeterCenterY, tweeterRadius * 0.36, 0, Math.PI * 2);
      ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.22)' : 'rgba(56, 189, 248, 0.20)';
      ctx.fill();
      ctx.stroke();

      // 4 Mounting screw dots on faceplate
      const screwDist = tweeterRadius * 0.84;
      for (const ang of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
        ctx.beginPath();
        ctx.arc(wooferCenterX + Math.cos(ang) * screwDist, tweeterCenterY + Math.sin(ang) * screwDist, Math.max(0.18, tweeterRadius * 0.05), 0, Math.PI * 2);
        ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
        ctx.fill();
      }

      // Tweeter Center Crosshairs
      ctx.strokeStyle = isLight ? '#059669' : '#10b981';
      ctx.lineWidth = 0.6 / zoom;
      ctx.setLineDash([1.5, 0.6]);
      ctx.beginPath();
      ctx.moveTo(wooferCenterX - tweeterRadius - 1.5, tweeterCenterY);
      ctx.lineTo(wooferCenterX + tweeterRadius + 1.5, tweeterCenterY);
      ctx.moveTo(wooferCenterX, tweeterCenterY - tweeterRadius - 1.5);
      ctx.lineTo(wooferCenterX, tweeterCenterY + tweeterRadius + 1.5);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Midrange Driver on Front Baffle (3-Way only, when not bandpass)
    if (crossoverWays === 3 && !isBandpass) {
      // Optional internal Midrange Sub-Enclosure dashed projection on front view
      if (!midSealed) {
        const hMidVal = cabinetData?.hMid ?? Math.max(midDiameter + 3, 12);
        ctx.save();
        ctx.strokeStyle = isLight ? '#059669' : '#10b981';
        ctx.lineWidth = 0.75 / zoom;
        ctx.setLineDash([1.4, 0.9]);
        ctx.strokeRect(fX + thickness, midCenterY - hMidVal / 2, fW - 2 * thickness, hMidVal);
        ctx.restore();
      }

      // Midrange Outer Basket Ring
      ctx.strokeStyle = isLight ? '#0f172a' : '#38bdf8';
      ctx.lineWidth = 1.15 / zoom;
      ctx.beginPath();
      ctx.arc(wooferCenterX, midCenterY, midRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Midrange Surround & Cone
      ctx.strokeStyle = isLight ? '#0284c7' : '#0284c7';
      ctx.lineWidth = 0.8 / zoom;
      ctx.beginPath();
      ctx.arc(wooferCenterX, midCenterY, midRadius * 0.80, 0, Math.PI * 2);
      ctx.stroke();

      // Midrange Dustcap / Phase Plug
      ctx.beginPath();
      ctx.arc(wooferCenterX, midCenterY, midRadius * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.16)' : 'rgba(56, 189, 248, 0.14)';
      ctx.fill();
      ctx.stroke();

      // Midrange Center Crosshairs
      ctx.strokeStyle = isLight ? '#059669' : '#10b981';
      ctx.lineWidth = 0.65 / zoom;
      ctx.setLineDash([1.8, 0.7]);
      ctx.beginPath();
      ctx.moveTo(wooferCenterX - midRadius - 1.8, midCenterY);
      ctx.lineTo(wooferCenterX + midRadius + 1.8, midCenterY);
      ctx.moveTo(wooferCenterX, midCenterY - midRadius - 1.8);
      ctx.lineTo(wooferCenterX, midCenterY + midRadius + 1.8);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (!isBandpass) {
      // 3. Woofer en Bafle Frontal (Caja Sellada / Ventilada Estándar)
      ctx.strokeStyle = isLight ? '#0f172a' : '#38bdf8';
      ctx.lineWidth = 1.2 / zoom;
      ctx.beginPath();
      ctx.arc(wooferCenterX, wooferCenterY, wooferRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Calado del bafle frontal
      if (baffleCutout && baffleCutout > 0) {
        ctx.save();
        ctx.strokeStyle = isLight ? '#059669' : '#10b981';
        ctx.lineWidth = 0.75 / zoom;
        ctx.setLineDash([1.2, 0.8]);
        ctx.beginPath();
        ctx.arc(wooferCenterX, wooferCenterY, wooferCutoutRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Suspensión perimetral y guardapolvo
      ctx.strokeStyle = isLight ? '#0284c7' : '#0284c7';
      ctx.lineWidth = 0.8 / zoom;
      ctx.beginPath();
      ctx.arc(wooferCenterX, wooferCenterY, wooferRadius * 0.82, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(wooferCenterX, wooferCenterY, wooferRadius * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.15)' : 'rgba(56, 189, 248, 0.12)';
      ctx.fill();
      ctx.stroke();

      // Cruz de centrado del woofer
      ctx.strokeStyle = isLight ? '#059669' : '#10b981';
      ctx.lineWidth = 0.7 / zoom;
      ctx.setLineDash([2, 0.8, 0.5, 0.8]);
      ctx.beginPath();
      ctx.moveTo(wooferCenterX - wooferRadius - 2, wooferCenterY);
      ctx.lineTo(wooferCenterX + wooferRadius + 2, wooferCenterY);
      ctx.moveTo(wooferCenterX, wooferCenterY - wooferRadius - 2);
      ctx.lineTo(wooferCenterX, wooferCenterY + wooferRadius + 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // Caja Paso Banda: El woofer está montado en el tabique interior (Proyección Oculta ISO)
      ctx.save();
      ctx.strokeStyle = isLight ? '#64748b' : '#38bdf8';
      ctx.lineWidth = 0.85 / zoom;
      ctx.setLineDash([1.4, 0.9]);

      // Aro exterior del chasis en tabique
      ctx.beginPath();
      ctx.arc(wooferCenterX, wooferCenterY, wooferRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Calado circular en el tabique
      ctx.strokeStyle = isLight ? '#059669' : '#10b981';
      ctx.beginPath();
      ctx.arc(wooferCenterX, wooferCenterY, wooferCutoutRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Cruz de centrado
      ctx.beginPath();
      ctx.moveTo(wooferCenterX - wooferRadius - 1.5, wooferCenterY);
      ctx.lineTo(wooferCenterX + wooferRadius + 1.5, wooferCenterY);
      ctx.moveTo(wooferCenterX, wooferCenterY - wooferRadius - 1.5);
      ctx.lineTo(wooferCenterX, wooferCenterY + wooferRadius + 1.5);
      ctx.stroke();

      // Rótulo técnico de proyección oculta
      ctx.font = `bold ${Math.max(7.5 / zoom, 2.0)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = isLight ? '#0369a1' : '#38bdf8';
      ctx.fillText(t("[WOOFER EN TABIQUE INTERIOR]"), wooferCenterX, wooferCenterY - wooferRadius - 1.4);
      ctx.restore();
    }

    // Port on Front Baffle (or Passive Radiator when prTuning === 'radiator')
    const isPassiveRadiator = boxType === 'ported' && prTuning === 'radiator';
    const isBp6 = isBandpass && bandpassOrder === 6;
    const isBp6Series = isBp6 && bandpassTopology === 'series';
    const portCenterY = topY + thickness + (portYPct / 100) * innerH;
    const portCenterX = fX + fW / 2;
    const isRearPort = portLocation === 'rear';

    if (isPassiveRadiator) {
      const prR = Math.min(Math.max((prDia || 20) / 2, 3.0), innerW * 0.42, innerH * 0.36);
      const prCenterY = isRearPort ? (topY + fH * 0.5) : portCenterY;
      ctx.save();
      ctx.strokeStyle = isRearPort ? 'rgba(139, 92, 246, 0.72)' : '#7c3aed';
      ctx.fillStyle = isRearPort ? 'rgba(139, 92, 246, 0.06)' : 'rgba(139, 92, 246, 0.12)';
      ctx.lineWidth = 1.2 / zoom;
      if (isRearPort) ctx.setLineDash([1.6, 1.0]);

      // Aro exterior del radiador pasivo
      ctx.beginPath();
      ctx.arc(portCenterX, prCenterY, prR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Suspensión perimetral
      ctx.beginPath();
      ctx.arc(portCenterX, prCenterY, prR * 0.84, 0, Math.PI * 2);
      ctx.stroke();

      // Disco central de masa sintonizadora
      ctx.beginPath();
      ctx.arc(portCenterX, prCenterY, prR * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = isRearPort ? 'rgba(139, 92, 246, 0.18)' : 'rgba(139, 92, 246, 0.28)';
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = `bold ${Math.max(7.2 / zoom, 2.0)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#6d28d9';
      ctx.fillText(
        `PR Ø${(prDia || 20).toFixed(1)}cm (${isRearPort ? t("Atrás") : t("Frente")})`,
        portCenterX,
        prCenterY + prR + 2.2
      );
      ctx.restore();
    } else if (boxType === 'ported' || boxType === 'bandpass') {
      const count = effectivePortCount;
      const pDim = (portShape === 'round' || portShape === 'custom')
        ? (portDiameter || 7.5)
        : (portWidth || 10);
      const portSpacing = calculatePortSpacing(count, innerW, portShape, pDim, portSpacingPct);

      for (let pIdx = 0; pIdx < count; pIdx++) {
        const pCurX = count === 1 
          ? portCenterX 
          : portCenterX - ((count - 1) * portSpacing) / 2 + pIdx * portSpacing;

        ctx.strokeStyle = isRearPort
          ? (isLight ? 'rgba(2, 132, 199, 0.55)' : 'rgba(56, 189, 248, 0.5)')
          : (isLight ? '#0284c7' : '#38bdf8');
        ctx.lineWidth = (isRearPort ? 1.0 : 1.2) / zoom;
        ctx.fillStyle = isRearPort
          ? (isLight ? 'rgba(2, 132, 199, 0.025)' : 'rgba(2, 132, 199, 0.03)')
          : (isLight ? 'rgba(2, 132, 199, 0.06)' : 'rgba(2, 132, 199, 0.08)');

        if (isRearPort && !isBandpass) {
          ctx.setLineDash([1.6, 1.0]);
        } else {
          ctx.setLineDash([]);
        }

        if (portShape === 'round' || portShape === 'custom') {
          const pR = Math.max((portDiameter || 7.5) / 2, 1);

          // Outer Flange or Aeroport Trumpet Rings in Front View
          if (flaredEnds === 1) {
            // Dos a Ras: Flat mounting flange ring around the port opening
            const flangeR = pR + Math.min(Math.max(pR * 0.28, 0.55), 1.1);
            ctx.save();
            ctx.beginPath();
            ctx.arc(pCurX, portCenterY, flangeR, 0, Math.PI * 2);
            ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.04)' : 'rgba(56, 189, 248, 0.05)';
            ctx.fill();
            ctx.lineWidth = (isRearPort ? 0.8 : 0.95) / zoom;
            ctx.stroke();
            ctx.restore();
          } else if (flaredEnds === 2 || flaredEnds === 3) {
            // Abocinado (Aeroport / Flared): Concentric trumpet bell contour rings on outer baffle mouth
            const flareR = pR + Math.min(Math.max(pR * 0.42, 0.8), 1.5);
            const midFlareR = (pR + flareR) / 2;
            ctx.save();
            ctx.beginPath();
            ctx.arc(pCurX, portCenterY, flareR, 0, Math.PI * 2);
            ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.05)' : 'rgba(56, 189, 248, 0.06)';
            ctx.fill();
            ctx.lineWidth = (isRearPort ? 0.9 : 1.1) / zoom;
            ctx.stroke();

            ctx.beginPath();
            ctx.setLineDash([0.9, 0.6]);
            ctx.lineWidth = 0.65 / zoom;
            ctx.arc(pCurX, portCenterY, midFlareR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }

          // Main internal throat diameter
          ctx.beginPath();
          ctx.arc(pCurX, portCenterY, pR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);

          // Port center crosshair
          ctx.strokeStyle = isLight ? '#059669' : '#10b981';
          ctx.lineWidth = 0.6 / zoom;
          ctx.setLineDash([1.5, 0.6]);
          ctx.beginPath();
          ctx.moveTo(pCurX - pR - 1.5, portCenterY);
          ctx.lineTo(pCurX + pR + 1.5, portCenterY);
          ctx.moveTo(pCurX, portCenterY - pR - 1.5);
          ctx.lineTo(pCurX, portCenterY + pR + 1.5);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          const pW = Math.max(portWidth || 10, 2);
          const pH = Math.max(portHeight || 4, 1.5);

          if (flaredEnds === 1) {
            // Dos a Ras: Flat rectangular flange collar
            const fPad = Math.min(Math.max(Math.min(pW, pH) * 0.22, 0.5), 1.0);
            ctx.save();
            ctx.lineWidth = (isRearPort ? 0.8 : 0.95) / zoom;
            ctx.strokeRect(pCurX - pW / 2 - fPad, portCenterY - pH / 2 - fPad, pW + fPad * 2, pH + fPad * 2);
            ctx.restore();
          } else if (flaredEnds === 2 || flaredEnds === 3) {
            // Abocinado: Flared slot mouth contour on outer baffle mouth
            const fPad = Math.min(Math.max(Math.min(pW, pH) * 0.35, 0.7), 1.4);
            ctx.save();
            ctx.lineWidth = (isRearPort ? 0.9 : 1.05) / zoom;
            ctx.strokeRect(pCurX - pW / 2 - fPad, portCenterY - pH / 2 - fPad, pW + fPad * 2, pH + fPad * 2);
            ctx.setLineDash([0.9, 0.6]);
            ctx.lineWidth = 0.6 / zoom;
            ctx.strokeRect(pCurX - pW / 2 - fPad * 0.5, portCenterY - pH / 2 - fPad * 0.5, pW + fPad, pH + fPad);
            ctx.restore();
          }

          ctx.fillRect(pCurX - pW / 2, portCenterY - pH / 2, pW, pH);
          ctx.strokeRect(pCurX - pW / 2, portCenterY - pH / 2, pW, pH);
          ctx.setLineDash([]);
        }
      }

      if (isRearPort && !isBandpass) {
        ctx.fillStyle = isLight ? '#0369a1' : '#38bdf8';
        ctx.font = `bold ${Math.max(7.5 / zoom, 2.0)}px monospace`;
        ctx.textAlign = 'center';
        const labelOffset = (portShape === 'round' || portShape === 'custom')
          ? Math.max((portDiameter || 7.5) / 2, 1) + 2.4
          : Math.max(portHeight || 4, 1.5) / 2 + 2.4;
        ctx.fillText(`(${t("Atrás")})`, portCenterX, portCenterY + labelOffset);
      }

      // Cotas de posicionamiento del puerto: proyectadas fuera del plano (estilo FreeCAD TechDraw)
      if (showDimensions) {
        const pDimYOffset = (botY - portCenterY) + 3.0;

        const pX0 = count === 1 
          ? portCenterX 
          : portCenterX - ((count - 1) * portSpacing) / 2;
        
        // 1. Cota horizontal desde el lateral izquierdo (fX) hasta el primer puerto
        const distSide = pX0 - fX;
        const sideLabel = distSide >= 7.5
          ? `Lado:${convertTo(distSide, 'length', unitSystem).toFixed(1)}`
          : `${convertTo(distSide, 'length', unitSystem).toFixed(1)}`;
        drawDimension(fX, portCenterY, pX0, portCenterY, sideLabel, pDimYOffset, true);

        // 2. Cota de separación centro a centro entre puertos (cuando count >= 2)
        if (count >= 2) {
          const sepLabel = portSpacing >= 8.0
            ? `Sep:${convertTo(portSpacing, 'length', unitSystem).toFixed(1)}`
            : `${convertTo(portSpacing, 'length', unitSystem).toFixed(1)}`;
          for (let pIdx = 0; pIdx < count - 1; pIdx++) {
            const pA = pX0 + pIdx * portSpacing;
            const pB = pA + portSpacing;
            drawDimension(pA, portCenterY, pB, portCenterY, sepLabel, pDimYOffset, true);
          }
        }

        // 3. Cota vertical desde el suelo (botY) hasta el centro de los puertos
        const portDistBot = botY - portCenterY;
        const ptLabel = portDistBot >= 6.5
          ? `Suelo: ${convertTo(portDistBot, 'length', unitSystem).toFixed(1)}`
          : `Pt: ${convertTo(portDistBot, 'length', unitSystem).toFixed(1)}`;
        drawDimension(fX + fW, portCenterY, fX + fW, botY, ptLabel, 3.2, false);
      }
    }

    // Front View Internal Bracing (Hidden dashed lines behind baffle)
    if (enableBracing && bracingCount > 0) {
      ctx.save();
      ctx.strokeStyle = isLight ? 'rgba(217, 119, 6, 0.75)' : 'rgba(251, 191, 36, 0.75)';
      ctx.lineWidth = 1.0 / zoom;
      ctx.setLineDash([4 / zoom, 3 / zoom]);
      for (let i = 0; i < bracingCount; i++) {
        const frac = (i + 1) / (bracingCount + 1);
        const braceY = topY + thickness + (fH - 2 * thickness) * frac;
        ctx.strokeRect(fX + thickness, braceY - thickness / 2, fW - 2 * thickness, thickness);
      }
      ctx.restore();
    }

    // Front View Label Header
    ctx.fillStyle = isLight ? '#0369a1' : '#38bdf8';
    ctx.font = `bold ${Math.max(9 / zoom, 2.5)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('VISTA FRONTAL (BAFLE)', fX + fW / 2, topY - 3.5);

    // Front View Dimension Lines
    const hasSideTaper = shape === 'trapezoidal' && wRearExt > 0 && Math.abs(wExt - wRearExt) > 0.2;
    const wDisp = hasSideTaper
      ? `Frente: ${convertTo(wExt, 'length', unitSystem).toFixed(1)} ${uLabel}`
      : `${convertTo(wExt, 'length', unitSystem).toFixed(1)} ${uLabel}`;
    const hDisp = `${convertTo(hExt, 'length', unitSystem).toFixed(1)} ${uLabel}`;
    const hasPortBottomDims = showDimensions && (boxType === 'ported' || boxType === 'bandpass') && prTuning === 'port' && portCount > 0;
    drawDimension(fX, botY, fX + fW, botY, wDisp, hasPortBottomDims ? 6.8 : 3.5, true);
    if (hasSideTaper) {
      const rearX = fX + (fW - wRearExt) / 2;
      const rearDisp = `Tras: ${convertTo(wRearExt, 'length', unitSystem).toFixed(1)} ${uLabel} (±${trapAngleDeg.toFixed(1)}°)`;
      drawDimension(rearX, botY, rearX + wRearExt, botY, rearDisp, 6.2, true);
    }
    drawDimension(fX, topY, fX, botY, hDisp, -3.5, false);

    // Driver Vertical Position Dimensions (from Top Edge)
    // 1. Tweeter (2-Way & 3-Way, en cajas direct-radiator)
    if (crossoverWays >= 2 && !isBandpass) {
      const twDistTop = tweeterCenterY - topY;
      const twLabel = twDistTop >= 6.5
        ? `Tw: ${convertTo(twDistTop, 'length', unitSystem).toFixed(1)}`
        : `${convertTo(twDistTop, 'length', unitSystem).toFixed(1)}`;
      drawDimension(fX + fW, topY, fX + fW, tweeterCenterY, twLabel, 1.8, false);
    }

    // 2. Midrange Driver (3-Way)
    if (crossoverWays === 3 && !isBandpass) {
      const midDistTop = midCenterY - topY;
      const midLabel = `Mid: ${convertTo(midDistTop, 'length', unitSystem).toFixed(1)}`;
      drawDimension(fX + fW, topY, fX + fW, midCenterY, midLabel, 3.4, false);
    }

    // 3. Woofer position dimension
    const spkDistTop = wooferCenterY - topY;
    const wfLabel = (crossoverWays >= 2 && !isBandpass)
      ? (spkDistTop >= 6.5 ? `Wf: ${convertTo(spkDistTop, 'length', unitSystem).toFixed(1)}` : `${convertTo(spkDistTop, 'length', unitSystem).toFixed(1)}`)
      : `${convertTo(spkDistTop, 'length', unitSystem).toFixed(1)}`;
    const wfOffset = crossoverWays === 3 && !isBandpass ? 5.0 : (crossoverWays >= 2 && !isBandpass ? 3.6 : 2.0);
    drawDimension(fX + fW, topY, fX + fW, wooferCenterY, wfLabel, wfOffset, false);

    // ----------------------------------------------------
    // B. VISTA LATERAL (SECCIÓN DE CORTE A-A')
    // ----------------------------------------------------
    const sX = sideStartX;
    const sWTop = shape === 'trapezoidal' ? dTrapTop : dExt;
    const sWBot = shape === 'trapezoidal' ? dTrapBot : dExt;
    const sW = Math.max(sWTop, sWBot);
    const frontOuterXAtY = (yPos: number) => {
      const frac = Math.min(1, Math.max(0, (yPos - topY) / Math.max(1, fH)));
      return sX + sWTop + (sWBot - sWTop) * frac;
    };
    const frontInnerXAtY = (yPos: number) => frontOuterXAtY(yPos) - thickness;
    const baffleAngle = shape === 'trapezoidal' ? Math.atan2(sWTop - sWBot, fH) : 0;

    // Wood panel hatching and profiles
    ctx.fillStyle = isLight ? '#0369a1' : '#38bdf8';
    ctx.font = `bold ${Math.max(9 / zoom, 2.5)}px monospace`;
    ctx.textAlign = 'center';
    const sideTitle = isBp6
      ? (isBp6Series
          ? 'SECCIÓN A-A\' · 6.º ORDEN SERIE (Vr→Vf→Ext)'
          : 'SECCIÓN A-A\' · 6.º ORDEN PARALELO (Vr→Ext, Vf→Ext)')
      : 'SECCIÓN CORTE A-A\' (LATERAL)';
    ctx.fillText(sideTitle, sX + sW / 2, shape === 'trapezoidal' ? topY - 7.5 : topY - 3.5);

    if (boxType === 'ported' && activeHpEnabled && hpFx && hpQx) {
      ctx.save();
      ctx.font = `bold ${Math.max(7.4 / zoom, 2.0)}px monospace`;
      ctx.fillStyle = '#059669';
      ctx.textAlign = 'center';
      ctx.fillText(
        `FILTRO ACTIVO B6 · HP 2.º O: ${hpFx.toFixed(1)} Hz · Qx=${hpQx.toFixed(2)}`,
        fX + fW / 2,
        topY - 1.4
      );
      ctx.restore();
    }
    if (isPassiveRadiator) {
      ctx.save();
      ctx.font = `bold ${Math.max(7.2 / zoom, 2.0)}px monospace`;
      ctx.fillStyle = '#6d28d9';
      ctx.textAlign = 'center';
      ctx.fillText(
        `PR: Ø${(prDia || 20).toFixed(1)}cm (${((prDia || 20) / 2.54).toFixed(0)}") · Fb ${prFbNatural.toFixed(1)}Hz · +${prMasaAnadidaG.toFixed(0)}g`,
        fX + fW / 2,
        topY - 1.4
      );
      ctx.restore();
    }

    // Panels (Top, Bottom, Front Baffle, Rear)
    ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';

    // 1. Top Panel
    ctx.strokeRect(sX, topY, sWTop, thickness);
    hatchRect(sX, topY, sWTop, thickness);

    // 2. Bottom Panel
    ctx.strokeRect(sX, botY - thickness, sWBot, thickness);
    hatchRect(sX, botY - thickness, sWBot, thickness);

    // 3. Front Baffle (Right side of profile - vertical or slanted for trapezoidal)
    const baffleTopY = topY + thickness;
    const baffleBotY = botY - thickness;
    const bTopIn = frontInnerXAtY(baffleTopY);
    const bTopOut = frontOuterXAtY(baffleTopY);
    const bBotIn = frontInnerXAtY(baffleBotY);
    const bBotOut = frontOuterXAtY(baffleBotY);
    const baffleX = frontInnerXAtY(wooferCenterY);

    if (shape === 'trapezoidal' && Math.abs(sWTop - sWBot) > 0.01) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(bTopIn, baffleTopY);
      ctx.lineTo(bTopOut, baffleTopY);
      ctx.lineTo(bBotOut, baffleBotY);
      ctx.lineTo(bBotIn, baffleBotY);
      ctx.closePath();
      ctx.stroke();
      ctx.clip();
      hatchRect(Math.min(bTopIn, bBotIn), baffleTopY, Math.max(bTopOut, bBotOut) - Math.min(bTopIn, bBotIn), baffleBotY - baffleTopY);
      ctx.restore();
    } else {
      ctx.strokeRect(bTopIn, baffleTopY, thickness, fH - 2 * thickness);
      hatchRect(bTopIn, baffleTopY, thickness, fH - 2 * thickness);
    }

    // 4. Rear Panel (Left side of profile)
    ctx.strokeRect(sX, topY + thickness, thickness, fH - 2 * thickness);
    hatchRect(sX, topY + thickness, thickness, fH - 2 * thickness);

    // 5. Internal Bracing Cross-Section (Sección de Refuerzos Internos)
    if (enableBracing && bracingCount > 0) {
      const innerLeft = sX + thickness;
      const innerRight = baffleX;
      const braceD = Math.max(innerRight - innerLeft, 2);
      const braceRim = Math.min(Math.max(thickness * 2.5, 4), Math.min(fW - 2 * thickness, braceD) * 0.22);

      for (let i = 0; i < bracingCount; i++) {
        const frac = (i + 1) / (bracingCount + 1);
        const braceY = topY + thickness + (fH - 2 * thickness) * frac;
        const bTop = braceY - thickness / 2;

        // Rear & Front hatched rim cross-sections
        ctx.save();
        ctx.strokeStyle = isLight ? '#d97706' : '#fbbf24';
        ctx.lineWidth = 1.1 / zoom;
        ctx.strokeRect(innerLeft, bTop, braceRim, thickness);
        hatchRect(innerLeft, bTop, braceRim, thickness);
        ctx.strokeRect(innerRight - braceRim, bTop, braceRim, thickness);
        hatchRect(innerRight - braceRim, bTop, braceRim, thickness);

        // Dashed span across the open window cutout
        if (braceD > braceRim * 2 + 1) {
          ctx.setLineDash([3 / zoom, 2.5 / zoom]);
          ctx.beginPath();
          ctx.moveTo(innerLeft + braceRim, bTop);
          ctx.lineTo(innerRight - braceRim, bTop);
          ctx.moveTo(innerLeft + braceRim, bTop + thickness);
          ctx.lineTo(innerRight - braceRim, bTop + thickness);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
      }
    }

    // WooferCross-Section, Tweeter Cross-Section & Midrange Cross-Section (Mounted on Baffle extending inwards)
    if (crossoverWays >= 2 && !isBandpass) {
      const twDepth = Math.min(sW * 0.16, 4.8);
      const twBaffleX = frontInnerXAtY(tweeterCenterY);
      ctx.save();
      ctx.translate(twBaffleX, tweeterCenterY);
      ctx.rotate(baffleAngle);
      ctx.strokeStyle = isLight ? '#0369a1' : '#38bdf8';
      ctx.lineWidth = 1.0 / zoom;

      // Tweeter Rear Magnet Chamber inside Profile
      ctx.fillStyle = isLight ? '#cbd5e1' : '#1e3a5f';
      ctx.fillRect(-twDepth, -tweeterRadius * 0.55, twDepth, tweeterRadius * 1.1);
      ctx.strokeRect(-twDepth, -tweeterRadius * 0.55, twDepth, tweeterRadius * 1.1);

      // Tweeter Dome protruding slightly at Baffle outer face
      ctx.beginPath();
      ctx.arc(thickness, 0, tweeterRadius * 0.36, -Math.PI / 2, Math.PI / 2);
      ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.25)' : 'rgba(56, 189, 248, 0.25)';
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (crossoverWays === 3 && !isBandpass) {
      const midDepth = Math.min(sW * 0.28, 9.0);
      const midBaffleX = frontInnerXAtY(midCenterY);
      ctx.save();
      ctx.translate(midBaffleX, midCenterY);
      ctx.rotate(baffleAngle);

      // Internal Midrange Sub-Enclosure (Cámara de Medios Separada) if not sealed-back
      if (!midSealed) {
        const dMidVal = Math.min(cabinetData?.dMid ?? Math.min(sW * 0.45, 13), sW - 2 * thickness - 1.5);
        const hMidVal = Math.min(cabinetData?.hMid ?? Math.max(midDiameter + 3, 12), fH - 2 * thickness - 4);
        const mBoxTop = -hMidVal / 2;
        const mBoxBot = hMidVal / 2;
        const mBoxLeft = -dMidVal;

        ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
        ctx.lineWidth = 1.1 / zoom;
        // Top wall of midrange chamber
        ctx.strokeRect(mBoxLeft, mBoxTop - thickness, dMidVal, thickness);
        hatchRect(mBoxLeft, mBoxTop - thickness, dMidVal, thickness);
        // Bottom wall of midrange chamber
        ctx.strokeRect(mBoxLeft, mBoxBot, dMidVal, thickness);
        hatchRect(mBoxLeft, mBoxBot, dMidVal, thickness);
        // Rear wall of midrange chamber
        ctx.strokeRect(mBoxLeft - thickness, mBoxTop - thickness, thickness, hMidVal + 2 * thickness);
        hatchRect(mBoxLeft - thickness, mBoxTop - thickness, thickness, hMidVal + 2 * thickness);
      }

      // Midrange Cone & Chassis Side Profile
      ctx.strokeStyle = isLight ? '#0369a1' : '#38bdf8';
      ctx.lineWidth = 1.05 / zoom;
      ctx.beginPath();
      ctx.moveTo(0, -midRadius * 0.85);
      ctx.lineTo(-midDepth * 0.6, -midRadius * 0.38);
      ctx.lineTo(-midDepth, -midRadius * 0.38);
      ctx.lineTo(-midDepth, midRadius * 0.38);
      ctx.lineTo(-midDepth * 0.6, midRadius * 0.38);
      ctx.lineTo(0, midRadius * 0.85);
      ctx.stroke();

      // Midrange Magnet Cylinder
      ctx.fillStyle = isLight ? '#cbd5e1' : '#1e3a5f';
      ctx.fillRect(-midDepth, -midRadius * 0.38, midDepth * 0.42, midRadius * 0.76);
      ctx.strokeStyle = isLight ? '#64748b' : '#38bdf8';
      ctx.strokeRect(-midDepth, -midRadius * 0.38, midDepth * 0.42, midRadius * 0.76);
      ctx.restore();
    }

    const spkDepth = driverDepth && driverDepth > 0
      ? Math.min(driverDepth / 10, sW - 2 * thickness - 1)
      : Math.min(sW * 0.45, 16);

    const vrRatio = Math.max(0.12, Math.min(0.88, Number(bandpassRatio) || 0.5));
    const innerDepth = sW - 2 * thickness;
    const netDepth = Math.max(innerDepth - thickness, 5);
    const depthRear = netDepth * vrRatio;
    const depthFront = netDepth * (1 - vrRatio);
    const divX = sX + thickness + depthRear;
    const isDriverInverted = isBandpass && (depthRear < spkDepth + 1.5) && (depthFront > depthRear) && (depthFront >= spkDepth + 1.0);

    // Función técnica para dibujar el corte lateral realista de un altavoz electroacústico (Woofer)
    const drawRealisticWooferProfile = (
      mountX: number,
      cy: number,
      rOuter: number,
      rCutout: number,
      depth: number,
      direction: 'right' | 'left'
    ) => {
      const sgn = direction === 'right' ? 1 : -1;
      ctx.save();

      // Proporciones mecánicas estándar de transductores profesionales
      const flangeThick = 0.42;
      const rConeOuter = rCutout * 0.78;
      const rVc = rOuter * 0.20;
      const rDustCap = rVc * 1.35;
      const rSpider = rOuter * 0.42;
      const rMagnet = rOuter * 0.50;
      const rGapIn = rVc - 0.14;
      const rGapOut = rVc + 0.14;
      const rVent = rOuter * 0.08;

      const uApex = depth * 0.32;
      const uSpider = depth * 0.38;
      const uTopPlate = depth * 0.52;
      const uMagnet = depth * 0.62;
      const uBackPlate = depth * 0.86;
      const uEnd = depth * 1.00;

      const xApex = mountX - sgn * uApex;
      const xSpider = mountX - sgn * uSpider;
      const xTopPlate = mountX - sgn * uTopPlate;
      const xMagnet = mountX - sgn * uMagnet;
      const xBackPlate = mountX - sgn * uBackPlate;
      const xRear = mountX - sgn * uEnd;

      // Paleta cromática técnico-arquitectónica
      const strokeMetal = isLight ? '#475569' : '#94a3b8';
      const fillSteel = isLight ? '#cbd5e1' : '#334155';
      const fillMagnet = isLight ? '#334155' : '#0f172a';
      const strokeMagnet = isLight ? '#1e293b' : '#38bdf8';
      const strokeCone = isLight ? '#0f172a' : '#38bdf8';
      const fillCone = isLight ? 'rgba(15, 23, 42, 0.18)' : 'rgba(56, 189, 248, 0.12)';
      const strokeSurround = isLight ? '#1e293b' : '#0284c7';
      const fillSurround = isLight ? 'rgba(30, 41, 59, 0.45)' : 'rgba(14, 165, 233, 0.25)';
      const strokeSpider = isLight ? '#d97706' : '#fbbf24';
      const fillCopper = isLight ? '#ea580c' : '#f97316';

      // 1. MOTOR ASSEMBLY (Placa superior, Imán, Culata y Núcleo Polar)
      // 1.1 Placa Superior (Top Plate)
      ctx.fillStyle = fillSteel;
      ctx.strokeStyle = strokeMetal;
      ctx.lineWidth = 1.0 / zoom;
      const topPlateW = Math.abs(xTopPlate - xMagnet);
      const topPlateLeft = Math.min(xTopPlate, xMagnet);
      ctx.fillRect(topPlateLeft, cy - rMagnet, topPlateW, rMagnet - rGapOut);
      ctx.strokeRect(topPlateLeft, cy - rMagnet, topPlateW, rMagnet - rGapOut);
      ctx.fillRect(topPlateLeft, cy + rGapOut, topPlateW, rMagnet - rGapOut);
      ctx.strokeRect(topPlateLeft, cy + rGapOut, topPlateW, rMagnet - rGapOut);

      // 1.2 Imán Cerámico de Ferrita
      const magW = Math.abs(xMagnet - xBackPlate);
      const magLeft = Math.min(xMagnet, xBackPlate);
      ctx.fillStyle = fillMagnet;
      ctx.strokeStyle = strokeMagnet;
      ctx.fillRect(magLeft, cy - rMagnet, magW, rMagnet - (rGapOut + 0.35));
      ctx.strokeRect(magLeft, cy - rMagnet, magW, rMagnet - (rGapOut + 0.35));
      ctx.fillRect(magLeft, cy + (rGapOut + 0.35), magW, rMagnet - (rGapOut + 0.35));
      ctx.strokeRect(magLeft, cy + (rGapOut + 0.35), magW, rMagnet - (rGapOut + 0.35));

      // 1.3 Placa Trasera y Culata (Back Plate & T-Yoke)
      const bpW = Math.abs(xBackPlate - xRear);
      const bpLeft = Math.min(xBackPlate, xRear);
      ctx.fillStyle = fillSteel;
      ctx.strokeStyle = strokeMetal;
      ctx.fillRect(bpLeft, cy - rMagnet, bpW, rMagnet - rVent);
      ctx.strokeRect(bpLeft, cy - rMagnet, bpW, rMagnet - rVent);
      ctx.fillRect(bpLeft, cy + rVent, bpW, rMagnet - rVent);
      ctx.strokeRect(bpLeft, cy + rVent, bpW, rMagnet - rVent);

      // Culata abombada anti-tope en el centro
      const bumpW = Math.max(0.25, bpW * 0.35);
      const bumpLeft = sgn === 1 ? (bpLeft - bumpW) : (bpLeft + bpW);
      ctx.fillRect(Math.min(bumpLeft, bpLeft), cy - rVc * 1.35, bumpW, rVc * 2.7);
      ctx.strokeRect(Math.min(bumpLeft, bpLeft), cy - rVc * 1.35, bumpW, rVc * 2.7);

      // Núcleo polar central (Pole Piece)
      const poleW = Math.abs(xTopPlate - xBackPlate);
      const poleLeft = Math.min(xTopPlate, xBackPlate);
      ctx.fillRect(poleLeft, cy - rGapIn, poleW, rGapIn - rVent);
      ctx.strokeRect(poleLeft, cy - rGapIn, poleW, rGapIn - rVent);
      ctx.fillRect(poleLeft, cy + rVent, poleW, rGapIn - rVent);
      ctx.strokeRect(poleLeft, cy + rVent, poleW, rGapIn - rVent);

      // Orificio de ventilación polar central (eje X)
      ctx.save();
      ctx.strokeStyle = isLight ? 'rgba(100, 116, 139, 0.45)' : 'rgba(56, 189, 248, 0.35)';
      ctx.setLineDash([1.4 / zoom, 1.0 / zoom]);
      ctx.lineWidth = 0.8 / zoom;
      ctx.beginPath();
      ctx.moveTo(xRear - sgn * bumpW, cy);
      ctx.lineTo(xTopPlate, cy);
      ctx.stroke();
      ctx.restore();

      // 2. BOBINA MÓVIL Y DEVANADO DE COBRE
      const xCoilEnd = xMagnet - sgn * (magW * 0.75);
      ctx.strokeStyle = strokeMetal;
      ctx.lineWidth = 1.0 / zoom;
      ctx.beginPath();
      ctx.moveTo(xApex, cy - rVc);
      ctx.lineTo(xCoilEnd, cy - rVc);
      ctx.moveTo(xApex, cy + rVc);
      ctx.lineTo(xCoilEnd, cy + rVc);
      ctx.stroke();

      const coilW = magW * 0.65;
      const coilLeft = Math.min(xTopPlate, xTopPlate - sgn * coilW);
      ctx.fillStyle = fillCopper;
      ctx.strokeStyle = fillCopper;
      ctx.fillRect(coilLeft, cy - rVc - 0.08, coilW, 0.16);
      ctx.strokeRect(coilLeft, cy - rVc - 0.08, coilW, 0.16);
      ctx.fillRect(coilLeft, cy + rVc - 0.08, coilW, 0.16);
      ctx.strokeRect(coilLeft, cy + rVc - 0.08, coilW, 0.16);

      // 3. CANASTA / CHASIS METÁLICO (Basket Arms)
      ctx.strokeStyle = strokeMetal;
      ctx.lineWidth = 1.2 / zoom;
      ctx.beginPath();
      ctx.moveTo(mountX, cy - rCutout);
      ctx.lineTo(xTopPlate, cy - rMagnet);
      ctx.lineTo(xTopPlate + sgn * 0.3, cy - rMagnet);
      ctx.lineTo(mountX, cy - (rCutout - 0.28));

      ctx.moveTo(mountX, cy + rCutout);
      ctx.lineTo(xTopPlate, cy + rMagnet);
      ctx.lineTo(xTopPlate + sgn * 0.3, cy + rMagnet);
      ctx.lineTo(mountX, cy + (rCutout - 0.28));
      ctx.stroke();

      // 4. ARAÑA CENTRADORA CORRUGADA (Spider Damper)
      ctx.strokeStyle = strokeSpider;
      ctx.lineWidth = 1.1 / zoom;
      const spiderSteps = 6;
      ctx.beginPath();
      for (let s = 0; s <= spiderSteps; s++) {
        const frac = s / spiderSteps;
        const sy = (cy - rVc) - frac * (rSpider - rVc);
        const wave = (s % 2 === 1 ? 0.22 : -0.22) * sgn;
        const sx = (xApex - sgn * 0.2) + frac * (xSpider - xApex) + wave;
        if (s === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      ctx.beginPath();
      for (let s = 0; s <= spiderSteps; s++) {
        const frac = s / spiderSteps;
        const sy = (cy + rVc) + frac * (rSpider - rVc);
        const wave = (s % 2 === 1 ? 0.22 : -0.22) * sgn;
        const sx = (xApex - sgn * 0.2) + frac * (xSpider - xApex) + wave;
        if (s === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // 5. CONO EXPONENCIAL (Loudspeaker Cone)
      const xConeBase = mountX + sgn * 0.12;
      ctx.fillStyle = fillCone;
      ctx.strokeStyle = strokeCone;
      ctx.lineWidth = 1.2 / zoom;

      // Cono superior
      ctx.beginPath();
      ctx.moveTo(xConeBase, cy - rConeOuter);
      ctx.quadraticCurveTo(mountX - sgn * (uApex * 0.2), cy - (rConeOuter * 0.52 + rVc * 0.48), xApex, cy - rVc);
      ctx.lineTo(xApex, cy - rVc + 0.12);
      ctx.quadraticCurveTo(mountX - sgn * (uApex * 0.2), cy - (rConeOuter * 0.52 + rVc * 0.48) + 0.12, xConeBase, cy - rConeOuter + 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cono inferior
      ctx.beginPath();
      ctx.moveTo(xConeBase, cy + rConeOuter);
      ctx.quadraticCurveTo(mountX - sgn * (uApex * 0.2), cy + (rConeOuter * 0.52 + rVc * 0.48), xApex, cy + rVc);
      ctx.lineTo(xApex, cy + rVc - 0.12);
      ctx.quadraticCurveTo(mountX - sgn * (uApex * 0.2), cy + (rConeOuter * 0.52 + rVc * 0.48) - 0.12, xConeBase, cy + rConeOuter - 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 6. CÚPULA CUBREPOLVO CENTRAL (Dust Cap Dome)
      const domeH = rDustCap * 0.58;
      ctx.fillStyle = fillCone;
      ctx.strokeStyle = strokeCone;
      ctx.beginPath();
      ctx.moveTo(xApex, cy - rDustCap);
      ctx.quadraticCurveTo(xApex + sgn * domeH, cy, xApex, cy + rDustCap);
      ctx.stroke();

      // 7. SUSPENSIÓN PERIMETRAL DE MEDIO ROLLO (Half-roll Surround)
      const rollR = (rCutout - rConeOuter) / 2;
      const rollCenterYTop = cy - (rCutout + rConeOuter) / 2;
      const rollCenterYBot = cy + (rCutout + rConeOuter) / 2;
      ctx.fillStyle = fillSurround;
      ctx.strokeStyle = strokeSurround;
      ctx.lineWidth = 1.1 / zoom;

      ctx.beginPath();
      ctx.moveTo(mountX + sgn * 0.08, cy - rCutout);
      ctx.quadraticCurveTo(mountX + sgn * (rollR * 1.5), rollCenterYTop, xConeBase, cy - rConeOuter);
      ctx.quadraticCurveTo(mountX + sgn * (rollR * 1.2), rollCenterYTop, mountX + sgn * 0.08, cy - rCutout);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(mountX + sgn * 0.08, cy + rCutout);
      ctx.quadraticCurveTo(mountX + sgn * (rollR * 1.5), rollCenterYBot, xConeBase, cy + rConeOuter);
      ctx.quadraticCurveTo(mountX + sgn * (rollR * 1.2), rollCenterYBot, mountX + sgn * 0.08, cy + rCutout);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 8. BRIDA DE FIJACIÓN Y JUNTA (Chassis Flange Rim)
      const fLeft = sgn === 1 ? mountX : (mountX - flangeThick);
      ctx.fillStyle = isLight ? '#94a3b8' : '#334155';
      ctx.strokeStyle = strokeMetal;
      ctx.lineWidth = 1.1 / zoom;

      ctx.fillRect(fLeft, cy - rOuter, flangeThick, rOuter - rCutout);
      ctx.strokeRect(fLeft, cy - rOuter, flangeThick, rOuter - rCutout);
      ctx.fillRect(fLeft, cy + rCutout, flangeThick, rOuter - rCutout);
      ctx.strokeRect(fLeft, cy + rCutout, flangeThick, rOuter - rCutout);

      ctx.restore();
    };

    if (!isBandpass) {
      // Woofer en Bafle Frontal (Direct Radiator): Disparo perpendicular al bafle
      ctx.save();
      ctx.translate(baffleX, wooferCenterY);
      ctx.rotate(baffleAngle);
      drawRealisticWooferProfile(0, 0, wooferRadius, wooferCutoutRadius, spkDepth, 'right');
      ctx.restore();
    } else {
      // CAJA PASO BANDA: El woofer está montado en el tabique divisor intermedio (divX)
      // 1. Delineación y tintado de las cámaras acústicas
      // Cámara Trasera Vr (Izquierda)
      ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.05)' : 'rgba(2, 132, 199, 0.08)';
      ctx.fillRect(sX + thickness, topY + thickness, depthRear, fH - 2 * thickness);

      // Cámara Frontal Vf (Derecha)
      ctx.fillStyle = isLight ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.08)';
      ctx.fillRect(divX + thickness, topY + thickness, depthFront, fH - 2 * thickness);

      // Rótulos técnicos de cámaras Vr y Vf con escalonamiento vertical inteligente
      const isNarrowChamber = depthRear < 14 || depthFront < 14;
      const vrY = isNarrowChamber ? (topY + thickness + 2.3) : (topY + thickness + 2.6);
      const vfY = isNarrowChamber ? (topY + thickness + 5.5) : (topY + thickness + 2.6);

      const vrSub = depthRear < 10 
        ? (bandpassOrder === 6 ? t("(Vent.)") : t("(Sell.)"))
        : `(${bandpassOrder === 6 ? t("Ventilada") : t("Sellada")})`;
      const vfSub = depthFront < 10 ? t("(Sint.)") : `(${t("Sintonizada")})`;

      const vrCenterX = sX + thickness + depthRear / 2;
      const vfCenterX = divX + thickness + depthFront / 2;

      // Vr badge
      ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.75)' : 'rgba(7, 16, 30, 0.75)';
      ctx.fillRect(vrCenterX - 2.8, vrY - 0.9, 5.6, 2.7);
      ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
      ctx.font = `bold ${Math.max(7.5 / zoom, 2.0)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`Vr: ${convertTo(bandpassVr || 0, 'volume', unitSystem).toFixed(1)} ${vLabel}`, vrCenterX, vrY);
      ctx.font = `${Math.max(6.5 / zoom, 1.8)}px monospace`;
      ctx.fillText(bandpassFl && bandpassOrder === 6 ? `${vrSub} · ${bandpassFl.toFixed(0)}Hz` : vrSub, vrCenterX, vrY + 1.4);

      // Vf badge
      ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.75)' : 'rgba(7, 16, 30, 0.75)';
      ctx.fillRect(vfCenterX - 2.8, vfY - 0.9, 5.6, 2.7);
      ctx.fillStyle = isLight ? '#059669' : '#10b981';
      ctx.font = `bold ${Math.max(7.5 / zoom, 2.0)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`Vf: ${convertTo(bandpassVf || 0, 'volume', unitSystem).toFixed(1)} ${vLabel}`, vfCenterX, vfY);
      ctx.font = `${Math.max(6.5 / zoom, 1.8)}px monospace`;
      ctx.fillText(bandpassFh && bandpassOrder === 6 ? `${vfSub} · ${bandpassFh.toFixed(0)}Hz` : vfSub, vfCenterX, vfY + 1.4);

      // 2. Tabique Divisor con calado pasante para el Woofer (y puerto interno si es 6.º Orden Serie)
      ctx.strokeStyle = isLight ? '#059669' : '#10b981';
      ctx.lineWidth = 1.1 / zoom;
      const holeTop = wooferCenterY - wooferCutoutRadius;
      const holeBot = wooferCenterY + wooferCutoutRadius;
      if (holeTop > topY + thickness) {
        ctx.strokeRect(divX, topY + thickness, thickness, holeTop - (topY + thickness));
        hatchRect(divX, topY + thickness, thickness, holeTop - (topY + thickness));
      }
      if (botY - thickness > holeBot) {
        ctx.strokeRect(divX, holeBot, thickness, (botY - thickness) - holeBot);
        hatchRect(divX, holeBot, thickness, (botY - thickness) - holeBot);
      }

      if (isBp6Series) {
        const pRInt = (portShape === 'round' || portShape === 'custom')
          ? Math.max((portDiameter || 7.5) / 2, 1.2)
          : Math.max((portHeight || 4) / 2, 1.0);
        // Ubicar puerto interno en zona libre arriba o abajo del woofer
        const spaceBot = (botY - thickness) - holeBot;
        const spaceTop = holeTop - (topY + thickness);
        const intPortY = spaceBot >= spaceTop
          ? Math.min(botY - thickness - pRInt - 0.8, holeBot + pRInt + 1.2)
          : Math.max(topY + thickness + pRInt + 0.8, holeTop - pRInt - 1.2);
        const intLen = Math.min(Math.max(portLength || 10, thickness + 2.5), Math.max(depthFront, depthRear) * 0.75 + thickness);
        const intStartX = divX - Math.min(intLen * 0.45, Math.max(depthRear - 1.2, thickness));
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(divX - 0.05, intPortY - pRInt, thickness + 0.1, pRInt * 2);
        ctx.fillStyle = 'rgba(217, 119, 6, 0.16)';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.2 / zoom;
        ctx.fillRect(intStartX, intPortY - pRInt, intLen, pRInt * 2);
        ctx.strokeRect(intStartX, intPortY - pRInt, intLen, pRInt * 2);
        ctx.font = `bold ${Math.max(6.8 / zoom, 1.8)}px monospace`;
        ctx.fillStyle = '#b45309';
        ctx.textAlign = 'center';
        ctx.fillText(`P1 Int (${bandpassFl ? `${bandpassFl.toFixed(0)}Hz` : 'Fl'})`, intStartX + intLen / 2, intPortY - pRInt - 0.9);
        ctx.restore();
      }

      // 3. Montaje del Woofer en el Tabique
      if (!isDriverInverted) {
        // MONTAJE ESTÁNDAR: Brida en la cara frontal del tabique (divX + thickness)
        // Cono dispara a Vf (+X, derecha), conjunto motor alojado en Vr (-X, izquierda)
        const mountX = divX + thickness;
        drawRealisticWooferProfile(mountX, wooferCenterY, wooferRadius, wooferCutoutRadius, spkDepth, 'right');

        // Despeje trasero en Vr (medido en zona libre superior del imán)
        const rearClear = (mountX - spkDepth) - (sX + thickness);
        if (rearClear > 0) {
          const clearY = wooferCenterY - wooferRadius * 0.55;
          drawDimension(sX + thickness, clearY, mountX - spkDepth, clearY, `Despeje: ${convertTo(rearClear, 'length', unitSystem).toFixed(1)}`, -1.6, true);
        }
      } else {
        // MONTAJE INVERTIDO (Sólo cuando Vf es significativamente más profunda que Vr)
        // Brida en cara trasera del tabique (divX). Cono hacia Vr (-X), motor hacia Vf (+X)
        const mountX = divX;
        drawRealisticWooferProfile(mountX, wooferCenterY, wooferRadius, wooferCutoutRadius, spkDepth, 'left');

        const frontClear = baffleX - (mountX + spkDepth);
        if (frontClear > 0) {
          const clearY = wooferCenterY - wooferRadius * 0.55;
          drawDimension(mountX + spkDepth, clearY, baffleX, clearY, `Despeje Vf: ${convertTo(frontClear, 'length', unitSystem).toFixed(1)}`, -1.6, true);
        }

        ctx.font = `bold ${Math.max(7.5 / zoom, 2.0)}px monospace`;
        ctx.fillStyle = isLight ? '#d97706' : '#fbbf24';
        ctx.textAlign = 'center';
        ctx.fillText(t("[Montaje Invertido: Motor en Vf para refrigeración y despeje]"), sX + sW / 2, botY - thickness - 1.2);
      }
    }

    // Port Tube Side Profile (or Passive Radiator profile)
    if (isPassiveRadiator) {
      const prR = Math.min(Math.max((prDia || 20) / 2, 3.0), innerH * 0.36);
      const prMountY = isRearPort ? (topY + fH * 0.5) : portCenterY;
      const mountX = isRearPort ? sX : frontInnerXAtY(prMountY);
      const dir = isRearPort ? -1 : 1; // hacia afuera
      ctx.save();
      // Despejar calado de madera
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(isRearPort ? sX - 0.05 : mountX - 0.05, prMountY - prR * 0.88, thickness + 0.1, prR * 1.76);
      // Brida del radiador pasivo
      ctx.fillStyle = 'rgba(124, 58, 237, 0.22)';
      ctx.strokeStyle = '#6d28d9';
      ctx.lineWidth = 1.2 / zoom;
      const flangeX = isRearPort ? sX - 0.45 : mountX + thickness;
      ctx.fillRect(flangeX, prMountY - prR, 0.45, prR * 2);
      ctx.strokeRect(flangeX, prMountY - prR, 0.45, prR * 2);
      // Cono plano/cónico sin imán + disco de masa central
      const apexX = flangeX - dir * Math.min(prR * 0.25, 2.2);
      ctx.beginPath();
      ctx.moveTo(flangeX, prMountY - prR * 0.82);
      ctx.lineTo(apexX, prMountY - prR * 0.28);
      ctx.lineTo(apexX, prMountY + prR * 0.28);
      ctx.lineTo(flangeX, prMountY + prR * 0.82);
      ctx.stroke();
      // Disco de masa añadida
      ctx.fillStyle = '#5b21b6';
      ctx.fillRect(apexX - 0.35, prMountY - prR * 0.28, 0.7, prR * 0.56);
      ctx.restore();
    } else if (boxType === 'ported' || boxType === 'bandpass') {
      const pLen = Math.max(portLength || 15, thickness + 1);
      const maxStraightDepth = isBandpass 
        ? Math.max(depthFront + thickness - 1.2, thickness + 2.0)
        : (sW - thickness - 2);
      const effectivePortLen = Math.min(pLen, maxStraightDepth);
      const pR = (portShape === 'round' || portShape === 'custom')
        ? Math.max((portDiameter || 7.5) / 2, 1.2)
        : Math.max((portHeight || 4) / 2, 1.0);

      const pTop = portCenterY - pR;
      const pBot = portCenterY + pR;
      const portBaffleX = frontInnerXAtY(portCenterY);

      // Clear wood hatching inside the port wall cutout (rear panel)
      if (isRearPort && !isBandpass) {
        ctx.fillStyle = isLight ? '#ffffff' : '#07101e';
        ctx.fillRect(sX, pTop, thickness, pBot - pTop);
      }
      if (isBp6 && !isBp6Series) {
        // Puerto trasero de cámara Vr en Paso Banda 6.º Orden Paralelo
        const rearLen = Math.min(Math.max(portLength || 12, thickness + 2), Math.max(depthRear + thickness - 1.2, thickness + 2));
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sX - 0.05, pTop, thickness + 0.1, pBot - pTop);
        ctx.fillStyle = 'rgba(2, 132, 199, 0.12)';
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.2 / zoom;
        ctx.fillRect(sX, pTop, rearLen, pBot - pTop);
        ctx.strokeRect(sX, pTop, rearLen, pBot - pTop);
        ctx.font = `bold ${Math.max(6.8 / zoom, 1.8)}px monospace`;
        ctx.fillStyle = '#0369a1';
        ctx.textAlign = 'center';
        ctx.fillText(`P1 Ext (${bandpassFl ? `${bandpassFl.toFixed(0)}Hz` : 'Fl'})`, sX + rearLen / 2, pTop - 0.9);
        ctx.restore();
      }

      ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
      ctx.lineWidth = 1.2 / zoom;
      ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(2, 132, 199, 0.12)';

      const flangeLip = Math.min(Math.max(pR * 0.42, 0.75), 1.45);
      const flareR = Math.min(Math.max(pR * 0.48, 0.85), Math.min(1.65, effectivePortLen * 0.28));

      if (isRearPort && !isBandpass) {
        // Port mounted on Rear Panel (left wall) extending rightwards into cavity (total length from outer face)
        const outerX = sX;
        const innerX = outerX + effectivePortLen;

        if (flaredEnds === 0) {
          // 0: Recto / Estándar (1 extremo a ras en el bafle, 1 extremo libre recto dentro de la caja)
          ctx.fillRect(outerX, pTop, effectivePortLen, pBot - pTop);

          ctx.beginPath();
          ctx.moveTo(outerX, pTop);
          ctx.lineTo(innerX, pTop);
          ctx.moveTo(outerX, pBot);
          ctx.lineTo(innerX, pBot);
          // Straight vertical cut line at the free inner end
          ctx.moveTo(innerX, pTop);
          ctx.lineTo(innerX, pTop + Math.min(pR * 0.35, 0.6));
          ctx.moveTo(innerX, pBot);
          ctx.lineTo(innerX, pBot - Math.min(pR * 0.35, 0.6));
          ctx.stroke();
        } else if (flaredEnds === 1) {
          // 1: Dos a Ras (Ambos extremos adosados / con brida plana a 90°)
          ctx.fillRect(outerX, pTop, effectivePortLen, pBot - pTop);

          ctx.beginPath();
          ctx.moveTo(outerX, pTop);
          ctx.lineTo(innerX, pTop);
          ctx.moveTo(outerX, pBot);
          ctx.lineTo(innerX, pBot);
          ctx.stroke();

          // Flat perpendicular flange lips (T-collar) at BOTH outer and inner ends
          const fThick = Math.min(0.35, thickness * 0.25);
          ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.22)' : 'rgba(56, 189, 248, 0.25)';
          // Outer flange (flush against rear exterior)
          ctx.fillRect(outerX - fThick, pTop - flangeLip, fThick, flangeLip);
          ctx.strokeRect(outerX - fThick, pTop - flangeLip, fThick, flangeLip);
          ctx.fillRect(outerX - fThick, pBot, fThick, flangeLip);
          ctx.strokeRect(outerX - fThick, pBot, fThick, flangeLip);
          // Inner flange (flush baffle/plate at inner end)
          ctx.fillRect(innerX - fThick, pTop - flangeLip, fThick, flangeLip);
          ctx.strokeRect(innerX - fThick, pTop - flangeLip, fThick, flangeLip);
          ctx.fillRect(innerX - fThick, pBot, fThick, flangeLip);
          ctx.strokeRect(innerX - fThick, pBot, fThick, flangeLip);
        } else if (flaredEnds === 3) {
          // 3: Abocinado 1 Extremo — Trumpet curve ONLY on outer mouth, straight cut on inner end
          ctx.beginPath();
          ctx.moveTo(outerX, pTop - flareR);
          ctx.quadraticCurveTo(outerX, pTop, outerX + flareR, pTop);
          ctx.lineTo(innerX, pTop);
          ctx.lineTo(innerX, pBot);
          ctx.lineTo(outerX + flareR, pBot);
          ctx.quadraticCurveTo(outerX, pBot, outerX, pBot + flareR);
          ctx.closePath();
          ctx.fill();

          // Top wall (flared outside, straight inside)
          ctx.beginPath();
          ctx.moveTo(outerX, pTop - flareR);
          ctx.quadraticCurveTo(outerX, pTop, outerX + flareR, pTop);
          ctx.lineTo(innerX, pTop);
          ctx.lineTo(innerX, pTop + Math.min(pR * 0.35, 0.6));
          ctx.stroke();

          // Bottom wall (flared outside, straight inside)
          ctx.beginPath();
          ctx.moveTo(outerX, pBot + flareR);
          ctx.quadraticCurveTo(outerX, pBot, outerX + flareR, pBot);
          ctx.lineTo(innerX, pBot);
          ctx.lineTo(innerX, pBot - Math.min(pR * 0.35, 0.6));
          ctx.stroke();
        } else {
          // 2: Abocinado 2 Extremos (Aeroport / Flared) — Trumpet curves at BOTH outer and inner mouths
          ctx.beginPath();
          ctx.moveTo(outerX, pTop - flareR);
          ctx.quadraticCurveTo(outerX, pTop, outerX + flareR, pTop);
          ctx.lineTo(innerX - flareR, pTop);
          ctx.quadraticCurveTo(innerX, pTop, innerX, pTop - flareR);
          ctx.lineTo(innerX, pBot + flareR);
          ctx.quadraticCurveTo(innerX, pBot, innerX - flareR, pBot);
          ctx.lineTo(outerX + flareR, pBot);
          ctx.quadraticCurveTo(outerX, pBot, outerX, pBot + flareR);
          ctx.closePath();
          ctx.fill();

          // Draw top flared wall
          ctx.beginPath();
          ctx.moveTo(outerX, pTop - flareR);
          ctx.quadraticCurveTo(outerX, pTop, outerX + flareR, pTop);
          ctx.lineTo(innerX - flareR, pTop);
          ctx.quadraticCurveTo(innerX, pTop, innerX, pTop - flareR);
          ctx.stroke();

          // Draw bottom flared wall
          ctx.beginPath();
          ctx.moveTo(outerX, pBot + flareR);
          ctx.quadraticCurveTo(outerX, pBot, outerX + flareR, pBot);
          ctx.lineTo(innerX - flareR, pBot);
          ctx.quadraticCurveTo(innerX, pBot, innerX, pBot + flareR);
          ctx.stroke();
        }

        // Port Dimension (total length from outer face)
        const pLenDisp = `Lv: ${convertTo(effectivePortLen, 'length', unitSystem).toFixed(1)} ${uLabel}`;
        drawDimension(outerX, pTop - 1, innerX, pTop - 1, pLenDisp, -1.8, true);
      } else {
        // Port mounted on Front Baffle (right wall) extending inwards perpendicular to baffle (total length from outer face)
        ctx.save();
        ctx.translate(portBaffleX, portCenterY);
        ctx.rotate(baffleAngle);

        // Clear wood hatching inside the port wall cutout
        ctx.fillStyle = isLight ? '#ffffff' : '#07101e';
        ctx.fillRect(-0.1, -pR, thickness + 0.2, pR * 2);

        ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
        ctx.lineWidth = 1.2 / zoom;
        ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(2, 132, 199, 0.12)';

        const outerX = thickness;
        const innerX = outerX - effectivePortLen;
        const pT = -pR;
        const pB = pR;

        if (flaredEnds === 0) {
          // 0: Recto / Estándar (1 extremo a ras en el bafle, 1 extremo libre recto dentro de la caja)
          ctx.fillRect(innerX, pT, effectivePortLen, pB - pT);

          ctx.beginPath();
          ctx.moveTo(outerX, pT);
          ctx.lineTo(innerX, pT);
          ctx.moveTo(outerX, pB);
          ctx.lineTo(innerX, pB);
          ctx.moveTo(innerX, pT);
          ctx.lineTo(innerX, pT + Math.min(pR * 0.35, 0.6));
          ctx.moveTo(innerX, pB);
          ctx.lineTo(innerX, pB - Math.min(pR * 0.35, 0.6));
          ctx.stroke();
        } else if (flaredEnds === 1) {
          // 1: Dos a Ras (Ambos extremos adosados / con brida plana a 90°)
          ctx.fillRect(innerX, pT, effectivePortLen, pB - pT);

          ctx.beginPath();
          ctx.moveTo(outerX, pT);
          ctx.lineTo(innerX, pT);
          ctx.moveTo(outerX, pB);
          ctx.lineTo(innerX, pB);
          ctx.stroke();

          const fThick = Math.min(0.35, thickness * 0.25);
          ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.22)' : 'rgba(56, 189, 248, 0.25)';
          ctx.fillRect(outerX, pT - flangeLip, fThick, flangeLip);
          ctx.strokeRect(outerX, pT - flangeLip, fThick, flangeLip);
          ctx.fillRect(outerX, pB, fThick, flangeLip);
          ctx.strokeRect(outerX, pB, fThick, flangeLip);
          ctx.fillRect(innerX, pT - flangeLip, fThick, flangeLip);
          ctx.strokeRect(innerX, pT - flangeLip, fThick, flangeLip);
          ctx.fillRect(innerX, pB, fThick, flangeLip);
          ctx.strokeRect(innerX, pB, fThick, flangeLip);
        } else if (flaredEnds === 3) {
          // 3: Abocinado 1 Extremo — Trumpet curve ONLY on outer mouth, straight cut on inner end
          ctx.beginPath();
          ctx.moveTo(outerX, pT - flareR);
          ctx.quadraticCurveTo(outerX, pT, outerX - flareR, pT);
          ctx.lineTo(innerX, pT);
          ctx.lineTo(innerX, pB);
          ctx.lineTo(outerX - flareR, pB);
          ctx.quadraticCurveTo(outerX, pB, outerX, pB + flareR);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(outerX, pT - flareR);
          ctx.quadraticCurveTo(outerX, pT, outerX - flareR, pT);
          ctx.lineTo(innerX, pT);
          ctx.lineTo(innerX, pT + Math.min(pR * 0.35, 0.6));
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(outerX, pB + flareR);
          ctx.quadraticCurveTo(outerX, pB, outerX - flareR, pB);
          ctx.lineTo(innerX, pB);
          ctx.lineTo(innerX, pB - Math.min(pR * 0.35, 0.6));
          ctx.stroke();
        } else {
          // 2: Abocinado 2 Extremos (Aeroport / Flared) — Trumpet curves at BOTH outer and inner mouths
          ctx.beginPath();
          ctx.moveTo(outerX, pT - flareR);
          ctx.quadraticCurveTo(outerX, pT, outerX - flareR, pT);
          ctx.lineTo(innerX + flareR, pT);
          ctx.quadraticCurveTo(innerX, pT, innerX, pT - flareR);
          ctx.lineTo(innerX, pB + flareR);
          ctx.quadraticCurveTo(innerX, pB, innerX + flareR, pB);
          ctx.lineTo(outerX - flareR, pB);
          ctx.quadraticCurveTo(outerX, pB, outerX, pB + flareR);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(outerX, pT - flareR);
          ctx.quadraticCurveTo(outerX, pT, outerX - flareR, pT);
          ctx.lineTo(innerX + flareR, pT);
          ctx.quadraticCurveTo(innerX, pT, innerX, pT - flareR);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(outerX, pB + flareR);
          ctx.quadraticCurveTo(outerX, pB, outerX - flareR, pB);
          ctx.lineTo(innerX + flareR, pB);
          ctx.quadraticCurveTo(innerX, pB, innerX, pB + flareR);
          ctx.stroke();
        }
        ctx.restore();

        // Port Dimension (total length from outer face)
        const pLenDisp = (isBandpass && pLen > maxStraightDepth)
          ? `Lv: ${convertTo(pLen, 'length', unitSystem).toFixed(1)} ${uLabel} (Codo)`
          : `Lv: ${convertTo(effectivePortLen, 'length', unitSystem).toFixed(1)} ${uLabel}`;
        const dimStartX = portBaffleX + thickness * Math.cos(baffleAngle);
        const dimEndX = portBaffleX - (effectivePortLen - thickness) * Math.cos(baffleAngle);
        drawDimension(Math.min(dimEndX, dimStartX), pTop - 1, Math.max(dimEndX, dimStartX), pTop - 1, pLenDisp, -1.8, true);
      }
    }

    // Damping Acoustic Lining Layer (Revestimiento acústico en pared trasera, superior e inferior)
    if (dampingType !== 'none') {
      const dLining = dampingType === 'light' ? 1.4 : dampingType === 'moderate' ? 2.2 : 3.0;
      ctx.save();
      ctx.fillStyle = isLight ? 'rgba(5, 150, 105, 0.12)' : 'rgba(16, 185, 129, 0.15)';
      ctx.strokeStyle = isLight ? 'rgba(5, 150, 105, 0.55)' : 'rgba(16, 185, 129, 0.5)';
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([0.8 / zoom, 0.6 / zoom]);

      // Longitud del revestimiento superior e inferior (en paso banda recubre la cámara trasera Vr)
      const liningLenTop = isBandpass ? depthRear : Math.max(0, sWTop - 2 * thickness);
      const liningLenBot = isBandpass ? depthRear : Math.max(0, sWBot - 2 * thickness);

      // 1. Revestimiento de pared trasera
      ctx.fillRect(sX + thickness, topY + thickness + dLining, dLining, fH - 2 * thickness - 2 * dLining);
      ctx.strokeRect(sX + thickness, topY + thickness + dLining, dLining, fH - 2 * thickness - 2 * dLining);

      // 2. Revestimiento de techo interior
      ctx.fillRect(sX + thickness, topY + thickness, liningLenTop, dLining);
      ctx.strokeRect(sX + thickness, topY + thickness, liningLenTop, dLining);

      // 3. Revestimiento de piso interior
      ctx.fillRect(sX + thickness, botY - thickness - dLining, liningLenBot, dLining);
      ctx.strokeRect(sX + thickness, botY - thickness - dLining, liningLenBot, dLining);

      ctx.restore();
    }

    // Side View Dimension Lines
    if (shape === 'trapezoidal') {
      const dTopDisp = `Sup: ${convertTo(sWTop, 'length', unitSystem).toFixed(1)} ${uLabel}`;
      drawDimension(sX, topY, sX + sWTop, topY, dTopDisp, -3.5, true);

      const dBotDisp = `Inf: ${convertTo(sWBot, 'length', unitSystem).toFixed(1)} ${uLabel}`;
      drawDimension(sX, botY, sX + sWBot, botY, dBotDisp, 3.5, true);
    } else {
      const dDisp = `${convertTo(sW, 'length', unitSystem).toFixed(1)} ${uLabel}`;
      const totalDepthOffset = isBandpass ? 4.2 : 3.5;
      drawDimension(sX, botY, sX + sW, botY, dDisp, totalDepthOffset, true);
    }

    // Cotas de profundidad de cámaras acústicas en Paso Banda
    if (isBandpass) {
      drawDimension(sX + thickness, botY, divX, botY, `${convertTo(depthRear, 'length', unitSystem).toFixed(1)}`, 1.6, true);
      drawDimension(divX + thickness, botY, baffleX, botY, `${convertTo(depthFront, 'length', unitSystem).toFixed(1)}`, 1.6, true);
    }

    // Rótulo técnico del espesor del panel (T) insertado con fondo despejado en la tapa superior
    ctx.save();
    const tBadgeW = 5.2;
    const tBadgeH = Math.min(thickness * 0.85, 1.4);
    const tCenterX = sX + (shape === 'trapezoidal' ? sWTop : sW) / 2;
    const tCenterY = topY + thickness / 2;
    ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(7, 16, 30, 0.85)';
    ctx.fillRect(tCenterX - tBadgeW / 2, tCenterY - tBadgeH / 2, tBadgeW, tBadgeH);
    ctx.strokeStyle = isLight ? 'rgba(2, 132, 199, 0.4)' : 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 0.8 / zoom;
    ctx.strokeRect(tCenterX - tBadgeW / 2, tCenterY - tBadgeH / 2, tBadgeW, tBadgeH);
    ctx.fillStyle = isLight ? '#0369a1' : '#38bdf8';
    ctx.font = `bold ${Math.max(7.0 / zoom, 1.9)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Espesor: ${convertTo(cabinetData?.thickness || 19, 'length_small', unitSystem).toFixed(unitSystem === 'imperial' ? 2 : 1)} ${getUnitLabel('length_small', unitSystem)}`, tCenterX, tCenterY);
    ctx.restore();

    // Magnet Clearance to Rear Wall (en cajas tradicionales direct-radiator)
    if (!isBandpass) {
      const rearClearance = (baffleX - spkDepth) - (sX + thickness);
      if (rearClearance > 0) {
        const clearDisp = `Despeje: ${convertTo(rearClearance, 'length', unitSystem).toFixed(1)}`;
        drawDimension(sX + thickness, wooferCenterY, baffleX - spkDepth, wooferCenterY, clearDisp, -wooferRadius * 0.4, true);
      }
    }

    // ----------------------------------------------------
    // C. HIGHLIGHT HOVERED CUT-PIECE (from cut list)
    // ----------------------------------------------------
    if (hoveredPieceIndex !== null && hoveredPieceIndex !== undefined) {
      ctx.save();
      ctx.fillStyle = isLight ? 'rgba(16, 185, 129, 0.28)' : 'rgba(16, 185, 129, 0.40)';
      ctx.strokeStyle = isLight ? '#059669' : '#10b981';
      ctx.lineWidth = 2.5 / zoom;

      if (shape === 'rectangular') {
        // En cajas rectangulares:
        // 0: Caras Laterales (Izquierda y Derecha)
        // 1: Tapas (Superior e Inferior)
        // 2: Caras (Frontal y Trasera)
        // 3: Divisor Interno (Paso Banda)
        if (hoveredPieceIndex === 0) {
          // Vista lateral (representa el panel lateral)
          ctx.fillRect(sX, topY, sW, fH);
          ctx.strokeRect(sX, topY, sW, fH);
          // Vista frontal (paredes laterales izquierda y derecha)
          ctx.fillRect(fX, topY, thickness, fH);
          ctx.strokeRect(fX, topY, thickness, fH);
          ctx.fillRect(fX + fW - thickness, topY, thickness, fH);
          ctx.strokeRect(fX + fW - thickness, topY, thickness, fH);
        } else if (hoveredPieceIndex === 1) {
          // Tapas (Superior e Inferior)
          // Vista frontal
          ctx.fillRect(fX + thickness, topY, fW - 2 * thickness, thickness);
          ctx.strokeRect(fX + thickness, topY, fW - 2 * thickness, thickness);
          ctx.fillRect(fX + thickness, botY - thickness, fW - 2 * thickness, thickness);
          ctx.strokeRect(fX + thickness, botY - thickness, fW - 2 * thickness, thickness);
          // Sección de corte lateral
          ctx.fillRect(sX, topY, sW, thickness);
          ctx.strokeRect(sX, topY, sW, thickness);
          ctx.fillRect(sX, botY - thickness, sW, thickness);
          ctx.strokeRect(sX, botY - thickness, sW, thickness);
        } else if (hoveredPieceIndex === 2) {
          // Caras (Frontal y Trasera)
          // Vista frontal (bafle frontal)
          ctx.fillRect(fX + thickness, topY + thickness, fW - 2 * thickness, fH - 2 * thickness);
          ctx.strokeRect(fX + thickness, topY + thickness, fW - 2 * thickness, fH - 2 * thickness);
          // Sección corte lateral: Pared Trasera + Bafle Frontal
          ctx.fillRect(sX, topY + thickness, thickness, fH - 2 * thickness);
          ctx.strokeRect(sX, topY + thickness, thickness, fH - 2 * thickness);
          ctx.fillRect(baffleX, topY + thickness, thickness, fH - 2 * thickness);
          ctx.strokeRect(baffleX, topY + thickness, thickness, fH - 2 * thickness);
        } else if (hoveredPieceIndex === 3 && isBandpass) {
          // Divisor Interno (Bafle de Montaje en Paso Banda)
          ctx.fillRect(divX, topY + thickness, thickness, fH - 2 * thickness);
          ctx.strokeRect(divX, topY + thickness, thickness, fH - 2 * thickness);
          ctx.fillRect(fX + thickness, topY + thickness, fW - 2 * thickness, fH - 2 * thickness);
          ctx.strokeRect(fX + thickness, topY + thickness, fW - 2 * thickness, fH - 2 * thickness);
        }
      } else {
        // En cajas trapezoidales:
        // 0: Caras Laterales (Trapecios Inclinados)
        // 1: Tapa Superior
        // 2: Tapa Inferior
        // 3: Cara Trasera (Recta)
        // 4: Cara Frontal (Inclinada - Bafle)
        // 5: Divisor Interno (Paso Banda)
        if (hoveredPieceIndex === 0) {
          ctx.fillRect(sX, topY, sW, fH);
          ctx.strokeRect(sX, topY, sW, fH);
          ctx.fillRect(fX, topY, thickness, fH);
          ctx.strokeRect(fX, topY, thickness, fH);
          ctx.fillRect(fX + fW - thickness, topY, thickness, fH);
          ctx.strokeRect(fX + fW - thickness, topY, thickness, fH);
        } else if (hoveredPieceIndex === 1) {
          ctx.fillRect(fX + thickness, topY, fW - 2 * thickness, thickness);
          ctx.strokeRect(fX + thickness, topY, fW - 2 * thickness, thickness);
          ctx.fillRect(sX, topY, sWTop, thickness);
          ctx.strokeRect(sX, topY, sWTop, thickness);
        } else if (hoveredPieceIndex === 2) {
          ctx.fillRect(fX + thickness, botY - thickness, fW - 2 * thickness, thickness);
          ctx.strokeRect(fX + thickness, botY - thickness, fW - 2 * thickness, thickness);
          ctx.fillRect(sX, botY - thickness, sWBot, thickness);
          ctx.strokeRect(sX, botY - thickness, sWBot, thickness);
        } else if (hoveredPieceIndex === 3) {
          ctx.fillRect(sX, topY + thickness, thickness, fH - 2 * thickness);
          ctx.strokeRect(sX, topY + thickness, thickness, fH - 2 * thickness);
        } else if (hoveredPieceIndex === 4) {
          ctx.fillRect(fX + thickness, topY + thickness, fW - 2 * thickness, fH - 2 * thickness);
          ctx.strokeRect(fX + thickness, topY + thickness, fW - 2 * thickness, fH - 2 * thickness);
          ctx.beginPath();
          ctx.moveTo(bTopIn, baffleTopY);
          ctx.lineTo(bTopOut, baffleTopY);
          ctx.lineTo(bBotOut, baffleBotY);
          ctx.lineTo(bBotIn, baffleBotY);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (hoveredPieceIndex === 5 && isBandpass) {
          ctx.fillRect(divX, topY + thickness, thickness, fH - 2 * thickness);
          ctx.strokeRect(divX, topY + thickness, thickness, fH - 2 * thickness);
        }
      }
      ctx.restore();
    }

    ctx.restore(); // Restore world coords

    // Marco de hoja TechDraw + Cajetín Técnico (FreeCAD style)
    ctx.save();
    const framePad = 8;
    ctx.strokeStyle = isLight ? '#94a3b8' : '#1e3a5f';
    ctx.lineWidth = 1;
    ctx.strokeRect(framePad, framePad, width - framePad * 2, height - framePad * 2);

    const tbW = 196;
    const tbH = 44;
    const tbX = width - framePad - tbW;
    const tbY = height - framePad - tbH;
    if (width > 360 && height > 180) {
      ctx.fillStyle = isLight ? 'rgba(248, 250, 252, 0.94)' : 'rgba(6, 15, 29, 0.92)';
      ctx.fillRect(tbX, tbY, tbW, tbH);
      ctx.strokeStyle = isLight ? '#64748b' : '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(tbX, tbY, tbW, tbH);
      ctx.beginPath();
      ctx.moveTo(tbX, tbY + 16);
      ctx.lineTo(tbX + tbW, tbY + 16);
      ctx.moveTo(tbX + 104, tbY + 16);
      ctx.lineTo(tbX + 104, tbY + tbH);
      ctx.stroke();

      ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('ACOUSTICLAB · TECHDRAW 2D', tbX + 6, tbY + 8);

      ctx.fillStyle = isLight ? '#334155' : '#cbd5e1';
      ctx.font = '9px monospace';
      const uLen = getUnitLabel('length', unitSystem);
      const vNet = cabinetData?.vNeto ? `${convertTo(cabinetData.vNeto, 'volume', unitSystem).toFixed(1)} ${getUnitLabel('volume', unitSystem)}` : '--';
      ctx.fillText(`Vb: ${vNet}`, tbX + 6, tbY + 25);
      ctx.fillText(`T: ${convertTo(thickness, 'length', unitSystem).toFixed(1)} ${uLen}`, tbX + 6, tbY + 37);
      ctx.fillText(`ESC: ${(zoom / 4).toFixed(2)}x`, tbX + 110, tbY + 25);
      ctx.fillText(`TIPO: ${boxType.toUpperCase()}`, tbX + 110, tbY + 37);
    }
    ctx.restore();

    ctx.restore(); // Restore DPR
  }, [
    isLight,
    zoom,
    pan,
    showGrid,
    showDimensions,
    wExt,
    hExt,
    dExt,
    thickness,
    shape,
    boxType,
    portShape,
    portDiameter,
    portWidth,
    portHeight,
    portLength,
    effectivePortCount,
    flaredEnds,
    speakerYPct,
    tweeterYPct,
    midrangeYPct,
    crossoverWays,
    midSealed,
    overallDiameter,
    baffleCutout,
    driverDepth,
    portYPct,
    portSpacingPct,
    portLocation,
    bandpassRatio,
    dampingType,
    enableBracing,
    bracingCount,
    hoveredPieceIndex,
    cabinetData,
    unitSystem,
    uLabel,
    dTrapTop,
    dTrapBot,
    containerWidth,
    canvasHeight,
    isBandpass,
    bandpassOrder,
    bandpassTopology,
    bandpassFl,
    bandpassFh,
    bandpassVf,
    bandpassVr,
    activeHpEnabled,
    hpFx,
    hpQx,
    prTuning,
    prDia,
    prFbNatural,
    prMasaAnadidaG,
    t,
    trapAngleDeg,
    vLabel,
    wRearExt,
  ]);

  // Export CAD PNG
  const handleExportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `plano_cad_2d_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: isLight ? '#ffffff' : '#07101e',
        border: `1px solid ${isLight ? '#cbd5e1' : '#1e3a5f'}`,
        borderRadius: '0px',
        overflow: 'hidden',
        boxSizing: 'border-box',
        boxShadow: isLight ? '0 4px 16px rgba(0, 0, 0, 0.06)' : 'none',
      }}
    >
      {/* CAD Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 0.85rem',
          background: isLight ? 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)' : 'linear-gradient(90deg, #091528 0%, #0d1e38 100%)',
          borderBottom: `1px solid ${isLight ? '#cbd5e1' : '#1e3a5f'}`,
          userSelect: 'none',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        {/* Left: Title & Mode */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '0.65rem',
              fontWeight: 700,
              background: '#0369a1',
              color: '#ffffff',
              padding: '0.2rem 0.5rem',
              borderRadius: '0px',
            }}
          >
            CAD 2D
          </span>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isLight ? '#0f172a' : '#f1f5f9', letterSpacing: '0.02em' }}>
            {t("Plano de Fabricación y Sección de Corte")}
          </span>
        </div>

        {/* Right: Controls & Prominent 3D Modal Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          {/* Zoom controls */}
          <button
            onClick={() => setZoom((z) => Math.min(z * 1.2, 18))}
            title={t("Acercar")}
            style={{
              background: isLight ? '#ffffff' : '#0f172a',
              border: `1px solid ${isLight ? '#cbd5e1' : '#1e293b'}`,
              color: isLight ? '#334155' : '#94a3b8',
              padding: '0.25rem 0.55rem',
              borderRadius: '0px',
              fontSize: '0.72rem',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            +
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z * 0.82, 0.5))}
            title={t("Alejar")}
            style={{
              background: isLight ? '#ffffff' : '#0f172a',
              border: `1px solid ${isLight ? '#cbd5e1' : '#1e293b'}`,
              color: isLight ? '#334155' : '#94a3b8',
              padding: '0.25rem 0.55rem',
              borderRadius: '0px',
              fontSize: '0.72rem',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            -
          </button>
          <button
            onClick={handleFitView}
            title={t("Ajustar al lienzo")}
            style={{
              background: isLight ? '#ffffff' : '#0f172a',
              border: `1px solid ${isLight ? '#cbd5e1' : '#1e293b'}`,
              color: isLight ? '#334155' : '#94a3b8',
              padding: '0.25rem 0.55rem',
              borderRadius: '0px',
              fontSize: '0.68rem',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            {t("Ajustar")}
          </button>

          {/* Grid Toggle */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            style={{
              background: showGrid 
                ? (isLight ? 'rgba(2, 132, 199, 0.12)' : 'rgba(2, 132, 199, 0.2)') 
                : (isLight ? '#ffffff' : '#0f172a'),
              border: `1px solid ${showGrid ? '#0284c7' : (isLight ? '#cbd5e1' : '#1e293b')}`,
              color: showGrid ? '#0284c7' : (isLight ? '#64748b' : '#64748b'),
              padding: '0.25rem 0.55rem',
              borderRadius: '0px',
              fontSize: '0.65rem',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            REJILLA
          </button>

          {/* Dimensions Toggle */}
          <button
            onClick={() => setShowDimensions(!showDimensions)}
            style={{
              background: showDimensions 
                ? (isLight ? 'rgba(5, 150, 105, 0.12)' : 'rgba(16, 185, 129, 0.2)') 
                : (isLight ? '#ffffff' : '#0f172a'),
              border: `1px solid ${showDimensions ? (isLight ? '#059669' : '#10b981') : (isLight ? '#cbd5e1' : '#1e293b')}`,
              color: showDimensions ? (isLight ? '#059669' : '#10b981') : (isLight ? '#64748b' : '#64748b'),
              padding: '0.25rem 0.55rem',
              borderRadius: '0px',
              fontSize: '0.65rem',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            COTAS
          </button>

          {/* Export PNG */}
          <button
            onClick={handleExportPng}
            style={{
              background: isLight ? '#ffffff' : '#0f172a',
              border: `1px solid ${isLight ? '#cbd5e1' : '#1e293b'}`,
              color: isLight ? '#334155' : '#94a3b8',
              padding: '0.25rem 0.55rem',
              borderRadius: '0px',
              fontSize: '0.65rem',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            PNG
          </button>

          {/* PROMINENT 3D MODAL TRIGGER BUTTON */}
          <button
            onClick={onOpen3DModal}
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: '1px solid #38bdf8',
              color: '#ffffff',
              padding: '0.25rem 0.75rem',
              borderRadius: '0px',
              fontSize: '0.68rem',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'monospace',
              letterSpacing: '0.04em',
              boxShadow: '0 0 15px rgba(2, 132, 199, 0.4)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 22px rgba(56, 189, 248, 0.7)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 0 15px rgba(2, 132, 199, 0.4)';
              e.currentTarget.style.transform = 'translateY(0px)';
            }}
          >
            VISOR 3D
          </button>
        </div>
      </div>

      {/* Interactive Canvas Area */}
      <div style={{ position: 'relative', width: '100%', height: `${canvasHeight}px`, overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{
            display: 'block',
            cursor: isDragging ? 'grabbing' : 'crosshair',
          }}
        />

        {/* Dynamic Cursor HUD */}
        {cursorMm && (
          <div
            style={{
              position: 'absolute',
              bottom: '0.5rem',
              left: '0.75rem',
              background: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(7, 16, 30, 0.85)',
              border: `1px solid ${isLight ? '#cbd5e1' : '#1e3a5f'}`,
              borderRadius: '0px',
              padding: '0.2rem 0.5rem',
              fontSize: '0.65rem',
              fontFamily: 'monospace',
              color: isLight ? '#0369a1' : '#38bdf8',
              pointerEvents: 'none',
              backdropFilter: 'blur(4px)',
            }}
          >
            X: {cursorMm.x} mm | Y: {cursorMm.y} mm | ZOOM: {(zoom * 10).toFixed(0)}%
          </div>
        )}

        {/* Bottom-right Tip */}
        <div
          style={{
            position: 'absolute',
            bottom: '0.5rem',
            right: '0.75rem',
            fontSize: '0.62rem',
            color: '#64748b',
            fontFamily: 'monospace',
            pointerEvents: 'none',
          }}
        >
          {t("Arrastra para mover | Rueda para zoom")}
        </div>
      </div>

      {/* Vertical Resize Handle */}
      <div
        className="cad-vertical-resizer"
        onMouseDown={handleVerticalResizeStart}
        title={t("Arrastra hacia abajo o arriba para redimensionar")}
      >
        <span />
      </div>
    </div>
  );
};
