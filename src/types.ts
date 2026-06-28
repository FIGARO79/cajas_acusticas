export interface SpeakerParams {
  fs: number;
  vas: number;
  qms: number;
  qes: number;
  qts: number;
  sd: number;
  xmax: number;
  re: number;
  le: number;
  bl?: number;
  mms?: number;
  cms?: number;
  pe?: number;
  xlim?: number;
  diaNominal?: string;
  zNominal?: number;
  pProg?: number;
  freqMin?: number;
  freqMax?: number;
  sens?: number;
  magWeight?: number;
  gapHeight?: number;
  vcDiameter?: number;
  vd?: number;
}

export interface CalculatedSealed {
  valid: boolean;
  Vb: number;
  Fc: number;
  Qtc: number;
  F3: number;
}

export interface CalculatedPorted {
  valid: boolean;
  Vb: number;
  Fb: number;
  F3: number;
  Fs: number;
  Qts: number;
  Vas: number;
  alignment: string;
}

export interface CalculatedBandpass {
  valid: boolean;
  order: 4 | 6;
  Vf: number;
  Vr: number;
  Fb: number;
  F0?: number;
  delta_f?: number;
  Fl?: number;
  Fh?: number;
}


export interface WoodCutPiece {
  name: string;
  qty: number;
  dimensions: string;
}

export interface WoodCabinetData {
  valid: boolean;
  vNeto: number;
  vTotal: number;
  vExtra: number;
  hInt: number;
  wInt: number;
  dInt: number;
  dTrapTopInt?: number;
  dTrapBotInt?: number;
  hExt: number;
  wExt: number;
  dExt: number;
  dTrapTopExt?: number;
  dTrapBotExt?: number;
  thickness: number;
  pieces: WoodCutPiece[];
}

export interface CustomDriver {
  id: string;
  brand: string;
  model: string;
  params: SpeakerParams;
  isCustom: boolean;
}

