import React, { useEffect, useState } from 'react';
import { type Lang, translate } from '../utils/translations';
import type { CalculatedPorted, SpeakerParams } from '../types';
import { suggestPortConfig } from '../utils/acousticMath';
import { calcSuggestedPorted } from '../wasm/index';

import { type UnitSystem, convertTo, convertFrom, getUnitLabel } from '../utils/units';

interface PortedBoxTabProps {
  lang: Lang;
  unitSystem: UnitSystem;
  portedData: CalculatedPorted;
  params: SpeakerParams;
  customVb: number;
  setCustomVb: (vb: number) => void;
  customFb: number;
  setCustomFb: (fb: number) => void;
  customPorted: boolean;
  setCustomPorted: (val: boolean) => void;
  portCount: number | '';
  setPortCount: (count: number | '') => void;
  portDiameter: number | '';
  setPortDiameter: (diameter: number | '') => void;
  portShape: 'round' | 'rectangular' | 'custom';
  setPortShape: (shape: 'round' | 'rectangular' | 'custom') => void;
  portWidth: number | '';
  setPortWidth: (width: number | '') => void;
  portHeight: number | '';
  setPortHeight: (height: number | '') => void;
  portArea: number | '';
  setPortArea: (area: number | '') => void;
  isLinkedToCabinet: boolean;
}

export const PortedBoxTab: React.FC<PortedBoxTabProps> = ({
  lang,
  unitSystem,
  portedData,
  params,
  customVb,
  setCustomVb,
  customFb,
  setCustomFb,
  customPorted,
  setCustomPorted,
  portCount,
  setPortCount,
  portDiameter,
  setPortDiameter,
  portShape,
  setPortShape,
  portWidth,
  setPortWidth,
  portHeight,
  setPortHeight,
  portArea,
  setPortArea,
  isLinkedToCabinet
}) => {
  const t = (text: string) => translate(text, lang);

  // Suggested commercial port sizes
  const [suggestions, setSuggestions] = useState<ReturnType<typeof suggestPortConfig> | null>(null);

  useEffect(() => {
    if (portedData.valid && portedData.Vb > 0 && portedData.Fb > 0) {
      setSuggestions(suggestPortConfig(portedData.Vb, portedData.Fb, params));
    } else {
      setSuggestions(null);
    }
  }, [portedData, params]);

  // Port length Lv
  const [portLength, setPortLength] = useState<string>('N/A');
  const [vPeak, setVPeak] = useState<number | null>(null);

  useEffect(() => {
    const pCount = typeof portCount === 'number' ? portCount : 0;
    if (pCount > 0 && portedData.Vb > 0) {
      let pDia = 0;
      if (portShape === 'round') {
        pDia = portDiameter || 0;
      } else {
        const w = portWidth || 0;
        const h = portHeight || 0;
        pDia = 2 * Math.sqrt((w * h) / Math.PI); // Diámetro equivalente
      }

      if (pDia > 0) {
        const rPort = pDia / 2;
        const Lv = ((23562.5 * Math.pow(pDia, 2) * pCount) / (portedData.Fb * portedData.Fb * portedData.Vb)) - (1.46 * rPort);
        
        const displayLv = convertTo(Lv, 'length', unitSystem);
        const unitLabel = getUnitLabel('length', unitSystem);

        if (Lv <= 0) {
          setPortLength(t("Excesivamente corto"));
        } else if (Lv > 120) {
          setPortLength(`${displayLv.toFixed(1)} ${unitLabel} (${t("Excede caja")})`);
        } else {
          setPortLength(`${displayLv.toFixed(1)} ${unitLabel}`);
        }

        if (params.sd && params.xmax) {
          const peak = (0.008 * portedData.Fb * params.sd * params.xmax) / (pCount * Math.pow(pDia, 2));
          setVPeak(peak);
        } else {
          setVPeak(null);
        }
      } else {
        setPortLength('N/A');
        setVPeak(null);
      }
    } else {
      setPortLength('N/A');
      setVPeak(null);
    }
  }, [portCount, portDiameter, portShape, portWidth, portHeight, portedData, params, lang, unitSystem]);

  const handleApplyPort = (num: number, dia: number) => {
    setPortShape('round');
    setPortCount(num);
    setPortDiameter(dia);
  };

  const handleApplyRectangularPort = (num: number, width: number, height: number) => {
    setPortShape('rectangular');
    setPortCount(num);
    setPortWidth(width);
    setPortHeight(height);
  };

  const getPortVelocityAlert = () => {
    if (vPeak === null) {
      return {
        className: 'alert-box info',
        html: `<strong>${t("Falta Sd/Xmax:")}</strong> ${t("Ingresa el área del cono y excursión en 'Parámetros Físicos Básicos' para estimar la velocidad del aire y prevenir turbulencias.")}`
      };
    }
    
    if (vPeak < 10.0) {
      return {
        className: 'alert-box success',
        html: `<strong>${t("Velocidad de aire excelente")} (${vPeak.toFixed(1)} m/s):</strong> ${t("Puerto libre de ruidos de turbulencia. Operación silenciosa.")}`
      };
    } else if (vPeak >= 10.0 && vPeak <= 17.0) {
      return {
        className: 'alert-box warn',
        html: `<strong>${t("Velocidad moderada")} (${vPeak.toFixed(1)} m/s):</strong> ${t("Aceptable para la mayoría de aplicaciones. Se recomienda usar extremos redondeados (flared) para evitar soplidos leves.")}`
      };
    } else {
      return {
        className: 'alert-box danger',
        html: `<strong>${t("¡Velocidad crítica!")} (${vPeak.toFixed(1)} m/s):</strong> ${t("Flujo ruidoso. El puerto producirá soplidos (\"chuffing\"). Aumenta el diámetro o la cantidad de puertos.")}`
      };
    }
  };

  const portVelocityAlert = getPortVelocityAlert();

  return (
    <div className="tab-content active" id="tab-ported">
      {isLinkedToCabinet && (
        <div className="alert-box warn" style={{ marginBottom: '1rem' }}>
          <span>
            <strong>{t("Volumen Vinculado")}:</strong>{' '}
            {t("El volumen de la caja ventilada está determinado por las dimensiones manuales ingresadas en la pestaña de")}{' '}
            <strong>{t("Woodworking")}</strong> ({t("Volumen Neto (Vb)")}).
          </span>
        </div>
      )}

      <div className="results-summary">
        <div className="result-tile">
          <span className="result-tile-label">{t("Volumen Neto (Vb)")}</span>
          <span className="result-tile-value">
            {portedData.valid 
              ? (unitSystem === 'metric' ? `${portedData.Vb.toFixed(1)} L` : `${(portedData.Vb / 28.3168466).toFixed(3)} ft³`) 
              : 'N/A'}
          </span>
          <span className="result-tile-sub">
            {portedData.valid 
              ? (unitSystem === 'metric' ? `${(portedData.Vb / 28.3168466).toFixed(3)} ft³` : `${portedData.Vb.toFixed(1)} L`) 
              : ''}
          </span>
        </div>
        <div className="result-tile">
          <span className="result-tile-label">{t("Frecuencia Sintonía (Fb)")}</span>
          <span className="result-tile-value">{portedData.valid ? `${portedData.Fb.toFixed(1)} Hz` : 'N/A'}</span>
          <span className="result-tile-sub">{t("Sintonía del puerto de aire")}</span>
        </div>
        <div className="result-tile">
          <span className="result-tile-label">{t("Frecuencia Corte (-3dB)")}</span>
          <span className="result-tile-value">{portedData.valid ? `${portedData.F3.toFixed(1)} Hz` : 'N/A'}</span>
          <span className="result-tile-sub">{t("Caída rápida de 24dB/octava")}</span>
        </div>
      </div>

      <div className="control-group">
        <div className="control-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>{t("Alineación y Sintonía")}</span>
            <span style={{ fontSize: '0.72rem', textTransform: 'none', color: '#818cf8', fontWeight: 600, background: 'rgba(99, 102, 241, 0.15)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
              {t(portedData.alignment)}
            </span>
          </div>
          {!isLinkedToCabinet && (
            <label className="checkbox-container">
              <input type="checkbox" checked={customPorted} onChange={(e) => setCustomPorted(e.target.checked)} />
              <div className="custom-checkbox"></div>
              <span>{t("Personalizar Vb / Fb")}</span>
            </label>
          )}
        </div>

        {((customPorted && !isLinkedToCabinet) || (isLinkedToCabinet)) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
            {!isLinkedToCabinet && (
              <div className="slider-container">
                <div className="slider-header">
                  <span className="slider-name">{t("Volumen de la Caja (Vb)")}</span>
                  <span className="slider-val">
                    {unitSystem === 'metric' 
                      ? `${customVb.toFixed(1)} L` 
                      : `${convertTo(customVb, 'volume', unitSystem).toFixed(3)} ft³`}
                  </span>
                </div>
                <input 
                  type="range" 
                  min={convertTo(5, 'volume', unitSystem)} 
                  max={convertTo(250, 'volume', unitSystem)} 
                  step={unitSystem === 'metric' ? "0.5" : "0.01"} 
                  value={convertTo(customVb, 'volume', unitSystem)} 
                  onChange={(e) => setCustomVb(convertFrom(parseFloat(e.target.value), 'volume', unitSystem))} 
                />
              </div>
            )}
            <div className="slider-container">
              <div className="slider-header">
                <span className="slider-name">{t("Frecuencia de Sintonía (Fb)")}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    onClick={async () => {
                      const sug = await calcSuggestedPorted(params.qts, params.fs, params.vas);
                      if (sug && sug.Fb) {
                        setCustomFb(Math.round(sug.Fb * 10) / 10);
                      }
                    }}
                    className="preset-select"
                    style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', background: 'var(--primary)', border: '1px solid var(--primary)', color: '#ffffff', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                    type="button"
                  >
                    {t("Sugerida")}
                  </button>
                  <span className="slider-val">{customFb.toFixed(1)} Hz</span>
                </div>
              </div>
              <input 
                type="range" 
                min="20" 
                max="100" 
                step="0.5" 
                value={customFb} 
                onChange={(e) => setCustomFb(parseFloat(e.target.value))} 
              />
            </div>
          </div>
        )}

        {/* CONFIGURACIÓN Y FORMA DEL PUERTO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem', marginTop: '0.5rem' }}>
          
          {/* Selector de forma de puerto */}
          <div className="input-group">
            <label>{t("Forma del Puerto")}</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button 
                type="button"
                className={`preset-select ${portShape === 'round' ? 'active' : ''}`}
                style={{ flex: 1, padding: '0.4rem 0.8rem', background: portShape === 'round' ? 'var(--primary)' : 'transparent', color: portShape === 'round' ? '#fff' : 'var(--text-main)', border: '1px solid var(--card-border)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => setPortShape('round')}
              >
                {t("Redondo / Tubo")}
              </button>
              <button 
                type="button"
                className={`preset-select ${portShape === 'rectangular' ? 'active' : ''}`}
                style={{ flex: 1, padding: '0.4rem 0.8rem', background: portShape === 'rectangular' ? 'var(--primary)' : 'transparent', color: portShape === 'rectangular' ? '#fff' : 'var(--text-main)', border: '1px solid var(--card-border)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => setPortShape('rectangular')}
              >
                {t("Rectangular / Ranura")}
              </button>
            </div>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: portShape === 'rectangular' ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', 
            gap: '0.85rem', 
            alignItems: 'end' 
          }}>
            <div className="input-group">
              <label>{t("Cantidad")}</label>
              <div className="input-wrapper">
                <input 
                  type="number" 
                  min="1" 
                  max="6" 
                  value={portCount} 
                  onChange={(e) => {
                    if (e.target.value === '') {
                      setPortCount('');
                      return;
                    }
                    const newCount = parseInt(e.target.value);
                    if (!isNaN(newCount) && newCount > 0) {
                      const oldCount = typeof portCount === 'number' ? portCount : 1;
                      const ratio = Math.sqrt(oldCount / newCount);

                      if (portShape === 'round' && portDiameter && portDiameter > 0) {
                        setPortDiameter(portDiameter * ratio);
                      } else if (portShape === 'rectangular') {
                        if (portWidth && portWidth > 0) setPortWidth(portWidth * ratio);
                        if (portHeight && portHeight > 0) setPortHeight(portHeight * ratio);
                      } else if (portShape === 'custom' && portArea && portArea > 0) {
                        setPortArea(portArea * (oldCount / newCount));
                      }
                      setPortCount(newCount);
                    }
                  }} 
                />
                <span className="unit-badge">u.</span>
              </div>
            </div>

            {/* Inputs dinámicos según forma */}
            {portShape === 'round' && (
              <div className="input-group">
                <label>{t("Diámetro Interno")}</label>
                <div className="input-wrapper">
                  <input 
                    type="number" 
                    step="any" 
                    value={portDiameter !== '' ? (Math.round(convertTo(portDiameter, 'length', unitSystem) * 1000) / 1000) : ''} 
                    onChange={(e) => setPortDiameter(e.target.value === '' ? '' : convertFrom(parseFloat(e.target.value), 'length', unitSystem))} 
                  />
                  <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                </div>
              </div>
            )}

            {portShape === 'rectangular' && (
              <>
                <div className="input-group">
                  <label>{t("Ancho del Puerto")}</label>
                  <div className="input-wrapper">
                    <input 
                      type="number" 
                      step="any" 
                      value={portWidth !== '' ? (Math.round(convertTo(portWidth, 'length', unitSystem) * 100) / 100) : ''} 
                      onChange={(e) => setPortWidth(e.target.value === '' ? '' : convertFrom(parseFloat(e.target.value), 'length', unitSystem))} 
                    />
                    <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                  </div>
                </div>
                <div className="input-group">
                  <label>{t("Alto del Puerto")}</label>
                  <div className="input-wrapper">
                    <input 
                      type="number" 
                      step="any" 
                      value={portHeight !== '' ? (Math.round(convertTo(portHeight, 'length', unitSystem) * 100) / 100) : ''} 
                      onChange={(e) => setPortHeight(e.target.value === '' ? '' : convertFrom(parseFloat(e.target.value), 'length', unitSystem))} 
                    />
                    <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                  </div>
                </div>
              </>
            )}

            {/* Longitud requerida al lado del diámetro */}
            <div className="input-group">
              <label>{t("Longitud requerida (por puerto)")}</label>
              <div className="input-wrapper">
                <input 
                  type="text" 
                  value={portLength} 
                  readOnly 
                  style={{ caretColor: 'transparent', cursor: 'default', fontWeight: 600, color: 'var(--ported-color)' }}
                />
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Panel de Sugerencias de Puerto */}
      <div className="control-group">
        <span className="control-title" style={{ color: 'var(--ported-color)' }}>
          {t("Sugerencias de Puertos (Evitar Turbulencia)")}
        </span>
        <div className="wood-note" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {suggestions && suggestions.valid ? (
            <>
              <p style={{ marginBottom: '0.4rem', lineHeight: '1.4' }}>
                {t('Para evitar turbulencias ("chuffing") a excursión máxima ($Xmax$), se requiere una superficie de ventilación equivalente a un conducto redondo de')}{' '}
                <strong>{convertTo(suggestions.dMin || 0, 'length', unitSystem).toFixed(2)} {getUnitLabel('length', unitSystem)}</strong> {t('de diámetro.')}
              </p>
              <table className="wood-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>{portShape === 'rectangular' ? t('Cant. x Dimensiones') : t('Cant. x Diámetro')}</th>
                    <th>{t('Tipo Ducto')}</th>
                    <th>{t('Longitud Unit.')}</th>
                    <th>{t('Simular')}</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.options?.map((opt: any, idx: number) => {
                    const typeText = !opt.isCustom 
                      ? t("Mínimo Teórico") 
                      : `${t("Comercial")} ${opt.diameter === 5 ? '2"' : opt.diameter === 7.5 ? '3"' : opt.diameter === 10 ? '4"' : '6"'}`;
                    
                    const displayOptDia = convertTo(opt.diameter, 'length', unitSystem);
                    const displayOptLen = convertTo(opt.length, 'length', unitSystem);
                    const unitLabel = getUnitLabel('length', unitSystem);

                    const lengthText = opt.length > 0 ? `${displayOptLen.toFixed(1)} ${unitLabel}` : t("Inviable");
                    
                    let sugText = '';
                    let applyFn = () => {};

                    if (portShape === 'rectangular') {
                      const area = Math.PI * Math.pow(opt.diameter / 2, 2);
                      let hCm = 5.0;
                      if (opt.diameter <= 5.0) hCm = 4.0;
                      else if (opt.diameter > 5.0 && opt.diameter <= 7.5) hCm = 5.0;
                      else if (opt.diameter > 7.5 && opt.diameter <= 10.0) hCm = 7.0;
                      else hCm = 10.0;

                      const wCm = area / hCm;
                      const displayW = convertTo(wCm, 'length', unitSystem);
                      const displayH = convertTo(hCm, 'length', unitSystem);
                      sugText = `${opt.numPorts}x de ${displayW.toFixed(1)} x ${displayH.toFixed(1)} ${unitLabel}`;
                      applyFn = () => handleApplyRectangularPort(opt.numPorts, wCm, hCm);
                    } else {
                      sugText = `${opt.numPorts}x de ${displayOptDia.toFixed(2)} ${unitLabel}`;
                      applyFn = () => handleApplyPort(opt.numPorts, opt.diameter);
                    }

                    return (
                      <tr key={idx}>
                        <td><strong>{sugText}</strong></td>
                        <td>{typeText}</td>
                        <td style={{ fontWeight: 500 }}>{lengthText}</td>
                        <td>
                          <button 
                            onClick={applyFn} 
                            className="preset-select" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--primary)', border: '1px solid var(--primary)', color: '#ffffff', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
                          >
                            {t('Aplicar')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              {t("Ingresa el área del cono (Sd) y excursión (Xmax) en la barra lateral para recibir sugerencias de puertos sin ruido de viento.")}
            </p>
          )}
        </div>
      </div>

      {/* Estado de Velocidad del Puerto */}
      <div className={portVelocityAlert.className} style={{ marginBottom: '1rem' }} dangerouslySetInnerHTML={{ __html: portVelocityAlert.html }} />

      <div className="alert-box success" style={{ marginTop: '1rem' }}>
        <span>{t("Las cajas ventiladas aprovechan la onda trasera mediante el puerto para extender la respuesta y ganar eficiencia en graves extremos.")}</span>
      </div>
    </div>
  );
};
