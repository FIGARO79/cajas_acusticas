import type { SpeakerParams, CalculatedSealed, CalculatedPorted } from '../types';

export const QL_LOSSES = 7.0;

// Logarithmic frequency sweep 10 Hz - 500 Hz
export const chartFrequencies: number[] = (() => {
  const freqs: number[] = [];
  for (let i = 0; i <= 100; i++) {
    const f = 10 * Math.pow(500 / 10, i / 100);
    freqs.push(Math.round(f * 10) / 10);
  }
  return freqs;
})();

export function runProCalculations(params: SpeakerParams) {
  let cms = params.cms;
  let mms = params.mms;
  let bl = params.bl;
  let vd = params.vd;

  let autoCms = false;
  let autoMms = false;
  let autoBl = false;
  let autoVd = false;

  if (!cms && params.vas && params.sd) {
    cms = 716.1 * params.vas / (params.sd * params.sd);
    autoCms = true;
  }
  if (!mms && params.fs && cms) {
    mms = 25330 / (params.fs * params.fs * cms);
    autoMms = true;
  }
  if (!bl && params.fs && mms && params.re && params.qes) {
    bl = Math.sqrt((2 * Math.PI * params.fs * (mms / 1000) * params.re) / params.qes);
    autoBl = true;
  }
  if (!vd && params.sd && params.xmax) {
    vd = params.sd * (params.xmax / 10);
    autoVd = true;
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
    cms: cms || 0,
    mms: mms || 0,
    bl: bl || 0,
    vd: vd || 0,
    eta0,
    spl,
    splMax,
    rms,
    zmax,
    autoCms,
    autoMms,
    autoBl,
    autoVd
  };
}

export function calculateSuggestedPorted(params: SpeakerParams) {
  const qts = params.qts;
  const fs = params.fs;
  const vas = params.vas;
  let Vb: number;
  let Fb: number;
  let F3: number;
  let alignmentName: string;

  if (qts < 0.35) {
    // SBB4 (Sub-Butterworth de 4.º Orden)
    Vb = 11 * Math.pow(qts, 2.87) * vas;
    Fb = 0.38 * Math.pow(qts, -0.95) * fs;
    F3 = 0.38 * Math.pow(qts, -0.95) * fs;
    alignmentName = 'SBB4';
  } else if (qts >= 0.35 && qts <= 0.40) {
    // B4 (Butterworth de 4.º Orden)
    Vb = 0.25 * Math.pow(qts, -2) * vas;
    Fb = fs;
    F3 = fs;
    alignmentName = 'B4';
  } else {
    // QB3 (Quasi-Butterworth de 3.er Orden)
    Vb = 6.27 * Math.pow(qts, 1.44) * vas;
    Fb = 0.94 * Math.pow(qts, -0.9) * fs;
    F3 = 1.2 * Math.pow(qts, -0.9) * fs;
    alignmentName = 'QB3';
  }

  return { Vb, Fb, F3, alignmentName };
}

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

export function suggestPortConfig(Vb: number, Fb: number, params: SpeakerParams, flaredEnds: 0 | 1 | 2 = 0, minLength = 0) {
  if (!params.sd || !params.xmax) {
    return { valid: false, reason: "Ingresa el área del cono (Sd) y excursión (Xmax) en la barra lateral para recibir sugerencias de puertos sin ruido de viento." };
  }

  const dMin = Math.sqrt((0.1 * params.sd * params.xmax) / Math.sqrt(Fb));
  const standardSizes = [5.0, 7.5, 10.0, 15.0];
  const options = [];

  const kCorrection = flaredEnds === 1 ? 0.850 : flaredEnds === 2 ? 0.968 : 0.732;

  // Theoretical exact min option
  const lvMin = ((23562.5 * Math.pow(dMin, 2)) / (Fb * Fb * Vb)) - (kCorrection * dMin);
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
      const lv = ((23562.5 * Math.pow(size, 2) * numPorts) / (Fb * Fb * Vb)) - (kCorrection * size);
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

export function getSealedCurve(sealed: CalculatedSealed, params: SpeakerParams): number[] {
  if (!sealed.valid || sealed.Vb <= 0) return chartFrequencies.map(() => 0);
  
  const fs = params.fs;
  const qts = params.qts;
  const alpha = params.vas / sealed.Vb;
  const fc = fs * Math.sqrt(alpha + 1);
  const qtc = qts * Math.sqrt(alpha + 1);

  return chartFrequencies.map(f => {
    const fn = f / fc;
    const response = Math.pow(fn, 2) / Math.sqrt(Math.pow(Math.pow(fn, 2) - 1, 2) + Math.pow(fn / qtc, 2));
    const responseDb = 20 * Math.log10(response + 1e-10);
    return Math.round(responseDb * 100) / 100;
  });
}

export function getPortedCurve(ported: CalculatedPorted, params: SpeakerParams): number[] {
  if (!ported.valid || ported.Vb <= 0) return chartFrequencies.map(() => 0);

  const fs = params.fs;
  const qts = params.qts;
  const vas = params.vas;
  const Vb = ported.Vb;
  const Fb = ported.Fb;

  const h = Fb / fs;
  const alpha = vas / Vb;
  const Ql = QL_LOSSES;

  const a3 = 1 / qts + h / Ql;
  const a2 = 1 + h * h * (1 + alpha) + h / (qts * Ql);
  const a1 = h * h / qts + h / Ql;
  const a0 = h * h;

  return chartFrequencies.map(f => {
    const y = f / fs;
    const real = Math.pow(y, 4) - a2 * y * y + a0;
    const imag = a1 * y - a3 * Math.pow(y, 3);
    const response = Math.pow(y, 4) / Math.sqrt(real * real + imag * imag + 1e-20);
    const responseDb = 20 * Math.log10(response + 1e-10);
    return Math.round(responseDb * 100) / 100;
  });
}
