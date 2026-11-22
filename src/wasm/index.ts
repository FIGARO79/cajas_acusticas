import init, * as wasm from "./pkg/backend.js";
import type { CalculatedSealed, CalculatedPorted, SpeakerParams, VentedAlignmentType, Bandpass6Topology, DampingType } from '../types';

export function dampingTypeToLevel(dampingType?: DampingType): number {
  switch (dampingType) {
    case 'light': return 1;
    case 'moderate': return 2;
    case 'heavy': return 3;
    default: return 0;
  }
}

export function getBoxLosses(
  vb: number,
  dampingType: DampingType = 'none',
  classicalModel = false
): { ql: number; qa: number; qb: number } {
  const level = dampingTypeToLevel(dampingType);
  const w = getWasmSafe();
  if (w) {
    return {
      ql: w.calc_box_ql(vb, classicalModel),
      qa: w.calc_box_qa(level, classicalModel),
      qb: w.calc_box_qb(vb, level, classicalModel),
    };
  }
  if (classicalModel) return { ql: 7.0, qa: 1e9, qb: 7.0 };
  const ql = Math.min(20.0, Math.max(5.0, 7.0 * Math.pow(50.0 / Math.max(vb, 1.0), 0.22)));
  const qa = level === 0 ? 100.0 : level === 1 ? 50.0 : level === 2 ? 15.0 : 6.0;
  const qb = 1.0 / (1.0 / ql + 1.0 / qa);
  return { ql, qa, qb };
}

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

/** Sugerencia automática de radiador pasivo (escalera comercial estándar) */
export async function suggestPassiveRadiator(
  fs: number,
  vas: number,
  qts: number,
  sdCm2: number,
  xmaxMm: number,
  vb: number,
  fb: number
) {
  const w = await getWasm();
  const res = w.suggest_passive_radiator(fs, vas, qts, sdCm2, xmaxMm, vb, fb);
  return {
    diaCm: res.dia_cm,
    diaInches: res.dia_inches,
    sdPrCm2: res.sd_pr_cm2,
    vasPr: res.vas_pr,
    fsPr: res.fs_pr,
    mmsPr: res.mms_pr,
    masaAnadidaG: res.masa_anadida_g,
  };
}

/** Sugerencia de sintonía Fb óptima para un volumen Vb dado (tabla Keele) */
export function calcSuggestFb(fs: number, vas: number, qts: number, vb: number): number {
  const w = getWasm();
  return w.calc_suggest_fb(fs, vas, qts, vb);
}

/** Solver Desired F3 para caja sellada */
export function calcSealedForF3(
  fs: number,
  vas: number,
  qts: number,
  targetF3: number,
  dampingType: DampingType = 'none',
  classicalModel = false
) {
  const w = getWasm();
  const res = w.calc_sealed_for_f3_ex(
    fs,
    vas,
    qts,
    targetF3,
    dampingTypeToLevel(dampingType),
    classicalModel
  );
  return {
    valid: res.valid,
    vb: res.vb,
    fc: res.fb_or_fc,
    qtc: res.qtc,
    f3: res.f3,
    statusCode: res.status_code,
  };
}

/** Solver Desired F3 para caja ventilada */
export function calcVentedForF3(
  fs: number,
  vas: number,
  qts: number,
  targetF3: number,
  dampingType: DampingType = 'none',
  classicalModel = false
) {
  const w = getWasm();
  const res = w.calc_vented_for_f3_ex(
    fs,
    vas,
    qts,
    targetF3,
    dampingTypeToLevel(dampingType),
    classicalModel
  );
  return {
    valid: res.valid,
    vb: res.vb,
    fb: res.fb_or_fc,
    f3: res.f3,
    statusCode: res.status_code,
  };
}

/** Solver Desired F3 para caja ventilada con volumen Vb fijo (resuelve Fb) */
export function calcVentedFbForF3(
  fs: number,
  vas: number,
  qts: number,
  vb: number,
  targetF3: number,
  dampingType: DampingType = 'none',
  classicalModel = false
) {
  const w = getWasm();
  const res = w.calc_vented_fb_for_f3_ex(
    fs,
    vas,
    qts,
    vb,
    targetF3,
    dampingTypeToLevel(dampingType),
    classicalModel
  );
  return {
    valid: res.valid,
    vb: res.vb,
    fb: res.fb_or_fc,
    f3: res.f3,
    statusCode: res.status_code,
  };
}

/** Alineación ventilada extendida con soporte B6 (HP activo) y volumen mínimo del driver */
export function calcVentedAlignmentEx(
  fs: number,
  vas: number,
  qts: number,
  tipo: VentedAlignmentType,
  vbMin = 0
) {
  const w = getWasm();
  const res = w.calc_alineacion_ventilada_ex(fs, vas, qts, tipo, vbMin);
  return {
    vb: res.vb,
    fb: res.fb,
    f3: res.f3,
    activeHp: res.active_hp,
    hpFx: res.hp_fx,
    hpQx: res.hp_qx,
    clampedToMinVol: res.clamped_to_min_vol,
  };
}

/** Isobaric configuration calculations */
export async function calcIsobariMultiple(fs: number, vas: number, qts: number, n: number, tipo: string) {
  const w = await getWasm();
  const res = w.calc_isobari_multiple(fs, vas, qts, n, tipo);
  return { fs_eq: res.fs_eq, vas_eq: res.vas_eq, qts_eq: res.qts_eq, vb_eq: res.vb_eq };
}

/** Sealed box frequency response curve (10-500 Hz) */
export async function calcSealedCurve(
  sealed: CalculatedSealed,
  params: SpeakerParams,
  dampingType: DampingType = 'none',
  classicalModel = false
): Promise<number[]> {
  const w = await getWasm();
  const res = w.calc_sealed_curve_ex(
    params.fs,
    params.qts,
    params.vas,
    sealed.Vb,
    sealed.valid,
    dampingTypeToLevel(dampingType),
    classicalModel
  );
  return Array.from(res);
}

/** Ported box frequency response curve (10-500 Hz) */
export async function calcPortedCurve(
  ported: CalculatedPorted,
  params: SpeakerParams,
  dampingType: DampingType = 'none',
  classicalModel = false
): Promise<number[]> {
  const w = await getWasm();
  const level = dampingTypeToLevel(dampingType);
  const res = (ported.activeHpEnabled && ported.hpFx && ported.hpQx)
    ? w.calc_ported_b6_curve_ex(
        params.fs,
        params.qts,
        params.vas,
        ported.Vb,
        ported.Fb,
        ported.hpFx,
        ported.hpQx,
        ported.valid,
        level,
        classicalModel
      )
    : w.calc_ported_curve_ex(
        params.fs,
        params.qts,
        params.vas,
        ported.Vb,
        ported.Fb,
        ported.valid,
        level,
        classicalModel
      );
  return Array.from(res);
}

/** Bandpass 4th order calculations */
export async function calcBandpass4(fs: number, vas: number, qts: number, s: number) {
  const w = await getWasm();
  const res = w.calc_bandpass_4(fs, vas, qts, s);
  return { vf: res.vf, vr: res.vr, fb: res.fb, f0: res.f0, delta_f: res.delta_f };
}

/** Bandpass 4th order (DF y Q't) */
export function calcBandpass4Pro(fs: number, vas: number, qts: number, df = 0.65, qtPrime = 0) {
  const w = getWasm();
  const res = w.calc_bandpass_4_df(fs, vas, qts, df, qtPrime);
  return { vf: res.vf, vr: res.vr, fb: res.fb, f0: res.f0, delta_f: res.delta_f };
}

/** Bandpass 6th order calculations */
export async function calcBandpass6(fs: number, vas: number, qts: number, a: number) {
  const w = await getWasm();
  const res = w.calc_bandpass_6(fs, vas, qts, a);
  return { vf: res.vf, vr: res.vr, fh: res.fh, fl: res.fl };
}

/** Bandpass 6th order (Paralelo / Serie) */
export function calcBandpass6Pro(fs: number, vas: number, qts: number, topology: Bandpass6Topology) {
  const w = getWasm();
  const res = w.calc_bandpass_6_topology(fs, vas, qts, topology);
  return { vf: res.vf, vr: res.vr, fh: res.fh, fl: res.fl };
}

/** Bandpass 4th order frequency response curve (10-500 Hz) */
export async function calcBandpass4Curve(
  vf: number,
  vr: number,
  fb: number,
  params: SpeakerParams,
  dampingType: DampingType = 'none',
  classicalModel = false
): Promise<number[]> {
  const w = await getWasm();
  const res = w.calc_bandpass4_curve_ex(
    params.fs,
    params.qts,
    params.vas,
    vf,
    vr,
    fb,
    vf > 0 && vr > 0 && fb > 0,
    dampingTypeToLevel(dampingType),
    classicalModel
  );
  return Array.from(res);
}

/** Bandpass 6th order frequency response curve (10-500 Hz) */
export async function calcBandpass6Curve(
  vf: number,
  vr: number,
  fl: number,
  fh: number,
  params: SpeakerParams,
  topology: Bandpass6Topology = 'parallel',
  dampingType: DampingType = 'none',
  classicalModel = false
): Promise<number[]> {
  const w = await getWasm();
  const res = w.calc_bandpass6_curve_ex(
    params.fs,
    params.qts,
    params.vas,
    vf,
    vr,
    fl,
    fh,
    topology,
    vf > 0 && vr > 0 && fl > 0 && fh > 0,
    dampingTypeToLevel(dampingType),
    classicalModel
  );
  return Array.from(res);
}

/** Custom frequency curves (para Full-Range 10-20.000 Hz o cualquier lista arbitraria) */
export function calcSealedCurveCustom(
  freqs: number[],
  fs: number,
  qts: number,
  vas: number,
  vb: number,
  valid = true,
  dampingType: DampingType = 'none',
  classicalModel = false
): number[] {
  const w = getWasm();
  const floatArr = Float64Array.from(freqs);
  return Array.from(w.calc_sealed_curve_custom_ex(floatArr, fs, qts, vas, vb, valid, dampingTypeToLevel(dampingType), classicalModel));
}

export function calcPortedCurveCustom(
  freqs: number[],
  fs: number,
  qts: number,
  vas: number,
  vb: number,
  fb: number,
  valid = true,
  dampingType: DampingType = 'none',
  classicalModel = false
): number[] {
  const w = getWasm();
  const floatArr = Float64Array.from(freqs);
  return Array.from(w.calc_ported_curve_custom_ex(floatArr, fs, qts, vas, vb, fb, valid, dampingTypeToLevel(dampingType), classicalModel));
}

export function calcPortedB6CurveCustom(
  freqs: number[],
  fs: number,
  qts: number,
  vas: number,
  vb: number,
  fb: number,
  fx: number,
  qx: number,
  valid = true,
  dampingType: DampingType = 'none',
  classicalModel = false
): number[] {
  const w = getWasm();
  const floatArr = Float64Array.from(freqs);
  return Array.from(w.calc_ported_b6_curve_custom_ex(floatArr, fs, qts, vas, vb, fb, fx, qx, valid, dampingTypeToLevel(dampingType), classicalModel));
}

export function calcBandpass4CurveCustom(
  freqs: number[],
  fs: number,
  qts: number,
  vas: number,
  vf: number,
  vr: number,
  fb: number,
  valid = true,
  dampingType: DampingType = 'none',
  classicalModel = false
): number[] {
  const w = getWasm();
  const floatArr = Float64Array.from(freqs);
  return Array.from(w.calc_bandpass4_curve_custom_ex(floatArr, fs, qts, vas, vf, vr, fb, valid, dampingTypeToLevel(dampingType), classicalModel));
}

export function calcBandpass6CurveCustom(
  freqs: number[],
  fs: number,
  qts: number,
  vas: number,
  vf: number,
  vr: number,
  fl: number,
  fh: number,
  topology: Bandpass6Topology = 'parallel',
  valid = true,
  dampingType: DampingType = 'none',
  classicalModel = false
): number[] {
  const w = getWasm();
  const floatArr = Float64Array.from(freqs);
  return Array.from(w.calc_bandpass6_curve_custom_ex(floatArr, fs, qts, vas, vf, vr, fl, fh, topology, valid, dampingTypeToLevel(dampingType), classicalModel));
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

