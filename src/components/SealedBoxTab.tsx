import React from 'react';
import { type Lang, translate } from '../utils/translations';
import type { CalculatedSealed } from '../types';

interface SealedBoxTabProps {
  lang: Lang;
  sealedData: CalculatedSealed;
  targetQtc: number;
  setTargetQtc: (qtc: number) => void;
  isLinkedToCabinet: boolean;
}

export const SealedBoxTab: React.FC<SealedBoxTabProps> = ({
  lang,
  sealedData,
  targetQtc,
  setTargetQtc,
  isLinkedToCabinet
}) => {
  const t = (text: string) => translate(text, lang);

  const getSealedVbText = () => {
    if (!sealedData.valid || sealedData.Vb <= 0) return t("Inviable");
    return `${sealedData.Vb.toFixed(1)} L`;
  };

  const getSealedVbFtText = () => {
    if (!sealedData.valid || sealedData.Vb <= 0) return t("Qts es muy alto para este Qtc");
    return `${(sealedData.Vb / 28.317).toFixed(3)} ft³`;
  };

  return (
    <div className="tab-content active" id="tab-sealed">
      {isLinkedToCabinet && (
        <div className="alert-box warn" style={{ marginBottom: '1rem' }}>
          <span>
            <strong>{t("Volumen Vinculado")}:</strong>{' '}
            {t("El volumen de la caja sellada está determinado por las dimensiones manuales ingresadas en la pestaña de")}{' '}
            <strong>{t("Woodworking")}</strong> ({t("Volumen Neto (Vb)")}).
          </span>
        </div>
      )}

      <div className="results-summary">
        <div className="result-tile">
          <span className="result-tile-label">{t("Volumen Neto (Vb)")}</span>
          <span className="result-tile-value">{getSealedVbText()}</span>
          <span className="result-tile-sub">{getSealedVbFtText()}</span>
        </div>
        <div className="result-tile">
          <span className="result-tile-label">{t("Frec. Resonancia (Fc)")}</span>
          <span className="result-tile-value">
            {sealedData.valid && sealedData.Fc > 0 ? `${sealedData.Fc.toFixed(1)} Hz` : 'N/A'}
          </span>
          <span className="result-tile-sub">{t("Resonancia del sistema")}</span>
        </div>
        <div className="result-tile">
          <span className="result-tile-label">{t("Frec. Corte (-3dB) (F3)")}</span>
          <span className="result-tile-value">
            {sealedData.valid && sealedData.F3 > 0 ? `${sealedData.F3.toFixed(1)} Hz` : 'N/A'}
          </span>
          <span className="result-tile-sub">{t("Caída real a -3dB")}</span>
        </div>
        <div className="result-tile">
          <span className="result-tile-label">{t("Qtc Ajustado")}</span>
          <span className="result-tile-value">
            {sealedData.valid ? `${sealedData.Qtc.toFixed(3)}${isLinkedToCabinet ? ' (' + t("Vinculado") + ')' : ''}` : '0.707'}
          </span>
          <span className="result-tile-sub">{t("Alineación actual")}</span>
        </div>
      </div>

      {!isLinkedToCabinet && (
        <div className="control-group">
          <span className="control-title">{t("Ajuste de Caja Sellada")}</span>
          <div className="slider-container">
            <div className="slider-header">
              <span className="slider-name">{t("Qtc Objetivo (Amortiguamiento)")}</span>
              <span className="slider-val">{targetQtc.toFixed(3)}</span>
            </div>
            <input 
              type="range" 
              min="0.5" 
              max="1.3" 
              step="0.01" 
              value={targetQtc} 
              onChange={(e) => setTargetQtc(parseFloat(e.target.value))} 
            />
            <span className="wood-note">
              {t("Menor Qtc (e.g. 0.5-0.6) requiere cajas más grandes pero mejora la transitoria. Mayor Qtc (e.g. 0.9-1.2) ahorra espacio a costa de picos tipo \"boom\".")}
            </span>
          </div>
        </div>
      )}

      <div className="alert-box info">
        <span>
          {t("Las cajas selladas proveen una excelente respuesta transitoria (bajos rápidos y secos) y una caída suave de 12dB/octava ideal para espacio reducido.")}
        </span>
      </div>
    </div>
  );
};
