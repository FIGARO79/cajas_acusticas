import React, { useRef, useEffect, useState, useCallback } from 'react';
import { type Lang, translate } from '../utils/translations';
import type { CrossoverResult } from '../types';

interface CrossoverCad2DProps {
  theme?: 'dark' | 'light';
  lang: Lang;
  crossoverWays: '2way' | '3way';
  crossoverType: '1st_order' | '2nd_butter' | '2nd_lr' | '4th_lr';
  xoverResults: CrossoverResult | null;
  enableZobel: boolean;
  zobelResults: { rz: number; cz: number } | null;
  enableLPad: boolean;
  lpadResults: { r1: number; r2: number } | null;
}

export const CrossoverCad2D: React.FC<CrossoverCad2DProps> = ({
  theme = 'dark',
  lang,
  crossoverWays,
  crossoverType,
  xoverResults,
  enableZobel,
  zobelResults,
  enableLPad,
  lpadResults,
}) => {
  const t = (text: string) => translate(text, lang);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // CAD Navigation State (Pan & Zoom)
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Grid toggle
  const [showGrid, setShowGrid] = useState<boolean>(true);

  // Auto-fit view
  const handleFitView = useCallback(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth || 800;
    const h = crossoverWays === '3way' ? 520 : 440;

    const logicalW = 860;
    const logicalH = crossoverWays === '3way' ? 660 : 460;

    const scaleX = (w - 40) / logicalW;
    const scaleY = (h - 40) / logicalH;
    const fitScale = Math.min(scaleX, scaleY, 1.4);

    setZoom(fitScale);
    setPan({
      x: (w - logicalW * fitScale) / 2,
      y: (h - logicalH * fitScale) / 2,
    });
  }, [crossoverWays]);

  useEffect(() => {
    handleFitView();
  }, [handleFitView]);

  // Mouse wheel zoom centered on cursor
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const newZoom = Math.min(Math.max(zoom * factor, 0.4), 6);

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

    const logicX = Math.round((mouseX - pan.x) / zoom);
    const logicY = Math.round((mouseY - pan.y) / zoom);
    setCursorPos({ x: logicX, y: logicY });

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
    setCursorPos(null);
  };

  // Export Canvas to PNG
  const handleExportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `esquema_cad_canvas_${crossoverWays}_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Main Canvas Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current || !xoverResults) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = containerRef.current.clientWidth || 800;
    const height = crossoverWays === '3way' ? 520 : 440;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Theme-aware CAD Background
    const cBg = isLight ? '#f8fafc' : '#060f1d';
    const cWirePos = '#ef4444';
    const cWireNeg = isLight ? '#1e293b' : '#94a3b8';
    const cTextMain = isLight ? '#0f172a' : '#f8fafc';
    const cTextMuted = isLight ? '#64748b' : '#94a3b8';
    const cHpColor = isLight ? '#0284c7' : '#38bdf8';
    const cLpColor = isLight ? '#059669' : '#4ade80';
    const cBpColor = isLight ? '#d97706' : '#facc15';
    const cZobelColor = isLight ? '#ea580c' : '#fb923c';
    const cLPadColor = isLight ? '#0284c7' : '#38bdf8';
    const cGridFine = isLight ? 'rgba(14, 165, 233, 0.08)' : '#091c33';
    const cGridMajor = isLight ? 'rgba(14, 165, 233, 0.22)' : '#0e294b';

    ctx.fillStyle = cBg;
    ctx.fillRect(0, 0, width, height);

    // 2. Sub-pixel CAD Millimetric Grid (Unified 6px fine / 30px major pitch with CabinetCad2D)
    if (showGrid) {
      const logicalW = 860;
      const logicalH = crossoverWays === '3way' ? 660 : 460;
      const baseScale = Math.min((width - 40) / logicalW, (height - 40) / logicalH, 1.4) || 1;
      const relativeZoom = Math.max(zoom / baseScale, 0.2);

      const fineSpacing = 6 * relativeZoom;
      const majorSpacing = 30 * relativeZoom;
      const defaultPanX = (width - logicalW * baseScale) / 2;
      const defaultPanY = (height - logicalH * baseScale) / 2;
      const offsetX = pan.x - defaultPanX;
      const offsetY = pan.y - defaultPanY;

      // Fine Grid
      ctx.strokeStyle = cGridFine;
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
      ctx.strokeStyle = cGridMajor;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      const majorStartX = ((offsetX % majorSpacing) + majorSpacing) % majorSpacing;
      for (let x = majorStartX; x < width; x += majorSpacing) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      const majorStartY = ((offsetY % majorSpacing) + majorSpacing) % majorSpacing;
      for (let y = majorStartY; y < height; y += majorSpacing) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    }

    // 3. Transform to Logical CAD Coordinate Space
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Helper functions
    const drawLine = (x1: number, y1: number, x2: number, y2: number, color: string, w = 3.5) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    const drawDot = (x: number, y: number, color: string, r = 6) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawCapHoriz = (xMid: number, y: number, color: string, label: string, lColor: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.lineCap = 'square';
      ctx.beginPath();
      ctx.moveTo(xMid - 6, y - 25);
      ctx.lineTo(xMid - 6, y + 25);
      ctx.moveTo(xMid + 6, y - 25);
      ctx.lineTo(xMid + 6, y + 25);
      ctx.stroke();

      if (label) {
        ctx.fillStyle = lColor;
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, xMid, y - 32);
      }
    };

    const drawCapVert = (x: number, yMid: number, color: string, label: string, lColor: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.lineCap = 'square';
      ctx.beginPath();
      ctx.moveTo(x - 25, yMid - 6);
      ctx.lineTo(x + 25, yMid - 6);
      ctx.moveTo(x - 25, yMid + 6);
      ctx.lineTo(x + 25, yMid + 6);
      ctx.stroke();

      if (label) {
        ctx.fillStyle = lColor;
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(label, x - 32, yMid + 4);
      }
    };

    const drawInductorHoriz = (xStart: number, y: number, loops: number, loopW: number, color: string, label: string, lColor: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      let curX = xStart;
      for (let i = 0; i < loops; i++) {
        const midX = curX + loopW / 2;
        const nextX = curX + loopW;
        ctx.moveTo(curX, y);
        ctx.quadraticCurveTo(midX, y - 22, nextX, y);
        curX = nextX;
      }
      ctx.stroke();

      if (label) {
        ctx.fillStyle = lColor;
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, xStart + (loops * loopW) / 2, y - 28);
      }
      return curX;
    };

    const drawInductorVert = (x: number, yStart: number, loops: number, loopH: number, color: string, label: string, lColor: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      let curY = yStart;
      for (let i = 0; i < loops; i++) {
        const midY = curY + loopH / 2;
        const nextY = curY + loopH;
        ctx.moveTo(x, curY);
        ctx.quadraticCurveTo(x - 24, midY, x, nextY);
        curY = nextY;
      }
      ctx.stroke();

      if (label) {
        ctx.fillStyle = lColor;
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(label, x + 16, yStart + (loops * loopH) / 2 + 4);
      }
      return curY;
    };

    const drawResistorHoriz = (xStart: number, y: number, width: number, color: string, label: string, lColor: string) => {
      const seg = width / 7;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(xStart, y);
      ctx.lineTo(xStart + seg * 1, y - 10);
      ctx.lineTo(xStart + seg * 2, y + 10);
      ctx.lineTo(xStart + seg * 3, y - 10);
      ctx.lineTo(xStart + seg * 4, y + 10);
      ctx.lineTo(xStart + seg * 5, y - 10);
      ctx.lineTo(xStart + seg * 6, y + 10);
      ctx.lineTo(xStart + width, y);
      ctx.stroke();

      if (label) {
        ctx.fillStyle = lColor;
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, xStart + width / 2, y - 16);
      }
      return xStart + width;
    };

    const drawResistorVert = (x: number, yStart: number, height: number, color: string, label: string, lColor: string) => {
      const seg = height / 7;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, yStart);
      ctx.lineTo(x - 10, yStart + seg * 1);
      ctx.lineTo(x + 10, yStart + seg * 2);
      ctx.lineTo(x - 10, yStart + seg * 3);
      ctx.lineTo(x + 10, yStart + seg * 4);
      ctx.lineTo(x - 10, yStart + seg * 5);
      ctx.lineTo(x + 10, yStart + seg * 6);
      ctx.lineTo(x, yStart + height);
      ctx.stroke();

      if (label) {
        ctx.fillStyle = lColor;
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(label, x + 16, yStart + height / 2 + 4);
      }
      return yStart + height;
    };

    const drawSpeaker = (x: number, yTop: number, h: number, title: string, subtitle: string) => {
      const boxW = 16;
      const coneDepth = 30;
      const coneFlare = 16;

      // 1. Chasis / Imán posterior (alineado exactamente con las conexiones)
      ctx.strokeStyle = cTextMain;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'square';
      ctx.strokeRect(x, yTop, boxW, h);

      // Bornes de conexión
      drawDot(x, yTop + h / 2, cWirePos, 4);
      drawDot(x, yTop + h, cWireNeg, 4);

      // 2. Cono acústico (Polígono cerrado limpio de 4 vértices sin líneas cruzadas)
      ctx.beginPath();
      ctx.moveTo(x + boxW, yTop); // Vértice superior izquierdo
      ctx.lineTo(x + boxW + coneDepth, yTop - coneFlare); // Vértice superior derecho (boca del cono)
      ctx.lineTo(x + boxW + coneDepth, yTop + h + coneFlare); // Vértice inferior derecho (boca del cono)
      ctx.lineTo(x + boxW, yTop + h); // Vértice inferior izquierdo
      ctx.closePath(); // Cierre exacto de vuelta a (x + boxW, yTop)
      ctx.stroke();

      // 3. Tapa guardapolvo central (dust cap)
      ctx.beginPath();
      ctx.arc(x + boxW + 2, yTop + h / 2, h * 0.22, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();

      // 4. Remate frontal del cono / suspensión
      ctx.beginPath();
      ctx.ellipse(x + boxW + coneDepth, yTop + h / 2, 3, (h + coneFlare * 2) / 2, 0, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();

      // 5. Rótulos informativos
      ctx.fillStyle = cTextMain;
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(title, x + boxW + coneDepth + 14, yTop + h / 2 - 2);

      ctx.fillStyle = cTextMuted;
      ctx.font = '12px monospace';
      ctx.fillText(subtitle, x + boxW + coneDepth + 14, yTop + h / 2 + 18);
    };

    // 4. DRAW SCHEMATIC BY TOPOLOGY
    if (xoverResults.ways === '2way') {
      const hp = xoverResults.hp;
      const lp = xoverResults.lp;
      const spkX = 640;

      // Inputs
      ctx.fillStyle = cWirePos;
      ctx.font = 'bold 26px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('+', 30, 70);

      ctx.fillStyle = cWireNeg;
      ctx.font = 'bold 28px monospace';
      ctx.fillText('-', 30, 190);

      ctx.fillStyle = cTextMuted;
      ctx.font = 'bold 12px monospace';
      ctx.fillText(t("ENTRADA (DE AMP)"), 30, 30);

      // Rails
      drawLine(60, 60, 160, 60, cWirePos);
      drawLine(60, 180, spkX, 180, cWireNeg);

      // HIGH PASS
      if (crossoverType === '4th_lr') {
        // C1
        drawLine(120, 60, 145, 60, cWirePos);
        drawCapHoriz(152, 60, cWirePos, `C1 = ${hp.c1 ? hp.c1.toFixed(2) : ''} µF`, cHpColor);
        drawLine(160, 60, 200, 60, cWirePos);

        // L1 Shunt
        drawDot(200, 60, cWirePos);
        drawDot(200, 180, cWireNeg);
        drawLine(200, 60, 200, 75, cWirePos);
        drawInductorVert(200, 75, 4, 22, cWireNeg, `L1 = ${hp.l1 ? hp.l1.toFixed(3) : ''} mH`, cHpColor);
        drawLine(200, 163, 200, 180, cWireNeg);

        // Inter-stage wire
        drawLine(200, 60, 310, 60, cWirePos);

        // C2
        drawLine(310, 60, 335, 60, cWirePos);
        drawCapHoriz(342, 60, cWirePos, `C2 = ${hp.c2 ? hp.c2.toFixed(2) : ''} µF`, cHpColor);
        drawLine(350, 60, 390, 60, cWirePos);

        // L2 Shunt
        drawDot(390, 60, cWirePos);
        drawDot(390, 180, cWireNeg);
        drawLine(390, 60, 390, 75, cWirePos);
        drawInductorVert(390, 75, 4, 22, cWireNeg, `L2 = ${hp.l2 ? hp.l2.toFixed(3) : ''} mH`, cHpColor);
        drawLine(390, 163, 390, 180, cWireNeg);

        // Wire to L-Pad or Speaker
        drawLine(390, 60, enableLPad ? 440 : spkX, 60, cWirePos);
      } else {
        // 1st / 2nd Order
        drawLine(160, 60, 200, 60, cWirePos);
        drawCapHoriz(208, 60, cWirePos, `C1 = ${hp.c1 ? hp.c1.toFixed(2) : ''} µF`, cHpColor);
        drawLine(215, 60, 260, 60, cWirePos);
        drawLine(260, 60, 360, 60, cWirePos);

        if (hp.l1 !== null && hp.l1 !== undefined && hp.l1 > 0) {
          drawDot(360, 60, cWirePos);
          drawDot(360, 180, cWireNeg);
          drawLine(360, 60, 360, 75, cWirePos);
          drawInductorVert(360, 75, 4, 22, cWireNeg, `L1 = ${hp.l1.toFixed(3)} mH`, cHpColor);
          drawLine(360, 163, 360, 180, cWireNeg);
        }

        drawLine(360, 60, enableLPad ? 440 : spkX, 60, cWirePos);
      }

      // L-PAD ATTTENUATOR
      if (enableLPad && lpadResults) {
        drawResistorHoriz(440, 60, 70, cLPadColor, `R_ser = ${lpadResults.r1.toFixed(2)} Ω`, cLPadColor);
        drawLine(510, 60, 560, 60, cWirePos);

        drawDot(560, 60, cWirePos);
        drawDot(560, 180, cWireNeg);
        drawLine(560, 60, 560, 80, cWirePos);
        drawResistorVert(560, 80, 70, cLPadColor, `R_par = ${lpadResults.r2.toFixed(2)} Ω`, cLPadColor);
        drawLine(560, 150, 560, 180, cWireNeg);

        drawLine(560, 60, spkX, 60, cWirePos);
      }

      // Tweeter Speaker
      drawSpeaker(spkX, 32, 56, t("Tweeter"), t("High Pass (Vías Altas)"));
      drawLine(spkX, 88, spkX, 180, cWireNeg);

      // Section divider
      ctx.strokeStyle = cGridMajor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(20, 225);
      ctx.lineTo(830, 225);
      ctx.stroke();
      ctx.setLineDash([]);

      // LOW PASS (WOOFER)
      ctx.fillStyle = cWirePos;
      ctx.font = 'bold 26px monospace';
      ctx.fillText('+', 30, 280);

      ctx.fillStyle = cWireNeg;
      ctx.font = 'bold 28px monospace';
      ctx.fillText('-', 30, 400);

      drawLine(60, 270, crossoverType === '4th_lr' ? 120 : 140, 270, cWirePos);
      drawLine(60, 390, spkX, 390, cWireNeg);

      if (crossoverType === '4th_lr') {
        drawInductorHoriz(120, 270, 4, 24, cWirePos, `L1 = ${lp.l1 ? lp.l1.toFixed(3) : ''} mH`, cLpColor);
        drawLine(216, 270, 250, 270, cWirePos);

        // C1 Shunt
        drawDot(250, 270, cWirePos);
        drawDot(250, 390, cWireNeg);
        drawLine(250, 270, 250, 310, cWirePos);
        drawCapVert(250, 318, cWireNeg, `C1 = ${lp.c1 ? lp.c1.toFixed(2) : ''} µF`, cLpColor);
        drawLine(250, 326, 250, 390, cWireNeg);

        drawLine(250, 270, 330, 270, cWirePos);
        drawInductorHoriz(330, 270, 4, 24, cWirePos, `L2 = ${lp.l2 ? lp.l2.toFixed(3) : ''} mH`, cLpColor);
        drawLine(426, 270, 460, 270, cWirePos);

        // C2 Shunt
        drawDot(460, 270, cWirePos);
        drawDot(460, 390, cWireNeg);
        drawLine(460, 270, 460, 310, cWirePos);
        drawCapVert(460, 318, cWireNeg, `C2 = ${lp.c2 ? lp.c2.toFixed(2) : ''} µF`, cLpColor);
        drawLine(460, 326, 460, 390, cWireNeg);

        drawLine(460, 270, enableZobel ? 540 : spkX, 270, cWirePos);
      } else {
        drawInductorHoriz(140, 270, 4, 24, cWirePos, `L1 = ${lp.l1 ? lp.l1.toFixed(3) : ''} mH`, cLpColor);
        drawLine(236, 270, enableZobel ? 540 : spkX, 270, cWirePos);

        if (lp.c1 !== null && lp.c1 !== undefined && lp.c1 > 0) {
          drawDot(340, 270, cWirePos);
          drawDot(340, 390, cWireNeg);
          drawLine(340, 270, 340, 310, cWirePos);
          drawCapVert(340, 318, cWireNeg, `C1 = ${lp.c1.toFixed(2)} µF`, cLpColor);
          drawLine(340, 326, 340, 390, cWireNeg);
        }
      }

      // ZOBEL NETWORK
      if (enableZobel && zobelResults) {
        drawDot(540, 270, cWirePos);
        drawDot(540, 390, cWireNeg);
        drawLine(540, 270, 540, 290, cWirePos);
        drawResistorVert(540, 290, 50, cZobelColor, `Rz = ${zobelResults.rz.toFixed(2)} Ω`, cZobelColor);
        drawLine(540, 340, 540, 355, cWirePos);
        drawCapVert(540, 361, cWireNeg, `Cz = ${zobelResults.cz.toFixed(2)} µF`, cZobelColor);
        drawLine(540, 367, 540, 390, cWireNeg);

        drawLine(540, 270, spkX, 270, cWirePos);
      }

      // Woofer Speaker
      drawSpeaker(spkX, 235, 70, t("Woofer"), t("Low Pass (Vías Bajas)"));
      drawLine(spkX, 305, spkX, 390, cWireNeg);

    } else {
      // 3-WAY SCHEMATIC
      const hp = xoverResults.hp;
      const bp = xoverResults.bp;
      const lp = xoverResults.lp;
      const spkX = 640;

      // Inputs & Common Rails
      ctx.fillStyle = cWirePos;
      ctx.font = 'bold 26px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('+', 25, 70);

      drawLine(60, 60, 110, 60, cWirePos);
      drawDot(110, 60, cWirePos);
      drawLine(110, 60, 110, 480, cWirePos);
      drawDot(110, 270, cWirePos);
      drawDot(110, 480, cWirePos);

      ctx.fillStyle = cWireNeg;
      ctx.font = 'bold 28px monospace';
      ctx.fillText('-', 25, 580);

      drawLine(80, 180, 80, 570, cWireNeg);
      drawDot(80, 180, cWireNeg);
      drawDot(80, 390, cWireNeg);
      drawDot(80, 570, cWireNeg);
      drawLine(80, 180, spkX, 180, cWireNeg);
      drawLine(80, 390, spkX, 390, cWireNeg);
      drawLine(80, 570, spkX, 570, cWireNeg);

      ctx.fillStyle = cTextMuted;
      ctx.font = 'bold 11px monospace';
      ctx.fillText(t("LINEA COMÚN NEGATIVO (TIERRA)"), 70, 600);

      // --- RAIL 1: TWEETER ---
      drawLine(110, 60, 160, 60, cWirePos);
      drawLine(160, 60, 190, 60, cWirePos);
      drawCapHoriz(198, 60, cWirePos, `C1 = ${hp.c1 ? hp.c1.toFixed(2) : ''} µF`, cHpColor);
      drawLine(205, 60, 245, 60, cWirePos);

      if (hp.l1 !== null && hp.l1 !== undefined && hp.l1 > 0) {
        drawDot(310, 60, cWirePos);
        drawLine(310, 60, 310, 75, cWirePos);
        drawInductorVert(310, 75, 4, 22, cWireNeg, `L1 = ${hp.l1.toFixed(3)} mH`, cHpColor);
        drawLine(310, 163, 310, 180, cWireNeg);
        drawDot(310, 180, cWireNeg);
      }

      if (enableLPad && lpadResults) {
        drawLine(245, 60, 440, 60, cWirePos);
        drawResistorHoriz(440, 60, 70, cLPadColor, `R_ser = ${lpadResults.r1.toFixed(2)} Ω`, cLPadColor);
        drawLine(510, 60, 560, 60, cWirePos);

        drawDot(560, 60, cWirePos);
        drawDot(560, 180, cWireNeg);
        drawLine(560, 60, 560, 80, cWirePos);
        drawResistorVert(560, 80, 70, cLPadColor, `R_par = ${lpadResults.r2.toFixed(2)} Ω`, cLPadColor);
        drawLine(560, 150, 560, 180, cWireNeg);

        drawLine(560, 60, spkX, 60, cWirePos);
      } else {
        drawLine(245, 60, spkX, 60, cWirePos);
      }

      drawSpeaker(spkX, 32, 56, t("Tweeter"), t("High Pass (Vías Altas)"));
      drawLine(spkX, 88, spkX, 180, cWireNeg);
      drawDot(spkX, 180, cWireNeg);

      // --- RAIL 2: MIDRANGE (BANDPASS) ---
      drawLine(110, 270, 160, 270, cWirePos);

      // Mid Series C
      if ((bp.c_hp && bp.c_hp > 0) || (bp.c1_hp && bp.c1_hp > 0)) {
        drawLine(160, 270, 185, 270, cWirePos);
        const labelC = crossoverType === '4th_lr'
          ? `C_HP = ${(bp.c1_hp || 0).toFixed(1)} µF`
          : `C1 = ${(bp.c_hp || bp.c1_hp || 0).toFixed(2)} µF`;
        drawCapHoriz(192, 270, cWirePos, labelC, cBpColor);
        drawLine(200, 270, 235, 270, cWirePos);
      } else {
        drawLine(160, 270, 235, 270, cWirePos);
      }

      // Mid Series L
      if ((bp.l_lp && bp.l_lp > 0) || (bp.l1_lp && bp.l1_lp > 0)) {
        const labelL = crossoverType === '4th_lr'
          ? `L_LP = ${(bp.l1_lp || 0).toFixed(2)} mH`
          : `L1 = ${(bp.l_lp || bp.l1_lp || 0).toFixed(3)} mH`;
        drawInductorHoriz(235, 270, 4, 24, cWirePos, labelL, cBpColor);
      } else {
        drawLine(235, 270, 331, 270, cWirePos);
      }
      drawLine(331, 270, spkX, 270, cWirePos);

      // Mid Shunts
      if ((bp.l_hp && bp.l_hp > 0) || crossoverType === '4th_lr') {
        drawDot(380, 270, cWirePos);
        drawLine(380, 270, 380, 285, cWirePos);
        const lShunt = crossoverType === '4th_lr'
          ? `L_HP = ${(bp.l1_hp || 0).toFixed(2)} mH`
          : `L2 = ${(bp.l_hp || 0).toFixed(3)} mH`;
        drawInductorVert(380, 285, 4, 16, cWireNeg, lShunt, cBpColor);
        drawLine(380, 349, 380, 390, cWireNeg);
        drawDot(380, 390, cWireNeg);
      }

      if ((bp.c_lp && bp.c_lp > 0) || crossoverType === '4th_lr') {
        drawDot(460, 270, cWirePos);
        drawLine(460, 270, 460, 290, cWirePos);
        const cShunt = crossoverType === '4th_lr'
          ? `C_LP = ${(bp.c1_lp || 0).toFixed(1)} µF`
          : `C2 = ${(bp.c_lp || 0).toFixed(2)} µF`;
        drawCapVert(460, 305, cWireNeg, cShunt, cBpColor);
        drawLine(460, 313, 460, 390, cWireNeg);
        drawDot(460, 390, cWireNeg);
      }

      drawSpeaker(spkX, 237, 66, t("Midrange"), t("Band Pass (Medios)"));
      drawLine(spkX, 303, spkX, 390, cWireNeg);
      drawDot(spkX, 390, cWireNeg);

      // --- RAIL 3: WOOFER (LOW PASS) ---
      drawLine(110, 480, 160, 480, cWirePos);

      if (crossoverType === '4th_lr') {
        drawInductorHoriz(160, 480, 4, 24, cWirePos, `L1 = ${lp.l1 ? lp.l1.toFixed(3) : ''} mH`, cLpColor);
        drawLine(256, 480, 290, 480, cWirePos);

        if (lp.c1 !== null && lp.c1 !== undefined && lp.c1 > 0) {
          drawDot(290, 480, cWirePos);
          drawLine(290, 480, 290, 500, cWirePos);
          drawCapVert(290, 510, cWireNeg, `C1 = ${lp.c1.toFixed(2)} µF`, cLpColor);
          drawLine(290, 518, 290, 570, cWireNeg);
          drawDot(290, 570, cWireNeg);
        }

        drawLine(290, 480, 370, 480, cWirePos);

        if (lp.l2 !== null && lp.l2 !== undefined && lp.l2 > 0) {
          drawInductorHoriz(370, 480, 4, 24, cWirePos, `L2 = ${lp.l2.toFixed(3)} mH`, cLpColor);
          drawLine(466, 480, 500, 480, cWirePos);
        } else {
          drawLine(290, 480, 500, 480, cWirePos);
        }

        if (lp.c2 !== null && lp.c2 !== undefined && lp.c2 > 0) {
          drawDot(500, 480, cWirePos);
          drawLine(500, 480, 500, 500, cWirePos);
          drawCapVert(500, 510, cWireNeg, `C2 = ${lp.c2.toFixed(2)} µF`, cLpColor);
          drawLine(500, 518, 500, 570, cWireNeg);
          drawDot(500, 570, cWireNeg);
        }

        drawLine(500, 480, enableZobel ? 540 : spkX, 480, cWirePos);
      } else {
        drawInductorHoriz(160, 480, 4, 24, cWirePos, `L1 = ${lp.l1 ? lp.l1.toFixed(3) : ''} mH`, cLpColor);
        drawLine(256, 480, enableZobel ? 540 : spkX, 480, cWirePos);

        if (lp.c1 !== null && lp.c1 !== undefined && lp.c1 > 0) {
          drawDot(340, 480, cWirePos);
          drawLine(340, 480, 340, 500, cWirePos);
          drawCapVert(340, 510, cWireNeg, `C1 = ${lp.c1.toFixed(2)} µF`, cLpColor);
          drawLine(340, 518, 340, 570, cWireNeg);
          drawDot(340, 570, cWireNeg);
        }
      }

      // Zobel on 3-way
      if (enableZobel && zobelResults) {
        drawDot(540, 480, cWirePos);
        drawLine(540, 480, 540, 495, cWirePos);
        drawResistorVert(540, 495, 40, cZobelColor, `Rz = ${zobelResults.rz.toFixed(2)} Ω`, cZobelColor);
        drawLine(540, 535, 540, 545, cWirePos);
        drawCapVert(540, 552, cWireNeg, `Cz = ${zobelResults.cz.toFixed(2)} µF`, cZobelColor);
        drawLine(540, 558, 540, 570, cWireNeg);
        drawDot(540, 570, cWireNeg);

        drawLine(540, 480, spkX, 480, cWirePos);
      } else {
        drawLine(enableZobel ? 540 : 500, 480, spkX, 480, cWirePos);
      }

      drawSpeaker(spkX, 445, 70, t("Woofer"), t("Low Pass (Vías Bajas)"));
      drawLine(spkX, 515, spkX, 570, cWireNeg);
      drawDot(spkX, 570, cWireNeg);
    }

    ctx.restore();
    ctx.restore();
  }, [
    zoom,
    pan,
    showGrid,
    isLight,
    crossoverWays,
    crossoverType,
    xoverResults,
    enableZobel,
    zobelResults,
    enableLPad,
    lpadResults,
    t,
  ]);

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
          background: isLight
            ? 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)'
            : 'linear-gradient(90deg, #091528 0%, #0d1e38 100%)',
          borderBottom: `1px solid ${isLight ? '#cbd5e1' : '#1e3a5f'}`,
          userSelect: 'none',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        {/* Left: Title & Badge */}
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
              whiteSpace: 'nowrap',
            }}
          >
            CAD 2D
          </span>
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: isLight ? '#0f172a' : '#f1f5f9',
              letterSpacing: '0.02em',
            }}
          >
            {crossoverWays === '2way'
              ? t("Esquema de Conexión del Crossover (2 Vías)")
              : t("Esquema de Conexión del Crossover (3 Vías)")}
          </span>
        </div>

        {/* Right: Zoom & CAD Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setZoom((z) => Math.min(z * 1.2, 6))}
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
            onClick={() => setZoom((z) => Math.max(z * 0.82, 0.4))}
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
        </div>
      </div>

      {/* Interactive Canvas Area */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: crossoverWays === '3way' ? '520px' : '440px',
          overflow: 'hidden',
        }}
      >
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
        {cursorPos && (
          <div
            style={{
              position: 'absolute',
              bottom: '0.5rem',
              left: '0.75rem',
              background: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(7, 16, 30, 0.85)',
              border: `1px solid ${isLight ? '#cbd5e1' : '#1e3a5f'}`,
              color: isLight ? '#0369a1' : '#38bdf8',
              padding: '0.2rem 0.5rem',
              borderRadius: '0px',
              fontSize: '0.65rem',
              fontFamily: 'monospace',
              pointerEvents: 'none',
              userSelect: 'none',
              backdropFilter: 'blur(4px)',
            }}
          >
            X: {cursorPos.x} | Y: {cursorPos.y} | ZOOM: {(zoom * 100).toFixed(0)}%
          </div>
        )}

        {/* Pan tip hint */}
        <div
          style={{
            position: 'absolute',
            bottom: '0.5rem',
            right: '0.75rem',
            color: '#64748b',
            fontSize: '0.62rem',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {t("Arrastra para mover | Rueda para zoom")}
        </div>
      </div>

      {/* Legend Footer */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.25rem',
          padding: '0.65rem 1rem',
          borderTop: `1px solid ${isLight ? '#e2e8f0' : '#1e3a5f'}`,
          width: '100%',
          justifyContent: 'center',
          fontSize: '0.78rem',
          color: isLight ? '#64748b' : '#94a3b8',
          background: isLight ? '#f8fafc' : '#081426',
          borderRadius: '0px',
          fontFamily: 'monospace',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="36" height="18" viewBox="0 0 40 20" style={{ color: isLight ? '#0284c7' : '#38bdf8' }}>
            <path d="M 5,10 Q 12,3 19,10 Q 26,3 33,10" fill="none" stroke="currentColor" strokeWidth="2.5" />
          </svg>
          <span><strong style={{ color: isLight ? '#0f172a' : '#f8fafc' }}>{t("Bobina (L)")}:</strong> {t("Filtra altas frecuencias")}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="36" height="18" viewBox="0 0 40 20" style={{ color: isLight ? '#0284c7' : '#38bdf8' }}>
            <line x1="16" y1="2" x2="16" y2="18" stroke="currentColor" strokeWidth="3" />
            <line x1="24" y1="2" x2="24" y2="18" stroke="currentColor" strokeWidth="3" />
            <line x1="5" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="2" />
            <line x1="24" y1="10" x2="35" y2="10" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span><strong style={{ color: isLight ? '#0f172a' : '#f8fafc' }}>{t("Condensador (C)")}:</strong> {t("Filtra bajas frecuencias")}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="36" height="18" viewBox="0 0 40 20" style={{ color: isLight ? '#0891b2' : '#38bdf8' }}>
            <path d="M 5,10 L 10,5 L 15,15 L 20,5 L 25,15 L 30,5 L 35,10" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span><strong style={{ color: isLight ? '#0f172a' : '#f8fafc' }}>{t("Resistencia (R)")}:</strong> {t("Atenúa o acopla impedancia")}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="30" height="18" viewBox="0 0 30 20" style={{ color: isLight ? '#0f172a' : '#f8fafc' }}>
            <rect x="2" y="5" width="6" height="10" fill="none" stroke="currentColor" strokeWidth="2" />
            <polygon points="8,5 18,1 18,19 8,15" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span><strong style={{ color: isLight ? '#0f172a' : '#f8fafc' }}>{t("Altavoz")}:</strong> {t("Produce el sonido")}</span>
        </div>
      </div>
    </div>
  );
};
