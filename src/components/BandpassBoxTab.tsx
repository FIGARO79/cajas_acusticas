import React from 'react';
import { type Lang, translate } from '../utils/translations';
import type { CalculatedBandpass } from '../types';
import { type UnitSystem } from '../utils/units';

interface BandpassBoxTabProps {
  lang: Lang;
  unitSystem: UnitSystem;
  bandpassData: CalculatedBandpass;
  bandpassOrder: 4 | 6;
  setBandpassOrder: (order: 4 | 6) => void;
  bandpassS: number;
  setBandpassS: (s: number) => void;
  bandpassA: number;
  setBandpassA: (a: number) => void;
  onExportReport?: () => void;
}

export const BandpassBoxTab: React.FC<BandpassBoxTabProps> = ({
  lang,
  unitSystem,
  bandpassData,
  bandpassOrder,
  setBandpassOrder,
  bandpassS,
  setBandpassS,
  bandpassA,
  setBandpassA,
  onExportReport,
}) => {
  const t = (text: string) => translate(text, lang);

  const formatVolume = (liters: number) => {
    if (!bandpassData.valid || liters <= 0) return t("N/A");
    if (unitSystem === 'metric') {
      return `${liters.toFixed(1)} L`;
    } else {
      return `${(liters / 28.3168466).toFixed(3)} ft³`;
    }
  };

  const formatVolumeSub = (liters: number) => {
    if (!bandpassData.valid || liters <= 0) return "";
    if (unitSystem === 'metric') {
      return `${(liters / 28.3168466).toFixed(3)} ft³`;
    } else {
      return `${liters.toFixed(1)} L`;
    }
  };

  return (
    <div className="tab-content active" id="tab-bandpass">
      <div className="control-group" style={{ marginBottom: '1.5rem' }}>
        <span className="control-title">{t("Orden del Paso Banda")}</span>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
            <input 
              type="radio" 
              name="bpOrder" 
              checked={bandpassOrder === 4} 
              onChange={() => setBandpassOrder(4)} 
            />
            {t("4.º Orden (Cámara Sellada + Ventilada)")}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
            <input 
              type="radio" 
              name="bpOrder" 
              checked={bandpassOrder === 6} 
              onChange={() => setBandpassOrder(6)} 
            />
            {t("6.º Orden (Ambas Cámaras Ventiladas)")}
          </label>
        </div>
      </div>

      {bandpassOrder === 4 ? (
        <div className="results-summary">
          <div className="result-tile">
            <span className="result-tile-label">{t("Cámara Trasera Sellada (Vf)")}</span>
            <span className="result-tile-value">{formatVolume(bandpassData.Vf)}</span>
            <span className="result-tile-sub">{formatVolumeSub(bandpassData.Vf)}</span>
          </div>
          <div className="result-tile">
            <span className="result-tile-label">{t("Cámara Delantera Ventilada (Vr)")}</span>
            <span className="result-tile-value">{formatVolume(bandpassData.Vr)}</span>
            <span className="result-tile-sub">{formatVolumeSub(bandpassData.Vr)}</span>
          </div>
          <div className="result-tile">
            <span className="result-tile-label">{t("Frecuencia de Sintonía (Fb)")}</span>
            <span className="result-tile-value">
              {bandpassData.valid && bandpassData.Fb > 0 ? `${bandpassData.Fb.toFixed(1)} Hz` : 'N/A'}
            </span>
            <span className="result-tile-sub">{t("Sintonía cámara ventilada")}</span>
          </div>
          <div className="result-tile">
            <span className="result-tile-label">{t("Frecuencia Central (F0)")}</span>
            <span className="result-tile-value">
              {bandpassData.valid && bandpassData.F0 ? `${bandpassData.F0.toFixed(1)} Hz` : 'N/A'}
            </span>
            <span className="result-tile-sub">{t("Frecuencia de máxima eficiencia")}</span>
          </div>
        </div>
      ) : (
        <div className="results-summary">
          <div className="result-tile">
            <span className="result-tile-label">{t("Cámara Trasera Ventilada (Vf)")}</span>
            <span className="result-tile-value">{formatVolume(bandpassData.Vf)}</span>
            <span className="result-tile-sub">{formatVolumeSub(bandpassData.Vf)}</span>
          </div>
          <div className="result-tile">
            <span className="result-tile-label">{t("Cámara Delantera Ventilada (Vr)")}</span>
            <span className="result-tile-value">{formatVolume(bandpassData.Vr)}</span>
            <span className="result-tile-sub">{formatVolumeSub(bandpassData.Vr)}</span>
          </div>
          <div className="result-tile">
            <span className="result-tile-label">{t("Sintonía Baja (Fl)")}</span>
            <span className="result-tile-value">
              {bandpassData.valid && bandpassData.Fl ? `${bandpassData.Fl.toFixed(1)} Hz` : 'N/A'}
            </span>
            <span className="result-tile-sub">{t("Sintonía de la cámara trasera")}</span>
          </div>
          <div className="result-tile">
            <span className="result-tile-label">{t("Sintonía Alta (Fh)")}</span>
            <span className="result-tile-value">
              {bandpassData.valid && bandpassData.Fh ? `${bandpassData.Fh.toFixed(1)} Hz` : 'N/A'}
            </span>
            <span className="result-tile-sub">{t("Sintonía de la cámara delantera")}</span>
          </div>
        </div>
      )}

      {bandpassOrder === 4 && bandpassData.valid && bandpassData.delta_f !== undefined && (
        <div className="results-summary" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginTop: '1rem' }}>
          <div className="result-tile">
            <span className="result-tile-label">{t("Ancho de Banda (Δf)")}</span>
            <span className="result-tile-value">{`${bandpassData.delta_f.toFixed(1)} Hz`}</span>
            <span className="result-tile-sub">{`${(bandpassData.F0 ? bandpassData.F0 - bandpassData.delta_f / 2 : 0).toFixed(1)} Hz a ${(bandpassData.F0 ? bandpassData.F0 + bandpassData.delta_f / 2 : 0).toFixed(1)} Hz`}</span>
          </div>
        </div>
      )}

      <div className="control-group" style={{ marginTop: '1.5rem' }}>
        {bandpassOrder === 4 ? (
          <div className="slider-container">
            <div className="slider-header">
              <span className="slider-name">{t("Factor de Respuesta Plana (S)")}</span>
              <span className="slider-val">{bandpassS.toFixed(3)}</span>
            </div>
            <input 
              type="range" 
              min="0.4" 
              max="1.2" 
              step="0.01" 
              value={bandpassS} 
              onChange={(e) => setBandpassS(parseFloat(e.target.value))} 
            />
            <span className="wood-note">
              {t("Un valor de S = 0.707 provee la respuesta transitoria más plana. Valores más bajos reducen el ancho de banda incrementando la eficiencia. Valores mayores ensanchan la respuesta pero reducen la eficiencia.")}
            </span>
          </div>
        ) : (
          <div className="slider-container">
            <div className="slider-header">
              <span className="slider-name">{t("Factor de Sintonía (a)")}</span>
              <span className="slider-val">{bandpassA.toFixed(2)}</span>
            </div>
            <input 
              type="range" 
              min="1.0" 
              max="5.0" 
              step="0.1" 
              value={bandpassA} 
              onChange={(e) => setBandpassA(parseFloat(e.target.value))} 
            />
            <span className="wood-note">
              {t("El factor 'a' define la separación entre las frecuencias de sintonía de ambas cámaras. Valores mayores aumentan el ancho de banda acústico a costa de la eficiencia global.")}
            </span>
          </div>
        )}
      </div>

      <div className="alert-box info" style={{ marginTop: '1.5rem' }}>
        <span>
          {bandpassOrder === 4 
            ? t("Los recintos paso banda de 4.º orden actúan como filtros acústicos naturales. Tienen una caída de 12dB/octava en ambos extremos. El transductor está completamente oculto y todo el sonido sale del puerto delantero.")
            : t("Los recintos paso banda de 6.º orden paralelo ventilan ambas cámaras al exterior. Proporcionan una mayor eficiencia acústica y una caída de 24dB/octava en las bajas frecuencias, ofreciendo un excelente control del cono en el ancho de sintonía.")}
        </span>
      </div>

      {onExportReport && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--card-border)' }}>
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={onExportReport}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t("Exportar Reporte PDF")}
          </button>
        </div>
      )}
    </div>
  );
};
