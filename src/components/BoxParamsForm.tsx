import React, { useMemo } from 'react';
import { type Lang, translate } from '../utils/translations';
import { type UnitSystem, convertTo, convertFrom, getUnitLabel } from '../utils/units';
import type { CalculatedPorted, CalculatedSealed, CalculatedBandpass, SpeakerParams, PortSuggestions } from '../types';
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
  flaredEnds: 0 | 1 | 2;
  setFlaredEnds: (val: 0 | 1 | 2) => void;
  useCustomPortLength: boolean;
  setUseCustomPortLength: (v: boolean) => void;
  customPortLength: number | '';
  setCustomPortLength: (v: number | '') => void;

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

  // SUBPESTAÑAS DE CONTROL CENTRAL
  activeTab: 'wood' | 'damping' | 'crossover';
  setActiveTab: (tab: 'wood' | 'damping' | 'crossover') => void;

  // Ebanistería (Woodworking)
  woodMode: 'calc' | 'input';
  setWoodMode: (mode: 'calc' | 'input') => void;
  woodShape: 'rectangular' | 'trapezoidal';
  setWoodShape: (shape: 'rectangular' | 'trapezoidal') => void;
  woodConstraint: string;
  setWoodConstraint: (constraint: string) => void;
  woodRatio: 'golden' | 'classic' | 'cube';
  setWoodRatio: (ratio: 'golden' | 'classic' | 'cube') => void;
  woodThickness: number | '';
  setWoodThickness: (val: number | '') => void;
  woodExtra: number | '';
  setWoodExtra: (val: number | '') => void;
  // Locks/Fijaciones
  woodLockVal1: number | '';
  setWoodLockVal1: (v: number | '') => void;
  woodLockVal2: number | '';
  setWoodLockVal2: (v: number | '') => void;
  woodLockVal3: number | '';
  setWoodLockVal3: (v: number | '') => void;
  // Manual Rectangular
  woodExtHeight: number | '';
  setWoodExtHeight: (v: number | '') => void;
  woodExtWidth: number | '';
  setWoodExtWidth: (v: number | '') => void;
  woodExtDepth: number | '';
  setWoodExtDepth: (v: number | '') => void;
  // Manual Trapezoidal
  woodTrapExtHeight: number | '';
  setWoodTrapExtHeight: (v: number | '') => void;
  woodTrapExtWidth: number | '';
  setWoodTrapExtWidth: (v: number | '') => void;
  woodTrapExtDepthTop: number | '';
  setWoodTrapExtDepthTop: (v: number | '') => void;
  woodTrapExtDepthBot: number | '';
  setWoodTrapExtDepthBot: (v: number | '') => void;

  // Damping
  dampingType: 'none' | 'light' | 'moderate' | 'heavy';
  setDampingType: (type: 'none' | 'light' | 'moderate' | 'heavy') => void;

  // Crossover
  crossoverWays: number;
  setCrossoverWays: (val: number) => void;
  crossoverType: '1st_order' | '2nd_butter' | '2nd_lr' | '4th_lr';
  setCrossoverType: (val: '1st_order' | '2nd_butter' | '2nd_lr' | '4th_lr') => void;
  fc: number;
  setFc: (val: number) => void;
  fcLow: number;
  setFcLow: (val: number) => void;
  fcHigh: number;
  setFcHigh: (val: number) => void;
  zTweeter: number;
  setZTweeter: (val: number) => void;
  zMidrange: number;
  setZMidrange: (val: number) => void;
  zWoofer: number;
  setZWoofer: (val: number) => void;
  enableZobel: boolean;
  setEnableZobel: (val: boolean) => void;
  zobelRe: number;
  setZobelRe: (val: number) => void;
  zobelLe: number;
  setZobelLe: (val: number) => void;
  enableLPad: boolean;
  setEnableLPad: (val: boolean) => void;
  lpadAttenuation: number;
  setLpadAttenuation: (val: number) => void;
  lpadZLoad: number;
  setLpadZLoad: (val: number) => void;
  speakerYPct: number;
  setSpeakerYPct: (val: number) => void;
  portYPct: number;
  setPortYPct: (val: number) => void;
  portLocation: 'front' | 'rear';
  setPortLocation: (val: 'front' | 'rear') => void;

  // Midrange Parameters
  midFs: number;
  setMidFs: (val: number) => void;
  midVas: number;
  setMidVas: (val: number) => void;
  midQts: number;
  setMidQts: (val: number) => void;
  midTargetQtc: number;
  setMidTargetQtc: (val: number) => void;
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
  portLength,
  flaredEnds,
  setFlaredEnds,
  useCustomPortLength,
  setUseCustomPortLength,
  customPortLength,
  setCustomPortLength,

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

  activeTab,
  setActiveTab,

  woodMode,
  setWoodMode,
  woodShape,
  setWoodShape,
  woodConstraint,
  setWoodConstraint,
  woodRatio,
  setWoodRatio,
  woodThickness,
  setWoodThickness,
  woodExtra,
  setWoodExtra,
  woodLockVal1,
  setWoodLockVal1,
  woodLockVal2,
  setWoodLockVal2,
  woodLockVal3,
  setWoodLockVal3,
  woodExtHeight,
  setWoodExtHeight,
  woodExtWidth,
  setWoodExtWidth,
  woodExtDepth,
  setWoodExtDepth,
  woodTrapExtHeight,
  setWoodTrapExtHeight,
  woodTrapExtWidth,
  setWoodTrapExtWidth,
  woodTrapExtDepthTop,
  setWoodTrapExtDepthTop,
  woodTrapExtDepthBot,
  setWoodTrapExtDepthBot,

  dampingType,
  setDampingType,

  crossoverWays,
  setCrossoverWays,
  crossoverType,
  setCrossoverType,
  fc,
  setFc,
  fcLow,
  setFcLow,
  fcHigh,
  setFcHigh,
  zTweeter,
  setZTweeter,
  zMidrange,
  setZMidrange,
  zWoofer,
  setZWoofer,
  enableZobel,
  setEnableZobel,
  zobelRe,
  setZobelRe,
  zobelLe,
  setZobelLe,
  enableLPad,
  setEnableLPad,
  lpadAttenuation,
  setLpadAttenuation,
  lpadZLoad,
  setLpadZLoad,
  speakerYPct,
  setSpeakerYPct,
  portYPct,
  setPortYPct,
  portLocation,
  setPortLocation,
  customPorted,
  midFs,
  setMidFs,
  midVas,
  setMidVas,
  midQts,
  setMidQts,
}) => {
  const t = (text: string) => translate(text, lang);

  const suggestions = useMemo<PortSuggestions | null>(() => {
    if (portedData.valid && portedData.Vb > 0 && portedData.Fb > 0) {
      const minLen = (Number(woodThickness) || 0) / 10;
      return suggestPortConfig(portedData.Vb, portedData.Fb, params, flaredEnds, minLen);
    }
    return null;
  }, [portedData, params, flaredEnds, woodThickness]);

  const vPeak = useMemo(() => {
    const pCount = typeof portCount === 'number' ? portCount : 0;
    if (pCount > 0 && portedData.Vb > 0) {
      const pDia = portShape === 'round'
        ? (portDiameter || 0)
        : 2 * Math.sqrt(((portWidth || 0) * (portHeight || 0)) / Math.PI);

      if (pDia > 0 && params.sd && params.xmax) {
        return (0.008 * portedData.Fb * params.sd * params.xmax) / (pCount * Math.pow(pDia, 2));
      }
    }
    return null;
  }, [portCount, portDiameter, portShape, portWidth, portHeight, portedData, params]);

  const handlePortCountChange = (valStr: string) => {
    if (valStr === '') {
      setPortCount('');
      return;
    }
    const newCount = Math.max(1, parseInt(valStr) || 1);
    setPortCount(newCount);
    if (portShape === 'round' && suggestions && suggestions.valid && suggestions.dMin) {
      const suggestedDia = suggestions.dMin / Math.sqrt(newCount);
      setPortDiameter(Number(suggestedDia.toFixed(1)));
    }
  };

  const handleApplyPort = (num: number, dia: number) => {
    setPortShape('round');
    setPortCount(num);
    setPortDiameter(dia);
  };

  const displayVal = (val: number | '', type: 'length' | 'length_small' | 'volume') => {
    if (val === '' || val === undefined || val === null) return '';
    const converted = convertTo(val, type, unitSystem);
    return (Math.round(converted * 1000) / 1000).toString();
  };

  const handleInputChange = (valStr: string, setter: (v: number | '') => void, type: 'length' | 'length_small' | 'volume') => {
    if (valStr === '') {
      setter('');
      return;
    }
    let num = parseFloat(valStr) || 0;
    num = convertFrom(num, type, unitSystem);
    setter(num);
  };

  const handleApplySuggestedCabinet = () => {
    let netVol = 0;
    if (boxType === 'sealed' && sealedData.valid) {
      netVol = sealedData.Vb;
    } else if (boxType === 'ported' && portedData.valid) {
      netVol = portedData.Vb;
    } else if (boxType === 'bandpass' && bandpassData.valid) {
      netVol = bandpassData.Vf + bandpassData.Vr;
    }

    if (netVol <= 0) return;

    const thicknessVal = (typeof woodThickness === 'number' ? woodThickness : 0) / 10;
    const extraVal = typeof woodExtra === 'number' ? woodExtra : 0;
    const totalVol = netVol + extraVal;
    const volCm3 = totalVol * 1000;

    if (woodShape === 'rectangular') {
      let r_h = 1.618, r_d = 0.618;
      if (woodRatio === 'classic') { r_h = 1.4; r_d = 0.8; }
      else if (woodRatio === 'cube') { r_h = 1.0; r_d = 1.0; }

      const factor = r_h * r_d;
      const wInt = Math.pow(volCm3 / factor, 1 / 3);
      const hInt = r_h * wInt;
      const dInt = r_d * wInt;

      setWoodExtHeight(Math.round((hInt + 2 * thicknessVal) * 10) / 10);
      setWoodExtWidth(Math.round((wInt + 2 * thicknessVal) * 10) / 10);
      setWoodExtDepth(Math.round((dInt + 2 * thicknessVal) * 10) / 10);
    } else {
      const valH = typeof woodLockVal1 === 'number' ? woodLockVal1 : 40;
      const valW = typeof woodLockVal2 === 'number' ? woodLockVal2 : 45;
      const valD1 = typeof woodLockVal3 === 'number' ? woodLockVal3 : 18;

      const hInt = valH - (2 * thicknessVal);
      const wInt = valW - (2 * thicknessVal);
      const d1Int = Math.max(0, valD1 - (2 * thicknessVal));

      if (hInt > 0 && wInt > 0 && d1Int > 0) {
        const dAvg = volCm3 / (hInt * wInt);
        const d2Int = (2 * dAvg) - d1Int;
        const d2Ext = d2Int + (2 * thicknessVal);

        setWoodTrapExtHeight(valH);
        setWoodTrapExtWidth(valW);
        setWoodTrapExtDepthTop(valD1);
        setWoodTrapExtDepthBot(Math.round(d2Ext * 10) / 10);
      }
    }
  };

  const getEbpRecommendation = () => {
    const ebp = params.qes ? (params.fs / params.qes) : 0;
    if (ebp === 0) return '';
    if (ebp < 50) return t("Sugerencia: Caja Sellada (Sealed).");
    if (ebp > 90) return t("Sugerencia: Caja Ventilada (Ported).");
    return t("Sugerencia: Apta para Sellada o Ventilada.");
  };

  const ebpValue = params.qes ? (params.fs / params.qes) : null;

  return (
    <aside className="panel" style={{ borderLeft: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.25rem' }}>
        <h3 className="panel-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0, fontSize: '12px', fontWeight: 700 }}>{t("Diseño")}</h3>
      </div>

      {/* EBP Status Bar */}
      <div 
        className={`ebp-badge-card ${ebpValue ? (ebpValue < 50 ? 'ebp-sealed' : ebpValue > 90 ? 'ebp-ported' : 'ebp-normal') : 'ebp-normal'}`}
        style={{ padding: '0.3rem 0.65rem', marginBottom: '0.5rem' }}
      >
        <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>EBP: {ebpValue ? ebpValue.toFixed(1) : 'N/A'}</span>
        <span style={{ fontSize: '0.72rem', opacity: 0.85, fontWeight: 500 }}>
          {getEbpRecommendation()}
        </span>
      </div>

      {/* Segmented Control de Tipo de Caja */}
      <div className="segmented-control" style={{ marginBottom: '0.6rem', padding: '2px' }}>
        <button
          type="button"
          className={boxType === 'sealed' ? 'active' : ''}
          onClick={() => setBoxType('sealed')}
          style={{ padding: '0.35rem 0.25rem' }}
        >
          {t("Sellada")}
        </button>
        <button
          type="button"
          className={boxType === 'ported' ? 'active' : ''}
          onClick={() => setBoxType('ported')}
          style={{ padding: '0.35rem 0.25rem' }}
        >
          {t("Ventilada")}
        </button>
        <button
          type="button"
          className={boxType === 'bandpass' ? 'active' : ''}
          onClick={() => setBoxType('bandpass')}
          style={{ padding: '0.35rem 0.25rem' }}
        >
          {t("Paso Banda")}
        </button>
      </div>

      {/* Pestañas de Control Central */}
      <div className="sub-tabs-header" style={{ marginBottom: '0.6rem', padding: '2px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('wood')}
          className={activeTab === 'wood' ? 'active' : ''}
          style={{ padding: '0.3rem 0.2rem' }}
        >
          {t("Medidas")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('damping')}
          className={activeTab === 'damping' ? 'active' : ''}
          style={{ padding: '0.3rem 0.2rem' }}
        >
          {t("Damping")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('crossover')}
          className={activeTab === 'crossover' ? 'active' : ''}
          style={{ padding: '0.3rem 0.2rem' }}
        >
          {t("Divisor (Xover)")}
        </button>
      </div>

      <div className="form-section">
        {/* PESTAÑA A: DIMENSIONES / MEDIDAS DE LA CAJA */}
        {activeTab === 'wood' && (
          <>
            {/* Modo de Medidas (Calcular / Ingresar) */}
            <div className="segmented-control" style={{ marginBottom: '0.5rem', padding: '2px', borderRadius: '10px' }}>
              <button
                type="button"
                className={woodMode === 'calc' ? 'active' : ''}
                onClick={() => setWoodMode('calc')}
                style={{ padding: '0.3rem 0.25rem', fontSize: '0.72rem', borderRadius: '7px' }}
              >
                {t("Calcular (Vb)")}
              </button>
              <button
                type="button"
                className={woodMode === 'input' ? 'active' : ''}
                onClick={() => setWoodMode('input')}
                style={{ padding: '0.3rem 0.25rem', fontSize: '0.72rem', borderRadius: '7px' }}
              >
                {t("Medidas Manuales")}
              </button>
            </div>

            {/* Forma de la caja */}
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label>{t("Forma de caja")}</label>
              <div className="segmented-control" style={{ padding: '2px', borderRadius: '8px' }}>
                <button
                  type="button"
                  className={woodShape === 'rectangular' ? 'active' : ''}
                  onClick={() => setWoodShape('rectangular')}
                  style={{ padding: '0.35rem 0.25rem', fontSize: '0.72rem', borderRadius: '6px' }}
                >
                  {t("Rectangular")}
                </button>
                <button
                  type="button"
                  className={woodShape === 'trapezoidal' ? 'active' : ''}
                  onClick={() => setWoodShape('trapezoidal')}
                  style={{ padding: '0.35rem 0.25rem', fontSize: '0.72rem', borderRadius: '6px' }}
                >
                  {t("Trapezoidal")}
                </button>
              </div>
            </div>

            {/* Si es Modo Calcular: proporciones y bloqueos */}
            {woodMode === 'calc' && (
              <div className="premium-form-card">
                <div className="form-subsection-title" style={{ marginTop: 0, marginBottom: '0.35rem' }}>{t("Configuración de Cálculo")}</div>
                {woodShape === 'rectangular' && (
                  <div className="input-group" style={{ marginBottom: '0.45rem' }}>
                    <label>{t("Bloqueo de Dimensiones")}</label>
                    <select
                      value={woodConstraint}
                      onChange={(e) => setWoodConstraint(e.target.value)}
                      className="input-select"
                      style={{ width: '100%', height: '30px', padding: '0.2rem 2.2rem 0.2rem 0.55rem', fontSize: '0.76rem' }}
                    >
                      <option value="none">{t("Proporciones Libres")}</option>
                      <option value="lock_h_d">{t("Fijar Alto y Profundidad")}</option>
                      <option value="lock_h_w">{t("Fijar Alto y Ancho")}</option>
                      <option value="lock_w_d">{t("Fijar Ancho y Profundidad")}</option>
                    </select>
                  </div>
                )}

                {woodConstraint === 'none' && woodShape === 'rectangular' && (
                  <div className="input-group" style={{ marginBottom: '0.45rem' }}>
                    <label>{t("Proporción Acústica")}</label>
                    <select
                      value={woodRatio}
                      onChange={(e) => setWoodRatio(e.target.value as 'golden' | 'classic' | 'cube')}
                      className="input-select"
                      style={{ width: '100%', height: '30px', padding: '0.2rem 2.2rem 0.2rem 0.55rem', fontSize: '0.76rem' }}
                    >
                      <option value="golden">{t("Aurea (1.618 : 1 : 0.618)")}</option>
                      <option value="classic">{t("Clásica (1.400 : 1 : 0.800)")}</option>
                      <option value="cube">{t("Cubo (1.000 : 1 : 1.000)")}</option>
                    </select>
                  </div>
                )}

                {/* Dimensiones bloqueadas */}
                {(woodConstraint !== 'none' || woodShape === 'trapezoidal') && (
                  <div className="input-grid" style={{ marginTop: '0.25rem' }}>
                    <div className="input-group">
                      <label>{woodShape === 'trapezoidal' ? t("Alto Externo") : t("Alto Fijo")}</label>
                      <div className="input-wrapper">
                        <input
                          type="number"
                          value={displayVal(woodLockVal1, 'length')}
                          onChange={(e) => handleInputChange(e.target.value, setWoodLockVal1, 'length')}
                          step="any"
                        />
                        <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                      </div>
                    </div>
                    <div className="input-group">
                      <label>{woodShape === 'trapezoidal' ? t("Ancho Externo") : t("Ancho Fijo")}</label>
                      <div className="input-wrapper">
                        <input
                          type="number"
                          value={displayVal(woodLockVal2, 'length')}
                          onChange={(e) => handleInputChange(e.target.value, setWoodLockVal2, 'length')}
                          step="any"
                        />
                        <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                      </div>
                    </div>
                    {woodShape === 'trapezoidal' && (
                      <div className="input-group">
                        <label>{t("Prof. Superior (D1)")}</label>
                        <div className="input-wrapper">
                          <input
                            type="number"
                            value={displayVal(woodLockVal3, 'length')}
                            onChange={(e) => handleInputChange(e.target.value, setWoodLockVal3, 'length')}
                            step="any"
                          />
                          <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Si es Modo Ingresar Medidas: inputs manuales */}
            {woodMode === 'input' && (
              <div className="premium-form-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.4rem' }}>
                  <span className="form-subsection-title" style={{ border: 'none', padding: 0, margin: 0 }}>{t("Medidas Manuales")}</span>
                  <button
                    type="button"
                    onClick={handleApplySuggestedCabinet}
                    className="preset-select"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', background: 'var(--primary)', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    {t("Cargar Sugerido")}
                  </button>
                </div>
                {woodShape === 'rectangular' ? (
                  <div className="input-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <div className="input-group">
                      <label>{t("Alto Externo")}</label>
                      <div className="input-wrapper">
                        <input
                          type="number"
                          value={displayVal(woodExtHeight, 'length')}
                          onChange={(e) => handleInputChange(e.target.value, setWoodExtHeight, 'length')}
                          step="any"
                        />
                        <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                      </div>
                    </div>
                    <div className="input-group">
                      <label>{t("Ancho Externo")}</label>
                      <div className="input-wrapper">
                        <input
                          type="number"
                          value={displayVal(woodExtWidth, 'length')}
                          onChange={(e) => handleInputChange(e.target.value, setWoodExtWidth, 'length')}
                          step="any"
                        />
                        <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                      </div>
                    </div>
                    <div className="input-group">
                      <label>{t("Profundidad")}</label>
                      <div className="input-wrapper">
                        <input
                          type="number"
                          value={displayVal(woodExtDepth, 'length')}
                          onChange={(e) => handleInputChange(e.target.value, setWoodExtDepth, 'length')}
                          step="any"
                        />
                        <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="input-grid">
                    <div className="input-group">
                      <label>{t("Alto Externo")}</label>
                      <div className="input-wrapper">
                        <input
                          type="number"
                          value={displayVal(woodTrapExtHeight, 'length')}
                          onChange={(e) => handleInputChange(e.target.value, setWoodTrapExtHeight, 'length')}
                          step="any"
                        />
                        <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                      </div>
                    </div>
                    <div className="input-group">
                      <label>{t("Ancho Externo")}</label>
                      <div className="input-wrapper">
                        <input
                          type="number"
                          value={displayVal(woodTrapExtWidth, 'length')}
                          onChange={(e) => handleInputChange(e.target.value, setWoodTrapExtWidth, 'length')}
                          step="any"
                        />
                        <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                      </div>
                    </div>
                    <div className="input-group">
                      <label>{t("Prof. Sup. (D1)")}</label>
                      <div className="input-wrapper">
                        <input
                          type="number"
                          value={displayVal(woodTrapExtDepthTop, 'length')}
                          onChange={(e) => handleInputChange(e.target.value, setWoodTrapExtDepthTop, 'length')}
                          step="any"
                        />
                        <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                      </div>
                    </div>
                    <div className="input-group">
                      <label>{t("Prof. Inf. (D2)")}</label>
                      <div className="input-wrapper">
                        <input
                          type="number"
                          value={displayVal(woodTrapExtDepthBot, 'length')}
                          onChange={(e) => handleInputChange(e.target.value, setWoodTrapExtDepthBot, 'length')}
                          step="any"
                        />
                        <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Inputs comunes de ebanistería */}
            <div className="premium-form-card" style={{ marginBottom: '0.5rem' }}>
              <div className="form-subsection-title" style={{ marginTop: 0, marginBottom: '0.35rem' }}>{t("Propiedades de la Madera")}</div>
              <div className="input-grid">
                <div className="input-group">
                  <label>{t("Espesor madera")}</label>
                  <div className="input-wrapper">
                    <input
                      type="number"
                      value={displayVal(woodThickness, 'length_small')}
                      onChange={(e) => handleInputChange(e.target.value, setWoodThickness, 'length_small')}
                      step="any"
                      style={{ height: '30px', padding: '0.2rem 2rem 0.2rem 0.55rem', fontSize: '0.78rem' }}
                    />
                    <span className="unit-badge">{getUnitLabel('length_small', unitSystem)}</span>
                  </div>
                </div>
                <div className="input-group">
                  <label>{t("Vol extra")}</label>
                  <div className="input-wrapper">
                    <input
                      type="number"
                      value={displayVal(woodExtra, 'volume')}
                      onChange={(e) => handleInputChange(e.target.value, setWoodExtra, 'volume')}
                      step="any"
                      style={{ height: '30px', padding: '0.2rem 2rem 0.2rem 0.55rem', fontSize: '0.78rem' }}
                    />
                    <span className="unit-badge">{getUnitLabel('volume', unitSystem)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dimensionamiento y alineación acústica del cajón */}
            <div className="premium-form-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <div className="form-subsection-title" style={{ margin: 0 }}>{t("Alineación Acústica (Vb/Fb)")}</div>
                {customPorted && (
                  <button
                    type="button"
                    onClick={() => setCustomPorted(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent)',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0
                    }}
                  >
                    {t("Restablecer Óptima")}
                  </button>
                )}
              </div>
              <div className="input-grid">
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
                <div className="input-group" style={{ marginTop: '0.5rem' }}>
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
              )}

              {boxType === 'bandpass' && (
                <div className="input-grid" style={{ marginTop: '0.5rem' }}>
                  <div className="input-group">
                    <label>{t("Orden del Filtro")}</label>
                    <select
                      value={bandpassOrder}
                      onChange={(e) => setBandpassOrder(parseInt(e.target.value) as 4 | 6)}
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
            </div>

            {boxType === 'ported' && (
              <div className="premium-form-card">
                <div className="form-subsection-title" style={{ marginTop: 0 }}>{t("Configuración del Puerto")}</div>
                <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                  <label>{t("Sintonización mediante")}</label>
                  <div className="segmented-control" style={{ padding: '2px', borderRadius: '8px' }}>
                    <button
                      type="button"
                      className={prTuning === 'port' ? 'active' : ''}
                      onClick={() => setPrTuning('port')}
                      style={{ padding: '0.35rem 0.25rem', fontSize: '0.72rem', borderRadius: '6px' }}
                    >
                      {t("Puerto de Aire")}
                    </button>
                    <button
                      type="button"
                      className={prTuning === 'radiator' ? 'active' : ''}
                      onClick={() => setPrTuning('radiator')}
                      style={{ padding: '0.35rem 0.25rem', fontSize: '0.72rem', borderRadius: '6px' }}
                    >
                      {t("Radiador Pasivo")}
                    </button>
                  </div>
                </div>

                {prTuning === 'port' ? (
                  <>
                    <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                      <label>{t("Forma del Puerto")}</label>
                      <div className="segmented-control" style={{ padding: '2px', borderRadius: '8px' }}>
                        <button
                          type="button"
                          className={portShape === 'round' ? 'active' : ''}
                          onClick={() => setPortShape('round')}
                          style={{ padding: '0.35rem 0.25rem', fontSize: '0.72rem', borderRadius: '6px' }}
                        >
                          {t("Redondo")}
                        </button>
                        <button
                          type="button"
                          className={portShape === 'rectangular' ? 'active' : ''}
                          onClick={() => setPortShape('rectangular')}
                          style={{ padding: '0.35rem 0.25rem', fontSize: '0.72rem', borderRadius: '6px' }}
                        >
                          {t("Rectangular")}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: portShape === 'rectangular' ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: '0.45rem', marginBottom: '0.5rem' }}>
                      <div className="input-group">
                        <label>{t("Cantidad")}</label>
                        <div className="input-wrapper">
                          <input
                            type="number"
                            value={portCount}
                            onChange={(e) => handlePortCountChange(e.target.value)}
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
                            <label>{t("Longitud")}</label>
                            {useCustomPortLength ? (
                              <div className="input-wrapper">
                                <input
                                  type="number"
                                  value={displayVal(customPortLength, 'length')}
                                  onChange={(e) => handleInputChange(e.target.value, setCustomPortLength, 'length')}
                                  step="any"
                                  placeholder="Auto"
                                />
                                <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                              </div>
                            ) : (
                              <div className="input-wrapper">
                                <input type="text" value={portLength} disabled style={{ background: 'rgba(255,255,255,0.03)' }} />
                              </div>
                            )}
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
                            <label>{t("Longitud")}</label>
                            {useCustomPortLength ? (
                              <div className="input-wrapper">
                                <input
                                  type="number"
                                  value={displayVal(customPortLength, 'length')}
                                  onChange={(e) => handleInputChange(e.target.value, setCustomPortLength, 'length')}
                                  step="any"
                                  placeholder="Auto"
                                />
                                <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                              </div>
                            ) : (
                              <div className="input-wrapper">
                                <input type="text" value={portLength} disabled style={{ background: 'rgba(255,255,255,0.03)' }} />
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', marginTop: '0.1rem' }}>
                      <input
                        type="checkbox"
                        id="chk-custom-port-len"
                        checked={useCustomPortLength}
                        onChange={(e) => setUseCustomPortLength(e.target.checked)}
                        style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: 'var(--accent)' }}
                      />
                      <label htmlFor="chk-custom-port-len" style={{ fontSize: '0.74rem', cursor: 'pointer', userSelect: 'none', color: 'var(--text-main)', margin: 0, fontWeight: 500 }}>
                        {t("Fijar longitud de puerto personalizada")}
                      </label>
                    </div>

                    <div className="input-group" style={{ marginBottom: '0.5rem' }}>
                      <label>{t("Extremos Redondeados (Flared)")}</label>
                      <div className="input-wrapper">
                        <select
                          value={flaredEnds}
                          onChange={(e) => setFlaredEnds(parseInt(e.target.value) as 0 | 1 | 2)}
                          style={{
                            width: '100%',
                            height: '34px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            color: 'var(--text-main)',
                            border: '1px solid var(--card-border)',
                            borderRadius: '6px',
                            padding: '0 0.5rem',
                            fontSize: '0.78rem'
                          }}
                        >
                          <option value={0} style={{ background: 'var(--card-bg)' }}>{t("Ninguno (Rectos)")}</option>
                          <option value={1} style={{ background: 'var(--card-bg)' }}>{t("1 Extremo Redondeado")}</option>
                          <option value={2} style={{ background: 'var(--card-bg)' }}>{t("Ambos Extremos Redondeados")}</option>
                        </select>
                      </div>
                    </div>

                    {/* Alerta de Velocidad y Sugerencias de Puerto */}
                    <div style={{ marginTop: '0.6rem', marginBottom: '0.5rem' }} className={vPeak !== null ? (vPeak < 10 ? 'alert-box success' : vPeak <= 17 ? 'alert-box warn' : 'alert-box danger') : 'alert-box info'}>
                      <span dangerouslySetInnerHTML={{ __html: vPeak !== null ? (vPeak < 10 ? `<strong>${t("Velocidad moderada/baja")}:</strong> ${vPeak.toFixed(1)} m/s. ${t("Silencioso.")}` : vPeak <= 17 ? `<strong>${t("Velocidad moderada")}:</strong> ${vPeak.toFixed(1)} m/s. ${t("Recomendado usar extremos redondeados.")}` : `<strong>${t("¡Velocidad crítica!")}:</strong> ${vPeak.toFixed(1)} m/s. ${t("Aumenta el diámetro.")}`) : t("Ingresa Sd y Xmax para calcular la velocidad.") }} />
                    </div>

                    {suggestions && 'options' in suggestions && suggestions.options && suggestions.options.length > 0 && (
                      <div style={{ marginTop: '0.5rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--card-border)', borderRadius: '6px', padding: '0.5rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>{t("SUGERENCIAS DE PUERTOS")}:</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {suggestions.options.map((s: { numPorts: number; diameter: number; length: number }, idx: number) => {
                            const displayOptDia = convertTo(s.diameter, 'length', unitSystem);
                            const displayOptLen = convertTo(s.length, 'length', unitSystem);
                            const unitLabel = getUnitLabel('length', unitSystem);
                            return (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem' }}>
                                <span>{s.numPorts}x Ø {displayOptDia.toFixed(1)} {unitLabel} (L: {displayOptLen.toFixed(1)} {unitLabel})</span>
                                <button
                                  type="button"
                                  onClick={() => handleApplyPort(s.numPorts, s.diameter)}
                                  className="preset-select"
                                  style={{ padding: '0.15rem 0.4rem', fontSize: '0.68rem', cursor: 'pointer' }}
                                >
                                  {t("Aplicar")}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  // Radiador Pasivo
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div className="input-grid">
                      <div className="input-group">
                        <label>{t("Diámetro PR")}</label>
                        <div className="input-wrapper">
                          <input type="number" value={prDia} onChange={(e) => setPrDia(parseFloat(e.target.value) || 0)} step="any" />
                          <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                        </div>
                      </div>
                      <div className="input-group">
                        <label>{t("Vas PR")}</label>
                        <div className="input-wrapper">
                          <input type="number" value={prVas} onChange={(e) => setPrVas(parseFloat(e.target.value) || 0)} step="any" />
                          <span className="unit-badge">L</span>
                        </div>
                      </div>
                    </div>
                    <div className="input-grid">
                      <div className="input-group">
                        <label>{t("Fs PR")}</label>
                        <div className="input-wrapper">
                          <input type="number" value={prFs} onChange={(e) => setPrFs(parseFloat(e.target.value) || 0)} step="any" />
                          <span className="unit-badge">Hz</span>
                        </div>
                      </div>
                      <div className="input-group">
                        <label>{t("Mms PR (g)")}</label>
                        <div className="input-wrapper">
                          <input type="number" value={prMms} onChange={(e) => setPrMms(parseFloat(e.target.value) || 0)} step="any" />
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.74rem', background: 'rgba(255,255,255,0.01)', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--card-border)' }}>
                      <div>{t("Frecuencia Natural (f_p):")} <strong>{prFbNatural.toFixed(1)} Hz</strong></div>
                      <div>{t("Masa añadida aprox. para Fb:")} <strong>{prMasaAnadidaG.toFixed(1)} g</strong></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Distribución en Bafle Frontal (Ubicación de Woofer y Puerto) */}
            <div className="premium-form-card" style={{ marginTop: '0.5rem' }}>
              <div className="form-subsection-title" style={{ marginTop: 0, marginBottom: '0.35rem' }}>{t("Distribución en Bafle Frontal")}</div>
              
              <div className="input-group" style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                  <span>{t("Posición Vertical Woofer")}</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{speakerYPct}%</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="range"
                    min="15"
                    max="85"
                    value={speakerYPct}
                    onChange={(e) => setSpeakerYPct(parseInt(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {boxType === 'ported' && prTuning === 'port' && (
                <>
                  <div className="input-group" style={{ marginBottom: '0.5rem' }}>
                    <label>{t("Ubicación del Puerto")}</label>
                    <select 
                      value={portLocation} 
                      onChange={(e) => setPortLocation(e.target.value as 'front' | 'rear')}
                      className="input-select"
                      style={{ width: '100%', height: '34px' }}
                    >
                      <option value="front">{t("Frente")}</option>
                      <option value="rear">{t("Atrás")}</option>
                    </select>
                  </div>

                  <div className="input-group" style={{ marginBottom: '0.25rem' }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                      <span>{t("Posición Vertical Puerto(s)")}</span>
                      <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{portYPct}%</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="range"
                        min="15"
                        max="85"
                        value={portYPct}
                        onChange={(e) => setPortYPct(parseInt(e.target.value))}
                        style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* PESTAÑA B: RELLENO ACÚSTICO */}
        {activeTab === 'damping' && (
          <div className="premium-form-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              {t("Selecciona la densidad de relleno para la caja:")}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {[
                { id: 'none', label: t("Ninguno (0%) - Vacía") },
                { id: 'light', label: t("Leve (~5%) - Paredes") },
                { id: 'moderate', label: t("Moderado (~12%) - Fibra suelta") },
                { id: 'heavy', label: t("Denso (~20%) - Fibra densa") }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDampingType(opt.id as 'none' | 'light' | 'moderate' | 'heavy')}
                  className={`premium-panel-btn ${dampingType === opt.id ? 'active-primary' : ''}`}
                  style={{
                    padding: '0.65rem 0.85rem',
                    justifyContent: 'flex-start',
                    fontSize: '0.78rem',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PESTAÑA C: CROSSOVER / DIVISORES DE FRECUENCIA */}
        {activeTab === 'crossover' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="premium-form-card">
              <div className="form-subsection-title" style={{ marginTop: 0 }}>{t("Configuración del Divisor")}</div>
              <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                <label>{t("Vías")}</label>
                <div className="segmented-control" style={{ padding: '2px', borderRadius: '8px' }}>
                  <button
                    type="button"
                    className={crossoverWays === 2 ? 'active' : ''}
                    onClick={() => setCrossoverWays(2)}
                    style={{ padding: '0.35rem 0.25rem', fontSize: '0.72rem', borderRadius: '6px' }}
                  >
                    {t("2 Vías")}
                  </button>
                  <button
                    type="button"
                    className={crossoverWays === 3 ? 'active' : ''}
                    onClick={() => setCrossoverWays(3)}
                    style={{ padding: '0.35rem 0.25rem', fontSize: '0.72rem', borderRadius: '6px' }}
                  >
                    {t("3 Vías")}
                  </button>
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                <label>{t("Tipo Filtro")}</label>
                <select
                  value={crossoverType}
                  onChange={(e) => setCrossoverType(e.target.value as '1st_order' | '2nd_butter' | '2nd_lr' | '4th_lr')}
                  className="input-select"
                  style={{ width: '100%', height: '34px' }}
                >
                  <option value="1st_order">{t("1er Orden (6dB)")}</option>
                  <option value="2nd_butter">{t("Butterworth (12dB)")}</option>
                  <option value="2nd_lr">{t("Linkwitz-Riley (12dB)")}</option>
                  <option value="4th_lr">{t("Linkwitz-Riley (24dB)")}</option>
                </select>
              </div>

              {crossoverWays === 2 ? (
                <div className="input-group">
                  <label>{t("Frecuencia Corte (Fc)")} (Hz)</label>
                  <div className="input-wrapper">
                    <input type="number" value={fc} onChange={(e) => setFc(parseFloat(e.target.value) || 2500)} step="50" />
                  </div>
                </div>
              ) : (
                <div className="input-grid">
                  <div className="input-group">
                    <label>{t("Fc Baja (Low)")} (Hz)</label>
                    <div className="input-wrapper">
                      <input type="number" value={fcLow} onChange={(e) => setFcLow(parseFloat(e.target.value) || 500)} step="50" />
                    </div>
                  </div>
                  <div className="input-group">
                    <label>{t("Fc Alta (High)")} (Hz)</label>
                    <div className="input-wrapper">
                      <input type="number" value={fcHigh} onChange={(e) => setFcHigh(parseFloat(e.target.value) || 4000)} step="50" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="premium-form-card">
              <div className="form-subsection-title" style={{ marginTop: 0 }}>{t("Impedancias de Carga")} (Ω)</div>
              <div className="input-grid">
                <div className="input-group">
                  <label>{t("Tweeter")}</label>
                  <div className="input-wrapper">
                    <input type="number" value={zTweeter} onChange={(e) => setZTweeter(parseFloat(e.target.value) || 8)} />
                  </div>
                </div>
                {crossoverWays === 3 && (
                  <div className="input-group">
                    <label>{t("Rango Medio")}</label>
                    <div className="input-wrapper">
                      <input type="number" value={zMidrange} onChange={(e) => setZMidrange(parseFloat(e.target.value) || 8)} />
                    </div>
                  </div>
                )}
                <div className="input-group">
                  <label>{t("Woofer")}</label>
                  <div className="input-wrapper">
                    <input type="number" value={zWoofer} onChange={(e) => setZWoofer(parseFloat(e.target.value) || 8)} />
                  </div>
                </div>
              </div>
            </div>

            {crossoverWays === 3 && (
              <div className="premium-form-card">
                <div className="form-subsection-title" style={{ marginTop: 0 }}>{t("Parámetros del Rango Medio")}</div>
                <div className="input-grid">
                  <div className="input-group">
                    <label>Fs ({t("Medios")}) (Hz)</label>
                    <div className="input-wrapper">
                      <input type="number" value={midFs} onChange={(e) => setMidFs(parseFloat(e.target.value) || 120)} />
                    </div>
                  </div>
                  <div className="input-group">
                    <label>Vas ({t("Medios")}) (L)</label>
                    <div className="input-wrapper">
                      <input type="number" value={midVas} onChange={(e) => setMidVas(parseFloat(e.target.value) || 5)} />
                    </div>
                  </div>
                  <div className="input-group">
                    <label>Qts ({t("Medios")})</label>
                    <div className="input-wrapper">
                      <input type="number" value={midQts} onChange={(e) => setMidQts(parseFloat(e.target.value) || 0.45)} step="0.01" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Red Zobel y L-Pad agrupadas en una tarjeta */}
            <div className="premium-form-card">
              <div className="form-subsection-title" style={{ marginTop: 0 }}>{t("Redes de Compensación")}</div>
              
              {/* Red Zobel */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <input
                    type="checkbox"
                    id="chk-zobel"
                    checked={enableZobel}
                    onChange={(e) => setEnableZobel(e.target.checked)}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <label htmlFor="chk-zobel" style={{ fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>
                    {t("Implementar Red Zobel")}
                  </label>
                </div>
                {enableZobel && (
                  <div className="input-grid">
                    <div className="input-group">
                      <label>Re (Ω)</label>
                      <div className="input-wrapper">
                        <input type="number" value={zobelRe} onChange={(e) => setZobelRe(parseFloat(e.target.value) || 6)} />
                      </div>
                    </div>
                    <div className="input-group">
                      <label>Le (mH)</label>
                      <div className="input-wrapper">
                        <input type="number" value={zobelLe} onChange={(e) => setZobelLe(parseFloat(e.target.value) || 0.5)} step="0.05" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* L-Pad */}
              <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <input
                    type="checkbox"
                    id="chk-lpad"
                    checked={enableLPad}
                    onChange={(e) => setEnableLPad(e.target.checked)}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <label htmlFor="chk-lpad" style={{ fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>
                    {t("Implementar Atenuador L-Pad")}
                  </label>
                </div>
                {enableLPad && (
                  <div className="input-grid">
                    <div className="input-group">
                      <label>{t("Atenuación (dB)")}</label>
                      <div className="input-wrapper">
                        <input type="number" value={lpadAttenuation} onChange={(e) => setLpadAttenuation(parseFloat(e.target.value) || 3)} step="0.5" />
                      </div>
                    </div>
                    <div className="input-group">
                      <label>{t("Impedancia Carga")}</label>
                      <div className="input-wrapper">
                        <input type="number" value={lpadZLoad} onChange={(e) => setLpadZLoad(parseFloat(e.target.value) || 8)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
