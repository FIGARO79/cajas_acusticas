import type { SpeakerParams, CalculatedSealed, CalculatedPorted, PortSuggestions } from '../types';

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
