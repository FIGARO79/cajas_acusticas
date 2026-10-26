import type { SpeakerParams, PortSuggestions } from '../types';

export const QL_LOSSES = 7.0;

export function getKCorrection(flaredEnds: number): number {
  return flaredEnds === 1 ? 0.850 : flaredEnds === 2 ? 0.968 : 0.732;
}

export function calcPortLength(vb: number, fb: number, dv: number, flaredEnds: number, numPorts = 1): number {
  if (vb <= 0 || fb <= 0 || dv <= 0) return 0;
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

export function suggestPortConfig(Vb: number, Fb: number, params: SpeakerParams, flaredEnds: 0 | 1 | 2 = 0, minLength = 0): PortSuggestions {
  if (!params.sd || !params.xmax) {
    return { valid: false, reason: "Ingresa el área del cono (Sd) y excursión (Xmax) en la barra lateral para recibir sugerencias de puertos sin ruido de viento." };
  }

  const dMin = Math.sqrt((0.1 * params.sd * params.xmax) / Math.sqrt(Fb));
  const standardSizes = [5.0, 7.5, 10.0, 15.0];
  const options = [];

  // Theoretical exact min option
  const lvMin = calcPortLength(Vb, Fb, dMin, flaredEnds, 1);
  if (lvMin >= minLength) {
    options.push({
      numPorts: 1,
      diameter: dMin,
      length: lvMin,
      isCustom: false
    });
  }

  // Commercial options
  standardSizes.forEach(size => {
    const numPorts = Math.ceil(Math.pow(dMin / size, 2));
    if (numPorts > 0 && numPorts <= 4) {
      const lv = calcPortLength(Vb, Fb, size, flaredEnds, numPorts);
      if (lv >= minLength) {
        options.push({
          numPorts: numPorts,
          diameter: size,
          length: lv,
          isCustom: true
        });
      }
    }
  });

  return {
    valid: true,
    dMin,
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
