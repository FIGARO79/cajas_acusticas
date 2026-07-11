import type { SpeakerParams, PortSuggestions } from '../types';

const QL_LOSSES = 7.0;

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

