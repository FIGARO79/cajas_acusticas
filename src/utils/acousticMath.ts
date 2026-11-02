import type { SpeakerParams, PortSuggestions } from '../types';
import { getWasm } from '../wasm';

export const QL_LOSSES = 7.0;

export function getKCorrection(flaredEnds: number): number {
  const wasm = getWasm();
  if (wasm) {
    return wasm.calc_k_puerto(flaredEnds);
  }
  if (flaredEnds === 1 || flaredEnds === 3) return 0.850;
  if (flaredEnds === 2) return 0.968;
  return 0.732;
}

export function calcPortLength(vb: number, fb: number, dv: number, flaredEnds: number, numPorts = 1): number {
  if (vb <= 0 || fb <= 0 || dv <= 0) return 0;
  const wasm = getWasm();
  if (wasm) {
    return wasm.calc_longitud_puerto(vb, fb, dv, flaredEnds, numPorts);
  }
  const k = getKCorrection(flaredEnds);
  const len = ((23562.5 * Math.pow(dv, 2) * numPorts) / (fb * fb * vb)) - (k * dv);
  return Math.max(0, len);
}


// Logarithmic frequency sweep 10 Hz - 500 Hz
export const chartFrequencies: number[] = (() => {
  const freqs: number[] = [];
  for (let i = 0; i <= 100; i++) {
    const f = 10 * Math.pow(500 / 10, i / 100);
    freqs.push(Math.round(f * 10) / 10);
  }
  return freqs;
})();


export function estimateF3(fs: number, qts: number, Vb: number, Fb: number, vas: number) {
  const wasm = getWasm();
  if (wasm) {
    return wasm.calc_f3_ventilada(fs, qts, Vb, Fb, vas);
  }
  const h = Fb / fs;
  const alpha = vas / Vb;
  const Ql = QL_LOSSES;

  const a3 = 1 / qts + h / Ql;
  const a2 = 1 + h * h * (1 + alpha) + h / (qts * Ql);
  const a1 = h * h / qts + h / Ql;
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
  const wasm = getWasm();
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
  // vPeak = (0.008 * Fb * Sd * Xmax) / (N * D^2)
  // Para vPeakobjetivo = 9.5 m/s (Flujo silencioso < 10 m/s):
  const targetSilentVel = flaredEnds >= 2 ? 12.0 : 9.5;
  const dSilentTotal = Math.sqrt((0.008 * Fb * sd * xmax) / targetSilentVel);
  // Mínimo absoluto anti-chuffing (~16 m/s):
  const dMinTotal = Math.sqrt((0.008 * Fb * sd * xmax) / 16.0);

  const candidateConfigs: OptimalPortResult[] = [];
  const commercialDiameters = [4.0, 5.0, 6.5, 7.5, 8.5, 10.0, 12.5, 15.0];

  // Evaluar 1, 2 y 3 puertos tanto con el diámetro silencioso exacto como medidas comerciales
  for (const numPorts of [1, 2, 3]) {
    const exactSilentDia = Number((dSilentTotal / Math.sqrt(numPorts)).toFixed(1));
    const exactMinDia = Number((dMinTotal / Math.sqrt(numPorts)).toFixed(1));
    const testDias = Array.from(new Set([exactSilentDia, exactMinDia, ...commercialDiameters])).sort((a, b) => a - b);

    for (const dia of testDias) {
      if (dia < 2.5 || dia > 20) continue;
      const lv = calcPortLength(Vb, Fb, dia, flaredEnds, numPorts);
      const vPeak = (0.008 * Fb * sd * xmax) / (numPorts * dia * dia);
      const fitsInBox = lv >= minLengthCm && lv <= maxLengthCm;
      candidateConfigs.push({
        numPorts,
        diameter: dia,
        length: lv,
        vPeak,
        fitsInBox,
      });
    }
  }

  // Prioridad 1: Cabe en la caja y flujo silencioso (vPeak <= 10 m/s), prefiriendo menor número de puertos y longitud razonable
  const silentFitting = candidateConfigs
    .filter((c) => c.fitsInBox && c.vPeak <= 10.0)
    .sort((a, b) => a.numPorts - b.numPorts || a.diameter - b.diameter);
  if (silentFitting.length > 0) return silentFitting[0];

  // Prioridad 2: Cabe en la caja y velocidad moderada sin soplido crítico (vPeak <= 17 m/s)
  const moderateFitting = candidateConfigs
    .filter((c) => c.fitsInBox && c.vPeak <= 17.0)
    .sort((a, b) => a.vPeak - b.vPeak || a.numPorts - b.numPorts);
  if (moderateFitting.length > 0) return moderateFitting[0];

  // Fallback: el que mejor quepa en la caja con menor velocidad de aire
  const anyFitting = candidateConfigs
    .filter((c) => c.fitsInBox)
    .sort((a, b) => a.vPeak - b.vPeak);
  if (anyFitting.length > 0) return anyFitting[0];

  const fallbackDia = Number(Math.max(4.0, dMinTotal).toFixed(1));
  const fallbackLv = calcPortLength(Vb, Fb, fallbackDia, flaredEnds, 1);
  return {
    numPorts: 1,
    diameter: fallbackDia,
    length: fallbackLv,
    vPeak: (0.008 * Fb * sd * xmax) / (fallbackDia * fallbackDia),
    fitsInBox: fallbackLv >= minLengthCm && fallbackLv <= maxLengthCm,
  };
}

export function suggestPortConfig(Vb: number, Fb: number, params: SpeakerParams, flaredEnds: 0 | 1 | 2 | 3 = 0, minLength = 0): PortSuggestions {
  if (!params.sd || !params.xmax) {
    return { valid: false, reason: "Ingresa el área del cono (Sd) y excursión (Xmax) en la barra lateral para recibir sugerencias de puertos sin ruido de viento." };
  }

  // Diámetro mínimo para flujo silencioso (< 10 m/s) según ecuación de velocidad pico en Fb
  const dMinSilent = Math.sqrt((0.008 * Fb * params.sd * params.xmax) / 9.8);
  const standardSizes = [4.5, 5.0, 6.0, 7.5, 10.0, 15.0];
  const options: Array<{ numPorts: number; diameter: number; length: number; isCustom: boolean }> = [];

  // Opción óptima silenciosa (< 10 m/s)
  const dOpt1 = Number(dMinSilent.toFixed(1));
  const lvOpt1 = calcPortLength(Vb, Fb, dOpt1, flaredEnds, 1);
  if (lvOpt1 >= minLength) {
    options.push({
      numPorts: 1,
      diameter: dOpt1,
      length: lvOpt1,
      isCustom: false
    });
  }

  // Opción 2 puertos silenciosos (cuando 1 puerto queda muy ancho o largo)
  const dOpt2 = Number((dMinSilent / Math.sqrt(2)).toFixed(1));
  const lvOpt2 = calcPortLength(Vb, Fb, dOpt2, flaredEnds, 2);
  if (dOpt2 >= 3.5 && lvOpt2 >= minLength) {
    options.push({
      numPorts: 2,
      diameter: dOpt2,
      length: lvOpt2,
      isCustom: false
    });
  }

  // Opciones comerciales estándar (evaluar 1 y 2 puertos)
  standardSizes.forEach(size => {
    for (const numPorts of [1, 2]) {
      const vPeak = (0.008 * Fb * params.sd * params.xmax) / (numPorts * size * size);
      if (vPeak <= 17.0) {
        const lv = calcPortLength(Vb, Fb, size, flaredEnds, numPorts);
        if (lv >= minLength && !options.some(o => o.numPorts === numPorts && Math.abs(o.diameter - size) < 0.2)) {
          options.push({
            numPorts: numPorts,
            diameter: size,
            length: lv,
            isCustom: true
          });
        }
      }
    }
  });

  return {
    valid: true,
    dMin: dMinSilent,
    options
  };
}

// -------------------------------------------------------------
// ADVANCED ACOUSTIC SIMULATION EQUATIONS (Small-Keele & Margolis Models)
// -------------------------------------------------------------

export interface DriverMechProps {
  re: number;
  bl: number;
  mms: number; // in kg
  cms: number; // in m/N
  sdM2: number; // in m2
}

export function getDriverMechanicals(params: SpeakerParams): DriverMechProps {
  const re = params.re > 0 ? params.re : 6.0;
  const fs = params.fs > 0 ? params.fs : 38.0;
  const qes = params.qes > 0 ? params.qes : 0.45;
  const vasL = params.vas > 0 ? params.vas : 45.0;
  const sdCm2 = params.sd > 0 ? params.sd : 215.0;
  const sdM2 = sdCm2 * 1e-4;

  const cms = params.cms && params.cms > 0
    ? params.cms * 1e-3
    : (vasL * 1e-3) / (1.204 * Math.pow(344, 2) * Math.pow(sdM2, 2));

  const mms = params.mms && params.mms > 0
    ? params.mms * 1e-3
    : 1.0 / (Math.pow(2 * Math.PI * fs, 2) * cms);

  const bl = params.bl && params.bl > 0
    ? params.bl
    : Math.sqrt((2 * Math.PI * fs * mms * re) / qes);

  return { re, bl, mms, cms, sdM2 };
}

/**
 * Desplazamiento pico del cono (Cone Excursion) en mm según modelo electroacústico de Small-Margolis
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
  const wasm = getWasm();
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
  const fs = params.fs || 38;
  const qts = params.qts || 0.38;
  const vas = params.vas || 45;
  const mech = getDriverMechanicals(params);
  const eg = Math.sqrt(Math.max(0.1, powerWatts) * mech.re);

  if (!isPorted) {
    const alpha = vas / vb;
    const fc = fs * Math.sqrt(1 + alpha);
    const qtc = qts * Math.sqrt(1 + alpha);
    const denom = Math.sqrt(Math.pow(Math.pow(f, 2) - Math.pow(fc, 2), 2) + Math.pow((f * fc) / qtc, 2) + 1e-18);
    const xMeters = (eg * (mech.bl / mech.re) / (mech.mms * 4 * Math.pow(Math.PI, 2))) * (1.0 / denom);
    return Math.max(0, xMeters * 1000);
  } else {
    const h = fb / fs;
    const alpha = vas / vb;
    const ql = QL_LOSSES;
    const a3 = 1 / qts + h / ql;
    const a2 = 1 + h * h * (1 + alpha) + h / (qts * ql);
    const a1 = (h * h) / qts + h / ql;
    const a0 = h * h;

    const y = f / fs;
    const real = Math.pow(y, 4) - a2 * Math.pow(y, 2) + a0;
    const imag = a1 * y - a3 * Math.pow(y, 3);
    const denom = Math.sqrt(real * real + imag * imag + 1e-18);

    const numX = Math.abs(Math.pow(y, 2) - Math.pow(h, 2));
    const xMeters = (eg * (mech.bl / mech.re) / (mech.mms * 4 * Math.pow(Math.PI, 2) * Math.pow(fs, 2))) * (numX / denom);
    return Math.max(0, xMeters * 1000);
  }
}

/**
 * Velocidad del aire en el conducto (Vent Air Velocity) en m/s según modelo aerodinámico de Small
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
  const wasm = getWasm();
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
  const fs = params.fs || 38;
  const qts = params.qts || 0.38;
  const vas = params.vas || 45;
  const mech = getDriverMechanicals(params);
  const eg = Math.sqrt(Math.max(0.1, powerWatts) * mech.re);

  const h = fb / fs;
  const alpha = vas / vb;
  const ql = QL_LOSSES;
  const a3 = 1 / qts + h / ql;
  const a2 = 1 + h * h * (1 + alpha) + h / (qts * ql);
  const a1 = (h * h) / qts + h / ql;
  const a0 = h * h;

  const y = f / fs;
  const real = Math.pow(y, 4) - a2 * Math.pow(y, 2) + a0;
  const imag = a1 * y - a3 * Math.pow(y, 3);
  const denom = Math.sqrt(real * real + imag * imag + 1e-18);

  // Flujo volumétrico acústico U_port (m3/s)
  const uPort = (eg * (mech.bl / mech.re) * mech.sdM2 / (mech.mms * 2 * Math.PI * fs)) * (Math.pow(h, 2) / denom);
  return Math.max(0, uPort / portAreaM2);
}

/**
 * Impedancia eléctrica del sistema (System Impedance) en Ohms según circuito equivalente de Small
 */
export function calcSystemImpedance(
  f: number,
  params: SpeakerParams,
  vb: number,
  fb: number,
  isPorted: boolean
): number {
  if (f <= 0 || vb <= 0) return params.re || 4;
  const wasm = getWasm();
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
  const re = params.re || 3.6;
  const fs = params.fs || 35;
  const qes = params.qes || 0.42;
  const qms = params.qms || 4.0;
  const qts = params.qts || (qes * qms) / (qes + qms);
  const vas = params.vas || 60;
  const leMh = params.le || 1.0;
  const r0 = re * (qms / qes);
  const omegaL = 2 * Math.PI * f * (leMh * 1e-3);

  if (!isPorted) {
    const alpha = vas / vb;
    const fc = fs * Math.sqrt(1 + alpha);
    const qmc = qms * Math.sqrt(1 + alpha);
    const fn_ = f / fc;
    // Zmotional = R0 / (1 + j*Qmc*(fn - 1/fn))
    const denomReal = 1.0;
    const denomImag = qmc * (fn_ - 1.0 / fn_);
    const denMagSq = denomReal * denomReal + denomImag * denomImag + 1e-18;
    const zMotReal = (r0 * denomReal) / denMagSq;
    const zMotImag = (-r0 * denomImag) / denMagSq;

    const zTotReal = re + zMotReal;
    const zTotImag = zMotImag + omegaL;
    return Math.sqrt(zTotReal * zTotReal + zTotImag * zTotImag);
  } else {
    const h = fb / fs;
    const alpha = vas / vb;
    const ql = QL_LOSSES;
    const a3 = 1 / qts + h / ql;
    const a2 = 1 + h * h * (1 + alpha) + h / (qts * ql);
    const a1 = (h * h) / qts + h / ql;
    const a0 = h * h;

    const y = f / fs;
    const realDen = Math.pow(y, 4) - a2 * Math.pow(y, 2) + a0;
    const imagDen = a1 * y - a3 * Math.pow(y, 3);

    // Numerator: R0 * (j*y) * [ (1 - (y/h)^2) + j*(y/(h*QL)) ]
    const yh = y / h;
    const boxReal = 1.0 - Math.pow(yh, 2);
    const boxImag = yh / ql;

    // j * y * (boxReal + j*boxImag) = -y*boxImag + j*y*boxReal
    const numReal = r0 * (-y * boxImag);
    const numImag = r0 * (y * boxReal);

    // Division (numReal + j*numImag) / (realDen + j*imagDen)
    const denMagSq = realDen * realDen + imagDen * imagDen + 1e-18;
    const zMotReal = (numReal * realDen + numImag * imagDen) / denMagSq;
    const zMotImag = (numImag * realDen - numReal * imagDen) / denMagSq;

    const zTotReal = re + zMotReal;
    const zTotImag = zMotImag + omegaL;
    return Math.max(re * 0.8, Math.sqrt(zTotReal * zTotReal + zTotImag * zTotImag));
  }
}

/**
 * Respuesta de fase acústica (Phase Response) en grados (°):
 */
export function calcPhaseResponse(
  f: number,
  params: SpeakerParams,
  vb: number,
  fb: number,
  isPorted: boolean
): number {
  if (f <= 0 || vb <= 0) return 0;
  const wasm = getWasm();
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
  const fs = params.fs || 38;
  const qts = params.qts || 0.38;
  const vas = params.vas || 45;

  if (!isPorted) {
    const alpha = vas / vb;
    const fc = fs * Math.sqrt(1 + alpha);
    const qtc = qts * Math.sqrt(1 + alpha);
    const fn_ = f / fc;
    const real = 1.0 - Math.pow(fn_, 2);
    const imag = fn_ / qtc;
    const angleRad = Math.PI - Math.atan2(imag, real);
    let deg = (angleRad * 180) / Math.PI;
    if (deg > 180) deg -= 360;
    return deg;
  } else {
    const h = fb / fs;
    const alpha = vas / vb;
    const ql = QL_LOSSES;
    const a3 = 1 / qts + h / ql;
    const a2 = 1 + h * h * (1 + alpha) + h / (qts * ql);
    const a1 = (h * h) / qts + h / ql;
    const a0 = h * h;

    const y = f / fs;
    const real = Math.pow(y, 4) - a2 * Math.pow(y, 2) + a0;
    const imag = a1 * y - a3 * Math.pow(y, 3);
    const angleRad = -Math.atan2(imag, real);
    let deg = (angleRad * 180) / Math.PI;
    while (deg < 0) deg += 360;
    if (deg > 180) deg -= 360;
    return deg;
  }
}

/**
 * Retardo de grupo (Group Delay) en ms: tau_g = -(1/360) * (dPhase / df) * 1000
 */
export function calcGroupDelayCurve(
  freqs: number[],
  params: SpeakerParams,
  vb: number,
  fb: number,
  isPorted: boolean
): number[] {
  const phases = freqs.map(f => calcPhaseResponse(f, params, vb, fb, isPorted));
  const delays: number[] = [];

  for (let i = 0; i < freqs.length; i++) {
    let dPhase: number;
    let dFreq: number;
    if (i === 0) {
      dPhase = phases[1] - phases[0];
      dFreq = freqs[1] - freqs[0];
    } else if (i === freqs.length - 1) {
      dPhase = phases[i] - phases[i - 1];
      dFreq = freqs[i] - freqs[i - 1];
    } else {
      dPhase = phases[i + 1] - phases[i - 1];
      dFreq = freqs[i + 1] - freqs[i - 1];
    }

    // Unwrap if wrapped
    if (dPhase > 180) dPhase -= 360;
    if (dPhase < -180) dPhase += 360;

    const gdMs = Math.max(0, -((1 / 360) * (dPhase / dFreq)) * 1000);
    delays.push(Math.min(100, Math.round(gdMs * 100) / 100));
  }
  return delays;
}
