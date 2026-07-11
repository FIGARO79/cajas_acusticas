import { useState, useEffect, useRef, useCallback, useDeferredValue } from 'react';
import { Header } from './components/Header';
import { SpeakerParamsForm } from './components/SpeakerParamsForm';
import { BoxParamsForm } from './components/BoxParamsForm';
import { SimulationChart } from './components/SimulationChart';
import { CabinetTab } from './components/CabinetTab';
import { CrossoverTab } from './components/CrossoverTab';
import { type Lang, translate } from './utils/translations';
import { type UnitSystem, convertTo, getUnitLabel } from './utils/units';
import type { SpeakerParams, CalculatedSealed, CalculatedPorted, CalculatedBandpass, CustomDriver, WoodCabinetData, CrossoverExportData } from './types';
import { estimateF3 } from './utils/acousticMath';
import { getWasm, initWasm } from './wasm/index.ts';
import { generateReportHTML } from './utils/reportGenerator';

function App() {
  // Theme & Language
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lang') as Lang) || 'es');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(() => (localStorage.getItem('unitSystem') as UnitSystem) || 'metric');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('theme') as 'dark' | 'light') || 'dark');
  const [activeTab, setActiveTab] = useState<'wood' | 'damping' | 'crossover'>('wood');
  const [boxType, setBoxType] = useState<'sealed' | 'ported' | 'bandpass'>('sealed');
  const t = (text: string) => translate(text, lang);

  // Crossover State
  const [crossoverWays, setCrossoverWays] = useState<number>(2);
  const [crossoverType, setCrossoverType] = useState<'1st_order' | '2nd_butter' | '2nd_lr' | '4th_lr'>('2nd_lr');
  const [fc, setFc] = useState<number>(2500);
  const [fcLow, setFcLow] = useState<number>(500);
  const [fcHigh, setFcHigh] = useState<number>(4000);
  const [zTweeter, setZTweeter] = useState<number>(8);
  const [zMidrange, setZMidrange] = useState<number>(8);
  const [zWoofer, setZWoofer] = useState<number>(8);
  const [enableZobel, setEnableZobel] = useState<boolean>(false);
  const [zobelRe, setZobelRe] = useState<number>(5.8);
  const [zobelLe, setZobelLe] = useState<number>(0.6);
  const [enableLPad, setEnableLPad] = useState<boolean>(false);
  const [lpadAttenuation, setLpadAttenuation] = useState<number>(3);
  const [lpadZLoad, setLpadZLoad] = useState<number>(8);

  // Bandpass State
  const [bandpassOrder, setBandpassOrder] = useState<4 | 6>(4);
  const [bandpassS, setBandpassS] = useState<number>(0.707);
  const [bandpassA, setBandpassA] = useState<number>(2.0);

  // Altavoces personalizados guardados en localStorage
  const [customDrivers, setCustomDrivers] = useState<CustomDriver[]>(() => {
    try {
      const saved = localStorage.getItem('custom_drivers');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleCustomDriversChange = (updated: CustomDriver[]) => {
    setCustomDrivers(updated);
    try {
      localStorage.setItem('custom_drivers', JSON.stringify(updated));
    } catch (err) {
      console.error('Error al guardar custom_drivers en localStorage:', err);
    }
  };
  const [preset, setPreset] = useState<string>('hifi8');

  // Speaker parameters
  const [params, setParams] = useState<SpeakerParams>({
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
  });

  const [driverConfig, setDriverConfig] = useState<string>('single');

  // Sliders and tuning overrides
  const [targetQtc, setTargetQtc] = useState<number>(0.707);
  const [customVbState, setCustomVbState] = useState<number | null>(null);
  const [customFbState, setCustomFbState] = useState<number | null>(null);
  const [customPorted, setCustomPorted] = useState<boolean>(false);

  // Ports configuration
  const [portCount, setPortCount] = useState<number | ''>(1);
  const [portDiameter, setPortDiameter] = useState<number | ''>(7.5);
  const [portShape, setPortShape] = useState<'round' | 'rectangular' | 'custom'>('round');
  const [portWidth, setPortWidth] = useState<number | ''>(10);
  const [portHeight, setPortHeight] = useState<number | ''>(5);
  const [portArea, setPortArea] = useState<number | ''>(50);
  const [flaredEnds, setFlaredEnds] = useState<0 | 1 | 2>(0);
  const [useCustomPortLength, setUseCustomPortLength] = useState<boolean>(false);
  const [customPortLength, setCustomPortLength] = useState<number | ''>('');

  // Radiador Pasivo
  const [prTuning, setPrTuning] = useState<'port' | 'radiator'>('port');
  const [prDia, setPrDia] = useState<number>(20);
  const [prVas, setPrVas] = useState<number>(45);
  const [prFs, setPrFs] = useState<number>(25);
  const [prMms, setPrMms] = useState<number>(35);

  // Woodworking parameters
  const [woodMode, setWoodMode] = useState<'calc' | 'input'>('calc');
  const [woodShape, setWoodShape] = useState<'rectangular' | 'trapezoidal'>('rectangular');
  const [woodConstraint, setWoodConstraint] = useState<string>('none');
  const [woodRatio, setWoodRatio] = useState<'golden' | 'classic' | 'cube'>('golden');
  const [dampingType, setDampingType] = useState<'none' | 'light' | 'moderate' | 'heavy'>('none');

  const getDampingFactor = () => {
    switch (dampingType) {
      case 'light': return 1.05;
      case 'moderate': return 1.12;
      case 'heavy': return 1.20;
      default: return 1.00;
    }
  };
  const dampingFactor = getDampingFactor();

  // Lock sizes for Auto Wood
  const [woodLockVal1, setWoodLockVal1] = useState<number | ''>(40);
  const [woodLockVal2, setWoodLockVal2] = useState<number | ''>(30);
  const [woodLockVal3, setWoodLockVal3] = useState<number | ''>(20);

  // Manual dimensions
  const [woodExtHeight, setWoodExtHeight] = useState<number | ''>(42);
  const [woodExtWidth, setWoodExtWidth] = useState<number | ''>(32);
  const [woodExtDepth, setWoodExtDepth] = useState<number | ''>(28);

  const [woodTrapExtHeight, setWoodTrapExtHeight] = useState<number | ''>(40);
  const [woodTrapExtWidth, setWoodTrapExtWidth] = useState<number | ''>(45);
  const [woodTrapExtDepthTop, setWoodTrapExtDepthTop] = useState<number | ''>(18);
  const [woodTrapExtDepthBot, setWoodTrapExtDepthBot] = useState<number | ''>(32);

  const [woodThickness, setWoodThickness] = useState<number | ''>(15);
  const [woodExtra, setWoodExtra] = useState<number | ''>(3.5);

  const [speakerYPct, setSpeakerYPct] = useState<number>(50);
  const [portYPct, setPortYPct] = useState<number>(85);

  // Shared state for technical report exporting
  const cabinetRef = useRef<WoodCabinetData | null>(null);
  const handleCabinetDataChange = useCallback((data: WoodCabinetData) => {
    cabinetRef.current = data;
  }, []);
  const crossoverRef = useRef<(() => CrossoverExportData) | null>(null);
  const handleRegisterCrossover = useCallback((exp: () => CrossoverExportData) => {
    crossoverRef.current = exp;
  }, []);



  // Sync theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Sync lang to document element and storage
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem('lang', lang);
  }, [lang]);

  // Sync unitSystem to storage
  useEffect(() => {
    localStorage.setItem('unitSystem', unitSystem);
  }, [unitSystem]);

  // Initialize WASM module on component mount
  useEffect(() => {
    initWasm().catch(err => console.error('WASM init error:', err));
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handlePresetChange = (presetId: string, newParams: SpeakerParams | null) => {
    setPreset(presetId);
    setCustomVbState(null);
    setCustomFbState(null);
    setCustomPorted(false);
    if (newParams) {
      // Compute Qts automatically if Qms and Qes are provided but Qts is missing
      const updatedParams: SpeakerParams = { ...newParams };
      if (updatedParams.qms && updatedParams.qes && (updatedParams.qts === undefined || updatedParams.qts === null)) {
        updatedParams.qts = Math.round((updatedParams.qms * updatedParams.qes) / (updatedParams.qms + updatedParams.qes) * 1000) / 1000;
      }
      setParams(updatedParams);
      // Automatically toggle pro parameters if specifications exist
      if (updatedParams.diaNominal) {
        // Preset contains nominal specs, could enable pro calculations UI
      }
    } else {
      setParams({
        fs: 0,
        vas: 0,
        qms: 0,
        qes: 0,
        qts: 0,
        sd: 0,
        xmax: 0,
        re: 0,
        le: 0
      });
    }
  };

  // Adjust parameters based on driver configuration (Parallel/Series/Isobaric)
  const getAdjustedParams = (): SpeakerParams => {
    const adj = { ...params };
    if (!adj.fs || !adj.vas || !adj.qts) return adj;

    if (driverConfig === 'parallel_2') {
      adj.vas = params.vas * 2;
    } else if (driverConfig === 'series_2') {
      adj.vas = params.vas * 2;
    } else if (driverConfig === 'isobaric') {
      adj.vas = params.vas * 0.5;
    }
    return adj;
  };

  const adjParams = getAdjustedParams();

  // Validate parameters
  const validationError = (!params.fs || !params.vas || !params.qts)
    ? translate("Completa los parámetros mínimos del altavoz (Fs, Vas, Qts).", lang)
    : null;



  // Manual wood volume calculation (needed for link overrides)
  // Manual wood volume calculation (needed for link overrides)
  const getManualWoodNetVolume = () => {
    const thickness = (woodThickness || 0) / 10;
    const extra = woodExtra || 0;
    let bruto = 0;
    if (woodShape === 'rectangular') {
      const hExt = woodExtHeight || 0;
      const wExt = woodExtWidth || 0;
      const dExt = woodExtDepth || 0;
      const hInt = hExt - (2 * thickness);
      const wInt = wExt - (2 * thickness);
      const dInt = dExt - (2 * thickness);
      if (hInt > 0 && wInt > 0 && dInt > 0) {
        bruto = (hInt * wInt * dInt) / 1000;
      }
    } else {
      const hExt = woodTrapExtHeight || 0;
      const wExt = woodTrapExtWidth || 0;
      const d1Ext = woodTrapExtDepthTop || 0;
      const d2Ext = woodTrapExtDepthBot || 0;
      const hInt = hExt - (2 * thickness);
      const wInt = wExt - (2 * thickness);
      const d1Int = Math.max(0, d1Ext - (2 * thickness));
      const d2Int = Math.max(0, d2Ext - (2 * thickness));
      if (hInt > 0 && wInt > 0 && d1Int > 0 && d2Int > 0) {
        const dAvgInt = (d1Int + d2Int) / 2;
        bruto = (hInt * wInt * dAvgInt) / 1000;
      }
    }

    if (bruto <= 0) return 0;

    let targetFb = customFb;
    if (!customPorted) {
      try {
        const wasm = getWasm();
        if (wasm && adjParams.fs && adjParams.vas && adjParams.qts) {
          const result = wasm.calc_alineacion_ventilada(adjParams.fs, adjParams.vas, adjParams.qts, "QB3");
          targetFb = result.fb;
        }
      } catch (e) {
        console.warn("Could not calculate optimal Vb/Fb from Wasm:", e);
      }
    }

    const pCount = Number(portCount) || 0;
    let portVol = 0;
    if (pCount > 0 && boxType === 'ported' && targetFb > 0) {
      const isRect = portShape === 'rectangular';
      const pDia = portShape === 'round'
        ? (Number(portDiameter) || 0)
        : portShape === 'custom'
          ? (2 * Math.sqrt((Number(portArea) || 0) / Math.PI))
          : (2 * Math.sqrt(((Number(portWidth) || 0) * (Number(portHeight) || 0)) / Math.PI));

      if (pDia > 0) {
        if (useCustomPortLength && Number(customPortLength) > 0) {
          const Lv = Number(customPortLength);
          if (isRect) {
            const w = Number(portWidth) || 0;
            const h = Number(portHeight) || 0;
            portVol = (pCount * w * h * Lv) / 1000;
          } else {
            portVol = (pCount * Math.PI * Math.pow(pDia / 2, 2) * Lv) / 1000;
          }
        } else {
          const kCorrection = flaredEnds === 1 ? 0.850 : flaredEnds === 2 ? 0.968 : 0.732;
          let currentNetVol = bruto - extra; // Initial guess of physical net volume
          
          // Solve the circular reference (netVol -> targetVb -> portLength -> portVol -> netVol) iteratively
          for (let iter = 0; iter < 4; iter++) {
            const targetVb = currentNetVol * dampingFactor;
            if (targetVb <= 0) {
              portVol = 0;
              break;
            }
            const Lv = ((23562.5 * Math.pow(pDia, 2) * pCount) / (targetFb * targetFb * targetVb)) - (kCorrection * pDia);
            if (Lv > 0) {
              if (isRect) {
                const w = Number(portWidth) || 0;
                const h = Number(portHeight) || 0;
                portVol = (pCount * w * h * Lv) / 1000;
              } else {
                portVol = (pCount * Math.PI * Math.pow(pDia / 2, 2) * Lv) / 1000;
              }
            } else {
              portVol = 0;
            }
            currentNetVol = Math.max(0, bruto - (extra + portVol));
          }
        }
      }
    }

    return Math.max(0, bruto - (extra + portVol));
  };

  const manualNetVol = getManualWoodNetVolume();

  // --- CALCULAR CAJA SELLADA ---
  const calculateSealed = (): CalculatedSealed => {
    if (validationError || !adjParams.fs || !adjParams.vas || !adjParams.qts) {
      return { valid: false, Vb: 0, Fc: 0, Qtc: targetQtc, F3: 0 };
    }

    const wasm = getWasm();

    if (woodMode === 'input' && manualNetVol > 0) {
      const sealedVb = manualNetVol * dampingFactor;
      const alpha = adjParams.vas / sealedVb;
      const sealedQtc = adjParams.qts * Math.sqrt(alpha + 1);
      
      // We calculate Fc and F3 correctly using Wasm by passing the resulting vb
      const result = wasm.calc_caja_sellada(adjParams.fs, adjParams.vas, adjParams.qts, sealedVb, targetQtc);
      return {
        valid: true,
        Vb: sealedVb,
        Fc: result.fc,
        Qtc: sealedQtc,
        F3: result.f3
      };
    } else {
      if (adjParams.qts >= targetQtc) {
        return { valid: false, Vb: 0, Fc: 0, Qtc: targetQtc, F3: 0 };
      }
      
      // To get optimal vb from Qtc, we can pass a dummy vb_target and read vb_optimo
      const tempResult = wasm.calc_caja_sellada(adjParams.fs, adjParams.vas, adjParams.qts, 10.0, targetQtc);
      const optimalVb = tempResult.vb_optimo;
      
      const result = wasm.calc_caja_sellada(adjParams.fs, adjParams.vas, adjParams.qts, optimalVb, targetQtc);

      return {
        valid: true,
        Vb: optimalVb,
        Fc: result.fc,
        Qtc: result.qtc,
        F3: result.f3
      };
    }
  };

  const sealedData = calculateSealed();

  // --- CALCULAR CAJA VENTILADA ---
  const calculatePorted = (): CalculatedPorted => {
    if (validationError || !adjParams.fs || !adjParams.vas || !adjParams.qts) {
      return { valid: false, Vb: 0, Fb: 0, F3: 0, Fs: adjParams.fs || 0, Qts: adjParams.qts || 0, Vas: adjParams.vas || 0, alignment: '' };
    }

    let VbPorted: number;
    let FbPorted: number;
    let F3Ported: number;
    let alignmentActive: string;

    const wasm = getWasm();

    if (woodMode === 'input' && manualNetVol > 0) {
      VbPorted = manualNetVol * dampingFactor;
      FbPorted = customFb;
      F3Ported = estimateF3(adjParams.fs, adjParams.qts, VbPorted, FbPorted, adjParams.vas);
      alignmentActive = 'Manual';
    } else {
      if (customPorted) {
        VbPorted = customVb;
        FbPorted = customFb;
        F3Ported = estimateF3(adjParams.fs, adjParams.qts, VbPorted, FbPorted, adjParams.vas);
        alignmentActive = 'Manual';
      } else {
        const result = wasm.calc_alineacion_ventilada(adjParams.fs, adjParams.vas, adjParams.qts, "QB3");
        VbPorted = result.vb;
        FbPorted = result.fb;
        F3Ported = result.f3;
        alignmentActive = 'Óptima (QB3 Wasm)';
      }
    }

    if (useCustomPortLength && Number(customPortLength) > 0) {
      const pDia = portShape === 'round'
        ? (Number(portDiameter) || 0)
        : portShape === 'custom'
          ? (2 * Math.sqrt((Number(portArea) || 0) / Math.PI))
          : (2 * Math.sqrt(((Number(portWidth) || 0) * (Number(portHeight) || 0)) / Math.PI));
      const pCount = Number(portCount) || 1;
      if (pDia > 0 && VbPorted > 0) {
        const kCorrection = flaredEnds === 1 ? 0.850 : flaredEnds === 2 ? 0.968 : 0.732;
        const Lv_cm = Number(customPortLength);
        const fbCalc = Math.sqrt((23562.5 * Math.pow(pDia, 2) * pCount) / (VbPorted * (Lv_cm + kCorrection * pDia)));
        if (fbCalc > 0 && !isNaN(fbCalc) && isFinite(fbCalc)) {
          FbPorted = fbCalc;
          F3Ported = estimateF3(adjParams.fs, adjParams.qts, VbPorted, FbPorted, adjParams.vas);
          alignmentActive = `${t("Personalizada")} (L: ${Lv_cm.toFixed(1)} cm)`;
        }
      }
    }

    return {
      valid: true,
      Vb: VbPorted,
      Fb: FbPorted,
      F3: F3Ported,
      Fs: adjParams.fs,
      Qts: adjParams.qts,
      Vas: adjParams.vas,
      alignment: alignmentActive
    };
  };

  const portedData = calculatePorted();

  const customVb = customPorted ? (customVbState ?? Math.round((portedData.Vb || 45) * 10) / 10) : Math.round((portedData.Vb || 45) * 10) / 10;
  const customFb = customPorted ? (customFbState ?? Math.round((portedData.Fb || 38) * 10) / 10) : Math.round((portedData.Fb || 38) * 10) / 10;

  const optimalVb = portedData.Vb;
  const optimalFb = portedData.Fb;

  const setCustomVb = (val: number | ((prev: number) => number)) => {
    setCustomVbState(prev => {
      const current = prev ?? Math.round((optimalVb || 45) * 10) / 10;
      return typeof val === 'function' ? val(current) : val;
    });
  };

  const setCustomFb = (val: number | ((prev: number) => number)) => {
    setCustomFbState(prev => {
      const current = prev ?? Math.round((optimalFb || 38) * 10) / 10;
      return typeof val === 'function' ? val(current) : val;
    });
  };

  // --- CALCULAR CAJA PASO BANDA (BANDPASS) ---
  const calculateBandpass = (): CalculatedBandpass => {
    if (validationError || !adjParams.fs || !adjParams.vas || !adjParams.qts) {
      return { valid: false, order: bandpassOrder, Vf: 0, Vr: 0, Fb: 0, F0: 0, delta_f: 0, Fl: 0, Fh: 0 };
    }

    const wasm = getWasm();

    try {
      if (bandpassOrder === 4) {
        const res = wasm.calc_bandpass_4(adjParams.fs, adjParams.vas, adjParams.qts, bandpassS);
        return {
          valid: true,
          order: 4,
          Vf: res.vf,
          Vr: res.vr,
          Fb: res.fb,
          F0: res.f0,
          delta_f: res.delta_f
        };
      } else {
        const res = wasm.calc_bandpass_6(adjParams.fs, adjParams.vas, adjParams.qts, bandpassA);
        return {
          valid: true,
          order: 6,
          Vf: res.vf,
          Vr: res.vr,
          Fb: 0,
          Fl: res.fl,
          Fh: res.fh
        };
      }
    } catch (e) {
      console.error("Bandpass calculation error:", e);
      return { valid: false, order: bandpassOrder, Vf: 0, Vr: 0, Fb: 0, F0: 0, delta_f: 0, Fl: 0, Fh: 0 };
    }
  };

  const bandpassData = calculateBandpass();

  const deferredSealedData = useDeferredValue(sealedData);
  const deferredPortedData = useDeferredValue(portedData);
  const deferredBandpassData = useDeferredValue(bandpassData);
  const deferredAdjParams = useDeferredValue(adjParams);

  const getPortLengthCalculation = () => {
    if (useCustomPortLength && Number(customPortLength) > 0) {
      const displayLv = convertTo(Number(customPortLength), 'length', unitSystem);
      const unitLabel = getUnitLabel('length', unitSystem);
      return `${displayLv.toFixed(1)} ${unitLabel} (${t("Personalizada")})`;
    }
    const pCount = Number(portCount) || 0;
    if (pCount > 0 && portedData.Vb > 0) {
      const pDia = portShape === 'round'
        ? (Number(portDiameter) || 0)
        : portShape === 'custom'
          ? (2 * Math.sqrt((Number(portArea) || 0) / Math.PI))
          : (2 * Math.sqrt(((Number(portWidth) || 0) * (Number(portHeight) || 0)) / Math.PI));

      if (pDia > 0) {
        const kCorrection = flaredEnds === 1 ? 0.850 : flaredEnds === 2 ? 0.968 : 0.732;
        const Lv = ((23562.5 * Math.pow(pDia, 2) * pCount) / (portedData.Fb * portedData.Fb * portedData.Vb)) - (kCorrection * pDia);
        
        const displayLv = convertTo(Lv, 'length', unitSystem);
        const unitLabel = getUnitLabel('length', unitSystem);

        if (Lv <= 0) {
          return t("Excesivamente corto");
        } else if (Lv > 120) {
          return `${displayLv.toFixed(1)} ${unitLabel} (${t("Excede caja")})`;
        } else {
          return `${displayLv.toFixed(1)} ${unitLabel}`;
        }
      }
    }
    return 'N/A';
  };

  const portLength = getPortLengthCalculation();

  // --- CÁLCULO SÍNCRONO DE RADIADOR PASIVO ---
  const getRadiadorPasivoCalculations = () => {
    if (portedData.valid && portedData.Vb > 0) {
      const rho = 1.205;
      const c = 343.0;
      const sd_m2 = Math.PI * Math.pow((prDia / 100) / 2, 2);
      const vb_m3 = portedData.Vb / 1000;
      const vas_m3 = prVas / 1000;

      const cab = vb_m3 / (rho * c * c * sd_m2 * sd_m2);
      const cap = vas_m3 / (rho * c * c * sd_m2 * sd_m2);
      const mp_propia = (prMms / 1000) / Math.pow(sd_m2, 2);

      const fbNat = (1.0 / (2.0 * Math.PI)) * Math.sqrt(1.0 / (mp_propia * (cap + cab)));

      const targetFb = portedData.Fb;
      const mp_total_req = 1.0 / (4.0 * Math.PI * Math.PI * targetFb * targetFb * (cap + cab));
      const mp_ad_req = mp_total_req - mp_propia;
      const masaMecG = mp_ad_req * sd_m2 * sd_m2 * 1000;

      return {
        prFbNatural: fbNat || 0,
        prMasaAnadidaG: Math.max(0, masaMecG) || 0
      };
    }
    return { prFbNatural: 0, prMasaAnadidaG: 0 };
  };

  const { prFbNatural, prMasaAnadidaG } = getRadiadorPasivoCalculations();


  const handleCustomPortedChange = useCallback((val: boolean) => {
    setCustomPorted(val);
    if (!val) {
      setCustomVbState(null);
      setCustomFbState(null);
    }
  }, []);

  const handleExportReport = () => {
    console.log("handleExportReport: triggered");
    try {
      // Recopilar datos del crossover si está registrado
      let xoverData: CrossoverExportData | null = null;
      if (crossoverRef.current) {
        xoverData = crossoverRef.current();
      }

      // Longitud del puerto, diámetro equivalente, velocidad del aire
      let pLen = 'N/A';
      let vp: number | null = null;
      const pCount = Number(portCount) || 0;
      if (pCount > 0 && portedData.valid && portedData.Vb > 0) {
        const pDia = portShape === 'round'
          ? (Number(portDiameter) || 0)
          : portShape === 'custom'
            ? (2 * Math.sqrt((portArea || 0) / Math.PI))
            : (2 * Math.sqrt(((portWidth || 0) * (portHeight || 0)) / Math.PI));
        
        if (pDia > 0) {
          const kCorrection = flaredEnds === 1 ? 0.850 : flaredEnds === 2 ? 0.968 : 0.732;
          const Lv = ((23562.5 * Math.pow(pDia, 2) * pCount) / (portedData.Fb * portedData.Fb * (cabinetRef.current?.vNeto || portedData.Vb))) - (kCorrection * pDia);
          if (Lv <= 0) {
            pLen = t("Excesivamente corto");
          } else {
            pLen = `${Lv.toFixed(1)} cm`;
          }

          // Velocidad del aire
          if (params.sd && params.xmax) {
            const vd = (params.sd * params.xmax) / 10000;
            const peakV = 2 * Math.PI * portedData.Fb * vd * 0.001; // m3/s aprox
            const totalArea = pCount * Math.PI * Math.pow(pDia / 2, 2) * 0.0001; // m2
            if (totalArea > 0) {
              vp = peakV / totalArea;
            }
          }
        }
      }

      const htmlContent = generateReportHTML(
        lang,
        unitSystem,
        params,
        boxType === 'sealed' ? 'sealed' : 'ported',
        sealedData,
        portedData,
        dampingType,
        cabinetRef.current,
        crossoverRef.current ? {
          crossoverWays: xoverData.crossoverWays,
          crossoverType: xoverData.crossoverType,
          fc: xoverData.fc,
          fcLow: xoverData.fcLow,
          fcHigh: xoverData.fcHigh,
          zTweeter: xoverData.zTweeter,
          zMidrange: xoverData.zMidrange,
          zWoofer: xoverData.zWoofer,
          enableZobel: xoverData.enableZobel,
          re: xoverData.re,
          le: xoverData.le,
          enableLPad: xoverData.enableLPad,
          attenuation: xoverData.attenuation,
          zLoad: xoverData.zLoad,
          xoverResults: xoverData.xoverResults,
          zobelResults: xoverData.zobelResults,
          lpadResults: xoverData.lpadResults
        } : null,
        pCount,
        portShape,
        portDiameter || 0,
        portWidth || 0,
        portHeight || 0,
        portArea || 0,
        pLen,
        vp
      );

      const reportWindow = window.open('', '_blank');
      if (reportWindow) {
        reportWindow.document.write(htmlContent);
        reportWindow.document.close();
        console.log("handleExportReport: opened successfully");
      } else {
        alert(t("El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio web para descargar el PDF."));
      }
    } catch (e: unknown) {
      console.error("handleExportReport: error", e);
      const errMsg = e instanceof Error ? e.message : String(e);
      alert(t("Ocurrió un error al generar el reporte: ") + errMsg);
    }
  };

  return (
    <div className="container">
      <Header 
        lang={lang} 
        setLang={setLang} 
        unitSystem={unitSystem}
        setUnitSystem={setUnitSystem}
        theme={theme} 
        toggleTheme={toggleTheme}
        onExportReport={handleExportReport}
      />

      <div className="dashboard-grid">
        {/* PARÁMETROS IZQUIERDA */}
        <SpeakerParamsForm 
          lang={lang}
          unitSystem={unitSystem}
          params={params}
          onParamsChange={setParams}
          driverConfig={driverConfig}
          onDriverConfigChange={setDriverConfig}
          validationError={validationError}
          preset={preset}
          onPresetChange={handlePresetChange}
          customDrivers={customDrivers}
          onCustomDriversChange={handleCustomDriversChange}
        />

        {/* PARÁMETROS CENTRO: CAJA DE DISEÑO */}
        <BoxParamsForm
          lang={lang}
          unitSystem={unitSystem}
          boxType={boxType}
          setBoxType={setBoxType}
          customVb={customVb}
          setCustomVb={setCustomVb}
          customFb={customFb}
          setCustomFb={setCustomFb}
          customPorted={customPorted}
          setCustomPorted={handleCustomPortedChange}
          params={adjParams}
          portedData={portedData}
          sealedData={sealedData}
          bandpassData={bandpassData}
          isLinkedToCabinet={woodMode === 'input' && manualNetVol > 0}
          targetQtc={targetQtc}
          setTargetQtc={setTargetQtc}
          bandpassOrder={bandpassOrder}
          setBandpassOrder={setBandpassOrder}
          bandpassS={bandpassS}
          setBandpassS={setBandpassS}
          bandpassA={bandpassA}
          setBandpassA={setBandpassA}
          
          portCount={portCount}
          setPortCount={setPortCount}
          portDiameter={portDiameter}
          setPortDiameter={setPortDiameter}
          portShape={portShape === 'custom' ? 'round' : portShape}
          setPortShape={setPortShape}
          portWidth={portWidth}
          setPortWidth={setPortWidth}
          portHeight={portHeight}
          setPortHeight={setPortHeight}
          portArea={portArea}
          setPortArea={setPortArea}
          portLength={portLength}
          flaredEnds={flaredEnds}
          setFlaredEnds={setFlaredEnds}
          useCustomPortLength={useCustomPortLength}
          setUseCustomPortLength={setUseCustomPortLength}
          customPortLength={customPortLength}
          setCustomPortLength={setCustomPortLength}

          prTuning={prTuning}
          setPrTuning={setPrTuning}
          prDia={prDia}
          setPrDia={setPrDia}
          prVas={prVas}
          setPrVas={setPrVas}
          prFs={prFs}
          setPrFs={setPrFs}
          prMms={prMms}
          setPrMms={setPrMms}
          prFbNatural={prFbNatural}
          prMasaAnadidaG={prMasaAnadidaG}

          // SUBPESTAÑAS CENTRALES
          activeTab={activeTab}
          setActiveTab={setActiveTab}

          // Ebanistería props
          woodMode={woodMode}
          setWoodMode={setWoodMode}
          woodShape={woodShape}
          setWoodShape={setWoodShape}
          woodConstraint={woodConstraint}
          setWoodConstraint={setWoodConstraint}
          woodRatio={woodRatio}
          setWoodRatio={setWoodRatio}
          woodThickness={woodThickness}
          setWoodThickness={setWoodThickness}
          woodExtra={woodExtra}
          setWoodExtra={setWoodExtra}
          woodLockVal1={woodLockVal1}
          setWoodLockVal1={setWoodLockVal1}
          woodLockVal2={woodLockVal2}
          setWoodLockVal2={setWoodLockVal2}
          woodLockVal3={woodLockVal3}
          setWoodLockVal3={setWoodLockVal3}
          woodExtHeight={woodExtHeight}
          setWoodExtHeight={setWoodExtHeight}
          woodExtWidth={woodExtWidth}
          setWoodExtWidth={setWoodExtWidth}
          woodExtDepth={woodExtDepth}
          setWoodExtDepth={setWoodExtDepth}
          woodTrapExtHeight={woodTrapExtHeight}
          setWoodTrapExtHeight={setWoodTrapExtHeight}
          woodTrapExtWidth={woodTrapExtWidth}
          setWoodTrapExtWidth={setWoodTrapExtWidth}
          woodTrapExtDepthTop={woodTrapExtDepthTop}
          setWoodTrapExtDepthTop={setWoodTrapExtDepthTop}
          woodTrapExtDepthBot={woodTrapExtDepthBot}
          setWoodTrapExtDepthBot={setWoodTrapExtDepthBot}

          // Damping props
          dampingType={dampingType}
          setDampingType={setDampingType}

          // Crossover props
          crossoverWays={crossoverWays}
          setCrossoverWays={setCrossoverWays}
          crossoverType={crossoverType}
          setCrossoverType={setCrossoverType}
          fc={fc}
          setFc={setFc}
          fcLow={fcLow}
          setFcLow={setFcLow}
          fcHigh={fcHigh}
          setFcHigh={setFcHigh}
          zTweeter={zTweeter}
          setZTweeter={setZTweeter}
          zMidrange={zMidrange}
          setZMidrange={setZMidrange}
          zWoofer={zWoofer}
          setZWoofer={setZWoofer}
          enableZobel={enableZobel}
          setEnableZobel={setEnableZobel}
          zobelRe={zobelRe}
          setZobelRe={setZobelRe}
          zobelLe={zobelLe}
          setZobelLe={setZobelLe}
          enableLPad={enableLPad}
          setEnableLPad={setEnableLPad}
          lpadAttenuation={lpadAttenuation}
          setLpadAttenuation={setLpadAttenuation}
          lpadZLoad={lpadZLoad}
          setLpadZLoad={setLpadZLoad}
          speakerYPct={speakerYPct}
          setSpeakerYPct={setSpeakerYPct}
          portYPct={portYPct}
          setPortYPct={setPortYPct}
        />

        {/* CONTENIDOS DERECHA */}
        <main className="dashboard-main">
          {/* Gráfico */}
          <SimulationChart 
            lang={lang}
            theme={theme}
            sealedData={boxType === 'sealed' && sealedData.valid ? deferredSealedData : null}
            portedData={boxType === 'ported' && portedData.valid ? deferredPortedData : null}
            bandpassData={boxType === 'bandpass' && bandpassData.valid ? deferredBandpassData : null}
            params={deferredAdjParams}
            crossoverWays={crossoverWays}
            crossoverType={crossoverType}
            fc={fc}
            fcLow={fcLow}
            fcHigh={fcHigh}
          />

          {/* Grilla de Resultados y Diagramas en Paralelo */}
          <div className="results-diagrams-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '0px', marginTop: '0px' }}>
            {/* Panel Izquierdo: Cajón y Plano Técnico */}
            <div className="panel" style={{ background: 'var(--card-bg)', border: 'none', borderRadius: '0', padding: '0px' }}>
              <CabinetTab 
                lang={lang}
                unitSystem={unitSystem}
                params={adjParams}
                sealedData={sealedData}
                portedData={portedData}
                bandpassData={bandpassData}
                woodMode={woodMode}
                setWoodMode={setWoodMode}
                woodShape={woodShape}
                setWoodShape={setWoodShape}
                woodConstraint={woodConstraint}
                setWoodConstraint={setWoodConstraint}
                woodSource={boxType}
                woodRatio={woodRatio}
                setWoodRatio={setWoodRatio}
                woodLockVal1={woodLockVal1}
                setWoodLockVal1={setWoodLockVal1}
                woodLockVal2={woodLockVal2}
                setWoodLockVal2={setWoodLockVal2}
                woodLockVal3={woodLockVal3}
                setWoodLockVal3={setWoodLockVal3}
                woodExtHeight={woodExtHeight}
                setWoodExtHeight={setWoodExtHeight}
                woodExtWidth={woodExtWidth}
                setWoodExtWidth={setWoodExtWidth}
                woodExtDepth={woodExtDepth}
                setWoodExtDepth={setWoodExtDepth}
                woodTrapExtHeight={woodTrapExtHeight}
                setWoodTrapExtHeight={setWoodTrapExtHeight}
                woodTrapExtWidth={woodTrapExtWidth}
                setWoodTrapExtWidth={setWoodTrapExtWidth}
                woodTrapExtDepthTop={woodTrapExtDepthTop}
                setWoodTrapExtDepthTop={setWoodTrapExtDepthTop}
                woodTrapExtDepthBot={woodTrapExtDepthBot}
                setWoodTrapExtDepthBot={setWoodTrapExtDepthBot}
                woodThickness={woodThickness}
                setWoodThickness={setWoodThickness}
                woodExtra={woodExtra}
                setWoodExtra={setWoodExtra}
                portCount={portCount}
                portDiameter={portDiameter}
                portShape={portShape}
                portWidth={portWidth}
                portHeight={portHeight}
                portArea={portArea}
                dampingFactor={dampingFactor}
                flaredEnds={flaredEnds}
                onCabinetDataChange={handleCabinetDataChange}
                readOnly={true}
                speakerYPct={speakerYPct}
                portYPct={portYPct}
              />
            </div>

            {/* Panel Derecho: Crossover y Circuito */}
            <div className="panel" style={{ background: 'var(--card-bg)', border: 'none', borderRadius: '0', padding: '0px' }}>
              <CrossoverTab 
                lang={lang} 
                onRegisterExporter={handleRegisterCrossover}
                readOnly={true}
                crossoverWaysProp={crossoverWays === 2 ? '2way' : '3way'}
                crossoverTypeProp={crossoverType}
                fcProp={fc}
                fcLowProp={fcLow}
                fcHighProp={fcHigh}
                zTweeterProp={zTweeter}
                zMidrangeProp={zMidrange}
                zWooferProp={zWoofer}
                enableZobelProp={enableZobel}
                reProp={zobelRe}
                leProp={zobelLe}
                enableLPadProp={enableLPad}
                attenuationProp={lpadAttenuation}
                zLoadProp={lpadZLoad}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
