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
}) => {
  const t = (text: string) => translate(text, lang);

  if (!cabinetData || !cabinetData.valid) {
    return (
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: '12px',
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.85rem'
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

  // Escala y viewBox para el SVG
  // Mostramos dos vistas: Frontal (izquierda) y Sección Lateral (derecha)
  const padding = 50;
  const svgWidth = 720;
  const svgHeight = 380;

  // Determinar dimensiones de visualización
  const dMax = shape === 'rectangular' ? dExt : Math.max(dTrapTopExt || 0, dTrapBotExt || 0);
  const hMax = hExt;

  // Factor de escala para ajustar ambas vistas al viewBox disponible
  const availableWidth = svgWidth - (padding * 3); // Margen izquierdo, separación central, margen derecho
  const availableHeight = svgHeight - (padding * 2);
  const scale = Math.min(availableHeight / hMax, availableWidth / (wExt + dMax));

  // Dimensiones en pixeles en el SVG
  const plotHeight = hMax * scale;
  const plotWidthFront = wExt * scale;
  const plotWidthSide = dMax * scale;

  // Distribución del espacio horizontal para centrar
  const remainingWidth = svgWidth - plotWidthFront - plotWidthSide;
  const gap = remainingWidth / 3;
  
  const offsetXFront = gap;
  const offsetXSide = gap * 2 + plotWidthFront;
  const offsetY = padding + (availableHeight - plotHeight) / 2;

  // Grosor de madera en la escala
  const tScale = (thickness / 10) * scale; // thickness viene en mm, pasamos a cm

  // --- VISTA FRONTAL (Coordenadas) ---
  const frontExtPath = `M ${offsetXFront},${offsetY} L ${offsetXFront + plotWidthFront},${offsetY} L ${offsetXFront + plotWidthFront},${offsetY + plotHeight} L ${offsetXFront},${offsetY + plotHeight} Z`;
  const frontIntPath = `M ${offsetXFront + tScale},${offsetY + tScale} L ${offsetXFront + plotWidthFront - tScale},${offsetY + tScale} L ${offsetXFront + plotWidthFront - tScale},${offsetY + plotHeight - tScale} L ${offsetXFront + tScale},${offsetY + plotHeight - tScale} Z`;

  // Altavoz en Vista Frontal (Woofer centrado)
  const wooferH = Math.min(plotHeight * 0.5, 80); // Alto del altavoz en el dibujo
  const wooferY = offsetY + (plotHeight - wooferH) / 2;
  const wooferYCenter = wooferY + wooferH / 2;
  const wooferX = offsetXFront + plotWidthFront / 2;

  const rOuter = wooferH / 2;
  const rInner = rOuter * 0.8;
  const rCap = rOuter * 0.25;

  const frontSpeaker = (
    <g>
      {/* Flange / Suspensión externa */}
      <circle cx={wooferX} cy={wooferYCenter} r={rOuter} fill="none" stroke="#000000" strokeWidth="2" />
      <circle cx={wooferX} cy={wooferYCenter} r={rOuter - 3} fill="none" stroke="#64748b" strokeWidth="0.8" opacity="0.6" />
      
      {/* Tornillos de montaje (4 en cruz) */}
      <circle cx={wooferX + rOuter * 0.9 * Math.cos(Math.PI / 4)} cy={wooferYCenter + rOuter * 0.9 * Math.sin(Math.PI / 4)} r="1.5" fill="#000000" />
      <circle cx={wooferX + rOuter * 0.9 * Math.cos(3 * Math.PI / 4)} cy={wooferYCenter + rOuter * 0.9 * Math.sin(3 * Math.PI / 4)} r="1.5" fill="#000000" />
      <circle cx={wooferX + rOuter * 0.9 * Math.cos(5 * Math.PI / 4)} cy={wooferYCenter + rOuter * 0.9 * Math.sin(5 * Math.PI / 4)} r="1.5" fill="#000000" />
      <circle cx={wooferX + rOuter * 0.9 * Math.cos(7 * Math.PI / 4)} cy={wooferYCenter + rOuter * 0.9 * Math.sin(7 * Math.PI / 4)} r="1.5" fill="#000000" />

      {/* Cono */}
      <circle cx={wooferX} cy={wooferYCenter} r={rInner} fill="#38bdf8" opacity="0.12" stroke="#38bdf8" strokeWidth="1" />
      <circle cx={wooferX} cy={wooferYCenter} r={rInner - 5} fill="none" stroke="#64748b" strokeWidth="0.75" />
      
      {/* Cubrepolvo */}
      <circle cx={wooferX} cy={wooferYCenter} r={rCap} fill="none" stroke="#000000" strokeWidth="1.5" />
      
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
  const portY = offsetY + plotHeight - tScale - pHeightScale - 10;

  // --- VISTA LATERAL (SECCIÓN CORTE) ---
  let extPath = '';
  let intPath = '';

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

  // Altavoz de perfil en pared frontal
  const wooferDepth = Math.min(plotWidthSide * 0.4, 50);
  const speakerCone = (
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
  );

  const speakerMagnet = (
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
  );

  // Puerto de perfil
  let portElement = null;
  if (boxType === 'ported') {
    const effectivePortLength = portLength > 0 ? portLength : 15; // 15 cm fallback
    const pLenScale = effectivePortLength * scale;
    portElement = (
      <g>
        {/* Erase wood wall inside port opening */}
        <rect
          x={offsetXSide - 1}
          y={portY + 0.5}
          width={tScale + 2}
          height={pHeightScale - 1}
          fill="var(--card-bg)"
        />
        {/* Top/bottom walls */}
        <line x1={offsetXSide} y1={portY} x2={offsetXSide + tScale + pLenScale} y2={portY} stroke="#000000" strokeWidth="2" />
        <line x1={offsetXSide} y1={portY + pHeightScale} x2={offsetXSide + tScale + pLenScale} y2={portY + pHeightScale} stroke="#000000" strokeWidth="2" />
        {/* Inner opening */}
        <line x1={offsetXSide + tScale + pLenScale} y1={portY} x2={offsetXSide + tScale + pLenScale} y2={portY + pHeightScale} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 3" />
        {/* Label */}
        <text
          x={offsetXSide + tScale + pLenScale / 2}
          y={portY - 6}
          fill="#10b981"
          fontSize="10"
          fontWeight="bold"
          textAnchor="middle"
        >
          {portLength > 0 
            ? `Lv: ${convertTo(portLength, 'length', unitSystem).toFixed(1)}${uLabel}` 
            : 'Lv: N/A'}
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
  
  const portYCenter = portY + pHeightScale / 2;
  const distPortBot = (offsetY + plotHeight) - portYCenter;
  const distPortBotDisp = convertTo(distPortBot / scale, 'length', unitSystem).toFixed(1);

  const midX = offsetXSide - 35; // Altura cota central

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
      border: '1px solid var(--card-border)',
      borderRadius: '12px',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      marginTop: '1rem',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <span className="control-title" style={{ alignSelf: 'flex-start', fontSize: '1rem', color: 'var(--text-main)', marginBottom: '0.75rem', fontWeight: 600 }}>
        {t("Plano de Fabricación de la Cabina")}
      </span>

      <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} fill="none" style={{ maxWidth: '100%' }}>
        {/* Cuadrícula de fondo sutil */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--text-muted)" strokeWidth="1" opacity="0.08" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" rx="8" />

        {/* --- DIBUJO VISTA FRONTAL --- */}
        <path d={`${frontExtPath} ${frontIntPath}`} fill="rgba(245, 158, 11, 0.08)" fillRule="evenodd" />
        <path d={frontExtPath} stroke="#000000" strokeWidth="3" strokeLinejoin="round" fill="none" />
        <path d={frontIntPath} stroke="#000000" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
        {frontSpeaker}
        {frontPorts}

        {/* --- DIBUJO SECCIÓN LATERAL --- */}
        <path d={`${extPath} ${intPath}`} fill="rgba(245, 158, 11, 0.08)" fillRule="evenodd" />
        <path d={extPath} stroke="#000000" strokeWidth="3" strokeLinejoin="round" fill="none" />
        <path d={intPath} stroke="#000000" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
        {speakerCone}
        {speakerMagnet}
        {portElement}

        {/* Volumen interior etiqueta (Vb) */}
        <text
          x={offsetXSide + plotWidthSide / 2}
          y={offsetY + plotHeight / 2}
          fill="var(--text-muted)"
          fontSize="13"
          fontWeight="bold"
          textAnchor="middle"
          opacity="0.35"
        >
          Vb
        </text>

        {/* --- TITULOS DE VISTAS (CAD Style) --- */}
        <text
          x={offsetXFront + plotWidthFront / 2}
          y={offsetY + plotHeight + 52}
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
          y={offsetY + plotHeight + 52}
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
        <g stroke="#10b981" strokeWidth="1">
          <line x1={midX - 10} y1={offsetY} x2={midX + 10} y2={offsetY} />
          <line x1={midX - 10} y1={offsetY + plotHeight} x2={midX + 10} y2={offsetY + plotHeight} />
          <line x1={midX} y1={offsetY} x2={midX} y2={offsetY + plotHeight} strokeWidth="1.5" />
          <polygon points={`${midX},${offsetY} ${midX - 3.5},${offsetY + 7} ${midX + 3.5},${offsetY + 7}`} fill="#10b981" />
          <polygon points={`${midX},${offsetY + plotHeight} ${midX - 3.5},${offsetY + plotHeight - 7} ${midX + 3.5},${offsetY + plotHeight - 7}`} fill="#10b981" />
        </g>
        <text
          x={midX - 8}
          y={offsetY + plotHeight / 2 + 4}
          fill="#10b981"
          fontSize="10.5"
          fontWeight="bold"
          textAnchor="end"
        >
          {hExtDisp}
        </text>

        {/* Cota Ancho Externo (Abajo Vista Frontal) */}
        <g stroke="#10b981" strokeWidth="1">
          <line x1={offsetXFront} y1={offsetY + plotHeight + 10} x2={offsetXFront} y2={offsetY + plotHeight + 25} />
          <line x1={offsetXFront + plotWidthFront} y1={offsetY + plotHeight + 10} x2={offsetXFront + plotWidthFront} y2={offsetY + plotHeight + 25} />
          <line x1={offsetXFront} y1={offsetY + plotHeight + 20} x2={offsetXFront + plotWidthFront} y2={offsetY + plotHeight + 20} strokeWidth="1.5" />
          <polygon points={`${offsetXFront},${offsetY + plotHeight + 20} ${offsetXFront + 7},${offsetY + plotHeight + 16.5} ${offsetXFront + 7},${offsetY + plotHeight + 23.5}`} fill="#10b981" />
          <polygon points={`${offsetXFront + plotWidthFront},${offsetY + plotHeight + 20} ${offsetXFront + plotWidthFront - 7},${offsetY + plotHeight + 16.5} ${offsetXFront + plotWidthFront - 7},${offsetY + plotHeight + 23.5}`} fill="#10b981" />
        </g>
        <text
          x={offsetXFront + plotWidthFront / 2}
          y={offsetY + plotHeight + 35}
          fill="#10b981"
          fontSize="10.5"
          fontWeight="bold"
          textAnchor="middle"
        >
          {wExtDisp} {uLabel}
        </text>

        {/* Cota Profundidad Externa (Sección Lateral) */}
        {shape === 'rectangular' ? (
          <g stroke="#10b981" strokeWidth="1">
            <line x1={offsetXSide} y1={offsetY + plotHeight + 10} x2={offsetXSide} y2={offsetY + plotHeight + 25} />
            <line x1={offsetXSide + plotWidthSide} y1={offsetY + plotHeight + 10} x2={offsetXSide + plotWidthSide} y2={offsetY + plotHeight + 25} />
            <line x1={offsetXSide} y1={offsetY + plotHeight + 20} x2={offsetXSide + plotWidthSide} y2={offsetY + plotHeight + 20} strokeWidth="1.5" />
            <polygon points={`${offsetXSide},${offsetY + plotHeight + 20} ${offsetXSide + 7},${offsetY + plotHeight + 16.5} ${offsetXSide + 7},${offsetY + plotHeight + 23.5}`} fill="#10b981" />
            <polygon points={`${offsetXSide + plotWidthSide},${offsetY + plotHeight + 20} ${offsetXSide + plotWidthSide - 7},${offsetY + plotHeight + 16.5} ${offsetXSide + plotWidthSide - 7},${offsetY + plotHeight + 23.5}`} fill="#10b981" />
            <text
              x={offsetXSide + plotWidthSide / 2}
              y={offsetY + plotHeight + 35}
              fill="#10b981"
              fontSize="10.5"
              fontWeight="bold"
              textAnchor="middle"
            >
              {dExtDisp} {uLabel}
            </text>
          </g>
        ) : (
          // Trapezoidal - Cotas de profundidad superior e inferior
          <g stroke="#10b981" strokeWidth="1">
            {/* Superior */}
            <line x1={offsetXSide} y1={offsetY - 25} x2={offsetXSide} y2={offsetY - 10} />
            <line x1={offsetXSide + (dTrapTopExt || 0) * scale} y1={offsetY - 25} x2={offsetXSide + (dTrapTopExt || 0) * scale} y2={offsetY - 10} />
            <line x1={offsetXSide} y1={offsetY - 20} x2={offsetXSide + (dTrapTopExt || 0) * scale} y2={offsetY - 20} strokeWidth="1.5" />
            <polygon points={`${offsetXSide},${offsetY - 20} ${offsetXSide + 7},${offsetY - 23.5} ${offsetXSide + 7},${offsetY - 16.5}`} fill="#10b981" />
            <polygon points={`${offsetXSide + (dTrapTopExt || 0) * scale},${offsetY - 20} ${offsetXSide + (dTrapTopExt || 0) * scale - 7},${offsetY - 23.5} ${offsetXSide + (dTrapTopExt || 0) * scale - 7},${offsetY - 16.5}`} fill="#10b981" />
            <text
              x={offsetXSide + ((dTrapTopExt || 0) * scale) / 2}
              y={offsetY - 28}
              fill="#10b981"
              fontSize="9.5"
              fontWeight="bold"
              textAnchor="middle"
            >
              {convertTo(dTrapTopExt || 0, 'length', unitSystem).toFixed(1)}
            </text>

            {/* Inferior */}
            <line x1={offsetXSide} y1={offsetY + plotHeight + 10} x2={offsetXSide} y2={offsetY + plotHeight + 25} />
            <line x1={offsetXSide + (dTrapBotExt || 0) * scale} y1={offsetY + plotHeight + 10} x2={offsetXSide + (dTrapBotExt || 0) * scale} y2={offsetY + plotHeight + 25} />
            <line x1={offsetXSide} y1={offsetY + plotHeight + 20} x2={offsetXSide + (dTrapBotExt || 0) * scale} y2={offsetY + plotHeight + 20} strokeWidth="1.5" />
            <polygon points={`${offsetXSide},${offsetY + plotHeight + 20} ${offsetXSide + 7},${offsetY + plotHeight + 16.5} ${offsetXSide + 7},${offsetY + plotHeight + 23.5}`} fill="#10b981" />
            <polygon points={`${offsetXSide + (dTrapBotExt || 0) * scale},${offsetY + plotHeight + 20} ${offsetXSide + (dTrapBotExt || 0) * scale - 7},${offsetY + plotHeight + 16.5} ${offsetXSide + (dTrapBotExt || 0) * scale - 7},${offsetY + plotHeight + 23.5}`} fill="#10b981" />
            <text
              x={offsetXSide + ((dTrapBotExt || 0) * scale) / 2}
              y={offsetY + plotHeight + 35}
              fill="#10b981"
              fontSize="9.5"
              fontWeight="bold"
              textAnchor="middle"
            >
              {convertTo(dTrapBotExt || 0, 'length', unitSystem).toFixed(1)} {uLabel}
            </text>
          </g>
        )}

        {/* Cadena de Acotación de Alturas en Vista Frontal (Izquierda) */}
        <g stroke="#10b981" strokeWidth="1" opacity="0.8">
          {/* Cota Altura Centro Altavoz desde Arriba */}
          <line x1={offsetXFront - 30} y1={offsetY} x2={offsetXFront - 15} y2={offsetY} />
          <line x1={offsetXFront - 30} y1={wooferYCenter} x2={offsetXFront - 15} y2={wooferYCenter} />
          <line x1={offsetXFront - 25} y1={offsetY} x2={offsetXFront - 25} y2={wooferYCenter} strokeWidth="1.2" />
          <polygon points={`${offsetXFront - 25},${offsetY} ${offsetXFront - 28},${offsetY + 6} ${offsetXFront - 22},${offsetY + 6}`} fill="#10b981" />
          <polygon points={`${offsetXFront - 25},${wooferYCenter} ${offsetXFront - 28},${wooferYCenter - 6} ${offsetXFront - 22},${wooferYCenter - 6}`} fill="#10b981" />
          <text
            x={offsetXFront - 32}
            y={offsetY + distWooferTop / 2 + 3.5}
            fill="#10b981"
            fontSize="9.5"
            fontWeight="bold"
            textAnchor="end"
          >
            {distWooferTopDisp}
          </text>

          {/* Cota Altura Centro Puerto desde Abajo (si aplica) */}
          {boxType === 'ported' && (
            <>
              <line x1={offsetXFront - 30} y1={portYCenter} x2={offsetXFront - 15} y2={portYCenter} />
              <line x1={offsetXFront - 30} y1={offsetY + plotHeight} x2={offsetXFront - 15} y2={offsetY + plotHeight} />
              <line x1={offsetXFront - 25} y1={portYCenter} x2={offsetXFront - 25} y2={offsetY + plotHeight} strokeWidth="1.2" />
              <polygon points={`${offsetXFront - 25},${portYCenter} ${offsetXFront - 28},${portYCenter + 6} ${offsetXFront - 22},${portYCenter + 6}`} fill="#10b981" />
              <polygon points={`${offsetXFront - 25},${offsetY + plotHeight} ${offsetXFront - 28},${offsetY + plotHeight - 6} ${offsetXFront - 22},${offsetY + plotHeight - 6}`} fill="#10b981" />
              <text
                x={offsetXFront - 32}
                y={portYCenter + distPortBot / 2 + 3.5}
                fill="#10b981"
                fontSize="9.5"
                fontWeight="bold"
                textAnchor="end"
              >
                {distPortBotDisp}
              </text>
            </>
          )}
        </g>

        {/* Cota Altura Interna (Izquierda/Dentro de la sección) */}
        <g stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" opacity="0.6">
          <line x1={offsetXSide + tScale} y1={offsetY + tScale} x2={offsetXSide + tScale + 15} y2={offsetY + tScale} />
          <line x1={offsetXSide + tScale} y1={offsetY + plotHeight - tScale} x2={offsetXSide + tScale + 15} y2={offsetY + plotHeight - tScale} />
          <line x1={offsetXSide + tScale + 10} y1={offsetY + tScale} x2={offsetXSide + tScale + 10} y2={offsetY + plotHeight - tScale} strokeDasharray="none" />
        </g>
        <text
          x={offsetXSide + tScale + 15}
          y={offsetY + tScale + 20}
          fill="#10b981"
          fontSize="9.5"
          fontWeight="500"
          opacity="0.8"
        >
          {hIntDisp}
        </text>

        {/* Cota Espesor Madera (Arriba Izquierda de la sección) */}
        <g stroke="#10b981" strokeWidth="1">
          <line x1={offsetXSide} y1={offsetY - 15} x2={offsetXSide} y2={offsetY + 5} />
          <line x1={offsetXSide + tScale} y1={offsetY - 15} x2={offsetXSide + tScale} y2={offsetY + 5} />
          <line x1={offsetXSide - 10} y1={offsetY - 10} x2={offsetXSide + tScale + 10} y2={offsetY - 10} strokeWidth="1" />
        </g>
        <text
          x={offsetXSide + tScale / 2}
          y={offsetY - 15}
          fill="#10b981"
          fontSize="8.5"
          fontWeight="bold"
          textAnchor="middle"
        >
          {tDisp}
        </text>
      </svg>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
        * {t("Representación técnica (Vistas Frontal y de Sección Lateral). Todas las cotas están en")}{' '}{uLabel}.
      </div>
    </div>
  );
};
