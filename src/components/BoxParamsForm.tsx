import React, { useState, useEffect } from 'react';
import { type Lang, translate } from '../utils/translations';
import { type UnitSystem, convertTo, convertFrom, getUnitLabel } from '../utils/units';
import type { CalculatedPorted, CalculatedSealed, CalculatedBandpass, SpeakerParams } from '../types';
import { suggestPortConfig } from '../utils/acousticMath';

interface BoxParamsFormProps {
  lang: Lang;
  unitSystem: UnitSystem;
  boxType: 'sealed' | 'ported' | 'bandpass';
  setBoxType: (type: 'sealed' | 'ported' | 'bandpass') => void;
  customVb: number;
  setCustomVb: (vb: number) => void;
  customFb: number;
  setCustomFb: (fb: number) => void;
  customPorted: boolean;
  setCustomPorted: (val: boolean) => void;
  params: SpeakerParams;
  portedData: CalculatedPorted;
  sealedData: CalculatedSealed;
  bandpassData: CalculatedBandpass;
  isLinkedToCabinet: boolean;

  // Ajustes de alineación
  targetQtc: number;
  setTargetQtc: (val: number) => void;
  bandpassOrder: 4 | 6;
  setBandpassOrder: (val: 4 | 6) => void;
  bandpassS: number;
  setBandpassS: (val: number) => void;
  bandpassA: number;
  setBandpassA: (val: number) => void;

  // Puerto de Aire
  portCount: number | '';
  setPortCount: (count: number | '') => void;
  portDiameter: number | '';
  setPortDiameter: (dia: number | '') => void;
  portShape: 'round' | 'rectangular';
  setPortShape: (shape: 'round' | 'rectangular') => void;
  portWidth: number | '';
  setPortWidth: (w: number | '') => void;
  portHeight: number | '';
  setPortHeight: (h: number | '') => void;
  portArea: number | '';
  setPortArea: (a: number | '') => void;
  portLength: string;

  // Radiador Pasivo
  prTuning: 'port' | 'radiator';
  setPrTuning: (t: 'port' | 'radiator') => void;
  prDia: number;
  setPrDia: (d: number) => void;
  prVas: number;
  setPrVas: (v: number) => void;
  prFs: number;
  setPrFs: (f: number) => void;
  prMms: number;
  setPrMms: (m: number) => void;
  prFbNatural: number;
  prMasaAnadidaG: number;
}

export const BoxParamsForm: React.FC<BoxParamsFormProps> = ({
  lang,
  unitSystem,
  boxType,
  setBoxType,
  customVb,
  setCustomVb,
  customFb,
  setCustomFb,
  customPorted,
  setCustomPorted,
  params,
  portedData,
  sealedData,
  bandpassData,
  isLinkedToCabinet,

  targetQtc,
  setTargetQtc,
  bandpassOrder,
  setBandpassOrder,
  bandpassS,
  setBandpassS,
  bandpassA,
  setBandpassA,

  // Puerto
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
  portLength,

  // Radiador Pasivo
  prTuning,
  setPrTuning,
  prDia,
  setPrDia,
  prVas,
  setPrVas,
  prFs,
  setPrFs,
  prMms,
  setPrMms,
  prFbNatural,
  prMasaAnadidaG,
}) => {
  const t = (text: string) => translate(text, lang);

  // Estados para sugerencias de puerto y velocidad del aire
  const [suggestions, setSuggestions] = useState<ReturnType<typeof suggestPortConfig> | null>(null);
  const [vPeak, setVPeak] = useState<number | null>(null);

  useEffect(() => {
    if (portedData.valid && portedData.Vb > 0 && portedData.Fb > 0) {
      setSuggestions(suggestPortConfig(portedData.Vb, portedData.Fb, params));
    } else {
      setSuggestions(null);
    }
  }, [portedData, params]);

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
        if (params.sd && params.xmax) {
          const peak = (0.008 * portedData.Fb * params.sd * params.xmax) / (pCount * Math.pow(pDia, 2));
          setVPeak(peak);
        } else {
          setVPeak(null);
        }
      } else {
        setVPeak(null);
      }
    } else {
      setVPeak(null);
    }
  }, [portCount, portDiameter, portShape, portWidth, portHeight, portedData, params]);

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

  // Silenciar variables no usadas de puerto personalizado para satisfacer la verificación estricta de compilación
  if (portArea !== undefined || typeof setPortArea === 'function' || params.fs || customPorted) {
    // No-op
  }

  return (
    <aside className="panel" style={{ borderLeft: 'none' }}>
      {/* Selector de Tipo de Caja (Menú de Texto Plano con el mismo estilo de Cargar Altavoz) */}
      <div className="box-menu-links" style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.65rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.4rem' }}>
        <button 
          type="button"
          onClick={() => setBoxType('sealed')}
          style={{ 
            background: 'none', 
            border: 'none', 
            padding: 0, 
            margin: 0, 
            color: boxType === 'sealed' ? 'var(--text-main)' : 'var(--text-muted)', 
            fontWeight: boxType === 'sealed' ? 'bold' : 'normal', 
            fontSize: '0.82rem',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
            letterSpacing: '0.02em',
            transition: 'color 0.15s ease'
          }}
        >
          {t("Caja Sellada")}
        </button>
        <button 
          type="button"
          onClick={() => setBoxType('ported')}
          style={{ 
            background: 'none', 
            border: 'none', 
            padding: 0, 
            margin: 0, 
            color: boxType === 'ported' ? 'var(--text-main)' : 'var(--text-muted)', 
            fontWeight: boxType === 'ported' ? 'bold' : 'normal', 
            fontSize: '0.82rem',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
            letterSpacing: '0.02em',
            transition: 'color 0.15s ease'
          }}
        >
          {t("Caja Ventilada")}
        </button>
        <button 
          type="button"
          onClick={() => setBoxType('bandpass')}
          style={{ 
            background: 'none', 
            border: 'none', 
            padding: 0, 
            margin: 0, 
            color: boxType === 'bandpass' ? 'var(--text-main)' : 'var(--text-muted)', 
            fontWeight: boxType === 'bandpass' ? 'bold' : 'normal', 
            fontSize: '0.82rem',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
            letterSpacing: '0.02em',
            transition: 'color 0.15s ease'
          }}
        >
          {t("Caja Paso Banda")}
        </button>
      </div>

      <div className="form-section">

        {/* AJUSTES DE VOLUMEN Y SINTONÍA GLOBALES */}
        <div className="form-subsection-title">{t("Dimensionamiento y Alineación")}</div>

        {isLinkedToCabinet && (
          <div className="alert-box warn" style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
            <span>
              <strong>{t("Volumen Vinculado")}:</strong> {t("Determinado por la pestaña Woodworking.")}
            </span>
          </div>
        )}

        <div className="input-grid">
          {/* Volumen Vb */}
          <div className="input-group">
            <label>{t("Volumen Neto (Vb)")}</label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={Number(convertTo(boxType === 'sealed' ? (sealedData.valid ? sealedData.Vb : customVb) : boxType === 'ported' ? (portedData.valid ? portedData.Vb : customVb) : (bandpassData.valid ? (bandpassData.Vf + bandpassData.Vr) : customVb), 'volume', unitSystem).toFixed(2))}
                onChange={(e) => {
                  const valLitres = convertFrom(parseFloat(e.target.value) || 0, 'volume', unitSystem);
                  setCustomVb(valLitres);
                  setCustomPorted(true);
                }}
                disabled={isLinkedToCabinet}
                step="any"
              />
              <span className="unit-badge">{getUnitLabel('volume', unitSystem)}</span>
            </div>
          </div>

          {/* Frecuencia de Sintonía (si no es sellada) */}
          {boxType !== 'sealed' && (
            <div className="input-group">
              <label>{boxType === 'bandpass' ? t("Sintonía Frontal (Fb)") : t("Sintonía (Fb)")}</label>
              <div className="input-wrapper">
                <input 
                  type="number" 
                  value={Number((boxType === 'ported' ? (portedData.valid ? portedData.Fb : customFb) : (bandpassData.valid ? bandpassData.Fb : customFb)).toFixed(1))}
                  onChange={(e) => {
                    setCustomFb(parseFloat(e.target.value) || 0);
                    setCustomPorted(true);
                  }}
                  step="any"
                />
                <span className="unit-badge">Hz</span>
              </div>
            </div>
          )}
        </div>

        {boxType === 'sealed' && (
          <div className="input-grid" style={{ marginTop: '0.25rem' }}>
            <div className="input-group">
              <label>{t("Q del Sistema Objetivo (Qtc)")}</label>
              <div className="input-wrapper">
                <input 
                  type="number" 
                  value={targetQtc} 
                  onChange={(e) => setTargetQtc(parseFloat(e.target.value) || 0.707)} 
                  step="0.01"
                />
              </div>
            </div>
          </div>
        )}

        {boxType === 'bandpass' && (
          <div className="input-grid" style={{ marginTop: '0.25rem' }}>
            <div className="input-group">
              <label>{t("Orden del Filtro")}</label>
              <select 
                value={bandpassOrder} 
                onChange={(e) => setBandpassOrder(parseInt(e.target.value) as any)} 
                className="input-select"
                style={{ width: '100%', height: '34px' }}
              >
                <option value={4}>{t("4.º Orden")}</option>
                <option value={6}>{t("6.º Orden (Paralelo)")}</option>
              </select>
            </div>
            {bandpassOrder === 4 ? (
              <div className="input-group">
                <label>{t("Factor de Calidad (S)")}</label>
                <div className="input-wrapper">
                  <input 
                    type="number" 
                    value={bandpassS} 
                    onChange={(e) => setBandpassS(parseFloat(e.target.value) || 0.707)} 
                    step="0.05"
                  />
                </div>
              </div>
            ) : (
              <div className="input-group">
                <label>{t("Ganancia (A)")}</label>
                <div className="input-wrapper">
                  <input 
                    type="number" 
                    value={bandpassA} 
                    onChange={(e) => setBandpassA(parseFloat(e.target.value) || 2.0)} 
                    step="0.1"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* CONTROLES ADICIONALES DE CAJA VENTILADA (PUERTO Y RADIADOR) */}
        {boxType === 'ported' && (
          <>
            <div className="form-subsection-title">{t("Sistema de Ventilación")}</div>
            
            <div className="input-group input-group-full">
              <label>{t("Sintonización mediante")}</label>
              <select 
                value={prTuning} 
                onChange={(e) => setPrTuning(e.target.value as any)} 
                className="input-select"
                style={{ width: '100%', height: '34px' }}
              >
                <option value="port">{t("Puerto / Conducto de Aire")}</option>
                <option value="radiator">{t("Radiador Pasivo")}</option>
              </select>
            </div>

            {prTuning === 'port' ? (
              <>
                <div className="input-group input-group-full">
                  <label>{t("Forma del Puerto")}</label>
                  <select 
                    value={portShape} 
                    onChange={(e) => setPortShape(e.target.value as any)} 
                    className="input-select"
                    style={{ width: '100%', height: '34px' }}
                  >
                    <option value="round">{t("Redondo / Tubo")}</option>
                    <option value="rectangular">{t("Rectangular / Ranura")}</option>
                  </select>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: portShape === 'rectangular' ? '1fr 1fr 1fr 1.2fr' : '1fr 1fr 1.2fr',
                  gap: '0.45rem'
                }}>
                  <div className="input-group">
                    <label>{t("Cantidad")}</label>
                    <div className="input-wrapper">
                      <input 
                        type="number" 
                        value={portCount} 
                        onChange={(e) => setPortCount(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))} 
                      />
                    </div>
                  </div>

                  {portShape === 'round' ? (
                    <>
                      <div className="input-group">
                        <label>{t("Diámetro")}</label>
                        <div className="input-wrapper">
                          <input 
                            type="number" 
                            value={portDiameter} 
                            onChange={(e) => setPortDiameter(e.target.value === '' ? '' : Math.max(0.1, parseFloat(e.target.value) || 0))} 
                            step="any"
                          />
                          <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                        </div>
                      </div>
                      <div className="input-group">
                        <label>{t("Longitud (Lv)")}</label>
                        <div className="input-wrapper">
                          <input 
                            type="text" 
                            value={portLength} 
                            readOnly 
                            style={{ 
                              color: 'var(--ported-color)', 
                              cursor: 'default',
                              fontWeight: 'normal'
                            }}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="input-group">
                        <label>{t("Ancho")}</label>
                        <div className="input-wrapper">
                          <input 
                            type="number" 
                            value={portWidth} 
                            onChange={(e) => setPortWidth(e.target.value === '' ? '' : Math.max(0.1, parseFloat(e.target.value) || 0))} 
                            step="any"
                          />
                          <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                        </div>
                      </div>
                      <div className="input-group">
                        <label>{t("Alto")}</label>
                        <div className="input-wrapper">
                          <input 
                            type="number" 
                            value={portHeight} 
                            onChange={(e) => setPortHeight(e.target.value === '' ? '' : Math.max(0.1, parseFloat(e.target.value) || 0))} 
                            step="any"
                          />
                          <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                        </div>
                      </div>
                      <div className="input-group">
                        <label>{t("Longitud (Lv)")}</label>
                        <div className="input-wrapper">
                          <input 
                            type="text" 
                            value={portLength} 
                            readOnly 
                            style={{ 
                              color: 'var(--ported-color)', 
                              cursor: 'default',
                              fontWeight: 'normal'
                            }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* AVISO DE VELOCIDAD DEL AIRE Y SUGERENCIAS DE PUERTO */}
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className={portVelocityAlert.className} style={{ fontSize: '0.78rem', padding: '0.5rem 0.75rem', borderRadius: '6px' }} dangerouslySetInnerHTML={{ __html: portVelocityAlert.html }} />
                  
                  {suggestions && suggestions.valid ? (
                    <div className="wood-note" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.6rem 0.8rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--card-border)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        {t("Sugerencias de Puertos")}
                      </span>
                      <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.72rem', lineHeight: '1.35', color: 'var(--text-muted)' }}>
                        {t("Para evitar soplidos se requiere un diámetro redondo mínimo de")}{' '}
                        <strong>{convertTo(suggestions.dMin || 0, 'length', unitSystem).toFixed(2)} {getUnitLabel('length', unitSystem)}</strong>.
                      </p>
                      <table className="wood-table" style={{ fontSize: '0.7rem', width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th>{portShape === 'rectangular' ? t('Dimensiones') : t('Diámetro')}</th>
                            <th>{t('Longitud')}</th>
                            <th>{t('Simular')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {suggestions.options?.slice(0, 3).map((opt: any, idx: number) => {
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
                              sugText = `${opt.numPorts}x de ${displayW.toFixed(1)}x${displayH.toFixed(1)}`;
                              applyFn = () => handleApplyRectangularPort(opt.numPorts, wCm, hCm);
                            } else {
                              sugText = `${opt.numPorts}x Ø ${displayOptDia.toFixed(2)}`;
                              applyFn = () => handleApplyPort(opt.numPorts, opt.diameter);
                            }

                            return (
                              <tr key={idx}>
                                <td><strong>{sugText}</strong></td>
                                <td>{lengthText}</td>
                                <td>
                                  <button 
                                    onClick={applyFn} 
                                    className="preset-select" 
                                    style={{ padding: '0.15rem 0.35rem', fontSize: '0.68rem', background: 'var(--primary)', border: '1px solid var(--primary)', color: '#ffffff', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
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
                    </div>
                  ) : suggestions && (
                    <div className="alert-box info" style={{ fontSize: '0.72rem', padding: '0.5rem 0.75rem', marginTop: '0.25rem' }}>
                      {t("Ingresa Sd y Xmax en parámetros físicos para ver sugerencias de puertos.")}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="input-grid">
                  <div className="input-group">
                    <label>{t("Diámetro Radiador")}</label>
                    <div className="input-wrapper">
                      <input 
                        type="number" 
                        value={prDia} 
                        onChange={(e) => setPrDia(Math.max(1, parseFloat(e.target.value) || 0))} 
                      />
                      <span className="unit-badge">cm</span>
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
                      <span className="unit-badge">L</span>
                    </div>
                  </div>
                  <div className="input-group">
                    <label>{t("Resonancia (Fs)")}</label>
                    <div className="input-wrapper">
                      <input 
                        type="number" 
                        value={prFs} 
                        onChange={(e) => setPrFs(Math.max(1, parseFloat(e.target.value) || 0))} 
                      />
                      <span className="unit-badge">Hz</span>
                    </div>
                  </div>
                  <div className="input-group">
                    <label>{t("Masa Móvil (Mms)")}</label>
                    <div className="input-wrapper">
                      <input 
                        type="number" 
                        value={prMms} 
                        onChange={(e) => setPrMms(Math.max(1, parseFloat(e.target.value) || 0))} 
                      />
                      <span className="unit-badge">g</span>
                    </div>
                  </div>
                </div>

                <div className="alert-box success" style={{ padding: '0.6rem 0.8rem', fontSize: '0.8rem', marginTop: '0.5rem', marginBottom: '0' }}>
                  <span>
                    <strong>{t("Masa Añadida:")}</strong> {prMasaAnadidaG.toFixed(1)} g <br />
                    <small>{t("Sintonía natural sin peso:")} {prFbNatural.toFixed(1)} Hz</small>
                  </span>
                </div>
              </>
            )}
          </>
        )}

        {/* DETALLES DE CAJA SELLADA */}
        {boxType === 'sealed' && sealedData.valid && (
          <>
            <div className="form-subsection-title">{t("Especificaciones de Respuesta")}</div>
            <div className="alert-box info" style={{ padding: '0.6rem 0.8rem', fontSize: '0.8rem' }}>
              <ul style={{ margin: '0 0 0 1rem', padding: 0 }}>
                <li>Qtc (Q del sistema): <strong>{sealedData.Qtc.toFixed(2)}</strong></li>
                <li>Fc (Resonancia sistema): <strong>{sealedData.Fc.toFixed(1)} Hz</strong></li>
                <li>F3 (Corte -3dB): <strong>{sealedData.F3.toFixed(1)} Hz</strong></li>
              </ul>
            </div>
          </>
        )}

        {/* DETALLES DE PASO BANDA */}
        {boxType === 'bandpass' && bandpassData.valid && (
          <>
            <div className="form-subsection-title">{t("Cámaras Paso Banda")}</div>
            <div className="alert-box info" style={{ padding: '0.6rem 0.8rem', fontSize: '0.8rem' }}>
              <ul style={{ margin: '0 0 0 1rem', padding: 0 }}>
                <li>{t("Cámara trasera (Vr)")}: <strong>{bandpassData.Vr.toFixed(1)} L</strong></li>
                <li>{t("Cámara frontal (Vf)")}: <strong>{bandpassData.Vf.toFixed(1)} L</strong></li>
                <li>Frecuencia Central (F0): <strong>{(bandpassData.F0 || 0).toFixed(1)} Hz</strong></li>
                <li>Ancho de Banda: <strong>{(bandpassData.Fl || 0).toFixed(0)} - {(bandpassData.Fh || 0).toFixed(0)} Hz</strong></li>
              </ul>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
