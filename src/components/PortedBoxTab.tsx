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
  onExportReport?: () => void;
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
  isLinkedToCabinet,
  onExportReport
}) => {
  const t = (text: string) => translate(text, lang);

  // Silenciar variables no usadas de puerto personalizado para satisfacer la verificación estricta de compilación
  if (portArea !== undefined || typeof setPortArea === 'function') {
    // No-op
  }

  // --- ESTADOS DE RADIADOR PASIVO ---
  const [prTuning, setPrTuning] = useState<'port' | 'radiator'>('port');
  const [prDia, setPrDia] = useState<number>(params.diaNominal && !isNaN(parseFloat(params.diaNominal)) ? parseFloat(params.diaNominal) * 2.54 : 20); // cm
  const [prVas, setPrVas] = useState<number>(params.vas || 45); // L
  const [prFs, setPrFs] = useState<number>(25); // Hz
  const [prMms, setPrMms] = useState<number>(35); // g
  const [prFbNatural, setPrFbNatural] = useState<number>(0);
  const [prMasaAnadidaG, setPrMasaAnadidaG] = useState<number>(0);

  useEffect(() => {
    if (portedData.valid && portedData.Vb > 0) {
      const rho = 1.205;
      const c = 343.0;
      const sd_m2 = Math.PI * Math.pow((prDia / 100) / 2, 2);
      const vb_m3 = portedData.Vb / 1000;
      const vas_m3 = prVas / 1000;

      // Compliancias acústicas
      const cab = vb_m3 / (rho * c * c * sd_m2 * sd_m2);
      const cap = vas_m3 / (rho * c * c * sd_m2 * sd_m2);

      // Masa acústica propia (kg/m4)
      const mp_propia = (prMms / 1000) / Math.pow(sd_m2, 2);

      // Sintonía natural (Hz)
      const fbNat = (1.0 / (2.0 * Math.PI)) * Math.sqrt(1.0 / (mp_propia * (cap + cab)));
      setPrFbNatural(fbNat);

      // Masa acústica total requerida para sintonizar a la frecuencia objetivo de la caja (portedData.Fb)
      const targetFb = portedData.Fb;
      const mp_total_req = 1.0 / (4.0 * Math.PI * Math.PI * targetFb * targetFb * (cap + cab));
      const mp_ad_req = mp_total_req - mp_propia;

      // Masa mecánica añadida en gramos
      const masaMecG = mp_ad_req * sd_m2 * sd_m2 * 1000;
      setPrMasaAnadidaG(Math.max(0, masaMecG));
    }
  }, [prDia, prVas, prFs, prMms, portedData, params]);

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
          <span className="result-tile-label">{prTuning === 'radiator' ? t("Sintonía Natural (Fb)") : t("Frecuencia Sintonía (Fb)")}</span>
          <span className="result-tile-value">
            {portedData.valid 
              ? (prTuning === 'radiator' ? `${prFbNatural.toFixed(1)} Hz` : `${portedData.Fb.toFixed(1)} Hz`) 
              : 'N/A'}
          </span>
          <span className="result-tile-sub">
            {prTuning === 'radiator' ? t("Sintonía natural sin peso") : t("Sintonía del puerto de aire")}
          </span>
        </div>
        <div className="result-tile">
          <span className="result-tile-label">{prTuning === 'radiator' ? t("Masa Añadida (Mad)") : t("Frecuencia Corte (-3dB)")}</span>
          <span className="result-tile-value">
            {prTuning === 'radiator' 
              ? `${prMasaAnadidaG.toFixed(1)} g` 
              : (portedData.valid ? `${portedData.F3.toFixed(1)} Hz` : 'N/A')}
          </span>
          <span className="result-tile-sub">
            {prTuning === 'radiator' ? `${t("Para sintonizar a")} ${portedData.Fb.toFixed(1)}Hz` : t("Caída rápida de 24dB/octava")}
          </span>
        </div>
      </div>

      <div className="control-group" style={{ marginBottom: '1.25rem' }}>
        <span className="control-title" style={{ color: 'var(--ported-color)' }}>{t("Tipo de Sintonía")}</span>
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
            <input 
              type="radio" 
              name="prTuning" 
              checked={prTuning === 'port'} 
              onChange={() => setPrTuning('port')} 
            />
            {t("Conducto / Puerto de Aire")}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
            <input 
              type="radio" 
              name="prTuning" 
              checked={prTuning === 'radiator'} 
              onChange={() => setPrTuning('radiator')} 
            />
            {t("Radiador Pasivo")}
          </label>
        </div>
      </div>

      {prTuning === 'port' ? (
        <>
          <div className="control-group">
            <div className="control-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>{t("Alineación y Sintonía")}</span>
                <span style={{ fontSize: '12px', color: 'inherit', fontWeight: 600, textTransform: 'none' }}>
                  {" - "}{t(portedData.alignment)}
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
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem', marginTop: '0.5rem' }}>
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
              gap: '1rem' 
            }}>
              <div className="input-group">
                <label>{t("Cantidad")}</label>
                <input 
                  type="number" 
                  value={portCount} 
                  onChange={(e) => setPortCount(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 0))} 
                  className="input-select"
                  style={{ width: '100%', height: '34px' }}
                />
              </div>

              {portShape === 'round' ? (
                <div className="input-group">
                  <label>{t("Diámetro")}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input 
                      type="number" 
                      value={portDiameter} 
                      onChange={(e) => setPortDiameter(e.target.value === '' ? '' : Math.max(0.1, parseFloat(e.target.value) || 0))} 
                      className="input-select"
                      style={{ width: '100%', height: '34px' }}
                      step="any" 
                    />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{getUnitLabel('length', unitSystem)}</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="input-group">
                    <label>{t("Ancho")}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <input 
                        type="number" 
                        value={portWidth} 
                        onChange={(e) => setPortWidth(e.target.value === '' ? '' : Math.max(0.1, parseFloat(e.target.value) || 0))} 
                        className="input-select"
                        style={{ width: '100%', height: '34px' }}
                        step="any" 
                      />
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{getUnitLabel('length', unitSystem)}</span>
                    </div>
                  </div>
                  <div className="input-group">
                    <label>{t("Alto")}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <input 
                        type="number" 
                        value={portHeight} 
                        onChange={(e) => setPortHeight(e.target.value === '' ? '' : Math.max(0.1, parseFloat(e.target.value) || 0))} 
                        className="input-select"
                        style={{ width: '100%', height: '34px' }}
                        step="any" 
                      />
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{getUnitLabel('length', unitSystem)}</span>
                    </div>
                  </div>
                </>
              )}

              <div className="input-group" style={{ gridColumn: portShape === 'rectangular' ? 'span 1' : 'span 1' }}>
                <label>{t("Longitud calculada")}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input 
                    type="text" 
                    value={portLength} 
                    readOnly 
                    className="input-select"
                    style={{ 
                      width: '100%', 
                      height: '34px', 
                      color: 'var(--ported-color)',
                      cursor: 'default',
                      fontWeight: 'normal'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

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
                                type="button"
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

          <div className={portVelocityAlert.className} style={{ marginBottom: '1rem' }} dangerouslySetInnerHTML={{ __html: portVelocityAlert.html }} />

          <div className="alert-box success" style={{ marginTop: '1rem' }}>
            <span>{t("Las cajas ventiladas aprovechan la onda trasera mediante el puerto para extender la respuesta y ganar eficiencia en graves extremos.")}</span>
          </div>
        </>
      ) : (
        <>
          <div className="control-group">
            <span className="control-title">{t("Ajuste del Radiador Pasivo")}</span>
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
                  <span className="slider-name">{t("Frecuencia de Sintonía Objetivo (Fb)")}</span>
                  <span className="slider-val">{customFb.toFixed(1)} Hz</span>
                </div>
                <input 
                  type="range" 
                  min="15" 
                  max="120" 
                  step="0.5" 
                  value={customFb} 
                  onChange={(e) => setCustomFb(parseFloat(e.target.value))} 
                />
              </div>

              <div className="input-grid" style={{ marginTop: '0.5rem' }}>
                <div className="input-group">
                  <label>{t("Diámetro del Radiador")}</label>
                  <div className="input-wrapper">
                    <input 
                      type="number" 
                      value={prDia} 
                      onChange={(e) => setPrDia(Math.max(1, parseFloat(e.target.value) || 0))} 
                    />
                    <span className="input-suffix">cm</span>
                  </div>
                </div>
                <div className="input-group">
                  <label>{t("Volumen Equiv. (Vas)")}</label>
                  <div className="input-wrapper">
                    <input 
                      type="number" 
                      value={prVas} 
                      onChange={(e) => setPrVas(Math.max(1, parseFloat(e.target.value) || 0))} 
                    />
                    <span className="input-suffix">L</span>
                  </div>
                </div>
                <div className="input-group">
                  <label>{t("Resonancia Aire Libre (Fs)")}</label>
                  <div className="input-wrapper">
                    <input 
                      type="number" 
                      value={prFs} 
                      onChange={(e) => setPrFs(Math.max(1, parseFloat(e.target.value) || 0))} 
                    />
                    <span className="input-suffix">Hz</span>
                  </div>
                </div>
                <div className="input-group">
                  <label>{t("Masa Móvil del Cono (Mms)")}</label>
                  <div className="input-wrapper">
                    <input 
                      type="number" 
                      value={prMms} 
                      onChange={(e) => setPrMms(Math.max(1, parseFloat(e.target.value) || 0))} 
                    />
                    <span className="input-suffix">g</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="alert-box info" style={{ marginTop: '1rem' }}>
            <span>{t("Los radiadores pasivos sustituyen a los puertos tradicionales. Eliminan por completo los ruidos de soplido ('chuffing') del aire y la resonancia del tubo, siendo ideales para recintos pequeños de alta potencia.")}</span>
          </div>

          <div className="alert-box success" style={{ marginTop: '1rem' }}>
            <span>{t("Las cajas con radiador pasivo se sintonizan agregando peso físico (masa añadida en gramos) al diafragma pasivo para sintonizar a la frecuencia Fb requerida.")}</span>
          </div>
        </>
      )}

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
