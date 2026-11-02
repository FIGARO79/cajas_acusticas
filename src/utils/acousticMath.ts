import type { SpeakerParams, PortSuggestions } from '../types';
import { getWasmSafe } from '../wasm';

export const QL_LOSSES = 7.0;

// Logarithmic frequency sweep 10 Hz - 500 Hz (101 puntos estándar)
export const chartFrequencies: number[] = (() => {
  const freqs: number[] = [];
  for (let i = 0; i <= 100; i++) {
    const f = 10 * Math.pow(500 / 10, i / 100);
    freqs.push(Math.round(f * 10) / 10);
  }
  return freqs;
})();

export function getKCorrection(flaredEnds: number): number {
  const wasm = getWasmSafe();
  if (wasm) {
    return wasm.calc_k_puerto(flaredEnds);
  }
  if (flaredEnds === 1 || flaredEnds === 3) return 0.850;
  if (flaredEnds === 2) return 0.968;
  return 0.732;
}

export function calcPortLength(vb: number, fb: number, dv: number, flaredEnds: number, numPorts = 1): number {
  if (vb <= 0 || fb <= 0 || dv <= 0) return 0;
  const wasm = getWasmSafe();
  if (wasm) {
    return wasm.calc_longitud_puerto(vb, fb, dv, flaredEnds, numPorts);
  }
  const k = getKCorrection(flaredEnds);
  const len = ((23562.5 * Math.pow(dv, 2) * numPorts) / (fb * fb * vb)) - (k * dv);
  return Math.max(0, len);
}

export function estimateF3(fs: number, qts: number, Vb: number, Fb: number, vas: number): number {
  const wasm = getWasmSafe();
  if (wasm) {
    return wasm.calc_f3_ventilada(fs, qts, Vb, Fb, vas);
  }
  const h = Fb / fs;
  const alpha = vas / Vb;
  const Ql = QL_LOSSES;

  const a3 = 1 / qts + h / Ql;
  const a2 = 1 + h * h * (1 + alpha) + h / (qts * Ql);
  const a1 = (h * h) / qts + h / Ql;
  const a0 = h * h;

  let low = 10;
  let high = 500;
  for (let iter = 0; iter < 20; iter++) {
    const mid = (low + high) / 2;
    const y = mid / fs;
    const real = Math.pow(y, 4) - a2 * y * y + a0;
    const imag = a1 * y - a3 * Math.pow(y, 3);
    const mag = Math.pow(y, 4) / Math.sqrt(real * real + imag * imag + 1e-20);

    if (mag < 0.707) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

export interface OptimalPortResult {
  numPorts: number;
  diameter: number;
  length: number;
  vPeak: number;
  fitsInBox: boolean;
}

/**
 * Calcula el puerto óptimo (cantidad y diámetro) para un altavoz y caja (Vb, Fb)
 * ejecutando el motor acústico en Rust/WebAssembly (`calc_puerto_optimo`).
 */
export function calcOptimalPortForSpeaker(
  Vb: number,
  Fb: number,
  params: SpeakerParams,
  flaredEnds: 0 | 1 | 2 | 3 = 0,
  minLengthCm = 2.0,
  maxLengthCm = 45.0
): OptimalPortResult {
  const sd = params.sd && params.sd > 0 ? params.sd : 215;
  const xmax = params.xmax && params.xmax > 0 ? params.xmax : 4.0;
  const wasm = getWasmSafe();
  if (wasm) {
    const res = wasm.calc_puerto_optimo(Vb, Fb, sd, xmax, flaredEnds, minLengthCm, maxLengthCm);
    const out: OptimalPortResult = {
      numPorts: res.num_ports,
      diameter: res.diameter,
      length: res.length,
      vPeak: res.v_peak,
      fitsInBox: res.fits_in_box,
    };
    res.free();
    return out;
  }
  const fallbackLv = calcPortLength(Vb, Fb, 6.5, flaredEnds, 1);
  return {
    numPorts: 1,
    diameter: 6.5,
    length: fallbackLv,
    vPeak: 0,
    fitsInBox: fallbackLv >= minLengthCm && fallbackLv <= maxLengthCm,
  };
}

/**
 * Sugiere configuraciones de puertos redondos delegando al motor en Rust (`suggest_port_config`).
 */
export function suggestPortConfig(
  Vb: number,
  Fb: number,
  params: SpeakerParams,
  flaredEnds: 0 | 1 | 2 | 3 = 0,
  minLength = 0
): PortSuggestions {
  const wasm = getWasmSafe();
  if (wasm) {
    return wasm.suggest_port_config(
      Vb,
      Fb,
      params.sd || 0,
      params.xmax || 0,
      flaredEnds,
      minLength
    ) as PortSuggestions;
  }

  if (!params.sd || !params.xmax) {
    return {
      valid: false,
      reason: "Ingresa el área del cono (Sd) y excursión (Xmax) en la barra lateral para recibir sugerencias de puertos sin ruido de viento."
    };
  }

  const dMinSilent = Math.sqrt((0.008 * Fb * params.sd * params.xmax) / 9.8);
  return {
    valid: true,
    dMin: Number(dMinSilent.toFixed(1)),
    options: []
  };
}

// -------------------------------------------------------------
// PROPIEDADES MECÁNICAS Y ELECTROACÚSTICAS (Rust backend)
// -------------------------------------------------------------

export interface DriverMechProps {
  re: number;
  bl: number;
  mms: number; // in kg
  cms: number; // in m/N
  sdM2: number; // in m2
}

/**
 * Extrae parámetros mecánicos del driver utilizando Rust WebAssembly (`calc_driver_mechanicals`).
 */
export function getDriverMechanicals(params: SpeakerParams): DriverMechProps {
  const wasm = getWasmSafe();
  if (wasm) {
    const res = wasm.calc_driver_mechanicals(
      params.re || 6.0,
      params.fs || 38.0,
      params.qes || 0.45,
      params.vas || 45.0,
      params.sd || 215.0,
      params.mms || 0,
      params.cms || 0,
      params.bl || 0
    );
    const out: DriverMechProps = {
      re: res.re,
      bl: res.bl,
      mms: res.mms,
      cms: res.cms,
      sdM2: res.sd_m2,
    };
    res.free();
    return out;
  }

  const re = params.re > 0 ? params.re : 6.0;
  const fs = params.fs > 0 ? params.fs : 38.0;
  const qes = params.qes > 0 ? params.qes : 0.45;
  const vasL = params.vas > 0 ? params.vas : 45.0;
  const sdCm2 = params.sd > 0 ? params.sd : 215.0;
  const sdM2 = sdCm2 * 1e-4;
  const cms = params.cms && params.cms > 0 ? params.cms * 1e-3 : (vasL * 1e-3) / (1.204 * Math.pow(344, 2) * Math.pow(sdM2, 2));
  const mms = params.mms && params.mms > 0 ? params.mms * 1e-3 : 1.0 / (Math.pow(2 * Math.PI * fs, 2) * cms);
  const bl = params.bl && params.bl > 0 ? params.bl : Math.sqrt((2 * Math.PI * fs * mms * re) / qes);

  return { re, bl, mms, cms, sdM2 };
}

/**
 * Desplazamiento pico del cono (Cone Excursion) en mm según Rust (`calc_excursion_cono`).
 */
export function calcConeExcursion(
  f: number,
  params: SpeakerParams,
  vb: number,
  fb: number,
  isPorted: boolean,
  powerWatts = 100
): number {
  if (f <= 0 || vb <= 0) return 0;
  const wasm = getWasmSafe();
  if (wasm) {
    return wasm.calc_excursion_cono(
      f,
      params.fs || 38,
      params.qts || 0.38,
      params.qes || 0.45,
      params.vas || 45,
      params.re || 6.0,
      params.sd || 215,
      params.mms || 0,
      params.cms || 0,
      params.bl || 0,
      vb,
      fb,
      isPorted,
      powerWatts
    );
  }
  return 0;
}

/**
 * Curva vectorial completa de excursión calculada 100% en Rust en un solo pase.
 */
export function calcExcursionCurve(
  params: SpeakerParams,
  vb: number,
  fb: number,
  isPorted: boolean,
  powerWatts = 100,
  valid = true
): number[] {
  const wasm = getWasmSafe();
  if (wasm) {
    const res = wasm.calc_excursion_curve(
      params.fs || 38,
      params.qts || 0.38,
      params.qes || 0.45,
      params.vas || 45,
      params.re || 6.0,
      params.sd || 215,
      params.mms || 0,
      params.cms || 0,
      params.bl || 0,
      vb,
      fb,
      isPorted,
      powerWatts,
      valid
    );
    return Array.from(res);
  }
  return chartFrequencies.map(f => calcConeExcursion(f, params, vb, fb, isPorted, powerWatts));
}

/**
 * Velocidad del aire en el conducto en m/s según Rust (`calc_velocidad_aire_frec`).
 */
export function calcVentAirVelocity(
  f: number,
  params: SpeakerParams,
  vb: number,
  fb: number,
  portAreaM2: number,
  powerWatts = 100
): number {
  if (f <= 0 || vb <= 0 || fb <= 0 || portAreaM2 <= 0) return 0;
  const wasm = getWasmSafe();
  if (wasm) {
    return wasm.calc_velocidad_aire_frec(
      f,
      params.fs || 38,
      params.qts || 0.38,
      params.qes || 0.45,
      params.vas || 45,
      params.re || 6.0,
      params.sd || 215,
      params.mms || 0,
      params.cms || 0,
      params.bl || 0,
      vb,
      fb,
      portAreaM2,
      powerWatts
    );
  }
  return 0;
}

/**
 * Curva vectorial completa de velocidad de aire en puerto calculada en Rust.
 */
export function calcAirVelocityCurve(
  params: SpeakerParams,
  vb: number,
  fb: number,
  portAreaM2: number,
  powerWatts = 100,
  valid = true
): number[] {
  const wasm = getWasmSafe();
  if (wasm) {
    const res = wasm.calc_air_velocity_curve(
      params.fs || 38,
      params.qts || 0.38,
      params.qes || 0.45,
      params.vas || 45,
      params.re || 6.0,
      params.sd || 215,
      params.mms || 0,
      params.cms || 0,
      params.bl || 0,
      vb,
      fb,
      portAreaM2,
      powerWatts,
      valid
    );
    return Array.from(res);
  }
  return chartFrequencies.map(f => calcVentAirVelocity(f, params, vb, fb, portAreaM2, powerWatts));
}

/**
 * Impedancia eléctrica del sistema en Ohms según Rust (`calc_impedancia_sistema`).
 */
export function calcSystemImpedance(
  f: number,
  params: SpeakerParams,
  vb: number,
  fb: number,
  isPorted: boolean
): number {
  if (f <= 0 || vb <= 0) return params.re || 4;
  const wasm = getWasmSafe();
  if (wasm) {
    return wasm.calc_impedancia_sistema(
      f,
      params.fs || 35,
      params.qts || 0.38,
      params.qes || 0.42,
      params.qms || 4.0,
      params.vas || 60,
      params.re || 3.6,
      params.le || 1.0,
      vb,
      fb,
      isPorted
    );
  }
  return params.re || 4.0;
}

/**
 * Curva vectorial completa de impedancia calculada en Rust en un solo pase.
 */
export function calcImpedanceCurve(
  params: SpeakerParams,
  vb: number,
  fb: number,
  isPorted: boolean,
  valid = true
): number[] {
  const wasm = getWasmSafe();
  if (wasm) {
    const res = wasm.calc_impedance_curve(
      params.fs || 35,
      params.qts || 0.38,
      params.qes || 0.42,
      params.qms || 4.0,
      params.vas || 60,
      params.re || 3.6,
      params.le || 1.0,
      vb,
      fb,
      isPorted,
      valid
    );
    return Array.from(res);
  }
  return chartFrequencies.map(f => calcSystemImpedance(f, params, vb, fb, isPorted));
}

/**
 * Respuesta de fase acústica en grados (°) según Rust (`calc_fase_acustica`).
 */
export function calcPhaseResponse(
  f: number,
  params: SpeakerParams,
  vb: number,
  fb: number,
  isPorted: boolean
): number {
  if (f <= 0 || vb <= 0) return 0;
  const wasm = getWasmSafe();
  if (wasm) {
    return wasm.calc_fase_acustica(
      f,
      params.fs || 38,
      params.qts || 0.38,
      params.vas || 45,
      vb,
      fb,
      isPorted
    );
  }
  return 0;
}

/**
 * Curva vectorial completa de fase calculada en Rust.
 */
export function calcPhaseCurve(
  params: SpeakerParams,
  vb: number,
  fb: number,
  isPorted: boolean,
  valid = true
): number[] {
  const wasm = getWasmSafe();
  if (wasm) {
    const res = wasm.calc_phase_curve(
      params.fs || 38,
      params.qts || 0.38,
      params.vas || 45,
      vb,
      fb,
      isPorted,
      valid
    );
    return Array.from(res);
  }
  return chartFrequencies.map(f => calcPhaseResponse(f, params, vb, fb, isPorted));
}

/**
 * Retardo de grupo (Group Delay) en ms: calculado completamente en Rust (`calc_group_delay_curve_custom`).
 */
export function calcGroupDelayCurve(
  freqs: number[],
  params: SpeakerParams,
  vb: number,
  fb: number,
  isPorted: boolean,
  valid = true
): number[] {
  const wasm = getWasmSafe();
  if (wasm && freqs.length > 0) {
    const floatArr = Float64Array.from(freqs);
    const res = wasm.calc_group_delay_curve_custom(
      floatArr,
      params.fs || 38,
      params.qts || 0.38,
      params.vas || 45,
      vb,
      fb,
      isPorted,
      valid
    );
    return Array.from(res);
  }
  return freqs.map(() => 0);
}

// -------------------------------------------------------------
// RESPUESTAS PUNTUALES EN FRECUENCIA (Rust backend)
// -------------------------------------------------------------

export function calculateSealedResponseAt(f: number, fs: number, qts: number, vas: number, vb: number): number {
  const wasm = getWasmSafe();
  if (wasm) {
    return wasm.calc_sealed_response_at(f, fs, qts, vas, vb);
  }
  const alpha = vas / vb;
  const fc = fs * Math.sqrt(alpha + 1);
  const qtc = qts * Math.sqrt(alpha + 1);
  const fn_ = f / fc;
  const response = Math.pow(fn_, 2) / Math.sqrt(Math.pow(Math.pow(fn_, 2) - 1, 2) + Math.pow(fn_ / qtc, 2) + 1e-20);
  return 20 * Math.log10(response + 1e-10);
}

export function calculatePortedResponseAt(f: number, fs: number, qts: number, vas: number, vb: number, fb: number): number {
  const wasm = getWasmSafe();
  if (wasm) {
    return wasm.calc_ported_response_at(f, fs, qts, vas, vb, fb);
  }
  const h = fb / fs;
  const alpha = vas / vb;
  const ql = 7.0;
  const a3 = 1.0 / qts + h / ql;
  const a2 = 1.0 + h * h * (1.0 + alpha) + h / (qts * ql);
  const a1 = (h * h) / qts + h / ql;
  const a0 = h * h;
  const y = f / fs;
  const real = Math.pow(y, 4) - a2 * y * y + a0;
  const imag = a1 * y - a3 * Math.pow(y, 3);
  const response = Math.pow(y, 4) / Math.sqrt(real * real + imag * imag + 1e-20);
  return 20 * Math.log10(response + 1e-10);
}

export function calculateBandpass4ResponseAt(f: number, fs: number, qts: number, vas: number, vf: number, vr: number, fb: number): number {
  const wasm = getWasmSafe();
  if (wasm) {
    return wasm.calc_bandpass4_response_at(f, fs, qts, vas, vf, vr, fb);
  }
  const h = fb / fs;
  const alpha_f = vas / vf;
  const alpha_r = vas / vr;
  const ql = 7.0;
  const a3 = 1.0 / qts + h / ql;
  const a2 = 1.0 + h * h * (1.0 + alpha_r) + alpha_f + h / (qts * ql);
  const a1 = h * h / qts + (h / ql) * (1.0 + alpha_f);
  const a0 = h * h;
  const y = f / fs;
  const real = Math.pow(y, 4) - a2 * y * y + a0;
  const imag = a1 * y - a3 * Math.pow(y, 3);
  const denom = Math.sqrt(real * real + imag * imag + 1e-20);
  const response = (y * y * alpha_f) / denom;
  return 20 * Math.log10(response + 1e-10);
}

export function calculateBandpass6ResponseAt(f: number, vas: number, vf: number, vr: number, fl: number, fh: number): number {
  const wasm = getWasmSafe();
  if (wasm) {
    return wasm.calc_bandpass6_response_at(f, vas, vf, vr, fl, fh);
  }
  const q = 0.707;
  const y_l = f / fl;
  const den_l = Math.sqrt(Math.pow(1.0 - y_l * y_l, 2) + Math.pow(y_l / q, 2) + 1e-20);
  const hp = (y_l * y_l) / den_l;
  const y_h = f / fh;
  const den_h = Math.sqrt(Math.pow(1.0 - y_h * y_h, 2) + Math.pow(y_h / q, 2) + 1e-20);
  const lp = 1.0 / den_h;
  const alpha = vas / (vf + vr);
  const response = hp * lp * Math.sqrt(1.0 + alpha);
  return 20 * Math.log10(response + 1e-10);
}

export function getFilterGain(f: number, fcPoint: number, type: string, passType: 'LP' | 'HP'): number {
  const wasm = getWasmSafe();
  if (wasm) {
    return wasm.calc_filter_gain(f, fcPoint, type, passType);
  }
  const x = f / fcPoint;
  if (type === '1st_order') {
    const factor = passType === 'LP' ? 1.0 : x;
    return 20 * Math.log10(factor / Math.sqrt(1 + x * x) + 1e-10);
  }
  return 0;
}
