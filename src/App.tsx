import { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { SpeakerParamsForm } from './components/SpeakerParamsForm';
import { BoxParamsForm } from './components/BoxParamsForm';
import { SimulationChart } from './components/SimulationChart';
import { CabinetTab } from './components/CabinetTab';
import { CrossoverTab } from './components/CrossoverTab';
import { type Lang, translate } from './utils/translations';
import { type UnitSystem, convertTo, getUnitLabel } from './utils/units';
import type { SpeakerParams, CalculatedSealed, CalculatedPorted, CalculatedBandpass, CustomDriver } from './types';
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
  const [customVb, setCustomVb] = useState<number>(45);
  const [customFb, setCustomFb] = useState<number>(38);
  const [customPorted, setCustomPorted] = useState<boolean>(false);

  // Ports configuration
  const [portCount, setPortCount] = useState<number | ''>(1);
  const [portDiameter, setPortDiameter] = useState<number | ''>(7.5);
  const [portShape, setPortShape] = useState<'round' | 'rectangular' | 'custom'>('round');
  const [portWidth, setPortWidth] = useState<number | ''>(10);
  const [portHeight, setPortHeight] = useState<number | ''>(5);
  const [portArea, setPortArea] = useState<number | ''>(50);

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

  // Shared state for technical report exporting
  const cabinetRef = useRef<any>(null);
  const handleCabinetDataChange = useCallback((data: any) => {
    cabinetRef.current = data;
  }, []);
  const crossoverRef = useRef<(() => any) | null>(null);
  const handleRegisterCrossover = useCallback((exp: () => any) => {
    crossoverRef.current = exp;
  }, []);

  // Validation
  const [validationError, setValidationError] = useState<string | null>(null);

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
  useEffect(() => {
    const t = (text: string) => translate(text, lang);
    if (!params.fs || !params.vas || !params.qts) {
      setValidationError(t("Completa los parámetros mínimos del altavoz (Fs, Vas, Qts)."));
    } else {
      setValidationError(null);
    }
  }, [params, lang]);



  // Manual wood volume calculation (needed for link overrides)
  // Manual wood volume calculation (needed for link overrides)
  const getManualWoodNetVolume = () => {
    const thickness = (woodThickness || 0) / 10;
    const extra = woodExtra || 0;
    if (woodShape === 'rectangular') {
      const hExt = woodExtHeight || 0;
      const wExt = woodExtWidth || 0;
      const dExt = woodExtDepth || 0;
      const hInt = hExt - (2 * thickness);
      const wInt = wExt - (2 * thickness);
      const dInt = dExt - (2 * thickness);
      if (hInt <= 0 || wInt <= 0 || dInt <= 0) return 0;
      return Math.max(0, ((hInt * wInt * dInt) / 1000) - extra);
    } else {
      const hExt = woodTrapExtHeight || 0;
      const wExt = woodTrapExtWidth || 0;
      const d1Ext = woodTrapExtDepthTop || 0;
      const d2Ext = woodTrapExtDepthBot || 0;
      const hInt = hExt - (2 * thickness);
      const wInt = wExt - (2 * thickness);
      const d1Int = Math.max(0, d1Ext - (2 * thickness));
      const d2Int = Math.max(0, d2Ext - (2 * thickness));
      if (hInt <= 0 || wInt <= 0 || d1Int <= 0 || d2Int <= 0) return 0;
      const dAvgInt = (d1Int + d2Int) / 2;
      return Math.max(0, ((hInt * wInt * dAvgInt) / 1000) - extra);
    }
  };

  const manualNetVol = getManualWoodNetVolume();

  // --- CALCULAR CAJA SELLADA ---
  const calculateSealed = (): CalculatedSealed => {
    if (validationError || !adjParams.fs || !adjParams.vas || !adjParams.qts) {
      return { valid: false, Vb: 0, Fc: 0, Qtc: targetQtc, F3: 0 };
    }

    const wasm = getWasm();

    if (woodMode === 'input' && manualNetVol > 0) {
      let sealedVb = manualNetVol * dampingFactor;
      let alpha = adjParams.vas / sealedVb;
      let sealedQtc = adjParams.qts * Math.sqrt(alpha + 1);
      
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
      let optimalVb = tempResult.vb_optimo;
      
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

    let VbPorted = 0;
    let FbPorted = 0;
    let F3Ported = 0;
    let alignmentActive = '';

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

  // --- CÁLCULO SÍNCRONO DE LONGITUD DE PUERTO ---
  const getPortLengthCalculation = () => {
    const pCount = typeof portCount === 'number' ? portCount : 0;
    if (pCount > 0 && portedData.Vb > 0) {
      let pDia = 0;
      if (portShape === 'round') {
        pDia = typeof portDiameter === 'number' ? portDiameter : 0;
      } else {
        const w = typeof portWidth === 'number' ? portWidth : 0;
        const h = typeof portHeight === 'number' ? portHeight : 0;
        pDia = 2 * Math.sqrt((w * h) / Math.PI);
      }

      if (pDia > 0) {
        const rPort = pDia / 2;
        const Lv = ((23562.5 * Math.pow(pDia, 2) * pCount) / (portedData.Fb * portedData.Fb * portedData.Vb)) - (1.46 * rPort);
        
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


  // Auto update slider values when preset changes
  useEffect(() => {
    if (!customPorted && portedData.valid) {
      setCustomVb(Math.round(portedData.Vb * 10) / 10);
      setCustomFb(Math.round(portedData.Fb * 10) / 10);
    }
  }, [preset, customPorted, portedData.valid]);

  const handleExportReport = () => {
    console.log("handleExportReport: triggered");
    try {
      // Recopilar datos del crossover si está registrado
      let xoverData: any = {};
      if (crossoverRef.current) {
        xoverData = crossoverRef.current();
      }

      // Longitud del puerto, diámetro equivalente, velocidad del aire
      let pLen = 'N/A';
      let vp: number | null = null;
      const pCount = typeof portCount === 'number' ? portCount : 0;
      if (pCount > 0 && portedData.valid && portedData.Vb > 0) {
        let pDia = 0;
        if (portShape === 'round') {
          pDia = portDiameter || 0;
        } else if (portShape === 'custom') {
          const a = portArea || 0;
          pDia = 2 * Math.sqrt(a / Math.PI);
        } else {
          const w = portWidth || 0;
          const h = portHeight || 0;
          pDia = 2 * Math.sqrt((w * h) / Math.PI);
        }
        
        if (pDia > 0) {
          const rPort = pDia / 2;
          const Lv = ((23562.5 * Math.pow(pDia, 2) * pCount) / (portedData.Fb * portedData.Fb * (cabinetRef.current?.vNeto || portedData.Vb))) - (1.46 * rPort);
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
    } catch (e: any) {
      console.error("handleExportReport: error", e);
      alert(t("Ocurrió un error al generar el reporte: ") + e.message);
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
          setCustomPorted={setCustomPorted}
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
        />

        {/* CONTENIDOS DERECHA */}
        <main className="dashboard-main">
          {/* Gráfico */}
          <SimulationChart 
            lang={lang}
            theme={theme}
            sealedData={boxType === 'sealed' && sealedData.valid ? sealedData : null}
            portedData={boxType === 'ported' && portedData.valid ? portedData : null}
            bandpassData={boxType === 'bandpass' && bandpassData.valid ? bandpassData : null}
            params={adjParams}
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
                onCabinetDataChange={handleCabinetDataChange}
                readOnly={true}
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
