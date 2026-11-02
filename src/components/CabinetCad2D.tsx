import React, { useRef, useEffect, useState, useCallback } from 'react';
import { type Lang, translate } from '../utils/translations';
import { type UnitSystem, convertTo, getUnitLabel } from '../utils/units';
import type { WoodCabinetData } from '../types';

interface CabinetCad2DProps {
  theme?: 'dark' | 'light';
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
  portLocation?: 'front' | 'rear';
  bandpassOrder?: 4 | 6;
  bandpassRatio?: number;
  bandpassVf?: number;
  bandpassVr?: number;
  dampingType?: 'none' | 'light' | 'moderate' | 'heavy';
  onOpen3DModal: () => void;
}

export const CabinetCad2D: React.FC<CabinetCad2DProps> = ({
  theme = 'dark',
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
  portLocation = 'front',
  bandpassOrder = 4,
  bandpassRatio = 0.5,
  bandpassVf,
  bandpassVr,
  dampingType = 'none',
  onOpen3DModal,
}) => {
  const t = (text: string) => translate(text, lang);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Active theme detection (reacts to prop and documentElement attribute)
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
  const wExt = cabinetData?.wExt || 35;
  const hExt = cabinetData?.hExt || 50;
  const dExt = shape === 'rectangular' 
    ? (cabinetData?.dExt || 30) 
    : Math.max(cabinetData?.dTrapTopExt || 20, cabinetData?.dTrapBotExt || 35);
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

    const width = containerRef.current.clientWidth || 800;
    const height = 440;
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

      // Fine Grid
      ctx.strokeStyle = isLight ? 'rgba(14, 165, 233, 0.08)' : '#091c33';
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
      ctx.strokeStyle = isLight ? 'rgba(14, 165, 233, 0.22)' : '#0e294b';
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

    // Helper functions for CAD drawing
    const drawArrow = (x1: number, y1: number, x2: number, y2: number) => {
      const headlen = 1.5; // cm
      const angle = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Arrowheads
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + headlen * Math.cos(angle + Math.PI / 6), y1 + headlen * Math.sin(angle + Math.PI / 6));
      ctx.lineTo(x1 + headlen * Math.cos(angle - Math.PI / 6), y1 + headlen * Math.sin(angle - Math.PI / 6));
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
      ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
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
      ctx.strokeStyle = isLight ? '#0369a1' : '#0284c7';
      ctx.fillStyle = isLight ? '#0f172a' : '#38bdf8';
      ctx.lineWidth = 0.7 / zoom;

      if (horizontal) {
        const dy = y1 + offset;
        // Extension lines
        ctx.beginPath();
        ctx.moveTo(x1, y1 + (offset > 0 ? 0.5 : -0.5));
        ctx.lineTo(x1, dy + (offset > 0 ? 1 : -1));
        ctx.moveTo(x2, y2 + (offset > 0 ? 0.5 : -0.5));
        ctx.lineTo(x2, dy + (offset > 0 ? 1 : -1));
        ctx.stroke();

        // Dimension Line with arrows
        drawArrow(x1, dy, x2, dy);

        // Label
        ctx.font = `${Math.max(9 / zoom, 2)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = offset > 0 ? 'top' : 'bottom';
        ctx.fillText(label, (x1 + x2) / 2, dy + (offset > 0 ? 0.3 : -0.3));
      } else {
        const dx = x1 + offset;
        // Extension lines
        ctx.beginPath();
        ctx.moveTo(x1 + (offset > 0 ? 0.5 : -0.5), y1);
        ctx.lineTo(dx + (offset > 0 ? 1 : -1), y1);
        ctx.moveTo(x2 + (offset > 0 ? 0.5 : -0.5), y2);
        ctx.lineTo(dx + (offset > 0 ? 1 : -1), y2);
        ctx.stroke();

        // Dimension line
        drawArrow(dx, y1, dx, y2);

        // Label rotated
        ctx.save();
        ctx.translate(dx + (offset > 0 ? 0.4 : -0.4), (y1 + y2) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.font = `${Math.max(9 / zoom, 2)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = offset > 0 ? 'bottom' : 'top';
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
    ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
    ctx.lineWidth = 1.4 / zoom;
    ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.03)' : 'rgba(2, 132, 199, 0.04)';
    ctx.fillRect(fX, topY, fW, fH);
    ctx.strokeRect(fX, topY, fW, fH);

    // Internal Cavity (Dashed lines representing hidden walls)
    ctx.strokeStyle = isLight ? '#64748b' : '#0284c7';
    ctx.lineWidth = 0.8 / zoom;
    ctx.setLineDash([1.5, 1]);
    ctx.strokeRect(fX + thickness, topY + thickness, fW - 2 * thickness, fH - 2 * thickness);
    ctx.setLineDash([]);

    // Woofer, Midrange & Tweeter on Front Baffle
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

    // Port on Front Baffle (or projected dashed if mounted on Rear Panel)
    const portCenterY = topY + thickness + (portYPct / 100) * innerH;
    const portCenterX = fX + fW / 2;
    const isRearPort = portLocation === 'rear';

    if (boxType === 'ported' || boxType === 'bandpass') {
      const count = effectivePortCount;
      const portSpacing = count > 1 ? Math.min((fW * 0.45) / count, 12) : 0;

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

        if (isRearPort) {
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

      if (isRearPort) {
        ctx.fillStyle = isLight ? '#0369a1' : '#38bdf8';
        ctx.font = `bold ${Math.max(7.5 / zoom, 2.0)}px monospace`;
        ctx.textAlign = 'center';
        const labelOffset = (portShape === 'round' || portShape === 'custom')
          ? Math.max((portDiameter || 7.5) / 2, 1) + 2.4
          : Math.max(portHeight || 4, 1.5) / 2 + 2.4;
        ctx.fillText(`(${t("Atrás")})`, portCenterX, portCenterY + labelOffset);
      }
    }

    // Front View Label Header
    ctx.fillStyle = isLight ? '#0369a1' : '#38bdf8';
    ctx.font = `bold ${Math.max(9 / zoom, 2.5)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('VISTA FRONTAL (BAFLE)', fX + fW / 2, topY - 3.5);

    // Front View Dimension Lines
    const wDisp = `${convertTo(wExt, 'length', unitSystem).toFixed(1)} ${uLabel}`;
    const hDisp = `${convertTo(hExt, 'length', unitSystem).toFixed(1)} ${uLabel}`;
    drawDimension(fX, botY, fX + fW, botY, wDisp, 3.5, true);
    drawDimension(fX, topY, fX, botY, hDisp, -3.5, false);

    // Woofer position dimension
    const spkDistTop = wooferCenterY - topY;
    const spkTopDisp = `${convertTo(spkDistTop, 'length', unitSystem).toFixed(1)}`;
    drawDimension(fX + fW, topY, fX + fW, wooferCenterY, spkTopDisp, 2.2, false);

    // ----------------------------------------------------
    // B. VISTA LATERAL (SECCIÓN DE CORTE A-A')
    // ----------------------------------------------------
    const sX = sideStartX;
    const sWTop = shape === 'rectangular' ? dExt : dTrapTop;
    const sWBot = shape === 'rectangular' ? dExt : dTrapBot;
    const sW = Math.max(sWTop, sWBot);

    // Wood panels hatching and profiles
    ctx.fillStyle = isLight ? '#0369a1' : '#38bdf8';
    ctx.font = `bold ${Math.max(9 / zoom, 2.5)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('SECCIÓN CORTE A-A\' (LATERAL)', sX + sW / 2, topY - 3.5);

    // Panels (Top, Bottom, Front Baffle, Rear)
    ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';

    // 1. Top Panel
    ctx.strokeRect(sX, topY, sW, thickness);
    hatchRect(sX, topY, sW, thickness);

    // 2. Bottom Panel
    ctx.strokeRect(sX, botY - thickness, sW, thickness);
    hatchRect(sX, botY - thickness, sW, thickness);

    // 3. Front Baffle (Right side of profile)
    const baffleX = sX + sW - thickness;
    ctx.strokeRect(baffleX, topY + thickness, thickness, fH - 2 * thickness);
    hatchRect(baffleX, topY + thickness, thickness, fH - 2 * thickness);

    // 4. Rear Panel (Left side of profile)
    ctx.strokeRect(sX, topY + thickness, thickness, fH - 2 * thickness);
    hatchRect(sX, topY + thickness, thickness, fH - 2 * thickness);

    // WooferCross-Section, Tweeter Cross-Section & Midrange Cross-Section (Mounted on Baffle extending inwards)
    if (crossoverWays >= 2 && !isBandpass) {
      const twDepth = Math.min(sW * 0.16, 4.8);
      ctx.strokeStyle = isLight ? '#0369a1' : '#38bdf8';
      ctx.lineWidth = 1.0 / zoom;

      // Tweeter Rear Magnet Chamber inside Profile
      ctx.fillStyle = isLight ? '#cbd5e1' : '#1e3a5f';
      ctx.fillRect(baffleX - twDepth, tweeterCenterY - tweeterRadius * 0.55, twDepth, tweeterRadius * 1.1);
      ctx.strokeRect(baffleX - twDepth, tweeterCenterY - tweeterRadius * 0.55, twDepth, tweeterRadius * 1.1);

      // Tweeter Dome protruding slightly at Baffle outer face
      ctx.beginPath();
      ctx.arc(baffleX + thickness, tweeterCenterY, tweeterRadius * 0.36, -Math.PI / 2, Math.PI / 2);
      ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.25)' : 'rgba(56, 189, 248, 0.25)';
      ctx.fill();
      ctx.stroke();
    }

    if (crossoverWays === 3 && !isBandpass) {
      const midDepth = Math.min(sW * 0.28, 9.0);

      // Internal Midrange Sub-Enclosure (Cámara de Medios Separada) if not sealed-back
      if (!midSealed) {
        const dMidVal = Math.min(cabinetData?.dMid ?? Math.min(sW * 0.45, 13), sW - 2 * thickness - 1.5);
        const hMidVal = Math.min(cabinetData?.hMid ?? Math.max(midDiameter + 3, 12), fH - 2 * thickness - 4);
        const mBoxTop = midCenterY - hMidVal / 2;
        const mBoxBot = midCenterY + hMidVal / 2;
        const mBoxLeft = baffleX - dMidVal;

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
      ctx.moveTo(baffleX, midCenterY - midRadius * 0.85);
      ctx.lineTo(baffleX - midDepth * 0.6, midCenterY - midRadius * 0.38);
      ctx.lineTo(baffleX - midDepth, midCenterY - midRadius * 0.38);
      ctx.lineTo(baffleX - midDepth, midCenterY + midRadius * 0.38);
      ctx.lineTo(baffleX - midDepth * 0.6, midCenterY + midRadius * 0.38);
      ctx.lineTo(baffleX, midCenterY + midRadius * 0.85);
      ctx.stroke();

      // Midrange Magnet Cylinder
      ctx.fillStyle = isLight ? '#cbd5e1' : '#1e3a5f';
      ctx.fillRect(baffleX - midDepth, midCenterY - midRadius * 0.38, midDepth * 0.42, midRadius * 0.76);
      ctx.strokeStyle = isLight ? '#64748b' : '#38bdf8';
      ctx.strokeRect(baffleX - midDepth, midCenterY - midRadius * 0.38, midDepth * 0.42, midRadius * 0.76);
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
      // Woofer en Bafle Frontal (Direct Radiator): Disparo a la derecha (+X)
      drawRealisticWooferProfile(baffleX, wooferCenterY, wooferRadius, wooferCutoutRadius, spkDepth, 'right');
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
      ctx.fillText(vrSub, vrCenterX, vrY + 1.4);

      // Vf badge
      ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.75)' : 'rgba(7, 16, 30, 0.75)';
      ctx.fillRect(vfCenterX - 2.8, vfY - 0.9, 5.6, 2.7);
      ctx.fillStyle = isLight ? '#059669' : '#10b981';
      ctx.font = `bold ${Math.max(7.5 / zoom, 2.0)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`Vf: ${convertTo(bandpassVf || 0, 'volume', unitSystem).toFixed(1)} ${vLabel}`, vfCenterX, vfY);
      ctx.font = `${Math.max(6.5 / zoom, 1.8)}px monospace`;
      ctx.fillText(vfSub, vfCenterX, vfY + 1.4);

      // 2. Tabique Divisor con calado pasante para el Woofer
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

    // Port Tube Side Profile (extending into cavity from Front Baffle or Rear Panel)
    if (boxType === 'ported' || boxType === 'bandpass') {
      const pLen = Math.max(portLength || 15, 3);
      const maxStraightDepth = isBandpass 
        ? Math.max(depthFront - 1.2, 2.0)
        : (sW - 2 * thickness - 2);
      const effectivePortLen = Math.min(pLen, maxStraightDepth);
      const pR = (portShape === 'round' || portShape === 'custom')
        ? Math.max((portDiameter || 7.5) / 2, 1.2)
        : Math.max((portHeight || 4) / 2, 1.0);

      const pTop = portCenterY - pR;
      const pBot = portCenterY + pR;
      const rearInnerX = sX + thickness;

      // Clear wood hatching inside the port wall cutout
      ctx.fillStyle = isLight ? '#ffffff' : '#07101e';
      if (isRearPort) {
        ctx.fillRect(sX, pTop, thickness, pBot - pTop);
      } else {
        ctx.fillRect(baffleX, pTop, thickness, pBot - pTop);
      }

      ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
      ctx.lineWidth = 1.2 / zoom;
      ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(2, 132, 199, 0.12)';

      const flangeLip = Math.min(Math.max(pR * 0.42, 0.75), 1.45);
      const flareR = Math.min(Math.max(pR * 0.48, 0.85), Math.min(1.65, effectivePortLen * 0.28));

      if (isRearPort) {
        // Port mounted on Rear Panel (left wall) extending rightwards into cavity
        const outerX = sX;
        const innerX = rearInnerX + effectivePortLen;

        if (flaredEnds === 0) {
          // 0: Recto / Estándar (1 extremo a ras en el bafle, 1 extremo libre recto dentro de la caja)
          ctx.fillRect(outerX, pTop, thickness + effectivePortLen, pBot - pTop);

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
          ctx.fillRect(outerX, pTop, thickness + effectivePortLen, pBot - pTop);

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

        // Port Dimension
        const pLenDisp = `Lv: ${convertTo(effectivePortLen, 'length', unitSystem).toFixed(1)} ${uLabel}`;
        drawDimension(rearInnerX, pTop - 1, innerX, pTop - 1, pLenDisp, -1.8, true);
      } else {
        // Port mounted on Front Baffle (right wall) extending leftwards into cavity
        const outerX = baffleX + thickness;
        const innerX = baffleX - effectivePortLen;

        if (flaredEnds === 0) {
          // 0: Recto / Estándar (1 extremo a ras en el bafle, 1 extremo libre recto dentro de la caja)
          ctx.fillRect(innerX, pTop, effectivePortLen + thickness, pBot - pTop);

          ctx.beginPath();
          ctx.moveTo(outerX, pTop);
          ctx.lineTo(innerX, pTop);
          ctx.moveTo(outerX, pBot);
          ctx.lineTo(innerX, pBot);
          // Straight vertical cut ticks at the free inner end
          ctx.moveTo(innerX, pTop);
          ctx.lineTo(innerX, pTop + Math.min(pR * 0.35, 0.6));
          ctx.moveTo(innerX, pBot);
          ctx.lineTo(innerX, pBot - Math.min(pR * 0.35, 0.6));
          ctx.stroke();
        } else if (flaredEnds === 1) {
          // 1: Dos a Ras (Ambos extremos adosados / con brida plana a 90°)
          ctx.fillRect(innerX, pTop, effectivePortLen + thickness, pBot - pTop);

          ctx.beginPath();
          ctx.moveTo(outerX, pTop);
          ctx.lineTo(innerX, pTop);
          ctx.moveTo(outerX, pBot);
          ctx.lineTo(innerX, pBot);
          ctx.stroke();

          // Flat perpendicular flange lips (T-collar) at BOTH outer and inner ends
          const fThick = Math.min(0.35, thickness * 0.25);
          ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.22)' : 'rgba(56, 189, 248, 0.25)';
          // Outer flange (flush against front baffle exterior)
          ctx.fillRect(outerX, pTop - flangeLip, fThick, flangeLip);
          ctx.strokeRect(outerX, pTop - flangeLip, fThick, flangeLip);
          ctx.fillRect(outerX, pBot, fThick, flangeLip);
          ctx.strokeRect(outerX, pBot, fThick, flangeLip);
          // Inner flange (flush baffle/plate at inner end)
          ctx.fillRect(innerX, pTop - flangeLip, fThick, flangeLip);
          ctx.strokeRect(innerX, pTop - flangeLip, fThick, flangeLip);
          ctx.fillRect(innerX, pBot, fThick, flangeLip);
          ctx.strokeRect(innerX, pBot, fThick, flangeLip);
        } else if (flaredEnds === 3) {
          // 3: Abocinado 1 Extremo — Trumpet curve ONLY on outer mouth, straight cut on inner end
          ctx.beginPath();
          ctx.moveTo(outerX, pTop - flareR);
          ctx.quadraticCurveTo(outerX, pTop, outerX - flareR, pTop);
          ctx.lineTo(innerX, pTop);
          ctx.lineTo(innerX, pBot);
          ctx.lineTo(outerX - flareR, pBot);
          ctx.quadraticCurveTo(outerX, pBot, outerX, pBot + flareR);
          ctx.closePath();
          ctx.fill();

          // Top wall (flared outside, straight inside)
          ctx.beginPath();
          ctx.moveTo(outerX, pTop - flareR);
          ctx.quadraticCurveTo(outerX, pTop, outerX - flareR, pTop);
          ctx.lineTo(innerX, pTop);
          ctx.lineTo(innerX, pTop + Math.min(pR * 0.35, 0.6));
          ctx.stroke();

          // Bottom wall (flared outside, straight inside)
          ctx.beginPath();
          ctx.moveTo(outerX, pBot + flareR);
          ctx.quadraticCurveTo(outerX, pBot, outerX - flareR, pBot);
          ctx.lineTo(innerX, pBot);
          ctx.lineTo(innerX, pBot - Math.min(pR * 0.35, 0.6));
          ctx.stroke();
        } else {
          // 2: Abocinado 2 Extremos (Aeroport / Flared) — Trumpet curves at BOTH outer and inner mouths
          ctx.beginPath();
          ctx.moveTo(outerX, pTop - flareR);
          ctx.quadraticCurveTo(outerX, pTop, outerX - flareR, pTop);
          ctx.lineTo(innerX + flareR, pTop);
          ctx.quadraticCurveTo(innerX, pTop, innerX, pTop - flareR);
          ctx.lineTo(innerX, pBot + flareR);
          ctx.quadraticCurveTo(innerX, pBot, innerX + flareR, pBot);
          ctx.lineTo(outerX - flareR, pBot);
          ctx.quadraticCurveTo(outerX, pBot, outerX, pBot + flareR);
          ctx.closePath();
          ctx.fill();

          // Draw top flared wall
          ctx.beginPath();
          ctx.moveTo(outerX, pTop - flareR);
          ctx.quadraticCurveTo(outerX, pTop, outerX - flareR, pTop);
          ctx.lineTo(innerX + flareR, pTop);
          ctx.quadraticCurveTo(innerX, pTop, innerX, pTop - flareR);
          ctx.stroke();

          // Draw bottom flared wall
          ctx.beginPath();
          ctx.moveTo(outerX, pBot + flareR);
          ctx.quadraticCurveTo(outerX, pBot, outerX - flareR, pBot);
          ctx.lineTo(innerX + flareR, pBot);
          ctx.quadraticCurveTo(innerX, pBot, innerX, pBot + flareR);
          ctx.stroke();
        }

        // Port Dimension
        const pLenDisp = (isBandpass && pLen > maxStraightDepth)
          ? `Lv: ${convertTo(pLen, 'length', unitSystem).toFixed(1)} ${uLabel} (Codo)`
          : `Lv: ${convertTo(effectivePortLen, 'length', unitSystem).toFixed(1)} ${uLabel}`;
        drawDimension(innerX, pTop - 1, baffleX, pTop - 1, pLenDisp, -1.8, true);
      }
    }

    // Damping Acoustic Lining Layer (along rear wall and bottom)
    if (dampingType !== 'none') {
      const dLining = 1.5;
      ctx.strokeStyle = isLight ? 'rgba(5, 150, 105, 0.45)' : 'rgba(16, 185, 129, 0.4)';
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([0.8, 0.6]);

      // Rear wall lining
      ctx.strokeRect(sX + thickness, topY + thickness, dLining, fH - 2 * thickness);
      // Bottom lining (en caja paso banda sólo recubre la cámara trasera Vr)
      const bottomLiningLen = isBandpass ? depthRear : (sW - 2 * thickness);
      ctx.strokeRect(sX + thickness, botY - thickness - dLining, bottomLiningLen, dLining);
      ctx.setLineDash([]);
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
    const tCenterX = sX + sW / 2;
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
    ctx.fillText(`Espesor: ${cabinetData?.thickness || 19} mm`, tCenterX, tCenterY);
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
      ctx.fillStyle = isLight ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.35)';
      ctx.strokeStyle = isLight ? '#059669' : '#10b981';
      ctx.lineWidth = 2 / zoom;

      // 0: Laterales, 1: Tapa Sup, 2: Tapa Inf, 3: Trasera, 4: Frontal
      if (hoveredPieceIndex === 0) {
        ctx.fillRect(sX, topY, sW, fH);
        ctx.strokeRect(sX, topY, sW, fH);
      } else if (hoveredPieceIndex === 1) {
        ctx.fillRect(fX, topY, fW, thickness);
        ctx.fillRect(sX, topY, sW, thickness);
      } else if (hoveredPieceIndex === 2) {
        ctx.fillRect(fX, botY - thickness, fW, thickness);
        ctx.fillRect(sX, botY - thickness, sW, thickness);
      } else if (hoveredPieceIndex === 3) {
        ctx.fillRect(sX, topY + thickness, thickness, fH - 2 * thickness);
      } else if (hoveredPieceIndex === 4) {
        ctx.fillRect(fX, topY, fW, fH);
        ctx.fillRect(baffleX, topY + thickness, thickness, fH - 2 * thickness);
      }
    }

    ctx.restore(); // Restore world coords
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
    portLocation,
    bandpassRatio,
    dampingType,
    hoveredPieceIndex,
    cabinetData,
    unitSystem,
    uLabel,
    dTrapTop,
    dTrapBot,
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
      <div style={{ position: 'relative', width: '100%', height: '440px', overflow: 'hidden' }}>
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
    </div>
  );
};
