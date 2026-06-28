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
  portHeight,
  portLength,
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
    hExt, dExt,
    hInt,
    thickness,
    dTrapTopExt, dTrapBotExt,
  } = cabinetData;

  // Escala y viewBox para el SVG
  // Eje X: Profundidad (dExt), Eje Y: Altura (hExt)
  // Dejamos un margen de 50px para las cotas
  const padding = 60;
  const svgWidth = 400;
  const svgHeight = 350;

  // Determinar dimensiones de visualización
  const dMax = shape === 'rectangular' ? dExt : Math.max(dTrapTopExt || 0, dTrapBotExt || 0);
  const hMax = hExt;

  // Factor de escala para ajustar al viewBox disponible
  const availableWidth = svgWidth - (padding * 2);
  const availableHeight = svgHeight - (padding * 2);
  const scale = Math.min(availableWidth / dMax, availableHeight / hMax);

  // Posiciones en el SVG
  const plotWidth = dMax * scale;
  const plotHeight = hMax * scale;

  // Centro de dibujo
  const offsetX = padding + (availableWidth - plotWidth) / 2;
  const offsetY = padding + (availableHeight - plotHeight) / 2;

  // Grosor de madera en la escala
  const tScale = (thickness / 10) * scale; // thickness viene en mm, pasamos a cm

  // Coordenadas de los puntos del gabinete (Externo e Interno)
  let extPath = '';
  let intPath = '';

  // Cara frontal en la izquierda (X=0)
  if (shape === 'rectangular') {
    const x0 = offsetX;
    const y0 = offsetY;
    const x1 = offsetX + plotWidth;
    const y1 = offsetY + plotHeight;

    extPath = `M ${x0},${y0} L ${x1},${y0} L ${x1},${y1} L ${x0},${y1} Z`;
    intPath = `M ${x0 + tScale},${y0 + tScale} L ${x1 - tScale},${y0 + tScale} L ${x1 - tScale},${y1 - tScale} L ${x0 + tScale},${y1 - tScale} Z`;
  } else {
    // Trapezoidal
    // dTrapTopExt y dTrapBotExt definen las profundidades superior e inferior
    const dTop = (dTrapTopExt || 0) * scale;
    const dBot = (dTrapBotExt || 0) * scale;

    const x0_top = offsetX;
    const y0 = offsetY;
    const x1_top = offsetX + dTop;
    
    const x0_bot = offsetX;
    const y1 = offsetY + plotHeight;
    const x1_bot = offsetX + dBot;

    // Camino exterior (Trapecio)
    extPath = `M ${x0_top},${y0} L ${x1_top},${y0} L ${x1_bot},${y1} L ${x0_bot},${y1} Z`;

    // Camino interior restando espesor
    intPath = `M ${x0_top + tScale},${y0 + tScale} L ${x1_top - tScale},${y0 + tScale} L ${x1_bot - tScale},${y1 - tScale} L ${x0_bot + tScale},${y1 - tScale} Z`;
  }

  // Altavoz Woofer
  // Se dibuja de perfil en la pared frontal (izquierda, X = offsetX)
  // Posicionado al centro de la altura
  const wooferH = Math.min(plotHeight * 0.5, 80); // Alto del altavoz en el dibujo
  const wooferY = offsetY + (plotHeight - wooferH) / 2;
  const wooferDepth = Math.min(plotWidth * 0.4, 50); // Profundidad física en el dibujo

  // Componentes del altavoz (Woofer de perfil)
  // Suspension y cono
  const speakerCone = (
    <path
      d={`M ${offsetX + tScale},${wooferY} 
          Q ${offsetX + tScale + wooferDepth * 0.1},${wooferY + wooferH * 0.15} ${offsetX + tScale + wooferDepth * 0.6},${wooferY + wooferH * 0.35}
          L ${offsetX + tScale + wooferDepth * 0.6},${wooferY + wooferH * 0.65}
          Q ${offsetX + tScale + wooferDepth * 0.1},${wooferY + wooferH * 0.85} ${offsetX + tScale},${wooferY + wooferH}
          L ${offsetX + tScale},${wooferY + wooferH - 5}
          Q ${offsetX + tScale + wooferDepth * 0.15},${wooferY + wooferH * 0.8} ${offsetX + tScale + wooferDepth * 0.55},${wooferY + wooferH * 0.6}
          L ${offsetX + tScale + wooferDepth * 0.55},${wooferY + wooferH * 0.4}
          Q ${offsetX + tScale + wooferDepth * 0.15},${wooferY + wooferH * 0.2} ${offsetX + tScale},${wooferY + 5} Z`}
      fill="#38bdf8"
      opacity="0.85"
    />
  );

  // Imán y canasta
  const speakerMagnet = (
    <g>
      {/* Canasta / Estructura */}
      <line x1={offsetX + tScale + wooferDepth * 0.55} y1={wooferY + wooferH * 0.4} x2={offsetX + tScale + wooferDepth * 0.85} y2={wooferY + wooferH * 0.45} stroke="#64748b" strokeWidth="2.5" />
      <line x1={offsetX + tScale + wooferDepth * 0.55} y1={wooferY + wooferH * 0.6} x2={offsetX + tScale + wooferDepth * 0.85} y2={wooferY + wooferH * 0.55} stroke="#64748b" strokeWidth="2.5" />
      
      {/* Bobina / Imán posterior */}
      <rect
        x={offsetX + tScale + wooferDepth * 0.8}
        y={wooferY + wooferH * 0.42}
        width={wooferDepth * 0.25}
        height={wooferH * 0.16}
        fill="#475569"
        stroke="#64748b"
        strokeWidth="1.5"
        rx="2"
      />
    </g>
  );

  // Puerto de sintonía (si aplica)
  // Dibujamos un ducto en la parte inferior si es 'ported'
  let portElement = null;
  if (boxType === 'ported' && portLength > 0) {
    const pLenScale = portLength * scale;
    let pHeightScale = 15; // Altura del puerto por defecto en el esquema

    if (portShape === 'round' && portDiameter > 0) {
      pHeightScale = Math.min(portDiameter * scale, plotHeight * 0.25);
    } else if (portShape === 'rectangular' && portHeight > 0) {
      pHeightScale = Math.min(portHeight * scale, plotHeight * 0.25);
    }

    // Dibujar puerto desde el bafle frontal (abajo, pegado a la base)
    const portY = offsetY + plotHeight - tScale - pHeightScale - 10;
    portElement = (
      <g>
        {/* Cuerpo del tubo */}
        <rect
          x={offsetX + tScale}
          y={portY}
          width={pLenScale}
          height={pHeightScale}
          fill="none"
          stroke="#ef4444"
          strokeWidth="2.5"
          strokeDasharray="4 2"
          opacity="0.9"
        />
        {/* Apertura en el panel frontal */}
        <line
          x1={offsetX}
          y1={portY}
          x2={offsetX + tScale}
          y2={portY}
          stroke="#090d16"
          strokeWidth="4"
        />
        <line
          x1={offsetX}
          y1={portY + pHeightScale}
          x2={offsetX + tScale}
          y2={portY + pHeightScale}
          stroke="#090d16"
          strokeWidth="4"
        />
        {/* Etiqueta del largo Lv */}
        <text
          x={offsetX + tScale + pLenScale / 2}
          y={portY - 6}
          fill="#ef4444"
          fontSize="10"
          fontWeight="bold"
          textAnchor="middle"
        >
          Lv: {convertTo(portLength, 'length', unitSystem).toFixed(1)}{uLabel}
        </text>
      </g>
    );
  }

  // Convertimos las cotas a la unidad seleccionada
  const hExtDisp = convertTo(hExt, 'length', unitSystem).toFixed(1);
  const hIntDisp = convertTo(hInt, 'length', unitSystem).toFixed(1);
  const dExtDisp = convertTo(dExt, 'length', unitSystem).toFixed(1);
  const tDisp = convertTo(thickness / 10, 'length', unitSystem).toFixed(1); // mm a cm y luego a unidad

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
        {t("Plano de Sección (Corte A-A)")}
      </span>

      <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} fill="none" style={{ maxWidth: '100%' }}>
        {/* Cuadrícula de fondo sutil */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" rx="8" />

        {/* Sombras / Relleno de las paredes de Madera */}
        <path d={extPath} fill="rgba(245, 158, 11, 0.05)" />
        <path d={intPath} fill="#0d1321" />

        {/* Bordes del Gabinete */}
        <path d={extPath} stroke="var(--primary)" strokeWidth="3" strokeLinejoin="round" />
        <path d={intPath} stroke="var(--primary-glow)" strokeWidth="1.5" strokeLinejoin="round" />

        {/* Dibujar el Altavoz */}
        {speakerCone}
        {speakerMagnet}

        {/* Puerto de sintonía */}
        {portElement}

        {/* Ebanistería/Volumen interior text */}
        <text
          x={offsetX + plotWidth / 2}
          y={offsetY + plotHeight / 2}
          fill="var(--text-muted)"
          fontSize="13"
          fontWeight="bold"
          textAnchor="middle"
          opacity="0.3"
        >
          Vb
        </text>

        {/* --- ACOTACIONES (Líneas verdes) --- */}
        {/* Cota Altura Externa (Derecha) */}
        <g stroke="#10b981" strokeWidth="1">
          <line x1={offsetX + plotWidth + 10} y1={offsetY} x2={offsetX + plotWidth + 25} y2={offsetY} />
          <line x1={offsetX + plotWidth + 10} y1={offsetY + plotHeight} x2={offsetX + plotWidth + 25} y2={offsetY + plotHeight} />
          <line x1={offsetX + plotWidth + 20} y1={offsetY} x2={offsetX + plotWidth + 20} y2={offsetY + plotHeight} strokeWidth="1.5" />
          {/* Flechas */}
          <polygon points={`${offsetX + plotWidth + 20},${offsetY} ${offsetX + plotWidth + 17},${offsetY + 8} ${offsetX + plotWidth + 23},${offsetY + 8}`} fill="#10b981" />
          <polygon points={`${offsetX + plotWidth + 20},${offsetY + plotHeight} ${offsetX + plotWidth + 17},${offsetY + plotHeight - 8} ${offsetX + plotWidth + 23},${offsetY + plotHeight - 8}`} fill="#10b981" />
        </g>
        <text
          x={offsetX + plotWidth + 28}
          y={offsetY + plotHeight / 2 + 4}
          fill="#10b981"
          fontSize="11"
          fontWeight="bold"
        >
          {hExtDisp}
        </text>

        {/* Cota Profundidad Externa (Abajo) */}
        <g stroke="#10b981" strokeWidth="1">
          <line x1={offsetX} y1={offsetY + plotHeight + 10} x2={offsetX} y2={offsetY + plotHeight + 25} />
          <line x1={offsetX + plotWidth} y1={offsetY + plotHeight + 10} x2={offsetX + plotWidth} y2={offsetY + plotHeight + 25} />
          <line x1={offsetX} y1={offsetY + plotHeight + 20} x2={offsetX + plotWidth} y2={offsetY + plotHeight + 20} strokeWidth="1.5" />
          {/* Flechas */}
          <polygon points={`${offsetX},${offsetY + plotHeight + 20} ${offsetX + 8},${offsetY + plotHeight + 17} ${offsetX + 8},${offsetY + plotHeight + 23}`} fill="#10b981" />
          <polygon points={`${offsetX + plotWidth},${offsetY + plotHeight + 20} ${offsetX + plotWidth - 8},${offsetY + plotHeight + 17} ${offsetX + plotWidth - 8},${offsetY + plotHeight + 23}`} fill="#10b981" />
        </g>
        <text
          x={offsetX + plotWidth / 2}
          y={offsetY + plotHeight + 35}
          fill="#10b981"
          fontSize="11"
          fontWeight="bold"
          textAnchor="middle"
        >
          {dExtDisp} {uLabel}
        </text>

        {/* Cota Altura Interna (Izquierda/Dentro) */}
        <g stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" opacity="0.7">
          <line x1={offsetX + tScale} y1={offsetY + tScale} x2={offsetX + tScale + 15} y2={offsetY + tScale} />
          <line x1={offsetX + tScale} y1={offsetY + plotHeight - tScale} x2={offsetX + tScale + 15} y2={offsetY + plotHeight - tScale} />
          <line x1={offsetX + tScale + 10} y1={offsetY + tScale} x2={offsetX + tScale + 10} y2={offsetY + plotHeight - tScale} strokeDasharray="none" />
        </g>
        <text
          x={offsetX + tScale + 15}
          y={offsetY + plotHeight / 2 + 15}
          fill="#10b981"
          fontSize="10"
          fontWeight="500"
          opacity="0.8"
        >
          {hIntDisp}
        </text>

        {/* Cota Espesor (Arriba Izquierda) */}
        <g stroke="#10b981" strokeWidth="1">
          <line x1={offsetX} y1={offsetY - 15} x2={offsetX} y2={offsetY + 5} />
          <line x1={offsetX + tScale} y1={offsetY - 15} x2={offsetX + tScale} y2={offsetY + 5} />
          <line x1={offsetX - 10} y1={offsetY - 10} x2={offsetX + tScale + 10} y2={offsetY - 10} strokeWidth="1" />
        </g>
        <text
          x={offsetX + tScale / 2}
          y={offsetY - 16}
          fill="#10b981"
          fontSize="9"
          fontWeight="bold"
          textAnchor="middle"
        >
          {tDisp}
        </text>
      </svg>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem', textAlign: 'center' }}>
        * {t("Representación de corte lateral. Todas las cotas están en")}{' '}{uLabel}.
      </div>
    </div>
  );
};
