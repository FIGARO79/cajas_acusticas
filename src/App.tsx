import { useState, useEffect, useRef, useCallback, useDeferredValue, useMemo } from 'react';
import { Header } from './components/Header';
import { SpeakerParamsForm } from './components/SpeakerParamsForm';
import { BoxParamsForm } from './components/BoxParamsForm';
import { SimulationChart } from './components/SimulationChart';
import { CabinetTab } from './components/CabinetTab';
import { CrossoverTab } from './components/CrossoverTab';
import { type Lang, translate } from './utils/translations';
import { type UnitSystem, convertTo, getUnitLabel } from './utils/units';
import type { SpeakerParams, CalculatedSealed, CalculatedPorted, CalculatedBandpass, CustomDriver, WoodCabinetData, CrossoverExportData } from './types';
import { estimateF3, calcPortLength, getKCorrection, calcOptimalPortForSpeaker } from './utils/acousticMath';
import { getWasm, calcRadiadorPasivo } from './wasm/index.ts';
import { generateReportHTML } from './utils/reportGenerator';

interface AppProps {
  wasmError?: string | null;
}

function App({ wasmError }: AppProps) {
  // Theme & Language
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lang') as Lang) || 'es');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(() => (localStorage.getItem('unitSystem') as UnitSystem) || 'metric');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('theme') as 'dark' | 'light') || 'dark');
  const [activeTab, setActiveTab] = useState<'wood' | 'port' | 'damping' | 'crossover'>('wood');
  const [boxType, setBoxType] = useState<'sealed' | 'ported' | 'bandpass'>('sealed');
  const [ventedAlignment, setVentedAlignment] = useState<'QB3' | 'B4' | 'SBB4'>('QB3');
  const t = (text: string) => translate(text, lang);

  const handleBoxTypeChange = (newType: 'sealed' | 'ported' | 'bandpass') => {
    setBoxType(newType);
    if (newType === 'sealed' && activeTab === 'port') {
      setActiveTab('wood');
    }
  };

  // Crossover State
  const [crossoverWays, setCrossoverWays] = useState<number>(2);
  const handleCrossoverWaysChange = (ways: number) => {
    setCrossoverWays(ways);
    if (ways === 3) {
      if (Math.abs(speakerYPct - midrangeYPct) < 15) {
        setTweeterYPct(15);
        setMidrangeYPct(36);
        setSpeakerYPct(64);
      }
    } else if (ways === 2) {
      if (speakerYPct === 64 && tweeterYPct === 15) {
        setTweeterYPct(20);
        setSpeakerYPct(50);
      }
    }
  };
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

  // Altavoces personalizados guardados en localStorage (con Eminence Alpha-10A completo por defecto)
  const [customDrivers, setCustomDrivers] = useState<CustomDriver[]>(() => {
    const defaultAlpha10A: CustomDriver = {
      id: 'custom_eminence_alpha_10a',
      brand: 'Eminence',
      model: 'Alpha-10A',
      isCustom: true,
      params: {
        diaNominal: '10.0", 254 mm',
        zNominal: 8,
        pe: 150,
        pProg: 300,
        fs: 50,
        freqMin: 57,
        freqMax: 4500,
        sens: 95.6,
        magWeight: 20,
        gapHeight: 6.4,
        vcDiameter: 38,
        re: 5.31,
        le: 0.66,
        qms: 5.21,
        qes: 0.66,
        qts: 0.59,
        vas: 82.2,
        vd: 114.0,
        cms: 0.46,
        bl: 7.5,
        mms: 22,
        xmax: 3.2,
        sd: 355.4,
        xlim: 9.1,
        driverVolDisplaced: 0.95,
        overallDiameter: 256.8,
        baffleCutout: 231.9,
        driverDepth: 99.1,
      },
    };

    try {
      const saved = localStorage.getItem('custom_drivers');
      const parsed: CustomDriver[] = saved ? JSON.parse(saved) : [];
      let foundAlpha = false;
      const enriched = parsed.map((d) => {
        if (
          d.brand.toLowerCase().includes('eminence') &&
          d.model.toLowerCase().replace(/[-\s]/g, '').includes('alpha10')
        ) {
          foundAlpha = true;
          return {
            ...d,
            params: { ...defaultAlpha10A.params, ...d.params },
          };
        }
        return d;
      });
      const finalList = foundAlpha ? enriched : [defaultAlpha10A, ...enriched];
      localStorage.setItem('custom_drivers', JSON.stringify(finalList));
      return finalList;
    } catch {
      return [defaultAlpha10A];
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
  const [flaredEnds, setFlaredEnds] = useState<0 | 1 | 2 | 3>(0);
  const [useCustomPortLength, setUseCustomPortLength] = useState<boolean>(false);
  const [customPortLength, setCustomPortLength] = useState<number | ''>('');

  // Radiador Pasivo
  const [prTuning, setPrTuning] = useState<'port' | 'radiator'>('port');
  const [prDia, setPrDia] = useState<number>(20);
  const [prVas, setPrVas] = useState<number>(45);
  const [prFs, setPrFs] = useState<number>(25);
  const [prMms, setPrMms] = useState<number>(35);
  const [prFbNatural, setPrFbNatural] = useState<number>(0);
  const [prMasaAnadidaG, setPrMasaAnadidaG] = useState<number>(0);


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

  // Midrange & Positioning state
  const [midFs, setMidFs] = useState<number>(120);
  const [midVas, setMidVas] = useState<number>(5);
  const [midQts, setMidQts] = useState<number>(0.45);
  const [midTargetQtc, setMidTargetQtc] = useState<number>(0.707);
  const [useCustomMidVol, setUseCustomMidVol] = useState<boolean>(false);
  const [customMidVol, setCustomMidVol] = useState<number | ''>('');
  const [tweeterYPct, setTweeterYPct] = useState<number>(20);
  const [midrangeYPct, setMidrangeYPct] = useState<number>(45);
  const [portLocation, setPortLocation] = useState<'front' | 'rear'>('front');
  const [midCabinetDepth, setMidCabinetDepth] = useState<number | ''>('');
  const [midSealed, setMidSealed] = useState<boolean>(true);

  // Shared state for technical report exporting
  const cabinetRef = useRef<WoodCabinetData | null>(null);
  const [cabinetData, setCabinetData] = useState<WoodCabinetData | null>(null);
  const handleCabinetDataChange = useCallback((data: WoodCabinetData | null) => {
    cabinetRef.current = data;
    setCabinetData(data);
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

      // Seleccionar alineación acústica óptima según el Qts del altavoz (Small / Keele)
      let optAlign: 'QB3' | 'B4' | 'SBB4' = 'B4';
      if (updatedParams.qts && updatedParams.qts > 0) {
        if (updatedParams.qts < 0.38) {
          optAlign = 'QB3'; // Para motores potentes con Qts bajo
        } else if (updatedParams.qts <= 0.45) {
          optAlign = 'B4';  // Alineación plana estándar (Fb = Fs)
        } else {
          optAlign = 'B4';  // Para Qts alto (> 0.45), B4 (Fb = Fs) evita la joroba de QB3
        }
        setVentedAlignment(optAlign);
      }

      // Auto-calcular puerto óptimo (sin soplidos) acorde a los parámetros del altavoz seleccionado
      if (updatedParams.fs > 0 && updatedParams.vas > 0 && updatedParams.qts > 0) {
        try {
          const wasm = getWasm();
          const res = wasm.calc_alineacion_ventilada(updatedParams.fs, updatedParams.vas, updatedParams.qts, optAlign);
          const targetVb = (woodMode === 'input' && cabinetData?.valid && cabinetData.vNeto > 0)
            ? cabinetData.vNeto
            : (res.vb > 0 ? res.vb : 40);
          const targetFb = (updatedParams.qts >= 0.45 && res.fb > updatedParams.fs * 1.1)
            ? updatedParams.fs
            : (res.fb > 0 ? res.fb : updatedParams.fs);
          const maxLen = (cabinetData?.valid && cabinetData.dInt > 6)
            ? Math.max(cabinetData.dInt - 3.5, 8)
            : 38.0;
          const optPort = calcOptimalPortForSpeaker(targetVb, targetFb, updatedParams, flaredEnds, 2.0, maxLen);
          setPortCount(optPort.numPorts);
          setPortDiameter(optPort.diameter);
          if (optPort.length > 0) {
            setCustomPortLength(Number(optPort.length.toFixed(1)));
            setUseCustomPortLength(true);
          }
          setCustomFbState(Number(targetFb.toFixed(1)));
        } catch {
          // Mantiene configuración actual si el motor WASM aún no está listo
        }
      }

      // Sincronizar impedancia del Woofer y parámetros de la Red Zobel con el altavoz seleccionado
      if (updatedParams.zNominal && updatedParams.zNominal > 0) {
        setZWoofer(updatedParams.zNominal);
      } else if (updatedParams.re && updatedParams.re > 0) {
        setZWoofer(updatedParams.re <= 4.2 ? 4 : 8);
      }
      if (updatedParams.re && updatedParams.re > 0) {
        setZobelRe(updatedParams.re);
      }
      if (updatedParams.le && updatedParams.le > 0) {
        setZobelLe(updatedParams.le);
      }
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



  // Frecuencia de sintonía óptima (Fb) según los parámetros Thiele-Small del altavoz y la alineación activa
  const optimalDriverFb = useMemo<number>(() => {
    if (validationError || !adjParams.fs || !adjParams.vas || !adjParams.qts) return 38;
    try {
      const wasm = getWasm();
      const res = wasm.calc_alineacion_ventilada(adjParams.fs, adjParams.vas, adjParams.qts, ventedAlignment);
      return res.fb > 0 ? Math.round(res.fb * 10) / 10 : 38;
    } catch {
      return 38;
    }
  }, [validationError, adjParams.fs, adjParams.vas, adjParams.qts, ventedAlignment]);

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

    // En modo de medidas manuales ('input'), usa customFbState si fue fijado por el usuario o la Fb óptima del altavoz
    const targetFb = customFbState ?? optimalDriverFb;

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
          let currentNetVol = bruto - extra; // Initial guess of physical net volume
          
          // Solve the circular reference (netVol -> targetVb -> portLength -> portVol -> netVol) iteratively
          for (let iter = 0; iter < 4; iter++) {
            const targetVb = currentNetVol * dampingFactor;
            if (targetVb <= 0) {
              portVol = 0;
              break;
            }
            const Lv = calcPortLength(targetVb, targetFb, pDia, flaredEnds, pCount);
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
  const sealedData = useMemo<CalculatedSealed>(() => {
    if (validationError || !adjParams.fs || !adjParams.vas || !adjParams.qts) {
      return { valid: false, Vb: 0, Fc: 0, Qtc: targetQtc, F3: 0 };
    }

    const wasm = getWasm();

    if (woodMode === 'input' && manualNetVol > 0) {
      const sealedVb = manualNetVol * dampingFactor;
      const alpha = adjParams.vas / sealedVb;
      const sealedQtc = adjParams.qts * Math.sqrt(alpha + 1);
      
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
  }, [validationError, adjParams.fs, adjParams.vas, adjParams.qts, woodMode, manualNetVol, dampingFactor, targetQtc]);

  // --- CALCULAR CAJA VENTILADA ---
  const portedData = useMemo<CalculatedPorted>(() => {
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
      // Sintonizar a la Fb personalizada o a la Fb óptima calculada según el altavoz y alineación
      FbPorted = customFbState ?? optimalDriverFb;
      F3Ported = estimateF3(adjParams.fs, adjParams.qts, VbPorted, FbPorted, adjParams.vas);
      alignmentActive = customFbState !== null
        ? 'Manual'
        : `${ventedAlignment === 'QB3' ? 'High Output (QB3)' : ventedAlignment === 'B4' ? 'High Fidelity (B4)' : 'Extended Bass (SBB4)'}`;
    } else {
      if (customPorted) {
        VbPorted = customVbState ?? 45;
        FbPorted = customFbState ?? optimalDriverFb;
        F3Ported = estimateF3(adjParams.fs, adjParams.qts, VbPorted, FbPorted, adjParams.vas);
        alignmentActive = 'Manual';
      } else {
        const result = wasm.calc_alineacion_ventilada(adjParams.fs, adjParams.vas, adjParams.qts, ventedAlignment);
        VbPorted = result.vb;
        FbPorted = result.fb;
        F3Ported = result.f3;
        alignmentActive = `${ventedAlignment === 'QB3' ? 'High Output (QB3)' : ventedAlignment === 'B4' ? 'High Fidelity (B4)' : 'Extended Bass (SBB4)'}`;
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
        const kCorrection = getKCorrection(flaredEnds);
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
  }, [validationError, adjParams.fs, adjParams.vas, adjParams.qts, woodMode, manualNetVol, dampingFactor, customPorted, customVbState, customFbState, optimalDriverFb, ventedAlignment, useCustomPortLength, customPortLength, portShape, portDiameter, portArea, portWidth, portHeight, portCount, flaredEnds, lang]);

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
  const bandpassData = useMemo<CalculatedBandpass>(() => {
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
  }, [validationError, adjParams.fs, adjParams.vas, adjParams.qts, bandpassOrder, bandpassS, bandpassA]);

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
        const Lv = calcPortLength(portedData.Vb, portedData.Fb, pDia, flaredEnds, pCount);
        
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

  // --- CÁLCULO ASÍNCRONO DE RADIADOR PASIVO CON MOTOR RUST/WASM ---
  useEffect(() => {
    let active = true;
    if (portedData.valid && portedData.Vb > 0 && prDia > 0 && prVas > 0 && prMms > 0) {
      // cd es el diámetro del cono del radiador pasivo
      const cd = prDia; 
      
      calcRadiadorPasivo(portedData.Vb, prVas, prFs, cd, prMms)
        .then((res) => {
          if (active) {
            setPrFbNatural(res.fb || 0);
            setPrMasaAnadidaG(Math.max(0, res.masaAñadida || 0));
          }
        })
        .catch((err) => {
          console.error("Error al calcular radiador pasivo por WASM:", err);
        });
    } else {
      setPrFbNatural(0);
      setPrMasaAnadidaG(0);
    }
    return () => {
      active = false;
    };
  }, [portedData.valid, portedData.Vb, portedData.Fb, prDia, prVas, prFs, prMms]);



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
          const targetVb = cabinetRef.current?.vNeto || portedData.Vb;
          const Lv = calcPortLength(targetVb, portedData.Fb, pDia, flaredEnds, pCount);
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
        xoverData ? {
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

  if (wasmError) {
    return (
      <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', textAlign: 'center' }}>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '3rem', maxWidth: '600px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', backdropFilter: 'blur(8px)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', marginBottom: '1.5rem' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1rem' }}>
            {t("Error al inicializar el Motor Acústico")}
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            {t("No se pudo cargar el motor matemático de alto rendimiento (WebAssembly). Esto puede ocurrir por restricciones del navegador o porque faltan archivos del compilador.")}
          </p>
          <div style={{ background: 'rgba(0,0,0,0.15)', borderLeft: '3px solid var(--danger)', padding: '1rem', borderRadius: '6px', textAlign: 'left', marginBottom: '2rem', wordBreak: 'break-all' }}>
            <code style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontFamily: 'monospace' }}>
              {wasmError}
            </code>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            style={{ padding: '0.75rem 2rem', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', transition: 'transform 0.2s', fontFamily: 'inherit' }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {t("Reintentar cargar aplicación")}
          </button>
        </div>
      </div>
    );
  }

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
          crossoverWays={crossoverWays}
          setCrossoverWays={setCrossoverWays}
          midFs={midFs}
          setMidFs={setMidFs}
          midVas={midVas}
          setMidVas={setMidVas}
          midQts={midQts}
          setMidQts={setMidQts}
          midTargetQtc={midTargetQtc}
          setMidTargetQtc={setMidTargetQtc}
        />

        {/* PARÁMETROS CENTRO: CAJA DE DISEÑO */}
        <BoxParamsForm
          lang={lang}
          unitSystem={unitSystem}
          boxType={boxType}
          setBoxType={handleBoxTypeChange}
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
          cabinetData={cabinetData}
          ventedAlignment={ventedAlignment}
          setVentedAlignment={setVentedAlignment}
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
          setCrossoverWays={handleCrossoverWaysChange}
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
          portLocation={portLocation}
          setPortLocation={setPortLocation}
          midFs={midFs}
          setMidFs={setMidFs}
          midVas={midVas}
          setMidVas={setMidVas}
          midQts={midQts}
          setMidQts={setMidQts}
          midTargetQtc={midTargetQtc}
          setMidTargetQtc={setMidTargetQtc}
          useCustomMidVol={useCustomMidVol}
          setUseCustomMidVol={setUseCustomMidVol}
          customMidVol={customMidVol}
          setCustomMidVol={setCustomMidVol}
          tweeterYPct={tweeterYPct}
          setTweeterYPct={setTweeterYPct}
          midrangeYPct={midrangeYPct}
          setMidrangeYPct={setMidrangeYPct}
          midCabinetDepth={midCabinetDepth}
          setMidCabinetDepth={setMidCabinetDepth}
          midSealed={midSealed}
          setMidSealed={setMidSealed}
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
            portAreaM2={
              (() => {
                const pDia = portShape === 'round'
                  ? (Number(portDiameter) || 0)
                  : portShape === 'custom'
                    ? (2 * Math.sqrt((Number(portArea) || 0) / Math.PI))
                    : (2 * Math.sqrt(((Number(portWidth) || 0) * (Number(portHeight) || 0)) / Math.PI));
                const pCount = Number(portCount) || 1;
                return pDia > 0 ? pCount * Math.PI * Math.pow(pDia / 200, 2) : 0.0044;
              })()
            }
          />

          {/* Grilla de Resultados y Diagramas en Paralelo */}
          <div className="results-diagrams-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '0px', marginTop: '0px', alignItems: 'start' }}>
            {/* Panel Izquierdo: Cajón y Plano Técnico */}
            <div className="panel" style={{ background: 'var(--card-bg)', border: 'none', borderRadius: '0', padding: '0px' }}>
              <CabinetTab 
                theme={theme}
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
                dampingType={dampingType}
                flaredEnds={flaredEnds}
                onCabinetDataChange={handleCabinetDataChange}
                readOnly={true}
                speakerYPct={speakerYPct}
                tweeterYPct={tweeterYPct}
                midrangeYPct={midrangeYPct}
                crossoverWays={crossoverWays}
                midSealed={midSealed}
                midCabinetDepth={midCabinetDepth}
                useCustomMidVol={useCustomMidVol}
                customMidVol={customMidVol}
                midVas={midVas}
                midQts={midQts}
                midTargetQtc={midTargetQtc}
                portYPct={portYPct}
                portLocation={portLocation}
              />
            </div>

            {/* Panel Derecho: Crossover y Circuito */}
            <div className="panel" style={{ background: 'var(--card-bg)', border: 'none', borderRadius: '0', padding: '0px' }}>
              <CrossoverTab 
                theme={theme}
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
