import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import type { CalculatedSealed, CalculatedPorted, CalculatedBandpass, SpeakerParams } from '../types';
import { type Lang, translate } from '../utils/translations';
import { calcSealedCurve, calcPortedCurve, calcBandpass4Curve, calcBandpass6Curve } from '../wasm/index';

ChartJS.register(
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Frequency points to evaluate (static)
const frequencies = (() => {
  const freqs: number[] = [];
  for (let i = 0; i <= 100; i++) {
    const f = 10 * Math.pow(500 / 10, i / 100);
    freqs.push(Math.round(f * 10) / 10);
  }
  return freqs;
})();

const frequenciesFull = (() => {
  const freqs: number[] = [];
  for (let i = 0; i <= 150; i++) {
    const f = 10 * Math.pow(20000 / 10, i / 150);
    freqs.push(Math.round(f * 10) / 10);
  }
  return freqs;
})();

// JS formulas for full-range cabinet response calculations
const calculateSealedResponseAt = (f: number, fs: number, qts: number, vas: number, vb: number) => {
  const alpha = vas / vb;
  const fc = fs * Math.sqrt(alpha + 1);
  const qtc = qts * Math.sqrt(alpha + 1);
  const fn_ = f / fc;
  const response = Math.pow(fn_, 2) / Math.sqrt(Math.pow(Math.pow(fn_, 2) - 1, 2) + Math.pow(fn_ / qtc, 2) + 1e-20);
  return 20 * Math.log10(response + 1e-10);
};

const calculatePortedResponseAt = (f: number, fs: number, qts: number, vas: number, vb: number, fb: number) => {
  const h = fb / fs;
  const alpha = vas / vb;
  const ql = 7.0;
  const a3 = 1.0 / qts + h / ql;
  const a2 = 1.0 + h * h * (1.0 + alpha) + h / (qts * ql);
  const a1 = h * h / qts + h / ql;
  const a0 = h * h;
  const y = f / fs;
  const real = Math.pow(y, 4) - a2 * y * y + a0;
  const imag = a1 * y - a3 * Math.pow(y, 3);
  const response = Math.pow(y, 4) / Math.sqrt(real * real + imag * imag + 1e-20);
  return 20 * Math.log10(response + 1e-10);
};

const calculateBandpass4ResponseAt = (f: number, fs: number, qts: number, vas: number, vf: number, vr: number, fb: number) => {
  const h = fb / fs;
  const alpha_f = vas / vf;
  const alpha_r = vas / vr;
  const ql = 7.0;
  const a3 = 1.0 / qts + h / ql;
  const a2 = 1.0 + h * h * (1.0 + alpha_r) + alpha_f + h / (qts * ql);
  const a1 = h * h / qts + (h / ql) * (1.0 + alpha_f);
  const a0 = h * h;
  const y = f / fs;
  const real = Math.pow(y, 4) - a2 * y * y + a0;
  const imag = a1 * y - a3 * Math.pow(y, 3);
  const denom = Math.sqrt(real * real + imag * imag + 1e-20);
  const response = (y * y * alpha_f) / denom;
  return 20 * Math.log10(response + 1e-10);
};

const calculateBandpass6ResponseAt = (f: number, vas: number, vf: number, vr: number, fl: number, fh: number) => {
  const q = 0.707;
  const y_l = f / fl;
  const den_l = Math.sqrt(Math.pow(1.0 - y_l * y_l, 2) + Math.pow(y_l / q, 2) + 1e-20);
  const hp = (y_l * y_l) / den_l;

  const y_h = f / fh;
  const den_h = Math.sqrt(Math.pow(1.0 - y_h * y_h, 2) + Math.pow(y_h / q, 2) + 1e-20);
  const lp = 1.0 / den_h;

  const alpha = vas / (vf + vr);
  const response = hp * lp * Math.sqrt(1.0 + alpha);
  return 20 * Math.log10(response + 1e-10);
};

// Crossover filter gain formula
const getFilterGain = (f: number, fcPoint: number, type: string, passType: 'LP' | 'HP') => {
  const x = f / fcPoint;
  let gain = 0;
  if (type === '1st_order') {
    const factor = passType === 'LP' ? 1.0 : x;
    gain = 20 * Math.log10(factor / Math.sqrt(1 + x * x) + 1e-10);
  } else if (type === '2nd_butter') {
    const factor = passType === 'LP' ? 1.0 : x * x;
    gain = 20 * Math.log10(factor / Math.sqrt(1 + Math.pow(x, 4)) + 1e-10);
  } else if (type === '2nd_lr') {
    const factor = passType === 'LP' ? 1.0 : x * x;
    gain = 20 * Math.log10(factor / (1 + x * x) + 1e-10);
  } else if (type === '4th_lr') {
    const factor = passType === 'LP' ? 1.0 : Math.pow(x, 4);
    gain = 20 * Math.log10(factor / (1 + Math.pow(x, 4)) + 1e-10);
  }
  return Math.max(-60, gain); // clamp to -60dB min for neatness
};

// Custom annotation plugin for vertical reference lines
const lineAnnotationPlugin = {
  id: 'lineAnnotation',
  afterDraw: (chart: any) => {
    const { ctx, scales: { x, y } } = chart;
    const annotations = chart.options.plugins?.lineAnnotation?.annotations || [];
    
    ctx.save();
    annotations.forEach((ann: any) => {
      const xVal = ann.value;
      if (xVal < x.min || xVal > x.max) return;
      
      const xPixel = x.getPixelForValue(xVal);
      
      // Draw vertical line
      ctx.beginPath();
      ctx.strokeStyle = ann.borderColor || '#ef4444';
      ctx.lineWidth = ann.borderWidth || 1.5;
      if (ann.borderDash) {
        ctx.setLineDash(ann.borderDash);
      } else {
        ctx.setLineDash([]);
      }
      ctx.moveTo(xPixel, y.top);
      ctx.lineTo(xPixel, y.bottom);
      ctx.stroke();
      
      // Draw label background
      if (ann.label) {
        ctx.font = 'bold 9px Inter, system-ui';
        const textWidth = ctx.measureText(ann.label).width;
        ctx.fillStyle = ann.labelBgColor || 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(xPixel - textWidth / 2 - 4, y.top + 6, textWidth + 8, 14);
        
        // Draw text
        ctx.fillStyle = ann.labelTextColor || '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(ann.label, xPixel, y.top + 16);
      }
    });
    ctx.restore();
  }
};

interface SimulationChartProps {
  lang: Lang;
  theme: 'dark' | 'light';
  sealedData: CalculatedSealed | null;
  portedData: CalculatedPorted | null;
  bandpassData: CalculatedBandpass | null;
  params: SpeakerParams;
  // Crossover props
  crossoverWays?: number;
  crossoverType?: '1st_order' | '2nd_butter' | '2nd_lr' | '4th_lr';
  fc?: number;
  fcLow?: number;
  fcHigh?: number;
}

export const SimulationChart: React.FC<SimulationChartProps> = ({
  lang,
  theme,
  sealedData,
  portedData,
  bandpassData,
  params,
  crossoverWays = 2,
  crossoverType = '2nd_lr',
  fc = 2500,
  fcLow = 500,
  fcHigh = 4000,
}) => {
  const t = (text: string) => translate(text, lang);

  // Range and Annotation modes
  const [rangeMode, setRangeMode] = useState<'bass' | 'full'>('bass');
  const [showRefLines, setShowRefLines] = useState<boolean>(true);

  // State for curve points (used in graves/bass mode)
  const [sealedPoints, setSealedPoints] = useState<{x:number,y:number}[]>([]);
  const [portedPoints, setPortedPoints] = useState<{x:number,y:number}[]>([]);
  const [bandpassPoints, setBandpassPoints] = useState<{x:number,y:number}[]>([]);

  // Recalculate curves when data or params change
  useEffect(() => {
    let cancelled = false;
    if (sealedData) {
      calcSealedCurve(sealedData, params).then(vals => {
        if (!cancelled) {
          const pts = vals.map((y:number, idx:number) => ({ x: frequencies[idx], y: Math.max(-35, y) }));
          setSealedPoints(pts);
        }
      });
    } else {
      setTimeout(() => {
        if (!cancelled) setSealedPoints([]);
      }, 0);
    }
    if (portedData) {
      calcPortedCurve(portedData, params).then(vals => {
        if (!cancelled) {
          const pts = vals.map((y:number, idx:number) => ({ x: frequencies[idx], y: Math.max(-35, y) }));
          setPortedPoints(pts);
        }
      });
    } else {
      setTimeout(() => {
        if (!cancelled) setPortedPoints([]);
      }, 0);
    }
    if (bandpassData && bandpassData.valid) {
      if (bandpassData.order === 4) {
        calcBandpass4Curve(bandpassData.Vf, bandpassData.Vr, bandpassData.Fb, params).then(vals => {
          if (!cancelled) {
            const pts = vals.map((y:number, idx:number) => ({ x: frequencies[idx], y: Math.max(-35, y) }));
            setBandpassPoints(pts);
          }
        });
      } else {
        calcBandpass6Curve(bandpassData.Vf, bandpassData.Vr, bandpassData.Fl || 0, bandpassData.Fh || 0, params).then(vals => {
          if (!cancelled) {
            const pts = vals.map((y:number, idx:number) => ({ x: frequencies[idx], y: Math.max(-35, y) }));
            setBandpassPoints(pts);
          }
        });
      }
    } else {
      setTimeout(() => {
        if (!cancelled) setBandpassPoints([]);
      }, 0);
    }
    return () => { cancelled = true; };
  }, [sealedData, portedData, bandpassData, params]);

  // Generate curves for full range if in 'full' mode
  const fullRangeDatasets = React.useMemo(() => {
    if (rangeMode !== 'full') return [];

    const datasets: any[] = [];
    const fs = params.fs || 38;
    const qts = params.qts || 0.36;
    const vas = params.vas || 45;

    // 1. Enclosure Response (Unfiltered)
    let boxPoints: { x: number, y: number }[] = [];
    let label = '';
    let borderColor = '#0ea5e9';
    let backgroundColor = 'rgba(14, 165, 233, 0.03)';

    if (sealedData && sealedData.valid) {
      boxPoints = frequenciesFull.map(f => ({
        x: f,
        y: Math.max(-45, calculateSealedResponseAt(f, fs, qts, vas, sealedData.Vb))
      }));
      label = `${t("Caja Sellada")} (${t("Sin Filtro")})`;
      borderColor = '#0ea5e9';
      backgroundColor = 'rgba(14, 165, 233, 0.03)';
    } else if (portedData && portedData.valid) {
      boxPoints = frequenciesFull.map(f => ({
        x: f,
        y: Math.max(-45, calculatePortedResponseAt(f, fs, qts, vas, portedData.Vb, portedData.Fb))
      }));
      label = `${t("Caja Ventilada")} (${t("Sin Filtro")})`;
      borderColor = '#10b981';
      backgroundColor = 'rgba(16, 185, 129, 0.03)';
    } else if (bandpassData && bandpassData.valid) {
      if (bandpassData.order === 4) {
        boxPoints = frequenciesFull.map(f => ({
          x: f,
          y: Math.max(-45, calculateBandpass4ResponseAt(f, fs, qts, vas, bandpassData.Vf, bandpassData.Vr, bandpassData.Fb))
        }));
      } else {
        boxPoints = frequenciesFull.map(f => ({
          x: f,
          y: Math.max(-45, calculateBandpass6ResponseAt(f, vas, bandpassData.Vf, bandpassData.Vr, bandpassData.Fl || 0, bandpassData.Fh || 0))
        }));
      }
      label = `${t("Caja Paso Banda")} (${t("Sin Filtro")})`;
      borderColor = '#f59e0b';
      backgroundColor = 'rgba(245, 158, 11, 0.03)';
    }

    if (boxPoints.length > 0) {
      datasets.push({
        label,
        data: boxPoints,
        borderColor,
        backgroundColor,
        borderWidth: 1.5,
        pointRadius: 0,
        fill: true,
        tension: 0.1,
        borderDash: [3, 3]
      });

      // 2. Filter low-pass and HP/BP curves
      if (crossoverWays === 2) {
        // Woofer LP Filter
        const wooferFilterPoints = frequenciesFull.map(f => ({
          x: f,
          y: getFilterGain(f, fc, crossoverType, 'LP')
        }));
        datasets.push({
          label: `${t("Filtro LPF Woofer")} (${fc}Hz)`,
          data: wooferFilterPoints,
          borderColor: '#8b5cf6', // purple
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          borderDash: [5, 2]
        });

        // Woofer Acoustical Combined Output (Box + LP filter)
        const wooferCombinedPoints = frequenciesFull.map((f, idx) => ({
          x: f,
          y: Math.max(-45, boxPoints[idx].y + wooferFilterPoints[idx].y)
        }));
        datasets.push({
          label: `${t("Woofer Filtrado (Acústica)")}`,
          data: wooferCombinedPoints,
          borderColor: '#3b82f6', // bright blue
          borderWidth: 2.5,
          pointRadius: 0,
          fill: false
        });

        // Tweeter HP Filter
        const tweeterFilterPoints = frequenciesFull.map(f => ({
          x: f,
          y: getFilterGain(f, fc, crossoverType, 'HP')
        }));
        datasets.push({
          label: `${t("Filtro HPF Tweeter")} (${fc}Hz)`,
          data: tweeterFilterPoints,
          borderColor: '#ec4899', // pink
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          borderDash: [4, 4]
        });
      } else {
        // 3 Vías
        // Woofer LP Filter at fcLow
        const wooferFilterPoints = frequenciesFull.map(f => ({
          x: f,
          y: getFilterGain(f, fcLow, crossoverType, 'LP')
        }));
        datasets.push({
          label: `${t("Filtro LPF Woofer")} (${fcLow}Hz)`,
          data: wooferFilterPoints,
          borderColor: '#8b5cf6',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          borderDash: [5, 2]
        });

        // Woofer Combined Output
        const wooferCombinedPoints = frequenciesFull.map((f, idx) => ({
          x: f,
          y: Math.max(-45, boxPoints[idx].y + wooferFilterPoints[idx].y)
        }));
        datasets.push({
          label: `${t("Woofer Filtrado (Acústica)")}`,
          data: wooferCombinedPoints,
          borderColor: '#3b82f6',
          borderWidth: 2.5,
          pointRadius: 0,
          fill: false
        });

        // Midrange BP Filter (HP at fcLow & LP at fcHigh)
        const midFilterPoints = frequenciesFull.map(f => ({
          x: f,
          y: getFilterGain(f, fcLow, crossoverType, 'HP') + getFilterGain(f, fcHigh, crossoverType, 'LP')
        }));
        datasets.push({
          label: `${t("Filtro BPF Medio")} (${fcLow}-${fcHigh}Hz)`,
          data: midFilterPoints,
          borderColor: '#14b8a6', // Teal
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          borderDash: [3, 3]
        });

        // Tweeter HP Filter at fcHigh
        const tweeterFilterPoints = frequenciesFull.map(f => ({
          x: f,
          y: getFilterGain(f, fcHigh, crossoverType, 'HP')
        }));
        datasets.push({
          label: `${t("Filtro HPF Tweeter")} (${fcHigh}Hz)`,
          data: tweeterFilterPoints,
          borderColor: '#ec4899',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          borderDash: [4, 4]
        });
      }
    }

    return datasets;
  }, [rangeMode, params, sealedData, portedData, bandpassData, crossoverWays, crossoverType, fc, fcLow, fcHigh, lang]);

  // Construct reference line annotations
  const annotations = React.useMemo(() => {
    if (!showRefLines) return [];
    const list: any[] = [];

    if (rangeMode === 'bass') {
      if (sealedData && sealedData.valid) {
        list.push({
          value: sealedData.Fc,
          borderColor: '#f97316',
          borderWidth: 1.5,
          borderDash: [4, 4],
          label: `Fc: ${sealedData.Fc.toFixed(1)} Hz`
        });
        list.push({
          value: sealedData.F3,
          borderColor: '#38bdf8',
          borderWidth: 1.5,
          borderDash: [4, 4],
          label: `F3: ${sealedData.F3.toFixed(1)} Hz`
        });
      }
      if (portedData && portedData.valid) {
        list.push({
          value: portedData.Fb,
          borderColor: '#10b981',
          borderWidth: 1.5,
          borderDash: [4, 4],
          label: `Fb: ${portedData.Fb.toFixed(1)} Hz`
        });
        list.push({
          value: portedData.F3,
          borderColor: '#38bdf8',
          borderWidth: 1.5,
          borderDash: [4, 4],
          label: `F3: ${portedData.F3.toFixed(1)} Hz`
        });
      }
      if (bandpassData && bandpassData.valid) {
        if (bandpassData.order === 4) {
          list.push({
            value: bandpassData.Fb,
            borderColor: '#10b981',
            borderWidth: 1.5,
            borderDash: [4, 4],
            label: `Fb: ${bandpassData.Fb.toFixed(1)} Hz`
          });
          if (bandpassData.F0) {
            list.push({
              value: bandpassData.F0,
              borderColor: '#f59e0b',
              borderWidth: 1.5,
              borderDash: [4, 4],
              label: `F0: ${bandpassData.F0.toFixed(1)} Hz`
            });
          }
        } else {
          if (bandpassData.Fl) {
            list.push({
              value: bandpassData.Fl,
              borderColor: '#38bdf8',
              borderWidth: 1.5,
              borderDash: [4, 4],
              label: `Fl: ${bandpassData.Fl.toFixed(1)} Hz`
            });
          }
          if (bandpassData.Fh) {
            list.push({
              value: bandpassData.Fh,
              borderColor: '#ec4899',
              borderWidth: 1.5,
              borderDash: [4, 4],
              label: `Fh: ${bandpassData.Fh.toFixed(1)} Hz`
            });
          }
        }
      }
    } else {
      // In full mode, show crossover points as vertical lines
      if (crossoverWays === 2) {
        list.push({
          value: fc,
          borderColor: '#8b5cf6',
          borderWidth: 1.5,
          borderDash: [4, 4],
          label: `Fc: ${fc} Hz`
        });
      } else {
        list.push({
          value: fcLow,
          borderColor: '#8b5cf6',
          borderWidth: 1.5,
          borderDash: [4, 4],
          label: `Fc Low: ${fcLow} Hz`
        });
        list.push({
          value: fcHigh,
          borderColor: '#ec4899',
          borderWidth: 1.5,
          borderDash: [4, 4],
          label: `Fc High: ${fcHigh} Hz`
        });
      }
      // Add F3 if box is valid
      if (sealedData && sealedData.valid) {
        list.push({
          value: sealedData.F3,
          borderColor: '#38bdf8',
          borderWidth: 1.2,
          borderDash: [6, 4],
          label: `F3: ${sealedData.F3.toFixed(1)} Hz`
        });
      } else if (portedData && portedData.valid) {
        list.push({
          value: portedData.F3,
          borderColor: '#38bdf8',
          borderWidth: 1.2,
          borderDash: [6, 4],
          label: `F3: ${portedData.F3.toFixed(1)} Hz`
        });
      }
    }

    return list;
  }, [showRefLines, rangeMode, sealedData, portedData, bandpassData, crossoverWays, fc, fcLow, fcHigh]);

  // Determine dynamic axis bounds
  const allYValues = rangeMode === 'bass' ? [
    ...sealedPoints.map(p => p.y),
    ...portedPoints.map(p => p.y),
    ...bandpassPoints.map(p => p.y)
  ] : fullRangeDatasets.flatMap(d => d.data.map((p: any) => p.y));

  const highestY = allYValues.length > 0 ? Math.max(...allYValues) : 0;
  const lowestY = allYValues.length > 0 ? Math.min(...allYValues) : -24;
  const dynamicMax = highestY > 6 ? Math.ceil((highestY + 1.5) / 3) * 3 : 6;
  const dynamicMin = lowestY < -24 ? Math.floor(lowestY / 6) * 6 : -24;

  const chartGridColor = theme === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)';
  const chartTextColor = theme === 'light' ? '#475569' : '#94a3b8';
  const chartLegendColor = theme === 'light' ? '#0f172a' : '#f8fafc';
  const chartTooltipBg = theme === 'light' ? '#ffffff' : 'rgba(15, 23, 42, 0.95)';
  const chartTooltipBorder = theme === 'light' ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.15)';
  const chartSealedBg = 'rgba(14, 165, 233, 0.05)';
  const chartPortedBg = 'rgba(16, 185, 129, 0.05)';
  const chartBandpassBg = 'rgba(245, 158, 11, 0.05)';
  const sealedBorderColor = '#0ea5e9';
  const portedBorderColor = '#10b981';
  const bandpassBorderColor = '#f59e0b';

  const data = {
    datasets: rangeMode === 'bass' ? [
      ...(sealedData && sealedData.valid ? [{
        label: `${t("Caja Sellada")} (Vb ${sealedData.Vb.toFixed(1)}L, Qtc ${sealedData.Qtc.toFixed(2)})`,
        data: sealedPoints,
        borderColor: sealedBorderColor,
        backgroundColor: chartSealedBg,
        borderWidth: 2.5,
        pointRadius: 0,
        fill: true,
        tension: 0.2,
      }] : []),
      ...(portedData && portedData.valid ? [{
        label: `${t("Caja Ventilada")} (Vb ${portedData.Vb.toFixed(1)}L, Fb ${portedData.Fb.toFixed(1)}Hz)`,
        data: portedPoints,
        borderColor: portedBorderColor,
        backgroundColor: chartPortedBg,
        borderWidth: 2.5,
        pointRadius: 0,
        fill: true,
        tension: 0.2,
      }] : []),
      ...(bandpassData && bandpassData.valid ? [{
        label: bandpassData.order === 4 
          ? `${t("Caja Paso Banda 4.º")} (Vf ${bandpassData.Vf.toFixed(1)}L, Vr ${bandpassData.Vr.toFixed(1)}L, Fb ${bandpassData.Fb.toFixed(1)}Hz)`
          : `${t("Caja Paso Banda 6.º")} (Vf ${bandpassData.Vf.toFixed(1)}L, Fl ${bandpassData.Fl?.toFixed(1)}Hz, Fh ${bandpassData.Fh?.toFixed(1)}Hz)`,
        data: bandpassPoints,
        borderColor: bandpassBorderColor,
        backgroundColor: chartBandpassBg,
        borderWidth: 2.5,
        pointRadius: 0,
        fill: true,
        tension: 0.2,
      }] : []),
    ] : fullRangeDatasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'logarithmic' as const,
        min: 10,
        max: rangeMode === 'bass' ? 500 : 20000,
        grid: { color: chartGridColor },
        title: {
          display: true,
          text: t('Frecuencia (Hz)'),
          color: chartTextColor,
          font: { family: 'Inter', size: 11 },
        },
        ticks: {
          color: chartTextColor,
          font: { family: 'Inter', size: 10 },
          callback: function (value: any) {
            const targets = rangeMode === 'bass'
              ? [10, 20, 30, 50, 70, 100, 200, 300, 500]
              : [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
            if (targets.includes(value)) {
              return value >= 1000 ? (value / 1000) + 'k Hz' : value + ' Hz';
            }
            return null;
          },
        },
      },
      y: {
        min: dynamicMin,
        max: dynamicMax,
        grid: { color: chartGridColor },
        title: {
          display: true,
          text: t('Ganancia (dB)'),
          color: chartTextColor,
          font: { family: 'Inter', size: 11 },
        },
        ticks: {
          color: chartTextColor,
          font: { family: 'Inter', size: 10 },
          stepSize: 3,
        },
      },
    },
    plugins: {
      legend: {
        labels: {
          usePointStyle: true,
          pointStyle: 'line' as const,
          color: chartLegendColor,
          font: { family: 'Inter', size: 11 },
        },
      },
      tooltip: {
        backgroundColor: chartTooltipBg,
        titleColor: chartLegendColor,
        bodyColor: chartTextColor,
        titleFont: { family: 'Plus Jakarta Sans' },
        bodyFont: { family: 'Inter' },
        borderColor: chartTooltipBorder,
        borderWidth: 1,
        callbacks: {
          label: function (context: any) {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} dB ${t('a')} ${context.parsed.x >= 1000 ? (context.parsed.x/1000).toFixed(1)+'k' : context.parsed.x} Hz`;
          },
        },
      },
      lineAnnotation: {
        annotations: annotations
      }
    },
  };

  return (
    <div className="panel chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 className="panel-title" style={{ margin: 0, fontSize: '0.95rem' }}>{t("Simulación de Respuesta en Frecuencia (dB vs Hz)")}</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {/* Segmented range selector */}
          <div className="segmented-control" style={{ padding: '2px', borderRadius: '8px', display: 'flex', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)' }}>
            <button
              type="button"
              className={rangeMode === 'bass' ? 'active' : ''}
              onClick={() => setRangeMode('bass')}
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderRadius: '6px', cursor: 'pointer', border: 'none', background: rangeMode === 'bass' ? 'var(--primary)' : 'transparent', color: '#ffffff', fontWeight: 600 }}
            >
              {t("Graves")}
            </button>
            <button
              type="button"
              className={rangeMode === 'full' ? 'active' : ''}
              onClick={() => setRangeMode('full')}
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderRadius: '6px', cursor: 'pointer', border: 'none', background: rangeMode === 'full' ? 'var(--primary)' : 'transparent', color: '#ffffff', fontWeight: 600 }}
            >
              {t("Filtros / 20kHz")}
            </button>
          </div>

          {/* Toggle Reference Lines */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem', color: 'var(--text-main)', cursor: 'pointer', margin: 0, fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={showRefLines}
              onChange={(e) => setShowRefLines(e.target.checked)}
              style={{ width: '13px', height: '13px', accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            {t("Líneas Ref.")}
          </label>
        </div>
      </div>

      <div className="chart-container" style={{ flex: 1, minHeight: '260px' }}>
        {data.datasets.length > 0 ? (
          <Line data={data} options={options} plugins={[lineAnnotationPlugin]} />
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
            {t("Completa los parámetros mínimos del altavoz (Fs, Vas, Qts).")}
          </div>
        )}
      </div>
    </div>
  );
};
