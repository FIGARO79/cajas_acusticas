import React, { useState, useEffect } from 'react';
import { type Lang, translate } from '../utils/translations';
import { getWasm } from '../wasm/index.ts';
import type { CrossoverResult, CrossoverExportData } from '../types';

interface CrossoverTabProps {
  lang: Lang;
  onRegisterExporter?: (exporter: () => CrossoverExportData) => void;
  readOnly?: boolean;
  crossoverWaysProp?: '2way' | '3way';
  crossoverTypeProp?: '1st_order' | '2nd_butter' | '2nd_lr' | '4th_lr';
  fcProp?: number;
  fcLowProp?: number;
  fcHighProp?: number;
  zTweeterProp?: number;
  zMidrangeProp?: number;
  zWooferProp?: number;
  enableZobelProp?: boolean;
  reProp?: number;
  leProp?: number;
  enableLPadProp?: boolean;
  attenuationProp?: number;
  zLoadProp?: number;
}

const CrossoverTabComponent: React.FC<CrossoverTabProps> = ({
  lang,
  onRegisterExporter,
  readOnly = false,
  crossoverWaysProp,
  crossoverTypeProp,
  fcProp,
  fcLowProp,
  fcHighProp,
  zTweeterProp,
  zMidrangeProp,
  zWooferProp,
  enableZobelProp,
  reProp,
  leProp,
  enableLPadProp,
  attenuationProp,
  zLoadProp
}) => {
  const t = (text: string) => translate(text, lang);

  // 1. Crossover Way Mode
  const [crossoverWaysLocal, setCrossoverWays] = useState<'2way' | '3way'>('2way');

  // 2. Crossover Inputs
  const [fcLocal, setFc] = useState<number | ''>(2500); // For 2-way
  const [fcLowLocal, setFcLow] = useState<number | ''>(500); // For 3-way Low-Mid
  const [fcHighLocal, setFcHigh] = useState<number | ''>(4000); // For 3-way Mid-High
  const [zTweeterLocal, setZTweeter] = useState<number>(8);
  const [zMidrangeLocal, setZMidrange] = useState<number>(8);
  const [zWooferLocal, setZWoofer] = useState<number>(8);
  const [crossoverTypeLocal, setCrossoverType] = useState<'1st_order' | '2nd_butter' | '2nd_lr' | '4th_lr'>('2nd_lr');

  // 3. Zobel Network Inputs
  const [enableZobelLocal, setEnableZobel] = useState<boolean>(false);
  const [reLocal, setRe] = useState<number>(5.8);
  const [leLocal, setLe] = useState<number>(0.6); // mH

  // 4. L-Pad Attenuator Inputs
  const [enableLPadLocal, setEnableLPad] = useState<boolean>(false);
  const [attenuationLocal, setAttenuation] = useState<number>(3); // dB
  const [zLoadLocal, setZLoad] = useState<number>(8);

  // Resolver valores activos
  const crossoverWays = readOnly ? (crossoverWaysProp || '2way') : crossoverWaysLocal;
  const crossoverType = readOnly ? (crossoverTypeProp || '2nd_lr') : crossoverTypeLocal;
  const fc = readOnly ? (fcProp || 2500) : fcLocal;
  const fcLow = readOnly ? (fcLowProp || 500) : fcLowLocal;
  const fcHigh = readOnly ? (fcHighProp || 4000) : fcHighLocal;
  const zTweeter = readOnly ? (zTweeterProp ?? 8) : zTweeterLocal;
  const zMidrange = readOnly ? (zMidrangeProp ?? 8) : zMidrangeLocal;
  const zWoofer = readOnly ? (zWooferProp ?? 8) : zWooferLocal;
  const enableZobel = readOnly ? (enableZobelProp ?? false) : enableZobelLocal;
  const re = readOnly ? (reProp ?? 5.8) : reLocal;
  const le = readOnly ? (leProp ?? 0.6) : leLocal;
  const enableLPad = readOnly ? (enableLPadProp ?? false) : enableLPadLocal;
  const attenuation = readOnly ? (attenuationProp ?? 3) : attenuationLocal;
  const zLoad = readOnly ? (zLoadProp ?? 8) : zLoadLocal;

  // --- CROSSOVER CALCULATIONS ---
  const calculateCrossover = (): CrossoverResult | null => {
    const Rt = zTweeter;
    const Rm = zMidrange;
    const Rw = zWoofer;

    if (crossoverWays === '2way') {
      const f = fc;
      if (!f || f <= 0 || Rt <= 0 || Rw <= 0) return null;

      try {
        const wasm = getWasm();

        // 1st Order (6 dB/oct)
        if (crossoverType === '1st_order') {
          const hpRes = wasm.calc_filtro_1er_orden(f, Rt);
          const lpRes = wasm.calc_filtro_1er_orden(f, Rw);
          return {
            ways: '2way' as const,
            type: '1st',
            hp: { c1: hpRes.c, l1: null },
            lp: { l1: lpRes.l, c1: null }
          };
        }

        // 2nd Order Butterworth (12 dB/oct)
        if (crossoverType === '2nd_butter') {
          const hpRes = wasm.calc_filtro_2do_orden_butterworth(f, Rt);
          const lpRes = wasm.calc_filtro_2do_orden_butterworth(f, Rw);
          return {
            ways: '2way' as const,
            type: '2nd_butter',
            hp: { c1: hpRes.c_hp, l1: hpRes.l_hp },
            lp: { l1: lpRes.l_lp, c1: lpRes.c_lp }
          };
        }

        // 2nd Order Linkwitz-Riley (12 dB/oct)
        if (crossoverType === '2nd_lr') {
          const hpRes = wasm.calc_filtro_linkwitz_riley(f, Rt);
          const lpRes = wasm.calc_filtro_linkwitz_riley(f, Rw);
          return {
            ways: '2way' as const,
            type: '2nd_lr',
            hp: { c1: hpRes.c, l1: hpRes.l },
            lp: { l1: lpRes.l, c1: lpRes.c }
          };
        }

        // 4th Order Linkwitz-Riley (24 dB/oct)
        if (crossoverType === '4th_lr') {
          const c1_t = 0.0796 * 1000000 / (f * Rt / 1000);
          const c2_t = 0.1592 * 1000000 / (f * Rt / 1000);
          const l1_t = 0.1592 * Rt * 1000 / (f / 1000);
          const l2_t = 0.0796 * Rt * 1000 / (f / 1000);

          const c1_w = 0.0796 * 1000000 / (f * Rw / 1000);
          const c2_w = 0.1592 * 1000000 / (f * Rw / 1000);
          const l1_w = 0.1592 * Rw * 1000 / (f / 1000);
          const l2_w = 0.0796 * Rw * 1000 / (f / 1000);

          return {
            ways: '2way' as const,
            type: '4th_lr',
            hp: { c1: c1_t / 1000, l1: l1_t / 1000, c2: c2_t / 1000, l2: l2_t / 1000 },
            lp: { l1: l1_w / 1000, c1: c1_w / 1000, l2: l2_w / 1000, c2: c2_w / 1000 }
          };
        }
      } catch (e) {
        console.error("WASM crossover calculation error, falling back to JS:", e);
      }

      // Fallback JS math (2-way)
      return {
        ways: '2way' as const,
        type: '1st',
        hp: { c1: 1000000 / (2 * Math.PI * f * Rt), l1: null },
        lp: { l1: (Rw * 1000) / (2 * Math.PI * f), c1: null }
      };
    } else {
      // 3-way Crossover Calculations
      // fL = fcLow, fH = fcHigh.
      const fL = fcLow;
      const fH = fcHigh;
      if (!fL || !fH || fL <= 0 || fH <= 0 || fL >= fH || Rt <= 0 || Rm <= 0 || Rw <= 0) return null;

      // We'll calculate components for:
      // Tweeter (High Pass at fH)
      // Midrange (Bandpass: High Pass at fL and Low Pass at fH)
      // Woofer (Low Pass at fL)
      
      if (crossoverType === '1st_order') {
        // 1st order: 6dB/oct
        // C_tweeter = 1 / (2*pi*fH*Rt)
        // Midrange HP: C_mid_hp = 1 / (2*pi*fL*Rm)
        // Midrange LP: L_mid_lp = Rm / (2*pi*fH)
        // Woofer LP: L_woofer = Rw / (2*pi*fL)
        const c_tweeter = 1000000 / (2 * Math.PI * fH * Rt);
        const c_mid_hp = 1000000 / (2 * Math.PI * fL * Rm);
        const l_mid_lp = (Rm * 1000) / (2 * Math.PI * fH);
        const l_woofer = (Rw * 1000) / (2 * Math.PI * fL);

        return {
          ways: '3way' as const,
          type: '1st',
          hp: { c1: c_tweeter, l1: null },
          bp: { c_hp: c_mid_hp, l_hp: null, l_lp: l_mid_lp, c_lp: null },
          lp: { l1: l_woofer, c1: null }
        };
      }

      if (crossoverType === '2nd_butter') {
        // 2nd order Butterworth: 12dB/oct
        const sqrt2 = Math.sqrt(2);
        
        // Tweeter (High-pass at fH)
        const c1_tweeter = 1000000 / (2 * Math.PI * fH * Rt * sqrt2);
        const l1_tweeter = (Rt * 1000) / (2 * Math.PI * fH * sqrt2);

        // Midrange Bandpass:
        // HP section at fL:
        const c_mid_hp = 1000000 / (2 * Math.PI * fL * Rm * sqrt2);
        const l_mid_hp = (Rm * 1000) / (2 * Math.PI * fL * sqrt2);
        // LP section at fH:
        const c_mid_lp = (sqrt2 * 1000000) / (2 * Math.PI * fH * Rm);
        const l_mid_lp = (Rm * sqrt2 * 1000) / (2 * Math.PI * fH);

        // Woofer (Low-pass at fL)
        const c1_woofer = (sqrt2 * 1000000) / (2 * Math.PI * fL * Rw);
        const l1_woofer = (Rw * sqrt2 * 1000) / (2 * Math.PI * fL);

        return {
          ways: '3way' as const,
          type: '2nd_butter',
          hp: { c1: c1_tweeter, l1: l1_tweeter },
          bp: { c_hp: c_mid_hp, l_hp: l_mid_hp, l_lp: l_mid_lp, c_lp: c_mid_lp },
          lp: { l1: l1_woofer, c1: c1_woofer }
        };
      }

      if (crossoverType === '2nd_lr') {
        // 2nd order Linkwitz-Riley (Q=0.5)
        // C_hp = 1 / (4*pi*f*R)
        // L_hp = R / (pi*f) (parallel) -> wait, LR2 equations:
        // C = 0.0796 / (f_kHz * R) -> C = 1_000_000 / (4 * pi * f * R)
        // L = R / (pi * f)
        
        const c_t = 1000000 / (4 * Math.PI * fH * Rt);
        const l_t = (Rt * 1000) / (Math.PI * fH);

        const c_m_hp = 1000000 / (4 * Math.PI * fL * Rm);
        const l_m_hp = (Rm * 1000) / (Math.PI * fL);
        const c_m_lp = 1000000 / (4 * Math.PI * fH * Rm);
        const l_m_lp = (Rm * 1000) / (Math.PI * fH);

        const c_w = 1000000 / (4 * Math.PI * fL * Rw);
        const l_w = (Rw * 1000) / (Math.PI * fL);

        return {
          ways: '3way' as const,
          type: '2nd_lr',
          hp: { c1: c_t, l1: l_t },
          bp: { c_hp: c_m_hp, l_hp: l_m_hp, l_lp: l_m_lp, c_lp: c_m_lp },
          lp: { l1: l_w, c1: c_w }
        };
      }

      // 4th Order Linkwitz-Riley for 3-way
      // We will perform calculations using cascading math
      const c1_t = 0.0796 * 1000000 / (fH * Rt);
      const c2_t = 0.1592 * 1000000 / (fH * Rt);
      const l1_t = 0.1592 * Rt * 1000 / fH;
      const l2_t = 0.0796 * Rt * 1000 / fH;

      // Midrange HP section at fL (4th Order)
      const c1_m_hp = 0.0796 * 1000000 / (fL * Rm);
      const c2_m_hp = 0.1592 * 1000000 / (fL * Rm);
      const l1_m_hp = 0.1592 * Rm * 1000 / fL;
      const l2_m_hp = 0.0796 * Rm * 1000 / fL;

      // Midrange LP section at fH (4th Order)
      const c1_m_lp = 0.0796 * 1000000 / (fH * Rm);
      const c2_m_lp = 0.1592 * 1000000 / (fH * Rm);
      const l1_m_lp = 0.1592 * Rm * 1000 / fH;
      const l2_m_lp = 0.0796 * Rm * 1000 / fH;

      // Woofer LP section at fL (4th Order)
      const c1_w = 0.0796 * 1000000 / (fL * Rw);
      const c2_w = 0.1592 * 1000000 / (fL * Rw);
      const l1_w = 0.1592 * Rw * 1000 / fL;
      const l2_w = 0.0796 * Rw * 1000 / fL;

      return {
        ways: '3way' as const,
        type: '4th_lr',
        hp: { c1: c1_t, l1: l1_t, c2: c2_t, l2: l2_t },
        bp: { 
          c1_hp: c1_m_hp, c2_hp: c2_m_hp, l1_hp: l1_m_hp, l2_hp: l2_m_hp,
          c1_lp: c1_m_lp, c2_lp: c2_m_lp, l1_lp: l1_m_lp, l2_lp: l2_m_lp 
        },
        lp: { l1: l1_w, c1: c1_w, l2: l2_w, c2: c2_w }
      };
    }
  };

  const xoverResults = calculateCrossover();
  const xover3Way = xoverResults && xoverResults.ways === '3way' ? xoverResults : null;
  const hpFilter = xoverResults ? xoverResults.hp : null;
  const lpFilter = xoverResults ? xoverResults.lp : null;
  const bpFilter = xover3Way?.bp ?? null;

  // --- ZOBEL CALCULATIONS ---
  const calculateZobel = (): { rz: number; cz: number } | null => {
    if (re <= 0 || le <= 0) return null;
    try {
      const wasm = getWasm();
      const res = wasm.calc_zobel(re, le);
      return { rz: res.rz, cz: res.cz };
    } catch (e) {
      console.error("WASM Zobel error, falling back:", e);
      const rz = 1.25 * re;
      const cz = (le * 1000) / (rz * rz);
      return { rz, cz };
    }
  };

  const zobelResults = calculateZobel();

  // --- L-PAD CALCULATIONS ---
  const calculateLPad = () => {
    if (attenuation <= 0 || zLoad <= 0) return null;
    try {
      const wasm = getWasm();
      const res = wasm.calc_lpad(attenuation, zLoad);
      return { r1: res.r1, r2: res.r2 };
    } catch (e) {
      console.error("WASM LPad error, falling back:", e);
      const k = Math.pow(10, -attenuation / 20);
      const r1 = zLoad * (1 - k);
      const r2 = zLoad * k / (1 - k);
      return { r1, r2 };
    }
  };

  const lpadResults = calculateLPad();

  useEffect(() => {
    if (onRegisterExporter) {
      onRegisterExporter(() => {
        return {
          crossoverWays,
          crossoverType,
          fc: typeof fc === 'number' ? fc : 0,
          fcLow: typeof fcLow === 'number' ? fcLow : 0,
          fcHigh: typeof fcHigh === 'number' ? fcHigh : 0,
          zTweeter,
          zMidrange,
          zWoofer,
          enableZobel,
          re,
          le,
          enableLPad,
          attenuation,
          zLoad,
          xoverResults,
          zobelResults,
          lpadResults
        };
      });
    }
  }, [
    crossoverWays, crossoverType, fc, fcLow, fcHigh, zTweeter, zMidrange, zWoofer,
    enableZobel, re, le, enableLPad, attenuation, zLoad, xoverResults, zobelResults, lpadResults, onRegisterExporter
  ]);

  const renderSchematic = () => {
    if (!xoverResults) return null;

    const renderLegend = () => (
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '1rem', 
        marginTop: '0.75rem', 
        paddingTop: '0.75rem', 
        borderTop: '1px solid var(--card-border)', 
        width: '100%', 
        justifyContent: 'center',
        fontSize: '0.85rem',
        color: 'var(--text-muted)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="40" height="20" viewBox="0 0 40 20" style={{ color: 'var(--text-main)' }}>
            <path d="M 5,10 Q 12,3 19,10 Q 26,3 33,10" fill="none" stroke="currentColor" strokeWidth="2.5" />
          </svg>
          <span><strong>Bobina (Inductor - L):</strong> {t("Filtra altas frecuencias")}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="40" height="20" viewBox="0 0 40 20" style={{ color: 'var(--text-main)' }}>
            <line x1="16" y1="2" x2="16" y2="18" stroke="currentColor" strokeWidth="3.5" />
            <line x1="24" y1="2" x2="24" y2="18" stroke="currentColor" strokeWidth="3.5" />
            <line x1="5" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="2" />
            <line x1="24" y1="10" x2="35" y2="10" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span><strong>Condensador (Capacitor - C):</strong> {t("Filtra bajas frecuencias")}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="40" height="20" viewBox="0 0 40 20" style={{ color: 'var(--text-main)' }}>
            <path d="M 5,10 L 10,5 L 15,15 L 20,5 L 25,15 L 30,5 L 35,10" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span><strong>Resistencia (R):</strong> {t("Atenúa o acopla impedancia")}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="30" height="20" viewBox="0 0 30 20" style={{ color: 'var(--text-main)' }}>
            <rect x="2" y="5" width="6" height="10" fill="none" stroke="currentColor" strokeWidth="2" />
            <polygon points="8,5 18,1 18,19 8,15" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span><strong>Altavoz (Parlante):</strong> {t("Produce el sonido")}</span>
        </div>
      </div>
    );

    if (xoverResults.ways === '2way') {
      const hp = xoverResults.hp;
      const lp = xoverResults.lp;

      // Determinamos las coordenadas de los altavoces fijas en 640 para alineación perfecta
      const tweeterX = 640;
      const tweeterTextX = 705;

      const wooferX = 640;
      const wooferTextX = 705;

      return (
        <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1rem 1.5rem 1.25rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', boxSizing: 'border-box', backdropFilter: 'blur(16px)' }}>
          <span className="control-title" style={{ alignSelf: 'flex-start', fontSize: '1rem', color: 'var(--text-main)', marginBottom: '0.75rem', fontWeight: 600 }}>
            {t("Esquema de Conexión del Crossover (2 Vías)")}
          </span>
          <svg width="100%" viewBox="0 -25 850 475" fill="none" style={{ maxWidth: '100%', height: 'auto', color: 'var(--text-main)' }}>
            {/* --- HIGH PASS (TWEETER) --- */}
            <text x="30" y="70" fill="#ef4444" fontSize="26" fontWeight="bold">+</text>
            <text x="30" y="190" fill="currentColor" fontSize="28" fontWeight="bold">-</text>

            <text x="30" y="-5" fill="var(--text-muted)" fontSize="14" fontWeight="bold">{t("ENTRADA (DE AMP)")}</text>

            {/* Wires */}
            <line x1="60" y1="60" x2="160" y2="60" stroke="#ef4444" strokeWidth="4" />
            <line x1="60" y1="180" x2={tweeterX} y2="180" stroke="currentColor" strokeWidth="4" />

            {/* HIGH PASS FILTER COMPONENTS */}
            {crossoverType === '4th_lr' ? (
              <>
                {/* --- 4TH ORDER: C1 (Serie) → L1 (Paralelo) → C2 (Serie) → L2 (Paralelo) --- */}

                {/* C1 Capacitor (Serie) */}
                <line x1="120" y1="60" x2="145" y2="60" stroke="#ef4444" strokeWidth="4" />
                <line x1="145" y1="30" x2="145" y2="90" stroke="#ef4444" strokeWidth="6" />
                <line x1="160" y1="30" x2="160" y2="90" stroke="#ef4444" strokeWidth="6" />
                <line x1="160" y1="60" x2="200" y2="60" stroke="#ef4444" strokeWidth="4" />
                <text x="120" y="20" fill="var(--primary)" fontSize="14" fontWeight="bold">C1 = {hp.c1 ? `${hp.c1.toFixed(2)} µF` : ''}</text>

                {/* L1 (Paralelo) */}
                <circle cx="200" cy="60" r="7" fill="#ef4444" />
                <circle cx="200" cy="180" r="7" fill="currentColor" />
                <line x1="200" y1="60" x2="200" y2="75" stroke="#ef4444" strokeWidth="4" />
                <path d="M 200,75 Q 175,87 200,99 Q 175,111 200,123 Q 175,135 200,147 Q 175,159 200,171" fill="none" stroke="currentColor" strokeWidth="4" />
                <line x1="200" y1="171" x2="200" y2="180" stroke="currentColor" strokeWidth="4" />
                <text x="185" y="155" fill="var(--primary)" fontSize="14" fontWeight="bold" textAnchor="end">L1 = {(hp.l1 as number).toFixed(3)} mH</text>

                {/* Wire between L1 node and C2 */}
                <line x1="200" y1="60" x2="310" y2="60" stroke="#ef4444" strokeWidth="4" />

                {/* C2 Capacitor (Serie) */}
                <line x1="310" y1="60" x2="335" y2="60" stroke="#ef4444" strokeWidth="4" />
                <line x1="335" y1="30" x2="335" y2="90" stroke="#ef4444" strokeWidth="6" />
                <line x1="350" y1="30" x2="350" y2="90" stroke="#ef4444" strokeWidth="6" />
                <line x1="350" y1="60" x2="390" y2="60" stroke="#ef4444" strokeWidth="4" />
                <text x="310" y="20" fill="var(--primary)" fontSize="14" fontWeight="bold">C2 = {hp.c2 ? `${hp.c2.toFixed(2)} µF` : ''}</text>

                {/* L2 (Paralelo) */}
                <circle cx="390" cy="60" r="7" fill="#ef4444" />
                <circle cx="390" cy="180" r="7" fill="currentColor" />
                <line x1="390" y1="60" x2="390" y2="75" stroke="#ef4444" strokeWidth="4" />
                <path d="M 390,75 Q 365,87 390,99 Q 365,111 390,123 Q 365,135 390,147 Q 365,159 390,171" fill="none" stroke="currentColor" strokeWidth="4" />
                <line x1="390" y1="171" x2="390" y2="180" stroke="currentColor" strokeWidth="4" />
                <text x="405" y="155" fill="var(--primary)" fontSize="14" fontWeight="bold">L2 = {hp.l2 ? `${hp.l2.toFixed(3)} mH` : ''}</text>

                {/* Wire to L-Pad or Tweeter */}
                <line x1="390" y1="60" x2={enableLPad ? 440 : tweeterX} y2="60" stroke="#ef4444" strokeWidth="4" />
              </>
            ) : (
              <>
                {/* --- 1ST / 2ND ORDER: C1 (Serie) → L1 (Paralelo, si aplica) --- */}

                {/* C1 Capacitor */}
                <line x1="160" y1="60" x2="200" y2="60" stroke="#ef4444" strokeWidth="4" />
                <line x1="200" y1="30" x2="200" y2="90" stroke="#ef4444" strokeWidth="6" />
                <line x1="215" y1="30" x2="215" y2="90" stroke="#ef4444" strokeWidth="6" />
                <line x1="215" y1="60" x2="260" y2="60" stroke="#ef4444" strokeWidth="4" />
                <text x="140" y="115" fill="var(--primary)" fontSize="16" fontWeight="bold">C1 = {hp.c1 ? `${hp.c1.toFixed(2)} µF` : ''}</text>

                {/* Wire between C1 and node */}
                <line x1="260" y1="60" x2="360" y2="60" stroke="#ef4444" strokeWidth="4" />

                {/* L1 (Parallel) for 2nd order */}
                {hp.l1 !== null && hp.l1 !== undefined && hp.l1 > 0 ? (
                  <>
                    <circle cx="360" cy="60" r="7" fill="#ef4444" />
                    <circle cx="360" cy="180" r="7" fill="currentColor" />
                    <line x1="360" y1="60" x2="360" y2="75" stroke="#ef4444" strokeWidth="4" />
                    <path d="M 360,75 Q 335,87 360,99 Q 335,111 360,123 Q 335,135 360,147 Q 335,159 360,171" fill="none" stroke="currentColor" strokeWidth="4" />
                    <line x1="360" y1="171" x2="360" y2="180" stroke="currentColor" strokeWidth="4" />
                    <text x="380" y="125" fill="var(--primary)" fontSize="16" fontWeight="bold">L1 = {hp.l1.toFixed(3)} mH</text>
                  </>
                ) : null}

                {/* Wire to L-Pad or Tweeter directly */}
                <line x1="360" y1="60" x2={enableLPad ? 440 : tweeterX} y2="60" stroke="#ef4444" strokeWidth="4" />
              </>
            )}

            {/* ATENUADOR L-PAD TWEETER */}
            {enableLPad && lpadResults ? (
              <>
                {/* Resistencia Serie R1 */}
                <path d="M 440,60 L 450,50 L 460,70 L 470,50 L 480,70 L 490,50 L 500,70 L 510,60" fill="none" stroke="#38bdf8" strokeWidth="4" />
                <line x1="510" y1="60" x2="560" y2="60" stroke="#ef4444" strokeWidth="4" />
                <text x="445" y="35" fill="#38bdf8" fontSize="13" fontWeight="bold">R_ser = {lpadResults.r1.toFixed(2)} Ω</text>

                {/* Nodo paralelo R2 */}
                <circle cx="560" cy="60" r="7" fill="#ef4444" />
                <circle cx="560" cy="180" r="7" fill="currentColor" />
                <line x1="560" y1="60" x2="560" y2="80" stroke="#ef4444" strokeWidth="4" />

                {/* Resistencia Paralelo R2 */}
                <path d="M 560,80 L 550,90 L 570,100 L 550,110 L 570,120 L 550,130 L 570,140 L 560,150" fill="none" stroke="#38bdf8" strokeWidth="4" />
                <line x1="560" y1="150" x2="560" y2="180" stroke="currentColor" strokeWidth="4" />
                <text x="540" y="125" textAnchor="end" fill="#38bdf8" fontSize="13" fontWeight="bold">R_par = {lpadResults.r2.toFixed(2)} Ω</text>

                <line x1="560" y1="60" x2={tweeterX} y2="60" stroke="#ef4444" strokeWidth="4" />
              </>
            ) : null}
            
            {/* Tweeter Symbol */}
            <rect x={tweeterX} y="32" width="16" height="56" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points={`${tweeterX + 16},32 ${tweeterX + 46},12 ${tweeterX + 46},108 ${tweeterX + 16},88`} fill="none" stroke="currentColor" strokeWidth="4" />
            <line x1={tweeterX} y1="88" x2={tweeterX} y2="180" stroke="currentColor" strokeWidth="4" />
            <text x={tweeterTextX} y="55" fill="currentColor" fontSize="16" fontWeight="bold">{t("Tweeter")}</text>
            <text x={tweeterTextX} y="78" fill="var(--text-muted)" fontSize="13">{t("High Pass (Vías Altas)")}</text>

            {/* --- LOW PASS (WOOFER) --- */}
            {/* Divider */}
            <line x1="20" y1="225" x2="830" y2="225" stroke="var(--card-border)" strokeWidth="2" strokeDasharray="8 8" />

            {/* Input labels */}
            <text x="30" y="280" fill="#ef4444" fontSize="26" fontWeight="bold">+</text>
            <text x="30" y="400" fill="currentColor" fontSize="28" fontWeight="bold">-</text>

            {/* Input wires */}
            <line x1="60" y1="270" x2={crossoverType === '4th_lr' ? 120 : 140} y2="270" stroke="#ef4444" strokeWidth="4" />
            <line x1="60" y1="390" x2={wooferX} y2="390" stroke="currentColor" strokeWidth="4" />

            {/* Woofer Crossover Components */}
            {crossoverType === '4th_lr' ? (
              <>
                <path d="M 120,270 Q 132,245 144,270 Q 156,245 168,270 Q 180,245 192,270 Q 204,245 216,270" fill="none" stroke="#ef4444" strokeWidth="4" />
                <line x1="216" y1="270" x2="250" y2="270" stroke="#ef4444" strokeWidth="4" />
                <text x="120" y="250" fill="var(--success)" fontSize="15" fontWeight="bold">L1 = {lp.l1 ? `${lp.l1.toFixed(3)} mH` : ''}</text>

                <circle cx="250" cy="270" r="7" fill="#ef4444" />
                <circle cx="250" cy="390" r="7" fill="currentColor" />
                <line x1="250" y1="270" x2="250" y2="295" stroke="#ef4444" strokeWidth="4" />
                <line x1="225" y1="295" x2="275" y2="295" stroke="currentColor" strokeWidth="6" />
                <line x1="225" y1="307" x2="275" y2="307" stroke="currentColor" strokeWidth="6" />
                <line x1="250" y1="307" x2="250" y2="390" stroke="currentColor" strokeWidth="4" />
                <text x="240" y="370" fill="var(--success)" fontSize="14" fontWeight="bold" textAnchor="end">C1 = {lp.c1 ? `${lp.c1.toFixed(2)} µF` : ''}</text>

                <line x1="250" y1="270" x2="330" y2="270" stroke="#ef4444" strokeWidth="4" />

                <path d="M 330,270 Q 342,245 354,270 Q 366,245 378,270 Q 390,245 402,270 Q 414,245 426,270" fill="none" stroke="#ef4444" strokeWidth="4" />
                <line x1="426" y1="270" x2="460" y2="270" stroke="#ef4444" strokeWidth="4" />
                <text x="330" y="250" fill="var(--success)" fontSize="15" fontWeight="bold">L2 = {lp.l2 ? `${lp.l2.toFixed(3)} mH` : ''}</text>

                <circle cx="460" cy="270" r="7" fill="#ef4444" />
                <circle cx="460" cy="390" r="7" fill="currentColor" />
                <line x1="460" y1="270" x2="460" y2="295" stroke="#ef4444" strokeWidth="4" />
                <line x1="435" y1="295" x2="485" y2="295" stroke="currentColor" strokeWidth="6" />
                <line x1="435" y1="307" x2="485" y2="307" stroke="currentColor" strokeWidth="6" />
                <line x1="460" y1="307" x2="460" y2="390" stroke="currentColor" strokeWidth="4" />
                <text x="450" y="370" fill="var(--success)" fontSize="14" fontWeight="bold" textAnchor="end">C2 = {lp.c2 ? `${lp.c2.toFixed(2)} µF` : ''}</text>

                <line x1="460" y1="270" x2={enableZobel ? 540 : wooferX} y2="270" stroke="#ef4444" strokeWidth="4" />
              </>
            ) : (
              <>
                <path d="M 140,270 Q 152,245 164,270 Q 176,245 188,270 Q 200,245 212,270 Q 224,245 236,270" fill="none" stroke="#ef4444" strokeWidth="4" />
                <line x1="236" y1="270" x2={enableZobel ? 540 : wooferX} y2="270" stroke="#ef4444" strokeWidth="4" />
                <text x="140" y="320" fill="var(--success)" fontSize="16" fontWeight="bold">L1 = {lp.l1 ? `${lp.l1.toFixed(3)} mH` : ''}</text>

                {lp.c1 !== null && lp.c1 !== undefined && lp.c1 > 0 ? (
                  <>
                    <circle cx="340" cy="270" r="7" fill="#ef4444" />
                    <circle cx="340" cy="390" r="7" fill="currentColor" />
                    <line x1="340" y1="270" x2="340" y2="295" stroke="#ef4444" strokeWidth="4" />
                    <line x1="315" y1="295" x2="365" y2="295" stroke="currentColor" strokeWidth="6" />
                    <line x1="315" y1="307" x2="365" y2="307" stroke="currentColor" strokeWidth="6" />
                    <line x1="340" y1="307" x2="340" y2="390" stroke="currentColor" strokeWidth="4" />
                    <text x="360" y="315" fill="var(--success)" fontSize="16" fontWeight="bold">C1 = {lp.c1.toFixed(2)} µF</text>
                  </>
                ) : null}
              </>
            )}

            {/* RED ZOBEL WOOFER */}
            {enableZobel && zobelResults ? (
              <>
                <circle cx="540" cy="270" r="7" fill="#ef4444" />
                <circle cx="540" cy="390" r="7" fill="currentColor" />
                
                {/* Cable paralelo Zobel */}
                <line x1="540" y1="270" x2="540" y2="290" stroke="#ef4444" strokeWidth="4" />
                
                {/* Resistencia Zobel Rz */}
                <path d="M 540,285 L 530,293 L 550,301 L 530,309 L 550,317 L 530,325 L 550,333 L 540,340" fill="none" stroke="var(--warning)" strokeWidth="4" />
                <text x="555" y="315" textAnchor="start" fill="var(--warning)" fontSize="13" fontWeight="bold">Rz = {zobelResults.rz.toFixed(2)} Ω</text>
                
                <line x1="540" y1="340" x2="540" y2="355" stroke="#ef4444" strokeWidth="4" />
                
                {/* Capacitor Zobel Cz */}
                <line x1="520" y1="355" x2="560" y2="355" stroke="currentColor" strokeWidth="6" />
                <line x1="520" y1="367" x2="560" y2="367" stroke="currentColor" strokeWidth="6" />
                <line x1="540" y1="367" x2="540" y2="390" stroke="currentColor" strokeWidth="4" />
                <text x="555" y="365" textAnchor="start" fill="var(--warning)" fontSize="13" fontWeight="bold">Cz = {zobelResults.cz.toFixed(2)} µF</text>
                
                <line x1="540" y1="270" x2={wooferX} y2="270" stroke="#ef4444" strokeWidth="4" />
              </>
            ) : null}

            {/* Woofer Symbol */}
            <rect x={wooferX} y="235" width="16" height="70" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points={`${wooferX + 16},235 ${wooferX + 46},205 ${wooferX + 46},340 ${wooferX + 16},310`} fill="none" stroke="currentColor" strokeWidth="4" />
            <line x1={wooferX} y1="305" x2={wooferX} y2="390" stroke="currentColor" strokeWidth="4" />
            <text x={wooferTextX} y="265" fill="currentColor" fontSize="16" fontWeight="bold">{t("Woofer")}</text>
            <text x={wooferTextX} y="288" fill="var(--text-muted)" fontSize="13">{t("Low Pass (Vías Bajas)")}</text>
          </svg>
          {renderLegend()}
        </div>
      );
    } else {
      // 3-way dynamic schematic rendering
      if (xover3Way === null) return null;
      const hp = xover3Way.hp;
      const bp = xover3Way.bp;
      const lp = xover3Way.lp;

      // Alineamos todos los altavoces de 3 vías de forma fija en la misma coordenada
      const tweeterX = 640;
      const tweeterTextX = 705;

      const midrangeX = 640;
      const midrangeTextX = 705;

      const wooferX = 640;
      const wooferTextX = 705;

      return (
        <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1rem 1.5rem 1.25rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', boxSizing: 'border-box', backdropFilter: 'blur(16px)' }}>
          <span className="control-title" style={{ alignSelf: 'flex-start', fontSize: '1rem', color: 'var(--text-main)', marginBottom: '0.75rem', fontWeight: 600 }}>
            {t("Esquema de Conexión del Crossover (3 Vías)")}
          </span>
          <svg width="100%" viewBox="0 0 850 640" fill="none" style={{ maxWidth: '100%', height: 'auto', color: 'var(--text-main)' }}>
            {/* --- INPUT COMMONS --- */}
            <text x="25" y="70" fill="#ef4444" fontSize="26" fontWeight="bold">+</text>
            <line x1="60" y1="60" x2="110" y2="60" stroke="#ef4444" strokeWidth="4" />
            
            <circle cx="110" cy="60" r="7" fill="#ef4444" />
            <line x1="110" y1="60" x2="110" y2="480" stroke="#ef4444" strokeWidth="4" />
            <circle cx="110" cy="270" r="7" fill="#ef4444" />
            <circle cx="110" cy="480" r="7" fill="#ef4444" />
            
            <text x="25" y="580" fill="currentColor" fontSize="28" fontWeight="bold">-</text>
            <line x1="80" y1="180" x2="80" y2="570" stroke="currentColor" strokeWidth="4" />
            <circle cx="80" cy="180" r="7" fill="currentColor" />
            <circle cx="80" cy="390" r="7" fill="currentColor" />
            <circle cx="80" cy="570" r="7" fill="currentColor" />
            <line x1="80" y1="180" x2={tweeterX} y2="180" stroke="currentColor" strokeWidth="4" />
            <line x1="80" y1="390" x2={midrangeX} y2="390" stroke="currentColor" strokeWidth="4" />
            <line x1="80" y1="570" x2={wooferX} y2="570" stroke="currentColor" strokeWidth="4" />
            <text x="70" y="600" fill="currentColor" fontSize="13" fontWeight="bold">{t("LINEA COMÚN NEGATIVO (TIERRA)")}</text>

            {/* --- RAIL 1: TWEETER (HIGH PASS) --- */}
            <line x1="110" y1="60" x2="160" y2="60" stroke="#ef4444" strokeWidth="4" />
            
            {/* Tweeter Series C1 */}
            <line x1="160" y1="60" x2="190" y2="60" stroke="#ef4444" strokeWidth="4" />
            <line x1="190" y1="30" x2="190" y2="90" stroke="#ef4444" strokeWidth="6" />
            <line x1="205" y1="30" x2="205" y2="90" stroke="#ef4444" strokeWidth="6" />
            <line x1="205" y1="60" x2="245" y2="60" stroke="#ef4444" strokeWidth="4" />
            <text x="140" y="115" fill="var(--primary)" fontSize="15" fontWeight="bold">C1 = {hp.c1 ? `${hp.c1.toFixed(2)} µF` : ''}</text>

            {/* Tweeter Parallel L1 */}
            {hp.l1 !== null && hp.l1 !== undefined && hp.l1 > 0 ? (
              <>
                <circle cx="310" cy="60" r="7" fill="#ef4444" />
                <line x1="310" y1="60" x2="310" y2="75" stroke="#ef4444" strokeWidth="4" />
                <path d="M 310,75 Q 285,87 310,99 Q 285,111 310,123 Q 285,135 310,147 Q 285,159 310,171" fill="none" stroke="currentColor" strokeWidth="4" />
                <line x1="310" y1="171" x2="310" y2="180" stroke="currentColor" strokeWidth="4" />
                <circle cx="310" cy="180" r="7" fill="currentColor" />
                <text x="330" y="125" fill="var(--primary)" fontSize="15" fontWeight="bold">L1 = {hp.l1.toFixed(3)} mH</text>
              </>
            ) : null}
            <line x1="245" y1="60" x2={enableLPad ? 440 : tweeterX} y2="60" stroke="#ef4444" strokeWidth="4" />

            {/* L-PAD EN TWEETER (3 Vías) */}
            {enableLPad && lpadResults ? (
              <>
                <path d="M 440,60 L 450,50 L 460,70 L 470,50 L 480,70 L 490,50 L 500,70 L 510,60" fill="none" stroke="#38bdf8" strokeWidth="4" />
                <line x1="510" y1="60" x2="560" y2="60" stroke="#ef4444" strokeWidth="4" />
                <text x="445" y="35" fill="#38bdf8" fontSize="13" fontWeight="bold">R_ser = {lpadResults.r1.toFixed(2)} Ω</text>

                <circle cx="560" cy="60" r="7" fill="#ef4444" />
                <circle cx="560" cy="180" r="7" fill="currentColor" />
                <line x1="560" y1="60" x2="560" y2="80" stroke="#ef4444" strokeWidth="4" />

                <path d="M 560,80 L 550,90 L 570,100 L 550,110 L 570,120 L 550,130 L 570,140 L 560,150" fill="none" stroke="#38bdf8" strokeWidth="4" />
                <line x1="560" y1="150" x2="560" y2="180" stroke="currentColor" strokeWidth="4" />
                <text x="540" y="125" textAnchor="end" fill="#38bdf8" fontSize="13" fontWeight="bold">R_par = {lpadResults.r2.toFixed(2)} Ω</text>

                <line x1="560" y1="60" x2={tweeterX} y2="60" stroke="#ef4444" strokeWidth="4" />
              </>
            ) : (
              <line x1="245" y1="60" x2={tweeterX} y2="60" stroke="#ef4444" strokeWidth="4" />
            )}
            
            {/* Tweeter Symbol */}
            <rect x={tweeterX} y="32" width="16" height="56" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points={`${tweeterX + 16},32 ${tweeterX + 46},12 ${tweeterX + 46},108 ${tweeterX + 16},88`} fill="none" stroke="currentColor" strokeWidth="4" />
            
            <line x1={tweeterX} y1="88" x2={tweeterX} y2="180" stroke="currentColor" strokeWidth="4" />
            <circle cx={tweeterX} cy="180" r="7" fill="currentColor" />
            <text x={tweeterTextX} y="55" fill="currentColor" fontSize="16" fontWeight="bold">{t("Tweeter")}</text>
            <text x={tweeterTextX} y="78" fill="var(--text-muted)" fontSize="13">{t("High Pass (Vías Altas)")}</text>

            {/* --- RAIL 2: MIDRANGE (BANDPASS) --- */}
            <line x1="110" y1="270" x2="160" y2="270" stroke="#ef4444" strokeWidth="4" />
            
            {/* Midrange Series C */}
            {((bp.c_hp !== undefined && bp.c_hp !== null && bp.c_hp > 0) || (bp.c1_hp !== undefined && bp.c1_hp !== null && bp.c1_hp > 0)) ? (
              <>
                <line x1="160" y1="270" x2="185" y2="270" stroke="#ef4444" strokeWidth="4" />
                <line x1="185" y1="240" x2="185" y2="300" stroke="#ef4444" strokeWidth="6" />
                <line x1="200" y1="240" x2="200" y2="300" stroke="#ef4444" strokeWidth="6" />
                <line x1="200" y1="270" x2="235" y2="270" stroke="#ef4444" strokeWidth="4" />
                <text x="140" y="320" fill="#eab308" fontSize="13" fontWeight="bold">
                  {crossoverType === '4th_lr'
                    ? `C1/C2_HP = ${(bp.c1_hp || 0).toFixed(1)} / ${(bp.c2_hp || 0).toFixed(1)} µF`
                    : `C1 = ${(bp.c_hp || bp.c1_hp || 0).toFixed(2)} µF`}
                </text>
              </>
            ) : (
              <line x1="160" y1="270" x2="235" y2="270" stroke="#ef4444" strokeWidth="4" />
            )}

            {/* Midrange Series L */}
            {((bp.l_lp !== undefined && bp.l_lp !== null && bp.l_lp > 0) || (bp.l1_lp !== undefined && bp.l1_lp !== null && bp.l1_lp > 0)) ? (
              <>
                <path d="M 235,270 Q 247,245 259,270 Q 271,245 283,270 Q 295,245 307,270 Q 319,245 331,270" fill="none" stroke="#ef4444" strokeWidth="4" />
                <text x="235" y="230" fill="#eab308" fontSize="13" fontWeight="bold">
                  {crossoverType === '4th_lr'
                    ? `L1/L2_LP = ${(bp.l1_lp || 0).toFixed(2)} / ${(bp.l2_lp || 0).toFixed(2)} mH`
                    : `L1 = ${(bp.l_lp || bp.l1_lp || 0).toFixed(3)} mH`}
                </text>
              </>
            ) : (
              <line x1="235" y1="270" x2="331" y2="270" stroke="#ef4444" strokeWidth="4" />
            )}
            <line x1="331" y1="270" x2={midrangeX} y2="270" stroke="#ef4444" strokeWidth="4" />

            {/* Midrange Shunts */}
            {(((bp?.l_hp !== null && bp?.l_hp !== undefined && bp?.l_hp > 0) || crossoverType === '4th_lr') && bp) && (
              <>
                <circle cx="380" cy="270" r="7" fill="#ef4444" />
                <line x1="380" y1="270" x2="380" y2="285" stroke="#ef4444" strokeWidth="4" />
                <path d="M 380,285 Q 355,297 380,309 Q 355,321 380,333 Q 355,345 380,350" fill="none" stroke="currentColor" strokeWidth="4" />
                <line x1="380" y1="350" x2="380" y2="390" stroke="currentColor" strokeWidth="4" />
                <circle cx="380" cy="390" r="7" fill="currentColor" />
                <text x="370" y="365" textAnchor="end" fill="#eab308" fontSize="13" fontWeight="bold">
                  {crossoverType === '4th_lr'
                    ? `L1/L2_HP = ${(bp.l1_hp || 0).toFixed(2)} / ${(bp.l2_hp || 0).toFixed(2)} mH`
                    : `L2 = ${(bp.l_hp || 0).toFixed(3)} mH`}
                </text>
              </>
            )}

            {(((bp?.c_lp !== null && bp?.c_lp !== undefined && bp?.c_lp > 0) || crossoverType === '4th_lr') && bp) && (
              <>
                <circle cx="460" cy="270" r="7" fill="#ef4444" />
                <line x1="460" y1="270" x2="460" y2="285" stroke="#ef4444" strokeWidth="4" />
                <line x1="435" y1="285" x2="485" y2="285" stroke="currentColor" strokeWidth="6" />
                <line x1="435" y1="297" x2="485" y2="297" stroke="currentColor" strokeWidth="6" />
                <line x1="460" y1="297" x2="460" y2="390" stroke="currentColor" strokeWidth="4" />
                <circle cx="460" cy="390" r="7" fill="currentColor" />
                <text x="480" y="320" fill="#eab308" fontSize="13" fontWeight="bold">
                  {crossoverType === '4th_lr'
                    ? `C1/C2_LP = ${(bp.c1_lp || 0).toFixed(1)} / ${(bp.c2_lp || 0).toFixed(1)} µF`
                    : `C2 = ${(bp.c_lp || 0).toFixed(2)} µF`}
                </text>
              </>
            )}

            {/* Midrange Symbol */}
            <rect x={midrangeX} y="237" width="16" height="66" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points={`${midrangeX + 16},237 ${midrangeX + 46},215 ${midrangeX + 46},325 ${midrangeX + 16},303`} fill="none" stroke="currentColor" strokeWidth="4" />
            <line x1={midrangeX} y1="303" x2={midrangeX} y2="390" stroke="currentColor" strokeWidth="4" />
            <circle cx={midrangeX} cy="390" r="7" fill="currentColor" />
            <text x={midrangeTextX} y="260" fill="currentColor" fontSize="16" fontWeight="bold">{t("Midrange")}</text>
            <text x={midrangeTextX} y="283" fill="var(--text-muted)" fontSize="13">{t("Band Pass (Medios)")}</text>

            {/* --- RAIL 3: WOOFER (LOW PASS) --- */}
            <line x1="110" y1="480" x2="160" y2="480" stroke="#ef4444" strokeWidth="4" />

            {crossoverType === '4th_lr' ? (
              <>
                <path d="M 160,480 Q 172,455 184,480 Q 196,455 208,480 Q 220,455 232,480 Q 244,455 256,480" fill="none" stroke="#ef4444" strokeWidth="4" />
                <line x1="256" y1="480" x2="290" y2="480" stroke="#ef4444" strokeWidth="4" />
                <text x="140" y="440" fill="var(--success)" fontSize="14" fontWeight="bold">L1 = {lp.l1 ? `${lp.l1.toFixed(3)} mH` : ''}</text>

                {lp.c1 !== null && lp.c1 !== undefined && lp.c1 > 0 ? (
                  <>
                    <circle cx="290" cy="480" r="7" fill="#ef4444" />
                    <line x1="290" y1="480" x2="290" y2="495" stroke="#ef4444" strokeWidth="4" />
                    <line x1="265" y1="495" x2="315" y2="495" stroke="currentColor" strokeWidth="6" />
                    <line x1="265" y1="507" x2="315" y2="507" stroke="currentColor" strokeWidth="6" />
                    <line x1="290" y1="507" x2="290" y2="570" stroke="currentColor" strokeWidth="4" />
                    <circle cx="290" cy="570" r="7" fill="currentColor" />
                    <text x="272" y="530" textAnchor="end" fill="var(--success)" fontSize="14" fontWeight="bold">C1 = {lp.c1.toFixed(2)} µF</text>
                  </>
                ) : null}

                <line x1="290" y1="480" x2="370" y2="480" stroke="#ef4444" strokeWidth="4" />

                {lp.l2 !== null && lp.l2 !== undefined && lp.l2 > 0 ? (
                  <>
                    <path d="M 370,480 Q 382,455 394,480 Q 406,455 418,480 Q 430,455 442,480 Q 454,455 466,480" fill="none" stroke="#ef4444" strokeWidth="4" />
                    <line x1="466" y1="480" x2="500" y2="480" stroke="#ef4444" strokeWidth="4" />
                    <text x="370" y="440" fill="var(--success)" fontSize="14" fontWeight="bold">L2 = {lp.l2.toFixed(3)} mH</text>
                  </>
                ) : (
                  <line x1="290" y1="480" x2="500" y2="480" stroke="#ef4444" strokeWidth="4" />
                )}

                {lp.c2 !== null && lp.c2 !== undefined && lp.c2 > 0 ? (
                  <>
                    <circle cx="500" cy="480" r="7" fill="#ef4444" />
                    <line x1="500" y1="480" x2="500" y2="495" stroke="#ef4444" strokeWidth="4" />
                    <line x1="475" y1="495" x2="525" y2="495" stroke="currentColor" strokeWidth="6" />
                    <line x1="475" y1="507" x2="525" y2="507" stroke="currentColor" strokeWidth="6" />
                    <line x1="500" y1="507" x2="500" y2="570" stroke="currentColor" strokeWidth="4" />
                    <circle cx="500" cy="570" r="7" fill="currentColor" />
                    <text x="482" y="530" textAnchor="end" fill="var(--success)" fontSize="13" fontWeight="bold">C2 = {lp.c2.toFixed(2)} µF</text>
                  </>
                ) : null}

                <line x1="500" y1="480" x2={enableZobel ? 540 : wooferX} y2="480" stroke="#ef4444" strokeWidth="4" />
              </>
            ) : (
              <>
                <path d="M 160,480 Q 172,455 184,480 Q 196,455 208,480 Q 220,455 232,480 Q 244,455 256,480" fill="none" stroke="#ef4444" strokeWidth="4" />
                <line x1="256" y1="480" x2={enableZobel ? 540 : wooferX} y2="480" stroke="#ef4444" strokeWidth="4" />
                <text x="140" y="440" fill="var(--success)" fontSize="15" fontWeight="bold">L1 = {lp.l1 ? `${lp.l1.toFixed(3)} mH` : ''}</text>

                {lp.c1 !== null && lp.c1 !== undefined && lp.c1 > 0 ? (
                  <>
                    <circle cx="340" cy="480" r="7" fill="#ef4444" />
                    <line x1="340" y1="480" x2="340" y2="495" stroke="#ef4444" strokeWidth="4" />
                    <line x1="315" y1="495" x2="365" y2="495" stroke="currentColor" strokeWidth="6" />
                    <line x1="315" y1="507" x2="365" y2="507" stroke="currentColor" strokeWidth="6" />
                    <line x1="340" y1="507" x2="340" y2="570" stroke="currentColor" strokeWidth="4" />
                    <circle cx="340" cy="570" r="7" fill="currentColor" />
                    <text x="322" y="530" textAnchor="end" fill="var(--success)" fontSize="15" fontWeight="bold">C1 = {lp.c1.toFixed(2)} µF</text>
                  </>
                ) : null}
              </>
            )}

            {/* RED ZOBEL EN WOOFER (3 Vías) */}
            {enableZobel && zobelResults ? (
              <>
                <circle cx="540" cy="480" r="7" fill="#ef4444" />
                <circle cx="540" cy="570" r="7" fill="currentColor" />

                <line x1="540" y1="480" x2="540" y2="495" stroke="#ef4444" strokeWidth="4" />
                
                {/* Resistencia Rz */}
                <path d="M 540,495 L 530,501 L 550,507 L 530,513 L 550,519 L 530,525 L 550,531 L 540,535" fill="none" stroke="var(--warning)" strokeWidth="4" />
                <text x="555" y="518" textAnchor="start" fill="var(--warning)" fontSize="13" fontWeight="bold">Rz = {zobelResults.rz.toFixed(2)} Ω</text>

                <line x1="540" y1="535" x2="540" y2="545" stroke="#ef4444" strokeWidth="4" />

                {/* Capacitor Cz */}
                <line x1="520" y1="545" x2="560" y2="545" stroke="currentColor" strokeWidth="6" />
                <line x1="520" y1="557" x2="560" y2="557" stroke="currentColor" strokeWidth="6" />
                <line x1="540" y1="557" x2="540" y2="570" stroke="currentColor" strokeWidth="4" />
                <text x="555" y="555" textAnchor="start" fill="var(--warning)" fontSize="13" fontWeight="bold">Cz = {zobelResults.cz.toFixed(2)} µF</text>

                <line x1="540" y1="480" x2={wooferX} y2="480" stroke="#ef4444" strokeWidth="4" />
              </>
            ) : (
              <line x1={enableZobel ? 540 : 500} y1="480" x2={wooferX} y2="480" stroke="#ef4444" strokeWidth="4" />
            )}

            {/* Woofer Symbol */}
            <rect x={wooferX} y="445" width="16" height="70" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points={`${wooferX + 16},445 ${wooferX + 46},415 ${wooferX + 46},550 ${wooferX + 16},520`} fill="none" stroke="currentColor" strokeWidth="4" />
            
            <line x1={wooferX} y1="515" x2={wooferX} y2="570" stroke="currentColor" strokeWidth="4" />
            <circle cx={wooferX} cy="570" r="7" fill="currentColor" />
            <text x={wooferTextX} y="470" fill="currentColor" fontSize="16" fontWeight="bold">{t("Woofer")}</text>
            <text x={wooferTextX} y="493" fill="var(--text-muted)" fontSize="13">{t("Low Pass (Vías Bajas)")}</text>
          </svg>
          {renderLegend()}
        </div>
      );
    }
  };

  if (readOnly) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', boxSizing: 'border-box' }}>
        {/* Esquema de conexión */}
        <div style={{ width: '100%', marginTop: '0.25rem' }}>
          {renderSchematic()}
        </div>

        {/* Componentes Calculados */}
        {xoverResults && (
          <div className="pro-calc-panel" style={{ marginTop: '0rem' }}>
            <span className="pro-calc-title">
              {t("Componentes del Filtro")} ({crossoverWays === '2way' ? '2 Vías' : '3 Vías'}, {crossoverType === '2nd_lr' ? 'L-R' : crossoverType === '2nd_butter' ? 'Butterworth' : crossoverType === '1st_order' ? '1er Orden' : '4to Orden'})
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.4rem' }}>
              
              {/* --- AGUDOS (TWEETER) --- */}
              <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 'bold', color: 'var(--primary)', display: 'block', marginBottom: '0.2rem' }}>
                  🔊 {t("Vía de Agudos")}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                  {hpFilter && hpFilter.c1 !== null && (
                    <div className="pro-calc-row" style={{ flex: '1 1 45%' }}>
                      <span className="pro-calc-label">C1 (Agudos):</span>
                      <span className="pro-calc-value">{hpFilter.c1.toFixed(2)} µF</span>
                    </div>
                  )}
                  {hpFilter && hpFilter.c2 && (
                    <div className="pro-calc-row" style={{ flex: '1 1 45%' }}>
                      <span className="pro-calc-label">C2 (Agudos):</span>
                      <span className="pro-calc-value">{hpFilter.c2.toFixed(2)} µF</span>
                    </div>
                  )}
                  {hpFilter && hpFilter.l1 !== null && (
                    <div className="pro-calc-row" style={{ flex: '1 1 45%' }}>
                      <span className="pro-calc-label">L1 (Agudos):</span>
                      <span className="pro-calc-value">{hpFilter.l1.toFixed(3)} mH</span>
                    </div>
                  )}
                  {hpFilter && hpFilter.l2 && (
                    <div className="pro-calc-row" style={{ flex: '1 1 45%' }}>
                      <span className="pro-calc-label">L2 (Agudos):</span>
                      <span className="pro-calc-value">{hpFilter.l2.toFixed(3)} mH</span>
                    </div>
                  )}
                </div>
              </div>

              {/* --- MEDIOS (MIDRANGE) --- */}
              {crossoverWays === '3way' && bpFilter && (
                <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 'bold', color: '#eab308', display: 'block', marginBottom: '0.2rem' }}>
                    📣 {t("Vía de Medios (Banda de Paso)")}
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                    {crossoverType === '4th_lr' ? (
                      <>
                        {bpFilter.c1_hp !== undefined && (
                          <div className="pro-calc-row" style={{ flex: '1 1 45%' }}>
                            <span className="pro-calc-label">C1_HP (Medios):</span>
                            <span className="pro-calc-value">{bpFilter.c1_hp.toFixed(2)} µF</span>
                          </div>
                        )}
                        {bpFilter.c2_hp !== undefined && (
                          <div className="pro-calc-row" style={{ flex: '1 1 45%' }}>
                            <span className="pro-calc-label">C2_HP (Medios):</span>
                            <span className="pro-calc-value">{bpFilter.c2_hp.toFixed(2)} µF</span>
                          </div>
                        )}
                        {bpFilter.l1_hp !== undefined && (
                          <div className="pro-calc-row" style={{ flex: '1 1 45%' }}>
                            <span className="pro-calc-label">L1_HP (Medios):</span>
                            <span className="pro-calc-value">{bpFilter.l1_hp.toFixed(3)} mH</span>
                          </div>
                        )}
                        {bpFilter.l2_hp !== undefined && (
                          <div className="pro-calc-row" style={{ flex: '1 1 45%' }}>
                            <span className="pro-calc-label">L2_HP (Medios):</span>
                            <span className="pro-calc-value">{bpFilter.l2_hp.toFixed(3)} mH</span>
                          </div>
                        )}
                        {bpFilter.l1_lp !== undefined && (
                          <div className="pro-calc-row" style={{ flex: '1 1 45%' }}>
                            <span className="pro-calc-label">L1_LP (Medios):</span>
                            <span className="pro-calc-value">{bpFilter.l1_lp.toFixed(3)} mH</span>
                          </div>
                        )}
                        {bpFilter.l2_lp !== undefined && (
                          <div className="pro-calc-row" style={{ flex: '1 1 45%' }}>
                            <span className="pro-calc-label">L2_LP (Medios):</span>
                            <span className="pro-calc-value">{bpFilter.l2_lp.toFixed(3)} mH</span>
                          </div>
                        )}
                        {bpFilter.c1_lp !== undefined && (
                          <div className="pro-calc-row" style={{ flex: '1 1 45%' }}>
                            <span className="pro-calc-label">C1_LP (Medios):</span>
                            <span className="pro-calc-value">{bpFilter.c1_lp.toFixed(2)} µF</span>
                          </div>
                        )}
                        {bpFilter.c2_lp !== undefined && (
                          <div className="pro-calc-row" style={{ flex: '1 1 45%' }}>
                            <span className="pro-calc-label">C2_LP (Medios):</span>
                            <span className="pro-calc-value">{bpFilter.c2_lp.toFixed(2)} µF</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {(bpFilter.c_hp !== undefined || bpFilter.c1_hp !== undefined) && (
                          <div className="pro-calc-row" style={{ flex: '1 1 45%' }}>
                            <span className="pro-calc-label">C_HP (Medios):</span>
                            <span className="pro-calc-value">
                              {(xover3Way!.bp.c_hp || xover3Way!.bp.c1_hp || 0).toFixed(2)} µF
                            </span>
                          </div>
                        )}
                        {(xover3Way!.bp.l_lp !== undefined || xover3Way!.bp.l1_lp !== undefined) && (
                          <div className="pro-calc-row" style={{ flex: '1 1 45%' }}>
                            <span className="pro-calc-label">L_LP (Medios):</span>
                            <span className="pro-calc-value">
                              {(xover3Way!.bp.l_lp || xover3Way!.bp.l1_lp || 0).toFixed(3)} mH
                            </span>
                          </div>
                        )}
                        {xover3Way!.bp.l_hp && (
                          <div className="pro-calc-row" style={{ flex: '1 1 45%' }}>
                            <span className="pro-calc-label">L_HP (Medios):</span>
                            <span className="pro-calc-value">{xover3Way!.bp.l_hp.toFixed(3)} mH</span>
                          </div>
                        )}
                        {xover3Way!.bp.c_lp && (
                          <div className="pro-calc-row" style={{ flex: '1 1 45%' }}>
                            <span className="pro-calc-label">C_LP (Medios):</span>
                            <span className="pro-calc-value">{xover3Way!.bp.c_lp.toFixed(2)} µF</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* --- WOOFER (GRAVES) --- */}
              <div>
                <span style={{ fontSize: '0.74rem', fontWeight: 'bold', color: 'var(--ported-color)', display: 'block', marginBottom: '0.2rem' }}>
                  🔉 {t("Vía de Graves")}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                  {lpFilter && lpFilter.l1 !== null && (
                    <div className="pro-calc-row" style={{ flex: '1 1 45%' }}>
                      <span className="pro-calc-label">L1 (Graves):</span>
                      <span className="pro-calc-value">{lpFilter.l1.toFixed(3)} mH</span>
                    </div>
                  )}
                  {lpFilter && lpFilter.l2 && (
                    <div className="pro-calc-row" style={{ flex: '1 1 45%' }}>
                      <span className="pro-calc-label">L2 (Graves):</span>
                      <span className="pro-calc-value">{lpFilter.l2.toFixed(3)} mH</span>
                    </div>
                  )}
                  {lpFilter && lpFilter.c1 !== null && (
                    <div className="pro-calc-row" style={{ flex: '1 1 45%' }}>
                      <span className="pro-calc-label">C1 (Graves):</span>
                      <span className="pro-calc-value">{lpFilter.c1.toFixed(2)} µF</span>
                    </div>
                  )}
                  {lpFilter && lpFilter.c2 && (
                    <div className="pro-calc-row" style={{ flex: '1 1 45%' }}>
                      <span className="pro-calc-label">C2 (Graves):</span>
                      <span className="pro-calc-value">{lpFilter.c2.toFixed(2)} µF</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Zobel y L-Pad */}
        {(enableZobel || enableLPad) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {enableZobel && zobelResults && (
              <div className="pro-calc-panel" style={{ marginTop: '0rem' }}>
                <span className="pro-calc-title">{t("Red Zobel")}</span>
                <div className="pro-calc-row">
                  <span className="pro-calc-label">Rz:</span>
                  <span className="pro-calc-value">{zobelResults.rz.toFixed(1)} Ω</span>
                </div>
                <div className="pro-calc-row">
                  <span className="pro-calc-label">Cz:</span>
                  <span className="pro-calc-value">{zobelResults.cz.toFixed(2)} µF</span>
                </div>
              </div>
            )}
            {enableLPad && lpadResults && (
              <div className="pro-calc-panel" style={{ marginTop: '0rem' }}>
                <span className="pro-calc-title">{t("Atenuador L-Pad")}</span>
                <div className="pro-calc-row">
                  <span className="pro-calc-label">R_ser:</span>
                  <span className="pro-calc-value">{lpadResults.r1.toFixed(2)} Ω</span>
                </div>
                <div className="pro-calc-row">
                  <span className="pro-calc-label">R_par:</span>
                  <span className="pro-calc-value">{lpadResults.r2.toFixed(2)} Ω</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="tab-content active" id="tab-crossover" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* PANEL DE CALCULOS Y CONFIGURACIONES */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          
          {/* CALCULADORA DE CROSSOVER (Fila 1, Col 1) */}
          <div className="panel" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backdropFilter: 'blur(16px)', boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)', gridRow: 'span 2' }}>
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.75rem' }}>
                <button 
                  className={`preset-select ${crossoverWays === '2way' ? 'active' : ''}`}
                  style={{ flex: 1, padding: '0.4rem 0.8rem', background: crossoverWays === '2way' ? 'var(--primary)' : 'transparent', color: crossoverWays === '2way' ? '#fff' : 'var(--text-main)', border: '1px solid var(--card-border)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => setCrossoverWays('2way')}
                >
                  {t("2 Vías (Woofer + Tweeter)")}
                </button>
                <button 
                  className={`preset-select ${crossoverWays === '3way' ? 'active' : ''}`}
                  style={{ flex: 1, padding: '0.4rem 0.8rem', background: crossoverWays === '3way' ? 'var(--primary)' : 'transparent', color: crossoverWays === '3way' ? '#fff' : 'var(--text-main)', border: '1px solid var(--card-border)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => setCrossoverWays('3way')}
                >
                  {t("3 Vías (Woofer + Mid + Tweet)")}
                </button>
              </div>

              <span className="control-title" style={{ display: 'block', marginBottom: '1rem', color: 'var(--primary)' }}>
                {crossoverWays === '2way' ? t("Calculadora de Crossover pasivo de 2 Vías") : t("Calculadora de Crossover pasivo de 3 Vías")}
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {crossoverWays === '2way' ? (
                  <div className="input-group">
                    <label>{t("Frecuencia de Cruce (Fc)")}</label>
                    <div className="input-wrapper">
                      <input 
                        type="number" 
                        value={fc} 
                        onChange={(e) => setFc(e.target.value === '' ? '' : parseFloat(e.target.value))} 
                        min="20" 
                        max="20000"
                      />
                      <span className="unit-badge">Hz</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                      <label>{t("Cruce Bajo (Woofer-Mid)")}</label>
                      <div className="input-wrapper">
                        <input 
                          type="number" 
                          value={fcLow} 
                          onChange={(e) => setFcLow(e.target.value === '' ? '' : parseFloat(e.target.value))} 
                          min="20" 
                          max="5000"
                        />
                        <span className="unit-badge">Hz</span>
                      </div>
                    </div>
                    <div className="input-group">
                      <label>{t("Cruce Alto (Mid-Tweeter)")}</label>
                      <div className="input-wrapper">
                        <input 
                          type="number" 
                          value={fcHigh} 
                          onChange={(e) => setFcHigh(e.target.value === '' ? '' : parseFloat(e.target.value))} 
                          min="200" 
                          max="20000"
                        />
                        <span className="unit-badge">Hz</span>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: crossoverWays === '2way' ? '1fr 1fr' : '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div className="input-group">
                    <label>{t("Imp. Tweeter")}</label>
                    <div className="input-wrapper">
                      <input 
                        type="number" 
                        value={zTweeter} 
                        onChange={(e) => setZTweeter(parseFloat(e.target.value) || 0)} 
                        min="2" 
                        max="32"
                      />
                      <span className="unit-badge">Ω</span>
                    </div>
                  </div>
                  {crossoverWays === '3way' && (
                    <div className="input-group">
                      <label>{t("Imp. Midrange")}</label>
                      <div className="input-wrapper">
                        <input 
                          type="number" 
                          value={zMidrange} 
                          onChange={(e) => setZMidrange(parseFloat(e.target.value) || 0)} 
                          min="2" 
                          max="32"
                        />
                        <span className="unit-badge">Ω</span>
                      </div>
                    </div>
                  )}
                  <div className="input-group">
                    <label>{t("Imp. Woofer")}</label>
                    <div className="input-wrapper">
                      <input 
                        type="number" 
                        value={zWoofer} 
                        onChange={(e) => setZWoofer(parseFloat(e.target.value) || 0)} 
                        min="2" 
                        max="32"
                      />
                      <span className="unit-badge">Ω</span>
                    </div>
                  </div>
                </div>

                <div className="input-group">
                  <label>{t("Tipo y Pendiente del Filtro")}</label>
                  <select 
                    value={crossoverType} 
                    onChange={(e) => setCrossoverType(e.target.value as '1st_order' | '2nd_butter' | '2nd_lr' | '4th_lr')} 
                    className="input-select"
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="1st_order">{t("1.º Orden - 6 dB/oct (Sencillo)")}</option>
                    <option value="2nd_butter">{t("2.º Orden Butterworth - 12 dB/oct")}</option>
                    <option value="2nd_lr">{t("2.º Orden Linkwitz-Riley - 12 dB/oct")}</option>
                    <option value="4th_lr">{t("4.º Orden Linkwitz-Riley - 24 dB/oct (Premium)")}</option>
                  </select>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '1rem', lineHeight: '1.4' }}>
              {t("* Nota: Los filtros de segundo orden (12 dB/oct) generalmente requieren invertir la polaridad del Tweeter (conectar + a -) para evitar cancelaciones en el punto de cruce.")}
            </p>
          </div>



          {/* RED ZOBEL (Fila 2, Col 1) */}
          <div className="panel" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backdropFilter: 'blur(16px)', boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <span className="control-title" style={{ color: 'var(--warning)', margin: 0 }}>
                  {t("Red Zobel (Compensación de Impedancia)")}
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  <input 
                    type="checkbox" 
                    checked={enableZobel} 
                    onChange={(e) => setEnableZobel(e.target.checked)} 
                    style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
                  />
                  <span>{t("Implementar")}</span>
                </label>
              </div>

              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: '0 0 0.85rem 0' }}>
                {t("La red Zobel compensa el aumento de la impedancia del altavoz provocado por la inductancia de la bobina de voz (Le) a altas frecuencias. Al aplanar la impedancia, permite que el filtro crossover funcione según la frecuencia de diseño.")}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
                <div className="input-group">
                  <label>Re (Resistencia DC)</label>
                  <div className="input-wrapper">
                    <input 
                      type="number" 
                      value={re} 
                      onChange={(e) => setRe(parseFloat(e.target.value) || 0)} 
                      step="any"
                    />
                    <span className="unit-badge">Ω</span>
                  </div>
                </div>
                <div className="input-group">
                  <label>Le (Inductancia Bobina)</label>
                  <div className="input-wrapper">
                    <input 
                      type="number" 
                      value={le} 
                      onChange={(e) => setLe(parseFloat(e.target.value) || 0)} 
                      step="any"
                    />
                    <span className="unit-badge">mH</span>
                  </div>
                </div>
              </div>
            </div>

            {zobelResults ? (
              <div style={{ background: 'rgba(245, 158, 11, 0.03)', border: '1px solid rgba(245, 158, 11, 0.15)', padding: '1rem', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-around' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Resistencia (Rz):</span>{' '}
                  <strong style={{ color: 'var(--text-main)' }}>{zobelResults.rz.toFixed(2)} Ω</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Capacitor (Cz):</span>{' '}
                  <strong style={{ color: 'var(--text-main)' }}>{zobelResults.cz.toFixed(2)} µF</strong>
                </div>
              </div>
            ) : null}
          </div>

          {/* ATENUADOR L-PAD (Fila 2, Col 2) */}
          <div className="panel" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backdropFilter: 'blur(16px)', boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <span className="control-title" style={{ color: '#38bdf8', margin: 0 }}>
                  {t("Atenuador L-Pad (Balance de Tweeter)")}
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  <input 
                    type="checkbox" 
                    checked={enableLPad} 
                    onChange={(e) => setEnableLPad(e.target.checked)} 
                    style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
                  />
                  <span>{t("Implementar")}</span>
                </label>
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '0.85rem', lineHeight: '1.3' }}>
                {t("Compensa la diferencia de sensibilidad (dB) entre el altavoz de agudos y el resto de vías, manteniendo constante la impedancia total vista por el filtro.")}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1rem', marginBottom: '0.85rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t("Atenuación Deseada")}</label>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t("Impedancia Carga (Speaker)")}</label>
                
                <div className="input-wrapper">
                  <input 
                    type="number" 
                    value={attenuation} 
                    onChange={(e) => setAttenuation(parseFloat(e.target.value) || 0)} 
                    min="1" 
                    max="40"
                  />
                  <span className="unit-badge">dB</span>
                </div>
                
                <div className="input-wrapper">
                  <input 
                    type="number" 
                    value={zLoad} 
                    onChange={(e) => setZLoad(parseFloat(e.target.value) || 0)} 
                    min="2" 
                    max="32"
                  />
                  <span className="unit-badge">Ω</span>
                </div>
              </div>
            </div>

            {lpadResults ? (
              <div style={{ background: 'rgba(56, 189, 248, 0.03)', border: '1px solid rgba(56, 189, 248, 0.15)', padding: '1rem', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-around' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>R_ser ({t("Serie")}):</span>{' '}
                  <strong style={{ color: 'var(--text-main)' }}>{lpadResults.r1.toFixed(2)} Ω</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>R_par ({t("Paralelo")}):</span>{' '}
                  <strong style={{ color: 'var(--text-main)' }}>{lpadResults.r2.toFixed(2)} Ω</strong>
                </div>
              </div>
            ) : null}
          </div>

        </div>

        {/* DIAGRAMA DE ANCHO COMPLETO DEBAJO */}
        <div style={{ width: '100%' }}>
          {renderSchematic()}
        </div>

        {/* COMPONENTES DEL FILTRO DEBAJO DEL DIAGRAMA */}
        <div className="panel" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', backdropFilter: 'blur(16px)', boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)', marginTop: '0rem' }}>
          <span className="control-title" style={{ display: 'block', marginBottom: '1rem', color: 'var(--success)', fontSize: '1rem', fontWeight: 600 }}>
            {t("Componentes del Filtro")} ({t(crossoverType)})
          </span>

          {xoverResults ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                
                {/* TWEETER FILTRO */}
                <div style={{ background: 'rgba(10, 15, 30, 0.45)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--primary)', display: 'block', marginBottom: '0.5rem' }}>
                    🔊 {t("Paso Alto (Tweeter)")}
                  </strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                    {xoverResults.hp.c1 !== null && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>C1 ({t("Serie")}):</span>{' '}
                        <strong style={{ color: 'var(--text-main)' }}>{xoverResults.hp.c1.toFixed(2)} µF</strong>
                      </div>
                    )}
                    {xoverResults.hp.c2 && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>C2 ({t("Serie")}):</span>{' '}
                        <strong style={{ color: 'var(--text-main)' }}>{xoverResults.hp.c2.toFixed(2)} µF</strong>
                      </div>
                    )}
                    {xoverResults.hp.l1 !== null && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>L1 ({t("Paralelo")}):</span>{' '}
                        <strong style={{ color: 'var(--text-main)' }}>{xoverResults.hp.l1.toFixed(3)} mH</strong>
                      </div>
                    )}
                    {xoverResults.hp.l2 && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>L2 ({t("Paralelo")}):</span>{' '}
                        <strong style={{ color: 'var(--text-main)' }}>{xoverResults.hp.l2.toFixed(3)} mH</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* MIDRANGE FILTRO (Condicional para 3 vías) */}
                {crossoverWays === '3way' && bpFilter && (
                  <div style={{ background: 'rgba(10, 15, 30, 0.45)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                    <strong style={{ fontSize: '0.85rem', color: '#eab308', display: 'block', marginBottom: '0.5rem' }}>
                      📣 {t("Banda de Paso (Mid)")}
                    </strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                      {crossoverType === '4th_lr' ? (
                        <>
                          {/* Sección Paso Alto (HP) del Bandpass */}
                          <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', paddingBottom: '0.3rem', marginBottom: '0.3rem' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>{t("Sección Paso Alto (Filtro fL)")}:</span>
                            {bpFilter.c1_hp !== undefined && (
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>C1_HP ({t("Serie")}):</span>{' '}
                                <strong style={{ color: 'var(--text-main)' }}>{bpFilter.c1_hp.toFixed(2)} µF</strong>
                              </div>
                            )}
                            {bpFilter.c2_hp !== undefined && (
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>C2_HP ({t("Serie")}):</span>{' '}
                                <strong style={{ color: 'var(--text-main)' }}>{bpFilter.c2_hp.toFixed(2)} µF</strong>
                              </div>
                            )}
                            {bpFilter.l1_hp !== undefined && (
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>L1_HP ({t("Paralelo")}):</span>{' '}
                                <strong style={{ color: 'var(--text-main)' }}>{bpFilter.l1_hp.toFixed(3)} mH</strong>
                              </div>
                            )}
                            {bpFilter.l2_hp !== undefined && (
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>L2_HP ({t("Paralelo")}):</span>{' '}
                                <strong style={{ color: 'var(--text-main)' }}>{bpFilter.l2_hp.toFixed(3)} mH</strong>
                              </div>
                            )}
                          </div>
                          
                          {/* Sección Paso Bajo (LP) del Bandpass */}
                          <div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>{t("Sección Paso Bajo (Filtro fH)")}:</span>
                            {bpFilter.l1_lp !== undefined && (
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>L1_LP ({t("Serie")}):</span>{' '}
                                <strong style={{ color: 'var(--text-main)' }}>{bpFilter.l1_lp.toFixed(3)} mH</strong>
                              </div>
                            )}
                            {bpFilter.l2_lp !== undefined && (
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>L2_LP ({t("Serie")}):</span>{' '}
                                <strong style={{ color: 'var(--text-main)' }}>{bpFilter.l2_lp.toFixed(3)} mH</strong>
                              </div>
                            )}
                            {bpFilter.c1_lp !== undefined && (
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>C1_LP ({t("Paralelo")}):</span>{' '}
                                <strong style={{ color: 'var(--text-main)' }}>{bpFilter.c1_lp.toFixed(2)} µF</strong>
                              </div>
                            )}
                            {bpFilter.c2_lp !== undefined && (
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>C2_LP ({t("Paralelo")}):</span>{' '}
                                <strong style={{ color: 'var(--text-main)' }}>{bpFilter.c2_lp.toFixed(2)} µF</strong>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Componentes para 1er y 2do Orden */}
                          {(bpFilter.c_hp !== undefined || bpFilter.c1_hp !== undefined) && (
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>C_HP ({t("Serie")}):</span>{' '}
                              <strong style={{ color: 'var(--text-main)' }}>
                                {((bpFilter.c_hp || bpFilter.c1_hp) as number).toFixed(2)} µF
                              </strong>
                            </div>
                          )}
                          {(bpFilter.l_lp !== undefined || bpFilter.l1_lp !== undefined) && (
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>L_LP ({t("Serie")}):</span>{' '}
                              <strong style={{ color: 'var(--text-main)' }}>
                                {((bpFilter.l_lp || bpFilter.l1_lp) as number).toFixed(3)} mH
                              </strong>
                            </div>
                          )}
                          {bpFilter.l_hp !== undefined && bpFilter.l_hp !== null && (
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>L_HP ({t("Paralelo")}):</span>{' '}
                              <strong style={{ color: 'var(--text-main)' }}>{bpFilter.l_hp.toFixed(3)} mH</strong>
                            </div>
                          )}
                          {bpFilter.c_lp !== undefined && bpFilter.c_lp !== null && (
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>C_LP ({t("Paralelo")}):</span>{' '}
                              <strong style={{ color: 'var(--text-main)' }}>{bpFilter.c_lp.toFixed(2)} µF</strong>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* WOOFER FILTRO */}
                <div style={{ background: 'rgba(10, 15, 30, 0.45)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--ported-color)', display: 'block', marginBottom: '0.5rem' }}>
                    🔉 {t("Paso Bajo (Woofer)")}
                  </strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                    {xoverResults.lp.l1 !== null && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>L1 ({t("Serie")}):</span>{' '}
                        <strong style={{ color: 'var(--text-main)' }}>{xoverResults.lp.l1.toFixed(3)} mH</strong>
                      </div>
                    )}
                    {xoverResults.lp.l2 && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>L2 ({t("Serie")}):</span>{' '}
                        <strong style={{ color: 'var(--text-main)' }}>{xoverResults.lp.l2.toFixed(3)} mH</strong>
                      </div>
                    )}
                    {xoverResults.lp.c1 !== null && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>C1 ({t("Paralelo")}):</span>{' '}
                        <strong style={{ color: 'var(--text-main)' }}>{xoverResults.lp.c1.toFixed(2)} µF</strong>
                      </div>
                    )}
                    {xoverResults.lp.c2 && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>C2 ({t("Paralelo")}):</span>{' '}
                        <strong style={{ color: 'var(--text-main)' }}>{xoverResults.lp.c2.toFixed(2)} µF</strong>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t("Completa los valores del crossover.")}</p>
          )}
        </div>

      </div>
    </div>
  );
};

export const CrossoverTab = React.memo(CrossoverTabComponent);

