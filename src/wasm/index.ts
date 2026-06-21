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

export function getWasm() {
  if (!wasmInstance) throw new Error("WASM not initialized yet");
  return wasmInstance;
}

// -----------------------
// New wrappers for Rust functions
// -----------------------

/** Auto parameters calculation (runProCalculations replacement) */
export async function calcAutoParams(params: {
  vas: number; sd: number; fs: number; re: number; qes: number; xmax: number;
  mms?: number; cms?: number; bl?: number; vd?: number;
}) {
  const wasm = await getWasm();
  const res = wasm.calc_auto_params(
    params.vas,
    params.sd,
    params.fs,
    params.re,
    params.qes,
    params.xmax,
    params.mms ?? null,
    params.cms ?? null,
    params.bl ?? null,
    params.vd ?? null
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
  };
}

/** Suggested alignment for vented box (calculateSuggestedPorted replacement) */
export async function calcSuggestedPorted(qts: number, fs: number, vas: number) {
  const wasm = await getWasm();
  let tipo = "QB3";
  if (qts < 0.35) {
    tipo = "SBB4";
  } else if (qts >= 0.35 && qts <= 0.4) {
    tipo = "B4";
  }
  const res = wasm.calc_alineacion_ventilada(fs, vas, qts, tipo);
  return { Vb: res.vb, Fb: res.fb, F3: res.f3, alignmentName: tipo };
}

/** Radiador pasivo calculation */
export async function calcRadiadorPasivo(vb: number, dv: number, vas: number, fs: number, cd: number, mp: number) {
  const wasm = await getWasm();
  const res = wasm.calc_radiador_pasivo(vb, dv, vas, fs, cd, mp);
  return { fb: res.fb, capAcustica: res.cap_acustica, masaAñadida: res.masa_añadida };
}

/** Isobaric configuration calculations */
export async function calcIsobariMultiple(fs: number, vas: number, qts: number, n: number, tipo: string) {
  const wasm = await getWasm();
  const res = wasm.calc_isobari_multiple(fs, vas, qts, n, tipo);
  return { fs_eq: res.fs_eq, vas_eq: res.vas_eq, qts_eq: res.qts_eq, vb_eq: res.vb_eq };
}

/** Sealed box frequency response curve */
export async function calcSealedCurve(sealed: CalculatedSealed, params: SpeakerParams) {
  const wasm = await getWasm();
  const res = wasm.calc_sealed_curve(
    params.fs,
    params.qts,
    params.vas,
    sealed.Vb,
    sealed.valid
  );
  const arr: number[] = [];
  res.forEach((v: any) => arr.push(v as number));
  return arr;
}

/** Ported box frequency response curve */
export async function calcPortedCurve(ported: CalculatedPorted, params: SpeakerParams) {
  const wasm = await getWasm();
  const res = wasm.calc_ported_curve(
    params.fs,
    params.qts,
    params.vas,
    ported.Vb,
    ported.Fb,
    ported.valid
  );
  const arr: number[] = [];
  res.forEach((v: any) => arr.push(v as number));
  return arr;
}

