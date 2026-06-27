import { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { SpeakerParamsForm } from './components/SpeakerParamsForm';
import { SimulationChart } from './components/SimulationChart';
import { SealedBoxTab } from './components/SealedBoxTab';
import { PortedBoxTab } from './components/PortedBoxTab';
import { CabinetTab } from './components/CabinetTab';
import { CrossoverTab } from './components/CrossoverTab';
import { type Lang, translate } from './utils/translations';
import { type UnitSystem } from './utils/units';
import type { SpeakerParams, CalculatedSealed, CalculatedPorted, CustomDriver } from './types';
import { estimateF3 } from './utils/acousticMath';
import { getWasm, initWasm } from './wasm/index.ts';
import { generateReportHTML } from './utils/reportGenerator';

function App() {
  // Theme & Language
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lang') as Lang) || 'es');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(() => (localStorage.getItem('unitSystem') as UnitSystem) || 'metric');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('theme') as 'dark' | 'light') || 'dark');
  const [activeTab, setActiveTab] = useState<'sealed' | 'ported' | 'wood' | 'damping' | 'crossover'>('sealed');

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

  // Woodworking parameters
  const [woodMode, setWoodMode] = useState<'calc' | 'input'>('calc');
  const [woodShape, setWoodShape] = useState<'rectangular' | 'trapezoidal'>('rectangular');
  const [woodConstraint, setWoodConstraint] = useState<string>('none');
  const [woodSource, setWoodSource] = useState<'sealed' | 'ported'>('ported');
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

  // EBP Calculation
  const ebpValue = params.qes ? (params.fs / params.qes) : null;

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

  // Auto update slider values when preset changes
  useEffect(() => {
    if (!customPorted && portedData.valid) {
      setCustomVb(Math.round(portedData.Vb * 10) / 10);
      setCustomFb(Math.round(portedData.Fb * 10) / 10);
    }
  }, [preset, customPorted, portedData.valid]);

  const t = (text: string) => translate(text, lang);

  // Suggest EBP alignment recommendation
  const getEbpRecommendation = () => {
    if (ebpValue === null) return t("Qes requerido para EBP");
    if (ebpValue < 50) {
      return `${t("Sugerido: Sellada")} - ${t("Bobina bien amortiguada. Sugerencia: Caja Sellada (Sealed).")}`;
    } else if (ebpValue > 90) {
      return `${t("Sugerido: Ventilada")} - ${t("Alto control electromecánico. Sugerencia: Caja Ventilada (Ported).")}`;
    } else {
      return `${t("Multiuso")} - ${t("Rango medio. Sugerencia: Apta para caja sellada o ventilada.")}`;
    }
  };

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
        activeTab === 'sealed' ? 'sealed' : 'ported',
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

        {/* CONTENIDOS DERECHA */}
        <main className="dashboard-main">
          {/* EBP Badges */}
          <div className={`ebp-badge-card ${ebpValue ? (ebpValue < 50 ? 'ebp-sealed' : ebpValue > 90 ? 'ebp-ported' : 'ebp-normal') : 'ebp-normal'}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.8rem 1.2rem', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.4rem' }}>
              <span>EBP: {ebpValue ? ebpValue.toFixed(1) : 'N/A'}</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.85, fontWeight: 500 }}>
                {t("(Efficiency Bandwidth Product = Fs / Qes)")}
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
              {getEbpRecommendation()}
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, lineHeight: '1.3' }}>
              {t("EBP ayuda a decidir la caja: < 50 ideal Sellada, > 90 ideal Ventilada, entre 50 y 90 apta para ambas.")}
            </div>
          </div>

          {/* Gráfico */}
          <SimulationChart 
            lang={lang}
            theme={theme}
            sealedData={sealedData.valid ? sealedData : null}
            portedData={portedData.valid ? portedData : null}
            params={adjParams}
          />

          {/* Caja Acústica Pestañas */}
          <div className="panel">
            {/* Tabs header */}
            <div className="tabs-header">
              <button 
                className={`tab-btn ${activeTab === 'sealed' ? 'active' : ''}`} 
                onClick={() => setActiveTab('sealed')}
              >
                {t("Caja Sellada")}
              </button>
              <button 
                className={`tab-btn ${activeTab === 'ported' ? 'active' : ''}`} 
                onClick={() => setActiveTab('ported')}
              >
                {t("Caja Ventilada")}
              </button>
              <button 
                className={`tab-btn ${activeTab === 'wood' ? 'active' : ''}`} 
                onClick={() => setActiveTab('wood')}
              >
                {t("Dimensiones de la caja")}
              </button>
              <button 
                className={`tab-btn ${activeTab === 'damping' ? 'active' : ''}`} 
                onClick={() => setActiveTab('damping')}
              >
                {t("Relleno Acústico")}
              </button>
              <button 
                className={`tab-btn ${activeTab === 'crossover' ? 'active' : ''}`} 
                onClick={() => setActiveTab('crossover')}
              >
                {t("Divisores de Frecuencia")}
              </button>
            </div>

            {activeTab === 'sealed' && (
              <SealedBoxTab 
                lang={lang}
                unitSystem={unitSystem}
                sealedData={sealedData}
                targetQtc={targetQtc}
                setTargetQtc={setTargetQtc}
                isLinkedToCabinet={woodMode === 'input' && manualNetVol > 0}
                onExportReport={handleExportReport}
              />
            )}

            {activeTab === 'ported' && (
              <PortedBoxTab 
                lang={lang}
                unitSystem={unitSystem}
                portedData={portedData}
                params={adjParams}
                customVb={customVb}
                setCustomVb={setCustomVb}
                customFb={customFb}
                setCustomFb={setCustomFb}
                customPorted={customPorted}
                setCustomPorted={setCustomPorted}
                portCount={portCount}
                setPortCount={setPortCount}
                portDiameter={portDiameter}
                setPortDiameter={setPortDiameter}
                portShape={portShape}
                setPortShape={setPortShape}
                portWidth={portWidth}
                setPortWidth={setPortWidth}
                portHeight={portHeight}
                setPortHeight={setPortHeight}
                portArea={portArea}
                setPortArea={setPortArea}
                isLinkedToCabinet={woodMode === 'input' && manualNetVol > 0}
                onExportReport={handleExportReport}
              />
            )}

            {activeTab === 'wood' && (
              <CabinetTab 
                lang={lang}
                unitSystem={unitSystem}
                params={adjParams}
                sealedData={sealedData}
                portedData={portedData}
                woodMode={woodMode}
                setWoodMode={setWoodMode}
                woodShape={woodShape}
                setWoodShape={setWoodShape}
                woodConstraint={woodConstraint}
                setWoodConstraint={setWoodConstraint}
                woodSource={woodSource}
                setWoodSource={setWoodSource}
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
              />
            )}

            {/* Pestaña Damping */}
            {activeTab === 'damping' && (
              <div className="tab-content active" style={{ padding: '1.5rem' }}>
                {/* Selector de variante */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: '1.4' }}>
                    {t("Relleno Acústico (Damping / Fill):")}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                    {[
                      { id: 'none',     label: t("Ninguno (0%)"),     desc: t("Sin Relleno (Proceso Adiabático)") },
                      { id: 'light',    label: t("Leve (~5%)"),        desc: t("Relleno Leve (Damping de Paredes)") },
                      { id: 'moderate', label: t("Moderado (~12%)"),  desc: t("Relleno Moderado (Fibra Suelta)") },
                      { id: 'heavy',    label: t("Denso (~20%)"),      desc: t("Relleno Denso (Fibra Uniforme)") }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDampingType(opt.id as any)}
                        style={{
                          padding: '0.5rem 1rem',
                          fontSize: '0.82rem',
                          borderRadius: '8px',
                          border: '2px solid ' + (dampingType === opt.id ? 'var(--primary)' : 'var(--card-border)'),
                          background: dampingType === opt.id ? 'var(--primary)' : 'var(--card-bg)',
                          color: dampingType === opt.id ? '#ffffff' : 'var(--text-main)',
                          cursor: 'pointer',
                          fontWeight: dampingType === opt.id ? 700 : 500,
                          transition: 'all 0.18s ease',
                          boxShadow: dampingType === opt.id ? '0 0 0 3px var(--primary-glow)' : 'none'
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Panel de visualización */}
                <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-start', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '10px', padding: '1.25rem' }}>
                  <img
                    src={
                      dampingType === 'light'    ? '/damping_light.jpg' :
                      dampingType === 'moderate' ? '/damping_moderate.jpg' :
                      dampingType === 'heavy'    ? '/damping_heavy.jpg' :
                      '/damping_none.jpg'
                    }
                    alt={t("Esquema de relleno")}
                    style={{ width: '160px', height: '160px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--card-border)', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '1rem', color: 'var(--primary)' }}>
                      {dampingType === 'none'     && t("Sin Relleno (Proceso Adiabático)")}
                      {dampingType === 'light'    && t("Relleno Leve (Damping de Paredes)")}
                      {dampingType === 'moderate' && t("Relleno Moderado (Fibra Suelta)")}
                      {dampingType === 'heavy'    && t("Relleno Denso (Fibra Uniforme)")}
                    </strong>
                    <p style={{ fontSize: '0.82rem', lineHeight: '1.5', margin: 0, color: 'var(--text-main)', opacity: 0.9 }}>
                      {dampingType === 'none'     && t("Caja completamente vacía. El aire se comprime sin absorber calor. Ideal para simulaciones de referencia o cuando no se utiliza ningún material absorbente.")}
                      {dampingType === 'light'    && t("Se cubren únicamente las paredes internas con una capa delgada de unos 2 a 3 cm. Ayuda a atenuar rebotes y ondas estacionarias de alta frecuencia sin alterar significativamente el volumen virtual.")}
                      {dampingType === 'moderate' && t("Se rellena la caja de forma suelta y esponjosa ocupando gran parte del espacio, sin compactarla. Logra un aumento virtual del volumen acústico del ~12%, ideal para compactar el diseño del bafle conservando buenos graves.")}
                      {dampingType === 'heavy'    && t("Se rellena la caja con fibra uniforme y más densa, cubriendo casi todo el volumen interior pero sin comprimir a presión. Maximiza el aumento de volumen virtual hasta un ~20%, ideal para cajas muy compactas.")}
                    </p>
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                          {dampingType === 'none' ? '0%' : dampingType === 'light' ? '+5%' : dampingType === 'moderate' ? '+12%' : '+20%'}
                        </span>{' '}{t("Vol. virtual (Vb aparente)")}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <span style={{ fontWeight: 700, color: dampingType === 'none' ? 'var(--text-muted)' : 'var(--success)' }}>
                          {dampingType === 'none' ? t("Adiabático") : t("Isotérmico")}
                        </span>{' '}{t("Proceso térmico")}
                      </div>
                    </div>
                    <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--card-border)' }}>
                      <strong style={{ fontSize: '0.78rem', color: 'var(--text-main)', display: 'block', marginBottom: '0.4rem' }}>
                        {t("Los materiales más utilizados son:")}
                      </strong>
                      <ul style={{ fontSize: '0.78rem', lineHeight: '1.45', margin: 0, paddingLeft: '1.1rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <li>
                          <strong>{t("Delcrón o guata:")}</strong> {t("Es el material más común (aspecto de algodón sintético) usado en almohadas; es económico y muy eficiente para absorber el sonido.")}
                        </li>
                        <li>
                          <strong>{t("Lana de roca o fibra de vidrio:")}</strong> {t("Materiales aislantes clásicos. Son muy efectivos acústicamente, aunque se debe manipular con cuidado para evitar que el polvo ingrese al cono del parlante.")}
                        </li>
                        <li>
                          <strong>{t("Espuma acústica:")}</strong> {t("Se utiliza en forma de planchas en las paredes internas o como aros alrededor del parlante para evitar fugas de aire.")}
                        </li>
                        <li>
                          <strong>{t("Algodón natural:")}</strong> {t("Otra alternativa económica que ayuda a disipar el calor interno y controlar las resonancias.")}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'crossover' && (
              <CrossoverTab lang={lang} onRegisterExporter={handleRegisterCrossover} />
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
