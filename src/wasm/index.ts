import init, * as wasm from "./pkg/backend.js";
import type { CalculatedSealed, CalculatedPorted, SpeakerParams } from '../types';

let wasmInstance: typeof wasm | null = null;
let isInitializing = false;

export async function initWasm(): Promise<typeof wasm> {
  if (wasmInstance) return wasmInstance;
  if (isInitializing) {
    // Wait for the existing initialization to complete
    while (!wasmInstance) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return wasmInstance;
  }
  isInitializing = true;
  try {
    await init();
    wasmInstance = wasm;
  } catch (err) {
    console.error("Failed to load WASM module, using JS fallbacks:", err);
  } finally {
    isInitializing = false;
  }
  return wasmInstance!;
}

export function getWasm() {
  if (!wasmInstance) throw new Error("WASM not initialized yet");
  return wasmInstance;
}

export function isWasmReady(): boolean {
  return wasmInstance !== null;
}

// -----------------------
// New wrappers with robust JS fallbacks
// -----------------------

/** Auto parameters calculation (runProCalculations replacement) */
export async function calcAutoParams(params: {
  vas: number; sd: number; fs: number; re: number; qes: number; xmax: number;
  mms?: number; cms?: number; bl?: number; vd?: number;
  qms?: number; pe?: number; sens?: number;
}) {
  let cms = params.cms ?? 0;
  let mms = params.mms ?? 0;
  let bl = params.bl ?? 0;
  let vd = params.vd ?? 0;
  let autoCms = false;
  let autoMms = false;
  let autoBl = false;
  let autoVd = false;

  if (isWasmReady()) {
    try {
      const wasmInstanceObj = getWasm();
      const res = wasmInstanceObj.calc_auto_params(
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
      cms = res.cms;
      mms = res.mms;
      bl = res.bl;
      vd = res.vd;
      autoCms = res.auto_cms;
      autoMms = res.auto_mms;
      autoBl = res.auto_bl;
      autoVd = res.auto_vd;
    } catch (e) {
      console.warn("WASM calcAutoParams error, using JS fallback:", e);
    }
  }

  // JS Fallback if WASM is not ready or failed
  if (!isWasmReady() || (autoCms === false && cms === 0)) {
    if (cms === 0 && params.vas > 0 && params.sd > 0) {
      cms = 716.1 * params.vas / (params.sd * params.sd);
      autoCms = true;
    }
    if (mms === 0 && params.fs > 0 && cms > 0) {
      mms = 25330.0 / (params.fs * params.fs * cms);
      autoMms = true;
    }
    if (bl === 0 && params.fs > 0 && mms > 0 && params.re > 0 && params.qes > 0) {
      bl = Math.sqrt((2.0 * Math.PI * params.fs * (mms / 1000.0) * params.re) / params.qes);
      autoBl = true;
    }
    if (vd === 0 && params.sd > 0 && params.xmax > 0) {
      vd = params.sd * (params.xmax / 10.0);
      autoVd = true;
    }
  }

  let eta0 = 0;
  if (params.qes && params.fs && params.vas) {
    eta0 = 9.64e-10 * Math.pow(params.fs, 3) * params.vas / params.qes;
  }

  let spl = params.sens;
  if (!spl && eta0 > 0) {
    spl = 112.2 + 10 * Math.log10(eta0);
  }

  let splMax = 0;
  if (spl && params.pe) {
    splMax = spl + 10 * Math.log10(params.pe);
  }

  let rms = 0;
  if (params.fs && mms && params.qms) {
    rms = (2 * Math.PI * params.fs * (mms / 1000)) / params.qms;
  }

  let zmax = 0;
  if (params.re && params.qms && params.qes) {
    zmax = params.re * (1 + params.qms / params.qes);
  }

  return {
    cms,
    mms,
    bl,
    vd,
    autoCms,
    autoMms,
    autoBl,
    autoVd,
    eta0,
    spl,
    splMax,
    rms,
    zmax,
  };
}

/** Suggested alignment for vented box (calculateSuggestedPorted replacement) */
export async function calcSuggestedPorted(qts: number, fs: number, vas: number) {
  const tipo = qts < 0.35 ? "SBB4" : (qts >= 0.35 && qts <= 0.4 ? "B4" : "QB3");

  if (isWasmReady()) {
    try {
      const wasmInstanceObj = getWasm();
      const res = wasmInstanceObj.calc_alineacion_ventilada(fs, vas, qts, tipo);
      return { Vb: res.vb, Fb: res.fb, F3: res.f3, alignmentName: tipo };
    } catch (e) {
      console.warn("WASM calcSuggestedPorted error, using JS fallback:", e);
    }
  }

  // JS Fallback
  let vb: number;
  let fb: number;
  let f3: number;

  if (tipo === "SBB4") {
    vb = 11.0 * Math.pow(qts, 2.87) * vas;
    fb = 0.38 * Math.pow(qts, -0.95) * fs;
    f3 = 0.38 * Math.pow(qts, -0.95) * fs;
  } else if (tipo === "B4") {
    vb = 0.25 * Math.pow(qts, -2.0) * vas;
    fb = fs;
    f3 = fs;
  } else {
    vb = 6.27 * Math.pow(qts, 1.44) * vas;
    fb = 0.94 * Math.pow(qts, -0.9) * fs;
    f3 = 1.2 * Math.pow(qts, -0.9) * fs;
  }

  return { Vb: vb, Fb: fb, F3: f3, alignmentName: tipo };
}

/** Sealed box frequency response curve */
export async function calcSealedCurve(sealed: CalculatedSealed, params: SpeakerParams) {
  if (isWasmReady()) {
    try {
      const wasmInstanceObj = getWasm();
      const res = wasmInstanceObj.calc_sealed_curve(
        params.fs,
        params.qts,
        params.vas,
        sealed.Vb,
        sealed.valid
      );
      const arr: number[] = [];
      res.forEach((v: number) => arr.push(v));
      return arr;
    } catch (e) {
      console.warn("WASM calcSealedCurve error, using JS fallback:", e);
    }
  }

  // JS Fallback
  if (!sealed.valid || sealed.Vb <= 0 || !params.fs || !params.qts || !params.vas) {
    return [];
  }
  const result: number[] = [];
  const frequencies = Array.from({ length: 101 }, (_, i) => {
    const base = 500.0 / 10.0;
    const exponent = i / 100.0;
    const f = 10.0 * Math.pow(base, exponent);
    return Math.round(f * 10.0) / 10.0;
  });

  for (let i = 0; i <= 100; i++) {
    const f = frequencies[i];
    const alpha = params.vas / sealed.Vb;
    const fc = params.fs * Math.sqrt(alpha + 1.0);
    const qtc = params.qts * Math.sqrt(alpha + 1.0);
    const fn = f / fc;
    const response = Math.pow(fn, 2) / Math.sqrt(Math.pow(Math.pow(fn, 2) - 1.0, 2) + Math.pow(fn / qtc, 2) + 1e-20);
    const response_db = 20.0 * Math.log10(response + 1e-10);
    const val = Math.round(response_db * 100.0) / 100.0;
    result.push(val);
  }
  return result;
}

/** Ported box frequency response curve */
export async function calcPortedCurve(ported: CalculatedPorted, params: SpeakerParams) {
  if (isWasmReady()) {
    try {
      const wasmInstanceObj = getWasm();
      const res = wasmInstanceObj.calc_ported_curve(
        params.fs,
        params.qts,
        params.vas,
        ported.Vb,
        ported.Fb,
        ported.valid
      );
      const arr: number[] = [];
      res.forEach((v: number) => arr.push(v));
      return arr;
    } catch (e) {
      console.warn("WASM calcPortedCurve error, using JS fallback:", e);
    }
  }

  // JS Fallback
  if (!ported.valid || ported.Vb <= 0 || ported.Fb <= 0 || !params.fs || !params.qts || !params.vas) {
    return [];
  }
  const result: number[] = [];
  const h = ported.Fb / params.fs;
  const alpha = params.vas / ported.Vb;
  const ql = 7.0;
  const a3 = 1.0 / params.qts + h / ql;
  const a2 = 1.0 + h * h * (1.0 + alpha) + h / (params.qts * ql);
  const a1 = h * h / params.qts + h / ql;
  const a0 = h * h;

  const frequencies = Array.from({ length: 101 }, (_, i) => {
    const base = 500.0 / 10.0;
    const exponent = i / 100.0;
    const f = 10.0 * Math.pow(base, exponent);
    return Math.round(f * 10.0) / 10.0;
  });

  for (let i = 0; i <= 100; i++) {
    const f = frequencies[i];
    const y = f / params.fs;
    const real = Math.pow(y, 4) - a2 * y * y + a0;
    const imag = a1 * y - a3 * Math.pow(y, 3);
    const response = Math.pow(y, 4) / Math.sqrt(real * real + imag * imag + 1e-20);
    const response_db = 20.0 * Math.log10(response + 1e-10);
    const val = Math.round(response_db * 100.0) / 100.0;
    result.push(val);
  }
  return result;
}

/** Bandpass 4th order frequency response curve */
export async function calcBandpass4Curve(vf: number, vr: number, fb: number, params: SpeakerParams) {
  if (isWasmReady()) {
    try {
      const wasmInstanceObj = getWasm();
      const res = wasmInstanceObj.calc_bandpass4_curve(
        params.fs,
        params.qts,
        params.vas,
        vf,
        vr,
        fb,
        vf > 0 && vr > 0 && fb > 0
      );
      const arr: number[] = [];
      res.forEach((v: number) => arr.push(v));
      return arr;
    } catch (e) {
      console.warn("WASM calcBandpass4Curve error, using JS fallback:", e);
    }
  }

  // JS Fallback
  if (vf <= 0 || vr <= 0 || fb <= 0 || !params.fs || !params.qts || !params.vas) {
    return [];
  }
  const result: number[] = [];
  const h = fb / params.fs;
  const alpha_f = params.vas / vf;
  const alpha_r = params.vas / vr;
  const ql = 7.0;
  const a3 = 1.0 / params.qts + h / ql;
  const a2 = 1.0 + h * h * (1.0 + alpha_r) + alpha_f + h / (params.qts * ql);
  const a1 = h * h / params.qts + (h / ql) * (1.0 + alpha_f);
  const a0 = h * h;

  const frequencies = Array.from({ length: 101 }, (_, i) => {
    const base = 500.0 / 10.0;
    const exponent = i / 100.0;
    const f = 10.0 * Math.pow(base, exponent);
    return Math.round(f * 10.0) / 10.0;
  });

  for (let i = 0; i <= 100; i++) {
    const f = frequencies[i];
    const y = f / params.fs;
    const real = Math.pow(y, 4) - a2 * y * y + a0;
    const imag = a1 * y - a3 * Math.pow(y, 3);
    const denom = Math.sqrt(real * real + imag * imag + 1e-20);
    const response = (y * y * alpha_f) / denom;
    const response_db = 20.0 * Math.log10(response + 1e-10);
    const val = Math.round(response_db * 100.0) / 100.0;
    result.push(val);
  }
  return result;
}

/** Bandpass 6th order frequency response curve */
export async function calcBandpass6Curve(vf: number, vr: number, fl: number, fh: number, params: SpeakerParams) {
  if (isWasmReady()) {
    try {
      const wasmInstanceObj = getWasm();
      const res = wasmInstanceObj.calc_bandpass6_curve(
        params.fs,
        params.qts,
        params.vas,
        vf,
        vr,
        fl,
        fh,
        vf > 0 && vr > 0 && fl > 0 && fh > 0
      );
      const arr: number[] = [];
      res.forEach((v: number) => arr.push(v));
      return arr;
    } catch (e) {
      console.warn("WASM calcBandpass6Curve error, using JS fallback:", e);
    }
  }

  // JS Fallback
  if (vf <= 0 || vr <= 0 || fl <= 0 || fh <= 0 || !params.fs || !params.qts || !params.vas) {
    return [];
  }
  const result: number[] = [];
  const q = 0.707;

  const frequencies = Array.from({ length: 101 }, (_, i) => {
    const base = 500.0 / 10.0;
    const exponent = i / 100.0;
    const f = 10.0 * Math.pow(base, exponent);
    return Math.round(f * 10.0) / 10.0;
  });

  for (let i = 0; i <= 100; i++) {
    const f = frequencies[i];
    const y_l = f / fl;
    const den_l = Math.sqrt(Math.pow(1.0 - y_l * y_l, 2) + Math.pow(y_l / q, 2) + 1e-20);
    const hp = (y_l * y_l) / den_l;

    const y_h = f / fh;
    const den_h = Math.sqrt(Math.pow(1.0 - y_h * y_h, 2) + Math.pow(y_h / q, 2) + 1e-20);
    const lp = 1.0 / den_h;

    const alpha = params.vas / (vf + vr);
    const response = hp * lp * Math.sqrt(1.0 + alpha);
    const response_db = 20.0 * Math.log10(response + 1e-10);
    const val = Math.round(response_db * 100.0) / 100.0;
    result.push(val);
  }
  return result;
}
