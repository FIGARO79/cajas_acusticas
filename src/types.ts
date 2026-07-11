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

export interface PortSuggestionOption {
  numPorts: number;
  diameter: number;
  length: number;
  isCustom: boolean;
}

export type PortSuggestions = {
  valid: false;
  reason: string;
} | {
  valid: true;
  dMin: number;
  options: PortSuggestionOption[];
};

export interface FilterComponents2Way {
  c1: number | null;
  l1: number | null;
  c2?: number;
  l2?: number;
}

export interface FilterComponents3WayBP {
  c_hp?: number | null;
  l_hp?: number | null;
  l_lp?: number | null;
  c_lp?: number | null;
  c1_hp?: number;
  c2_hp?: number;
  l1_hp?: number;
  l2_hp?: number;
  c1_lp?: number;
  c2_lp?: number;
  l1_lp?: number;
  l2_lp?: number;
}

export type CrossoverResult = {
  ways: '2way';
  type: string;
  hp: FilterComponents2Way;
  lp: FilterComponents2Way;
} | {
  ways: '3way';
  type: string;
  hp: FilterComponents2Way;
  bp: FilterComponents3WayBP;
  lp: FilterComponents2Way;
};

export interface CrossoverExportData {
  crossoverWays: '2way' | '3way';
  crossoverType: string;
  fc: number;
  fcLow: number;
  fcHigh: number;
  zTweeter: number;
  zMidrange: number;
  zWoofer: number;
  enableZobel: boolean;
  re: number;
  le: number;
  enableLPad: boolean;
  attenuation: number;
  zLoad: number;
  xoverResults: CrossoverResult | null;
  zobelResults: { rz: number; cz: number } | null;
  lpadResults: { r1: number; r2: number } | null;
}

export interface DatabaseWoofer {
  ID?: number;
  Model?: string;
  "Company ID": number;
  Vas?: number;
  Sd?: number;
  Xlin?: number;
  Le?: number;
  Mms?: number;
  Cms?: number;
  Xmech?: number;
  "Dimen A1"?: number;
  "P-Vd"?: number;
  Fs?: number;
  Qms?: number;
  Qes?: number;
  Qts?: number;
  Re?: number;
  Pe?: number;
  _isCustom?: boolean;
  _customBrand?: string;
}


