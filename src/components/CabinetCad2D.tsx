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
  hoveredPieceIndex?: number | null;
  speakerYPct?: number;
  portYPct?: number;
  bandpassOrder?: 4 | 6;
  bandpassRatio?: number;
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
  hoveredPieceIndex = null,
  speakerYPct = 50,
  portYPct = 85,
  bandpassRatio = 0.5,
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
    const h = 420;

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

    // 2. Blueprint Millimetric Grid
    if (showGrid) {
      const gridSpacing = 5 * zoom; // 5 cm = 50mm
      const fineSpacing = 1 * zoom; // 1 cm = 10mm

      // Fine Grid
      ctx.strokeStyle = isLight ? 'rgba(14, 165, 233, 0.08)' : '#091c33';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      const startX = pan.x % fineSpacing;
      for (let x = startX; x < width; x += fineSpacing) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      const startY = pan.y % fineSpacing;
      for (let y = startY; y < height; y += fineSpacing) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Major Grid
      ctx.strokeStyle = isLight ? 'rgba(14, 165, 233, 0.22)' : '#0e294b';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      const majorStartX = pan.x % gridSpacing;
      for (let x = majorStartX; x < width; x += gridSpacing) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      const majorStartY = pan.y % gridSpacing;
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

    // Woofer on Front Baffle
    const wooferDiameter = Math.min(fW * 0.82, fH * 0.52);
    const wooferRadius = wooferDiameter / 2;
    const innerH = fH - 2 * thickness;
    const wooferCenterY = topY + thickness + (speakerYPct / 100) * innerH;
    const wooferCenterX = fX + fW / 2;

    // Woofer Outer Ring & Cone
    ctx.strokeStyle = isLight ? (isBandpass ? '#94a3b8' : '#0f172a') : (isBandpass ? '#64748b' : '#38bdf8');
    ctx.lineWidth = 1.2 / zoom;
    ctx.beginPath();
    ctx.arc(wooferCenterX, wooferCenterY, wooferRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Cone suspension & Dustcap
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

    // Center Crosshairs for Woofer
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

    // Port on Front Baffle (if ported or bandpass)
    const portCenterY = topY + thickness + (portYPct / 100) * innerH;
    const portCenterX = fX + fW / 2;

    if (boxType === 'ported' || boxType === 'bandpass') {
      ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
      ctx.lineWidth = 1.2 / zoom;
      ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.06)' : 'rgba(2, 132, 199, 0.08)';

      const count = effectivePortCount;
      const portSpacing = count > 1 ? Math.min((fW * 0.45) / count, 12) : 0;

      for (let pIdx = 0; pIdx < count; pIdx++) {
        const pCurX = count === 1 
          ? portCenterX 
          : portCenterX - ((count - 1) * portSpacing) / 2 + pIdx * portSpacing;

        if (portShape === 'round' || portShape === 'custom') {
          const pR = Math.max((portDiameter || 7.5) / 2, 1);
          ctx.beginPath();
          ctx.arc(pCurX, portCenterY, pR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

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
          ctx.fillRect(pCurX - pW / 2, portCenterY - pH / 2, pW, pH);
          ctx.strokeRect(pCurX - pW / 2, portCenterY - pH / 2, pW, pH);
        }
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

    // Woofer Cross-Section (Mounted on Baffle extending inwards)
    const spkDepth = Math.min(sW * 0.45, 16);
    ctx.strokeStyle = isLight ? '#0369a1' : '#38bdf8';
    ctx.lineWidth = 1.1 / zoom;
    ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.12)' : 'rgba(2, 132, 199, 0.15)';

    // Woofer Cone & Chassis Side Profile
    ctx.beginPath();
    ctx.moveTo(baffleX, wooferCenterY - wooferRadius * 0.85);
    ctx.lineTo(baffleX - spkDepth * 0.6, wooferCenterY - wooferRadius * 0.35);
    ctx.lineTo(baffleX - spkDepth, wooferCenterY - wooferRadius * 0.35);
    ctx.lineTo(baffleX - spkDepth, wooferCenterY + wooferRadius * 0.35);
    ctx.lineTo(baffleX - spkDepth * 0.6, wooferCenterY + wooferRadius * 0.35);
    ctx.lineTo(baffleX, wooferCenterY + wooferRadius * 0.85);
    ctx.stroke();

    // Magnet Cylinder inside Profile
    ctx.fillStyle = isLight ? '#cbd5e1' : '#1e3a5f';
    ctx.fillRect(baffleX - spkDepth, wooferCenterY - wooferRadius * 0.35, spkDepth * 0.4, wooferRadius * 0.7);
    ctx.strokeStyle = isLight ? '#64748b' : '#38bdf8';
    ctx.strokeRect(baffleX - spkDepth, wooferCenterY - wooferRadius * 0.35, spkDepth * 0.4, wooferRadius * 0.7);

    // Port Tube Side Profile (extending into cavity)
    if (boxType === 'ported' || boxType === 'bandpass') {
      const pLen = Math.max(portLength || 15, 3);
      const effectivePortLen = Math.min(pLen, sW - 2 * thickness - 2);
      const pR = Math.max((portDiameter || 7.5) / 2, 1.2);

      const pTop = portCenterY - pR;
      const pBot = portCenterY + pR;

      ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
      ctx.lineWidth = 1.2 / zoom;
      ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.06)' : 'rgba(2, 132, 199, 0.08)';

      // Tube Walls
      ctx.beginPath();
      ctx.moveTo(baffleX, pTop);
      ctx.lineTo(baffleX - effectivePortLen, pTop);
      ctx.moveTo(baffleX, pBot);
      ctx.lineTo(baffleX - effectivePortLen, pBot);
      ctx.stroke();

      // Flared rim inside
      ctx.beginPath();
      ctx.arc(baffleX - effectivePortLen, pTop - 0.4, 0.4, 0, Math.PI / 2);
      ctx.arc(baffleX - effectivePortLen, pBot + 0.4, 0.4, (3 * Math.PI) / 2, Math.PI * 2);
      ctx.stroke();

      // Port Dimension
      const pLenDisp = `Lv: ${convertTo(effectivePortLen, 'length', unitSystem).toFixed(1)} ${uLabel}`;
      drawDimension(baffleX - effectivePortLen, pTop - 1, baffleX, pTop - 1, pLenDisp, -1.8, true);
    }

    // Bandpass internal divider if applicable
    if (isBandpass) {
      const divX = sX + thickness + (sW - 2 * thickness) * (1 - bandpassRatio);
      ctx.strokeStyle = isLight ? '#059669' : '#10b981';
      ctx.strokeRect(divX, topY + thickness, thickness, fH - 2 * thickness);
      hatchRect(divX, topY + thickness, thickness, fH - 2 * thickness);
    }

    // Damping Acoustic Lining Layer (along rear wall and bottom)
    if (dampingType !== 'none') {
      const dLining = 1.5;
      ctx.strokeStyle = isLight ? 'rgba(5, 150, 105, 0.45)' : 'rgba(16, 185, 129, 0.4)';
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([0.8, 0.6]);

      // Rear wall lining
      ctx.strokeRect(sX + thickness, topY + thickness, dLining, fH - 2 * thickness);
      // Bottom lining
      ctx.strokeRect(sX + thickness, botY - thickness - dLining, sW - 2 * thickness, dLining);
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
      drawDimension(sX, botY, sX + sW, botY, dDisp, 3.5, true);
    }

    const thickDisp = `T: ${cabinetData?.thickness || 19} mm`;
    drawDimension(sX, topY, sX, topY + thickness, thickDisp, -2.5, false);

    // Magnet Clearance to Rear Wall
    const rearClearance = (baffleX - spkDepth) - (sX + thickness);
    if (rearClearance > 0) {
      const clearDisp = `Despeje: ${convertTo(rearClearance, 'length', unitSystem).toFixed(1)}`;
      drawDimension(sX + thickness, wooferCenterY, baffleX - spkDepth, wooferCenterY, clearDisp, -wooferRadius * 0.4, true);
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
    speakerYPct,
    portYPct,
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
              padding: '0.3rem 0.85rem',
              borderRadius: '0px',
              fontSize: '0.72rem',
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
            VISOR 3D WEBGL
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
