import init, * as wasm from "./pkg/backend.js";
import type { CalculatedSealed, CalculatedPorted, SpeakerParams } from '../types';

let wasmInstance: typeof wasm | null = null;

export async function initWasm(): Promise<typeof wasm> {
  if (!wasmInstance) {
    await init();
    wasmInstance = wasm;
  }
  return wasmInstance;
}

export function getWasm(): typeof wasm {
  if (!wasmInstance) throw new Error("WASM not initialized yet");
  return wasmInstance;
}

export function getWasmSafe(): typeof wasm | null {
  return wasmInstance;
}

// -----------------------
// Wrappers for Rust functions
// -----------------------

/** Auto parameters calculation (Delegado 100% al motor en Rust) */
export async function calcAutoParams(params: {
  vas: number; sd: number; fs: number; re: number; qes: number; xmax: number;
  mms?: number; cms?: number; bl?: number; vd?: number;
  qms?: number; pe?: number; sens?: number;
}) {
  const w = await getWasm();
  const res = w.calc_auto_params(
    params.vas,
    params.sd,
    params.fs,
    params.re,
    params.qes,
    params.xmax,
    params.mms ?? null,
    params.cms ?? null,
    params.bl ?? null,
    params.vd ?? null,
    params.qms ?? null,
    params.pe ?? null,
    params.sens ?? null
  );

  return {
    cms: res.cms,
    mms: res.mms,
    bl: res.bl,
    vd: res.vd,
    autoCms: res.auto_cms,
    autoMms: res.auto_mms,
    autoBl: res.auto_bl,
    autoVd: res.auto_vd,
    eta0: res.eta0,
    spl: res.spl,
    splMax: res.spl_max,
    rms: res.rms,
    zmax: res.zmax,
  };
}

/** Suggested alignment for vented box */
export async function calcSuggestedPorted(qts: number, fs: number, vas: number) {
  const w = await getWasm();
  let tipo = "QB3";
  if (qts < 0.35) {
    tipo = "SBB4";
  } else if (qts >= 0.35 && qts <= 0.4) {
    tipo = "B4";
  }
  const res = w.calc_alineacion_ventilada(fs, vas, qts, tipo);
  return { Vb: res.vb, Fb: res.fb, F3: res.f3, alignmentName: tipo };
}

/** Radiador pasivo calculation */
export async function calcRadiadorPasivo(vb: number, vas: number, fs: number, cd: number, mp: number) {
  const w = await getWasm();
  const res = w.calc_radiador_pasivo(vb, vas, fs, cd, mp);
  return { fb: res.fb, capAcustica: res.cap_acustica, masaAñadida: res.masa_añadida };
}

/** Isobaric configuration calculations */
export async function calcIsobariMultiple(fs: number, vas: number, qts: number, n: number, tipo: string) {
  const w = await getWasm();
  const res = w.calc_isobari_multiple(fs, vas, qts, n, tipo);
  return { fs_eq: res.fs_eq, vas_eq: res.vas_eq, qts_eq: res.qts_eq, vb_eq: res.vb_eq };
}

/** Sealed box frequency response curve (10-500 Hz) */
export async function calcSealedCurve(sealed: CalculatedSealed, params: SpeakerParams): Promise<number[]> {
  const w = await getWasm();
  const res = w.calc_sealed_curve(
    params.fs,
    params.qts,
    params.vas,
    sealed.Vb,
    sealed.valid
  );
  return Array.from(res);
}

/** Ported box frequency response curve (10-500 Hz) */
export async function calcPortedCurve(ported: CalculatedPorted, params: SpeakerParams): Promise<number[]> {
  const w = await getWasm();
  const res = w.calc_ported_curve(
    params.fs,
    params.qts,
    params.vas,
    ported.Vb,
    ported.Fb,
    ported.valid
  );
  return Array.from(res);
}

/** Bandpass 4th order calculations */
export async function calcBandpass4(fs: number, vas: number, qts: number, s: number) {
  const w = await getWasm();
  const res = w.calc_bandpass_4(fs, vas, qts, s);
  return { vf: res.vf, vr: res.vr, fb: res.fb, f0: res.f0, delta_f: res.delta_f };
}

/** Bandpass 6th order calculations */
export async function calcBandpass6(fs: number, vas: number, qts: number, a: number) {
  const w = await getWasm();
  const res = w.calc_bandpass_6(fs, vas, qts, a);
  return { vf: res.vf, vr: res.vr, fh: res.fh, fl: res.fl };
}

/** Bandpass 4th order frequency response curve (10-500 Hz) */
export async function calcBandpass4Curve(vf: number, vr: number, fb: number, params: SpeakerParams): Promise<number[]> {
  const w = await getWasm();
  const res = w.calc_bandpass4_curve(
    params.fs,
    params.qts,
    params.vas,
    vf,
    vr,
    fb,
    vf > 0 && vr > 0 && fb > 0
  );
  return Array.from(res);
}

/** Bandpass 6th order frequency response curve (10-500 Hz) */
export async function calcBandpass6Curve(vf: number, vr: number, fl: number, fh: number, params: SpeakerParams): Promise<number[]> {
  const w = await getWasm();
  const res = w.calc_bandpass6_curve(
    params.fs,
    params.qts,
    params.vas,
    vf,
    vr,
    fl,
    fh,
    vf > 0 && vr > 0 && fl > 0 && fh > 0
  );
  return Array.from(res);
}

/** Custom frequency curves (para Full-Range 10-20.000 Hz o cualquier lista arbitraria) */
export function calcSealedCurveCustom(freqs: number[], fs: number, qts: number, vas: number, vb: number, valid = true): number[] {
  const w = getWasm();
  const floatArr = Float64Array.from(freqs);
  return Array.from(w.calc_sealed_curve_custom(floatArr, fs, qts, vas, vb, valid));
}

export function calcPortedCurveCustom(freqs: number[], fs: number, qts: number, vas: number, vb: number, fb: number, valid = true): number[] {
  const w = getWasm();
  const floatArr = Float64Array.from(freqs);
  return Array.from(w.calc_ported_curve_custom(floatArr, fs, qts, vas, vb, fb, valid));
}

export function calcBandpass4CurveCustom(freqs: number[], fs: number, qts: number, vas: number, vf: number, vr: number, fb: number, valid = true): number[] {
  const w = getWasm();
  const floatArr = Float64Array.from(freqs);
  return Array.from(w.calc_bandpass4_curve_custom(floatArr, fs, qts, vas, vf, vr, fb, valid));
}

export function calcBandpass6CurveCustom(freqs: number[], vas: number, vf: number, vr: number, fl: number, fh: number, valid = true): number[] {
  const w = getWasm();
  const floatArr = Float64Array.from(freqs);
  return Array.from(w.calc_bandpass6_curve_custom(floatArr, vas, vf, vr, fl, fh, valid));
}

/** Crossover filter gain in dB calculado por Rust */
export function calcFilterGain(f: number, fcPoint: number, filterType: string, passType: 'LP' | 'HP'): number {
  const w = getWasm();
  return w.calc_filter_gain(f, fcPoint, filterType, passType);
}

/** Calculate number of turns needed for an inductor (Reverse Wheeler formula) */
export async function calcVueltasInductor(l_mh: number, d_mm: number, l_cm: number) {
  const w = await getWasm();
  return w.calc_vueltas_inductor_wheeler(l_mh, d_mm, l_cm);
}

/** Calculate inductor value from physical dimensions (Wheeler formula) */
export async function calcInductorWheeler(n: number, d_mm: number, l_cm: number) {
  const w = await getWasm();
  return w.calc_inductor_wheeler(n, d_mm, l_cm);
}

export interface VolumenNetoResultJS {
  vBruto: number;
  vExtra: number;
  vPort: number;
  vNetoFisico: number;
  vNetoAcustico: number;
  portLength: number;
  exceedsDepth: boolean;
}

/**
 * Cálculo del volumen neto de ebanistería y desplazamiento de puerto 100% en backend de Rust.
 * Resuelve la interacción física entre volumen de caja, sintonía Fb y desplazamiento del tubo sin divergencias.
 */
export function calcVolumenNetoMadera(
  vBruto: number,
  vExtra: number,
  boxType: string,
  fb: number,
  numPorts: number,
  portDia: number,
  flaredEnds: number,
  maxDepthCm: number,
  useCustomPortLen: boolean,
  customPortLen: number,
  dampingFactor: number
): VolumenNetoResultJS {
  const w = getWasmSafe();
  if (w) {
    const res = w.calc_volumen_neto_madera(
      vBruto,
      vExtra,
      boxType,
      fb,
      numPorts,
      portDia,
      flaredEnds,
      maxDepthCm,
      useCustomPortLen,
      customPortLen,
      dampingFactor
    );
    const out: VolumenNetoResultJS = {
      vBruto: res.v_bruto,
      vExtra: res.v_extra,
      vPort: res.v_port,
      vNetoFisico: res.v_neto_fisico,
      vNetoAcustico: res.v_neto_acustico,
      portLength: res.port_length,
      exceedsDepth: res.exceeds_depth,
    };
    res.free();
    return out;
  }
  const vBase = Math.max(0.05, vBruto - vExtra);
  return {
    vBruto,
    vExtra,
    vPort: 0,
    vNetoFisico: vBase,
    vNetoAcustico: vBase * dampingFactor,
    portLength: 0,
    exceedsDepth: false,
  };
}

/**
 * Curva de impedancia extendida con modelos Thorborg/Futtrup (Ke, Leb, Rss)
 * y arrastre viscoelástico Knudsen LOG Creep (beta).
 */
export function calcExtendedImpedanceCurve(
  fs: number,
  qms: number,
  qes: number,
  re: number,
  vas: number,
  vb: number,
  fb: number,
  isPorted: boolean,
  lebMh: number = 0.5,
  keSh: number = 0.8,
  rssOhm: number = 35.0,
  beta: number = 0.015,
  valid: boolean = true
): number[] {
  const w = getWasmSafe();
  if (!w) return [];
  const res = w.calc_extended_impedance_curve(
    fs, qms, qes, re, vas, vb, fb, isPorted, lebMh, keSh, rssOhm, beta, valid
  );
  return Array.from(res);
}

export function calcExtendedImpedanceCurveCustom(
  freqs: number[],
  fs: number,
  qms: number,
  qes: number,
  re: number,
  vas: number,
  vb: number,
  fb: number,
  isPorted: boolean,
  lebMh: number = 0.5,
  keSh: number = 0.8,
  rssOhm: number = 35.0,
  beta: number = 0.015,
  valid: boolean = true
): number[] {
  const w = getWasmSafe();
  if (!w) return [];
  const res = w.calc_extended_impedance_curve_custom(
    new Float64Array(freqs),
    fs, qms, qes, re, vas, vb, fb, isPorted, lebMh, keSh, rssOhm, beta, valid
  );
  return Array.from(res);
}

/**
 * Curva de difracción y efecto de bafle (Baffle Step + Edge Diffraction).
 */
export function calcBaffleDiffractionCurve(
  widthCm: number,
  heightCm: number,
  offsetXCm: number = 0,
  offsetYCm: number = 0,
  valid: boolean = true
): number[] {
  const w = getWasmSafe();
  if (!w) return [];
  const res = w.calc_baffle_diffraction_curve(widthCm, heightCm, offsetXCm, offsetYCm, valid);
  return Array.from(res);
}

/**
 * Corrección de curva SPL aplicando la transición de Baffle Step real de la caja.
 */
export function applyBaffleStepToSpl(
  splValues: number[],
  widthCm: number,
  heightCm: number,
  offsetXCm: number = 0,
  offsetYCm: number = 0
): number[] {
  const w = getWasmSafe();
  if (!w) return splValues;
  const res = w.apply_baffle_step_to_spl(
    new Float64Array(splValues),
    widthCm,
    heightCm,
    offsetXCm,
    offsetYCm
  );
  return Array.from(res);
}

export function applyBaffleStepToSplCustom(
  freqs: number[],
  splValues: number[],
  widthCm: number,
  heightCm: number,
  offsetXCm: number = 0,
  offsetYCm: number = 0
): number[] {
  const w = getWasmSafe();
  if (!w) return splValues;
  const res = w.apply_baffle_step_to_spl_custom(
    new Float64Array(freqs),
    new Float64Array(splValues),
    widthCm,
    heightCm,
    offsetXCm,
    offsetYCm
  );
  return Array.from(res);
}

/**
 * Curva de transferencia de Crossover Pasivo resuelta mediante Análisis Nodal Modificado (MNA).
 */
export function calcCrossoverLowpassCurve(
  lMh: number,
  dcrOhm: number,
  cUf: number,
  reOhm: number,
  leMh: number,
  rzOhm: number = 0,
  czUf: number = 0,
  useZobel: boolean = false,
  valid: boolean = true
): number[] {
  const w = getWasmSafe();
  if (!w) return [];
  const res = w.calc_crossover_lowpass_curve(
    lMh, dcrOhm, cUf, reOhm, leMh, rzOhm, czUf, useZobel, valid
  );
  return Array.from(res);
}

/**
 * Optimizador Nelder-Mead Simplex en Rust para diseñar inductores y condensadores
 * óptimos contra una frecuencia de corte objetivo.
 */
export function optimizeCrossoverLowpass(
  targetFc: number,
  reOhm: number,
  leMh: number,
  dcrOhm: number = 0.3
): { lOptMh: number; cOptUf: number; rmsErrorDb: number; iterations: number } {
  const w = getWasmSafe();
  if (!w) {
    return { lOptMh: 1.0, cOptUf: 10.0, rmsErrorDb: 0, iterations: 0 };
  }
  const res = w.optimize_crossover_lowpass(targetFc, reOhm, leMh, dcrOhm);
  return {
    lOptMh: res.l_opt_mh,
    cOptUf: res.c_opt_uf,
    rmsErrorDb: res.rms_error_db,
    iterations: res.iterations,
  };
}

