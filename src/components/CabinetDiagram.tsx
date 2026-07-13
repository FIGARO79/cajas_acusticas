import React from 'react';
import { type Lang, translate } from '../utils/translations';
import { type UnitSystem, convertTo, getUnitLabel } from '../utils/units';
import type { WoodCabinetData } from '../types';

interface CabinetDiagramProps {
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
  tweeterYPct?: number;
  midrangeYPct?: number;
  bandpassOrder?: 4 | 6;
  bandpassRatio?: number;
  bandpassVf?: number;
  bandpassVr?: number;

  crossoverWays?: number;
  driverConfig?: string;
  midFs?: number;
  midVas?: number;
  midQts?: number;
  midTargetQtc?: number;
  portLocation?: 'front' | 'rear';
  enableBracing?: boolean;
  bracingCount?: number;
  bracingPositions?: number[];
  onBracingPositionsChange?: (v: number[]) => void;
  flaredEnds?: 0 | 1 | 2;
}

export const CabinetDiagram: React.FC<CabinetDiagramProps> = ({
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
  tweeterYPct = 25,
  midrangeYPct = 50,
  bandpassOrder = 4,
  bandpassRatio = 0.5,
  crossoverWays = 2,
  driverConfig = 'single',
  portLocation = 'front',
  enableBracing = false,
  bracingCount = 2,
  bracingPositions = [0.35, 0.7],
  onBracingPositionsChange,
  flaredEnds = 0,
}) => {
  const t = (text: string) => translate(text, lang);

  if (!cabinetData || !cabinetData.valid) {
    return (
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: '12px',
        padding: '3rem 2rem',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.9rem',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)'
      }}>
        {t("Ingresa dimensiones válidas para visualizar el plano técnico.")}
      </div>
    );
  }

  const uLabel = getUnitLabel('length', unitSystem);

  // Valores en cm
  const {
    hExt, wExt, dExt,
    hInt,
    thickness,
    dTrapTopExt, dTrapBotExt,
  } = cabinetData;

  // Escala y viewBox dinámico para el SVG
  // Mostramos dos vistas: Frontal (izquierda) y Sección Lateral (derecha)
  const paddingLeft = 58;
  const paddingMiddle = 75;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 55;

  // Determinar dimensiones de visualización
  const dMax = shape === 'rectangular' ? dExt : Math.max(dTrapTopExt || 0, dTrapBotExt || 0);
  const hMax = hExt;

  // Definimos una altura de dibujo objetivo fija dentro de las coordenadas del SVG
  const targetDrawingHeight = 220;
  const scale = targetDrawingHeight / hMax;

  // Dimensiones en pixeles en el SVG
  const plotHeight = hMax * scale; // exactamente targetDrawingHeight
  const plotWidthFront = wExt * scale;
  const plotWidthSide = dMax * scale;

  // Distribución del espacio horizontal y vertical para ceñirse al contenido
  const offsetXFront = paddingLeft;
  const offsetXSide = paddingLeft + plotWidthFront + paddingMiddle;
  const offsetY = paddingTop;

  // Dimensiones de plantilla de refuerzo
  const plotWidthBrace = cabinetData.wInt * scale;
  const plotHeightBrace = (shape === 'rectangular' ? cabinetData.dInt : ((cabinetData.dTrapTopInt || 0) + (cabinetData.dTrapBotInt || 0)) / 2) * scale;
  const offsetXBrace = offsetXSide + plotWidthSide + paddingMiddle;
  const showBracingTemplate = enableBracing && bracingCount > 0 && boxType !== 'bandpass';

  // Dimensiones dinámicas totales del lienzo (viewBox)
  const svgWidth = showBracingTemplate
    ? offsetXBrace + plotWidthBrace + paddingRight
    : offsetXSide + plotWidthSide + paddingRight;
  const svgHeight = paddingTop + plotHeight + paddingBottom;

  // Grosor de madera en la escala
  const tScale = (thickness / 10) * scale; // thickness viene en mm, pasamos a cm

  // Inner height in scale
  const innerHeightScale = plotHeight - 2 * tScale;

  const handleBracingMouseDown = (e: React.MouseEvent, index: number) => {
    if (!onBracingPositionsChange) return;
    e.preventDefault();
    const svgElement = (e.currentTarget as any).ownerSVGElement;
    if (!svgElement) return;

    // The SVG height is dynamically defined by svgHeight. We can get it directly from bounding rect.
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const rect = svgElement.getBoundingClientRect();
      const clientY = moveEvent.clientY;
      const svgY = (clientY - rect.top) * (svgHeight / rect.height);
      
      let ratio = (svgY - offsetY - tScale) / innerHeightScale;
      ratio = Math.max(0.05, Math.min(0.95, ratio));
      
      const newPositions = [...bracingPositions];
      newPositions[index] = Number(ratio.toFixed(3));
      onBracingPositionsChange(newPositions);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleBracingTouchStart = (e: React.TouchEvent, index: number) => {
    if (!onBracingPositionsChange) return;
    const svgElement = (e.currentTarget as any).ownerSVGElement;
    if (!svgElement) return;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length === 0) return;
      const rect = svgElement.getBoundingClientRect();
      const clientY = moveEvent.touches[0].clientY;
      const svgY = (clientY - rect.top) * (svgHeight / rect.height);
      
      let ratio = (svgY - offsetY - tScale) / innerHeightScale;
      ratio = Math.max(0.05, Math.min(0.95, ratio));
      
      const newPositions = [...bracingPositions];
      newPositions[index] = Number(ratio.toFixed(3));
      onBracingPositionsChange(newPositions);
    };

    const handleTouchEnd = () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
  };

  // Bandpass helper coordinates
  const isBandpass = boxType === 'bandpass';
  const bandpassRatioVal = bandpassRatio !== undefined ? bandpassRatio : 0.5;
  const innerWidthSide = plotWidthSide - 2 * tScale;
  const xDivider = offsetXSide + tScale + innerWidthSide * (1 - bandpassRatioVal);
  const xDividerClamped = Math.min(offsetXSide + tScale + innerWidthSide * 0.75, Math.max(offsetXSide + tScale + innerWidthSide * 0.25, xDivider));

  // --- VISTA FRONTAL (Coordenadas) ---
  const frontExtPath = `M ${offsetXFront},${offsetY} L ${offsetXFront + plotWidthFront},${offsetY} L ${offsetXFront + plotWidthFront},${offsetY + plotHeight} L ${offsetXFront},${offsetY + plotHeight} Z`;
  const frontIntPath = `M ${offsetXFront + tScale},${offsetY + tScale} L ${offsetXFront + plotWidthFront - tScale},${offsetY + tScale} L ${offsetXFront + plotWidthFront - tScale},${offsetY + plotHeight - tScale} L ${offsetXFront + tScale},${offsetY + plotHeight - tScale} Z`;

  // Define dynamic driver layout for multi-way and multi-woofer configurations
  const getDriverLayout = () => {
    const list: Array<{
      type: 'tweeter' | 'midrange' | 'woofer';
      label: string;
      yCenter: number;
      rOuter: number;
      color: string;
    }> = [];

    const is3Way = crossoverWays === 3;
    const has2Woofers = driverConfig === 'parallel_2' || driverConfig === 'series_2' || driverConfig === 'dual_isolated';
    const yStart = offsetY + tScale;
    const hActive = innerHeightScale;

    // Standard heights and spacings based on radii
    const rW = Math.min(hActive * 0.12, 32);
    const rM = Math.min(hActive * 0.08, 22);
    const rT = Math.min(hActive * 0.06, 16);

    const dWW = rW * 2 + 12; // woofer to woofer spacing

    const tPct = tweeterYPct;
    const mPct = midrangeYPct;
    const yT = Math.min(yStart + hActive - rT - 8, Math.max(yStart + rT + 8, yStart + (tPct / 100) * hActive));
    const yM = Math.min(yStart + hActive - rM - 8, Math.max(yStart + rM + 8, yStart + (mPct / 100) * hActive));
    const Y_base = yStart + (speakerYPct / 100) * hActive;

    if (is3Way && has2Woofers) {
      const topOffset = dWW / 2 + rW + 8;
      const botOffset = dWW / 2 + rW + 8;
      const Y_clamped = Math.min(yStart + hActive - botOffset, Math.max(yStart + topOffset, Y_base));

      const yW1 = Y_clamped - dWW / 2;
      const yW2 = Y_clamped + dWW / 2;

      list.push({ type: 'tweeter', label: t("Tweeter"), yCenter: yT, rOuter: rT, color: '#a855f7' });
      list.push({ type: 'midrange', label: t("Medio"), yCenter: yM, rOuter: rM, color: '#eab308' });
      list.push({ type: 'woofer', label: `${t("Woofer")} 1`, yCenter: yW1, rOuter: rW, color: '#38bdf8' });
      list.push({ type: 'woofer', label: `${t("Woofer")} 2`, yCenter: yW2, rOuter: rW, color: '#38bdf8' });
    } else if (is3Way && !has2Woofers) {
      const rWoofer = Math.min(hActive * 0.14, 36);
      const Y_clamped = Math.min(yStart + hActive - rWoofer - 8, Math.max(yStart + rWoofer + 8, Y_base));

      list.push({ type: 'tweeter', label: t("Tweeter"), yCenter: yT, rOuter: rT, color: '#a855f7' });
      list.push({ type: 'midrange', label: t("Medio"), yCenter: yM, rOuter: rM, color: '#eab308' });
      list.push({ type: 'woofer', label: t("Woofer"), yCenter: Y_clamped, rOuter: rWoofer, color: '#38bdf8' });
    } else if (!is3Way && has2Woofers) {
      const rWoofer = Math.min(hActive * 0.14, 36);
      const dWooferWoofer = rWoofer * 2 + 12;
      const topOffset = dWooferWoofer / 2 + rWoofer + 8;
      const botOffset = dWooferWoofer / 2 + rWoofer + 8;
      const Y_clamped = Math.min(yStart + hActive - botOffset, Math.max(yStart + topOffset, Y_base));

      const yW1 = Y_clamped - dWooferWoofer / 2;
      const yW2 = Y_clamped + dWooferWoofer / 2;

      list.push({ type: 'tweeter', label: t("Tweeter"), yCenter: yT, rOuter: rT, color: '#a855f7' });
      list.push({ type: 'woofer', label: `${t("Woofer")} 1`, yCenter: yW1, rOuter: rWoofer, color: '#38bdf8' });
      list.push({ type: 'woofer', label: `${t("Woofer")} 2`, yCenter: yW2, rOuter: rWoofer, color: '#38bdf8' });
    } else {
      const rWoofer = Math.min(hActive * 0.16, 40);
      const Y_clamped = Math.min(yStart + hActive - rWoofer - 8, Math.max(yStart + rWoofer + 8, Y_base));

      list.push({ type: 'tweeter', label: t("Tweeter"), yCenter: yT, rOuter: rT, color: '#a855f7' });
      list.push({ type: 'woofer', label: t("Woofer"), yCenter: Y_clamped, rOuter: rWoofer, color: '#38bdf8' });
    }
    return list;
  };

  const layout = getDriverLayout();

  // Altavoz en Vista Frontal (Woofer)
  const wooferH = Math.min(plotHeight * 0.5, 80); // Alto del altavoz en el dibujo
  const rOuter = wooferH / 2;
  const rInner = rOuter * 0.8;
  const rCap = rOuter * 0.25;

  const wooferYCenter = isBandpass
    ? (offsetY + tScale + innerHeightScale / 2)
    : (layout.find(d => d.type === 'woofer')?.yCenter ?? (offsetY + tScale + (speakerYPct / 100) * innerHeightScale));
  const wooferY = wooferYCenter - rOuter;
  const wooferX = offsetXFront + plotWidthFront / 2;

  const speakerStroke = isBandpass ? "#64748b" : "#000000";
  const speakerDash = isBandpass ? "4 4" : "none";
  const speakerOpacity = isBandpass ? 0.35 : 1.0;

  const frontSpeaker = (
    <g>
      {/* Flange / Suspensión externa */}
      <circle cx={wooferX} cy={wooferYCenter} r={rOuter} fill="none" stroke={speakerStroke} strokeDasharray={speakerDash} strokeWidth="2" opacity={speakerOpacity} />
      <circle cx={wooferX} cy={wooferYCenter} r={rOuter - 3} fill="none" stroke="#64748b" strokeWidth="0.8" opacity={isBandpass ? 0.2 : 0.6} />

      {/* Tornillos de montaje (4 en cruz) */}
      {!isBandpass && (
        <>
          <circle cx={wooferX + rOuter * 0.9 * Math.cos(Math.PI / 4)} cy={wooferYCenter + rOuter * 0.9 * Math.sin(Math.PI / 4)} r="1.5" fill="#000000" />
          <circle cx={wooferX + rOuter * 0.9 * Math.cos(3 * Math.PI / 4)} cy={wooferYCenter + rOuter * 0.9 * Math.sin(3 * Math.PI / 4)} r="1.5" fill="#000000" />
          <circle cx={wooferX + rOuter * 0.9 * Math.cos(5 * Math.PI / 4)} cy={wooferYCenter + rOuter * 0.9 * Math.sin(5 * Math.PI / 4)} r="1.5" fill="#000000" />
          <circle cx={wooferX + rOuter * 0.9 * Math.cos(7 * Math.PI / 4)} cy={wooferYCenter + rOuter * 0.9 * Math.sin(7 * Math.PI / 4)} r="1.5" fill="#000000" />
        </>
      )}

      {/* Cono */}
      <circle cx={wooferX} cy={wooferYCenter} r={rInner} fill={isBandpass ? "none" : "#38bdf8"} opacity={isBandpass ? 0 : 0.12} stroke={isBandpass ? "#64748b" : "#38bdf8"} strokeDasharray={speakerDash} strokeWidth="1" />
      <circle cx={wooferX} cy={wooferYCenter} r={rInner - 5} fill="none" stroke="#64748b" strokeWidth="0.75" opacity={isBandpass ? 0.2 : 1.0} />

      {/* Cubrepolvo */}
      <circle cx={wooferX} cy={wooferYCenter} r={rCap} fill="none" stroke={speakerStroke} strokeDasharray={speakerDash} strokeWidth="1.5" opacity={speakerOpacity} />

      {/* Etiqueta Woofer Interno */}
      {isBandpass && (
        <>
          <text
            x={wooferX}
            y={wooferYCenter - 2}
            fill="var(--text-muted)"
            fontSize="9"
            fontWeight="bold"
            textAnchor="middle"
            opacity="0.7"
          >
            {t("Woofer Interno")}
          </text>
          <text
            x={wooferX}
            y={wooferYCenter + 8}
            fill="var(--text-muted)"
            fontSize="7.5"
            textAnchor="middle"
            opacity="0.6"
          >
            {t("(Sin corte frontal)")}
          </text>
        </>
      )}

      {/* Ejes técnicos de centro */}
      <line x1={wooferX - rOuter - 10} y1={wooferYCenter} x2={wooferX + rOuter + 10} y2={wooferYCenter} stroke="#10b981" strokeWidth="0.75" strokeDasharray="8 2 2 2" opacity="0.6" />
      <line x1={wooferX} y1={wooferYCenter - rOuter - 10} x2={wooferX} y2={wooferYCenter + rOuter + 10} stroke="#10b981" strokeWidth="0.75" strokeDasharray="8 2 2 2" opacity="0.6" />
    </g>
  );

  // Altura del puerto por defecto en el esquema
  let pHeightScale = 15;
  if (portShape === 'round' && portDiameter > 0) {
    pHeightScale = Math.min(portDiameter * scale, plotHeight * 0.25);
  } else if (portShape === 'rectangular' && portHeight > 0) {
    pHeightScale = Math.min(portHeight * scale, plotHeight * 0.25);
  }

  // Clamp port vertical position to stay inside internal limits
  const minPortY = offsetY + tScale + pHeightScale / 2;
  const maxPortY = offsetY + plotHeight - tScale - pHeightScale / 2;
  const portYCenter = Math.min(maxPortY, Math.max(minPortY, offsetY + tScale + (portYPct / 100) * innerHeightScale));
  const portY = portYCenter - pHeightScale / 2;

  // --- VISTA LATERAL (SECCIÓN CORTE) ---
  let extPath: string;
  let intPath: string;

  if (shape === 'rectangular') {
    const x0 = offsetXSide;
    const y0 = offsetY;
    const x1 = offsetXSide + plotWidthSide;
    const y1 = offsetY + plotHeight;

    extPath = `M ${x0},${y0} L ${x1},${y0} L ${x1},${y1} L ${x0},${y1} Z`;
    intPath = `M ${x0 + tScale},${y0 + tScale} L ${x1 - tScale},${y0 + tScale} L ${x1 - tScale},${y1 - tScale} L ${x0 + tScale},${y1 - tScale} Z`;
  } else {
    // Trapezoidal
    const dTop = (dTrapTopExt || 0) * scale;
    const dBot = (dTrapBotExt || 0) * scale;

    const x0_top = offsetXSide;
    const y0 = offsetY;
    const x1_top = offsetXSide + dTop;

    const x0_bot = offsetXSide;
    const y1 = offsetY + plotHeight;
    const x1_bot = offsetXSide + dBot;

    extPath = `M ${x0_top},${y0} L ${x1_top},${y0} L ${x1_bot},${y1} L ${x0_bot},${y1} Z`;
    intPath = `M ${x0_top + tScale},${y0 + tScale} L ${x1_top - tScale},${y0 + tScale} L ${x1_bot - tScale},${y1 - tScale} L ${x0_bot + tScale},${y1 - tScale} Z`;
  }

  // Tabique divisor para paso banda (utiliza xDivider y xDividerClamped declarados arriba)
  const wooferYCenterSide = offsetY + tScale + innerHeightScale / 2;
  const wooferYSide = isBandpass ? wooferYCenterSide - wooferH / 2 : wooferY;

  // Altavoz de perfil para cajas standard (sellada o ventilada)
  const speakerConeStandard = !isBandpass ? (
    <g>
      {layout.map((d, idx) => {
        const hDriver = d.rOuter * 2;
        const dDriver = d.type === 'tweeter' ? 12 : d.type === 'midrange' ? 20 : 32; // depth in scale
        const yTop = d.yCenter - d.rOuter;
        const xFlange = offsetXSide + tScale;
        const xMagnet = xFlange + dDriver * 0.55;

        // Tweeter (perfil plano con imán trasero pequeño)
        if (d.type === 'tweeter') {
          return (
            <g key={idx} opacity="0.95">
              {/* Flange frontal del Tweeter */}
              <rect x={xFlange - 1.5} y={yTop} width="3" height={hDriver} fill="#334155" stroke="#000000" strokeWidth="1" />
              {/* Domo de agudos */}
              <path d={`M ${xFlange},${d.yCenter - 6} Q ${xFlange + 4},${d.yCenter} ${xFlange},${d.yCenter + 6}`} fill="none" stroke="#000000" strokeWidth="1" />
              {/* Conjunto magnético compacto */}
              <rect x={xFlange + 1.5} y={d.yCenter - hDriver * 0.28} width="8" height={hDriver * 0.56} fill="#475569" stroke="#000000" strokeWidth="1" rx="0.5" />
            </g>
          );
        }

        // Midrange y Woofer (perfil detallado)
        const rSurround = d.type === 'midrange' ? 2.5 : 4;
        const hVoiceCoil = hDriver * 0.18;
        const wMagnet = dDriver * 0.45;
        const hMagnet = hDriver * 0.65;

        return (
          <g key={idx} opacity="0.95">
            {/* Basket Flange */}
            <rect x={xFlange - 1.5} y={yTop} width="3" height={hDriver} fill="#334155" stroke="#000000" strokeWidth="1" />

            {/* Suspension / Surround */}
            <path d={`M ${xFlange},${yTop + 2} A ${rSurround} ${rSurround} 0 0 1 ${xFlange},${yTop + 2 + rSurround * 2}`} fill="none" stroke="#000000" strokeWidth="1" />
            <path d={`M ${xFlange},${yTop + hDriver - 2} A ${rSurround} ${rSurround} 0 0 0 ${xFlange},${yTop + hDriver - 2 - rSurround * 2}`} fill="none" stroke="#000000" strokeWidth="1" />

            {/* Cono */}
            <line x1={xFlange} y1={yTop + 2 + rSurround * 2} x2={xMagnet} y2={d.yCenter - hVoiceCoil / 2} stroke="#000000" strokeWidth="1.25" />
            <line x1={xFlange} y1={yTop + hDriver - 2 - rSurround * 2} x2={xMagnet} y2={d.yCenter + hVoiceCoil / 2} stroke="#000000" strokeWidth="1.25" />

            {/* Dust cap */}
            <path d={`M ${xFlange + dDriver * 0.22},${d.yCenter - hVoiceCoil * 0.8} Q ${xFlange + dDriver * 0.4},${d.yCenter} ${xFlange + dDriver * 0.22},${d.yCenter + hVoiceCoil * 0.8}`} fill="none" stroke="#000000" strokeWidth="1" />

            {/* Brazos del Chasis */}
            <line x1={xFlange + 1.5} y1={yTop + 6} x2={xMagnet} y2={d.yCenter - hVoiceCoil * 1.1} stroke="#334155" strokeWidth="1.2" />
            <line x1={xFlange + 1.5} y1={yTop + hDriver - 6} x2={xMagnet} y2={d.yCenter + hVoiceCoil * 1.1} stroke="#334155" strokeWidth="1.2" />

            {/* Centradores / Spider */}
            <line x1={xMagnet - 2} y1={d.yCenter - hVoiceCoil / 2} x2={xMagnet + 4} y2={d.yCenter - hVoiceCoil / 2} stroke="#f97316" strokeWidth="1" strokeDasharray="1 1" />
            <line x1={xMagnet - 2} y1={d.yCenter + hVoiceCoil / 2} x2={xMagnet + 4} y2={d.yCenter + hVoiceCoil / 2} stroke="#f97316" strokeWidth="1" strokeDasharray="1 1" />
            <path d={`M ${xMagnet - 5},${d.yCenter - hVoiceCoil / 2} Q ${xMagnet - 2.5},${d.yCenter - hVoiceCoil * 0.9} ${xMagnet},${d.yCenter - hVoiceCoil * 1.25}`} fill="none" stroke="#ea580c" strokeWidth="0.8" />
            <path d={`M ${xMagnet - 5},${d.yCenter + hVoiceCoil / 2} Q ${xMagnet - 2.5},${d.yCenter + hVoiceCoil * 0.9} ${xMagnet},${d.yCenter + hVoiceCoil * 1.25}`} fill="none" stroke="#ea580c" strokeWidth="0.8" />

            {/* Magnetic Stack */}
            {/* Top Plate (Metal) */}
            <rect x={xMagnet} y={d.yCenter - hMagnet / 2} width={wMagnet * 0.22} height={hMagnet} fill="#94a3b8" stroke="#000000" strokeWidth="0.8" />
            {/* Magnet Ring (Ferrita/Neodimio) */}
            <rect x={xMagnet + wMagnet * 0.22} y={d.yCenter - hMagnet * 0.46} width={wMagnet * 0.63} height={hMagnet * 0.92} fill="#1e293b" stroke="#000000" strokeWidth="0.8" />
            {/* Back Plate & Pole Piece */}
            <path d={`M ${xMagnet + wMagnet * 0.85},${d.yCenter - hMagnet / 2} 
                      L ${xMagnet + wMagnet},${d.yCenter - hMagnet / 2} 
                      L ${xMagnet + wMagnet},${d.yCenter + hMagnet / 2} 
                      L ${xMagnet + wMagnet * 0.85},${d.yCenter + hMagnet / 2} Z`} 
                  fill="#94a3b8" stroke="#000000" strokeWidth="0.8" />
            <rect x={xMagnet} y={d.yCenter - hVoiceCoil * 0.35} width={wMagnet} height={hVoiceCoil * 0.7} fill="#64748b" stroke="#000000" strokeWidth="0.7" />
          </g>
        );
      })}
    </g>
  ) : null;

  const speakerMagnetStandard = null;

  const internalPartitions = !isBandpass ? (
    <g>
      {/* Partition for Midrange Chamber */}
      {crossoverWays === 3 && cabinetData && (() => {
        const dVal = shape === 'rectangular' ? cabinetData.dInt : ((cabinetData.dTrapTopInt || 0) + (cabinetData.dTrapBotInt || 0)) / 2;
        const dM = cabinetData.dMid ?? 15;
        const hM = cabinetData.hMid ?? 20;

        const dMidScale = cabinetData.dInt > 0 ? (dM / cabinetData.dInt) * innerWidthSide : 0;
        const hMidScale = cabinetData.hInt > 0 ? (hM / cabinetData.hInt) * innerHeightScale : 0;

        const midDriver = layout.find(d => d.type === 'midrange');
        if (midDriver && cabinetData.hInt > 0 && hM > 0 && dVal > 0) {
          const yM = midDriver.yCenter;

          // Center the box vertically around the midrange driver center
          let yTop = yM - hMidScale / 2;
          let yBot = yM + hMidScale / 2;

          const limitTop = offsetY + tScale;
          const limitBot = offsetY + plotHeight - tScale;

          if (yTop < limitTop) {
            yTop = limitTop;
            yBot = limitTop + hMidScale;
          }
          if (yBot > limitBot) {
            yBot = limitBot;
            yTop = limitBot - hMidScale;
          }

          yTop = Math.max(limitTop, yTop);

          const hasTopShelf = yTop > limitTop + 2;
          const hasBotShelf = yBot < limitBot - 2;

          return (
            <g>
              {/* Top Shelf */}
              {hasTopShelf && (
                <rect
                  x={offsetXSide + tScale}
                  y={yTop - tScale}
                  width={dMidScale}
                  height={tScale}
                  fill="#eab308"
                  stroke="#000000"
                  strokeWidth="1.2"
                  opacity="0.65"
                />
              )}
              {/* Bottom Shelf */}
              {hasBotShelf && (
                <rect
                  x={offsetXSide + tScale}
                  y={yBot}
                  width={dMidScale}
                  height={tScale}
                  fill="#eab308"
                  stroke="#000000"
                  strokeWidth="1.2"
                  opacity="0.65"
                />
              )}
              {/* Vertical Rear Divider Wall */}
              <rect
                x={offsetXSide + tScale + dMidScale}
                y={yTop - (hasTopShelf ? tScale : 0)}
                width={tScale}
                height={(yBot + (hasBotShelf ? tScale : 0)) - (yTop - (hasTopShelf ? tScale : 0))}
                fill="#eab308"
                stroke="#000000"
                strokeWidth="1.2"
                opacity="0.65"
              />
              {/* Label */}
              <text
                x={offsetXSide + tScale + dMidScale / 2}
                y={yM + 3}
                fill="#eab308"
                fontSize="8.5"
                fontWeight="bold"
                textAnchor="middle"
                opacity="0.95"
              >
                {t("Cámara Medios")}
              </text>
            </g>
          );
        }
        return null;
      })()}

      {/* Partition for Isolated Woofer Chambers */}
      {driverConfig === 'dual_isolated' && (() => {
        const woofers = layout.filter(d => d.type === 'woofer');
        if (woofers.length === 2) {
          const yPart = (woofers[0].yCenter + woofers[1].yCenter) / 2 - tScale / 2;
          return (
            <g>
              <rect
                x={offsetXSide + tScale}
                y={yPart}
                width={plotWidthSide - 2 * tScale}
                height={tScale}
                fill="#38bdf8"
                stroke="#000000"
                strokeWidth="1.2"
                opacity="0.65"
              />
              <text
                x={offsetXSide + plotWidthSide / 2}
                y={yPart - 4}
                fill="#38bdf8"
                fontSize="8.5"
                fontWeight="bold"
                textAnchor="middle"
                opacity="0.95"
              >
                {t("Tabique Woofer")}
              </text>
            </g>
          );
        }
        return null;
      })()}
    </g>
  ) : null;

  // Altavoz de perfil para cajas Bandpass (cono apunta a la izquierda, imán a la derecha)
  const wooferDepthBP = Math.min(plotWidthSide * 0.4, 40);
  const speakerConeBP = isBandpass ? (
    <path
      d={`M ${xDividerClamped},${wooferYSide} 
          Q ${xDividerClamped - wooferDepthBP * 0.15},${wooferYSide + wooferH * 0.15} ${xDividerClamped - wooferDepthBP * 0.6},${wooferYSide + wooferH * 0.35}
          L ${xDividerClamped - wooferDepthBP * 0.6},${wooferYSide + wooferH * 0.65}
          Q ${xDividerClamped - wooferDepthBP * 0.15},${wooferYSide + wooferH * 0.85} ${xDividerClamped},${wooferYSide + wooferH}
          L ${xDividerClamped},${wooferYSide + wooferH - 4}
          Q ${xDividerClamped - wooferDepthBP * 0.2},${wooferYSide + wooferH * 0.8} ${xDividerClamped - wooferDepthBP * 0.55},${wooferYSide + wooferH * 0.6}
          L ${xDividerClamped - wooferDepthBP * 0.55},${wooferYSide + wooferH * 0.4}
          Q ${xDividerClamped - wooferDepthBP * 0.2},${wooferYSide + wooferH * 0.2} ${xDividerClamped},${wooferYSide + 4} Z`}
      fill="#38bdf8"
      opacity="0.85"
    />
  ) : null;

  const speakerMagnetBP = isBandpass ? (
    <g>
      <line x1={xDividerClamped} y1={wooferYCenterSide - 8} x2={xDividerClamped + wooferDepthBP * 0.35} y2={wooferYCenterSide - 12} stroke="#000000" strokeWidth="2" />
      <line x1={xDividerClamped} y1={wooferYCenterSide + 8} x2={xDividerClamped + wooferDepthBP * 0.35} y2={wooferYCenterSide + 12} stroke="#000000" strokeWidth="2" />
      <rect
        x={xDividerClamped + wooferDepthBP * 0.3}
        y={wooferYCenterSide - 15}
        width={wooferDepthBP * 0.25}
        height="30"
        fill="#475569"
        stroke="#000000"
        strokeWidth="1.5"
        rx="2"
      />
    </g>
  ) : null;

  // Tabiques divisorios verticales superior e inferior
  const dividerUpperHeight = wooferYSide - (offsetY + tScale);
  const dividerLowerHeight = (offsetY + plotHeight - tScale) - (wooferYSide + wooferH);
  const bandpassDivider = isBandpass ? (
    <g>
      {/* Tabique Superior */}
      {dividerUpperHeight > 0 && (
        <rect
          x={xDividerClamped}
          y={offsetY + tScale}
          width={tScale}
          height={dividerUpperHeight}
          fill="rgba(245, 158, 11, 0.12)"
          stroke="#000000"
          strokeWidth="1.5"
        />
      )}
      {/* Tabique Inferior */}
      {dividerLowerHeight > 0 && (
        <rect
          x={xDividerClamped}
          y={wooferYSide + wooferH}
          width={tScale}
          height={dividerLowerHeight}
          fill="rgba(245, 158, 11, 0.12)"
          stroke="#000000"
          strokeWidth="1.5"
        />
      )}
    </g>
  ) : null;

  // Puerto de perfil (Vf / Vb1) - Ubicado dinámicamente en el frente o atrás
  let portElement = null;
  if (boxType === 'ported' || boxType === 'bandpass') {
    const effectivePortLength = portLength > 0 ? portLength : (isBandpass ? 12 : 15);
    const pLenScale = effectivePortLength * scale;
    const portYSide = isBandpass
      ? offsetY + plotHeight - tScale - pHeightScale - 12
      : portY;

    const rFlare = Math.min(10, pHeightScale * 0.35);
    const outerFlared = flaredEnds >= 1;
    const innerFlared = flaredEnds === 2;

    if (portLocation === 'front' || isBandpass) {
      const xEnd = offsetXSide + tScale + pLenScale;
      const topPath = outerFlared || innerFlared
        ? `M ${offsetXSide - (outerFlared ? rFlare : 0)},${portYSide - (outerFlared ? rFlare : 0)} Q ${offsetXSide},${portYSide} ${offsetXSide + (outerFlared ? rFlare : 0)},${portYSide} L ${xEnd - (innerFlared ? rFlare : 0)},${portYSide} Q ${xEnd},${portYSide} ${xEnd + (innerFlared ? rFlare : 0)},${portYSide - (innerFlared ? rFlare : 0)}`
        : `M ${offsetXSide},${portYSide} L ${xEnd},${portYSide}`;

      const botPath = outerFlared || innerFlared
        ? `M ${offsetXSide - (outerFlared ? rFlare : 0)},${portYSide + pHeightScale + (outerFlared ? rFlare : 0)} Q ${offsetXSide},${portYSide + pHeightScale} ${offsetXSide + (outerFlared ? rFlare : 0)},${portYSide + pHeightScale} L ${xEnd - (innerFlared ? rFlare : 0)},${portYSide + pHeightScale} Q ${xEnd},${portYSide + pHeightScale} ${xEnd + (innerFlared ? rFlare : 0)},${portYSide + pHeightScale + (innerFlared ? rFlare : 0)}`
        : `M ${offsetXSide},${portYSide + pHeightScale} L ${xEnd},${portYSide + pHeightScale}`;

      portElement = (
        <g>
          <rect x={offsetXSide - 1} y={portYSide + 0.5} width={tScale + 2} height={pHeightScale - 1} fill="var(--card-bg)" />
          <path d={topPath} fill="none" stroke="#000000" strokeWidth="2" />
          <path d={botPath} fill="none" stroke="#000000" strokeWidth="2" />
          <line x1={xEnd} y1={portYSide} x2={xEnd} y2={portYSide + pHeightScale} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 3" />
          <text x={offsetXSide + tScale + pLenScale / 2} y={portYSide - 5} fill="#10b981" stroke="none" fontSize="9.5" fontWeight="normal" textAnchor="middle">
            {isBandpass
              ? `Lv1: ${convertTo(effectivePortLength, 'length', unitSystem).toFixed(1)}${uLabel}`
              : `Lv: ${portLength > 0 ? convertTo(portLength, 'length', unitSystem).toFixed(1) : 'N/A'}${uLabel}`}
          </text>
        </g>
      );
    } else {
      // Rear Port (drawn on the right side of sectional view)
      const xStart = offsetXSide + plotWidthSide;
      const xInnerEnd = offsetXSide + plotWidthSide - tScale - pLenScale;

      const topPath = outerFlared || innerFlared
        ? `M ${xStart + (outerFlared ? rFlare : 0)},${portYSide - (outerFlared ? rFlare : 0)} Q ${xStart},${portYSide} ${xStart - (outerFlared ? rFlare : 0)},${portYSide} L ${xInnerEnd + (innerFlared ? rFlare : 0)},${portYSide} Q ${xInnerEnd},${portYSide} ${xInnerEnd - (innerFlared ? rFlare : 0)},${portYSide - (innerFlared ? rFlare : 0)}`
        : `M ${xStart},${portYSide} L ${xInnerEnd},${portYSide}`;

      const botPath = outerFlared || innerFlared
        ? `M ${xStart + (outerFlared ? rFlare : 0)},${portYSide + pHeightScale + (outerFlared ? rFlare : 0)} Q ${xStart},${portYSide + pHeightScale} ${xStart - (outerFlared ? rFlare : 0)},${portYSide + pHeightScale} L ${xInnerEnd + (innerFlared ? rFlare : 0)},${portYSide + pHeightScale} Q ${xInnerEnd},${portYSide + pHeightScale} ${xInnerEnd - (innerFlared ? rFlare : 0)},${portYSide + pHeightScale + (innerFlared ? rFlare : 0)}`
        : `M ${xStart},${portYSide + pHeightScale} L ${xInnerEnd},${portYSide + pHeightScale}`;

      portElement = (
        <g>
          <rect x={xStart - tScale - 1} y={portYSide + 0.5} width={tScale + 2} height={pHeightScale - 1} fill="var(--card-bg)" />
          <path d={topPath} fill="none" stroke="#000000" strokeWidth="2" />
          <path d={botPath} fill="none" stroke="#000000" strokeWidth="2" />
          <line x1={xInnerEnd} y1={portYSide} x2={xInnerEnd} y2={portYSide + pHeightScale} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 3" />
          <text x={xStart - tScale - pLenScale / 2} y={portYSide - 5} fill="#10b981" stroke="none" fontSize="9.5" fontWeight="normal" textAnchor="middle">
            {`Lv: ${portLength > 0 ? convertTo(portLength, 'length', unitSystem).toFixed(1) : 'N/A'}${uLabel}`}
          </text>
        </g>
      );
    }
  }

  // Puerto de perfil derecho (Vr / Vb2, 6º Orden) - Ubicado abajo a la derecha
  let portElementVr = null;
  if (isBandpass && bandpassOrder === 6) {
    const pHeightScaleVr = pHeightScale;
    const pLenScaleVr = 12 * scale; // 12cm visual
    const portYVr = offsetY + plotHeight - tScale - pHeightScaleVr - 12; // Mismo alto que el puerto izquierdo
    const xStartVr = offsetXSide + plotWidthSide;
    const xInnerEndVr = xStartVr - tScale - pLenScaleVr;

    const rFlare = Math.min(10, pHeightScaleVr * 0.35);
    const outerFlared = flaredEnds >= 1;
    const innerFlared = flaredEnds === 2;

    const topPath = outerFlared || innerFlared
      ? `M ${xStartVr + (outerFlared ? rFlare : 0)},${portYVr - (outerFlared ? rFlare : 0)} Q ${xStartVr},${portYVr} ${xStartVr - (outerFlared ? rFlare : 0)},${portYVr} L ${xInnerEndVr + (innerFlared ? rFlare : 0)},${portYVr} Q ${xInnerEndVr},${portYVr} ${xInnerEndVr - (innerFlared ? rFlare : 0)},${portYVr - (innerFlared ? rFlare : 0)}`
      : `M ${xStartVr},${portYVr} L ${xInnerEndVr},${portYVr}`;

    const botPath = outerFlared || innerFlared
      ? `M ${xStartVr + (outerFlared ? rFlare : 0)},${portYVr + pHeightScaleVr + (outerFlared ? rFlare : 0)} Q ${xStartVr},${portYVr + pHeightScaleVr} ${xStartVr - (outerFlared ? rFlare : 0)},${portYVr + pHeightScaleVr} L ${xInnerEndVr + (innerFlared ? rFlare : 0)},${portYVr + pHeightScaleVr} Q ${xInnerEndVr},${portYVr + pHeightScaleVr} ${xInnerEndVr - (innerFlared ? rFlare : 0)},${portYVr + pHeightScaleVr + (innerFlared ? rFlare : 0)}`
      : `M ${xStartVr},${portYVr + pHeightScaleVr} L ${xInnerEndVr},${portYVr + pHeightScaleVr}`;

    portElementVr = (
      <g>
        <rect x={xStartVr - tScale - 1} y={portYVr + 0.5} width={tScale + 2} height={pHeightScaleVr - 1} fill="var(--card-bg)" />
        <path d={topPath} fill="none" stroke="#000000" strokeWidth="2" />
        <path d={botPath} fill="none" stroke="#000000" strokeWidth="2" />
        <line x1={xInnerEndVr} y1={portYVr} x2={xInnerEndVr} y2={portYVr + pHeightScaleVr} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 3" />
        <text x={xStartVr - tScale - pLenScaleVr / 2} y={portYVr - 5} fill="#ec4899" stroke="none" fontSize="9.5" fontWeight="normal" textAnchor="middle">
          Lv2
        </text>
      </g>
    );
  }

  // --- COTAS (Valores formateados) ---
  const hExtDisp = convertTo(hExt, 'length', unitSystem).toFixed(1);
  const wExtDisp = convertTo(wExt, 'length', unitSystem).toFixed(1);
  const hIntDisp = convertTo(hInt, 'length', unitSystem).toFixed(1);
  const dExtDisp = convertTo(dExt, 'length', unitSystem).toFixed(1);
  const tDisp = convertTo(thickness / 10, 'length', unitSystem).toFixed(1);

  // Altura Woofer y Puerto
  const distWooferTop = wooferYCenter - offsetY;
  const distWooferTopDisp = convertTo(distWooferTop / scale, 'length', unitSystem).toFixed(1);

  const distPortBot = (offsetY + plotHeight) - portYCenter;
  const distPortBotDisp = convertTo(distPortBot / scale, 'length', unitSystem).toFixed(1);

  const midX = offsetXSide - 38; // Altura cota central

  // Puertos en Vista Frontal
  const pCount = Number(portCount) || 1;
  const frontPorts: React.JSX.Element[] = [];
  if (boxType === 'ported') {
    const innerWidth = plotWidthFront - 2 * tScale;
    const step = innerWidth / (pCount + 1);

    for (let i = 1; i <= pCount; i++) {
      const cx = offsetXFront + tScale + step * i;
      if (portShape === 'round' || portShape === 'custom') {
        const r = pHeightScale / 2;
        frontPorts.push(
          <g key={`front-port-${i}`}>
            <circle cx={cx} cy={portYCenter} r={r} fill="none" stroke="#000000" strokeWidth="1.75" strokeDasharray={portLocation === 'rear' ? "3 3" : "none"} opacity={portLocation === 'rear' ? 0.4 : 1.0} />
            <circle cx={cx} cy={portYCenter} r={r - 2} fill="none" stroke="#64748b" strokeWidth="0.75" strokeDasharray="2 2" opacity={portLocation === 'rear' ? 0.25 : 0.5} />
            {/* Center crosshair */}
            <line x1={cx - 5} y1={portYCenter} x2={cx + 5} y2={portYCenter} stroke="#10b981" strokeWidth="0.75" strokeDasharray={portLocation === 'rear' ? "2 2" : "5 2"} opacity={portLocation === 'rear' ? 0.25 : 0.5} />
            <line x1={cx} y1={portYCenter - 5} x2={cx} y2={portYCenter + 5} stroke="#10b981" strokeWidth="0.75" strokeDasharray={portLocation === 'rear' ? "2 2" : "5 2"} opacity={portLocation === 'rear' ? 0.25 : 0.5} />
            {portLocation === 'rear' && (
              <text x={cx} y={portYCenter + 2.5} fill="var(--text-muted)" fontSize="7" fontWeight="bold" textAnchor="middle" opacity="0.6">{t("Atrás")}</text>
            )}
          </g>
        );
      } else {
        const w = portWidth * scale;
        const h = pHeightScale;
        const rx = cx - w / 2;
        const ry = portYCenter - h / 2;
        frontPorts.push(
          <g key={`front-port-${i}`}>
            <rect x={rx} y={ry} width={w} height={h} fill="none" stroke="#000000" strokeWidth="1.75" strokeDasharray={portLocation === 'rear' ? "3 3" : "none"} opacity={portLocation === 'rear' ? 0.4 : 1.0} />
            {/* Center crosshair */}
            <line x1={cx - 5} y1={portYCenter} x2={cx + 5} y2={portYCenter} stroke="#10b981" strokeWidth="0.75" strokeDasharray={portLocation === 'rear' ? "2 2" : "5 2"} opacity={portLocation === 'rear' ? 0.25 : 0.5} />
            <line x1={cx} y1={portYCenter - 5} x2={cx} y2={portYCenter + 5} stroke="#10b981" strokeWidth="0.75" strokeDasharray={portLocation === 'rear' ? "2 2" : "5 2"} opacity={portLocation === 'rear' ? 0.25 : 0.5} />
            {portLocation === 'rear' && (
              <text x={cx} y={portYCenter + 2.5} fill="var(--text-muted)" fontSize="7" fontWeight="bold" textAnchor="middle" opacity="0.6">{t("Atrás")}</text>
            )}
          </g>
        );
      }
    }
  }

  const spikeY = offsetY + plotHeight;

  // Render de las puntas de desacoplo (spikes) en el fondo del bafle
  const renderSpikes = () => {
    const frontSpike1X = offsetXFront + tScale + (plotWidthFront - 2 * tScale) * 0.15;
    const frontSpike2X = offsetXFront + plotWidthFront - tScale - (plotWidthFront - 2 * tScale) * 0.15;
    const sideSpike1X = offsetXSide + tScale + (plotWidthSide - 2 * tScale) * 0.15;
    const sideSpike2X = offsetXSide + plotWidthSide - tScale - (plotWidthSide - 2 * tScale) * 0.15;

    const drawSpike = (x: number, key: string) => (
      <g key={key} stroke="#64748b" strokeWidth="0.75" fill="none">
        {/* Cuerpo cónico de la punta */}
        <path d={`M ${x - 3},${spikeY} L ${x + 3},${spikeY} L ${x},${spikeY + 7} Z`} fill="#94a3b8" />
        {/* Tuerca de ajuste */}
        <line x1={x - 4.5} y1={spikeY - 0.75} x2={x + 4.5} y2={spikeY - 0.75} stroke="#334155" strokeWidth="1.5" />
        <rect x={x - 2.5} y={spikeY - 3} width="5" height="2" fill="#64748b" stroke="none" />
      </g>
    );

    return [
      drawSpike(frontSpike1X, 'f-sp-1'),
      drawSpike(frontSpike2X, 'f-sp-2'),
      drawSpike(sideSpike1X, 's-sp-1'),
      drawSpike(sideSpike2X, 's-sp-2')
    ];
  };

  // Render de refuerzos internos (bracing) con orificios en la vista de corte lateral
  const renderBracing = () => {
    const braces: React.JSX.Element[] = [];
    if (isBandpass || !enableBracing || bracingCount <= 0) return braces;
    
    const positions = bracingPositions.slice(0, bracingCount);

    positions.forEach((pos, idx) => {
      const y = offsetY + tScale + pos * innerHeightScale;
      braces.push(
        <g 
          key={`br-${idx}`}
          style={{ cursor: 'ns-resize' }}
          onMouseDown={(e) => handleBracingMouseDown(e, idx)}
          onTouchStart={(e) => handleBracingTouchStart(e, idx)}
          onMouseOver={(e) => {
            const rect = e.currentTarget.querySelector('rect');
            if (rect) {
              rect.setAttribute('fill', 'rgba(0, 120, 212, 0.32)');
              rect.setAttribute('stroke', '#0078d4');
            }
          }}
          onMouseOut={(e) => {
            const rect = e.currentTarget.querySelector('rect');
            if (rect) {
              rect.setAttribute('fill', 'rgba(100, 116, 139, 0.15)');
              rect.setAttribute('stroke', '#475569');
            }
          }}
        >
          {/* Panel de madera del refuerzo */}
          <rect
            x={offsetXSide + tScale}
            y={y - tScale / 2}
            width={plotWidthSide - 2 * tScale}
            height={tScale}
            fill="rgba(100, 116, 139, 0.15)"
            stroke="#475569"
            strokeWidth="1.2"
            style={{ transition: 'all 0.15s ease' }}
          />
          {/* Orificios circulares de paso de aire (elipses de perspectiva) */}
          <ellipse
            cx={offsetXSide + tScale + (plotWidthSide - 2 * tScale) * 0.35}
            cy={y}
            rx={Math.min(8, (plotWidthSide - 2 * tScale) * 0.1)}
            ry={tScale * 0.35}
            fill="var(--card-bg)"
            stroke="#475569"
            strokeWidth="0.8"
          />
          <ellipse
            cx={offsetXSide + tScale + (plotWidthSide - 2 * tScale) * 0.65}
            cy={y}
            rx={Math.min(8, (plotWidthSide - 2 * tScale) * 0.1)}
            ry={tScale * 0.35}
            fill="var(--card-bg)"
            stroke="#475569"
            strokeWidth="0.8"
          />
        </g>
      );
    });
    return braces;
  };

  // Render de líneas de trazo para los refuerzos en la vista frontal
  const renderFrontBraces = () => {
    const lines: React.JSX.Element[] = [];
    if (isBandpass || !enableBracing || bracingCount <= 0) return lines;
    
    const positions = bracingPositions.slice(0, bracingCount);

    positions.forEach((pos, idx) => {
      const y = offsetY + tScale + pos * innerHeightScale;
      lines.push(
        <line
          key={`fb-${idx}`}
          x1={offsetXFront + tScale}
          y1={y}
          x2={offsetXFront + plotWidthFront - tScale}
          y2={y}
          stroke="#0078d4"
          strokeWidth="1.2"
          strokeDasharray="4 3"
          opacity="0.85"
        />
      );
    });
    return lines;
  };



  // Bornes de conexión traseros (binding posts)
  const renderBindingPosts = () => {
    if (isBandpass) return null;
    const yPos = offsetY + plotHeight - tScale - 26;
    const xPos = offsetXSide + plotWidthSide;
    return (
      <g key="binding-posts" opacity="0.9">
        {/* Placa plástica */}
        <rect x={xPos - tScale - 1} y={yPos - 9} width={tScale + 2} height="18" fill="#0f172a" stroke="#000000" strokeWidth="0.8" />
        {/* Borne rojo */}
        <rect x={xPos} y={yPos - 6} width="5" height="3" fill="#dc2626" stroke="#000000" strokeWidth="0.5" rx="0.3" />
        <line x1={xPos - tScale} y1={yPos - 4.5} x2={xPos} y2={yPos - 4.5} stroke="#94a3b8" strokeWidth="1" />
        {/* Borne negro */}
        <rect x={xPos} y={yPos + 3} width="5" height="3" fill="#000000" stroke="#000000" strokeWidth="0.5" rx="0.3" />
        <line x1={xPos - tScale} y1={yPos + 4.5} x2={xPos} y2={yPos + 4.5} stroke="#94a3b8" strokeWidth="1" />
      </g>
    );
  };

  const renderSectionalCrossovers = () => {
    const list: React.JSX.Element[] = [];
    if (isBandpass) return null;
    
    // Draw crossover boards
    if (crossoverWays === 2) {
      // Single board on the back wall near bottom
      const xBoard = offsetXSide + plotWidthSide - tScale - 5 * scale;
      const yBoard = offsetY + plotHeight - tScale - 10 * scale - 4 * scale;
      const wBoard = 4 * scale;
      const hBoard = 10 * scale;
      list.push(
        <g key="xover-board" opacity="0.9">
          <rect x={xBoard} y={yBoard} width={wBoard} height={hBoard} fill="#14532d" stroke="#16a34a" strokeWidth="1" rx="1.5" />
          <line x1={xBoard + wBoard*0.2} y1={yBoard + hBoard*0.2} x2={xBoard + wBoard*0.8} y2={yBoard + hBoard*0.4} stroke="#eab308" strokeWidth="0.8" opacity="0.5" />
          <line x1={xBoard + wBoard*0.8} y1={yBoard + hBoard*0.4} x2={xBoard + wBoard*0.3} y2={yBoard + hBoard*0.8} stroke="#eab308" strokeWidth="0.8" opacity="0.5" />
          <rect x={xBoard + wBoard*0.1} y={yBoard + hBoard*0.15} width={wBoard*0.8} height={hBoard*0.25} fill="#f97316" stroke="#c2410c" strokeWidth="0.75" rx="2" />
          {Array.from({ length: 5 }).map((_, i) => (
            <line
              key={`coil-w-${i}`}
              x1={xBoard + wBoard*0.2 + i * (wBoard*0.5/4)}
              y1={yBoard + hBoard*0.15}
              x2={xBoard + wBoard*0.2 + i * (wBoard*0.5/4)}
              y2={yBoard + hBoard*0.4}
              stroke="#ea580c"
              strokeWidth="1.2"
            />
          ))}
          <rect x={xBoard + wBoard*0.2} y={yBoard + hBoard*0.55} width={wBoard*0.6} height={hBoard*0.3} fill="#0ea5e9" stroke="#0284c7" strokeWidth="0.75" rx="3" />
          <line x1={xBoard + wBoard*0.5} y1={yBoard + hBoard*0.5} x2={xBoard + wBoard*0.5} y2={yBoard + hBoard*0.55} stroke="#cbd5e1" strokeWidth="0.8" />
          <line x1={xBoard + wBoard*0.5} y1={yBoard + hBoard*0.85} x2={xBoard + wBoard*0.5} y2={yBoard + hBoard*0.9} stroke="#cbd5e1" strokeWidth="0.8" />
          <text x={xBoard - 4} y={yBoard + hBoard/2} fill="var(--text-muted)" fontSize="8.5" textAnchor="middle" transform={`rotate(-90 ${xBoard-4} ${yBoard+hBoard/2})`} opacity="0.8">
            {t("Filtro Crossover")}
          </text>
        </g>
      );
    } else if (crossoverWays === 3) {
      // Woofer LF board on bottom wall
      const xBoardLF = offsetXSide + plotWidthSide - tScale - 12 * scale;
      const yBoardLF = offsetY + plotHeight - tScale - 3 * scale;
      const wBoardLF = 10 * scale;
      const hBoardLF = 2.5 * scale;
      list.push(
        <g key="xover-board-lf" opacity="0.9">
          <rect x={xBoardLF} y={yBoardLF} width={wBoardLF} height={hBoardLF} fill="#14532d" stroke="#16a34a" strokeWidth="1" rx="1.5" />
          <rect x={xBoardLF + wBoardLF*0.15} y={yBoardLF + hBoardLF*0.1} width={wBoardLF*0.35} height={hBoardLF*0.8} fill="#f97316" stroke="#c2410c" strokeWidth="0.75" rx="2" />
          {Array.from({ length: 6 }).map((_, i) => (
            <line
              key={`coil-lf-${i}`}
              x1={xBoardLF + wBoardLF*0.18 + i * (wBoardLF*0.28/5)}
              y1={yBoardLF + hBoardLF*0.1}
              x2={xBoardLF + wBoardLF*0.18 + i * (wBoardLF*0.28/5)}
              y2={yBoardLF + hBoardLF*0.9}
              stroke="#ea580c"
              strokeWidth="1.5"
            />
          ))}
          <rect x={xBoardLF + wBoardLF*0.6} y={yBoardLF + hBoardLF*0.2} width={wBoardLF*0.3} height={hBoardLF*0.6} fill="#0ea5e9" stroke="#0284c7" strokeWidth="0.75" rx="3" />
          <text x={xBoardLF + wBoardLF/2} y={yBoardLF - 4} fill="var(--text-muted)" fontSize="8" textAnchor="middle" opacity="0.8">
            {t("LF X-Over")}
          </text>
        </g>
      );

      // Mid/High HF board on back wall
      const xBoardHF = offsetXSide + plotWidthSide - tScale - 5 * scale;
      const yBoardHF = offsetY + tScale + 12 * scale;
      const wBoardHF = 4 * scale;
      const hBoardHF = 8 * scale;
      list.push(
        <g key="xover-board-hf" opacity="0.9">
          <rect x={xBoardHF} y={yBoardHF} width={wBoardHF} height={hBoardHF} fill="#14532d" stroke="#16a34a" strokeWidth="1" rx="1.5" />
          <rect x={xBoardHF + wBoardHF*0.1} y={yBoardHF + hBoardHF*0.15} width={wBoardHF*0.8} height={hBoardHF*0.25} fill="#f97316" stroke="#c2410c" strokeWidth="0.75" rx="1" />
          {Array.from({ length: 4 }).map((_, i) => (
            <line
              key={`coil-hf-${i}`}
              x1={xBoardHF + wBoardHF*0.2 + i * (wBoardHF*0.5/3)}
              y1={yBoardHF + hBoardHF*0.15}
              x2={xBoardHF + wBoardHF*0.2 + i * (wBoardHF*0.5/3)}
              y2={yBoardHF + hBoardHF*0.4}
              stroke="#ea580c"
              strokeWidth="1"
            />
          ))}
          <rect x={xBoardHF + wBoardHF*0.2} y={yBoardHF + hBoardHF*0.55} width={wBoardHF*0.6} height={hBoardHF*0.3} fill="#0ea5e9" stroke="#0284c7" strokeWidth="0.75" rx="2" />
          <text x={xBoardHF - 4} y={yBoardHF + hBoardHF/2} fill="var(--text-muted)" fontSize="8" textAnchor="middle" transform={`rotate(-90 ${xBoardHF-4} ${yBoardHF+hBoardHF/2})`} opacity="0.8">
            {t("MF/HF X-Over")}
          </text>
        </g>
      );
    }
    return list;
  };

  const renderBracingTemplate = () => {
    if (!showBracingTemplate) return null;

    const wInt = cabinetData.wInt;
    const dVal = shape === 'rectangular' ? cabinetData.dInt : ((cabinetData.dTrapTopInt || 0) + (cabinetData.dTrapBotInt || 0)) / 2;
    const offsetYBrace = offsetY + (plotHeight - plotHeightBrace) / 2;

    const outerRect = (
      <rect
        x={offsetXBrace}
        y={offsetYBrace}
        width={plotWidthBrace}
        height={plotHeightBrace}
        fill="rgba(100, 116, 139, 0.1)"
        stroke="#000000"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    );

    const innerBorder = (
      <rect
        x={offsetXBrace + tScale}
        y={offsetYBrace + tScale}
        width={plotWidthBrace - 2 * tScale}
        height={plotHeightBrace - 2 * tScale}
        fill="none"
        stroke="#475569"
        strokeWidth="1.2"
        strokeDasharray="4 3"
      />
    );

    const vertCross = (
      <rect
        x={offsetXBrace + plotWidthBrace / 2 - tScale / 2}
        y={offsetYBrace + tScale}
        width={tScale}
        height={plotHeightBrace - 2 * tScale}
        fill="url(#wood-hatch)"
        stroke="#000000"
        strokeWidth="1"
      />
    );

    const horizCross = (
      <rect
        x={offsetXBrace + tScale}
        y={offsetYBrace + plotHeightBrace / 2 - tScale / 2}
        width={plotWidthBrace - 2 * tScale}
        height={tScale}
        fill="url(#wood-hatch)"
        stroke="#000000"
        strokeWidth="1"
      />
    );

    const qW = (plotWidthBrace - 3 * tScale) / 2;
    const qH = (plotHeightBrace - 3 * tScale) / 2;
    const rHole = Math.min(qW, qH) * 0.75;
    const rHoleMm = Math.round((rHole / scale) * 10);

    const drawHole = (cx: number, cy: number, key: string) => {
      if (rHole <= 4) return null;
      return (
        <g key={key}>
          <circle cx={cx} cy={cy} r={rHole} fill="var(--card-bg)" stroke="#000000" strokeWidth="1.5" />
          <line x1={cx - rHole - 3} y1={cy} x2={cx + rHole + 3} y2={cy} stroke="#10b981" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.6" />
          <line x1={cx} y1={cy - rHole - 3} x2={cx} y2={cy + rHole + 3} stroke="#10b981" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.6" />
        </g>
      );
    };

    const cx1 = offsetXBrace + tScale + qW / 2;
    const cx2 = offsetXBrace + 2 * tScale + qW + qW / 2;
    const cy1 = offsetYBrace + tScale + qH / 2;
    const cy2 = offsetYBrace + 2 * tScale + qH + qH / 2;

    const holes = [
      drawHole(cx1, cy1, 'hole-1'),
      drawHole(cx2, cy1, 'hole-2'),
      drawHole(cx1, cy2, 'hole-3'),
      drawHole(cx2, cy2, 'hole-4'),
    ];

    const dimLineY = offsetYBrace + plotHeightBrace + 20;
    const dimLineX = offsetXBrace - 25;

    return (
      <g key="bracing-template-view">
        <rect
          x={offsetXBrace}
          y={offsetYBrace}
          width={plotWidthBrace}
          height={plotHeightBrace}
          fill="rgba(100, 116, 139, 0.12)"
        />
        <rect
          x={offsetXBrace}
          y={offsetYBrace}
          width={plotWidthBrace}
          height={plotHeightBrace}
          fill="url(#wood-hatch)"
        />

        <rect x={offsetXBrace + tScale} y={offsetYBrace + tScale} width={qW} height={qH} fill="var(--card-bg)" stroke="#000000" strokeWidth="1.2" />
        <rect x={offsetXBrace + 2 * tScale + qW} y={offsetYBrace + tScale} width={qW} height={qH} fill="var(--card-bg)" stroke="#000000" strokeWidth="1.2" />
        <rect x={offsetXBrace + tScale} y={offsetYBrace + 2 * tScale + qH} width={qW} height={qH} fill="var(--card-bg)" stroke="#000000" strokeWidth="1.2" />
        <rect x={offsetXBrace + 2 * tScale + qW} y={offsetYBrace + 2 * tScale + qH} width={qW} height={qH} fill="var(--card-bg)" stroke="#000000" strokeWidth="1.2" />

        {outerRect}
        {innerBorder}
        {vertCross}
        {horizCross}
        {holes}

        {rHole > 4 && (
          <g>
            <text x={cx1} y={cy1 + 2.5} fill="var(--text-muted)" fontSize="8" fontWeight="bold" textAnchor="middle" opacity="0.8">
              Ø{rHoleMm * 2}
            </text>
            <text x={cx2} y={cy1 + 2.5} fill="var(--text-muted)" fontSize="8" fontWeight="bold" textAnchor="middle" opacity="0.8">
              Ø{rHoleMm * 2}
            </text>
            <text x={cx1} y={cy2 + 2.5} fill="var(--text-muted)" fontSize="8" fontWeight="bold" textAnchor="middle" opacity="0.8">
              Ø{rHoleMm * 2}
            </text>
            <text x={cx2} y={cy2 + 2.5} fill="var(--text-muted)" fontSize="8" fontWeight="bold" textAnchor="middle" opacity="0.8">
              Ø{rHoleMm * 2}
            </text>
          </g>
        )}

        <text
          x={offsetXBrace + plotWidthBrace / 2}
          y={offsetY + plotHeight + 48}
          fill="var(--text-muted)"
          fontSize="9.5"
          fontWeight="bold"
          letterSpacing="1px"
          textAnchor="middle"
          opacity="0.6"
        >
          {t("PLANTILLA REFUERZO")}
        </text>

        <g stroke="#64748b" strokeWidth="1.2">
          <line x1={offsetXBrace} y1={dimLineY - 10} x2={offsetXBrace} y2={dimLineY + 5} />
          <line x1={offsetXBrace + plotWidthBrace} y1={dimLineY - 10} x2={offsetXBrace + plotWidthBrace} y2={dimLineY + 5} />
          <line x1={offsetXBrace} y1={dimLineY} x2={offsetXBrace + plotWidthBrace} y2={dimLineY} strokeWidth="1.3" markerStart="url(#tick)" markerEnd="url(#tick)" />
        </g>
        <text
          x={offsetXBrace + plotWidthBrace / 2}
          y={dimLineY + 14}
          fill="#64748b"
          fontSize="11.5"
          fontWeight="normal"
          textAnchor="middle"
        >
          {convertTo(wInt, 'length', unitSystem).toFixed(1)} {uLabel}
        </text>

        <g stroke="#64748b" strokeWidth="1.2">
          <line x1={dimLineX - 10} y1={offsetYBrace} x2={dimLineX + 5} y2={offsetYBrace} />
          <line x1={dimLineX - 10} y1={offsetYBrace + plotHeightBrace} x2={dimLineX + 5} y2={offsetYBrace + plotHeightBrace} />
          <line x1={dimLineX} y1={offsetYBrace} x2={dimLineX} y2={offsetYBrace + plotHeightBrace} strokeWidth="1.3" markerStart="url(#tick)" markerEnd="url(#tick)" />
        </g>
        <text
          x={dimLineX - 8}
          y={offsetYBrace + plotHeightBrace / 2 + 4}
          fill="#64748b"
          fontSize="11.5"
          fontWeight="normal"
          textAnchor="end"
        >
          {convertTo(dVal, 'length', unitSystem).toFixed(1)}
        </text>
      </g>
    );
  };

  return (
    <div style={{
      background: 'var(--card-bg)',
      borderRadius: '12px',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '100%',
      boxSizing: 'border-box',
      backdropFilter: 'blur(16px)'
    }}>
      <span className="control-title" style={{ alignSelf: 'flex-start', fontSize: '0.75rem', color: 'var(--text-main)', marginBottom: '0.25rem', fontWeight: 600 }}>
        {t("Plano de Fabricación de la Cabina")}
      </span>

      <svg width="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} fill="none" style={{ maxWidth: '100%' }}>
        {/* Cuadrícula de fondo sutil y patrones CAD */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--text-muted)" strokeWidth="1" opacity="0.08" />
          </pattern>
          <pattern id="wood-hatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(100, 116, 139, 0.45)" strokeWidth="0.8" />
          </pattern>
          <marker id="tick" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <line x1="1" y1="9" x2="9" y2="1" stroke="#64748b" strokeWidth="1.5" />
          </marker>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" rx="8" />

        {/* --- DIBUJO VISTA FRONTAL --- */}
        <path d={`${frontExtPath} ${frontIntPath}`} fill="rgba(100, 116, 139, 0.12)" fillRule="evenodd" />
        <path d={`${frontExtPath} ${frontIntPath}`} fill="url(#wood-hatch)" fillRule="evenodd" />
        <path d={frontExtPath} stroke="#000000" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
        <path d={frontIntPath} stroke="#000000" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
        
        {/* Biseles y chaflanes decorativos (CAD style) */}
        <path d={`M ${offsetXFront},${offsetY + 12} L ${offsetXFront + 12},${offsetY} M ${offsetXFront + plotWidthFront},${offsetY + 12} L ${offsetXFront + plotWidthFront - 12},${offsetY}`} stroke="#000000" strokeWidth="0.75" opacity="0.65" />
        <text x={offsetXFront + 16} y={offsetY + 16} fill="var(--text-muted)" fontSize="7" opacity="0.6">20°</text>
        <text x={offsetXFront + plotWidthFront - 16} y={offsetY + 16} fill="var(--text-muted)" fontSize="7" textAnchor="end" opacity="0.6">20°</text>

        {isBandpass ? frontSpeaker : (
          <g>
            {layout.map((d, idx) => (
              <g key={idx}>
                {/* Flange / Suspensión externa (Concéntrica) */}
                <circle cx={wooferX} cy={d.yCenter} r={d.rOuter} fill="none" stroke={speakerStroke} strokeWidth="1.75" opacity={speakerOpacity} />
                <circle cx={wooferX} cy={d.yCenter} r={d.rOuter - 2.5} fill="none" stroke="#64748b" strokeWidth="0.75" opacity={0.6} />
                
                {/* Cono & Borde de la suspensión */}
                {d.type !== 'tweeter' && (
                  <circle cx={wooferX} cy={d.yCenter} r={d.rOuter - 5.5} fill="none" stroke="#475569" strokeWidth="0.75" opacity="0.5" />
                )}
                <circle cx={wooferX} cy={d.yCenter} r={d.rOuter * 0.78} fill={d.color} opacity={0.10} stroke={d.color} strokeWidth="0.75" />
                <circle cx={wooferX} cy={d.yCenter} r={d.rOuter * 0.78 - 2.5} fill="none" stroke="#64748b" strokeWidth="0.6" opacity={0.8} />

                {/* Cubrepolvo */}
                <circle cx={wooferX} cy={d.yCenter} r={d.rOuter * 0.25} fill="none" stroke={speakerStroke} strokeWidth="1.25" opacity={speakerOpacity} />

                {/* Ejes técnicos */}
                <line x1={wooferX - d.rOuter - 4} y1={d.yCenter} x2={wooferX + d.rOuter + 4} y2={d.yCenter} stroke="#10b981" strokeWidth="0.6" strokeDasharray="5 2 2 2" opacity="0.45" />
                <line x1={wooferX} y1={d.yCenter - d.rOuter - 4} x2={wooferX} y2={d.yCenter + d.rOuter + 4} stroke="#10b981" strokeWidth="0.6" strokeDasharray="5 2 2 2" opacity="0.45" />

                {/* Etiqueta */}
                <text x={wooferX} y={d.yCenter + 2.5} fill="var(--text-muted)" fontSize="7" fontWeight="bold" textAnchor="middle" opacity="0.75">{d.label}</text>
              </g>
            ))}
          </g>
        )}
        {frontPorts}
        {renderFrontBraces()}

        {/* --- DIBUJO SECCIÓN LATERAL --- */}
        <path d={`${extPath} ${intPath}`} fill="rgba(100, 116, 139, 0.12)" fillRule="evenodd" />
        <path d={`${extPath} ${intPath}`} fill="url(#wood-hatch)" fillRule="evenodd" />
        <path d={extPath} stroke="#000000" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
        <path d={intPath} stroke="#000000" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
        
        {/* Doble espesor del bafle frontal (Sección lateral) */}
        <line x1={offsetXSide + tScale / 2} y1={offsetY + tScale} x2={offsetXSide + tScale / 2} y2={offsetY + plotHeight - tScale} stroke="#000000" strokeWidth="0.75" strokeDasharray="3 3" opacity="0.5" />
        
        {renderBracing()}
        {renderBindingPosts()}
        {renderSpikes()}

        {bandpassDivider}
        {speakerConeStandard}
        {speakerMagnetStandard}
        {speakerConeBP}
        {speakerMagnetBP}
        {portElement}
        {portElementVr}
        {internalPartitions}
        {renderSectionalCrossovers()}

        {/* Volumen interior etiqueta (Vb o Vf/Vr en círculos) */}
        {!isBandpass ? (
          <text
            x={offsetXSide + plotWidthSide / 2}
            y={offsetY + plotHeight / 2}
            fill="var(--text-muted)"
            fontSize="13"
            fontWeight="normal"
            textAnchor="middle"
            opacity="0.35"
          >
            Vb
          </text>
        ) : (
          <>
            {/* Círculo indicador Cámara Delantera Vb1 / Vd */}
            <g opacity="0.75">
              <circle
                cx={offsetXSide + tScale + (xDividerClamped - offsetXSide - tScale) / 2}
                cy={offsetY + plotHeight / 2}
                r="16"
                fill="var(--card-bg)"
                stroke="var(--text-muted)"
                strokeWidth="1.2"
              />
              <text
                x={offsetXSide + tScale + (xDividerClamped - offsetXSide - tScale) / 2}
                y={offsetY + plotHeight / 2 + 3.5}
                fill="var(--text-main)"
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
              >
                {bandpassOrder === 6 ? 'Vb1' : 'Vd'}
              </text>
            </g>

            {/* Círculo indicador Cámara Trasera Vb2 / Vc */}
            <g opacity="0.75">
              <circle
                cx={xDividerClamped + tScale + (offsetXSide + plotWidthSide - tScale - (xDividerClamped + tScale)) / 2}
                cy={offsetY + plotHeight / 2}
                r="16"
                fill="var(--card-bg)"
                stroke="var(--text-muted)"
                strokeWidth="1.2"
              />
              <text
                x={xDividerClamped + tScale + (offsetXSide + plotWidthSide - tScale - (xDividerClamped + tScale)) / 2}
                y={offsetY + plotHeight / 2 + 3.5}
                fill="var(--text-main)"
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
              >
                {bandpassOrder === 6 ? 'Vb2' : 'Vc'}
              </text>
            </g>
          </>
        )}

        {/* --- TITULOS DE VISTAS (CAD Style) --- */}
        <text
          x={offsetXFront + plotWidthFront / 2}
          y={offsetY + plotHeight + 48}
          fill="var(--text-muted)"
          fontSize="9.5"
          fontWeight="bold"
          letterSpacing="1px"
          textAnchor="middle"
          opacity="0.6"
        >
          {t("VISTA FRONTAL")}
        </text>
        <text
          x={offsetXSide + plotWidthSide / 2}
          y={offsetY + plotHeight + 48}
          fill="var(--text-muted)"
          fontSize="9.5"
          fontWeight="bold"
          letterSpacing="1px"
          textAnchor="middle"
          opacity="0.6"
        >
          {t("CORTE SECCIÓN A-A")}
        </text>

        {/* --- ACOTACIONES (Estilo CAD / Arquitectónico) --- */}

        {/* Cota Altura Externa (Central / Compartida) */}
        <g stroke="#64748b" strokeWidth="1.2">
          <line x1={midX - 10} y1={offsetY} x2={midX + 10} y2={offsetY} />
          <line x1={midX - 10} y1={offsetY + plotHeight} x2={midX + 10} y2={offsetY + plotHeight} />
          <line x1={midX} y1={offsetY} x2={midX} y2={offsetY + plotHeight} strokeWidth="1.3" markerStart="url(#tick)" markerEnd="url(#tick)" />
        </g>
        <text
          x={midX - 8}
          y={offsetY + plotHeight / 2 + 4}
          fill="#64748b"
          fontSize="11.5"
          fontWeight="normal"
          textAnchor="end"
        >
          {hExtDisp}
        </text>

        {/* Cota Ancho Externo (Abajo Vista Frontal) */}
        <g stroke="#64748b" strokeWidth="1.2">
          <line x1={offsetXFront} y1={offsetY + plotHeight + 10} x2={offsetXFront} y2={offsetY + plotHeight + 25} />
          <line x1={offsetXFront + plotWidthFront} y1={offsetY + plotHeight + 10} x2={offsetXFront + plotWidthFront} y2={offsetY + plotHeight + 25} />
          <line x1={offsetXFront} y1={offsetY + plotHeight + 20} x2={offsetXFront + plotWidthFront} y2={offsetY + plotHeight + 20} strokeWidth="1.3" markerStart="url(#tick)" markerEnd="url(#tick)" />
        </g>
        <text
          x={offsetXFront + plotWidthFront / 2}
          y={offsetY + plotHeight + 34}
          fill="#64748b"
          fontSize="11.5"
          fontWeight="normal"
          textAnchor="middle"
        >
          {wExtDisp} {uLabel}
        </text>

        {/* Cota Profundidad Externa (Sección Lateral) */}
        {shape === 'rectangular' ? (
          <g stroke="#64748b" strokeWidth="1.2">
            <line x1={offsetXSide} y1={offsetY + plotHeight + 10} x2={offsetXSide} y2={offsetY + plotHeight + 25} />
            <line x1={offsetXSide + plotWidthSide} y1={offsetY + plotHeight + 10} x2={offsetXSide + plotWidthSide} y2={offsetY + plotHeight + 25} />
            <line x1={offsetXSide} y1={offsetY + plotHeight + 20} x2={offsetXSide + plotWidthSide} y2={offsetY + plotHeight + 20} strokeWidth="1.3" markerStart="url(#tick)" markerEnd="url(#tick)" />
            <text
              x={offsetXSide + plotWidthSide / 2}
              y={offsetY + plotHeight + 34}
              fill="#64748b"
              stroke="none"
              fontSize="11.5"
              fontWeight="normal"
              textAnchor="middle"
            >
              {dExtDisp} {uLabel}
            </text>
          </g>
        ) : (
          // Trapezoidal - Cotas de profundidad superior e inferior
          <g stroke="#64748b" strokeWidth="1.2">
            {/* Superior */}
            <line x1={offsetXSide} y1={offsetY - 25} x2={offsetXSide} y2={offsetY - 10} />
            <line x1={offsetXSide + (dTrapTopExt || 0) * scale} y1={offsetY - 25} x2={offsetXSide + (dTrapTopExt || 0) * scale} y2={offsetY - 10} />
            <line x1={offsetXSide} y1={offsetY - 20} x2={offsetXSide + (dTrapTopExt || 0) * scale} y2={offsetY - 20} strokeWidth="1.3" markerStart="url(#tick)" markerEnd="url(#tick)" />
            <text
              x={offsetXSide + ((dTrapTopExt || 0) * scale) / 2}
              y={offsetY - 28}
              fill="#64748b"
              stroke="none"
              fontSize="11"
              fontWeight="normal"
              textAnchor="middle"
            >
              {convertTo(dTrapTopExt || 0, 'length', unitSystem).toFixed(1)}
            </text>

            {/* Inferior */}
            <line x1={offsetXSide} y1={offsetY + plotHeight + 10} x2={offsetXSide} y2={offsetY + plotHeight + 25} />
            <line x1={offsetXSide + (dTrapBotExt || 0) * scale} y1={offsetY + plotHeight + 10} x2={offsetXSide + (dTrapBotExt || 0) * scale} y2={offsetY + plotHeight + 25} />
            <line x1={offsetXSide} y1={offsetY + plotHeight + 20} x2={offsetXSide + (dTrapBotExt || 0) * scale} y2={offsetY + plotHeight + 20} strokeWidth="1.3" markerStart="url(#tick)" markerEnd="url(#tick)" />
            <text
              x={offsetXSide + ((dTrapBotExt || 0) * scale) / 2}
              y={offsetY + plotHeight + 34}
              fill="#64748b"
              stroke="none"
              fontSize="11"
              fontWeight="normal"
              textAnchor="middle"
            >
              {convertTo(dTrapBotExt || 0, 'length', unitSystem).toFixed(1)} {uLabel}
            </text>
          </g>
        )}

        {/* Cadena de Acotación de Alturas en Vista Frontal (Izquierda) */}
        <g stroke="#64748b" strokeWidth="1.2">
          {/* Cota Altura Centro Altavoz desde Arriba */}
          <line x1={offsetXFront - 21} y1={offsetY} x2={offsetXFront - 11} y2={offsetY} />
          <line x1={offsetXFront - 21} y1={wooferYCenter} x2={offsetXFront - 11} y2={wooferYCenter} />
          <line x1={offsetXFront - 16} y1={offsetY} x2={offsetXFront - 16} y2={wooferYCenter} strokeWidth="1.3" markerStart="url(#tick)" markerEnd="url(#tick)" />
          <text
            x={offsetXFront - 22}
            y={offsetY + distWooferTop / 2 + 4}
            fill="#64748b"
            stroke="none"
            fontSize="11"
            fontWeight="normal"
            textAnchor="end"
          >
            {distWooferTopDisp}
          </text>

          {/* Cota Altura Centro Puerto desde Abajo (si aplica) */}
          {boxType === 'ported' && (
            <>
              <line x1={offsetXFront - 21} y1={portYCenter} x2={offsetXFront - 11} y2={portYCenter} />
              <line x1={offsetXFront - 21} y1={offsetY + plotHeight} x2={offsetXFront - 11} y2={offsetY + plotHeight} />
              <line x1={offsetXFront - 16} y1={portYCenter} x2={offsetXFront - 16} y2={offsetY + plotHeight} strokeWidth="1.3" markerStart="url(#tick)" markerEnd="url(#tick)" />
              <text
                x={offsetXFront - 22}
                y={portYCenter + distPortBot / 2 + 4}
                fill="#64748b"
                stroke="none"
                fontSize="11"
                fontWeight="normal"
                textAnchor="end"
              >
                {distPortBotDisp}
              </text>
            </>
          )}
        </g>

        {/* Cota Altura Interna (Izquierda/Dentro de la sección) */}
        <g stroke="#64748b" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.65">
          <line x1={offsetXSide + tScale} y1={offsetY + tScale} x2={offsetXSide + tScale + 15} y2={offsetY + tScale} strokeDasharray="none" />
          <line x1={offsetXSide + tScale} y1={offsetY + plotHeight - tScale} x2={offsetXSide + tScale + 15} y2={offsetY + plotHeight - tScale} strokeDasharray="none" />
          <line x1={offsetXSide + tScale + 10} y1={offsetY + tScale} x2={offsetXSide + tScale + 10} y2={offsetY + plotHeight - tScale} strokeDasharray="none" markerStart="url(#tick)" markerEnd="url(#tick)" />
        </g>
        <text
          x={offsetXSide + tScale + 15}
          y={offsetY + tScale + 20}
          fill="#64748b"
          fontSize="11"
          fontWeight="normal"
        >
          {hIntDisp}
        </text>

        {/* Cota Espesor Madera (Arriba Izquierda de la sección) */}
        <g stroke="#64748b" strokeWidth="1.2">
          <line x1={offsetXSide} y1={offsetY - 15} x2={offsetXSide} y2={offsetY + 5} />
          <line x1={offsetXSide + tScale} y1={offsetY - 15} x2={offsetXSide + tScale} y2={offsetY + 5} />
          <line x1={offsetXSide} y1={offsetY - 10} x2={offsetXSide + tScale} y2={offsetY - 10} strokeWidth="1.3" markerStart="url(#tick)" markerEnd="url(#tick)" />
        </g>
        <text
          x={offsetXSide + tScale / 2}
          y={offsetY - 15}
          fill="#64748b"
          fontSize="9.5"
          fontWeight="normal"
          textAnchor="middle"
        >
          {tDisp}
        </text>

        {/* --- CAPAS DE SELECCIÓN/HIGHLIGHT --- */}
        {hoveredPieceIndex !== null && (() => {
          const highlightColor = "rgba(245, 158, 11, 0.35)";
          const strokeColor = "#f59e0b";
          const dTop = (dTrapTopExt || 0) * scale;
          const dBot = (dTrapBotExt || 0) * scale;

          if (shape === 'rectangular') {
            // Index 0: Caras Laterales (Izquierda y Derecha)
            if (hoveredPieceIndex === 0) {
              return (
                <g>
                  {/* Frontal left */}
                  <rect x={offsetXFront} y={offsetY} width={tScale} height={plotHeight} fill={highlightColor} stroke={strokeColor} strokeWidth="1.5" />
                  {/* Frontal right */}
                  <rect x={offsetXFront + plotWidthFront - tScale} y={offsetY} width={tScale} height={plotHeight} fill={highlightColor} stroke={strokeColor} strokeWidth="1.5" />
                  {/* Lateral internal background (cut open side) */}
                  <rect x={offsetXSide + tScale} y={offsetY + tScale} width={plotWidthSide - 2 * tScale} height={plotHeight - 2 * tScale} fill={highlightColor} opacity="0.3" stroke="none" />
                </g>
              );
            }
            // Index 1: Tapas (Superior e Inferior)
            if (hoveredPieceIndex === 1) {
              return (
                <g>
                  {/* Frontal top */}
                  <rect x={offsetXFront + tScale} y={offsetY} width={plotWidthFront - 2 * tScale} height={tScale} fill={highlightColor} stroke={strokeColor} strokeWidth="1.5" />
                  {/* Frontal bottom */}
                  <rect x={offsetXFront + tScale} y={offsetY + plotHeight - tScale} width={plotWidthFront - 2 * tScale} height={tScale} fill={highlightColor} stroke={strokeColor} strokeWidth="1.5" />
                  {/* Lateral top */}
                  <rect x={offsetXSide} y={offsetY} width={plotWidthSide} height={tScale} fill={highlightColor} stroke={strokeColor} strokeWidth="1.5" />
                  {/* Lateral bottom */}
                  <rect x={offsetXSide} y={offsetY + plotHeight - tScale} width={plotWidthSide} height={tScale} fill={highlightColor} stroke={strokeColor} strokeWidth="1.5" />
                </g>
              );
            }
            // Index 2: Caras (Frontal y Trasera)
            if (hoveredPieceIndex === 2) {
              return (
                <g>
                  {/* Frontal Baffle */}
                  <rect x={offsetXFront + tScale} y={offsetY + tScale} width={plotWidthFront - 2 * tScale} height={plotHeight - 2 * tScale} fill={highlightColor} stroke={strokeColor} strokeWidth="1.5" />
                  {/* Lateral left (front panel profile) */}
                  <rect x={offsetXSide} y={offsetY + tScale} width={tScale} height={plotHeight - 2 * tScale} fill={highlightColor} stroke={strokeColor} strokeWidth="1.5" />
                  {/* Lateral right (rear panel profile) */}
                  <rect x={offsetXSide + plotWidthSide - tScale} y={offsetY + tScale} width={tScale} height={plotHeight - 2 * tScale} fill={highlightColor} stroke={strokeColor} strokeWidth="1.5" />
                </g>
              );
            }
            // Index 3: Divisor Interno (Bafle de Montaje para Paso Banda)
            if (hoveredPieceIndex === 3 && isBandpass) {
              return (
                <rect
                  x={xDividerClamped}
                  y={offsetY + tScale}
                  width={tScale}
                  height={plotHeight - 2 * tScale}
                  fill={highlightColor}
                  stroke={strokeColor}
                  strokeWidth="1.5"
                />
              );
            }
          } else {
            // Trapezoidal
            // Index 0: Caras Laterales (Trapecios Inclinados)
            if (hoveredPieceIndex === 0) {
              return (
                <g>
                  {/* Frontal left */}
                  <rect x={offsetXFront} y={offsetY} width={tScale} height={plotHeight} fill={highlightColor} stroke={strokeColor} strokeWidth="1.5" />
                  {/* Frontal right */}
                  <rect x={offsetXFront + plotWidthFront - tScale} y={offsetY} width={tScale} height={plotHeight} fill={highlightColor} stroke={strokeColor} strokeWidth="1.5" />
                  {/* Section internal background (cut open side) */}
                  <polygon points={`${offsetXSide + tScale},${offsetY + tScale} ${offsetXSide + dTop - tScale},${offsetY + tScale} ${offsetXSide + dBot - tScale},${offsetY + plotHeight - tScale} ${offsetXSide + tScale},${offsetY + plotHeight - tScale}`} fill={highlightColor} opacity="0.3" stroke="none" />
                </g>
              );
            }
            // Index 1: Tapa Superior
            if (hoveredPieceIndex === 1) {
              return (
                <g>
                  {/* Frontal top */}
                  <rect x={offsetXFront + tScale} y={offsetY} width={plotWidthFront - 2 * tScale} height={tScale} fill={highlightColor} stroke={strokeColor} strokeWidth="1.5" />
                  {/* Section top */}
                  <rect x={offsetXSide} y={offsetY} width={dTop} height={tScale} fill={highlightColor} stroke={strokeColor} strokeWidth="1.5" />
                </g>
              );
            }
            // Index 2: Tapa Inferior
            if (hoveredPieceIndex === 2) {
              return (
                <g>
                  {/* Frontal bottom */}
                  <rect x={offsetXFront + tScale} y={offsetY + plotHeight - tScale} width={plotWidthFront - 2 * tScale} height={tScale} fill={highlightColor} stroke={strokeColor} strokeWidth="1.5" />
                  {/* Section bottom */}
                  <rect x={offsetXSide} y={offsetY + plotHeight - tScale} width={dBot} height={tScale} fill={highlightColor} stroke={strokeColor} strokeWidth="1.5" />
                </g>
              );
            }
            // Index 3: Cara Trasera (Recta)
            if (hoveredPieceIndex === 3) {
              return (
                <g>
                  {/* Section rear profile (left) */}
                  <rect x={offsetXSide} y={offsetY + tScale} width={tScale} height={plotHeight - 2 * tScale} fill={highlightColor} stroke={strokeColor} strokeWidth="1.5" />
                </g>
              );
            }
            // Index 4: Cara Frontal (Inclinada - Bafle)
            if (hoveredPieceIndex === 4) {
              const pathSlant = `M ${offsetXSide + dTop - tScale},${offsetY + tScale} 
                                 L ${offsetXSide + dTop},${offsetY + tScale} 
                                 L ${offsetXSide + dBot},${offsetY + plotHeight - tScale} 
                                 L ${offsetXSide + dBot - tScale},${offsetY + plotHeight - tScale} Z`;
              return (
                <g>
                  {/* Frontal Baffle */}
                  <rect x={offsetXFront + tScale} y={offsetY + tScale} width={plotWidthFront - 2 * tScale} height={plotHeight - 2 * tScale} fill={highlightColor} stroke={strokeColor} strokeWidth="1.5" />
                  {/* Section front profile (slanted) */}
                  <path d={pathSlant} fill={highlightColor} stroke={strokeColor} strokeWidth="1.5" />
                </g>
              );
            }
            // Index 5: Divisor Interno (Bafle de Montaje para Paso Banda)
            if (hoveredPieceIndex === 5 && isBandpass) {
              return (
                <rect
                  x={xDividerClamped}
                  y={offsetY + tScale}
                  width={tScale}
                  height={plotHeight - 2 * tScale}
                  fill={highlightColor}
                  stroke={strokeColor}
                  strokeWidth="1.5"
                />
              );
            }
          }
          return null;
        })()}
        {renderBracingTemplate()}
      </svg>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
        * {t("Representación técnica (Vistas Frontal y de Sección Lateral). Todas las cotas están en")}{' '}{uLabel}.
      </div>
    </div>
  );
};
