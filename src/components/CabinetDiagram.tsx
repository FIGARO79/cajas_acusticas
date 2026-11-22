import React, { useState } from 'react';
import { type Lang, translate } from '../utils/translations';
import { type UnitSystem } from '../utils/units';
import type { WoodCabinetData, WoodShape, Bandpass6Topology } from '../types';
import { CabinetCad2D } from './CabinetCad2D';
import { CabinetViewer3DModal } from './CabinetViewer3DModal';

interface CabinetDiagramProps {
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
  prVas = 45,
  prFs = 25,
  prMms = 35,
  prFbNatural = 0,
  prMasaAnadidaG = 0,
  dampingType = 'none',
  enableBracing = false,
  bracingCount = 2,
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
        flaredEnds={flaredEnds}
        hoveredPieceIndex={hoveredPieceIndex}
        speakerYPct={speakerYPct}
        tweeterYPct={tweeterYPct}
        midrangeYPct={midrangeYPct}
        crossoverWays={crossoverWays}
        midSealed={midSealed}
        overallDiameter={overallDiameter}
        baffleCutout={baffleCutout}
        driverDepth={driverDepth}
        portYPct={portYPct}
        portSpacingPct={portSpacingPct}
        portLocation={portLocation}
        bandpassOrder={bandpassOrder}
        bandpassTopology={bandpassTopology}
        bandpassFl={bandpassFl}
        bandpassFh={bandpassFh}
        bandpassRatio={bandpassRatio}
        bandpassVf={bandpassVf}
        bandpassVr={bandpassVr}
        activeHpEnabled={activeHpEnabled}
        hpFx={hpFx}
        hpQx={hpQx}
        prTuning={prTuning}
        prDia={prDia}
        prVas={prVas}
        prFs={prFs}
        prMms={prMms}
        prFbNatural={prFbNatural}
        prMasaAnadidaG={prMasaAnadidaG}
        dampingType={dampingType}
        enableBracing={enableBracing}
        bracingCount={bracingCount}
        onOpen3DModal={() => setIs3DModalOpen(true)}
      />

      {/* 3D WebGL Inspection Modal (Three.js) */}
      <CabinetViewer3DModal
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
        flaredEnds={flaredEnds}
        speakerYPct={speakerYPct}
        tweeterYPct={tweeterYPct}
        midrangeYPct={midrangeYPct}
        crossoverWays={crossoverWays}
        midSealed={midSealed}
        overallDiameter={overallDiameter}
        baffleCutout={baffleCutout}
        driverDepth={driverDepth}
        portYPct={portYPct}
        portSpacingPct={portSpacingPct}
        portLocation={portLocation}
        bandpassOrder={bandpassOrder}
        bandpassTopology={bandpassTopology}
        bandpassFl={bandpassFl}
        bandpassFh={bandpassFh}
        bandpassRatio={bandpassRatio}
        bandpassVf={bandpassVf}
        bandpassVr={bandpassVr}
        activeHpEnabled={activeHpEnabled}
        hpFx={hpFx}
        hpQx={hpQx}
        prTuning={prTuning}
        prDia={prDia}
        prVas={prVas}
        prFs={prFs}
        prMms={prMms}
        prFbNatural={prFbNatural}
        prMasaAnadidaG={prMasaAnadidaG}
        dampingType={dampingType}
        enableBracing={enableBracing}
        bracingCount={bracingCount}
      />
    </div>
  );
};
