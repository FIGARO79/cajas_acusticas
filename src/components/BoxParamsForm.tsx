import React, { useMemo, useState } from 'react';
import { type Lang, translate } from '../utils/translations';
import { type UnitSystem, convertTo, convertFrom, getUnitLabel } from '../utils/units';
import type { CalculatedPorted, CalculatedSealed, CalculatedBandpass, SpeakerParams, PortSuggestions, WoodCabinetData, WoodShape, VentedAlignmentType, Bandpass6Topology } from '../types';
import { suggestPortConfig, calcOptimalPortForSpeaker, calculatePortSpacing, calcPortLength, getKCorrection } from '../utils/acousticMath';
import { getWasm, optimizeCrossoverLowpass, calcSuggestFb, calcSealedForF3, calcVentedForF3, suggestPassiveRadiator } from '../wasm';

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
  cabinetData?: WoodCabinetData | null;
  isLinkedToCabinet: boolean;

  // Ajustes de alineación
  targetQtc: number;
  setTargetQtc: (val: number) => void;
  ventedAlignment?: VentedAlignmentType;
  setVentedAlignment?: (align: VentedAlignmentType) => void;
  externalSubwoofer?: boolean;
  setExternalSubwoofer?: (val: boolean) => void;
  bandpassOrder: 4 | 6;
  setBandpassOrder: (val: 4 | 6) => void;
  bandpassS?: number;
  setBandpassS?: (val: number) => void;
  bandpassA?: number;
  setBandpassA?: (val: number) => void;
  bandpassTopology?: Bandpass6Topology;
  setBandpassTopology?: (val: Bandpass6Topology) => void;
  bandpassDf?: number;
  setBandpassDf?: (val: number) => void;
  bandpassQtPrime?: number;
  setBandpassQtPrime?: (val: number) => void;

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
  flaredEnds: 0 | 1 | 2 | 3;
  setFlaredEnds: (val: 0 | 1 | 2 | 3) => void;
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
  activeTab: 'wood' | 'port' | 'damping' | 'crossover';
  setActiveTab: (tab: 'wood' | 'port' | 'damping' | 'crossover') => void;

  // Ebanistería (Woodworking)
  woodMode: 'calc' | 'input';
  setWoodMode: (mode: 'calc' | 'input') => void;
  woodShape: WoodShape;
  setWoodShape: (shape: WoodShape) => void;
  woodConstraint: string;
  setWoodConstraint: (constraint: string) => void;
  woodRatio: 'golden' | 'classic' | 'cube';
  setWoodRatio: (ratio: 'golden' | 'classic' | 'cube') => void;
  woodThickness: number | '';
  setWoodThickness: (val: number | '') => void;
  woodExtra: number | '';
  setWoodExtra: (val: number | '') => void;
  enableBracing?: boolean;
  onEnableBracingChange?: (v: boolean) => void;
  bracingCount?: number;
  onBracingCountChange?: (v: number) => void;

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
  woodTrapExtRearWidth?: number | '';
  setWoodTrapExtRearWidth?: (v: number | '') => void;

  // Damping
  dampingType: 'none' | 'light' | 'moderate' | 'heavy';
  setDampingType: (type: 'none' | 'light' | 'moderate' | 'heavy') => void;
  classicalModel?: boolean;
  setClassicalModel?: (val: boolean) => void;

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
  portSpacingPct?: number;
  setPortSpacingPct?: (val: number) => void;
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
  useCustomMidVol: boolean;
  setUseCustomMidVol: (val: boolean) => void;
  customMidVol: number | '';
  setCustomMidVol: (val: number | '') => void;

  tweeterYPct: number;
  setTweeterYPct: (val: number) => void;
  midrangeYPct: number;
  setMidrangeYPct: (val: number) => void;
  midCabinetDepth: number | '';
  setMidCabinetDepth: (val: number | '') => void;
  midSealed?: boolean;
  setMidSealed?: (val: boolean) => void;

  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  panelStyle?: React.CSSProperties;
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
  cabinetData,
  isLinkedToCabinet,

  targetQtc,
  setTargetQtc,
  ventedAlignment = 'B4',
  setVentedAlignment,
  externalSubwoofer = false,
  setExternalSubwoofer,
  bandpassOrder,
  setBandpassOrder,
  bandpassTopology = 'parallel',
  setBandpassTopology,
  bandpassDf = 0.65,
  setBandpassDf,
  bandpassQtPrime = 0,
  setBandpassQtPrime,

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
  enableBracing = false,
  onEnableBracingChange,
  bracingCount = 2,
  onBracingCountChange,

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
  woodTrapExtRearWidth = 30,
  setWoodTrapExtRearWidth,

  dampingType,
  setDampingType,
  classicalModel = false,
  setClassicalModel,

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
  portSpacingPct = 50,
  setPortSpacingPct,
  portLocation,
  setPortLocation,
  customPorted,
  midFs,
  setMidFs,
  midVas,
  setMidVas,
  midQts,
  setMidQts,
  midTargetQtc,
  setMidTargetQtc,
  useCustomMidVol,
  setUseCustomMidVol,
  customMidVol,
  setCustomMidVol,
  tweeterYPct,
  setTweeterYPct,
  midrangeYPct,
  setMidrangeYPct,
  midCabinetDepth,
  setMidCabinetDepth,
  midSealed = false,
  setMidSealed = () => {},
  isCollapsed = false,
  onToggleCollapse,
  panelStyle,
}) => {
  const t = (text: string) => translate(text, lang);

  // Desired F3 (BassBox Pro) local state
  const [desiredF3Sealed, setDesiredF3Sealed] = useState<string>('50');
  const [desiredF3SealedMsg, setDesiredF3SealedMsg] = useState<string>('');
  const [desiredF3Vented, setDesiredF3Vented] = useState<string>('40');
  const [desiredF3VentedMsg, setDesiredF3VentedMsg] = useState<string>('');

  const handleApplyDesiredF3Sealed = () => {
    const f3Target = parseFloat(desiredF3Sealed);
    if (!params.fs || !params.vas || !params.qts || !Number.isFinite(f3Target) || f3Target <= 0) {
      setDesiredF3SealedMsg(t("Ingresa un F3 objetivo válido."));
      return;
    }
    const res = calcSealedForF3(params.fs, params.vas, params.qts, f3Target);
    if (res.valid) {
      setTargetQtc(Number(res.qtc.toFixed(3)));
      setCustomPorted(false);
      setDesiredF3SealedMsg(`${t("Aplicado")}: Qtc ${res.qtc.toFixed(2)} (F3 ≈ ${res.f3.toFixed(1)} Hz)`);
    } else if (res.statusCode === 1) {
      setDesiredF3SealedMsg(`${t("F3 demasiado baja para este altavoz")} (mín ≈ ${res.f3.toFixed(1)} Hz)`);
    } else if (res.statusCode === 2) {
      setDesiredF3SealedMsg(`${t("F3 demasiado alta")} (máx ≈ ${res.f3.toFixed(1)} Hz)`);
    } else {
      setDesiredF3SealedMsg(t("No se pudo alcanzar el F3 deseado."));
    }
  };

  const handleApplyDesiredF3Vented = () => {
    const f3Target = parseFloat(desiredF3Vented);
    if (!params.fs || !params.vas || !params.qts || !Number.isFinite(f3Target) || f3Target <= 0) {
      setDesiredF3VentedMsg(t("Ingresa un F3 objetivo válido."));
      return;
    }
    const res = calcVentedForF3(params.fs, params.vas, params.qts, f3Target);
    if (res.valid) {
      setCustomVb(Number(res.vb.toFixed(2)));
      setCustomFb(Number(res.fb.toFixed(1)));
      setCustomPorted(true);
      setUseCustomPortLength(false);
      setDesiredF3VentedMsg(`${t("Aplicado")}: Vb ${res.vb.toFixed(1)} L · Fb ${res.fb.toFixed(1)} Hz`);
    } else if (res.statusCode === 1) {
      setDesiredF3VentedMsg(`${t("F3 demasiado baja para este altavoz")} (mín ≈ ${res.f3.toFixed(1)} Hz)`);
    } else if (res.statusCode === 2) {
      setDesiredF3VentedMsg(`${t("F3 demasiado alta")} (máx ≈ ${res.f3.toFixed(1)} Hz)`);
    } else {
      setDesiredF3VentedMsg(t("No se pudo alcanzar el F3 deseado."));
    }
  };

  const handleSuggestPassiveRadiator = async () => {
    if (!params.fs || !params.vas || !params.qts) return;
    try {
      const vbRef = portedData.valid && portedData.Vb > 0 ? portedData.Vb : (customVb || 40);
      const fbRef = portedData.valid && portedData.Fb > 0 ? portedData.Fb : (customFb || params.fs);
      const res = await suggestPassiveRadiator(
        params.fs,
        params.vas,
        params.qts,
        params.sd || 215,
        params.xmax || 5,
        vbRef,
        fbRef
      );
      setPrDia(Number(res.diaCm.toFixed(1)));
      setPrVas(Number(res.vasPr.toFixed(1)));
      setPrFs(Number(res.fsPr.toFixed(1)));
      setPrMms(Number(res.mmsPr.toFixed(1)));
    } catch (e) {
      console.error("Error suggesting passive radiator:", e);
    }
  };

  // Air-Core Inductor Winding Calculator State
  const [whLTarget, setWhLTarget] = useState<number>(1.0); // mH
  const [whCoilDia, setWhCoilDia] = useState<number>(25.0); // mm (mean diameter)
  const [whCoilLen, setWhCoilLen] = useState<number>(20.0); // mm (winding length)
  const [whWireDia, setWhWireDia] = useState<number>(1.0); // mm (wire diameter)
  const [whCalcMode, setWhCalcMode] = useState<'turns' | 'inductance'>('turns');
  const [whTurns, setWhTurns] = useState<number>(100);

  // Nelder-Mead Crossover Optimization State
  const [optDcr, setOptDcr] = useState<number>(0.3);
  const [optResult, setOptResult] = useState<{
    lOptMh: number;
    cOptUf: number;
    rmsErrorDb: number;
    iterations: number;
  } | null>(null);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);

  const handleRunOptimizer = () => {
    setIsOptimizing(true);
    try {
      const targetFc = fc > 0 ? fc : 2500;
      const reVal = (params.re && params.re > 0) ? params.re : (zobelRe > 0 ? zobelRe : (zWoofer > 0 ? zWoofer * 0.8 : 6.0));
      const leVal = (params.le && params.le > 0) ? params.le : (zobelLe > 0 ? zobelLe : 0.8);
      const res = optimizeCrossoverLowpass(targetFc, reVal, leVal, optDcr || 0.3);
      setOptResult(res);
    } catch (e) {
      console.error("Nelder-Mead optimization error:", e);
    } finally {
      setIsOptimizing(false);
    }
  };

  const whCalculations = useMemo(() => {
    const d = whCoilDia; // mm
    const l = whCoilLen; // mm
    const dw = whWireDia; // mm

    if (d <= 0 || l <= 0) return null;

    let turns = whTurns;
    let inductance = whLTarget;

    if (whCalcMode === 'turns') {
      const luH = inductance * 1000;
      const n2 = (luH * (9 * d + 10 * l)) / (d * d);
      turns = n2 > 0 ? Math.sqrt(n2) : 0;
    } else {
      const luH = (d * d * turns * turns) / (9 * d + 10 * l);
      inductance = luH / 1000;
    }

    const meanCircumference = Math.PI * d; // mm
    const wireLengthM = (turns * meanCircumference) / 1000;
    
    const wireArea = dw > 0 ? Math.PI * Math.pow(dw / 2, 2) : 0;
    const resistance = wireArea > 0 ? (0.0172 * wireLengthM) / wireArea : 0;
    const copperWeightG = wireArea > 0 ? (wireArea * wireLengthM / 100) * 8.89 : 0;

    const turnsPerLayer = dw > 0 ? l / dw : 0;
    const layers = turnsPerLayer > 0 ? Math.ceil(turns / turnsPerLayer) : 0;
    const windingHeight = layers * dw; // mm

    return {
      turns: Math.round(turns * 10) / 10,
      inductance: Math.round(inductance * 1000) / 1000,
      wireLengthM: Math.round(wireLengthM * 100) / 100,
      resistance: Math.round(resistance * 100) / 100,
      layers,
      windingHeight: Math.round(windingHeight * 10) / 10,
      copperWeightG: Math.round(copperWeightG * 10) / 10,
    };
  }, [whLTarget, whCoilDia, whCoilLen, whWireDia, whCalcMode, whTurns]);

  const suggestedInductors = useMemo(() => {
    const list: Array<{ label: string; value: number }> = [];
    const Rt = zTweeter;
    const Rm = zMidrange;
    const Rw = zWoofer;
    const f = fc;
    const fL = fcLow;
    const fH = fcHigh;
    const wasm = getWasm();

    if (crossoverWays === 2 && f > 0) {
      if (crossoverType === '1st_order') {
        const resW = wasm ? wasm.calc_filtro_1er_orden(f, Rw) : null;
        list.push({ label: `${t("Woofer L1")} (1er O)`, value: resW ? resW.l : (Rw / (2 * Math.PI * f)) * 1000 });
        resW?.free();
      } else if (crossoverType === '2nd_butter') {
        const resT = wasm ? wasm.calc_filtro_2do_orden_butterworth(f, Rt) : null;
        const resW = wasm ? wasm.calc_filtro_2do_orden_butterworth(f, Rw) : null;
        list.push({ label: `${t("Tweeter L1")} (2do O Butter)`, value: resT ? resT.l_hp : ((Rt * Math.sqrt(2)) / (2 * Math.PI * f)) * 1000 });
        list.push({ label: `${t("Woofer L1")} (2do O Butter)`, value: resW ? resW.l_lp : ((Rw * Math.sqrt(2)) / (2 * Math.PI * f)) * 1000 });
        resT?.free(); resW?.free();
      } else if (crossoverType === '2nd_lr') {
        const resT = wasm ? wasm.calc_filtro_linkwitz_riley(f, Rt) : null;
        const resW = wasm ? wasm.calc_filtro_linkwitz_riley(f, Rw) : null;
        list.push({ label: `${t("Tweeter L1")} (2do O LR)`, value: resT ? resT.l : (Rt / (Math.PI * f)) * 1000 });
        list.push({ label: `${t("Woofer L1")} (2do O LR)`, value: resW ? resW.l : (Rw / (Math.PI * f)) * 1000 });
        resT?.free(); resW?.free();
      } else if (crossoverType === '4th_lr') {
        const resT = wasm ? wasm.calc_filtro_4to_orden_lr(f, Rt) : null;
        const resW = wasm ? wasm.calc_filtro_4to_orden_lr(f, Rw) : null;
        list.push({ label: `${t("Tweeter L1")} (4to O LR)`, value: resT ? resT.l1 : (0.1592 * Rt * 1000) / f });
        list.push({ label: `${t("Tweeter L2")} (4to O LR)`, value: resT ? resT.l2 : (0.0796 * Rt * 1000) / f });
        list.push({ label: `${t("Woofer L1")} (4to O LR)`, value: resW ? resW.l1 : (0.1592 * Rw * 1000) / f });
        list.push({ label: `${t("Woofer L2")} (4to O LR)`, value: resW ? resW.l2 : (0.0796 * Rw * 1000) / f });
        resT?.free(); resW?.free();
      }
    } else if (crossoverWays === 3 && fL > 0 && fH > 0) {
      if (crossoverType === '1st_order') {
        const resW = wasm ? wasm.calc_filtro_1er_orden(fL, Rw) : null;
        const resM = wasm ? wasm.calc_filtro_1er_orden(fH, Rm) : null;
        list.push({ label: `${t("Woofer L1")} (1er O)`, value: resW ? resW.l : (Rw / (2 * Math.PI * fL)) * 1000 });
        list.push({ label: `${t("Medio L1 (Paso Banda)")} (1er O)`, value: resM ? resM.l : (Rm / (2 * Math.PI * fH)) * 1000 });
        resW?.free(); resM?.free();
      } else if (crossoverType === '2nd_butter') {
        const resW = wasm ? wasm.calc_filtro_2do_orden_butterworth(fL, Rw) : null;
        const resM = wasm ? wasm.calc_filtro_2do_orden_butterworth(fH, Rm) : null;
        list.push({ label: `${t("Woofer L1")} (2do O Butter)`, value: resW ? resW.l_lp : ((Rw * Math.sqrt(2)) / (2 * Math.PI * fL)) * 1000 });
        list.push({ label: `${t("Medio L1 (Paso Banda)")} (2do O Butter)`, value: resM ? resM.l_lp : ((Rm * Math.sqrt(2)) / (2 * Math.PI * fH)) * 1000 });
        resW?.free(); resM?.free();
      } else if (crossoverType === '2nd_lr') {
        const resW = wasm ? wasm.calc_filtro_linkwitz_riley(fL, Rw) : null;
        const resM = wasm ? wasm.calc_filtro_linkwitz_riley(fH, Rm) : null;
        list.push({ label: `${t("Woofer L1")} (2do O LR)`, value: resW ? resW.l : (Rw / (Math.PI * fL)) * 1000 });
        list.push({ label: `${t("Medio L1 (Paso Banda)")} (2do O LR)`, value: resM ? resM.l : (Rm / (Math.PI * fH)) * 1000 });
        resW?.free(); resM?.free();
      } else if (crossoverType === '4th_lr') {
        const resW = wasm ? wasm.calc_filtro_4to_orden_lr(fL, Rw) : null;
        const resM = wasm ? wasm.calc_filtro_4to_orden_lr(fH, Rm) : null;
        list.push({ label: `${t("Woofer L1")} (4to O LR)`, value: resW ? resW.l1 : (0.1592 * Rw * 1000) / fL });
        list.push({ label: `${t("Woofer L2")} (4to O LR)`, value: resW ? resW.l2 : (0.0796 * Rw * 1000) / fL });
        list.push({ label: `${t("Medio L1 (Paso Banda)")} (4to O LR)`, value: resM ? resM.l1 : (0.1592 * Rm * 1000) / fH });
        list.push({ label: `${t("Medio L2 (Paso Banda)")} (4to O LR)`, value: resM ? resM.l2 : (0.0796 * Rm * 1000) / fH });
        resW?.free(); resM?.free();
      }
    }

    return list;
  }, [crossoverWays, crossoverType, fc, fcLow, fcHigh, zTweeter, zMidrange, zWoofer, t]);

  const targetOptimalVb = useMemo(() => {
    if (cabinetData?.valid && cabinetData.vNeto > 0) {
      return cabinetData.vNeto;
    }
    return portedData.valid && portedData.Vb > 0 ? portedData.Vb : (customVb || 35);
  }, [cabinetData, portedData.valid, portedData.Vb, customVb]);

  // Sintonía Fb óptima sugerida según la alineación acústica activa o SuggestFb cuando Vb es fijo/manual
  const recommendedFbForDriver = useMemo<number>(() => {
    if (!params.fs || params.fs <= 0) return 0;
    if (externalSubwoofer) {
      return Math.min(95, Math.max(55, Math.round(params.fs * 1.12 * 10) / 10));
    }
    try {
      const wasm = getWasm();
      if (wasm && params.vas && params.qts) {
        if ((isLinkedToCabinet || customPorted) && targetOptimalVb > 0) {
          const suggestFb = calcSuggestFb(params.fs, params.vas, params.qts, targetOptimalVb);
          if (suggestFb > 0) return Math.round(suggestFb * 10) / 10;
        }
        const res = wasm.calc_alineacion_ventilada_ex(params.fs, params.vas, params.qts, ventedAlignment || 'B4', 0);
        if (res.fb > 0) return Math.round(res.fb * 10) / 10;
      }
    } catch {}
    return Math.round(params.fs * 10) / 10;
  }, [params.fs, params.qts, params.vas, ventedAlignment, externalSubwoofer, isLinkedToCabinet, customPorted, targetOptimalVb]);

  // Determinar la sintonía (Fb) objetivo para el cálculo de puertos:
  // Si el usuario fijó una sintonía personalizada, la respeta; de lo contrario usa la Fb óptima de la alineación seleccionada
  const targetOptimalFb = useMemo(() => {
    if (!useCustomPortLength) {
      if (customPorted && customFb > 0) {
        return customFb;
      }
      if (recommendedFbForDriver > 0) {
        return recommendedFbForDriver;
      }
      if (portedData.valid && portedData.Fb > 0) {
        return portedData.Fb;
      }
    } else {
      if (portedData.valid && portedData.Fb > 0) {
        return portedData.Fb;
      }
    }
    return params.fs || 50;
  }, [useCustomPortLength, customPorted, customFb, recommendedFbForDriver, portedData.valid, portedData.Fb, params.fs]);

  // Alineación sugerida óptima según Qts del driver (BassBox B4 <= 0.49, Compacto práctico > 0.49)
  const recommendedAlignment = useMemo<VentedAlignmentType>(() => {
    if (!params.qts) return 'B4';
    if (params.qts > 0.49) return 'COMPACT';
    return 'B4';
  }, [params.qts]);

  const handleApplyOptimalFb = () => {
    if (recommendedFbForDriver <= 0) return;
    setCustomFb(recommendedFbForDriver);
    setUseCustomPortLength(false);
    setCustomPorted(true);
  };

  const suggestions = useMemo<PortSuggestions | null>(() => {
    if (targetOptimalVb > 0 && targetOptimalFb > 0) {
      const minLen = (Number(woodThickness) || 0) / 10;
      return suggestPortConfig(targetOptimalVb, targetOptimalFb, params, flaredEnds, minLen);
    }
    return null;
  }, [targetOptimalVb, targetOptimalFb, params, flaredEnds, woodThickness]);

  const vPeak = useMemo(() => {
    const pCount = typeof portCount === 'number' ? portCount : 0;
    if (pCount > 0 && portedData.Vb > 0) {
      const pDia = portShape === 'round'
        ? (portDiameter || 0)
        : 2 * Math.sqrt(((portWidth || 0) * (portHeight || 0)) / Math.PI);

      if (pDia > 0 && params.sd && params.xmax) {
        const wasm = getWasm();
        if (wasm) {
          return wasm.calc_velocidad_puerto(portedData.Fb, params.sd, params.xmax, pCount, pDia);
        }
        return (0.008 * portedData.Fb * params.sd * params.xmax) / (pCount * Math.pow(pDia, 2));
      }
    }
    return null;
  }, [portCount, portDiameter, portShape, portWidth, portHeight, portedData, params]);

  const silentAirLimit = flaredEnds >= 2 ? 12.0 : 10.0;

  const portPhysicalDiagnostics = useMemo(() => {
    const pCount = typeof portCount === 'number' && portCount > 0 ? portCount : 1;
    const pDia = portShape === 'round'
      ? (Number(portDiameter) || 0)
      : (2 * Math.sqrt(((Number(portWidth) || 0) * (Number(portHeight) || 0)) / Math.PI));

    if (pDia <= 0) return null;

    const lvCm = useCustomPortLength && Number(customPortLength) > 0
      ? Number(customPortLength)
      : (portedData.valid && portedData.Vb > 0 && portedData.Fb > 0
          ? calcPortLength(portedData.Vb, portedData.Fb, pDia, flaredEnds, pCount)
          : 0);

    if (lvCm <= 0) return null;

    const kCorr = getKCorrection(flaredEnds);
    const pipeResonanceHz = 34400 / (2 * (lvCm + kCorr * pDia));
    const minClearanceCm = Math.max(pDia, 2.5);
    const clearanceCm = cabinetData?.valid && cabinetData.dInt > 0
      ? cabinetData.dInt - lvCm
      : null;

    return {
      pDia,
      lvCm,
      pipeResonanceHz,
      minClearanceCm,
      clearanceCm,
      hasPipeWarning: pipeResonanceHz < 400,
      hasClearanceWarning: clearanceCm !== null && clearanceCm < minClearanceCm,
    };
  }, [portCount, portShape, portDiameter, portWidth, portHeight, useCustomPortLength, customPortLength, portedData.valid, portedData.Vb, portedData.Fb, flaredEnds, cabinetData]);

  const computedPortSpacingCm = useMemo(() => {
    const pCount = typeof portCount === 'number' ? portCount : 1;
    if (pCount < 2) return null;
    const innerW = cabinetData?.wInt || 26;
    const pSize = portShape === 'round'
      ? (typeof portDiameter === 'number' ? portDiameter : 7.5)
      : (typeof portWidth === 'number' ? portWidth : 10);
    return calculatePortSpacing(pCount, innerW, portShape, pSize, portSpacingPct);
  }, [portCount, cabinetData?.wInt, portShape, portDiameter, portWidth, portSpacingPct]);

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
    setUseCustomPortLength(false); // Mantener Fb bloqueada para que la longitud se adapte a cualquier ajuste
    if (targetOptimalFb > 0) {
      setCustomFb(Number(targetOptimalFb.toFixed(1)));
      setCustomPorted(true);
    }
  };

  const handleApplyOptimalPort = () => {
    const targetVb = targetOptimalVb;
    const targetFb = targetOptimalFb;
    if (targetVb <= 0 || targetFb <= 0) return;

    const minLen = Math.max((Number(woodThickness) || 15) / 10, 2.0);
    const estDia = portShape === 'round' && typeof portDiameter === 'number' && portDiameter > 0 ? portDiameter : 7.5;
    const maxLen = cabinetData?.valid && cabinetData.dInt > 6
      ? Math.max(cabinetData.dInt - Math.max(estDia, 3.5), minLen + 2)
      : 42.0;

    const opt = calcOptimalPortForSpeaker(targetVb, targetFb, params, flaredEnds, minLen, maxLen);
    setPortCount(opt.numPorts);
    setUseCustomPortLength(false); // Mantener Fb bloqueada
    setCustomFb(Number(targetFb.toFixed(1)));
    setCustomPorted(true);

    if (portShape === 'rectangular') {
      const areaEach = Math.PI * Math.pow(opt.diameter / 2, 2);
      const maxSlotW = cabinetData?.valid && cabinetData.wInt > 4 ? cabinetData.wInt * 0.75 : opt.diameter * 1.8;
      const wSlot = Number(Math.min(maxSlotW, Math.max(opt.diameter * 1.4, 6)).toFixed(1));
      const hSlot = Number(Math.max(1.5, areaEach / wSlot).toFixed(1));
      setPortWidth(wSlot);
      setPortHeight(hSlot);
    } else {
      setPortShape('round');
      setPortDiameter(opt.diameter);
    }
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
    let base: string;
    if (ebp < 60) {
      base = t("Sugerencia: Caja Sellada (Sealed).");
    } else if (ebp > 90) {
      base = t("Sugerencia: Caja Ventilada o Radiador Pasivo.");
    } else {
      base = t("Sugerencia: Sellada, Ventilada o Radiador Pasivo.");
    }
    if (params.qts >= 0.3 && params.qts <= 0.5) {
      const bwNote = params.qts <= 0.38
        ? t("Qts bajo (~0.3): paso banda más ancho.")
        : t("Qts medio (~0.5): paso banda más estrecho.");
      return `${base} ${t("Apto también para Paso Banda (4.º Orden).")} ${bwNote}`;
    }
    return base;
  };

  const ebpValue = params.qes ? (params.fs / params.qes) : null;
  const ebpPct = ebpValue !== null ? Math.min(100, Math.max(0, (ebpValue / 160) * 100)) : 50;
  const ebpStatus = ebpValue === null ? 'none' : ebpValue < 60 ? 'sealed' : ebpValue > 90 ? 'ported' : 'hybrid';

  return (
    <aside className={`panel box-design-panel${isCollapsed ? ' is-collapsed' : ''}`} style={{ borderLeft: 'none', ...panelStyle }}>
      {/* CAD Dock Header */}
      <div
        className={`cad-dock-header${onToggleCollapse ? ' collapsible' : ''}`}
        onClick={onToggleCollapse}
        role={onToggleCollapse ? 'button' : undefined}
        aria-expanded={!isCollapsed}
      >
        <div className="cad-dock-title">
          {onToggleCollapse && <span className="cad-dock-chevron">{isCollapsed ? '▸' : '▾'}</span>}
          <span className="cad-dock-icon">≡</span>
          <span>{t("CONFIGURACIÓN DE CAJA & FILTRO")}</span>
        </div>
        <div className="cad-dock-actions">
          <span className="cad-dock-tag tag-primary">{boxType.toUpperCase()}</span>
        </div>
      </div>

      <div className="panel-scroll-body">
      {/* Medidor Visual de EBP (Thiele-Small) */}
      <div className="ebp-meter-card">
        <div className="ebp-meter-header">
          <div className="ebp-meter-title-wrap">
            <span className="ebp-meter-title">EBP</span>
            <span className="ebp-meter-val">{ebpValue ? ebpValue.toFixed(1) : '---'}</span>
          </div>
          <div className={`ebp-meter-chip chip-${ebpStatus}`}>
            {ebpStatus === 'sealed' && t("Sellada Óptima")}
            {ebpStatus === 'hybrid' && t("Sellada / Ventilada / PR")}
            {ebpStatus === 'ported' && t("Ventilada / PR Óptima")}
            {ebpStatus === 'none' && t("Requiere Qes")}
          </div>
        </div>

        {/* Pista graduada con 3 zonas y puntero */}
        <div className="ebp-meter-track">
          <div className="ebp-zone-sealed" title="0 - 60: Caja Sellada (BassBox)" />
          <div className="ebp-zone-hybrid" title="60 - 90: Sellada, Ventilada o Radiador Pasivo" />
          <div className="ebp-zone-ported" title="> 90: Caja Ventilada o Radiador Pasivo" />
          {ebpValue !== null && (
            <div
              className="ebp-meter-pin"
              style={{ left: `${ebpPct}%` }}
              title={`EBP: ${ebpValue.toFixed(1)}`}
            />
          )}
        </div>

        {/* Marcas de escala */}
        <div className="ebp-meter-labels">
          <span>0</span>
          <span>60 (Sellada)</span>
          <span>90 (Ventilada/PR)</span>
          <span>160+</span>
        </div>

        <div className="ebp-meter-footer">
          {getEbpRecommendation()}
        </div>
      </div>

      {/* Segmented Control de Tipo de Caja */}
      <div className="segmented-control" style={{ marginBottom: '0.45rem', padding: '2px' }}>
        <button
          type="button"
          className={boxType === 'sealed' ? 'active' : ''}
          onClick={() => setBoxType('sealed')}
          style={{ padding: '0.35rem 0.25rem', fontWeight: 600 }}
        >
          {t("Sellada")}
        </button>
        <button
          type="button"
          className={boxType === 'ported' ? 'active' : ''}
          onClick={() => setBoxType('ported')}
          style={{ padding: '0.35rem 0.25rem', fontWeight: 600 }}
        >
          {t("Ventilada")}
        </button>
        <button
          type="button"
          className={boxType === 'bandpass' ? 'active' : ''}
          onClick={() => setBoxType('bandpass')}
          style={{ padding: '0.35rem 0.25rem', fontWeight: 600 }}
        >
          {t("Paso Banda")}
        </button>
      </div>

      {/* Controles de Alineación & Vías del Sistema en Configuración de Caja */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          marginBottom: '0.55rem',
          background: 'rgba(0, 0, 0, 0.2)',
          border: '1px solid var(--card-border)',
          borderRadius: '4px',
          padding: '0.35rem 0.45rem'
        }}
      >
        {/* Fila 1: Alineación específica según tipo de caja */}
        {boxType === 'ported' && setVentedAlignment && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {t("Alineación:")}
            </span>
            <div className="segmented-control" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', width: '100%', margin: 0, padding: '1px', gap: '1px' }}>
              <button
                type="button"
                className={ventedAlignment === 'QB3' ? 'active' : ''}
                onClick={() => setVentedAlignment('QB3')}
                title={t("High Output (BassBox): menor excursión y caja compacta (Qtc ~0.8)")}
                style={{ padding: '0.18rem 0.12rem', fontSize: '0.58rem', lineHeight: 1.05, height: 'auto', minHeight: '26px', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
              >
                <span>{t("Potencia")}</span>
                <span style={{ fontSize: '0.52rem', opacity: 0.8 }}>QB3</span>
              </button>
              <button
                type="button"
                className={ventedAlignment === 'B4' ? 'active' : ''}
                onClick={() => setVentedAlignment('B4')}
                title={t("High Fidelity (Keele/BassBox): respuesta máximamente plana")}
                style={{ padding: '0.18rem 0.12rem', fontSize: '0.58rem', lineHeight: 1.05, height: 'auto', minHeight: '26px', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
              >
                <span>Hi-Fi</span>
                <span style={{ fontSize: '0.52rem', opacity: 0.8 }}>B4</span>
              </button>
              <button
                type="button"
                className={ventedAlignment === 'SBB4' ? 'active' : ''}
                onClick={() => setVentedAlignment('SBB4')}
                title={t("Extended Bass (EBS BassBox): 12.3·Vas·Qts^2.4")}
                style={{ padding: '0.18rem 0.12rem', fontSize: '0.58rem', lineHeight: 1.05, height: 'auto', minHeight: '26px', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
              >
                <span>Ext. Bass</span>
                <span style={{ fontSize: '0.52rem', opacity: 0.8 }}>EBS</span>
              </button>
              <button
                type="button"
                className={ventedAlignment === 'B6' ? 'active' : ''}
                onClick={() => setVentedAlignment('B6')}
                title={t("Ventilada 6.º orden con filtro paso-alto activo (Fx=1.07·Fb, Qx=1.93)")}
                style={{ padding: '0.18rem 0.12rem', fontSize: '0.58rem', lineHeight: 1.05, height: 'auto', minHeight: '26px', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
              >
                <span>HP Act.</span>
                <span style={{ fontSize: '0.52rem', opacity: 0.8 }}>B6</span>
              </button>
              <button
                type="button"
                className={ventedAlignment === 'COMPACT' ? 'active' : ''}
                onClick={() => setVentedAlignment('COMPACT')}
                title={t("Modo compacto práctico para Qts alto (>0.45)")}
                style={{ padding: '0.18rem 0.12rem', fontSize: '0.58rem', lineHeight: 1.05, height: 'auto', minHeight: '26px', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
              >
                <span>{t("Compacto")}</span>
                <span style={{ fontSize: '0.52rem', opacity: 0.8 }}>CMP</span>
              </button>
            </div>
          </div>
        )}

        {boxType === 'sealed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {t("Alineación (Qtc):")}
            </span>
            <div className="segmented-control" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', width: '100%', margin: 0, padding: '1px' }}>
              <button
                type="button"
                className={Math.abs(targetQtc - 0.577) < 0.05 ? 'active' : ''}
                onClick={() => setTargetQtc(0.577)}
                title={t("Bessel (Qtc 0.577): Óptima respuesta transitoria")}
                style={{ padding: '0.15rem 0.18rem', fontSize: '0.6rem', height: '22px', minWidth: 0 }}
              >
                0.577
              </button>
              <button
                type="button"
                className={Math.abs(targetQtc - 0.707) < 0.05 ? 'active' : ''}
                onClick={() => setTargetQtc(0.707)}
                title={t("Butterworth (Qtc 0.707): Máxima planicidad")}
                style={{ padding: '0.15rem 0.18rem', fontSize: '0.6rem', height: '22px', minWidth: 0 }}
              >
                0.707 (Hi-Fi)
              </button>
              <button
                type="button"
                className={Math.abs(targetQtc - 1.0) < 0.05 ? 'active' : ''}
                onClick={() => setTargetQtc(1.0)}
                title={t("Chebyshev (Qtc 1.0): Compacta con realce")}
                style={{ padding: '0.15rem 0.18rem', fontSize: '0.6rem', height: '22px', minWidth: 0 }}
              >
                1.0 (Boost)
              </button>
              <button
                type="button"
                className={Math.abs(targetQtc - 1.5) < 0.05 ? 'active' : ''}
                onClick={() => setTargetQtc(1.5)}
                title={t("High Output BassBox (Qtc 1.5): Máxima compacidad y salida")}
                style={{ padding: '0.15rem 0.18rem', fontSize: '0.6rem', height: '22px', minWidth: 0 }}
              >
                1.5 (Out)
              </button>
            </div>
          </div>
        )}

        {boxType === 'bandpass' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {t("Alineación:")}
            </span>
            <div className="segmented-control" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', width: 'auto', margin: 0, padding: '1px', flex: 1 }}>
              <button
                type="button"
                className={bandpassOrder === 4 ? 'active' : ''}
                onClick={() => setBandpassOrder(4)}
                title={t("Paso Banda de 4.º Orden (Cámara trasera sellada)")}
                style={{ padding: '0.15rem 0.2rem', fontSize: '0.62rem', height: '22px', minWidth: 0 }}
              >
                {t("4.º Orden")}
              </button>
              <button
                type="button"
                className={bandpassOrder === 6 && bandpassTopology === 'parallel' ? 'active' : ''}
                onClick={() => { setBandpassOrder(6); setBandpassTopology?.('parallel'); }}
                title={t("Paso Banda 6.º Orden Paralelo (BassBox)")}
                style={{ padding: '0.15rem 0.2rem', fontSize: '0.62rem', height: '22px', minWidth: 0 }}
              >
                {t("6.º Par.")}
              </button>
              <button
                type="button"
                className={bandpassOrder === 6 && bandpassTopology === 'series' ? 'active' : ''}
                onClick={() => { setBandpassOrder(6); setBandpassTopology?.('series'); }}
                title={t("Paso Banda 6.º Orden Serie (BassBox)")}
                style={{ padding: '0.15rem 0.2rem', fontSize: '0.62rem', height: '22px', minWidth: 0 }}
              >
                {t("6.º Serie")}
              </button>
            </div>
          </div>
        )}

        {/* Fila 2: Vías del Sistema (2W vs 3W) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {t("Vías del Sistema:")}
          </span>
          <div className="segmented-control" style={{ display: 'inline-flex', width: 'auto', margin: 0, padding: '1px', flex: 1 }}>
            <button
              type="button"
              className={crossoverWays === 2 ? 'active' : ''}
              onClick={() => setCrossoverWays(2)}
              title={t("Sistema de 2 Vías (Tweeter + Woofer)")}
              style={{ padding: '0.15rem 0.4rem', fontSize: '0.68rem', height: '22px' }}
            >
              {t("2 Vías (2W)")}
            </button>
            <button
              type="button"
              className={crossoverWays === 3 ? 'active' : ''}
              onClick={() => setCrossoverWays(3)}
              title={t("Sistema de 3 Vías (Tweeter + Medio + Woofer)")}
              style={{ padding: '0.15rem 0.4rem', fontSize: '0.68rem', height: '22px' }}
            >
              {t("3 Vías (3W)")}
            </button>
          </div>
        </div>
      </div>

      {/* Pestañas de Control Central */}
      <div className="sub-tabs-header" style={{ marginBottom: '0.65rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('wood')}
          className={activeTab === 'wood' ? 'active' : ''}
        >
          {t("Medidas")}
        </button>
        {boxType !== 'sealed' && (
          <button
            type="button"
            onClick={() => setActiveTab('port')}
            className={activeTab === 'port' ? 'active' : ''}
          >
            {t("Puerto")}
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab('damping')}
          className={activeTab === 'damping' ? 'active' : ''}
        >
          {t("Damping")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('crossover')}
          className={activeTab === 'crossover' ? 'active' : ''}
        >
          Crossover
        </button>
      </div>

      <div className="form-section">
        {/* PESTAÑA A: DIMENSIONES / MEDIDAS DE LA CAJA */}
        {activeTab === 'wood' && (
          <>
            {/* Modo de Medidas (Calcular / Ingresar) */}
            <div className="segmented-control" style={{ marginBottom: '0.5rem', padding: '2px', borderRadius: '0px' }}>
              <button
                type="button"
                className={woodMode === 'calc' ? 'active' : ''}
                onClick={() => setWoodMode('calc')}
                style={{ padding: '0.3rem 0.25rem', fontSize: '0.72rem', borderRadius: '0px' }}
              >
                {t("Calcular (Vb)")}
              </button>
              <button
                type="button"
                className={woodMode === 'input' ? 'active' : ''}
                onClick={() => setWoodMode('input')}
                style={{ padding: '0.3rem 0.25rem', fontSize: '0.72rem', borderRadius: '0px' }}
              >
                {t("Medidas Manuales")}
              </button>
            </div>

            {/* Forma de la caja */}
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label>{t("Forma de caja")}</label>
              <div className="segmented-control" style={{ padding: '2px', borderRadius: '0px' }}>
                <button
                  type="button"
                  className={woodShape === 'rectangular' ? 'active' : ''}
                  onClick={() => setWoodShape('rectangular')}
                  style={{ padding: '0.35rem 0.25rem', fontSize: '0.72rem', borderRadius: '0px' }}
                >
                  {t("Rectangular")}
                </button>
                <button
                  type="button"
                  className={woodShape === 'trapezoidal' ? 'active' : ''}
                  onClick={() => setWoodShape('trapezoidal')}
                  style={{ padding: '0.35rem 0.25rem', fontSize: '0.72rem', borderRadius: '0px' }}
                >
                  {t("Personalizada")}
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
                          step="0.1"
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
                          step="0.1"
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
                            step="0.1"
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
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', background: 'var(--primary)', border: 'none', color: '#fff', borderRadius: '0px', cursor: 'pointer' }}
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
                          step="0.1"
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
                          step="0.1"
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
                          step="0.1"
                        />
                        <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="input-grid">
                      <div className="input-group">
                        <label>{t("Alto Externo")}</label>
                        <div className="input-wrapper">
                          <input
                            type="number"
                            value={displayVal(woodTrapExtHeight, 'length')}
                            onChange={(e) => handleInputChange(e.target.value, setWoodTrapExtHeight, 'length')}
                            step="0.1"
                          />
                          <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                        </div>
                      </div>
                      <div className="input-group">
                        <label>{t("Ancho Frontal")}</label>
                        <div className="input-wrapper">
                          <input
                            type="number"
                            value={displayVal(woodTrapExtWidth, 'length')}
                            onChange={(e) => handleInputChange(e.target.value, setWoodTrapExtWidth, 'length')}
                            step="0.1"
                          />
                          <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                        </div>
                      </div>
                      <div className="input-group">
                        <label>{t("Ancho Trasero")}</label>
                        <div className="input-wrapper">
                          <input
                            type="number"
                            value={displayVal(woodTrapExtRearWidth, 'length')}
                            onChange={(e) => setWoodTrapExtRearWidth && handleInputChange(e.target.value, setWoodTrapExtRearWidth, 'length')}
                            step="0.1"
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
                            step="0.1"
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
                            step="0.1"
                          />
                          <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                        </div>
                      </div>
                    </div>
                    {typeof woodTrapExtWidth === 'number' && typeof woodTrapExtRearWidth === 'number' && typeof woodTrapExtDepthTop === 'number' && typeof woodTrapExtDepthBot === 'number' && typeof woodTrapExtHeight === 'number' && woodTrapExtHeight > 0 && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                        <span>
                          {t("Ángulo lateral:")}{' '}
                          <strong>
                            ±{(Math.atan(Math.abs(woodTrapExtWidth - woodTrapExtRearWidth) / Math.max(0.1, woodTrapExtDepthTop + woodTrapExtDepthBot)) * (180 / Math.PI)).toFixed(1)}°
                          </strong>
                        </span>
                        <span>
                          {t("Inclinación frontal:")}{' '}
                          <strong>
                            {(Math.atan(Math.abs(woodTrapExtDepthBot - woodTrapExtDepthTop) / Math.max(0.1, woodTrapExtHeight)) * (180 / Math.PI)).toFixed(1)}°
                          </strong>
                        </span>
                      </div>
                    )}
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
                      step="0.1"
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
                      step="0.1"
                      style={{ height: '30px', padding: '0.2rem 2rem 0.2rem 0.55rem', fontSize: '0.78rem' }}
                    />
                    <span className="unit-badge">{getUnitLabel('volume', unitSystem)}</span>
                  </div>
                </div>
                <div className="input-group">
                  <label>{t("Refuerzos Internos")}</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div className="input-wrapper" style={{ display: 'flex', alignItems: 'center', height: '30px', gap: '0.4rem' }}>
                      <input
                        type="checkbox"
                        checked={enableBracing}
                        onChange={(e) => onEnableBracingChange?.(e.target.checked)}
                        style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer', margin: 0 }}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t("Mostrar Bracing")}</span>
                    </div>
                    {enableBracing && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t("Cantidad:")}</span>
                        <select
                          value={bracingCount}
                          onChange={(e) => onBracingCountChange?.(Number(e.target.value))}
                          style={{
                            height: '25px',
                            padding: '0 4px',
                            fontSize: '0.75rem',
                            background: 'var(--input-bg)',
                            color: 'var(--text-main)',
                            border: '1px solid var(--input-border)',
                            borderRadius: '4px',
                            width: '55px',
                            cursor: 'pointer'
                          }}
                        >
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                          <option value={4}>4</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>


            {/* Cámara de Medios (Solo si es diseño de 3 vías) */}
            {crossoverWays === 3 && (
              <div className="premium-form-card" style={{ marginBottom: '0.5rem' }}>
                <div className="form-subsection-title" style={{ marginTop: 0, marginBottom: '0.35rem' }}>
                  {t("Recinto de Medios (Cámara Separada)")}
                </div>
                {/* Opción Medio Sellado/Blindado */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem', padding: '0.45rem', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <input
                    type="checkbox"
                    id="midSealedCheckbox"
                    checked={midSealed}
                    onChange={(e) => setMidSealed(e.target.checked)}
                    style={{ margin: 0, cursor: 'pointer', width: '14px', height: '14px' }}
                  />
                  <label htmlFor="midSealedCheckbox" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none' }}>
                    {t("Medio sellado atrás / blindado (No requiere cámara)")}
                  </label>
                </div>

                {!midSealed ? (
                  <>
                    {/* Collapsible reference panel */}
                    <details style={{
                      background: 'rgba(15, 23, 42, 0.3)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '6px',
                      padding: '0.4rem 0.55rem',
                      marginBottom: '0.75rem',
                      fontSize: '0.68rem',
                      color: 'var(--text-muted)'
                    }}>
                      <summary style={{
                        cursor: 'pointer',
                        fontWeight: 600,
                        color: 'var(--text-main)',
                        outline: 'none',
                        userSelect: 'none'
                      }}>
                        {t("Guía de Diseño de Cámaras de Medios (Ver más)")}
                      </summary>
                      <ul style={{ paddingLeft: '1rem', marginTop: '0.3rem', marginBottom: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <li><strong>{t("Aislamiento Hermético:")}</strong> {t("Debe ser completamente hermética para que la presión de aire del woofer no interfiera con el cono de medios.")}</li>
                        <li><strong>{t("Evitar Formas Cúbicas:")}</strong> {t("Usa paneles traseros inclinados o dimensiones no paralelas para dispersar y romper las ondas estacionarias internas.")}</li>
                        <li><strong>{t("Relleno de Damping:")}</strong> {t("Se recomienda rellenar la cámara generosamente con absorbente (lana, fieltro o espuma acústica) para mitigar resonancias.")}</li>
                        <li><strong>{t("Rigidez:")}</strong> {t("Hazla sólida e integrada con el arriostramiento (bracing) del cajón principal.")}</li>
                      </ul>
                    </details>

                    <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                      <label>{t("Cálculo del Volumen de Medios")}</label>
                      <div className="segmented-control" style={{ padding: '2px', borderRadius: '0px' }}>
                        <button
                          type="button"
                          className={!useCustomMidVol ? 'active' : ''}
                          onClick={() => setUseCustomMidVol(false)}
                          style={{ padding: '0.25rem', fontSize: '0.7rem', borderRadius: '0px' }}
                        >
                          {t("Calcular (T/S)")}
                        </button>
                        <button
                          type="button"
                          className={useCustomMidVol ? 'active' : ''}
                          onClick={() => setUseCustomMidVol(true)}
                          style={{ padding: '0.25rem', fontSize: '0.7rem', borderRadius: '0px' }}
                        >
                          {t("Volumen Manual")}
                        </button>
                      </div>
                    </div>

                    {!useCustomMidVol ? (
                      <div className="input-grid" style={{ marginBottom: '0.5rem' }}>
                        <div className="input-group">
                          <label>Fs ({t("Medios")}) (Hz)</label>
                          <div className="input-wrapper">
                            <input
                              type="number"
                              value={midFs}
                              onChange={(e) => setMidFs(parseFloat(e.target.value) || 120)}
                              style={{ height: '30px', padding: '0.2rem 0.55rem', fontSize: '0.78rem' }}
                            />
                          </div>
                        </div>
                        <div className="input-group">
                          <label>Vas ({t("Medios")}) (L)</label>
                          <div className="input-wrapper">
                            <input
                              type="number"
                              value={convertTo(midVas, 'volume', unitSystem)}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setMidVas(convertFrom(val, 'volume', unitSystem));
                              }}
                              style={{ height: '30px', padding: '0.2rem 0.55rem', fontSize: '0.78rem' }}
                            />
                          </div>
                        </div>
                        <div className="input-group">
                          <label>Qts ({t("Medios")})</label>
                          <div className="input-wrapper">
                            <input
                              type="number"
                              value={midQts}
                              onChange={(e) => setMidQts(parseFloat(e.target.value) || 0.45)}
                              step="0.01"
                              style={{ height: '30px', padding: '0.2rem 0.55rem', fontSize: '0.78rem' }}
                            />
                          </div>
                        </div>
                        <div className="input-group">
                          <label>{t("Qtc Objetivo (Medios)")}</label>
                          <div className="input-wrapper">
                            <input
                              type="number"
                              value={midTargetQtc}
                              onChange={(e) => setMidTargetQtc(parseFloat(e.target.value) || 0.707)}
                              step="0.01"
                              style={{ height: '30px', padding: '0.2rem 0.55rem', fontSize: '0.78rem' }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="input-group" style={{ marginBottom: '0.5rem' }}>
                        <label>{t("Volumen del Recinto de Medios")}</label>
                        <div className="input-wrapper">
                          <input
                            type="number"
                            value={displayVal(customMidVol, 'volume')}
                            onChange={(e) => handleInputChange(e.target.value, setCustomMidVol, 'volume')}
                            placeholder={convertTo(3.0, 'volume', unitSystem).toFixed(2)}
                            step="0.1"
                            style={{ height: '30px', padding: '0.2rem 2.2rem 0.2rem 0.55rem', fontSize: '0.78rem' }}
                          />
                          <span className="unit-badge">{getUnitLabel('volume', unitSystem)}</span>
                        </div>
                      </div>
                    )}

                    <div className="input-group" style={{ marginBottom: '0.5rem' }}>
                      <label>{t("Profundidad de la Cámara de Medios")} ({getUnitLabel('length', unitSystem)})</label>
                      <div className="input-wrapper">
                        <input
                          type="number"
                          value={displayVal(midCabinetDepth, 'length')}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setMidCabinetDepth(convertFrom(val, 'length', unitSystem));
                          }}
                          step="0.1"
                          style={{ height: '30px', padding: '0.2rem 2.2rem 0.2rem 0.55rem', fontSize: '0.78rem' }}
                        />
                        <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                      </div>
                    </div>

                    {/* Resultados del Recinto debajo de los inputs */}
                    <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                      <label style={{ color: 'var(--text-main)', fontWeight: 650, fontSize: '0.72rem', display: 'block', marginBottom: '0.15rem' }}>
                        {t("Resultados del Recinto:")}
                      </label>
                      {cabinetData?.valid ? (
                        (() => {
                          let vMid = 3.0;
                          if (useCustomMidVol) {
                            vMid = Number(customMidVol) > 0 ? Number(customMidVol) : 3.0;
                          } else {
                            if (midQts > 0 && midQts < midTargetQtc && midVas > 0) {
                              vMid = midVas / (Math.pow(midTargetQtc / midQts, 2) - 1);
                            }
                          }
                          const wI = cabinetData.wInt;
                          const dI = cabinetData.dMid ?? 15;
                          const hM = cabinetData.hMid ?? 20;
                          
                          const qtcReal = (midQts > 0 && midVas > 0 && vMid > 0) ? midQts * Math.sqrt(midVas / vMid + 1) : null;
                          const fcReal = (midFs > 0 && midVas > 0 && vMid > 0) ? midFs * Math.sqrt(midVas / vMid + 1) : null;

                          return (
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-main)', lineHeight: '1.25' }}>
                              <div><strong>{t("Volumen:")}</strong> {vMid.toFixed(1)} L</div>
                              <div style={{ marginTop: '0.15rem' }}><strong>{t("Dimensiones Internas:")}</strong> {convertTo(hM, 'length', unitSystem).toFixed(1)} x {convertTo(wI, 'length', unitSystem).toFixed(1)} x {convertTo(dI, 'length', unitSystem).toFixed(1)} {getUnitLabel('length', unitSystem)}</div>
                              {qtcReal && qtcReal > 0 && (
                                <div style={{ marginTop: '0.15rem' }}>
                                  <strong>Qtc:</strong> {qtcReal.toFixed(3)} {fcReal && fcReal > 0 ? `| <strong>Fc:</strong> ${fcReal.toFixed(0)} Hz` : ''}
                                </div>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {t("Ingresa dimensiones válidas en la cabina para ver las medidas del recinto.")}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: '1.3', padding: '0.25rem 0' }}>
                    {t("El medio es de campana sellada o blindada. No requiere volumen de aire ni división interna dentro de la caja principal.")}
                  </div>
                )}
              </div>
            )}

            {/* Si es Caja Sellada: Ajuste de Vb y Qtc Objetivo */}
            {boxType === 'sealed' && (
              <div className="premium-form-card" style={{ marginBottom: '0.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <div className="form-subsection-title" style={{ margin: 0 }}>{t("Alineación Sellada (Vb / Qtc)")}</div>
                  {customPorted && (
                    <button
                      type="button"
                      onClick={() => setCustomPorted(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-main)',
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
                        value={Number(convertTo(sealedData.valid ? sealedData.Vb : customVb, 'volume', unitSystem).toFixed(2))}
                        onChange={(e) => {
                          const valLitres = convertFrom(parseFloat(e.target.value) || 0, 'volume', unitSystem);
                          setCustomVb(valLitres);
                          setCustomPorted(true);
                        }}
                        disabled={isLinkedToCabinet}
                        step="0.1"
                      />
                      <span className="unit-badge">{getUnitLabel('volume', unitSystem)}</span>
                    </div>
                  </div>
                  <div className="input-group">
                    <label>{t("Q del Sistema (Qtc)")}</label>
                    <div className="input-wrapper">
                      <input
                        type="number"
                        value={targetQtc}
                        onChange={(e) => setTargetQtc(parseFloat(e.target.value) || 0.707)}
                        step="0.01"
                      />
                      <span className="unit-badge">Qtc</span>
                    </div>
                  </div>
                </div>

                {/* Desired F3 (BassBox Pro) */}
                <div style={{ marginTop: '0.55rem', paddingTop: '0.45rem', borderTop: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {t("F3 Deseada (Hz)")}:
                    </span>
                    <input
                      type="number"
                      value={desiredF3Sealed}
                      onChange={(e) => setDesiredF3Sealed(e.target.value)}
                      step="1"
                      min="15"
                      max="500"
                      style={{ width: '68px', padding: '0.2rem 0.35rem', fontSize: '0.72rem' }}
                    />
                    <button
                      type="button"
                      onClick={handleApplyDesiredF3Sealed}
                      disabled={isLinkedToCabinet}
                      className="preset-select"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.66rem', fontWeight: 600, cursor: isLinkedToCabinet ? 'not-allowed' : 'pointer' }}
                    >
                      {t("Calcular Vb")}
                    </button>
                  </div>
                  {desiredF3SealedMsg && (
                    <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: '0.22rem' }}>
                      {desiredF3SealedMsg}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Distribución en Bafle Frontal (Ubicación de Altavoces) */}
            <div className="premium-form-card" style={{ marginTop: '0.5rem' }}>
              <div className="form-subsection-title" style={{ marginTop: 0, marginBottom: '0.35rem' }}>{t("Distribución en Bafle Frontal")}</div>
              
              <div className="input-group" style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                  <span>{t("Posición Vertical Woofer")}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{speakerYPct}%</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="range"
                    min="15"
                    max="90"
                    value={speakerYPct}
                    onChange={(e) => setSpeakerYPct(parseInt(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {crossoverWays >= 2 && (
                <div className="input-group" style={{ marginBottom: '0.5rem' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                    <span>{t("Posición Vertical Tweeter")}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{tweeterYPct}%</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      value={tweeterYPct}
                      onChange={(e) => setTweeterYPct(parseInt(e.target.value))}
                      style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              )}

              {crossoverWays === 3 && (
                <div className="input-group" style={{ marginBottom: '0.5rem' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                    <span>{t("Posición Vertical Medio")}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{midrangeYPct}%</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="range"
                      min="15"
                      max="80"
                      value={midrangeYPct}
                      onChange={(e) => setMidrangeYPct(parseInt(e.target.value))}
                      style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* PESTAÑA B: PUERTO / SINTONIZACIÓN BASS REFLEX & PASO BANDA */}
        {activeTab === 'port' && (
          <>
            {/* Dimensionamiento y alineación acústica del cajón ventilado */}
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
                      color: 'var(--text-main)',
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

              {boxType === 'ported' && setVentedAlignment && (
                <div style={{ marginBottom: '0.75rem', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                      {t("Alineación Acústica")}
                    </label>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-main)', fontWeight: 600 }}>
                      {ventedAlignment === 'QB3'
                        ? 'High Output (QB3)'
                        : ventedAlignment === 'B4'
                          ? 'High Fidelity (B4)'
                          : ventedAlignment === 'SBB4'
                            ? 'Extended Bass (EBS)'
                            : ventedAlignment === 'B6'
                              ? '6.º Orden HP Activo (B6)'
                              : t("Compacto (Práctico)")}
                    </span>
                  </div>
                  <div className="segmented-control" style={{ padding: '2px', display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '2px' }}>
                    <button
                      type="button"
                      className={ventedAlignment === 'QB3' ? 'active' : ''}
                      onClick={() => {
                        setVentedAlignment('QB3');
                        setCustomPorted(false);
                        setUseCustomPortLength(false);
                      }}
                      style={{ padding: '0.26rem 0.12rem', fontSize: '0.62rem', textAlign: 'center', minWidth: 0 }}
                      title={t("High Output (BassBox): menor excursión y caja compacta (Qtc ~0.8)")}
                    >
                      QB3
                    </button>
                    <button
                      type="button"
                      className={ventedAlignment === 'B4' ? 'active' : ''}
                      onClick={() => {
                        setVentedAlignment('B4');
                        setCustomPorted(false);
                        setUseCustomPortLength(false);
                      }}
                      style={{ padding: '0.26rem 0.12rem', fontSize: '0.62rem', textAlign: 'center', minWidth: 0 }}
                      title={t("High Fidelity (Keele/BassBox): respuesta máximamente plana")}
                    >
                      Hi-Fi B4
                    </button>
                    <button
                      type="button"
                      className={ventedAlignment === 'SBB4' ? 'active' : ''}
                      onClick={() => {
                        setVentedAlignment('SBB4');
                        setCustomPorted(false);
                        setUseCustomPortLength(false);
                      }}
                      style={{ padding: '0.26rem 0.12rem', fontSize: '0.62rem', textAlign: 'center', minWidth: 0 }}
                      title={t("Extended Bass (EBS BassBox): 12.3·Vas·Qts^2.4")}
                    >
                      Ext. Bass
                    </button>
                    <button
                      type="button"
                      className={ventedAlignment === 'B6' ? 'active' : ''}
                      onClick={() => {
                        setVentedAlignment('B6');
                        setCustomPorted(false);
                        setUseCustomPortLength(false);
                      }}
                      style={{ padding: '0.26rem 0.12rem', fontSize: '0.62rem', textAlign: 'center', minWidth: 0 }}
                      title={t("Ventilada 6.º orden con filtro paso-alto activo (Fx=1.07·Fb, Qx=1.93)")}
                    >
                      B6 (HP)
                    </button>
                    <button
                      type="button"
                      className={ventedAlignment === 'COMPACT' ? 'active' : ''}
                      onClick={() => {
                        setVentedAlignment('COMPACT');
                        setCustomPorted(false);
                        setUseCustomPortLength(false);
                      }}
                      style={{ padding: '0.26rem 0.12rem', fontSize: '0.62rem', textAlign: 'center', minWidth: 0 }}
                      title={t("Modo compacto práctico para Qts alto (>0.45)")}
                    >
                      {t("Compacto")}
                    </button>
                  </div>
                  {portedData.activeHpEnabled && portedData.hpFx && portedData.hpQx && (
                    <div style={{ marginTop: '0.32rem', padding: '0.22rem 0.4rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '0.63rem', color: '#34d399', fontWeight: 600 }}>
                      HPF 2.º orden: Fx = {portedData.hpFx.toFixed(1)} Hz · Qx = {portedData.hpQx.toFixed(2)}
                    </div>
                  )}
                  {portedData.clampedToMinVol && (
                    <div style={{ marginTop: '0.28rem', fontSize: '0.62rem', color: '#fbbf24' }}>
                      {t("Vb ajustado al volumen mínimo físico del altavoz (Fb compensada con exponente 0.125).")}
                    </div>
                  )}
                  {params.fs && params.qts && (
                    <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>
                        {t("Sugerida")}: <strong style={{ color: 'var(--text-main)' }}>
                          {recommendedAlignment === 'B4' ? 'Hi-Fi (B4)' : recommendedAlignment === 'COMPACT' ? t("Compacto") : recommendedAlignment}
                        </strong> (Qts: {params.qts.toFixed(2)})
                      </span>
                      {recommendedFbForDriver > 0 && (
                        <span>
                          Fb óptima: <strong style={{ color: 'var(--text-main)' }}>{recommendedFbForDriver.toFixed(1)} Hz</strong>
                        </span>
                      )}
                    </div>
                  )}
                  {setExternalSubwoofer && (
                    <div style={{ marginTop: '0.45rem', paddingTop: '0.4rem', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <label
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', margin: 0 }}
                        title={t("Optimiza Fb para trabajar como satélite/top apoyado por un subwoofer externo (corte típico 80–100 Hz)")}
                      >
                        <input
                          type="checkbox"
                          checked={externalSubwoofer}
                          onChange={(e) => setExternalSubwoofer(e.target.checked)}
                          style={{ accentColor: '#10b981', cursor: 'pointer' }}
                        />
                        <span>{t("Refuerzo con Subwoofer Externo")}</span>
                      </label>
                      {externalSubwoofer && (
                        <span style={{ fontSize: '0.62rem', color: '#10b981', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          Satélite · HPF 80–100 Hz
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="input-grid" style={{ alignItems: 'flex-start' }}>
                <div className="input-group">
                  <label style={{ height: '1.2rem', display: 'flex', alignItems: 'center', margin: 0 }}>
                    {t("Volumen Neto (Vb)")}
                  </label>
                  <div className="input-wrapper">
                    <input
                      type="number"
                      value={Number(convertTo(boxType === 'ported' ? (portedData.valid ? portedData.Vb : customVb) : (bandpassData.valid ? (bandpassData.Vf + bandpassData.Vr) : customVb), 'volume', unitSystem).toFixed(2))}
                      onChange={(e) => {
                        const valLitres = convertFrom(parseFloat(e.target.value) || 0, 'volume', unitSystem);
                        setCustomVb(valLitres);
                        setCustomPorted(true);
                      }}
                      disabled={isLinkedToCabinet}
                      step="0.1"
                    />
                    <span className="unit-badge">{getUnitLabel('volume', unitSystem)}</span>
                  </div>
                </div>

                <div className="input-group">
                  <label style={{ height: '1.2rem', display: 'flex', alignItems: 'center', margin: 0 }}>
                    {boxType === 'bandpass' ? t("Sintonía Frontal (Fb)") : t("Sintonía (Fb)")}
                  </label>
                  <div className="input-wrapper">
                    <input
                      type="number"
                      value={Number((boxType === 'ported' ? (portedData.valid ? portedData.Fb : customFb) : (bandpassData.valid ? bandpassData.Fb : customFb)).toFixed(1))}
                      onChange={(e) => {
                        setCustomFb(parseFloat(e.target.value) || 0);
                        setCustomPorted(true);
                      }}
                      step="0.1"
                    />
                    <span className="unit-badge">Hz</span>
                  </div>
                </div>
              </div>

              {recommendedFbForDriver > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.35rem', fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                  <span>
                    {externalSubwoofer
                      ? `Óptima c/ Subwoofer: ${recommendedFbForDriver.toFixed(1)} Hz (control de excursión)`
                      : ventedAlignment === 'B4'
                        ? `Sugerida B4: ${recommendedFbForDriver.toFixed(1)} Hz (plana Hi-Fi)`
                        : ventedAlignment === 'QB3'
                          ? `Sugerida QB3: ${recommendedFbForDriver.toFixed(1)} Hz (alta salida)`
                          : ventedAlignment === 'SBB4'
                            ? `Sugerida EBS: ${recommendedFbForDriver.toFixed(1)} Hz (extensión subgraves)`
                            : ventedAlignment === 'B6'
                              ? `Sugerida B6: ${recommendedFbForDriver.toFixed(1)} Hz (HP activo 6.º orden)`
                              : `Sugerida Compacta: ${recommendedFbForDriver.toFixed(1)} Hz`
                    }
                  </span>
                  <button
                    type="button"
                    onClick={handleApplyOptimalFb}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--card-border)',
                      color: 'var(--text-main)',
                      borderRadius: '3px',
                      padding: '0.15rem 0.45rem',
                      fontSize: '0.64rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                    title={`Ajustar a la sintonía óptima recomendada para la alineación ${ventedAlignment || 'B4'} (${recommendedFbForDriver.toFixed(1)} Hz)`}
                  >
                    {t("Aplicar")} {recommendedFbForDriver.toFixed(1)} Hz
                  </button>
                </div>
              )}

              {boxType === 'ported' && (
                <div style={{ marginTop: '0.5rem', paddingTop: '0.45rem', borderTop: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {t("F3 Deseada (Hz)")}:
                    </span>
                    <input
                      type="number"
                      value={desiredF3Vented}
                      onChange={(e) => setDesiredF3Vented(e.target.value)}
                      step="1"
                      min="12"
                      max="500"
                      style={{ width: '68px', padding: '0.2rem 0.35rem', fontSize: '0.72rem' }}
                    />
                    <button
                      type="button"
                      onClick={handleApplyDesiredF3Vented}
                      disabled={isLinkedToCabinet}
                      className="preset-select"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.66rem', fontWeight: 600, cursor: isLinkedToCabinet ? 'not-allowed' : 'pointer' }}
                    >
                      {t("Calcular Vb/Fb")}
                    </button>
                  </div>
                  {desiredF3VentedMsg && (
                    <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: '0.22rem' }}>
                      {desiredF3VentedMsg}
                    </div>
                  )}
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
                      <option value={6}>{t("6.º Orden (BassBox)")}</option>
                    </select>
                  </div>
                  {bandpassOrder === 4 ? (
                    <>
                      <div className="input-group">
                        <label title={t("Factor de amortiguamiento del sistema (BassBox defecto 0.65)")}>
                          {t("Factor DF (BassBox)")}
                        </label>
                        <div className="input-wrapper">
                          <input
                            type="number"
                            value={bandpassDf}
                            onChange={(e) => setBandpassDf?.(parseFloat(e.target.value) || 0.65)}
                            step="0.05"
                            min="0.2"
                            max="2.0"
                          />
                        </div>
                      </div>
                      <div className="input-group" style={{ gridColumn: 'span 2' }}>
                        <label title={t("Q't del sistema (0 = automático max(0.8, Qts + 0.1))")}>
                          {t("Q't del Sistema (0 = auto)")} · {t("Efectivo")}: {(bandpassData.qtPrime ?? Math.max(0.8, (params.qts || 0.36) + 0.1)).toFixed(2)}
                        </label>
                        <div className="input-wrapper">
                          <input
                            type="number"
                            value={bandpassQtPrime}
                            onChange={(e) => setBandpassQtPrime?.(Math.max(0, parseFloat(e.target.value) || 0))}
                            step="0.05"
                            min="0"
                            max="2.5"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="input-group">
                      <label>{t("Topología 6.º Orden")}</label>
                      <select
                        value={bandpassTopology}
                        onChange={(e) => setBandpassTopology?.(e.target.value as Bandpass6Topology)}
                        className="input-select"
                        style={{ width: '100%', height: '34px' }}
                      >
                        <option value="parallel">{t("6.º Orden (Paralelo)")}</option>
                        <option value="series">{t("6.º Orden (Serie)")}</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            {boxType === 'ported' && (
              <div className="premium-form-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <div className="form-subsection-title" style={{ margin: 0 }}>{t("Configuración del Puerto")}</div>
                  {prTuning === 'port' && (
                    <button
                      type="button"
                      onClick={handleApplyOptimalPort}
                      style={{
                        background: 'var(--accent)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '0.22rem 0.55rem',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        borderRadius: '4px',
                      }}
                      title={t("Calcula cantidad y diámetro de puerto para flujo silencioso (< 10 m/s) que quepa en la profundidad de la caja")}
                    >
                      {t("Puerto Óptimo (Sin Soplido)")}
                    </button>
                  )}
                </div>
                <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                  <label>{t("Sintonización mediante")}</label>
                  <div className="segmented-control" style={{ padding: '2px', borderRadius: '0px' }}>
                    <button
                      type="button"
                      className={prTuning === 'port' ? 'active' : ''}
                      onClick={() => setPrTuning('port')}
                      style={{ padding: '0.35rem 0.25rem', fontSize: '0.72rem', borderRadius: '0px' }}
                    >
                      {t("Puerto de Aire")}
                    </button>
                    <button
                      type="button"
                      className={prTuning === 'radiator' ? 'active' : ''}
                      onClick={() => setPrTuning('radiator')}
                      style={{ padding: '0.35rem 0.25rem', fontSize: '0.72rem', borderRadius: '0px' }}
                    >
                      {t("Radiador Pasivo")}
                    </button>
                  </div>
                </div>

                {prTuning === 'port' ? (
                  <>
                    <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                      <label>{t("Forma del Puerto")}</label>
                      <div className="segmented-control" style={{ padding: '2px', borderRadius: '0px' }}>
                        <button
                          type="button"
                          className={portShape === 'round' ? 'active' : ''}
                          onClick={() => setPortShape('round')}
                          style={{ padding: '0.35rem 0.25rem', fontSize: '0.72rem', borderRadius: '0px' }}
                        >
                          {t("Redondo")}
                        </button>
                        <button
                          type="button"
                          className={portShape === 'rectangular' ? 'active' : ''}
                          onClick={() => setPortShape('rectangular')}
                          style={{ padding: '0.35rem 0.25rem', fontSize: '0.72rem', borderRadius: '0px' }}
                        >
                          {t("Rectangular")}
                        </button>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.67rem', marginBottom: '0.45rem', padding: '0.3rem 0.5rem', borderRadius: '0px', background: 'var(--bg-main)', border: '1px solid var(--card-border)', borderLeft: `3px solid ${!useCustomPortLength ? '#10b981' : '#f59e0b'}` }}>
                      {!useCustomPortLength ? (
                        <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>
                          {t("Sintonía bloqueada en")} {(portedData.valid ? portedData.Fb : customFb).toFixed(1)} Hz — {t("La longitud se recalcula al modificar decimales de diámetro o cantidad.")}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>
                          {t("Longitud personalizada activa — La sintonía (Fb) cambia según la medida del tubo.")}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: portShape === 'rectangular' ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: '0.45rem', marginBottom: '0.5rem' }}>
                      <div className="input-group">
                        <label>{t("Cantidad")}</label>
                        <div className="input-wrapper">
                          <input
                            type="number"
                            value={portCount}
                            onChange={(e) => handlePortCountChange(e.target.value)}
                            min={1}
                            max={6}
                            step="1"
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
                                value={displayVal(portDiameter, 'length')}
                                onChange={(e) => handleInputChange(e.target.value, setPortDiameter, 'length')}
                                step="0.1"
                                min={0.01}
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
                                  step="0.1"
                                  placeholder="Auto"
                                />
                                <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                              </div>
                            ) : (
                              <div className="input-wrapper">
                                <input type="text" value={portLength} disabled style={{ background: 'rgba(255,255,255,0.03)', fontWeight: 600, color: 'var(--text-main)' }} />
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
                                  value={displayVal(portWidth, 'length')}
                                  onChange={(e) => handleInputChange(e.target.value, setPortWidth, 'length')}
                                  step="0.1"
                                  min={0.01}
                              />
                              <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                            </div>
                          </div>
                          <div className="input-group">
                            <label>{t("Alto")}</label>
                            <div className="input-wrapper">
                              <input
                                  type="number"
                                  value={displayVal(portHeight, 'length')}
                                  onChange={(e) => handleInputChange(e.target.value, setPortHeight, 'length')}
                                  step="0.1"
                                  min={0.01}
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
                                  step="0.1"
                                  placeholder="Auto"
                                />
                                <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                              </div>
                            ) : (
                              <div className="input-wrapper">
                                <input type="text" value={portLength} disabled style={{ background: 'rgba(255,255,255,0.03)', fontWeight: 600, color: 'var(--text-main)' }} />
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

                    {/* Corrección de Extremos de Conducto */}
                    <div className="input-group" style={{ marginBottom: '0.65rem' }}>
                      <label>{t("Corrección de Extremos")}</label>
                      <div className="port-ends-grid">
                        <button
                          type="button"
                          className={`port-end-opt ${flaredEnds === 0 ? 'active' : ''}`}
                          onClick={() => setFlaredEnds(0)}
                        >
                          <div className="port-end-opt-title">
                            <span>{t("Recto / Estándar")}</span>
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-main)' }}>k = 0.732</span>
                          </div>
                          <span className="port-end-opt-desc">{t("1 extremo a ras")}</span>
                        </button>
                        <button
                          type="button"
                          className={`port-end-opt ${flaredEnds === 1 ? 'active' : ''}`}
                          onClick={() => setFlaredEnds(1)}
                        >
                          <div className="port-end-opt-title">
                            <span>{t("Dos a Ras")}</span>
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-main)' }}>k = 0.850</span>
                          </div>
                          <span className="port-end-opt-desc">{t("Ambos adosados")}</span>
                        </button>
                        <div
                          role="group"
                          aria-label={t("Abocinado (Aeroport / Flared)")}
                          className={`port-end-opt ${flaredEnds === 2 || flaredEnds === 3 ? 'active' : ''}`}
                          onClick={() => {
                            if (flaredEnds !== 2 && flaredEnds !== 3) {
                              setFlaredEnds(2);
                            }
                          }}
                          style={{ gridColumn: 'span 2', cursor: 'pointer' }}
                        >
                          <div className="port-end-opt-title">
                            <span>{t("Abocinado (Aeroport / Flared)")}</span>
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-main)' }}>
                              {flaredEnds === 3 ? 'k = 0.850' : flaredEnds === 2 ? 'k = 0.968' : 'k = 0.850 / 0.968'}
                            </span>
                          </div>
                          <span className="port-end-opt-desc">{t("Extremos redondeados con perfil cónico anti-turbulencias")}</span>
                          <div
                            className="segmented-control segmented-control-mini"
                            style={{ marginTop: '0.4rem', width: '100%' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className={flaredEnds === 3 ? 'active' : ''}
                              onClick={() => setFlaredEnds(3)}
                              style={{ fontSize: '0.66rem', padding: '0.22rem 0.35rem' }}
                            >
                              {t("1 Extremo")} (k = 0.850)
                            </button>
                            <button
                              type="button"
                              className={flaredEnds === 2 ? 'active' : ''}
                              onClick={() => setFlaredEnds(2)}
                              style={{ fontSize: '0.66rem', padding: '0.22rem 0.35rem' }}
                            >
                              {t("2 Extremos")} (k = 0.968)
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Alerta de Velocidad y Chuffing */}
                    <div className={`chuffing-badge ${vPeak !== null ? (vPeak < silentAirLimit ? 'quiet' : vPeak <= 17 ? 'moderate' : 'critical') : 'quiet'}`}>
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background: vPeak !== null ? (vPeak < silentAirLimit ? '#34d399' : vPeak <= 17 ? '#fbbf24' : '#f87171') : 'var(--text-muted)',
                          boxShadow: vPeak !== null ? `0 0 6px ${vPeak < silentAirLimit ? '#34d399' : vPeak <= 17 ? '#fbbf24' : '#f87171'}` : 'none',
                          display: 'inline-block',
                          flexShrink: 0
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontWeight: 700, letterSpacing: '0.02em' }}>
                            {vPeak !== null 
                              ? (vPeak < silentAirLimit 
                                  ? `${t("Flujo silencioso")}: ${vPeak.toFixed(1)} m/s` 
                                  : vPeak <= 17 
                                    ? `${t("Velocidad moderada")}: ${vPeak.toFixed(1)} m/s` 
                                    : `${t("¡Turbulencia Crítica (Chuffing)!")}: ${vPeak.toFixed(1)} m/s`)
                              : t("Ingresa Sd y Xmax para calcular velocidad")
                            }
                          </span>
                          {vPeak !== null && vPeak >= silentAirLimit && (
                            <button
                              type="button"
                              onClick={handleApplyOptimalPort}
                              style={{
                                background: 'var(--accent)',
                                color: '#fff',
                                border: 'none',
                                padding: '0.15rem 0.45rem',
                                fontSize: '0.64rem',
                                fontWeight: 700,
                                borderRadius: '3px',
                                cursor: 'pointer',
                                flexShrink: 0,
                              }}
                            >
                              {t("Corregir Soplido")}
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: '0.64rem', opacity: 0.85 }}>
                          {vPeak !== null 
                            ? (vPeak < silentAirLimit 
                                ? t("Sin soplidos ni ruidos de aire audibles.") 
                                : vPeak <= 17 
                                  ? t("Aceptable. Se recomienda usar extremos abocinados.") 
                                  : t("Aumenta el diámetro del conducto para evitar distorsión por viento."))
                            : t("Permite modelar el comportamiento aerodinámico del puerto.")
                          }
                        </div>
                      </div>
                    </div>

                    {portPhysicalDiagnostics && (
                      <div
                        style={{
                          marginTop: '0.4rem',
                          padding: '0.35rem 0.5rem',
                          background: 'rgba(255,255,255,0.02)',
                          border: `1px solid ${portPhysicalDiagnostics.hasClearanceWarning ? 'rgba(248, 113, 113, 0.45)' : portPhysicalDiagnostics.hasPipeWarning ? 'rgba(251, 191, 36, 0.45)' : 'var(--card-border)'}`,
                          borderRadius: '4px',
                          fontSize: '0.64rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.18rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                          <span>{t("Resonancia de tubo")}:</span>
                          <strong style={{ color: portPhysicalDiagnostics.hasPipeWarning ? '#fbbf24' : 'var(--text-main)' }}>
                            ~{Math.round(portPhysicalDiagnostics.pipeResonanceHz)} Hz
                            {portPhysicalDiagnostics.hasPipeWarning ? ` (${t("Baja: riesgo en medios-bajos")})` : ''}
                          </strong>
                        </div>
                        {portPhysicalDiagnostics.clearanceCm !== null && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                            <span>{t("Despeje pared trasera")} (min 1×Dv):</span>
                            <strong style={{ color: portPhysicalDiagnostics.hasClearanceWarning ? '#f87171' : '#34d399' }}>
                              {convertTo(portPhysicalDiagnostics.clearanceCm, 'length', unitSystem).toFixed(1)} {getUnitLabel('length', unitSystem)}
                              {portPhysicalDiagnostics.hasClearanceWarning
                                ? ` (< ${convertTo(portPhysicalDiagnostics.minClearanceCm, 'length', unitSystem).toFixed(1)} ${getUnitLabel('length', unitSystem)})`
                                : ' (OK)'}
                            </strong>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sugerencias Comerciales de Puerto */}
                    {suggestions && 'options' in suggestions && suggestions.options && suggestions.options.length > 0 && (
                      <div style={{ marginTop: '0.65rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--card-border)', borderRadius: '6px', padding: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                            {t("SUGERENCIAS DE PUERTOS (ANTI-SOPLIDO)")}:
                          </span>
                          <span style={{ fontSize: '0.64rem', color: 'var(--text-main)', fontWeight: 600 }}>
                            Fb: {targetOptimalFb.toFixed(1)} Hz
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          {suggestions.options.map((s, idx: number) => {
                            const displayOptDia = convertTo(s.diameter, 'length', unitSystem);
                            const displayOptLen = convertTo(s.length, 'length', unitSystem);
                            const unitLabel = getUnitLabel('length', unitSystem);
                            const optVel = s.vPeak ?? ((params.sd && params.xmax && portedData.Fb > 0)
                              ? (0.008 * portedData.Fb * params.sd * params.xmax) / (s.numPorts * s.diameter * s.diameter)
                              : null);
                            const fitsDepth = !cabinetData?.valid || s.length <= (cabinetData.dInt - Math.max(s.diameter, 2.5));
                            return (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', gap: '0.35rem' }}>
                                <span>
                                  <strong>{s.numPorts}x Ø {displayOptDia.toFixed(1)} {unitLabel}</strong> (L: {displayOptLen.toFixed(1)} {unitLabel})
                                  {optVel !== null && (
                                    <span style={{ marginLeft: '0.35rem', fontSize: '0.65rem', color: optVel < 10 ? '#34d399' : optVel <= 17 ? '#fbbf24' : '#f87171', fontWeight: 600 }}>
                                      • {optVel.toFixed(1)} m/s
                                    </span>
                                  )}
                                  {s.areaRatio !== undefined && (
                                    <span style={{ marginLeft: '0.25rem', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                                      ({s.areaRatio}% Sd)
                                    </span>
                                  )}
                                  {!fitsDepth && (
                                    <span style={{ marginLeft: '0.3rem', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                                      ({t("Excede prof.")})
                                    </span>
                                  )}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleApplyPort(s.numPorts, s.diameter)}
                                  className="preset-select"
                                  style={{ padding: '0.15rem 0.45rem', fontSize: '0.68rem', cursor: 'pointer', flexShrink: 0 }}
                                >
                                  {t("Aplicar")}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Ubicación y posición del puerto en el bafle */}
                    <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '0.5rem', marginTop: '0.65rem' }}>
                      <div className="input-group" style={{ marginBottom: '0.35rem' }}>
                        <label style={{ fontSize: '0.7rem' }}>{t("Ubicación del Puerto")}</label>
                        <div className="segmented-control segmented-control-mini" style={{ width: '100%' }}>
                          <button
                            type="button"
                            className={portLocation === 'front' ? 'active' : ''}
                            onClick={() => setPortLocation('front')}
                          >
                            {t("Frente")}
                          </button>
                          <button
                            type="button"
                            className={portLocation === 'rear' ? 'active' : ''}
                            onClick={() => setPortLocation('rear')}
                          >
                            {t("Atrás")}
                          </button>
                        </div>
                      </div>

                      <div className="input-group" style={{ marginBottom: '0.75rem', paddingBottom: '0.35rem' }}>
                        <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                          <span>{t("Posición Vertical Puerto(s)")}</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{portYPct}%</span>
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                          <input
                            type="range"
                            min="15"
                            max="85"
                            value={portYPct}
                            onChange={(e) => setPortYPct(parseInt(e.target.value))}
                            className="slider-mini"
                            style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
                          />
                        </div>
                      </div>

                      {(Number(portCount) || 1) >= 2 && (
                        <div className="input-group" style={{ marginBottom: '0.75rem', paddingBottom: '0.35rem' }}>
                          <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                            <span>{t("Separación entre Puertos")}</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                              {portSpacingPct}% {computedPortSpacingCm ? `(${convertTo(computedPortSpacingCm, 'length', unitSystem).toFixed(1)} ${getUnitLabel('length', unitSystem)})` : ''}
                            </span>
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={portSpacingPct}
                              onChange={(e) => setPortSpacingPct && setPortSpacingPct(parseInt(e.target.value))}
                              className="slider-mini"
                              style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  // Radiador Pasivo
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={handleSuggestPassiveRadiator}
                        className="preset-select"
                        style={{ padding: '0.24rem 0.55rem', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}
                        title={t("Sugiere diámetro comercial (6\"–48\") y parámetros iniciales según BassBox Pro")}
                      >
                        {t("Sugerir PR Óptimo")}
                      </button>
                    </div>
                    <div className="input-grid">
                      <div className="input-group">
                        <label>{t("Diámetro PR")}</label>
                        <div className="input-wrapper">
                          <input
                            type="number"
                            value={displayVal(prDia, 'length')}
                            onChange={(e) => handleInputChange(e.target.value, (v) => setPrDia(typeof v === 'number' ? v : 0), 'length')}
                            step="0.1"
                          />
                          <span className="unit-badge">{getUnitLabel('length', unitSystem)}</span>
                        </div>
                      </div>
                      <div className="input-group">
                        <label>{t("Vas PR")}</label>
                        <div className="input-wrapper">
                          <input
                            type="number"
                            value={displayVal(prVas, 'volume')}
                            onChange={(e) => handleInputChange(e.target.value, (v) => setPrVas(typeof v === 'number' ? v : 0), 'volume')}
                            step="0.1"
                          />
                          <span className="unit-badge">{getUnitLabel('volume', unitSystem)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="input-grid">
                      <div className="input-group">
                        <label>{t("Fs PR")}</label>
                        <div className="input-wrapper">
                          <input type="number" value={prFs} onChange={(e) => setPrFs(parseFloat(e.target.value) || 0)} step="0.1" />
                          <span className="unit-badge">Hz</span>
                        </div>
                      </div>
                      <div className="input-group">
                        <label>{t("Mms PR (g)")}</label>
                        <div className="input-wrapper">
                          <input type="number" value={prMms} onChange={(e) => setPrMms(parseFloat(e.target.value) || 0)} step="0.1" />
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
            {setClassicalModel && (
              <div style={{ marginTop: '0.35rem', paddingTop: '0.6rem', borderTop: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  {t("Modelo de Cálculo por Relleno:")}
                </span>
                <div className="segmented-control" style={{ padding: '2px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
                  <button
                    type="button"
                    className={!classicalModel ? 'active' : ''}
                    onClick={() => setClassicalModel(false)}
                    style={{ padding: '0.32rem 0.25rem', fontSize: '0.7rem' }}
                    title={t("Ajusta el volumen físico efectivo considerando expansión térmica del relleno")}
                  >
                    {t("Modelo BassBox (con relleno)")}
                  </button>
                  <button
                    type="button"
                    className={classicalModel ? 'active' : ''}
                    onClick={() => setClassicalModel(true)}
                    style={{ padding: '0.32rem 0.25rem', fontSize: '0.7rem' }}
                    title={t("Ignora expansión virtual del relleno (ecuaciones Thiele-Small clásicas)")}
                  >
                    {t("Modelo Clásico (sin ajuste)")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA C: CROSSOVER / DIVISORES DE FRECUENCIA */}
        {activeTab === 'crossover' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="premium-form-card">
              <div className="form-subsection-title" style={{ marginTop: 0 }}>{t("Configuración del Divisor")}</div>
              <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                <label>{t("Vías")}</label>
                <div className="segmented-control" style={{ padding: '2px', borderRadius: '0px' }}>
                  <button
                    type="button"
                    className={crossoverWays === 2 ? 'active' : ''}
                    onClick={() => setCrossoverWays(2)}
                    style={{ padding: '0.35rem 0.25rem', fontSize: '0.72rem', borderRadius: '0px' }}
                  >
                    {t("2 Vías")}
                  </button>
                  <button
                    type="button"
                    className={crossoverWays === 3 ? 'active' : ''}
                    onClick={() => setCrossoverWays(3)}
                    style={{ padding: '0.35rem 0.25rem', fontSize: '0.72rem', borderRadius: '0px' }}
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

            {/* Auto-Optimización MNA (Nelder-Mead en Rust) */}
            <div className="premium-form-card" style={{ borderTop: '1px solid var(--card-border)', paddingTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <div className="form-subsection-title" style={{ margin: 0 }}>
                  {t("Auto-Optimización de Crossover (Solver MNA)")}
                </div>
                <span style={{ fontSize: '0.62rem', border: '1px solid var(--card-border)', background: 'rgba(255, 255, 255, 0.03)', color: 'var(--text-muted)', padding: '1px 5px', fontWeight: 500, letterSpacing: '0.3px' }}>
                  NELDER-MEAD SIMPLEX
                </span>
              </div>

              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.6rem', lineHeight: '1.35' }}>
                {t("Resuelve la matriz nodal compleja MNA para compensar la inductancia Le del woofer y minimizar el error RMS respecto al corte objetivo.")}
              </div>

              <div className="input-grid" style={{ marginBottom: '0.65rem' }}>
                <div className="input-group">
                  <label>{t("Fc Objetivo")} (Hz)</label>
                  <div className="input-wrapper">
                    <input
                      type="number"
                      value={fc}
                      onChange={(e) => setFc(Math.max(20, parseFloat(e.target.value) || 2500))}
                      step="50"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>{t("Re Woofer")} (Ω)</label>
                  <div className="input-wrapper">
                    <input
                      type="number"
                      value={(params.re && params.re > 0) ? params.re : (zWoofer * 0.8)}
                      readOnly
                      title="Tomado automáticamente de los parámetros Thiele-Small del altavoz"
                      style={{ opacity: 0.85, fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>{t("Le Woofer")} (mH)</label>
                  <div className="input-wrapper">
                    <input
                      type="number"
                      value={(params.le && params.le > 0) ? params.le : 0.8}
                      readOnly
                      title="Tomado automáticamente de los parámetros Thiele-Small del altavoz"
                      style={{ opacity: 0.85, fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>{t("DCR Bobina")} (Ω)</label>
                  <div className="input-wrapper">
                    <input
                      type="number"
                      value={optDcr}
                      onChange={(e) => setOptDcr(Math.max(0, parseFloat(e.target.value) || 0.3))}
                      step="0.05"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunOptimizer}
                disabled={isOptimizing}
                style={{
                  width: '100%',
                  height: '30px',
                  background: 'var(--primary)',
                  color: '#090d16',
                  border: '1px solid var(--primary)',
                  borderRadius: '0px',
                  fontWeight: 600,
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'none',
                  transition: 'background 0.15s ease'
                }}
              >
                {isOptimizing ? t("Optimizando...") : t("Optimizar Simplex")}
              </button>

              {optResult && (
                <div style={{ marginTop: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', padding: '0.55rem 0.75rem', border: '1px solid var(--card-border)', borderRadius: '0px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', fontSize: '0.72rem', marginBottom: '0.5rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.64rem', textTransform: 'uppercase' }}>{t("L Óptimo")}</span>
                      <strong style={{ color: 'var(--text-main)', fontSize: '0.92rem', fontFamily: 'var(--font-mono)' }}>{optResult.lOptMh.toFixed(3)} mH</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.64rem', textTransform: 'uppercase' }}>{t("C Óptimo")}</span>
                      <strong style={{ color: 'var(--text-main)', fontSize: '0.92rem', fontFamily: 'var(--font-mono)' }}>{optResult.cOptUf.toFixed(2)} µF</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.64rem', textTransform: 'uppercase' }}>{t("Error RMS")}</span>
                      <strong style={{ color: optResult.rmsErrorDb < 4 ? 'var(--success)' : 'var(--warning)', fontSize: '0.88rem', fontFamily: 'var(--font-mono)' }}>{optResult.rmsErrorDb.toFixed(2)} dB</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.64rem', textTransform: 'uppercase' }}>{t("Iteraciones")}</span>
                      <strong style={{ color: 'var(--text-muted)', fontSize: '0.88rem', fontFamily: 'var(--font-mono)' }}>{optResult.iterations}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setWhLTarget(Number(optResult.lOptMh.toFixed(3)));
                      setWhCalcMode('turns');
                    }}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: '1px solid var(--card-border)',
                      color: 'var(--text-secondary)',
                      padding: '4px 8px',
                      borderRadius: '0px',
                      fontSize: '0.68rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease, color 0.15s ease'
                    }}
                    title={t("Copiar valor a la calculadora de bobinas de Wheeler")}
                  >
                    {t("Transferir L a Diseñador de Inductores")}
                  </button>
                </div>
              )}
            </div>

            {/* Calculadora de Inductores (Fórmula de Wheeler) */}
            <div className="premium-form-card" style={{ borderTop: '1px solid var(--card-border)', paddingTop: '0.75rem' }}>
              <div className="form-subsection-title" style={{ marginTop: 0 }}>
                {t("Diseñador de Inductores (Núcleo de Aire)")}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                {t("Calcula las vueltas y dimensiones para construir tus propias bobinas usando la fórmula de Wheeler.")}
              </div>

              {suggestedInductors.length > 0 && (
                <div className="input-group" style={{ marginBottom: '0.6rem' }}>
                  <label>{t("Cargar valor del crossover:")}</label>
                  <select
                    className="input-select"
                    style={{ width: '100%', height: '34px', fontSize: '0.75rem' }}
                    defaultValue=""
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (val > 0) {
                        setWhLTarget(val);
                        setWhCalcMode('turns');
                      }
                    }}
                  >
                    <option value="">-- {t("Seleccionar valor")} --</option>
                    {suggestedInductors.map((ind, idx) => (
                      <option key={idx} value={ind.value}>
                        {ind.label}: {ind.value.toFixed(3)} mH
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="input-group" style={{ marginBottom: '0.6rem' }}>
                <label>{t("Modo de Cálculo")}</label>
                <div className="segmented-control" style={{ padding: '2px', borderRadius: '0px' }}>
                  <button
                    type="button"
                    className={whCalcMode === 'turns' ? 'active' : ''}
                    onClick={() => setWhCalcMode('turns')}
                    style={{ padding: '0.35rem 0.25rem', fontSize: '0.72rem', borderRadius: '0px' }}
                  >
                    {t("Calcular Espiras")}
                  </button>
                  <button
                    type="button"
                    className={whCalcMode === 'inductance' ? 'active' : ''}
                    onClick={() => setWhCalcMode('inductance')}
                    style={{ padding: '0.35rem 0.25rem', fontSize: '0.72rem', borderRadius: '0px' }}
                  >
                    {t("Calcular Inductancia")}
                  </button>
                </div>
              </div>

              <div className="input-grid">
                {whCalcMode === 'turns' ? (
                  <div className="input-group">
                    <label>{t("Inductancia Obj.")} (mH)</label>
                    <div className="input-wrapper">
                      <input
                        type="number"
                        value={whLTarget}
                        onChange={(e) => setWhLTarget(Math.max(0.001, parseFloat(e.target.value) || 1.0))}
                        step="0.05"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="input-group">
                    <label>{t("Número de Espiras (N)")}</label>
                    <div className="input-wrapper">
                      <input
                        type="number"
                        value={whTurns}
                        onChange={(e) => setWhTurns(Math.max(1, parseInt(e.target.value) || 100))}
                        step="5"
                      />
                    </div>
                  </div>
                )}

                <div className="input-group">
                  <label>{t("Diámetro Medio (d)")} (mm)</label>
                  <div className="input-wrapper">
                    <input
                      type="number"
                      value={whCoilDia}
                      onChange={(e) => setWhCoilDia(Math.max(1.0, parseFloat(e.target.value) || 25.0))}
                      step="1"
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>{t("Longitud Bobina (l)")} (mm)</label>
                  <div className="input-wrapper">
                    <input
                      type="number"
                      value={whCoilLen}
                      onChange={(e) => setWhCoilLen(Math.max(1.0, parseFloat(e.target.value) || 20.0))}
                      step="1"
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>{t("Diámetro Alambre")} (mm)</label>
                  <div className="input-wrapper">
                    <input
                      type="number"
                      value={whWireDia}
                      onChange={(e) => setWhWireDia(Math.max(0.1, parseFloat(e.target.value) || 1.0))}
                      step="0.1"
                    />
                  </div>
                </div>
              </div>

              {whCalculations && (
                <div style={{ marginTop: '0.75rem', background: 'rgba(255,255,255,0.02)', padding: '0.6rem', border: '1px solid var(--card-border)', borderRadius: '6px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.72rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>{t("Inductancia:")}</span>{' '}
                      <strong style={{ color: 'var(--text-main)' }}>{whCalculations.inductance.toFixed(3)} mH</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>{t("Espiras (vueltas):")}</span>{' '}
                      <strong style={{ color: 'var(--primary)' }}>{whCalculations.turns}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>{t("Long. Alambre:")}</span>{' '}
                      <strong>{whCalculations.wireLengthM} m</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>{t("Resistencia (Re):")}</span>{' '}
                      <strong>{whCalculations.resistance} Ω</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>{t("Capas de Winding:")}</span>{' '}
                      <strong>{whCalculations.layers} ({whCalculations.windingHeight} mm)</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>{t("Peso Cobre:")}</span>{' '}
                      <strong>{whCalculations.copperWeightG} g</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </aside>
  );
};
