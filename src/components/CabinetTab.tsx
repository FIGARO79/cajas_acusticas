import React, { useEffect, useState } from 'react';
import { type Lang, translate } from '../utils/translations';
import type { CalculatedSealed, CalculatedPorted, SpeakerParams, WoodCabinetData, WoodCutPiece } from '../types';

interface CabinetTabProps {
  lang: Lang;
  params: SpeakerParams;
  sealedData: CalculatedSealed;
  portedData: CalculatedPorted;
  woodMode: 'calc' | 'input';
  setWoodMode: (mode: 'calc' | 'input') => void;
  woodShape: 'rectangular' | 'trapezoidal';
  setWoodShape: (shape: 'rectangular' | 'trapezoidal') => void;
  woodConstraint: string;
  setWoodConstraint: (constraint: string) => void;
  woodSource: 'sealed' | 'ported';
  setWoodSource: (source: 'sealed' | 'ported') => void;
  woodRatio: 'golden' | 'classic' | 'cube';
  setWoodRatio: (ratio: 'golden' | 'classic' | 'cube') => void;
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
  // Espesor y volumen extra
  woodThickness: number | '';
  setWoodThickness: (v: number | '') => void;
  woodExtra: number | '';
  setWoodExtra: (v: number | '') => void;
  // Port specs
  portCount: number;
  portDiameter: number | '';
  dampingFactor: number;
}

export const CabinetTab: React.FC<CabinetTabProps> = ({
  lang,
  params,
  sealedData,
  portedData,
  woodMode,
  setWoodMode,
  woodShape,
  setWoodShape,
  woodConstraint,
  setWoodConstraint,
  woodSource,
  setWoodSource,
  woodRatio,
  setWoodRatio,
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
  woodThickness,
  setWoodThickness,
  woodExtra,
  setWoodExtra,
  portCount,
  portDiameter,
  dampingFactor
}) => {
  const t = (text: string) => translate(text, lang);
  const [cabinetData, setCabinetData] = useState<WoodCabinetData | null>(null);

  // Perform cabinet calculations
  useEffect(() => {
    const thickness = (typeof woodThickness === 'number' ? woodThickness : 0) / 10; // mm to cm
    let hInt = 0, wInt = 0, dInt = 0;
    let hExt = 0, wExt = 0, dExt = 0;
    let dTrapTopInt = 0, dTrapBotInt = 0;
    let dTrapTopExt = 0, dTrapBotExt = 0;
    let netVol = 0;
    let totalVol = 0;
    let valid = false;

    const extraVal = typeof woodExtra === 'number' ? woodExtra : 0;

    if (woodMode === 'calc') {
      // Source volume (ajustado por damping para obtener el volumen físico que se construirá)
      let reqNetVol = 0;
      if (woodSource === 'sealed' && sealedData.valid) {
        reqNetVol = sealedData.Vb;
      } else if (woodSource === 'ported' && portedData.valid) {
        reqNetVol = portedData.Vb;
      }
      netVol = reqNetVol / dampingFactor;

      if (netVol > 0) {
        totalVol = netVol + extraVal;
        const volCm3 = totalVol * 1000;

        if (woodShape === 'rectangular') {
          if (woodConstraint === 'none') {
            let r_h = 1.618, r_d = 0.618;
            if (woodRatio === 'classic') { r_h = 1.4; r_d = 0.8; }
            else if (woodRatio === 'cube') { r_h = 1.0; r_d = 1.0; }

            const factor = r_h * r_d;
            wInt = Math.pow(volCm3 / factor, 1 / 3);
            hInt = r_h * wInt;
            dInt = r_d * wInt;

            hExt = hInt + (2 * thickness);
            wExt = wInt + (2 * thickness);
            dExt = dInt + (2 * thickness);
            valid = true;
          } else {
            const val1 = typeof woodLockVal1 === 'number' ? woodLockVal1 : 0;
            const val2 = typeof woodLockVal2 === 'number' ? woodLockVal2 : 0;

            if (val1 > 0 && val2 > 0) {
              if (woodConstraint === 'lock_h_d') {
                hExt = val1; dExt = val2;
                hInt = hExt - (2 * thickness);
                dInt = dExt - (2 * thickness);
                wInt = volCm3 / (hInt * dInt);
                wExt = wInt + (2 * thickness);
              } else if (woodConstraint === 'lock_h_w') {
                hExt = val1; wExt = val2;
                hInt = hExt - (2 * thickness);
                wInt = wExt - (2 * thickness);
                dInt = volCm3 / (hInt * wInt);
                dExt = dInt + (2 * thickness);
              } else if (woodConstraint === 'lock_w_d') {
                wExt = val1; dExt = val2;
                wInt = wExt - (2 * thickness);
                dInt = dExt - (2 * thickness);
                hInt = volCm3 / (wInt * dInt);
                hExt = hInt + (2 * thickness);
              }
              if (hInt > 0 && wInt > 0 && dInt > 0) {
                valid = true;
              }
            }
          }
        } else {
          // Trapezoidal Auto
          const valH = typeof woodLockVal1 === 'number' ? woodLockVal1 : 0;
          const valW = typeof woodLockVal2 === 'number' ? woodLockVal2 : 0;
          const valD1 = typeof woodLockVal3 === 'number' ? woodLockVal3 : 0;

          if (valH > 0 && valW > 0 && valD1 > 0) {
            hExt = valH;
            wExt = valW;
            dTrapTopExt = valD1;

            hInt = hExt - (2 * thickness);
            wInt = wExt - (2 * thickness);
            dTrapTopInt = Math.max(0, dTrapTopExt - (2 * thickness));

            if (hInt > 0 && wInt > 0 && dTrapTopInt > 0) {
              const dAvg = volCm3 / (hInt * wInt);
              dTrapBotInt = (2 * dAvg) - dTrapTopInt;
              dTrapBotExt = dTrapBotInt + (2 * thickness);

              if (dTrapBotInt > 0) {
                valid = true;
              }
            }
          }
        }
      }
    } else {
      // Manual input mode
      if (woodShape === 'rectangular') {
        hExt = typeof woodExtHeight === 'number' ? woodExtHeight : 0;
        wExt = typeof woodExtWidth === 'number' ? woodExtWidth : 0;
        dExt = typeof woodExtDepth === 'number' ? woodExtDepth : 0;

        if (hExt > 0 && wExt > 0 && dExt > 0) {
          hInt = hExt - (2 * thickness);
          wInt = wExt - (2 * thickness);
          dInt = dExt - (2 * thickness);

          if (hInt > 0 && wInt > 0 && dInt > 0) {
            const vBruto = (hInt * wInt * dInt) / 1000;
            totalVol = vBruto;
            netVol = Math.max(0, vBruto - extraVal);
            valid = true;
          }
        }
      } else {
        // Trapezoidal manual
        hExt = typeof woodTrapExtHeight === 'number' ? woodTrapExtHeight : 0;
        wExt = typeof woodTrapExtWidth === 'number' ? woodTrapExtWidth : 0;
        dTrapTopExt = typeof woodTrapExtDepthTop === 'number' ? woodTrapExtDepthTop : 0;
        dTrapBotExt = typeof woodTrapExtDepthBot === 'number' ? woodTrapExtDepthBot : 0;

        if (hExt > 0 && wExt > 0 && dTrapTopExt > 0 && dTrapBotExt > 0) {
          hInt = hExt - (2 * thickness);
          wInt = wExt - (2 * thickness);
          dTrapTopInt = Math.max(0, dTrapTopExt - (2 * thickness));
          dTrapBotInt = Math.max(0, dTrapBotExt - (2 * thickness));

          if (hInt > 0 && wInt > 0 && dTrapTopInt > 0 && dTrapBotInt > 0) {
            const dAvgInt = (dTrapTopInt + dTrapBotInt) / 2;
            const vBruto = (hInt * wInt * dAvgInt) / 1000;
            totalVol = vBruto;
            netVol = Math.max(0, vBruto - extraVal);
            valid = true;
          }
        }
      }
    }

    if (valid) {
      const pieces: WoodCutPiece[] = [];
      if (woodShape === 'rectangular') {
        pieces.push({
          name: t("Caras Laterales (Izquierda y Derecha)"),
          qty: 2,
          dimensions: `${hExt.toFixed(1)} x ${dExt.toFixed(1)} cm`
        });
        pieces.push({
          name: t("Tapas (Superior e Inferior)"),
          qty: 2,
          dimensions: `${wInt.toFixed(1)} x ${dExt.toFixed(1)} cm`
        });
        pieces.push({
          name: t("Caras (Frontal y Trasera)"),
          qty: 2,
          dimensions: `${hInt.toFixed(1)} x ${wInt.toFixed(1)} cm`
        });
      } else {
        const hSlant = Math.sqrt(Math.pow(hInt, 2) + Math.pow(Math.abs(dTrapBotInt - dTrapTopInt), 2));
        pieces.push({
          name: t("Caras Laterales (Trapecios Inclinados)"),
          qty: 2,
          dimensions: `${t("Alto")}: ${hExt.toFixed(1)} cm | ${t("Sup")}: ${dTrapTopExt.toFixed(1)} / ${t("Inf")}: ${dTrapBotExt.toFixed(1)} cm`
        });
        pieces.push({
          name: t("Tapa Superior"),
          qty: 1,
          dimensions: `${wInt.toFixed(1)} x ${dTrapTopExt.toFixed(1)} cm`
        });
        pieces.push({
          name: t("Tapa Inferior"),
          qty: 1,
          dimensions: `${wInt.toFixed(1)} x ${dTrapBotExt.toFixed(1)} cm`
        });
        pieces.push({
          name: t("Cara Trasera (Recta)"),
          qty: 1,
          dimensions: `${hInt.toFixed(1)} x ${wInt.toFixed(1)} cm`
        });
        pieces.push({
          name: t("Cara Frontal (Inclinada - Bafle)"),
          qty: 1,
          dimensions: `${hSlant.toFixed(1)} (${t("inclinado")}) x ${wInt.toFixed(1)} cm`
        });
      }

      setCabinetData({
        valid: true,
        vNeto: netVol,
        vTotal: totalVol,
        vExtra: woodExtra || 0,
        hInt, wInt, dInt,
        dTrapTopInt, dTrapBotInt,
        hExt, wExt, dExt,
        dTrapTopExt, dTrapBotExt,
        thickness: woodThickness || 0,
        pieces
      });
    } else {
      setCabinetData(null);
    }
  }, [
    lang, params, sealedData, portedData, woodMode, woodShape, woodConstraint, woodSource, woodRatio,
    woodLockVal1, woodLockVal2, woodLockVal3, woodExtHeight, woodExtWidth, woodExtDepth,
    woodTrapExtHeight, woodTrapExtWidth, woodTrapExtDepthTop, woodTrapExtDepthBot, woodThickness, woodExtra
  ]);

  // Port tuning details for woodworking tab
  const [portInfo, setPortInfo] = useState<{ qtySize: string, length: string, velocity: string } | null>(null);

  useEffect(() => {
    const pDia = portDiameter || 0;
    if (woodSource === 'ported' && portedData.valid && portCount > 0 && pDia > 0 && cabinetData?.valid) {
      const rPort = pDia / 2;
      const Lv = ((23562.5 * Math.pow(pDia, 2) * portCount) / (portedData.Fb * portedData.Fb * cabinetData.vNeto)) - (1.46 * rPort);
      
      const qtySize = `${portCount}x ${t("Puerto(s) de")} ${pDia.toFixed(1)} cm (${t("Diámetro")})`;
      let length = 'N/A';
      if (Lv <= 0) {
        length = t("Excesivamente corto");
      } else if (Lv > 120) {
        length = `${Lv.toFixed(1)} cm (${t("Excede profundidad")})`;
      } else {
        length = `${Lv.toFixed(1)} cm`;
      }

      let velocity = 'N/A';
      if (params.sd && params.xmax) {
        const vPeak = (0.008 * portedData.Fb * params.sd * params.xmax) / (portCount * Math.pow(pDia, 2));
        let color = "var(--success)";
        let label = "Baja (Silencioso)";
        if (vPeak >= 10.0 && vPeak <= 17.0) {
          color = "var(--warning)";
          label = "Moderada (Ok con bordes redondeados)";
        } else if (vPeak > 17.0) {
          color = "var(--danger)";
          label = "Crítica (Genera soplidos/turbulencia)";
        }
        velocity = `<span style="color:${color}; font-weight:500;">${vPeak.toFixed(1)} m/s - ${t(label)}</span>`;
      } else {
        velocity = t("Sd y Xmax requeridos");
      }

      setPortInfo({ qtySize, length, velocity });
    } else {
      setPortInfo(null);
    }
  }, [woodSource, portedData, portCount, portDiameter, cabinetData, params, lang]);

  const handleApplySuggestedCabinet = () => {
    let netVol = 0;
    if (woodSource === 'sealed' && sealedData.valid) {
      netVol = sealedData.Vb;
    } else if (woodSource === 'ported' && portedData.valid) {
      netVol = portedData.Vb;
    }

    if (netVol <= 0) return;

    const thickness = (typeof woodThickness === 'number' ? woodThickness : 0) / 10;
    const extraVal = typeof woodExtra === 'number' ? woodExtra : 0;
    const totalVol = (netVol / dampingFactor) + extraVal;
    const volCm3 = totalVol * 1000;

    if (woodShape === 'rectangular') {
      let r_h = 1.618, r_d = 0.618;
      if (woodRatio === 'classic') { r_h = 1.4; r_d = 0.8; }
      else if (woodRatio === 'cube') { r_h = 1.0; r_d = 1.0; }

      const factor = r_h * r_d;
      const wInt = Math.pow(volCm3 / factor, 1 / 3);
      const hInt = r_h * wInt;
      const dInt = r_d * wInt;

      setWoodExtHeight(Math.round((hInt + 2 * thickness) * 10) / 10);
      setWoodExtWidth(Math.round((wInt + 2 * thickness) * 10) / 10);
      setWoodExtDepth(Math.round((dInt + 2 * thickness) * 10) / 10);
    } else {
      const valH = typeof woodLockVal1 === 'number' ? woodLockVal1 : 40;
      const valW = typeof woodLockVal2 === 'number' ? woodLockVal2 : 45;
      const valD1 = typeof woodLockVal3 === 'number' ? woodLockVal3 : 18;

      const hInt = valH - (2 * thickness);
      const wInt = valW - (2 * thickness);
      const d1Int = Math.max(0, valD1 - (2 * thickness));

      if (hInt > 0 && wInt > 0 && d1Int > 0) {
        const dAvg = volCm3 / (hInt * wInt);
        const d2Int = (2 * dAvg) - d1Int;
        const d2Ext = d2Int + (2 * thickness);

        setWoodTrapExtHeight(valH);
        setWoodTrapExtWidth(valW);
        setWoodTrapExtDepthTop(valD1);
        setWoodTrapExtDepthBot(Math.round(d2Ext * 10) / 10);
      }
    }
  };

  return (
    <div className="tab-content active" id="tab-wood">
      <div className="wood-layout">
        
        {/* Selector del modo de ebanistería */}
        <div className="wood-mode-selector-container">
          <button 
            className={woodMode === 'calc' ? 'active' : ''} 
            onClick={() => setWoodMode('calc')}
            type="button"
          >
            {t("Calcular Medidas desde Vb")}
          </button>
          <button 
            className={woodMode === 'input' ? 'active' : ''} 
            onClick={() => setWoodMode('input')}
            type="button"
          >
            {t("Ingresar Medidas Físicas")}
          </button>
        </div>

        {/* Selector de Forma de Caja */}
        <div className="wood-grid-controls">
          <div className="input-group">
            <label>{t("Forma de la Caja")}</label>
            <select 
              value={woodShape} 
              onChange={(e) => setWoodShape(e.target.value as any)} 
              className="input-select"
              style={{ width: '100%', height: '38px' }}
            >
              <option value="rectangular">{t("Prisma Rectangular (Estándar)")}</option>
              <option value="trapezoidal">{t("Trapezoidal (Cuña para Coche)")}</option>
            </select>
          </div>

          {woodMode === 'calc' && (
            <div className="input-group">
              <label>{t("Bloqueo de Dimensiones (Fijar)")}</label>
              <select 
                value={woodConstraint} 
                onChange={(e) => setWoodConstraint(e.target.value)} 
                className="input-select"
                style={{ width: '100%', height: '38px' }}
              >
                <option value="none">{t("Proporciones Libres (Ratios)")}</option>
                {woodShape === 'rectangular' && (
                  <>
                    <option value="lock_h_d">{t("Fijar Alto y Profundidad (Calcular Ancho)")}</option>
                    <option value="lock_h_w">{t("Fijar Alto y Ancho (Calcular Profundidad)")}</option>
                    <option value="lock_w_d">{t("Fijar Ancho y Profundidad (Calcular Alto)")}</option>
                  </>
                )}
              </select>
            </div>
          )}
        </div>

        {/* MODO A: Calcular Medidas desde Vb (Auto) */}
        {woodMode === 'calc' && (
          <div className="wood-layout">
            <div className="wood-grid-controls">
              <div className="input-group">
                <label>{t("Fuente del Volumen")}</label>
                <select 
                  value={woodSource} 
                  onChange={(e) => setWoodSource(e.target.value as any)} 
                  className="input-select"
                  style={{ width: '100%', height: '38px' }}
                >
                  <option value="sealed">{t("Caja Sellada (Vb)")}</option>
                  <option value="ported">{t("Caja Ventilada (Vb)")}</option>
                </select>
              </div>
              {woodConstraint === 'none' && woodShape === 'rectangular' && (
                <div className="input-group">
                  <label>{t("Proporción Acústica")}</label>
                  <select 
                    value={woodRatio} 
                    onChange={(e) => setWoodRatio(e.target.value as any)} 
                    className="input-select"
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="golden">{t("Aurea (1.618 : 1 : 0.618)")}</option>
                    <option value="classic">{t("Clásica (1.400 : 1 : 0.800)")}</option>
                    <option value="cube">{t("Cubo (1.000 : 1 : 1.000)")}</option>
                  </select>
                </div>
              )}
            </div>

            {/* Inputs dinámicos para dimensiones bloqueadas */}
            {(woodConstraint !== 'none' || woodShape === 'trapezoidal') && (
              <div className="wood-grid-controls">
                <div className="input-group">
                  <label>{woodShape === 'trapezoidal' ? t("Alto Externo") : t("Dimensión 1")}</label>
                  <div className="input-wrapper">
                    <input 
                      type="number" 
                      value={woodLockVal1 || ''} 
                      onChange={(e) => setWoodLockVal1(parseFloat(e.target.value) || 0)} 
                      step="any" 
                    />
                    <span className="unit-badge">cm</span>
                  </div>
                </div>
                <div className="input-group">
                  <label>{woodShape === 'trapezoidal' ? t("Ancho Externo") : t("Dimensión 2")}</label>
                  <div className="input-wrapper">
                    <input 
                      type="number" 
                      value={woodLockVal2 || ''} 
                      onChange={(e) => setWoodLockVal2(parseFloat(e.target.value) || 0)} 
                      step="any" 
                    />
                    <span className="unit-badge">cm</span>
                  </div>
                </div>
                {woodShape === 'trapezoidal' && (
                  <div className="input-group">
                    <label>{t("Profundidad Superior Fija (D1)")}</label>
                    <div className="input-wrapper">
                      <input 
                        type="number" 
                        value={woodLockVal3 || ''} 
                        onChange={(e) => setWoodLockVal3(parseFloat(e.target.value) || 0)} 
                        step="any" 
                      />
                      <span className="unit-badge">cm</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* MODO B: Ingresar Medidas Físicas de la Caja (Manual) */}
        {woodMode === 'input' && (
          <div className="wood-layout">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.25rem' }}>
              <button
                onClick={handleApplySuggestedCabinet}
                className="preset-select"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--primary)', border: '1px solid var(--primary)', color: '#ffffff', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                type="button"
                disabled={!(woodSource === 'sealed' ? sealedData.valid : portedData.valid)}
              >
                {t("Cargar Cajón Sugerido")}
              </button>
            </div>
            {woodShape === 'rectangular' ? (
              <div className="wood-grid-controls">
                <div className="input-group">
                  <label>{t("Alto Externo")}</label>
                  <div className="input-wrapper">
                    <input 
                      type="number" 
                      value={woodExtHeight} 
                      onChange={(e) => setWoodExtHeight(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))} 
                      step="any" 
                    />
                    <span className="unit-badge">cm</span>
                  </div>
                </div>
                <div className="input-group">
                  <label>{t("Ancho Externo")}</label>
                  <div className="input-wrapper">
                    <input 
                      type="number" 
                      value={woodExtWidth} 
                      onChange={(e) => setWoodExtWidth(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))} 
                      step="any" 
                    />
                    <span className="unit-badge">cm</span>
                  </div>
                </div>
                <div className="input-group">
                  <label>{t("Profundidad Externa")}</label>
                  <div className="input-wrapper">
                    <input 
                      type="number" 
                      value={woodExtDepth} 
                      onChange={(e) => setWoodExtDepth(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))} 
                      step="any" 
                    />
                    <span className="unit-badge">cm</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="wood-grid-controls">
                <div className="input-group">
                  <label>{t("Alto Externo")}</label>
                  <div className="input-wrapper">
                    <input 
                      type="number" 
                      value={woodTrapExtHeight} 
                      onChange={(e) => setWoodTrapExtHeight(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))} 
                      step="any" 
                    />
                    <span className="unit-badge">cm</span>
                  </div>
                </div>
                <div className="input-group">
                  <label>{t("Ancho Externo")}</label>
                  <div className="input-wrapper">
                    <input 
                      type="number" 
                      value={woodTrapExtWidth} 
                      onChange={(e) => setWoodTrapExtWidth(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))} 
                      step="any" 
                    />
                    <span className="unit-badge">cm</span>
                  </div>
                </div>
                <div className="input-group">
                  <label>{t("Prof. Superior Externa (D1)")}</label>
                  <div className="input-wrapper">
                    <input 
                      type="number" 
                      value={woodTrapExtDepthTop} 
                      onChange={(e) => setWoodTrapExtDepthTop(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))} 
                      step="any" 
                    />
                    <span className="unit-badge">cm</span>
                  </div>
                </div>
                <div className="input-group">
                  <label>{t("Prof. Inferior Externa (D2)")}</label>
                  <div className="input-wrapper">
                    <input 
                      type="number" 
                      value={woodTrapExtDepthBot} 
                      onChange={(e) => setWoodTrapExtDepthBot(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))} 
                      step="any" 
                    />
                    <span className="unit-badge">cm</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Parámetros Comunes de Ebanistería */}
        <div className="wood-grid-controls" style={{ borderTop: '1px solid var(--card-border)', paddingTop: '1rem', marginTop: '0.25rem' }}>
          <div className="input-group">
            <label>{t("Espesor de Madera")}</label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={woodThickness} 
                onChange={(e) => setWoodThickness(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))} 
                step="any" 
              />
              <span className="unit-badge">mm</span>
            </div>
          </div>
          <div className="input-group">
            <label>{t("Vol. Extra")} <span className="label-desc">({t("(Altavoz/Ducto/Ref.)")})</span></label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={woodExtra} 
                onChange={(e) => setWoodExtra(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))} 
                step="any" 
              />
              <span className="unit-badge">L</span>
            </div>
          </div>
        </div>

        {/* Resultados de Ebanistería */}
        <div className="results-summary">
          <div className="result-tile">
            <span className="result-tile-label">
              {woodMode === 'calc' ? t("Volumen Total Requerido") : t("Volumen Neto Resultante")}
            </span>
            <span className="result-tile-value">
              {cabinetData?.valid ? `${woodMode === 'calc' ? cabinetData.vTotal.toFixed(1) : cabinetData.vNeto.toFixed(1)} L` : 'N/A'}
            </span>
            <span className="result-tile-sub">
              {woodMode === 'calc' ? t("Includes net + extra volume") : t("Volumen acústico neto (libre)")}
            </span>
          </div>
          <div className="result-tile">
            <span className="result-tile-label">{t("Dimensiones Internas")}</span>
            <span className="result-tile-value" style={{ fontSize: '0.95rem', fontWeight: 500, marginTop: '0.4rem' }}>
              {cabinetData?.valid ? (
                woodShape === 'rectangular' 
                  ? `${cabinetData.hInt.toFixed(1)} x ${cabinetData.wInt.toFixed(1)} x ${cabinetData.dInt.toFixed(1)} cm`
                  : `${cabinetData.hInt.toFixed(1)} x ${cabinetData.wInt.toFixed(1)} x d(sup:${cabinetData.dTrapTopInt?.toFixed(1)}/inf:${cabinetData.dTrapBotInt?.toFixed(1)}) cm`
              ) : 'N/A'}
            </span>
            <span className="result-tile-sub">{t("Alto x Ancho x Profundidad")}</span>
          </div>
          <div className="result-tile">
            <span className="result-tile-label">{t("Dimensiones Externas")}</span>
            <span className="result-tile-value" style={{ fontSize: '0.95rem', fontWeight: 500, marginTop: '0.4rem' }}>
              {cabinetData?.valid ? (
                woodShape === 'rectangular'
                  ? `${cabinetData.hExt.toFixed(1)} x ${cabinetData.wExt.toFixed(1)} x ${cabinetData.dExt.toFixed(1)} cm`
                  : `${cabinetData.hExt.toFixed(1)} x ${cabinetData.wExt.toFixed(1)} x d(sup:${cabinetData.dTrapTopExt?.toFixed(1)}/inf:${cabinetData.dTrapBotExt?.toFixed(1)}) cm`
              ) : 'N/A'}
            </span>
            <span className="result-tile-sub">{t("Alto x Ancho x Profundidad")}</span>
          </div>
        </div>

        {/* Puerto de sintonía en ebanistería */}
        {portInfo && (
          <div className="pro-calc-panel" style={{ marginTop: '0.5rem', borderColor: 'var(--ported-color)', background: 'rgba(72, 169, 124, 0.04)' }}>
            <span className="pro-calc-title" style={{ color: 'var(--ported-color)' }}>{t("Puerto(s) de Sintonía para este Diseño")}</span>
            <div className="pro-calc-row">
              <span className="pro-calc-label">{t("Cantidad e Instalación:")}</span>
              <span className="pro-calc-value">{portInfo.qtySize}</span>
            </div>
            <div className="pro-calc-row">
              <span className="pro-calc-label">{t("Longitud Requerida (cada uno):")}</span>
              <span className="pro-calc-value">{portInfo.length}</span>
            </div>
            <div className="pro-calc-row">
              <span className="pro-calc-label">{t("Velocidad del Aire / Ruido:")}</span>
              <span className="pro-calc-value" dangerouslySetInnerHTML={{ __html: portInfo.velocity }}></span>
            </div>
            <div className="pro-calc-row" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {t("* Consejo: Dejar al menos una distancia libre equivalente a un diámetro de puerto entre el extremo interno del tubo y la pared del fondo.")}
            </div>
          </div>
        )}

        {/* Lista de corte */}
        <div>
          <span className="control-title" style={{ marginBottom: '0.5rem' }}>
            {t("Lista de Corte Sugerida (Grosor:")} {cabinetData?.valid ? cabinetData.thickness : woodThickness}mm)
          </span>
          <table className="wood-table">
            <thead>
              <tr>
                <th>{t("Pieza")}</th>
                <th>{t("Cant.")}</th>
                <th>{t("Dimensión de Corte")}</th>
              </tr>
            </thead>
            <tbody>
              {cabinetData?.valid ? (
                cabinetData.pieces.map((piece, idx) => (
                  <tr key={idx}>
                    <td><strong>{piece.name}</strong></td>
                    <td>{piece.qty}</td>
                    <td style={{ fontWeight: 500 }}>{piece.dimensions}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t("Sin datos para calcular.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="wood-note">
          * <strong>{t("Método de ensamble:")}</strong>{' '}
          {woodShape === 'rectangular' 
            ? t("Las piezas laterales encierran el fondo y el frente, y las tapas superior e inferior cierran la estructura. Recuerda sellar todas las juntas con pegamento y silicona.")
            : t("Los laterales son trapecios que determinan la inclinación frontal. Las tapas superior e inferior cierran las uniones y el frente inclinado ($H_{slant}$) requiere cortes angulados.")
          }
        </p>
      </div>

      <footer className="info-footer">
        <h4>{t("Notas de Fabricación y Simulación:")}</h4>
        <ul>
          <li>{t("El volumen calculado ($Vb$) representa el espacio neto. Debe sumarse el volumen de la madera del puerto, la estructura del altavoz y los refuerzos.")}</li>
          <li>{t("El material acústico absorbente (fibra de poliéster, lana de roca) incrementa virtualmente el volumen de la caja entre un 10% y un 20%.")}</li>
          <li>{t("Las dimensiones de ebanistería áureas distribuyen las resonancias internas de manera óptima para atenuar ondas estacionarias destructivas.")}</li>
        </ul>
      </footer>
    </div>
  );
};
