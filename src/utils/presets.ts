import type { SpeakerParams } from '../types';

export interface PresetItem {
  id: string;
  name: string;
  params: SpeakerParams;
}

export const PRESETS: Record<string, PresetItem> = {
  sub12: {
    id: 'sub12',
    name: 'Subwoofer de 12" Competitivo (Ejemplo)',
    params: {
      fs: 28,
      vas: 65,
      qms: 5.0,
      qes: 0.45,
      qts: 0.41,
      sd: 510,
      xmax: 14,
      re: 3.6,
      le: 1.2,
      bl: 15.5,
      mms: 185,
      cms: 0.17,
      pe: 400,
      xlim: 22
    }
  },
  hifi8: {
    id: 'hifi8',
    name: 'Woofer Hi-Fi de 8" de Cono de Papel (Ejemplo)',
    params: {
      fs: 38,
      vas: 45,
      qms: 3.8,
      qes: 0.40,
      qts: 0.36,
      sd: 215,
      xmax: 5.5,
      re: 5.8,
      le: 0.6,
      bl: 8.5,
      mms: 28,
      cms: 0.62,
      pe: 80,
      xlim: 10
    }
  },
  pro10: {
    id: 'pro10',
    name: 'Medio-Bajo Pro Audio 10" Alta Sensibilidad (Ejemplo)',
    params: {
      fs: 60,
      vas: 35,
      qms: 6.2,
      qes: 0.32,
      qts: 0.30,
      sd: 350,
      xmax: 3.5,
      re: 5.2,
      le: 0.4,
      bl: 12.8,
      mms: 34,
      cms: 0.21,
      pe: 250,
      xlim: 8
    }
  },
  eminence10: {
    id: 'eminence10',
    name: 'Eminence Legend CA10-8 (Real)',
    params: {
      fs: 50,
      vas: 82.2,
      qms: 5.21,
      qes: 0.66,
      qts: 0.59,
      sd: 355.4,
      xmax: 3.2,
      re: 5.31,
      le: 0.66,
      bl: 7.5,
      mms: 22,
      cms: 0.46,
      pe: 150,
      xlim: 9.1,
      diaNominal: '10" (254 mm)',
      zNominal: 8,
      pProg: 300,
      freqMin: 57,
      freqMax: 4500,
      sens: 95.6,
      magWeight: 20,
      gapHeight: 6.4,
      vcDiameter: 38,
      vd: 114
    }
  }
};
