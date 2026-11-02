import React, { useState, useEffect, useCallback } from 'react';
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
  type TooltipItem,
} from 'chart.js';
import type { CalculatedSealed, CalculatedPorted, CalculatedBandpass, SpeakerParams } from '../types';
import { type Lang, translate } from '../utils/translations';
import {
  calcSealedCurve,
  calcPortedCurve,
  calcBandpass4Curve,
  calcBandpass6Curve,
  applyBaffleStepToSpl,
  applyBaffleStepToSplCustom,
  calcExtendedImpedanceCurveCustom,
} from '../wasm/index';
import {
  calcExcursionCurve,
  calcAirVelocityCurve,
  calcImpedanceCurve,
  calcPhaseCurve,
  calcGroupDelayCurve,
  calculateSealedResponseAt,
  calculatePortedResponseAt,
  calculateBandpass4ResponseAt,
  calculateBandpass6ResponseAt,
  getFilterGain,
} from '../utils/acousticMath';

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

// Custom annotation plugin for vertical reference lines
interface AnnotationOption {
  value: number;
  borderColor?: string;
  borderWidth?: number;
  borderDash?: number[];
  label?: string;
  labelBgColor?: string;
  labelTextColor?: string;
}

const lineAnnotationPlugin = {
  id: 'lineAnnotation',
  afterDraw: (chart: ChartJS) => {
    const { ctx, scales: { x, y } } = chart;
    const plugins = chart.options.plugins as Record<string, unknown> | undefined;
    const lineAnn = plugins?.lineAnnotation as Record<string, unknown> | undefined;
    const annotations = (lineAnn?.annotations as AnnotationOption[]) || [];
    
    ctx.save();
    annotations.forEach((ann: AnnotationOption) => {
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

// Plugin de Estilo CAD Blueprint / Analizador Técnico de Audio
const cadBlueprintPlugin = {
  id: 'cadBlueprint',
  beforeDraw: (chart: ChartJS) => {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const { left, top, right, bottom, width, height } = chartArea;
    const isLight = ((chart.options.plugins as any)?.cadBlueprint?.theme === 'light');

    ctx.save();
    // Fondo de plano CAD Blueprint de alta fidelidad
    ctx.fillStyle = isLight ? '#f8fafc' : '#060e1d';
    ctx.fillRect(left, top, width, height);

    // Retícula secundaria fina milimétrica estilo CAD
    ctx.strokeStyle = isLight ? 'rgba(14, 165, 233, 0.08)' : 'rgba(56, 189, 248, 0.05)';
    ctx.lineWidth = 1;
    const step = 20;
    for (let xPos = left; xPos <= right; xPos += step) {
      ctx.beginPath();
      ctx.moveTo(xPos, top);
      ctx.lineTo(xPos, bottom);
      ctx.stroke();
    }
    for (let yPos = top; yPos <= bottom; yPos += step) {
      ctx.beginPath();
      ctx.moveTo(left, yPos);
      ctx.lineTo(right, yPos);
      ctx.stroke();
    }

    // Marco perimetral tipo plotter CAD
    ctx.strokeStyle = isLight ? 'rgba(14, 165, 233, 0.3)' : 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(left, top, width, height);

    // Marcas de escala milimétrica en los 4 bordes
    const tickLen = 4;
    ctx.strokeStyle = isLight ? 'rgba(14, 165, 233, 0.4)' : 'rgba(56, 189, 248, 0.45)';
    for (let xPos = left; xPos <= right; xPos += step) {
      ctx.beginPath();
      ctx.moveTo(xPos, top);
      ctx.lineTo(xPos, top + tickLen);
      ctx.moveTo(xPos, bottom);
      ctx.lineTo(xPos, bottom - tickLen);
      ctx.stroke();
    }
    for (let yPos = top; yPos <= bottom; yPos += step) {
      ctx.beginPath();
      ctx.moveTo(left, yPos);
      ctx.lineTo(left + tickLen, yPos);
      ctx.moveTo(right, yPos);
      ctx.lineTo(right - tickLen, yPos);
      ctx.stroke();
    }
    ctx.restore();
  },
  afterDraw: (chart: ChartJS) => {
    const { ctx, chartArea, scales: { x, y } } = chart;
    if (!chartArea) return;
    const { left, top, right, bottom } = chartArea;
    const isLight = ((chart.options.plugins as any)?.cadBlueprint?.theme === 'light');

    ctx.save();
    // Cruces de mira técnica en las intersecciones de ticks principales (+)
    ctx.strokeStyle = isLight ? 'rgba(14, 165, 233, 0.25)' : 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1;
    const crossSize = 3;
    const xTicks = x.ticks;
    const yTicks = y.ticks;
    if (xTicks && yTicks) {
      xTicks.forEach(tX => {
        const pX = x.getPixelForValue(tX.value);
        if (pX >= left && pX <= right) {
          yTicks.forEach(tY => {
            const pY = y.getPixelForValue(tY.value);
            if (pY >= top && pY <= bottom) {
              ctx.beginPath();
              ctx.moveTo(pX - crossSize, pY);
              ctx.lineTo(pX + crossSize, pY);
              ctx.moveTo(pX, pY - crossSize);
              ctx.lineTo(pX, pY + crossSize);
              ctx.stroke();
            }
          });
        }
      });
    }

    // Crosshair / Retículo CAD interactivo con visor HUD
    const tooltip = chart.tooltip;
    if (tooltip && tooltip.opacity > 0 && tooltip.dataPoints && tooltip.dataPoints.length > 0) {
      const activePoint = tooltip.dataPoints[0];
      const px = activePoint.element.x;
      const py = activePoint.element.y;

      if (px >= left && px <= right && py >= top && py <= bottom) {
        // Líneas guía crosshair
        ctx.strokeStyle = isLight ? 'rgba(2, 132, 199, 0.7)' : 'rgba(56, 189, 248, 0.7)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        ctx.beginPath();
        ctx.moveTo(left, py);
        ctx.lineTo(right, py);
        ctx.moveTo(px, top);
        ctx.lineTo(px, bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        // Micro-mira en la intersección
        ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, 2 * Math.PI);
        ctx.stroke();

        // Mini HUD digital CAD en esquina superior derecha
        const hudW = 184;
        const hudH = 22;
        const hudX = right - hudW - 8;
        const hudY = top + 8;
        ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(6, 14, 29, 0.9)';
        ctx.strokeStyle = isLight ? 'rgba(2, 132, 199, 0.5)' : 'rgba(56, 189, 248, 0.5)';
        ctx.lineWidth = 1;
        ctx.fillRect(hudX, hudY, hudW, hudH);
        ctx.strokeRect(hudX, hudY, hudW, hudH);

        ctx.font = "9px 'JetBrains Mono', 'Fira Code', 'Consolas', monospace";
        ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
        ctx.textAlign = 'left';
        const xVal = typeof activePoint.parsed.x === 'number' ? activePoint.parsed.x.toFixed(1) : '0';
        const yVal = typeof activePoint.parsed.y === 'number' ? activePoint.parsed.y.toFixed(1) : '0';
        ctx.fillText(`FREQ: ${xVal}Hz | VAL: ${yVal}`, hudX + 8, hudY + 14);
      }
    }
    ctx.restore();
  }
};

export type SimulationChartMode = 'spl' | 'excursion' | 'velocity' | 'impedance' | 'phase' | 'delay';

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
  portAreaM2?: number;
  baffleWidth?: number;
  baffleHeight?: number;
}

const SimulationChartComponent: React.FC<SimulationChartProps> = ({
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
  portAreaM2 = 0.0044,
  baffleWidth = 32,
  baffleHeight = 45,
}) => {
  const t = useCallback((text: string) => translate(text, lang), [lang]);

  // Acoustic Simulation Suite Mode
  const [chartMode, setChartMode] = useState<SimulationChartMode>('spl');
  const [simPower, setSimPower] = useState<number>(params.pe || 100);

  // Range and Annotation modes
  const [rangeMode, setRangeMode] = useState<'bass' | 'full'>('bass');
  const [showRefLines, setShowRefLines] = useState<boolean>(true);
  const [applyBaffleDiffraction, setApplyBaffleDiffraction] = useState<boolean>(false);
  const [useExtendedZ, setUseExtendedZ] = useState<boolean>(true);

  // State for curve points (used in graves/bass mode)
  const [sealedPoints, setSealedPoints] = useState<{x:number,y:number}[]>([]);
  const [portedPoints, setPortedPoints] = useState<{x:number,y:number}[]>([]);
  const [bandpassPoints, setBandpassPoints] = useState<{x:number,y:number}[]>([]);

  // Recalculate curves when data or params change
  useEffect(() => {
    let cancelled = false;
    if (sealedData) {
      calcSealedCurve(sealedData, params).then(rawVals => {
        if (!cancelled) {
          const vals = applyBaffleDiffraction
            ? applyBaffleStepToSpl(rawVals, baffleWidth, baffleHeight, 0, 0)
            : rawVals;
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
      calcPortedCurve(portedData, params).then(rawVals => {
        if (!cancelled) {
          const vals = applyBaffleDiffraction
            ? applyBaffleStepToSpl(rawVals, baffleWidth, baffleHeight, 0, 0)
            : rawVals;
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
        calcBandpass4Curve(bandpassData.Vf, bandpassData.Vr, bandpassData.Fb, params).then(rawVals => {
          if (!cancelled) {
            const vals = applyBaffleDiffraction
              ? applyBaffleStepToSpl(rawVals, baffleWidth, baffleHeight, 0, 0)
              : rawVals;
            const pts = vals.map((y:number, idx:number) => ({ x: frequencies[idx], y: Math.max(-35, y) }));
            setBandpassPoints(pts);
          }
        });
      } else {
        calcBandpass6Curve(bandpassData.Vf, bandpassData.Vr, bandpassData.Fl || 0, bandpassData.Fh || 0, params).then(rawVals => {
          if (!cancelled) {
            const vals = applyBaffleDiffraction
              ? applyBaffleStepToSpl(rawVals, baffleWidth, baffleHeight, 0, 0)
              : rawVals;
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
  }, [sealedData, portedData, bandpassData, params, applyBaffleDiffraction, baffleWidth, baffleHeight]);

  // Generate curves for full range if in 'full' mode
  const fullRangeDatasets = React.useMemo(() => {
    if (rangeMode !== 'full') return [];

    const datasets: Record<string, unknown>[] = [];
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
      if (applyBaffleDiffraction) {
        const rawY = boxPoints.map(p => p.y);
        const diffractedY = applyBaffleStepToSplCustom(frequenciesFull, rawY, baffleWidth, baffleHeight, 0, 0);
        boxPoints = boxPoints.map((p, idx) => ({
          x: p.x,
          y: Math.max(-45, diffractedY[idx])
        }));
      }

      datasets.push({
        label: applyBaffleDiffraction ? `${label} + Baffle Step` : label,
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
  }, [rangeMode, params, sealedData, portedData, bandpassData, crossoverWays, crossoverType, fc, fcLow, fcHigh, applyBaffleDiffraction, baffleWidth, baffleHeight, t]);

  // Construct reference line annotations
  const annotations = React.useMemo(() => {
    if (!showRefLines) return [];
    const list: AnnotationOption[] = [];

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
  ] : fullRangeDatasets.flatMap(d => (d.data as { x: number, y: number }[]).map(p => p.y));

  const highestY = allYValues.length > 0 ? Math.max(...allYValues) : 0;
  const lowestY = allYValues.length > 0 ? Math.min(...allYValues) : -24;
  const dynamicMax = highestY > 6 ? Math.ceil((highestY + 1.5) / 3) * 3 : 6;
  const dynamicMin = lowestY < -24 ? Math.floor(lowestY / 6) * 6 : -24;

  const chartSealedBg = 'rgba(14, 165, 233, 0.05)';
  const chartPortedBg = 'rgba(16, 185, 129, 0.05)';
  const chartBandpassBg = 'rgba(245, 158, 11, 0.05)';
  const sealedBorderColor = '#0ea5e9';
  const portedBorderColor = '#10b981';
  const bandpassBorderColor = '#f59e0b';

  // --- ACOUSTIC SIMULATION DATASETS ---
  const excursionDatasets = React.useMemo(() => {
    if (chartMode !== 'excursion') return [];
    const list: Record<string, unknown>[] = [];
    if (sealedData && sealedData.valid) {
      const vals = calcExcursionCurve(params, sealedData.Vb, sealedData.Fc, false, simPower, true);
      list.push({
        label: `${t("Caja Sellada")} - Excursión (${simPower}W)`,
        data: frequencies.map((f, i) => ({
          x: f,
          y: vals[i] ?? 0
        })),
        borderColor: sealedBorderColor,
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false,
      });
    }
    if (portedData && portedData.valid) {
      const vals = calcExcursionCurve(params, portedData.Vb, portedData.Fb, true, simPower, true);
      list.push({
        label: `${t("Caja Ventilada")} - Excursión (${simPower}W)`,
        data: frequencies.map((f, i) => ({
          x: f,
          y: vals[i] ?? 0
        })),
        borderColor: portedBorderColor,
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false,
      });
    }
    if (params.xmax && params.xmax > 0) {
      list.push({
        label: `Límite Lineal Xmax (${params.xmax} mm)`,
        data: frequencies.map(f => ({ x: f, y: params.xmax })),
        borderColor: '#ef4444',
        borderWidth: 1.8,
        pointRadius: 0,
        fill: false,
        borderDash: [5, 4]
      });
    }
    return list;
  }, [chartMode, sealedData, portedData, params, simPower, t]);

  const velocityDatasets = React.useMemo(() => {
    if (chartMode !== 'velocity') return [];
    const list: Record<string, unknown>[] = [];
    const pArea = portAreaM2 || 0.0044;
    if (portedData && portedData.valid) {
      const vals = calcAirVelocityCurve(params, portedData.Vb, portedData.Fb, pArea, simPower, true);
      list.push({
        label: `${t("Velocidad Aire Puerto")} (${simPower}W)`,
        data: frequencies.map((f, i) => ({
          x: f,
          y: vals[i] ?? 0
        })),
        borderColor: portedBorderColor,
        backgroundColor: chartPortedBg,
        borderWidth: 2.5,
        pointRadius: 0,
        fill: true,
      });
    }
    list.push({
      label: `Límite 5% c (17 m/s - Audiófilo)`,
      data: frequencies.map(f => ({ x: f, y: 17 })),
      borderColor: '#f59e0b',
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
      borderDash: [4, 4]
    });
    list.push({
      label: `Límite 10% c (34 m/s - Turbulencia/Chuffing)`,
      data: frequencies.map(f => ({ x: f, y: 34 })),
      borderColor: '#ef4444',
      borderWidth: 1.8,
      pointRadius: 0,
      fill: false,
      borderDash: [6, 3]
    });
    return list;
  }, [chartMode, portedData, params, portAreaM2, simPower, t]);

  const impedanceDatasets = React.useMemo(() => {
    if (chartMode !== 'impedance') return [];
    const list: Record<string, unknown>[] = [];
    if (sealedData && sealedData.valid) {
      const vals = useExtendedZ
        ? calcExtendedImpedanceCurveCustom(
            frequencies,
            params.fs || 35.0,
            params.qms || 3.5,
            params.qes || 0.38,
            params.re || 6.0,
            params.vas || 50.0,
            sealedData.Vb,
            0.0,
            false,
            params.le ? params.le * 0.7 : 0.5,
            0.8,
            35.0,
            0.015,
            true
          )
        : calcImpedanceCurve(params, sealedData.Vb, sealedData.Fc, false, true);
      list.push({
        label: `${t("Impedancia Caja Sellada")}${useExtendedZ ? ' (Thorborg/Knudsen)' : ''} (Ω)`,
        data: frequencies.map((f, i) => ({
          x: f,
          y: vals[i] ?? 0
        })),
        borderColor: sealedBorderColor,
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false,
      });
    }
    if (portedData && portedData.valid) {
      const vals = useExtendedZ
        ? calcExtendedImpedanceCurveCustom(
            frequencies,
            params.fs || 35.0,
            params.qms || 3.5,
            params.qes || 0.38,
            params.re || 6.0,
            params.vas || 50.0,
            portedData.Vb,
            portedData.Fb,
            true,
            params.le ? params.le * 0.7 : 0.5,
            0.8,
            35.0,
            0.015,
            true
          )
        : calcImpedanceCurve(params, portedData.Vb, portedData.Fb, true, true);
      list.push({
        label: `${t("Impedancia Caja Ventilada")}${useExtendedZ ? ' (Thorborg/Knudsen)' : ''} (Ω)`,
        data: frequencies.map((f, i) => ({
          x: f,
          y: vals[i] ?? 0
        })),
        borderColor: portedBorderColor,
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false,
      });
    }
    if (params.re && params.re > 0) {
      list.push({
        label: `Re (${params.re.toFixed(1)} Ω)`,
        data: frequencies.map(f => ({ x: f, y: params.re })),
        borderColor: '#94a3b8',
        borderWidth: 1.2,
        pointRadius: 0,
        fill: false,
        borderDash: [3, 3]
      });
    }
    return list;
  }, [chartMode, sealedData, portedData, params, useExtendedZ, t]);

  const phaseDatasets = React.useMemo(() => {
    if (chartMode !== 'phase') return [];
    const list: Record<string, unknown>[] = [];
    if (sealedData && sealedData.valid) {
      const vals = calcPhaseCurve(params, sealedData.Vb, sealedData.Fc, false, true);
      list.push({
        label: `${t("Fase Caja Sellada")} (°)`,
        data: frequencies.map((f, i) => ({
          x: f,
          y: vals[i] ?? 0
        })),
        borderColor: sealedBorderColor,
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false,
      });
    }
    if (portedData && portedData.valid) {
      const vals = calcPhaseCurve(params, portedData.Vb, portedData.Fb, true, true);
      list.push({
        label: `${t("Fase Caja Ventilada")} (°)`,
        data: frequencies.map((f, i) => ({
          x: f,
          y: vals[i] ?? 0
        })),
        borderColor: portedBorderColor,
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false,
      });
    }
    return list;
  }, [chartMode, sealedData, portedData, params, t]);

  const delayDatasets = React.useMemo(() => {
    if (chartMode !== 'delay') return [];
    const list: Record<string, unknown>[] = [];
    if (sealedData && sealedData.valid) {
      const delays = calcGroupDelayCurve(frequencies, params, sealedData.Vb, sealedData.Fc, false);
      list.push({
        label: `${t("Retardo Grupo Sellada")} (ms)`,
        data: frequencies.map((f, idx) => ({ x: f, y: delays[idx] })),
        borderColor: sealedBorderColor,
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false,
      });
    }
    if (portedData && portedData.valid) {
      const delays = calcGroupDelayCurve(frequencies, params, portedData.Vb, portedData.Fb, true);
      list.push({
        label: `${t("Retardo Grupo Ventilada")} (ms)`,
        data: frequencies.map((f, idx) => ({ x: f, y: delays[idx] })),
        borderColor: portedBorderColor,
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false,
      });
    }
    return list;
  }, [chartMode, sealedData, portedData, params, t]);

  const activeDatasets = React.useMemo(() => {
    switch (chartMode) {
      case 'excursion':
        return excursionDatasets;
      case 'velocity':
        return velocityDatasets;
      case 'impedance':
        return impedanceDatasets;
      case 'phase':
        return phaseDatasets;
      case 'delay':
        return delayDatasets;
      case 'spl':
      default:
        return rangeMode === 'bass' ? [
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
        ] : fullRangeDatasets;
    }
  }, [chartMode, rangeMode, sealedData, portedData, bandpassData, sealedPoints, portedPoints, bandpassPoints, fullRangeDatasets, excursionDatasets, velocityDatasets, impedanceDatasets, phaseDatasets, delayDatasets, t]);

  const data = {
    datasets: activeDatasets,
  };

  // Dynamic Y Axis parameters
  const yAxisConfig = React.useMemo(() => {
    switch (chartMode) {
      case 'excursion':
        return {
          min: 0,
          max: Math.max(12, Math.ceil(((params.xmax || 8) * 1.6) / 2) * 2),
          stepSize: 2,
          title: t('Desplazamiento Pico (mm)'),
          unit: 'mm',
        };
      case 'velocity':
        return {
          min: 0,
          max: 40,
          stepSize: 5,
          title: t('Velocidad del Aire (m/s)'),
          unit: 'm/s',
        };
      case 'impedance':
        return {
          min: 0,
          max: Math.max(30, Math.ceil(((params.re || 4) * 7) / 10) * 10),
          stepSize: 5,
          title: t('Impedancia (Ω)'),
          unit: 'Ω',
        };
      case 'phase':
        return {
          min: -180,
          max: 180,
          stepSize: 45,
          title: t('Fase Acústica (°)'),
          unit: '°',
        };
      case 'delay':
        return {
          min: 0,
          max: 40,
          stepSize: 5,
          title: t('Retardo de Grupo (ms)'),
          unit: 'ms',
        };
      case 'spl':
      default:
        return {
          min: dynamicMin,
          max: dynamicMax,
          stepSize: 3,
          title: t('Ganancia (dB)'),
          unit: 'dB',
        };
    }
  }, [chartMode, params.xmax, params.re, dynamicMin, dynamicMax, t]);

  const cadFontFamily = "'JetBrains Mono', 'Fira Code', 'Consolas', monospace";
  const isLight = theme === 'light';

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'logarithmic' as const,
        min: 10,
        max: (chartMode === 'spl' && rangeMode === 'full') ? 20000 : 500,
        grid: { color: isLight ? 'rgba(2, 132, 199, 0.14)' : 'rgba(56, 189, 248, 0.12)' },
        title: {
          display: true,
          text: t('Frecuencia (Hz)'),
          color: isLight ? '#0f172a' : '#bae6fd',
          font: { family: cadFontFamily, size: 11, weight: 700 },
        },
        ticks: {
          color: isLight ? '#334155' : '#93c5fd',
          font: { family: cadFontFamily, size: 10, weight: 600 },
          callback: function (value: string | number) {
            const targets = (chartMode === 'spl' && rangeMode === 'full')
              ? [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
              : [10, 20, 30, 50, 70, 100, 200, 300, 500];
            const numVal = Number(value);
            if (targets.includes(numVal)) {
              return numVal >= 1000 ? (numVal / 1000) + 'k' : String(numVal);
            }
            return null;
          },
        },
      },
      y: {
        min: yAxisConfig.min,
        max: yAxisConfig.max,
        grid: { color: isLight ? 'rgba(2, 132, 199, 0.14)' : 'rgba(56, 189, 248, 0.12)' },
        title: {
          display: true,
          text: yAxisConfig.title,
          color: isLight ? '#0f172a' : '#bae6fd',
          font: { family: cadFontFamily, size: 11, weight: 700 },
        },
        ticks: {
          color: isLight ? '#334155' : '#93c5fd',
          font: { family: cadFontFamily, size: 10, weight: 600 },
          stepSize: yAxisConfig.stepSize,
        },
      },
    },
    plugins: {
      legend: {
        labels: {
          usePointStyle: true,
          pointStyle: 'line' as const,
          color: isLight ? '#0f172a' : '#f1f5f9',
          font: { family: cadFontFamily, size: 11, weight: 700 },
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(6, 14, 29, 0.95)',
        titleColor: isLight ? '#0284c7' : '#38bdf8',
        bodyColor: isLight ? '#0f172a' : '#e0f2fe',
        titleFont: { family: cadFontFamily, size: 10, weight: 700 },
        bodyFont: { family: cadFontFamily, size: 9, weight: 600 },
        borderColor: isLight ? 'rgba(2, 132, 199, 0.45)' : 'rgba(56, 189, 248, 0.4)',
        borderWidth: 1,
        callbacks: {
          label: function (context: TooltipItem<'line'>) {
            const yVal = context.parsed.y !== null && context.parsed.y !== undefined ? context.parsed.y.toFixed(1) : '0.0';
            const xVal = context.parsed.x !== null && context.parsed.x !== undefined ? context.parsed.x : 0;
            return `${context.dataset.label}: ${yVal} ${yAxisConfig.unit} @ ${xVal >= 1000 ? (xVal/1000).toFixed(1)+'k' : xVal} Hz`;
          },
        },
      },
      lineAnnotation: {
        annotations: chartMode === 'spl' ? annotations : []
      },
      cadBlueprint: {
        theme
      }
    },
  };

  return (
    <div className="panel chart-card" style={{ display: 'flex', flexDirection: 'column', padding: '0.65rem 0.85rem' }}>
      {/* Header Superior con Selector de Modos y Controles */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.55rem', flexWrap: 'wrap', gap: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <h3 className="panel-title" style={{ margin: 0 }}>
            {chartMode === 'spl' && t("Simulación SPL (dB vs Hz)")}
            {chartMode === 'excursion' && t("Desplazamiento del Cono (mm vs Xmax)")}
            {chartMode === 'velocity' && t("Velocidad de Aire en Conducto (m/s)")}
            {chartMode === 'impedance' && t("Impedancia Eléctrica del Sistema (Ω)")}
            {chartMode === 'phase' && t("Respuesta de Fase Acústica (°)")}
            {chartMode === 'delay' && t("Retardo de Grupo (ms vs Hz)")}
          </h3>

          {/* Ajuste de Potencia Eléctrica */}
          {(chartMode === 'excursion' || chartMode === 'velocity') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--card-border)' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t("Potencia:")}</span>
              <input
                type="number"
                min="1"
                max="5000"
                value={simPower}
                onChange={(e) => setSimPower(Math.max(1, parseFloat(e.target.value) || 1))}
                style={{ width: '55px', height: '22px', fontSize: '0.72rem', background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--accent)', borderRadius: '4px', textAlign: 'center', fontWeight: 600 }}
              />
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>W</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Segmented range selector solo en modo SPL */}
          {chartMode === 'spl' && (
            <div className="segmented-control" style={{ display: 'inline-flex', width: 'auto' }}>
              <button
                type="button"
                className={rangeMode === 'bass' ? 'active' : ''}
                onClick={() => setRangeMode('bass')}
                style={{ flex: '0 0 auto', padding: '0 0.7rem', whiteSpace: 'nowrap' }}
              >
                {t("Graves")}
              </button>
              <button
                type="button"
                className={rangeMode === 'full' ? 'active' : ''}
                onClick={() => setRangeMode('full')}
                style={{ flex: '0 0 auto', padding: '0 0.7rem', whiteSpace: 'nowrap' }}
              >
                {t("Filtros / 20kHz")}
              </button>
            </div>
          )}

          {/* Toggle Reference Lines */}
          {chartMode === 'spl' && (
            <>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.72rem', color: 'var(--text-main)', cursor: 'pointer', margin: 0, fontWeight: 600, whiteSpace: 'nowrap' }} title="Difracción de bordes y transición Baffle Step 4pi a 2pi según ancho y alto del mueble">
                <input
                  type="checkbox"
                  checked={applyBaffleDiffraction}
                  onChange={(e) => setApplyBaffleDiffraction(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>{t("Baffle Step (Difracción)")}</span>
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.72rem', color: 'var(--text-main)', cursor: 'pointer', margin: 0, fontWeight: 600, whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={showRefLines}
                  onChange={(e) => setShowRefLines(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>{t("Líneas Ref.")}</span>
              </label>
            </>
          )}

          {/* Toggle Modelo Extendido en modo Impedancia */}
          {chartMode === 'impedance' && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.72rem', color: 'var(--text-main)', cursor: 'pointer', margin: 0, fontWeight: 600, whiteSpace: 'nowrap' }} title="Modelo extendido de Thorborg/Futtrup (semi-inductancia Ke, Leb, Rss) y viscoelasticidad de suspensión Knudsen LOG creep">
              <input
                type="checkbox"
                checked={useExtendedZ}
                onChange={(e) => setUseExtendedZ(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>{t("Modelo Extendido (Thorborg/Knudsen)")}</span>
            </label>
          )}
        </div>
      </div>

      {/* Barra de Modos de Simulación Avanzada */}
      <div className="segmented-control" style={{ marginBottom: '0.6rem', display: 'flex', flexWrap: 'wrap', gap: '3px', width: '100%' }}>
        <button
          type="button"
          className={chartMode === 'spl' ? 'active' : ''}
          onClick={() => setChartMode('spl')}
          title="Respuesta de Amplitud Normalizada en Frecuencia (dB)"
        >
          SPL (dB)
        </button>
        <button
          type="button"
          className={chartMode === 'excursion' ? 'active' : ''}
          onClick={() => setChartMode('excursion')}
          title="Desplazamiento pico del diafragma vs límite lineal Xmax (mm)"
        >
          Excursión (mm)
        </button>
        <button
          type="button"
          className={chartMode === 'velocity' ? 'active' : ''}
          onClick={() => setChartMode('velocity')}
          title="Velocidad del aire a través del conducto sintonizador (m/s)"
        >
          Velocidad Aire (m/s)
        </button>
        <button
          type="button"
          className={chartMode === 'impedance' ? 'active' : ''}
          onClick={() => setChartMode('impedance')}
          title="Curva de impedancia eléctrica del sistema de altavoz y caja (Ω)"
        >
          Impedancia (Ω)
        </button>
        <button
          type="button"
          className={chartMode === 'phase' ? 'active' : ''}
          onClick={() => setChartMode('phase')}
          title="Respuesta de fase acústica (grados)"
        >
          Fase (°)
        </button>
        <button
          type="button"
          className={chartMode === 'delay' ? 'active' : ''}
          onClick={() => setChartMode('delay')}
          title="Retardo de grupo en milisegundos (ms)"
        >
          Retardo Grupo (ms)
        </button>
      </div>

      <div className="chart-container" style={{ flex: 1, minHeight: '260px' }}>
        {data.datasets.length > 0 ? (
          <Line data={data as any} options={options as any} plugins={[cadBlueprintPlugin, lineAnnotationPlugin]} />
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
            {t("Completa los parámetros mínimos del altavoz (Fs, Vas, Qts).")}
          </div>
        )}
      </div>
    </div>
  );
};

export const SimulationChart = React.memo(SimulationChartComponent);

