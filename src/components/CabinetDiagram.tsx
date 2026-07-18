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
  bandpassOrder?: 4 | 6;
  bandpassRatio?: number;
  bandpassVf?: number;
  bandpassVr?: number;
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
  bandpassOrder = 4,
  bandpassRatio = 0.5,
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

  // Dimensiones dinámicas totales del lienzo (viewBox)
  const svgWidth = offsetXSide + plotWidthSide + paddingRight;
  const svgHeight = paddingTop + plotHeight + paddingBottom;

  // Grosor de madera en la escala
  const tScale = (thickness / 10) * scale; // thickness viene en mm, pasamos a cm

  // Inner height in scale
  const innerHeightScale = plotHeight - 2 * tScale;

  // Bandpass helper coordinates
  const isBandpass = boxType === 'bandpass';
  const bandpassRatioVal = bandpassRatio !== undefined ? bandpassRatio : 0.5;
  const innerWidthSide = plotWidthSide - 2 * tScale;
  const xDivider = offsetXSide + tScale + innerWidthSide * (1 - bandpassRatioVal);
  const xDividerClamped = Math.min(offsetXSide + tScale + innerWidthSide * 0.75, Math.max(offsetXSide + tScale + innerWidthSide * 0.25, xDivider));

  // --- VISTA FRONTAL (Coordenadas) ---
  const frontExtPath = `M ${offsetXFront},${offsetY} L ${offsetXFront + plotWidthFront},${offsetY} L ${offsetXFront + plotWidthFront},${offsetY + plotHeight} L ${offsetXFront},${offsetY + plotHeight} Z`;
  const frontIntPath = `M ${offsetXFront + tScale},${offsetY + tScale} L ${offsetXFront + plotWidthFront - tScale},${offsetY + tScale} L ${offsetXFront + plotWidthFront - tScale},${offsetY + plotHeight - tScale} L ${offsetXFront + tScale},${offsetY + plotHeight - tScale} Z`;

  // Altavoz en Vista Frontal (Woofer)
  const wooferH = Math.min(plotHeight * 0.5, 80); // Alto del altavoz en el dibujo
  const rOuter = wooferH / 2;
  const rInner = rOuter * 0.8;
  const rCap = rOuter * 0.25;

  // Clamp speaker vertical position to stay inside internal limits
  const minSpeakerY = offsetY + tScale + rOuter;
  const maxSpeakerY = offsetY + plotHeight - tScale - rOuter;
  const wooferYCenter = Math.min(maxSpeakerY, Math.max(minSpeakerY, offsetY + tScale + (speakerYPct / 100) * innerHeightScale));
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
  const wooferDepth = Math.min(plotWidthSide * 0.4, 50);
  const speakerConeStandard = !isBandpass ? (
    <path
      d={`M ${offsetXSide + tScale},${wooferY} 
          Q ${offsetXSide + tScale + wooferDepth * 0.1},${wooferY + wooferH * 0.15} ${offsetXSide + tScale + wooferDepth * 0.6},${wooferY + wooferH * 0.35}
          L ${offsetXSide + tScale + wooferDepth * 0.6},${wooferY + wooferH * 0.65}
          Q ${offsetXSide + tScale + wooferDepth * 0.1},${wooferY + wooferH * 0.85} ${offsetXSide + tScale},${wooferY + wooferH}
          L ${offsetXSide + tScale},${wooferY + wooferH - 5}
          Q ${offsetXSide + tScale + wooferDepth * 0.15},${wooferY + wooferH * 0.8} ${offsetXSide + tScale + wooferDepth * 0.55},${wooferY + wooferH * 0.6}
          L ${offsetXSide + tScale + wooferDepth * 0.55},${wooferY + wooferH * 0.4}
          Q ${offsetXSide + tScale + wooferDepth * 0.15},${wooferY + wooferH * 0.2} ${offsetXSide + tScale},${wooferY + 5} Z`}
      fill="#38bdf8"
      opacity="0.85"
    />
  ) : null;

  const speakerMagnetStandard = !isBandpass ? (
    <g>
      <line x1={offsetXSide + tScale + wooferDepth * 0.55} y1={wooferY + wooferH * 0.4} x2={offsetXSide + tScale + wooferDepth * 0.85} y2={wooferY + wooferH * 0.45} stroke="#000000" strokeWidth="2" />
      <line x1={offsetXSide + tScale + wooferDepth * 0.55} y1={wooferY + wooferH * 0.6} x2={offsetXSide + tScale + wooferDepth * 0.85} y2={wooferY + wooferH * 0.55} stroke="#000000" strokeWidth="2" />
      <rect
        x={offsetXSide + tScale + wooferDepth * 0.8}
        y={wooferY + wooferH * 0.42}
        width={wooferDepth * 0.25}
        height={wooferH * 0.16}
        fill="#475569"
        stroke="#000000"
        strokeWidth="1.5"
        rx="2"
      />
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

  // Puerto de perfil izquierdo (Vf / Vb1) - Ubicado abajo en la base de la caja
  let portElement = null;
  if (boxType === 'ported' || boxType === 'bandpass') {
    const effectivePortLength = portLength > 0 ? portLength : (isBandpass ? 12 : 15);
    const pLenScale = effectivePortLength * scale;
    const portYSide = isBandpass 
      ? offsetY + plotHeight - tScale - pHeightScale - 12 
      : portY;

    portElement = (
      <g>
        <rect x={offsetXSide - 1} y={portYSide + 0.5} width={tScale + 2} height={pHeightScale - 1} fill="var(--card-bg)" />
        <line x1={offsetXSide} y1={portYSide} x2={offsetXSide + tScale + pLenScale} y2={portYSide} stroke="#000000" strokeWidth="2" />
        <line x1={offsetXSide} y1={portYSide + pHeightScale} x2={offsetXSide + tScale + pLenScale} y2={portYSide + pHeightScale} stroke="#000000" strokeWidth="2" />
        <line x1={offsetXSide + tScale + pLenScale} y1={portYSide} x2={offsetXSide + tScale + pLenScale} y2={portYSide + pHeightScale} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 3" />
        <text x={offsetXSide + tScale + pLenScale / 2} y={portYSide - 5} fill="#10b981" stroke="none" fontSize="9.5" fontWeight="normal" textAnchor="middle">
          {isBandpass 
            ? `Lv1: ${convertTo(effectivePortLength, 'length', unitSystem).toFixed(1)}${uLabel}` 
            : `Lv: ${portLength > 0 ? convertTo(portLength, 'length', unitSystem).toFixed(1) : 'N/A'}${uLabel}`}
        </text>
      </g>
    );
  }

  // Puerto de perfil derecho (Vr / Vb2, 6º Orden) - Ubicado abajo a la derecha
  let portElementVr = null;
  if (isBandpass && bandpassOrder === 6) {
    const pHeightScaleVr = pHeightScale;
    const pLenScaleVr = 12 * scale; // 12cm visual
    const portYVr = offsetY + plotHeight - tScale - pHeightScaleVr - 12; // Mismo alto que el puerto izquierdo
    const xStartVr = offsetXSide + plotWidthSide;
    portElementVr = (
      <g>
        <rect x={xStartVr - tScale - 1} y={portYVr + 0.5} width={tScale + 2} height={pHeightScaleVr - 1} fill="var(--card-bg)" />
        <line x1={xStartVr} y1={portYVr} x2={xStartVr - tScale - pLenScaleVr} y2={portYVr} stroke="#000000" strokeWidth="2" />
        <line x1={xStartVr} y1={portYVr + pHeightScaleVr} x2={xStartVr - tScale - pLenScaleVr} y2={portYVr + pHeightScaleVr} stroke="#000000" strokeWidth="2" />
        <line x1={xStartVr - tScale - pLenScaleVr} y1={portYVr} x2={xStartVr - tScale - pLenScaleVr} y2={portYVr + pHeightScaleVr} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 3" />
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
            <circle cx={cx} cy={portYCenter} r={r} fill="none" stroke="#000000" strokeWidth="1.75" />
            <circle cx={cx} cy={portYCenter} r={r - 2} fill="none" stroke="#64748b" strokeWidth="0.75" strokeDasharray="2 2" opacity="0.5" />
            {/* Center crosshair */}
            <line x1={cx - 5} y1={portYCenter} x2={cx + 5} y2={portYCenter} stroke="#10b981" strokeWidth="0.75" strokeDasharray="5 2" opacity="0.5" />
            <line x1={cx} y1={portYCenter - 5} x2={cx} y2={portYCenter + 5} stroke="#10b981" strokeWidth="0.75" strokeDasharray="5 2" opacity="0.5" />
          </g>
        );
      } else {
        const w = portWidth * scale;
        const h = pHeightScale;
        const rx = cx - w / 2;
        const ry = portYCenter - h / 2;
        frontPorts.push(
          <g key={`front-port-${i}`}>
            <rect x={rx} y={ry} width={w} height={h} fill="none" stroke="#000000" strokeWidth="1.75" />
            {/* Center crosshair */}
            <line x1={cx - 5} y1={portYCenter} x2={cx + 5} y2={portYCenter} stroke="#10b981" strokeWidth="0.75" strokeDasharray="5 2" opacity="0.5" />
            <line x1={cx} y1={portYCenter - 5} x2={cx} y2={portYCenter + 5} stroke="#10b981" strokeWidth="0.75" strokeDasharray="5 2" opacity="0.5" />
          </g>
        );
      }
    }
  }

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
      <span className="control-title" style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>
        {t("Plano de Fabricación de la Cabina")}
      </span>

      <svg width="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} fill="none" style={{ maxWidth: '100%' }}>
        {/* Cuadrícula de fondo sutil */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--text-muted)" strokeWidth="1" opacity="0.08" />
          </pattern>
          {/* Gradientes Premium */}
          <linearGradient id="wood-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.14" />
          </linearGradient>
          <radialGradient id="speaker-cone-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
            <stop offset="70%" stopColor="#0284c7" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--card-bg)" stopOpacity="0.1" />
          </radialGradient>
          <linearGradient id="cota-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" rx="12" style={{ stroke: 'var(--border-color)', strokeWidth: 1 }} />

        {/* --- DIBUJO VISTA FRONTAL --- */}
        <path d={`${frontExtPath} ${frontIntPath}`} fill="url(#wood-gradient)" fillRule="evenodd" />
        <path d={frontExtPath} stroke="var(--text-main)" strokeWidth="2.5" strokeLinejoin="round" fill="none" opacity="0.85" />
        <path d={frontIntPath} stroke="var(--text-muted)" strokeWidth="1.2" strokeLinejoin="round" fill="none" opacity="0.5" />
        {frontSpeaker}
        {frontPorts}

        {/* --- DIBUJO SECCIÓN LATERAL --- */}
        <path d={`${extPath} ${intPath}`} fill="url(#wood-gradient)" fillRule="evenodd" />
        <path d={extPath} stroke="var(--text-main)" strokeWidth="2.5" strokeLinejoin="round" fill="none" opacity="0.85" />
        <path d={intPath} stroke="var(--text-muted)" strokeWidth="1.2" strokeLinejoin="round" fill="none" opacity="0.5" />
        {bandpassDivider}
        {speakerConeStandard}
        {speakerMagnetStandard}
        {speakerConeBP}
        {speakerMagnetBP}
        {portElement}
        {portElementVr}

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

        {/* --- ACOTACIONES (Líneas verdes) --- */}

        {/* Cota Altura Externa (Central / Compartida) */}
        <g stroke="#10b981" strokeWidth="1.3">
          <line x1={midX - 10} y1={offsetY} x2={midX + 10} y2={offsetY} />
          <line x1={midX - 10} y1={offsetY + plotHeight} x2={midX + 10} y2={offsetY + plotHeight} />
          <line x1={midX} y1={offsetY} x2={midX} y2={offsetY + plotHeight} strokeWidth="1.8" />
          <polygon points={`${midX},${offsetY} ${midX - 4},${offsetY + 7.5} ${midX + 4},${offsetY + 7.5}`} fill="#10b981" />
          <polygon points={`${midX},${offsetY + plotHeight} ${midX - 4},${offsetY + plotHeight - 7.5} ${midX + 4},${offsetY + plotHeight - 7.5}`} fill="#10b981" />
        </g>
        <text
          x={midX - 8}
          y={offsetY + plotHeight / 2 + 4}
          fill="#10b981"
          fontSize="13"
          fontWeight="normal"
          textAnchor="end"
        >
          {hExtDisp}
        </text>

        {/* Cota Ancho Externo (Abajo Vista Frontal) */}
        <g stroke="#10b981" strokeWidth="1.3">
          <line x1={offsetXFront} y1={offsetY + plotHeight + 10} x2={offsetXFront} y2={offsetY + plotHeight + 25} />
          <line x1={offsetXFront + plotWidthFront} y1={offsetY + plotHeight + 10} x2={offsetXFront + plotWidthFront} y2={offsetY + plotHeight + 25} />
          <line x1={offsetXFront} y1={offsetY + plotHeight + 20} x2={offsetXFront + plotWidthFront} y2={offsetY + plotHeight + 20} strokeWidth="1.8" />
          <polygon points={`${offsetXFront},${offsetY + plotHeight + 20} ${offsetXFront + 7.5},${offsetY + plotHeight + 16} ${offsetXFront + 7.5},${offsetY + plotHeight + 24}`} fill="#10b981" />
          <polygon points={`${offsetXFront + plotWidthFront},${offsetY + plotHeight + 20} ${offsetXFront + plotWidthFront - 7.5},${offsetY + plotHeight + 16} ${offsetXFront + plotWidthFront - 7.5},${offsetY + plotHeight + 24}`} fill="#10b981" />
        </g>
        <text
          x={offsetXFront + plotWidthFront / 2}
          y={offsetY + plotHeight + 35}
          fill="#10b981"
          fontSize="13"
          fontWeight="normal"
          textAnchor="middle"
        >
          {wExtDisp} {uLabel}
        </text>

        {/* Cota Profundidad Externa (Sección Lateral) */}
        {shape === 'rectangular' ? (
          <g stroke="#10b981" strokeWidth="1.3">
            <line x1={offsetXSide} y1={offsetY + plotHeight + 10} x2={offsetXSide} y2={offsetY + plotHeight + 25} />
            <line x1={offsetXSide + plotWidthSide} y1={offsetY + plotHeight + 10} x2={offsetXSide + plotWidthSide} y2={offsetY + plotHeight + 25} />
            <line x1={offsetXSide} y1={offsetY + plotHeight + 20} x2={offsetXSide + plotWidthSide} y2={offsetY + plotHeight + 20} strokeWidth="1.8" />
            <polygon points={`${offsetXSide},${offsetY + plotHeight + 20} ${offsetXSide + 7.5},${offsetY + plotHeight + 16} ${offsetXSide + 7.5},${offsetY + plotHeight + 24}`} fill="#10b981" />
            <polygon points={`${offsetXSide + plotWidthSide},${offsetY + plotHeight + 20} ${offsetXSide + plotWidthSide - 7.5},${offsetY + plotHeight + 16} ${offsetXSide + plotWidthSide - 7.5},${offsetY + plotHeight + 24}`} fill="#10b981" />
            <text
              x={offsetXSide + plotWidthSide / 2}
              y={offsetY + plotHeight + 35}
              fill="#10b981"
              stroke="none"
              fontSize="13"
              fontWeight="normal"
              textAnchor="middle"
            >
              {dExtDisp} {uLabel}
            </text>
          </g>
        ) : (
          // Trapezoidal - Cotas de profundidad superior e inferior
          <g stroke="#10b981" strokeWidth="1.3">
            {/* Superior */}
            <line x1={offsetXSide} y1={offsetY - 25} x2={offsetXSide} y2={offsetY - 10} />
            <line x1={offsetXSide + (dTrapTopExt || 0) * scale} y1={offsetY - 25} x2={offsetXSide + (dTrapTopExt || 0) * scale} y2={offsetY - 10} />
            <line x1={offsetXSide} y1={offsetY - 20} x2={offsetXSide + (dTrapTopExt || 0) * scale} y2={offsetY - 20} strokeWidth="1.8" />
            <polygon points={`${offsetXSide},${offsetY - 20} ${offsetXSide + 7.5},${offsetY - 24} ${offsetXSide + 7.5},${offsetY - 16}`} fill="#10b981" />
            <polygon points={`${offsetXSide + (dTrapTopExt || 0) * scale},${offsetY - 20} ${offsetXSide + (dTrapTopExt || 0) * scale - 7.5},${offsetY - 24} ${offsetXSide + (dTrapTopExt || 0) * scale - 7.5},${offsetY - 16}`} fill="#10b981" />
            <text
              x={offsetXSide + ((dTrapTopExt || 0) * scale) / 2}
              y={offsetY - 28}
              fill="#10b981"
              stroke="none"
              fontSize="11.5"
              fontWeight="normal"
              textAnchor="middle"
            >
              {convertTo(dTrapTopExt || 0, 'length', unitSystem).toFixed(1)}
            </text>

            {/* Inferior */}
            <line x1={offsetXSide} y1={offsetY + plotHeight + 10} x2={offsetXSide} y2={offsetY + plotHeight + 25} />
            <line x1={offsetXSide + (dTrapBotExt || 0) * scale} y1={offsetY + plotHeight + 10} x2={offsetXSide + (dTrapBotExt || 0) * scale} y2={offsetY + plotHeight + 25} />
            <line x1={offsetXSide} y1={offsetY + plotHeight + 20} x2={offsetXSide + (dTrapBotExt || 0) * scale} y2={offsetY + plotHeight + 20} strokeWidth="1.8" />
            <polygon points={`${offsetXSide},${offsetY + plotHeight + 20} ${offsetXSide + 7.5},${offsetY + plotHeight + 16} ${offsetXSide + 7.5},${offsetY + plotHeight + 24}`} fill="#10b981" />
            <polygon points={`${offsetXSide + (dTrapBotExt || 0) * scale},${offsetY + plotHeight + 20} ${offsetXSide + (dTrapBotExt || 0) * scale - 7.5},${offsetY + plotHeight + 16} ${offsetXSide + (dTrapBotExt || 0) * scale - 7.5},${offsetY + plotHeight + 24}`} fill="#10b981" />
            <text
              x={offsetXSide + ((dTrapBotExt || 0) * scale) / 2}
              y={offsetY + plotHeight + 35}
              fill="#10b981"
              stroke="none"
              fontSize="11.5"
              fontWeight="normal"
              textAnchor="middle"
            >
              {convertTo(dTrapBotExt || 0, 'length', unitSystem).toFixed(1)} {uLabel}
            </text>
          </g>
        )}

        {/* Cadena de Acotación de Alturas en Vista Frontal (Izquierda) */}
        <g stroke="#10b981" strokeWidth="1.2" opacity="0.85">
          {/* Cota Altura Centro Altavoz desde Arriba */}
          <line x1={offsetXFront - 21} y1={offsetY} x2={offsetXFront - 11} y2={offsetY} />
          <line x1={offsetXFront - 21} y1={wooferYCenter} x2={offsetXFront - 11} y2={wooferYCenter} />
          <line x1={offsetXFront - 16} y1={offsetY} x2={offsetXFront - 16} y2={wooferYCenter} strokeWidth="1.5" />
          <polygon points={`${offsetXFront - 16},${offsetY} ${offsetXFront - 19},${offsetY + 6} ${offsetXFront - 13},${offsetY + 6}`} fill="#10b981" />
          <polygon points={`${offsetXFront - 16},${wooferYCenter} ${offsetXFront - 19},${wooferYCenter - 6} ${offsetXFront - 13},${wooferYCenter - 6}`} fill="#10b981" />
          <text
            x={offsetXFront - 22}
            y={offsetY + distWooferTop / 2 + 4}
            fill="#10b981"
            stroke="none"
            fontSize="11.5"
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
              <line x1={offsetXFront - 16} y1={portYCenter} x2={offsetXFront - 16} y2={offsetY + plotHeight} strokeWidth="1.5" />
              <polygon points={`${offsetXFront - 16},${portYCenter} ${offsetXFront - 19},${portYCenter + 6} ${offsetXFront - 13},${portYCenter + 6}`} fill="#10b981" />
              <polygon points={`${offsetXFront - 16},${offsetY + plotHeight} ${offsetXFront - 19},${offsetY + plotHeight - 6} ${offsetXFront - 13},${offsetY + plotHeight - 6}`} fill="#10b981" />
              <text
                x={offsetXFront - 22}
                y={portYCenter + distPortBot / 2 + 4}
                fill="#10b981"
                stroke="none"
                fontSize="11.5"
                fontWeight="normal"
                textAnchor="end"
              >
                {distPortBotDisp}
              </text>
            </>
          )}
        </g>

        {/* Cota Altura Interna (Izquierda/Dentro de la sección) */}
        <g stroke="#10b981" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.75">
          <line x1={offsetXSide + tScale} y1={offsetY + tScale} x2={offsetXSide + tScale + 15} y2={offsetY + tScale} />
          <line x1={offsetXSide + tScale} y1={offsetY + plotHeight - tScale} x2={offsetXSide + tScale + 15} y2={offsetY + plotHeight - tScale} />
          <line x1={offsetXSide + tScale + 10} y1={offsetY + tScale} x2={offsetXSide + tScale + 10} y2={offsetY + plotHeight - tScale} strokeDasharray="none" />
        </g>
        <text
          x={offsetXSide + tScale + 16}
          y={offsetY + tScale + 22}
          fill="#10b981"
          fontSize="11.5"
          fontWeight="normal"
          opacity="0.9"
        >
          {hIntDisp}
        </text>

        {/* Cota Espesor Madera (Arriba Izquierda de la sección) */}
        <g stroke="#10b981" strokeWidth="1.2">
          <line x1={offsetXSide} y1={offsetY - 15} x2={offsetXSide} y2={offsetY + 5} />
          <line x1={offsetXSide + tScale} y1={offsetY - 15} x2={offsetXSide + tScale} y2={offsetY + 5} />
          <line x1={offsetXSide - 10} y1={offsetY - 10} x2={offsetXSide + tScale + 10} y2={offsetY - 10} strokeWidth="1.2" />
        </g>
        <text
          x={offsetXSide + tScale / 2}
          y={offsetY - 15}
          fill="#10b981"
          fontSize="10"
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
      </svg>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
        * {t("Representación técnica (Vistas Frontal y de Sección Lateral). Todas las cotas están en")}{' '}{uLabel}.
      </div>
    </div>
  );
};
