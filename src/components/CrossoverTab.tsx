import React, { useState, useEffect } from 'react';
import { type Lang, translate } from '../utils/translations';
import { getWasm, optimizeCrossoverLowpass } from '../wasm/index';
import type { CrossoverResult, CrossoverExportData } from '../types';
import { CrossoverCad2D } from './CrossoverCad2D';

interface CrossoverTabProps {
  theme?: 'dark' | 'light';
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
  theme = 'dark',
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

  // Active theme detection
  const [effectiveTheme, setEffectiveTheme] = useState<'dark' | 'light'>(theme);

  useEffect(() => {
    setEffectiveTheme(theme);
  }, [theme]);

  useEffect(() => {
    const checkDomTheme = () => {
      const domTheme = document.documentElement.getAttribute('data-theme') as 'dark' | 'light' | null;
      if (domTheme) setEffectiveTheme(domTheme);
    };
    checkDomTheme();

    const observer = new MutationObserver(checkDomTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

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

  // 5. Inductor Calculator Inputs (Wheeler)
  const [indCalcTargetL, setIndCalcTargetL] = useState<number | ''>(1.0);
  const [indCalcD, setIndCalcD] = useState<number | ''>(20.0);
  const [indCalcLen, setIndCalcLen] = useState<number | ''>(2.0);
  const [indCalcN, setIndCalcN] = useState<number | null>(null);

  useEffect(() => {
    if (indCalcTargetL && indCalcD && indCalcLen) {
      try {
        const wasm = getWasm();
        const n = wasm.calc_vueltas_inductor_wheeler(Number(indCalcTargetL), Number(indCalcD), Number(indCalcLen));
        setIndCalcN(n > 0 ? n : null);
      } catch (e) {
        console.error("Error calculating inductor turns:", e);
        setIndCalcN(null);
      }
    } else {
      setIndCalcN(null);
    }
  }, [indCalcTargetL, indCalcD, indCalcLen]);

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

  // 6. Nelder-Mead Optimization Inputs (Rust MNA Engine)
  const [optFc, setOptFc] = useState<number>(typeof fc === 'number' && fc > 0 ? fc : 2500);
  const [optRe, setOptRe] = useState<number>(re > 0 ? re : (zWoofer > 0 ? zWoofer * 0.8 : 6.0));
  const [optLe, setOptLe] = useState<number>(le > 0 ? le : 0.8);
  const [optimizerDcr, setOptimizerDcr] = useState<number>(0.3);
  const [optimizerResult, setOptimizerResult] = useState<{
    lOptMh: number;
    cOptUf: number;
    rmsErrorDb: number;
    iterations: number;
  } | null>(null);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);

  useEffect(() => {
    if (typeof fc === 'number' && fc > 0) setOptFc(fc);
  }, [fc]);

  useEffect(() => {
    if (re > 0) setOptRe(re);
    else if (zWoofer > 0) setOptRe(zWoofer * 0.8);
  }, [re, zWoofer]);

  useEffect(() => {
    if (le > 0) setOptLe(le);
  }, [le]);

  const handleOptimizeLowpass = () => {
    setIsOptimizing(true);
    try {
      const targetFrequency = optFc > 0 ? optFc : 2500;
      const wooferRe = optRe > 0 ? optRe : 6.0;
      const wooferLe = optLe > 0 ? optLe : 0.8;
      const res = optimizeCrossoverLowpass(targetFrequency, wooferRe, wooferLe, optimizerDcr || 0.3);
      setOptimizerResult(res);
    } catch (e) {
      console.error("Nelder-Mead optimization error:", e);
    } finally {
      setIsOptimizing(false);
    }
  };

  const renderNelderMeadOptimizer = (isCompact: boolean = false) => (
    <div 
      className="panel" 
      style={{ 
        background: 'var(--card-bg)', 
        border: '1px solid var(--card-border)', 
        padding: isCompact ? '0.75rem 0.9rem' : '1rem 1.25rem', 
        borderRadius: '0px', 
        display: 'flex', 
        flexDirection: 'column', 
        backdropFilter: 'blur(16px)', 
        boxShadow: 'none',
        marginBottom: '0.5rem'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.4rem' }}>
        <span className="control-title" style={{ color: 'var(--text-main)', margin: 0, fontSize: isCompact ? '0.82rem' : '0.9rem', fontWeight: 600 }}>
          {t("Auto-Optimización de Crossover (Solver MNA)")}
        </span>
        <span style={{ fontSize: '0.64rem', border: '1px solid var(--card-border)', background: 'rgba(255, 255, 255, 0.03)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: '0px', fontWeight: 500, letterSpacing: '0.3px' }}>
          NELDER-MEAD SIMPLEX / RUST
        </span>
      </div>

      <p style={{ fontSize: isCompact ? '0.7rem' : '0.74rem', color: 'var(--text-muted)', marginBottom: '0.6rem', lineHeight: '1.35', margin: '0 0 0.6rem 0' }}>
        {t("Calcula los valores óptimos de L y C resolviendo la matriz nodal compleja MNA para compensar la inductancia Le del woofer y minimizar el error RMS.")}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: '0.5rem', alignItems: 'end', marginBottom: '0.65rem' }}>
        <div className="input-group" style={{ margin: 0 }}>
          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t("Fc Objetivo")}</label>
          <div className="input-wrapper" style={{ height: '28px' }}>
            <input 
              type="number" 
              value={optFc} 
              onChange={(e) => setOptFc(parseFloat(e.target.value) || 2500)} 
              min="50" 
              max="10000"
              style={{ fontSize: '0.74rem', height: '28px', padding: '0 6px', fontFamily: 'var(--font-mono)' }}
            />
            <span className="unit-badge" style={{ fontSize: '0.65rem', padding: '0 4px' }}>Hz</span>
          </div>
        </div>

        <div className="input-group" style={{ margin: 0 }}>
          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t("Re Woofer")}</label>
          <div className="input-wrapper" style={{ height: '28px' }}>
            <input 
              type="number" 
              value={optRe} 
              onChange={(e) => setOptRe(parseFloat(e.target.value) || 6.0)} 
              step="0.1"
              min="1"
              style={{ fontSize: '0.74rem', height: '28px', padding: '0 6px', fontFamily: 'var(--font-mono)' }}
            />
            <span className="unit-badge" style={{ fontSize: '0.65rem', padding: '0 4px' }}>Ω</span>
          </div>
        </div>

        <div className="input-group" style={{ margin: 0 }}>
          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t("Le Woofer")}</label>
          <div className="input-wrapper" style={{ height: '28px' }}>
            <input 
              type="number" 
              value={optLe} 
              onChange={(e) => setOptLe(parseFloat(e.target.value) || 0.8)} 
              step="0.05"
              min="0.01"
              style={{ fontSize: '0.74rem', height: '28px', padding: '0 6px', fontFamily: 'var(--font-mono)' }}
            />
            <span className="unit-badge" style={{ fontSize: '0.65rem', padding: '0 4px' }}>mH</span>
          </div>
        </div>

        <div className="input-group" style={{ margin: 0 }}>
          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t("DCR Bobina")}</label>
          <div className="input-wrapper" style={{ height: '28px' }}>
            <input 
              type="number" 
              value={optimizerDcr} 
              onChange={(e) => setOptimizerDcr(parseFloat(e.target.value) || 0.3)} 
              step="0.05"
              min="0"
              style={{ fontSize: '0.74rem', height: '28px', padding: '0 6px', fontFamily: 'var(--font-mono)' }}
            />
            <span className="unit-badge" style={{ fontSize: '0.65rem', padding: '0 4px' }}>Ω</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOptimizeLowpass}
          disabled={isOptimizing}
          style={{
            background: 'var(--primary)',
            color: '#090d16',
            border: '1px solid var(--primary)',
            height: '28px',
            padding: '0 0.85rem',
            borderRadius: '0px',
            fontWeight: 600,
            fontSize: '0.72rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'none',
            transition: 'background 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          {isOptimizing ? t("Optimizando...") : t("Optimizar Simplex")}
        </button>
      </div>

      {optimizerResult && (
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--card-border)', padding: '0.55rem 0.8rem', borderRadius: '0px', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t("L Óptimo")}</span>
              <strong style={{ color: 'var(--text-main)', fontSize: '0.92rem', fontFamily: 'var(--font-mono)' }}>{optimizerResult.lOptMh.toFixed(3)} mH</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t("C Óptimo")}</span>
              <strong style={{ color: 'var(--text-main)', fontSize: '0.92rem', fontFamily: 'var(--font-mono)' }}>{optimizerResult.cOptUf.toFixed(2)} µF</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t("Error RMS")}</span>
              <strong style={{ color: optimizerResult.rmsErrorDb < 4 ? 'var(--success)' : 'var(--warning)', fontSize: '0.92rem', fontFamily: 'var(--font-mono)' }}>{optimizerResult.rmsErrorDb.toFixed(2)} dB</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t("Iteraciones")}</span>
              <strong style={{ color: 'var(--text-muted)', fontSize: '0.92rem', fontFamily: 'var(--font-mono)' }}>{optimizerResult.iterations}</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIndCalcTargetL(Number(optimizerResult.lOptMh.toFixed(2)))}
            style={{
              background: 'transparent',
              border: '1px solid var(--card-border)',
              color: 'var(--text-secondary)',
              padding: '3px 8px',
              borderRadius: '0px',
              fontSize: '0.68rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'border-color 0.15s ease, color 0.15s ease'
            }}
            title={t("Copiar valor a calculadora de inductores de Wheeler")}
          >
            {t("Transferir a Wheeler")}
          </button>
        </div>
      )}
    </div>
  );

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
          const hpRes = wasm.calc_filtro_4to_orden_lr(f, Rt);
          const lpRes = wasm.calc_filtro_4to_orden_lr(f, Rw);
          const out = {
            ways: '2way' as const,
            type: '4th_lr',
            hp: { c1: hpRes.c1, l1: hpRes.l1, c2: hpRes.c2, l2: hpRes.l2 },
            lp: { l1: lpRes.l1, c1: lpRes.c1, l2: lpRes.l2, c2: lpRes.c2 }
          };
          hpRes.free();
          lpRes.free();
          return out;
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
      // 3-way Crossover Calculations (via Rust WASM)
      const fL = fcLow;
      const fH = fcHigh;
      if (!fL || !fH || fL <= 0 || fH <= 0 || fL >= fH || Rt <= 0 || Rm <= 0 || Rw <= 0) return null;

      try {
        const wasm = getWasm();
        if (crossoverType === '1st_order') {
          const tRes = wasm.calc_filtro_1er_orden(fH, Rt);
          const mHpRes = wasm.calc_filtro_1er_orden(fL, Rm);
          const mLpRes = wasm.calc_filtro_1er_orden(fH, Rm);
          const wRes = wasm.calc_filtro_1er_orden(fL, Rw);
          const out: CrossoverResult = {
            ways: '3way' as const,
            type: '1st',
            hp: { c1: tRes.c, l1: null },
            bp: { c_hp: mHpRes.c, l_hp: null, l_lp: mLpRes.l, c_lp: null },
            lp: { l1: wRes.l, c1: null }
          };
          tRes.free(); mHpRes.free(); mLpRes.free(); wRes.free();
          return out;
        }
        if (crossoverType === '2nd_butter') {
          const tRes = wasm.calc_filtro_2do_orden_butterworth(fH, Rt);
          const mHpRes = wasm.calc_filtro_2do_orden_butterworth(fL, Rm);
          const mLpRes = wasm.calc_filtro_2do_orden_butterworth(fH, Rm);
          const wRes = wasm.calc_filtro_2do_orden_butterworth(fL, Rw);
          const out: CrossoverResult = {
            ways: '3way' as const,
            type: '2nd_butter',
            hp: { c1: tRes.c_hp, l1: tRes.l_hp },
            bp: { c_hp: mHpRes.c_hp, l_hp: mHpRes.l_hp, l_lp: mLpRes.l_lp, c_lp: mLpRes.c_lp },
            lp: { l1: wRes.l_lp, c1: wRes.c_lp }
          };
          tRes.free(); mHpRes.free(); mLpRes.free(); wRes.free();
          return out;
        }
        if (crossoverType === '2nd_lr') {
          const tRes = wasm.calc_filtro_linkwitz_riley(fH, Rt);
          const mHpRes = wasm.calc_filtro_linkwitz_riley(fL, Rm);
          const mLpRes = wasm.calc_filtro_linkwitz_riley(fH, Rm);
          const wRes = wasm.calc_filtro_linkwitz_riley(fL, Rw);
          const out: CrossoverResult = {
            ways: '3way' as const,
            type: '2nd_lr',
            hp: { c1: tRes.c, l1: tRes.l },
            bp: { c_hp: mHpRes.c, l_hp: mHpRes.l, l_lp: mLpRes.l, c_lp: mLpRes.c },
            lp: { l1: wRes.l, c1: wRes.c }
          };
          tRes.free(); mHpRes.free(); mLpRes.free(); wRes.free();
          return out;
        }
        if (crossoverType === '4th_lr') {
          const tRes = wasm.calc_filtro_4to_orden_lr(fH, Rt);
          const mHpRes = wasm.calc_filtro_4to_orden_lr(fL, Rm);
          const mLpRes = wasm.calc_filtro_4to_orden_lr(fH, Rm);
          const wRes = wasm.calc_filtro_4to_orden_lr(fL, Rw);
          const out: CrossoverResult = {
            ways: '3way' as const,
            type: '4th_lr',
            hp: { c1: tRes.c1, l1: tRes.l1, c2: tRes.c2, l2: tRes.l2 },
            bp: {
              c1_hp: mHpRes.c1, c2_hp: mHpRes.c2, l1_hp: mHpRes.l1, l2_hp: mHpRes.l2,
              c1_lp: mLpRes.c1, c2_lp: mLpRes.c2, l1_lp: mLpRes.l1, l2_lp: mLpRes.l2
            },
            lp: { l1: wRes.l1, c1: wRes.c1, l2: wRes.l2, c2: wRes.c2 }
          };
          tRes.free(); mHpRes.free(); mLpRes.free(); wRes.free();
          return out;
        }
      } catch (e) {
        console.error("WASM 3-way crossover error, falling back to JS:", e);
      }
      
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

  const renderComponentsTable = () => {
    if (!xoverResults) return null;
    return (
      <div style={{ overflowX: 'auto' }}>
              <table className="wood-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>{t("Vía / Sección")}</th>
                    <th>{t("Componente")}</th>
                    <th>{t("Tipo de Conexión")}</th>
                    <th>{t("Valor")}</th>
                  </tr>
                </thead>
                <tbody>
                  {/* TWEETER */}
                  {hpFilter?.c1 !== null && hpFilter?.c1 !== undefined && (
                    <tr>
                      <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{t("Paso Alto (Tweeter)")}</td>
                      <td><strong>C1</strong></td>
                      <td>{t("Serie")}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{hpFilter.c1.toFixed(2)} µF</td>
                    </tr>
                  )}
                  {hpFilter?.c2 && (
                    <tr>
                      <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{t("Paso Alto (Tweeter)")}</td>
                      <td><strong>C2</strong></td>
                      <td>{t("Serie")}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{hpFilter.c2.toFixed(2)} µF</td>
                    </tr>
                  )}
                  {hpFilter?.l1 !== null && hpFilter?.l1 !== undefined && (
                    <tr>
                      <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{t("Paso Alto (Tweeter)")}</td>
                      <td><strong>L1</strong></td>
                      <td>{t("Paralelo")}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{hpFilter.l1.toFixed(3)} mH</td>
                    </tr>
                  )}
                  {hpFilter?.l2 && (
                    <tr>
                      <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{t("Paso Alto (Tweeter)")}</td>
                      <td><strong>L2</strong></td>
                      <td>{t("Paralelo")}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{hpFilter.l2.toFixed(3)} mH</td>
                    </tr>
                  )}

                  {/* MIDRANGE */}
                  {crossoverWays === '3way' && bpFilter && (
                    crossoverType === '4th_lr' ? (
                      <>
                        {bpFilter.c1_hp !== undefined && (
                          <tr>
                            <td style={{ color: '#eab308', fontWeight: 600 }}>{t("Banda de Paso (Mid)")}</td>
                            <td><strong>C1_HP</strong></td>
                            <td>{t("Serie")} ({t("Sección Paso Alto")})</td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{bpFilter.c1_hp.toFixed(2)} µF</td>
                          </tr>
                        )}
                        {bpFilter.c2_hp !== undefined && (
                          <tr>
                            <td style={{ color: '#eab308', fontWeight: 600 }}>{t("Banda de Paso (Mid)")}</td>
                            <td><strong>C2_HP</strong></td>
                            <td>{t("Serie")} ({t("Sección Paso Alto")})</td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{bpFilter.c2_hp.toFixed(2)} µF</td>
                          </tr>
                        )}
                        {bpFilter.l1_hp !== undefined && (
                          <tr>
                            <td style={{ color: '#eab308', fontWeight: 600 }}>{t("Banda de Paso (Mid)")}</td>
                            <td><strong>L1_HP</strong></td>
                            <td>{t("Paralelo")} ({t("Sección Paso Alto")})</td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{bpFilter.l1_hp.toFixed(3)} mH</td>
                          </tr>
                        )}
                        {bpFilter.l2_hp !== undefined && (
                          <tr>
                            <td style={{ color: '#eab308', fontWeight: 600 }}>{t("Banda de Paso (Mid)")}</td>
                            <td><strong>L2_HP</strong></td>
                            <td>{t("Paralelo")} ({t("Sección Paso Alto")})</td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{bpFilter.l2_hp.toFixed(3)} mH</td>
                          </tr>
                        )}
                        {bpFilter.l1_lp !== undefined && (
                          <tr>
                            <td style={{ color: '#eab308', fontWeight: 600 }}>{t("Banda de Paso (Mid)")}</td>
                            <td><strong>L1_LP</strong></td>
                            <td>{t("Serie")} ({t("Sección Paso Bajo")})</td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{bpFilter.l1_lp.toFixed(3)} mH</td>
                          </tr>
                        )}
                        {bpFilter.l2_lp !== undefined && (
                          <tr>
                            <td style={{ color: '#eab308', fontWeight: 600 }}>{t("Banda de Paso (Mid)")}</td>
                            <td><strong>L2_LP</strong></td>
                            <td>{t("Serie")} ({t("Sección Paso Bajo")})</td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{bpFilter.l2_lp.toFixed(3)} mH</td>
                          </tr>
                        )}
                        {bpFilter.c1_lp !== undefined && (
                          <tr>
                            <td style={{ color: '#eab308', fontWeight: 600 }}>{t("Banda de Paso (Mid)")}</td>
                            <td><strong>C1_LP</strong></td>
                            <td>{t("Paralelo")} ({t("Sección Paso Bajo")})</td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{bpFilter.c1_lp.toFixed(2)} µF</td>
                          </tr>
                        )}
                        {bpFilter.c2_lp !== undefined && (
                          <tr>
                            <td style={{ color: '#eab308', fontWeight: 600 }}>{t("Banda de Paso (Mid)")}</td>
                            <td><strong>C2_LP</strong></td>
                            <td>{t("Paralelo")} ({t("Sección Paso Bajo")})</td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{bpFilter.c2_lp.toFixed(2)} µF</td>
                          </tr>
                        )}
                      </>
                    ) : (
                      <>
                        {(bpFilter.c_hp !== undefined || bpFilter.c1_hp !== undefined) && (
                          <tr>
                            <td style={{ color: '#eab308', fontWeight: 600 }}>{t("Banda de Paso (Mid)")}</td>
                            <td><strong>C_HP / C1</strong></td>
                            <td>{t("Serie")} ({t("Paso Alto")})</td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                              {((bpFilter.c_hp || bpFilter.c1_hp) as number).toFixed(2)} µF
                            </td>
                          </tr>
                        )}
                        {(bpFilter.l_lp !== undefined || bpFilter.l1_lp !== undefined) && (
                          <tr>
                            <td style={{ color: '#eab308', fontWeight: 600 }}>{t("Banda de Paso (Mid)")}</td>
                            <td><strong>L_LP / L1</strong></td>
                            <td>{t("Serie")} ({t("Paso Bajo")})</td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                              {((bpFilter.l_lp || bpFilter.l1_lp) as number).toFixed(3)} mH
                            </td>
                          </tr>
                        )}
                        {bpFilter.l_hp !== undefined && bpFilter.l_hp !== null && (
                          <tr>
                            <td style={{ color: '#eab308', fontWeight: 600 }}>{t("Banda de Paso (Mid)")}</td>
                            <td><strong>L_HP / L2</strong></td>
                            <td>{t("Paralelo")} ({t("Paso Alto")})</td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{bpFilter.l_hp.toFixed(3)} mH</td>
                          </tr>
                        )}
                        {bpFilter.c_lp !== undefined && bpFilter.c_lp !== null && (
                          <tr>
                            <td style={{ color: '#eab308', fontWeight: 600 }}>{t("Banda de Paso (Mid)")}</td>
                            <td><strong>C_LP / C2</strong></td>
                            <td>{t("Paralelo")} ({t("Paso Bajo")})</td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{bpFilter.c_lp.toFixed(2)} µF</td>
                          </tr>
                        )}
                      </>
                    )
                  )}

                  {/* WOOFER */}
                  {lpFilter?.l1 !== null && lpFilter?.l1 !== undefined && (
                    <tr>
                      <td style={{ color: 'var(--ported-color)', fontWeight: 600 }}>{t("Paso Bajo (Woofer)")}</td>
                      <td><strong>L1</strong></td>
                      <td>{t("Serie")}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{lpFilter.l1.toFixed(3)} mH</td>
                    </tr>
                  )}
                  {lpFilter?.l2 && (
                    <tr>
                      <td style={{ color: 'var(--ported-color)', fontWeight: 600 }}>{t("Paso Bajo (Woofer)")}</td>
                      <td><strong>L2</strong></td>
                      <td>{t("Serie")}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{lpFilter.l2.toFixed(3)} mH</td>
                    </tr>
                  )}
                  {lpFilter?.c1 !== null && lpFilter?.c1 !== undefined && (
                    <tr>
                      <td style={{ color: 'var(--ported-color)', fontWeight: 600 }}>{t("Paso Bajo (Woofer)")}</td>
                      <td><strong>C1</strong></td>
                      <td>{t("Paralelo")}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{lpFilter.c1.toFixed(2)} µF</td>
                    </tr>
                  )}
                  {lpFilter?.c2 && (
                    <tr>
                      <td style={{ color: 'var(--ported-color)', fontWeight: 600 }}>{t("Paso Bajo (Woofer)")}</td>
                      <td><strong>C2</strong></td>
                      <td>{t("Paralelo")}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{lpFilter.c2.toFixed(2)} µF</td>
                    </tr>
                  )}

                  {/* RED ZOBEL */}
                  {enableZobel && zobelResults && (
                    <>
                      <tr>
                        <td style={{ color: 'var(--warning)', fontWeight: 600 }}>{t("Red Zobel (Woofer)")}</td>
                        <td><strong>Rz</strong></td>
                        <td>{t("Serie")}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{zobelResults.rz.toFixed(2)} Ω</td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--warning)', fontWeight: 600 }}>{t("Red Zobel (Woofer)")}</td>
                        <td><strong>Cz</strong></td>
                        <td>{t("Paralelo")}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{zobelResults.cz.toFixed(2)} µF</td>
                      </tr>
                    </>
                  )}

                  {/* L-PAD */}
                  {enableLPad && lpadResults && (
                    <>
                      <tr>
                        <td style={{ color: '#38bdf8', fontWeight: 600 }}>{t("Atenuador L-Pad (Tweeter)")}</td>
                        <td><strong>R_ser</strong></td>
                        <td>{t("Serie")}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{lpadResults.r1.toFixed(2)} Ω</td>
                      </tr>
                      <tr>
                        <td style={{ color: '#38bdf8', fontWeight: 600 }}>{t("Atenuador L-Pad (Tweeter)")}</td>
                        <td><strong>R_par</strong></td>
                        <td>{t("Paralelo")}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{lpadResults.r2.toFixed(2)} Ω</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>

      </div>
    );
  };

  if (readOnly) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', boxSizing: 'border-box' }}>
        {/* Esquema de conexión CAD Canvas 2D */}
        <div style={{ width: '100%', marginTop: '0px' }}>
          <CrossoverCad2D
            theme={effectiveTheme}
            lang={lang}
            crossoverWays={crossoverWays}
            crossoverType={crossoverType}
            xoverResults={xoverResults}
            enableZobel={enableZobel}
            zobelResults={zobelResults}
            enableLPad={enableLPad}
            lpadResults={lpadResults}
          />
        </div>

        {/* Componentes Calculados */}
        {xoverResults && (
          <div className="pro-calc-panel" style={{ marginTop: '0rem', padding: '0rem', overflowX: 'auto' }}>
            <span className="pro-calc-title" style={{ display: 'block', marginBottom: '0rem', color: 'var(--success)' }}>
              {t("Componentes del Filtro")} ({crossoverWays === '2way' ? '2 Vías' : '3 Vías'}, {crossoverType === '2nd_lr' ? 'L-R' : crossoverType === '2nd_butter' ? 'Butterworth' : crossoverType === '1st_order' ? '1er Orden' : '4to Orden'})
            </span>
            {renderComponentsTable()}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="tab-content active" id="tab-crossover" style={{ padding: '0.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        
        {/* PANEL DE CALCULOS Y CONFIGURACIONES */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          
          {/* CALCULADORA DE CROSSOVER (Fila 1, Col 1) */}
          <div className="panel" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '0.5rem', borderRadius: '0px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backdropFilter: 'blur(16px)', boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)', gridRow: 'span 2' }}>
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
                <button 
                  className={`preset-select ${crossoverWays === '2way' ? 'active' : ''}`}
                  style={{ flex: 1, padding: '0.4rem 0.8rem', background: crossoverWays === '2way' ? 'var(--primary)' : 'transparent', color: crossoverWays === '2way' ? '#fff' : 'var(--text-main)', border: '1px solid var(--card-border)', borderRadius: '0px', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => setCrossoverWays('2way')}
                >
                  {t("2 Vías (Woofer + Tweeter)")}
                </button>
                <button 
                  className={`preset-select ${crossoverWays === '3way' ? 'active' : ''}`}
                  style={{ flex: 1, padding: '0.4rem 0.8rem', background: crossoverWays === '3way' ? 'var(--primary)' : 'transparent', color: crossoverWays === '3way' ? '#fff' : 'var(--text-main)', border: '1px solid var(--card-border)', borderRadius: '0px', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => setCrossoverWays('3way')}
                >
                  {t("3 Vías (Woofer + Mid + Tweet)")}
                </button>
              </div>

              <span className="control-title" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--primary)' }}>
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
          <div className="panel" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '1.5rem', borderRadius: '0px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backdropFilter: 'blur(16px)', boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)' }}>
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
              <div style={{ background: 'rgba(245, 158, 11, 0.03)', border: '1px solid rgba(245, 158, 11, 0.15)', padding: '1rem', borderRadius: '0px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-around' }}>
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
          <div className="panel" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '1.5rem', borderRadius: '0px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backdropFilter: 'blur(16px)', boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)' }}>
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
              <div style={{ background: 'rgba(56, 189, 248, 0.03)', border: '1px solid rgba(56, 189, 248, 0.15)', padding: '1rem', borderRadius: '0px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-around' }}>
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

        {/* AUTO-OPTIMIZADOR NELDER-MEAD SIMPLEX EN RUST (MNA SOLVER) */}
        {renderNelderMeadOptimizer(false)}

        {/* DIAGRAMA CAD EN CANVAS 2D DE ANCHO COMPLETO */}
        <div style={{ width: '100%' }}>
          <CrossoverCad2D
            theme={effectiveTheme}
            lang={lang}
            crossoverWays={crossoverWays}
            crossoverType={crossoverType}
            xoverResults={xoverResults}
            enableZobel={enableZobel}
            zobelResults={zobelResults}
            enableLPad={enableLPad}
            lpadResults={lpadResults}
          />
        </div>

        {/* COMPONENTES DEL FILTRO DEBAJO DEL DIAGRAMA */}
        <div className="panel" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '1.5rem', borderRadius: '0px', display: 'flex', flexDirection: 'column', backdropFilter: 'blur(16px)', boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)', marginTop: '0rem' }}>
          <span className="control-title" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--success)' }}>
            {t("Componentes del Filtro")} ({t(crossoverType)})
          </span>

          {xoverResults ? (
            renderComponentsTable()
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t("Completa los valores del crossover.")}</p>
          )}
        </div>

        {/* CALCULADORA DE INDUCTORES */}
        <div className="panel" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '1.5rem', borderRadius: '0px', display: 'flex', flexDirection: 'column', backdropFilter: 'blur(16px)', boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)', marginTop: '0.5rem' }}>
          <span className="control-title" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--warning)' }}>
            {t("Calculadora de Inductores (Fórmula de Wheeler)")}
          </span>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: '1.3' }}>
            {t("Calcula el número de vueltas (espiras) necesarias para construir una bobina con núcleo de aire dado su valor en mH y las dimensiones físicas de la formaleta.")}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label>{t("Inductancia Objetivo (L)")}</label>
              <div className="input-wrapper">
                <input 
                  type="number" 
                  value={indCalcTargetL} 
                  onChange={(e) => setIndCalcTargetL(e.target.value === '' ? '' : parseFloat(e.target.value))} 
                  step="0.01"
                  min="0.01"
                />
                <span className="unit-badge">mH</span>
              </div>
            </div>
            <div className="input-group">
              <label>{t("Diámetro Promedio (d)")}</label>
              <div className="input-wrapper">
                <input 
                  type="number" 
                  value={indCalcD} 
                  onChange={(e) => setIndCalcD(e.target.value === '' ? '' : parseFloat(e.target.value))} 
                  step="0.1"
                  min="1"
                />
                <span className="unit-badge">mm</span>
              </div>
            </div>
            <div className="input-group">
              <label>{t("Longitud de Bobina (l)")}</label>
              <div className="input-wrapper">
                <input 
                  type="number" 
                  value={indCalcLen} 
                  onChange={(e) => setIndCalcLen(e.target.value === '' ? '' : parseFloat(e.target.value))} 
                  step="0.1"
                  min="0.1"
                />
                <span className="unit-badge">cm</span>
              </div>
            </div>
          </div>

          {indCalcN !== null && (
            <div style={{ marginTop: '1rem', background: 'rgba(245, 158, 11, 0.03)', border: '1px solid rgba(245, 158, 11, 0.15)', padding: '1rem', borderRadius: '0px', fontSize: '0.9rem', textAlign: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t("Vueltas requeridas (aprox):")}</span>{' '}
              <strong style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>{Math.round(indCalcN)} {t("espiras")}</strong>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export const CrossoverTab = React.memo(CrossoverTabComponent);

