import React from 'react';
import { type Lang, translate } from '../utils/translations';
import { type UnitSystem } from '../utils/units';

interface StatusBarProps {
  lang: Lang;
  unitSystem: UnitSystem;
  setUnitSystem: (u: UnitSystem) => void;
  boxType: 'sealed' | 'ported' | 'bandpass';
  vb: number;
  fb?: number;
  f3?: number;
  qtc?: number;
  pe?: number;
  xmax?: number;
  portVelocity?: number;
  onExportReport?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  lang,
  unitSystem,
  setUnitSystem,
  boxType,
  vb,
  fb,
  f3,
  qtc,
  pe = 100,
  xmax,
  portVelocity,
  onExportReport,
}) => {
  const t = (text: string) => translate(text, lang);

  const boxLabel = boxType === 'sealed' 
    ? t("Sellada") 
    : boxType === 'ported' 
      ? t("Ventilada") 
      : t("Paso Banda");

  const getFlowStatus = (vel: number) => {
    if (vel <= 17) return { text: t("Laminar"), color: 'var(--success)' };
    if (vel <= 34) return { text: t("Turbulencia"), color: 'var(--warning)' };
    return { text: t("Chuffing"), color: 'var(--danger)' };
  };

  const flow = portVelocity !== undefined ? getFlowStatus(portVelocity) : null;

  return (
    <footer 
      className="engineering-status-bar"
      style={{
        height: '25px',
        minHeight: '25px',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--card-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 0.85rem',
        fontSize: '0.68rem',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        userSelect: 'none',
        zIndex: 100,
        boxSizing: 'border-box',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        gap: '1rem'
      }}
    >
      {/* Sección Izquierda: Estado del Motor y Caja */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-main)' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          <span>Core: {t("Activo")}</span>
        </span>

        <span style={{ color: 'var(--card-border)' }}>|</span>

        <span>{boxLabel}</span>
        <strong style={{ color: 'var(--text-main)' }}>Vb: {vb > 0 ? vb.toFixed(1) : '—'} L</strong>

        {f3 !== undefined && f3 > 0 && (
          <>
            <span style={{ color: 'var(--card-border)' }}>•</span>
            <span>F3: <strong style={{ color: 'var(--primary)' }}>{f3.toFixed(1)} Hz</strong></span>
          </>
        )}

        {boxType !== 'sealed' && fb !== undefined && fb > 0 && (
          <>
            <span style={{ color: 'var(--card-border)' }}>•</span>
            <span>Fb: <strong style={{ color: 'var(--ported-color)' }}>{fb.toFixed(1)} Hz</strong></span>
          </>
        )}

        {boxType === 'sealed' && qtc !== undefined && qtc > 0 && (
          <>
            <span style={{ color: 'var(--card-border)' }}>•</span>
            <span>Qtc: <strong style={{ color: 'var(--text-main)' }}>{qtc.toFixed(2)}</strong></span>
          </>
        )}
      </div>

      {/* Sección Central: Telemetría Acústica */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        {boxType === 'ported' && flow && portVelocity !== undefined && portVelocity > 0 && (
          <>
            <span>v_aire: <strong style={{ color: flow.color }}>{portVelocity.toFixed(1)} m/s</strong> ({flow.text})</span>
            <span style={{ color: 'var(--card-border)' }}>|</span>
          </>
        )}

        <span>Pe: <strong style={{ color: 'var(--text-main)' }}>{pe}W</strong></span>
        {xmax !== undefined && xmax > 0 && (
          <>
            <span style={{ color: 'var(--card-border)' }}>•</span>
            <span>Xmax: <strong style={{ color: 'var(--text-main)' }}>{xmax.toFixed(1)} mm</strong></span>
          </>
        )}
      </div>

      {/* Sección Derecha: Unidades y Acciones Rápidas */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <button
          type="button"
          onClick={() => setUnitSystem(unitSystem === 'metric' ? 'imperial' : 'metric')}
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--card-border)',
            color: 'var(--text-secondary)',
            fontSize: '0.63rem',
            padding: '1px 6px',
            borderRadius: '0px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontWeight: 500
          }}
          title={t("Cambiar sistema de unidades métrico / imperial")}
        >
          {unitSystem === 'metric' ? 'MÉTRICO' : 'IMPERIAL'}
        </button>

        {onExportReport && (
          <button
            type="button"
            onClick={onExportReport}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--primary)',
              fontSize: '0.63rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: '0 4px',
              textDecoration: 'underline'
            }}
          >
            {t("Reporte")}
          </button>
        )}

        <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem' }}>
          AcousticLAB CAD
        </span>
      </div>
    </footer>
  );
};
