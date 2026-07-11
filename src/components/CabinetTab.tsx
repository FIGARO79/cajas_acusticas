import React, { useEffect, useState, useMemo } from 'react';
import { type Lang, translate } from '../utils/translations';
import type { CalculatedSealed, CalculatedPorted, CalculatedBandpass, SpeakerParams, WoodCabinetData, WoodCutPiece } from '../types';
import { type UnitSystem, convertTo, convertFrom, getUnitLabel } from '../utils/units';
import { CabinetDiagram } from './CabinetDiagram';

interface CabinetTabProps {
  lang: Lang;
  unitSystem: UnitSystem;
  params: SpeakerParams;
  sealedData: CalculatedSealed;
  portedData: CalculatedPorted;
  bandpassData: CalculatedBandpass;
  woodMode: 'calc' | 'input';
  setWoodMode: (mode: 'calc' | 'input') => void;
  woodShape: 'rectangular' | 'trapezoidal';
  setWoodShape: (shape: 'rectangular' | 'trapezoidal') => void;
  woodConstraint: string;
  setWoodConstraint: (constraint: string) => void;
  woodSource: 'sealed' | 'ported' | 'bandpass';
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
  portCount: number | '';
  portDiameter: number | '';
  portShape: 'round' | 'rectangular' | 'custom';
  portWidth: number | '';
  portHeight: number | '';
  portArea: number | '';
  dampingFactor: number;
  flaredEnds?: 0 | 1 | 2;
  onCabinetDataChange?: (data: WoodCabinetData | null) => void;
  readOnly?: boolean;
  speakerYPct?: number;
  portYPct?: number;
}

export const CabinetTab: React.FC<CabinetTabProps> = ({
  lang,
  unitSystem,
  params,
  sealedData,
  portedData,
  bandpassData,
  woodMode,
  setWoodMode,
  woodShape,
  setWoodShape,
  woodConstraint,
  setWoodConstraint,
  woodSource,
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
  portShape,
  portWidth,
  portHeight,
  portArea,
  dampingFactor,
  flaredEnds = 0,
  onCabinetDataChange,
  readOnly = false,
  speakerYPct = 50,
  portYPct = 85,
}) => {
  const t = React.useCallback((text: string) => translate(text, lang), [lang]);
  const [hoveredPieceIndex, setHoveredPieceIndex] = useState<number | null>(null);



  // Helper to read values converted to UI unit system
  const displayVal = React.useCallback((val: number | '', type: 'length' | 'length_small' | 'volume') => {
    if (val === '' || val === undefined || val === null) return '';
    const converted = convertTo(val, type, unitSystem);
    return (Math.round(converted * 1000) / 1000).toString();
  }, [unitSystem]);

  // Helper to handle input changes converting from UI unit system to metric
  const handleInputChange = (valStr: string, setter: (v: number | '') => void, type: 'length' | 'length_small' | 'volume') => {
    if (valStr === '') {
      setter('');
      return;
    }
    let num = parseFloat(valStr) || 0;
    num = convertFrom(num, type, unitSystem);
    setter(num);
  };

  // Perform cabinet calculations
  const cabinetData = useMemo<WoodCabinetData | null>(() => {
    const thickness = (typeof woodThickness === 'number' ? woodThickness : 0) / 10; // mm to cm
    let hInt = 0, wInt = 0, dInt = 0;
    let hExt = 0, wExt = 0, dExt = 0;
    let dTrapTopInt = 0, dTrapBotInt = 0;
    let dTrapTopExt = 0, dTrapBotExt = 0;
    let netVol = 0;
    let totalVol = 0;
    let valid = false;

    const extraVal = typeof woodExtra === 'number' ? woodExtra : 0;

    let portVol = 0;
    if (woodSource === 'ported' && portedData.valid && portedData.Fb > 0 && portedData.Vb > 0) {
      const pCount = Number(portCount) || 0;
      if (pCount > 0) {
        const isRect = portShape === 'rectangular';
        const pDia = portShape === 'round'
          ? (Number(portDiameter) || 0)
          : portShape === 'custom'
            ? (2 * Math.sqrt((Number(portArea) || 0) / Math.PI))
            : (2 * Math.sqrt(((Number(portWidth) || 0) * (Number(portHeight) || 0)) / Math.PI));

        if (pDia > 0) {
          const kCorrection = flaredEnds === 1 ? 0.850 : flaredEnds === 2 ? 0.968 : 0.732;
          const Lv = ((23562.5 * Math.pow(pDia, 2) * pCount) / (portedData.Fb * portedData.Fb * portedData.Vb)) - (kCorrection * pDia);
          if (Lv > 0) {
            if (isRect) {
              const w = Number(portWidth) || 0;
              const h = Number(portHeight) || 0;
              portVol = (pCount * w * h * Lv) / 1000;
            } else {
              portVol = (pCount * Math.PI * Math.pow(pDia / 2, 2) * Lv) / 1000;
            }
          }
        }
      }
    }

    if (woodMode === 'calc') {
      // Source volume (ajustado por damping para obtener el volumen físico que se construirá)
      let reqNetVol = 0;
      if (woodSource === 'sealed' && sealedData.valid) {
        reqNetVol = sealedData.Vb;
      } else if (woodSource === 'ported' && portedData.valid) {
        reqNetVol = portedData.Vb;
      } else if (woodSource === 'bandpass' && bandpassData.valid) {
        reqNetVol = bandpassData.Vf + bandpassData.Vr;
      }
      netVol = reqNetVol / dampingFactor;

      if (netVol > 0) {
        totalVol = netVol + extraVal + portVol;
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
            netVol = Math.max(0, vBruto - (extraVal + portVol)) * dampingFactor;
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
            netVol = Math.max(0, vBruto - (extraVal + portVol)) * dampingFactor;
            valid = true;
          }
        }
      }
    }

    if (valid) {
      const pieces: WoodCutPiece[] = [];
      const uLabel = getUnitLabel('length', unitSystem);

      if (woodShape === 'rectangular') {
        pieces.push({
          name: t("Caras Laterales (Izquierda y Derecha)"),
          qty: 2,
          dimensions: `${displayVal(hExt, 'length')} x ${displayVal(dExt, 'length')} ${uLabel}`
        });
        pieces.push({
          name: t("Tapas (Superior e Inferior)"),
          qty: 2,
          dimensions: `${displayVal(wInt, 'length')} x ${displayVal(dExt, 'length')} ${uLabel}`
        });
        pieces.push({
          name: t("Caras (Frontal y Trasera)"),
          qty: 2,
          dimensions: `${displayVal(hInt, 'length')} x ${displayVal(wInt, 'length')} ${uLabel}`
        });
        if (woodSource === 'bandpass') {
          pieces.push({
            name: t("Divisor Interno (Bafle de Montaje)"),
            qty: 1,
            dimensions: `${displayVal(hInt, 'length')} x ${displayVal(wInt, 'length')} ${uLabel}`
          });
        }
      } else {
        const hSlant = Math.sqrt(Math.pow(hInt, 2) + Math.pow(Math.abs(dTrapBotInt - dTrapTopInt), 2));
        pieces.push({
          name: t("Caras Laterales (Trapecios Inclinados)"),
          qty: 2,
          dimensions: `${t("Alto")}: ${displayVal(hExt, 'length')} ${uLabel} | ${t("Sup")}: ${displayVal(dTrapTopExt, 'length')} / ${t("Inf")}: ${displayVal(dTrapBotExt, 'length')} ${uLabel}`
        });
        pieces.push({
          name: t("Tapa Superior"),
          qty: 1,
          dimensions: `${displayVal(wInt, 'length')} x ${displayVal(dTrapTopExt, 'length')} ${uLabel}`
        });
        pieces.push({
          name: t("Tapa Inferior"),
          qty: 1,
          dimensions: `${displayVal(wInt, 'length')} x ${displayVal(dTrapBotExt, 'length')} ${uLabel}`
        });
        pieces.push({
          name: t("Cara Trasera (Recta)"),
          qty: 1,
          dimensions: `${displayVal(hInt, 'length')} x ${displayVal(wInt, 'length')} ${uLabel}`
        });
        pieces.push({
          name: t("Cara Frontal (Inclinada - Bafle)"),
          qty: 1,
          dimensions: `${displayVal(hSlant, 'length')} ${uLabel} (${t("inclinado")}) x ${displayVal(wInt, 'length')} ${uLabel}`
        });
        if (woodSource === 'bandpass') {
          pieces.push({
            name: t("Divisor Interno (Bafle de Montaje)"),
            qty: 1,
            dimensions: `${displayVal(hInt, 'length')} x ${displayVal(wInt, 'length')} ${uLabel}`
          });
        }
      }

      return {
        valid: true,
        vNeto: netVol,
        vTotal: totalVol,
        vExtra: (woodExtra || 0) + portVol,
        hInt, wInt, dInt,
        dTrapTopInt, dTrapBotInt,
        hExt, wExt, dExt,
        dTrapTopExt, dTrapBotExt,
        thickness: woodThickness || 0,
        pieces
      };
    } else {
      return null;
    }
  }, [
    unitSystem, sealedData, portedData, bandpassData, dampingFactor, flaredEnds, woodMode, woodShape, woodConstraint, woodSource, woodRatio,
    woodLockVal1, woodLockVal2, woodLockVal3, woodExtHeight, woodExtWidth, woodExtDepth,
    woodTrapExtHeight, woodTrapExtWidth, woodTrapExtDepthTop, woodTrapExtDepthBot, woodThickness, woodExtra,
    portCount, portDiameter, portShape, portWidth, portHeight, portArea, t, displayVal
  ]);

  useEffect(() => {
    if (onCabinetDataChange) {
      onCabinetDataChange(cabinetData);
    }
  }, [cabinetData, onCabinetDataChange]);

  // Port tuning details for woodworking tab
  const portInfo = useMemo(() => {
    const pCount = Number(portCount) || 0;
    if (woodSource === 'ported' && portedData.valid && pCount > 0 && cabinetData?.valid) {
      const uLabel = getUnitLabel('length', unitSystem);

      const pDia = portShape === 'round'
        ? (Number(portDiameter) || 0)
        : portShape === 'custom'
          ? (2 * Math.sqrt((Number(portArea) || 0) / Math.PI))
          : (2 * Math.sqrt(((Number(portWidth) || 0) * (Number(portHeight) || 0)) / Math.PI));

      let areaLabel: string;
      if (portShape === 'round') {
        const displayPDia = convertTo(pDia, 'length', unitSystem);
        areaLabel = `${displayPDia.toFixed(2)} ${uLabel} (${t("Diámetro")})`;
      } else if (portShape === 'custom') {
        const a = portArea || 0;
        const displayArea = convertTo(Number(a), 'area', unitSystem);
        areaLabel = `${displayArea.toFixed(1)} ${getUnitLabel('area', unitSystem)} (${t("Área libre")})`;
      } else {
        const w = portWidth || 0;
        const h = portHeight || 0;
        const displayW = convertTo(Number(w), 'length', unitSystem);
        const displayH = convertTo(Number(h), 'length', unitSystem);
        areaLabel = `${displayW.toFixed(1)}x${displayH.toFixed(1)} ${uLabel} (${t("Rectangular")})`;
      }

      if (pDia > 0) {
        const kCorrection = flaredEnds === 1 ? 0.850 : flaredEnds === 2 ? 0.968 : 0.732;
        const Lv = cabinetData.vNeto > 0 
          ? ((23562.5 * Math.pow(pDia, 2) * pCount) / (portedData.Fb * portedData.Fb * cabinetData.vNeto)) - (kCorrection * pDia)
          : 0;
        
        const displayLv = convertTo(Lv, 'length', unitSystem);

        const qtySize = `${pCount}x ${t("Puerto(s) de")} ${areaLabel}`;
        let length: string;
        if (Lv <= 0) {
          length = t("Excesivamente corto");
        } else if (Lv > 120) {
          length = `${displayLv.toFixed(1)} ${uLabel} (${t("Excede profundidad")})`;
        } else {
          length = `${displayLv.toFixed(1)} ${uLabel}`;
        }

        let velocity: string;
        if (params.sd && params.xmax) {
          const vPeak = (0.008 * portedData.Fb * params.sd * params.xmax) / (pCount * Math.pow(pDia, 2));
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

        return { qtySize, length, velocity };
      }
    }
    return null;
  }, [woodSource, portedData, portCount, portDiameter, portShape, portWidth, portHeight, portArea, flaredEnds, cabinetData, params, unitSystem, t]);

  const handleApplySuggestedCabinet = () => {
    let netVol = 0;
    if (woodSource === 'sealed' && sealedData.valid) {
      netVol = sealedData.Vb;
    } else if (woodSource === 'ported' && portedData.valid) {
      netVol = portedData.Vb;
    } else if (woodSource === 'bandpass' && bandpassData.valid) {
      netVol = bandpassData.Vf + bandpassData.Vr;
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

  if (readOnly) {
    let numericPortLength = 0;
    if (woodSource === 'ported' && portedData.valid && cabinetData?.valid) {
      const pCount = Number(portCount) || 0;
      const pDia = portShape === 'round'
        ? (Number(portDiameter) || 0)
        : portShape === 'custom'
          ? (2 * Math.sqrt((Number(portArea) || 0) / Math.PI))
          : (2 * Math.sqrt(((Number(portWidth) || 0) * (Number(portHeight) || 0)) / Math.PI));
      if (pDia > 0 && pCount > 0) {
        const kCorrection = flaredEnds === 1 ? 0.850 : flaredEnds === 2 ? 0.968 : 0.732;
        const targetVol = cabinetData.vNeto > 0 ? cabinetData.vNeto : portedData.Vb;
        const Lv = targetVol > 0
          ? ((23562.5 * Math.pow(pDia, 2) * pCount) / (portedData.Fb * portedData.Fb * targetVol)) - (kCorrection * pDia)
          : 0;
        numericPortLength = Lv > 0 ? Lv : 0;
      }
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', boxSizing: 'border-box' }}>
        {/* Diagrama dinámico Corte A-A (Alineado arriba bajo la gráfica) */}
        <CabinetDiagram
          lang={lang}
          unitSystem={unitSystem}
          shape={woodShape}
          cabinetData={cabinetData}
          boxType={woodSource}
          portShape={portShape}
          portDiameter={Number(portDiameter) || 0}
          portWidth={Number(portWidth) || 0}
          portHeight={Number(portHeight) || 0}
          portLength={numericPortLength}
          portCount={Number(portCount) || 0}
          hoveredPieceIndex={hoveredPieceIndex}
          speakerYPct={speakerYPct}
          portYPct={portYPct}
          bandpassOrder={bandpassData?.order}
          bandpassRatio={bandpassData && bandpassData.valid ? bandpassData.Vr / (bandpassData.Vf + bandpassData.Vr) : 0.5}
          bandpassVf={bandpassData?.Vf}
          bandpassVr={bandpassData?.Vr}
        />

        {/* Resultados de Ebanistería */}
        <div className="results-summary" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0rem' }}>
          <div className="result-tile" style={{ padding: '0.25rem' }}>
            <span className="result-tile-label" style={{ fontSize: '0.65rem' }}>{t("Volumen Neto Resultante")}</span>
            <span className="result-tile-value" style={{ fontSize: '0.65rem' }}>
              {cabinetData?.valid 
                ? `${convertTo(cabinetData.vNeto, 'volume', unitSystem).toFixed(2)} ${getUnitLabel('volume', unitSystem)}` 
                : 'N/A'}
            </span>
          </div>
          <div className="result-tile" style={{ padding: '0.25rem' }}>
            <span className="result-tile-label" style={{ fontSize: '0.65rem' }}>{t("Dimensiones Internas")}</span>
            <span className="result-tile-value" style={{ fontSize: '0.65rem', fontWeight: 600, marginTop: '0.15rem' }}>
              {cabinetData?.valid ? (
                woodShape === 'rectangular' 
                  ? `${convertTo(cabinetData.hInt, 'length', unitSystem).toFixed(1)}x${convertTo(cabinetData.wInt, 'length', unitSystem).toFixed(1)}x${convertTo(cabinetData.dInt, 'length', unitSystem).toFixed(1)}`
                  : `${convertTo(cabinetData.hInt, 'length', unitSystem).toFixed(1)}x${convertTo(cabinetData.wInt, 'length', unitSystem).toFixed(1)}xd`
              ) : 'N/A'}
            </span>
          </div>
          <div className="result-tile" style={{ padding: '0.25rem' }}>
            <span className="result-tile-label" style={{ fontSize: '0.65rem' }}>{t("Dimensiones Externas")}</span>
            <span className="result-tile-value" style={{ fontSize: '0.65rem', fontWeight: 600, marginTop: '0.15rem' }}>
              {cabinetData?.valid ? (
                woodShape === 'rectangular'
                  ? `${convertTo(cabinetData.hExt, 'length', unitSystem).toFixed(1)}x${convertTo(cabinetData.wExt, 'length', unitSystem).toFixed(1)}x${convertTo(cabinetData.dExt, 'length', unitSystem).toFixed(1)}`
                  : `${convertTo(cabinetData.hExt, 'length', unitSystem).toFixed(1)}x${convertTo(cabinetData.wExt, 'length', unitSystem).toFixed(1)}xd`
              ) : 'N/A'}
            </span>
          </div>
        </div>

        {/* Puerto de sintonía */}
        {portInfo && (
          <div className="pro-calc-panel" style={{ marginTop: '0rem', padding: '0.65rem' }}>
            <span className="pro-calc-title" style={{ fontSize: '0.78rem' }}>{t("Puerto(s) de Sintonía para este Diseño")}</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.25rem 0.75rem', marginTop: '0.2rem' }}>
              <div className="pro-calc-row" style={{ border: 'none', padding: 0 }}>
                <span className="pro-calc-label" style={{ fontSize: '0.72rem' }}>{t("Cantidad:")}</span>
                <span className="pro-calc-value" style={{ fontSize: '0.72rem' }}>{portInfo.qtySize}</span>
              </div>
              <div className="pro-calc-row" style={{ border: 'none', padding: 0 }}>
                <span className="pro-calc-label" style={{ fontSize: '0.72rem' }}>{t("Longitud Requerida:")}</span>
                <span className="pro-calc-value" style={{ fontSize: '0.72rem' }}>{portInfo.length}</span>
              </div>
            </div>
          </div>
        )}

        {/* Lista de corte interactiva bajo el diagrama en el panel lateral */}
        <div style={{ marginTop: '0.25rem' }}>
          <span className="control-title" style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '0.4rem', fontWeight: 600, display: 'block' }}>
            {t("Lista de Corte Sugerida")} ({t("Grosor:")} {convertTo(cabinetData?.valid ? cabinetData.thickness : (typeof woodThickness === 'number' ? woodThickness : 0), 'length_small', unitSystem).toFixed(1)}{getUnitLabel('length_small', unitSystem)})
          </span>
          <table className="wood-table" style={{ fontSize: '0.78rem' }}>
            <thead>
              <tr>
                <th style={{ padding: '4px 8px' }}>{t("Pieza")}</th>
                <th style={{ padding: '4px 8px', textAlign: 'center' }}>{t("Cant.")}</th>
                <th style={{ padding: '4px 8px' }}>{t("Dimensión de Corte")}</th>
              </tr>
            </thead>
            <tbody>
              {cabinetData?.valid ? (
                cabinetData.pieces.map((piece, idx) => (
                  <tr 
                    key={idx}
                    onMouseEnter={() => setHoveredPieceIndex(idx)}
                    onMouseLeave={() => setHoveredPieceIndex(null)}
                    style={{ 
                      cursor: 'help', 
                      background: hoveredPieceIndex === idx ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                      transition: 'background 0.2s ease'
                    }}
                  >
                    <td style={{ padding: '4px 8px' }}><strong>{piece.name}</strong></td>
                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>{piece.qty}</td>
                    <td style={{ padding: '4px 8px', fontWeight: 500 }}>{piece.dimensions}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '8px' }}>
                    {t("Sin datos para calcular.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.4rem', textAlign: 'left', fontStyle: 'italic' }}>
            * {t("Pasa el cursor sobre una pieza para verla resaltada en el plano técnico.")}
          </div>
        </div>
      </div>
    );
  }

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
              onChange={(e) => setWoodShape(e.target.value as 'rectangular' | 'trapezoidal')} 
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
              {woodConstraint === 'none' && woodShape === 'rectangular' && (
                <div className="input-group">
                  <label>{t("Proporción Acústica")}</label>
                  <select 
                    value={woodRatio} 
                    onChange={(e) => setWoodRatio(e.target.value as 'golden' | 'classic' | 'cube')} 
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
                      value={displayVal(woodLockVal1, 'length')} 
                      onChange={(e) => handleInputChange(e.target.value, setWoodLockVal1, 'length')} 
                      step="any" 
                    />
                    <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                  </div>
                </div>
                <div className="input-group">
                  <label>{woodShape === 'trapezoidal' ? t("Ancho Externo") : t("Dimensión 2")}</label>
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
                    <label>{t("Profundidad Superior Fija (D1)")}</label>
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

        {/* MODO B: Ingresar Medidas Físicas de la Caja (Manual) */}
        {woodMode === 'input' && (
          <div className="wood-layout">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.25rem' }}>
              <button
                onClick={handleApplySuggestedCabinet}
                className="preset-select"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--primary)', border: '1px solid var(--primary)', color: '#ffffff', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                type="button"
                disabled={!(woodSource === 'sealed' ? sealedData.valid : woodSource === 'ported' ? portedData.valid : bandpassData.valid)}
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
                  <label>{t("Profundidad Externa")}</label>
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
              <div className="wood-grid-controls">
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
                  <label>{t("Prof. Superior Externa (D1)")}</label>
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
                  <label>{t("Prof. Inferior Externa (D2)")}</label>
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

        {/* Parámetros Comunes de Ebanistería */}
        <div className="wood-grid-controls" style={{ borderTop: '1px solid var(--card-border)', paddingTop: '1rem', marginTop: '0.25rem' }}>
          <div className="input-group">
            <label>{t("Espesor de Madera")}</label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={displayVal(woodThickness, 'length_small')} 
                onChange={(e) => handleInputChange(e.target.value, setWoodThickness, 'length_small')} 
                step="any" 
              />
              <span className="unit-badge">{getUnitLabel('length_small', unitSystem)}</span>
            </div>
          </div>
          <div className="input-group">
            <label>{t("Vol. Extra")} <span className="label-desc">({t("(Altavoz/Ducto/Ref.)")})</span></label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={displayVal(woodExtra, 'volume')} 
                onChange={(e) => handleInputChange(e.target.value, setWoodExtra, 'volume')} 
                step="any" 
              />
              <span className="unit-badge">{getUnitLabel('volume', unitSystem)}</span>
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
              {cabinetData?.valid 
                ? `${convertTo(woodMode === 'calc' ? cabinetData.vTotal : cabinetData.vNeto, 'volume', unitSystem).toFixed(woodMode === 'calc' ? 1 : 2)} ${getUnitLabel('volume', unitSystem)}` 
                : 'N/A'}
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
                  ? `${convertTo(cabinetData.hInt, 'length', unitSystem).toFixed(1)} x ${convertTo(cabinetData.wInt, 'length', unitSystem).toFixed(1)} x ${convertTo(cabinetData.dInt, 'length', unitSystem).toFixed(1)} ${getUnitLabel('length', unitSystem)}`
                  : `${convertTo(cabinetData.hInt, 'length', unitSystem).toFixed(1)} x ${convertTo(cabinetData.wInt, 'length', unitSystem).toFixed(1)} x d(sup:${convertTo(cabinetData.dTrapTopInt || 0, 'length', unitSystem).toFixed(1)}/inf:${convertTo(cabinetData.dTrapBotInt || 0, 'length', unitSystem).toFixed(1)}) ${getUnitLabel('length', unitSystem)}`
              ) : 'N/A'}
            </span>
            <span className="result-tile-sub">{t("Alto x Ancho x Profundidad")}</span>
          </div>
          <div className="result-tile">
            <span className="result-tile-label">{t("Dimensiones Externas")}</span>
            <span className="result-tile-value" style={{ fontSize: '0.95rem', fontWeight: 500, marginTop: '0.4rem' }}>
              {cabinetData?.valid ? (
                woodShape === 'rectangular'
                  ? `${convertTo(cabinetData.hExt, 'length', unitSystem).toFixed(1)} x ${convertTo(cabinetData.wExt, 'length', unitSystem).toFixed(1)} x ${convertTo(cabinetData.dExt, 'length', unitSystem).toFixed(1)} ${getUnitLabel('length', unitSystem)}`
                  : `${convertTo(cabinetData.hExt, 'length', unitSystem).toFixed(1)} x ${convertTo(cabinetData.wExt, 'length', unitSystem).toFixed(1)} x d(sup:${convertTo(cabinetData.dTrapTopExt || 0, 'length', unitSystem).toFixed(1)}/inf:${convertTo(cabinetData.dTrapBotExt || 0, 'length', unitSystem).toFixed(1)}) ${getUnitLabel('length', unitSystem)}`
              ) : 'N/A'}
            </span>
            <span className="result-tile-sub">{t("Alto x Ancho x Profundidad")}</span>
          </div>
        </div>

        {/* Puerto de sintonía en ebanistería */}
        {portInfo && (
          <div className="pro-calc-panel" style={{ marginTop: '0.5rem' }}>
            <span className="pro-calc-title">{t("Puerto(s) de Sintonía para este Diseño")}</span>
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
            {t("Lista de Corte Sugerida (Grosor:")} {convertTo(cabinetData?.valid ? cabinetData.thickness : (typeof woodThickness === 'number' ? woodThickness : 0), 'length_small', unitSystem).toFixed(1)}{getUnitLabel('length_small', unitSystem)})
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
                  <tr 
                    key={idx}
                    onMouseEnter={() => setHoveredPieceIndex(idx)}
                    onMouseLeave={() => setHoveredPieceIndex(null)}
                    style={{ 
                      cursor: 'help', 
                      background: hoveredPieceIndex === idx ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                      transition: 'background 0.2s ease'
                    }}
                  >
                    <td><strong>{piece.name}</strong></td>
                    <td style={{ textAlign: 'center' }}>{piece.qty}</td>
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
