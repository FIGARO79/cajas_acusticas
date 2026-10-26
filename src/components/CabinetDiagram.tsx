import React, { useState } from 'react';
import { type Lang, translate } from '../utils/translations';
import { type UnitSystem } from '../utils/units';
import type { WoodCabinetData } from '../types';
import { CabinetCad2D } from './CabinetCad2D';
import { CabinetViewer3DModal } from './CabinetViewer3DModal';

interface CabinetDiagramProps {
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
  bandpassVf?: number;
  bandpassVr?: number;
  dampingType?: 'none' | 'light' | 'moderate' | 'heavy';
}

export const CabinetDiagram: React.FC<CabinetDiagramProps> = ({
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
  bandpassOrder = 4,
  bandpassRatio = 0.5,
  dampingType = 'none',
}) => {
  const t = (text: string) => translate(text, lang);
  const [is3DModalOpen, setIs3DModalOpen] = useState<boolean>(false);

  if (!cabinetData || !cabinetData.valid) {
    return (
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: '0px',
          padding: '3rem 2rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          fontFamily: 'monospace',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)',
        }}
      >
        {t("Ingresa dimensiones válidas para visualizar el plano técnico CAD.")}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {/* 2D CAD Canvas Viewport */}
      <CabinetCad2D
        theme={theme}
        lang={lang}
        unitSystem={unitSystem}
        shape={shape}
        cabinetData={cabinetData}
        boxType={boxType}
        portShape={portShape}
        portDiameter={portDiameter}
        portWidth={portWidth}
        portHeight={portHeight}
        portLength={portLength}
        portCount={portCount}
        hoveredPieceIndex={hoveredPieceIndex}
        speakerYPct={speakerYPct}
        portYPct={portYPct}
        bandpassOrder={bandpassOrder}
        bandpassRatio={bandpassRatio}
        dampingType={dampingType}
        onOpen3DModal={() => setIs3DModalOpen(true)}
      />

      {/* 3D WebGL Inspection Modal (Three.js) */}
      <CabinetViewer3DModal
        theme={theme}
        isOpen={is3DModalOpen}
        onClose={() => setIs3DModalOpen(false)}
        lang={lang}
        unitSystem={unitSystem}
        shape={shape}
        cabinetData={cabinetData}
        boxType={boxType}
        portShape={portShape}
        portDiameter={portDiameter}
        portWidth={portWidth}
        portHeight={portHeight}
        portLength={portLength}
        portCount={portCount}
        speakerYPct={speakerYPct}
        portYPct={portYPct}
        bandpassOrder={bandpassOrder}
        bandpassRatio={bandpassRatio}
        dampingType={dampingType}
      />
    </div>
  );
};
