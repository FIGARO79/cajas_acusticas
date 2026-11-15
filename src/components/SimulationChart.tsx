import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    ctx.font = "600 10.5px 'Inter', system-ui, -apple-system, sans-serif";

    const labelItems: Array<{
      ann: AnnotationOption;
      xLeft: number;
      boxW: number;
      boxH: number;
    }> = [];

    annotations.forEach((ann: AnnotationOption) => {
      const xVal = ann.value;
      if (xVal < x.min || xVal > x.max) return;

      const xPixel = x.getPixelForValue(xVal);

      // Draw vertical line
      ctx.beginPath();
      ctx.strokeStyle = ann.borderColor || '#ef4444';
      ctx.lineWidth = ann.borderWidth || 1.5;
      ctx.setLineDash(ann.borderDash ?? []);
      ctx.moveTo(xPixel, y.top);
      ctx.lineTo(xPixel, y.bottom);
      ctx.stroke();

      if (ann.label) {
        const boxW = ctx.measureText(ann.label).width + 10;
        const boxH = 16;
        const xLeft = Math.min(Math.max(x.left + 2, xPixel - boxW / 2), x.right - boxW - 2);
        labelItems.push({ ann, xLeft, boxW, boxH });
      }
    });

    // Colocar etiquetas en filas escalonadas cuando se traslapan horizontalmente
    labelItems.sort((a, b) => a.xLeft - b.xLeft);
    const rowRightEdges: number[] = [];

    ctx.setLineDash([]);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    labelItems.forEach(({ ann, xLeft, boxW, boxH }) => {
      let row = rowRightEdges.findIndex((rightEdge) => xLeft >= rightEdge + 4);
      if (row === -1) {
        row = rowRightEdges.length;
        rowRightEdges.push(xLeft + boxW);
      } else {
        rowRightEdges[row] = xLeft + boxW;
      }

      const boxY = y.top + 6 + row * (boxH + 3);
      ctx.fillStyle = ann.labelBgColor || 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(xLeft, boxY, boxW, boxH);

      ctx.fillStyle = ann.labelTextColor || '#ffffff';
      ctx.fillText(ann.label!, xLeft + boxW / 2, boxY + boxH / 2);
    });

    ctx.restore();
  }
};

// Plugin de Rejilla Técnica de Precisión (Pixel-Snapped Log/Linear Grid + Crosshair HUD)
const cadBlueprintPlugin = {
  id: 'cadBlueprint',
  beforeDraw: (chart: ChartJS) => {
    const { ctx, chartArea, scales: { x, y } } = chart;
    if (!chartArea || !x || !y) return;
    const { left, top, right, bottom, width, height } = chartArea;
    const snap = (v: number) => Math.round(v) + 0.5;

    ctx.save();
    // Fondo limpio de instrumento de medición
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(left, top, width, height);

    // Clip al área del gráfico para evitar desbordes
    ctx.beginPath();
    ctx.rect(left, top, width, height);
    ctx.clip();

    // 1. Subdivisiones logarítmicas secundarias (Hz)
    const minorFreqs = [
      15, 30, 40, 60, 70, 80, 90,
      150, 300, 400, 600, 700, 800, 900,
      1500, 3000, 4000, 6000, 7000, 8000, 9000, 15000,
    ];
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    minorFreqs.forEach((f) => {
      if (f > x.min && f < x.max) {
        const px = snap(x.getPixelForValue(f));
        if (px > left + 1 && px < right - 1) {
          ctx.moveTo(px, top);
          ctx.lineTo(px, bottom);
        }
      }
    });
    ctx.stroke();

    // 2. Subdivisiones horizontales intermedias (entre ticks de Y)
    if (y.ticks && y.ticks.length > 1) {
      ctx.strokeStyle = '#eef2f6';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < y.ticks.length - 1; i++) {
        const midVal = (y.ticks[i].value + y.ticks[i + 1].value) / 2;
        const py = snap(y.getPixelForValue(midVal));
        if (py > top + 1 && py < bottom - 1) {
          ctx.moveTo(left, py);
          ctx.lineTo(right, py);
        }
      }
      ctx.stroke();
    }

    // 3. Divisiones verticales principales (Hz)
    const majorFreqs = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    majorFreqs.forEach((f) => {
      if (f > x.min && f < x.max) {
        const px = snap(x.getPixelForValue(f));
        if (px > left + 1 && px < right - 1) {
          ctx.moveTo(px, top);
          ctx.lineTo(px, bottom);
        }
      }
    });
    ctx.stroke();

    // 4. Divisiones horizontales principales alineadas a los ticks del eje Y
    if (y.ticks && y.ticks.length > 0) {
      ctx.lineWidth = 1;
      y.ticks.forEach((tick) => {
        const py = snap(y.getPixelForValue(tick.value));
        if (py > top + 1 && py < bottom - 1) {
          ctx.strokeStyle = tick.value === 0 && y.min < 0 && y.max > 0
            ? '#94a3b8'
            : '#cbd5e1';
          ctx.beginPath();
          ctx.moveTo(left, py);
          ctx.lineTo(right, py);
          ctx.stroke();
        }
      });
    }

    ctx.restore();

    // 5. Marco perimetral nítido de 1px
    ctx.save();
    const x0 = snap(left);
    const y0 = snap(top);
    const x1 = snap(right);
    const y1 = snap(bottom);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
  },
  afterDraw: (chart: ChartJS) => {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const { left, top, right, bottom } = chartArea;
    const isLight = true;

    ctx.save();
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

        const pluginOpts = (chart.options.plugins as Record<string, { yUnit?: string }> | undefined)?.cadBlueprint;
        const yUnit = pluginOpts?.yUnit || '';
        const xNum = typeof activePoint.parsed.x === 'number' ? activePoint.parsed.x : 0;
        const yNum = typeof activePoint.parsed.y === 'number' ? activePoint.parsed.y : 0;
        const xLabel = xNum >= 1000 ? `${(xNum / 1000).toFixed(2)}k Hz` : `${xNum.toFixed(1)} Hz`;
        const yLabel = yUnit ? `${yNum.toFixed(1)} ${yUnit}` : `${yNum.toFixed(1)}`;

        ctx.font = "600 10px 'Inter', system-ui, -apple-system, sans-serif";

        // Etiqueta de escala en eje Y (borde izquierdo)
        const yPadX = 5;
        const yBadgeW = ctx.measureText(yLabel).width + yPadX * 2;
        const yBadgeH = 16;
        const yBadgeX = Math.max(2, left - yBadgeW - 2);
        const yBadgeY = Math.min(Math.max(top, py - yBadgeH / 2), bottom - yBadgeH);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(yBadgeX, yBadgeY, yBadgeW, yBadgeH);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(yLabel, yBadgeX + yBadgeW / 2, yBadgeY + yBadgeH / 2);

        // Etiqueta de escala en eje X (borde inferior)
        const xPadX = 6;
        const xBadgeW = ctx.measureText(xLabel).width + xPadX * 2;
        const xBadgeH = 16;
        const xBadgeX = Math.min(Math.max(left, px - xBadgeW / 2), right - xBadgeW);
        const xBadgeY = bottom + 2;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(xBadgeX, xBadgeY, xBadgeW, xBadgeH);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(xLabel, xBadgeX + xBadgeW / 2, xBadgeY + xBadgeH / 2);

        // Mini HUD digital CAD en esquina superior derecha
        const hudText = `${xLabel}  |  ${yLabel}`;
        ctx.font = "600 10.5px 'Inter', system-ui, -apple-system, sans-serif";
        const hudW = Math.max(150, ctx.measureText(hudText).width + 16);
        const hudH = 22;
        const hudX = right - hudW - 8;
        const hudY = top + 8;
        ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(6, 14, 29, 0.9)';
        ctx.strokeStyle = isLight ? 'rgba(2, 132, 199, 0.6)' : 'rgba(56, 189, 248, 0.5)';
        ctx.lineWidth = 1;
        ctx.fillRect(hudX, hudY, hudW, hudH);
        ctx.strokeRect(hudX, hudY, hudW, hudH);

        ctx.fillStyle = isLight ? '#0369a1' : '#38bdf8';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(hudText, hudX + 8, hudY + hudH / 2);
      }
    }
    ctx.restore();
  }
};

export type SimulationChartMode = 'spl' | 'excursion' | 'velocity' | 'impedance' | 'phase' | 'delay';

const ALL_QUAD_CHARTS: SimulationChartMode[] = ['spl', 'impedance', 'excursion', 'velocity', 'phase', 'delay'];
const DEFAULT_QUAD_CHARTS: SimulationChartMode[] = ['spl', 'impedance', 'excursion', 'velocity'];
const QUAD_CHARTS_STORAGE_KEY = 'cajas_sim_quad_charts_v1';

function loadSavedQuadCharts(): SimulationChartMode[] {
  try {
    const raw = localStorage.getItem(QUAD_CHARTS_STORAGE_KEY);
    if (!raw) return DEFAULT_QUAD_CHARTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_QUAD_CHARTS;
    const valid = ALL_QUAD_CHARTS.filter((m) => parsed.includes(m));
    return valid.length > 0 ? valid : DEFAULT_QUAD_CHARTS;
  } catch {
    return DEFAULT_QUAD_CHARTS;
  }
}

interface SimulationChartProps {
  lang: Lang;
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
  workspaceView?: 'split' | 'simulation' | 'cabinet' | 'crossover';
  setWorkspaceView?: (view: 'split' | 'simulation' | 'cabinet' | 'crossover') => void;
}

const SimulationChartComponent: React.FC<SimulationChartProps> = ({
  lang,
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
  workspaceView = 'split',
  setWorkspaceView,
}) => {
  const t = useCallback((text: string) => translate(text, lang), [lang]);

  // Si estamos en Modo Estudio ('split'), la vista es siempre Única (sin cuadrícula 2x2)
  const isStudioMode = workspaceView === 'split' || !workspaceView;

  // Acoustic Simulation Suite Mode
  const [chartMode, setChartMode] = useState<SimulationChartMode>('spl');
  const [displayLayout, setDisplayLayout] = useState<'quad' | 'single'>('quad');
  const [selectedQuadCharts, setSelectedQuadCharts] = useState<SimulationChartMode[]>(loadSavedQuadCharts);
  const effectiveDisplayLayout = isStudioMode ? 'single' : displayLayout;
  const [simPower, setSimPower] = useState<number>(params.pe || 100);
  const [enableSubsonic, setEnableSubsonic] = useState<boolean>(false);
  const [subsonicFreq, setSubsonicFreq] = useState<number>(() =>
    portedData && portedData.valid && portedData.Fb > 0
      ? Math.max(15, Math.round(portedData.Fb * 0.85))
      : 35
  );

  const recommendedSubsonicHz = useMemo(() => {
    if (portedData && portedData.valid && portedData.Fb > 0) {
      return Math.max(15, Math.round(portedData.Fb * 0.85));
    }
    return 35;
  }, [portedData]);

  const getSubsonicLinearGain = useCallback((f: number) => {
    if (!enableSubsonic || subsonicFreq <= 0) return 1;
    const r = f / subsonicFreq;
    const r4 = r * r * r * r;
    return r4 / Math.sqrt(1 + r4 * r4);
  }, [enableSubsonic, subsonicFreq]);

  useEffect(() => {
    try {
      localStorage.setItem(QUAD_CHARTS_STORAGE_KEY, JSON.stringify(selectedQuadCharts));
    } catch {
      // Ignore storage quota errors
    }
  }, [selectedQuadCharts]);

  const toggleQuadChart = useCallback((mode: SimulationChartMode) => {
    setSelectedQuadCharts((prev) => {
      if (prev.includes(mode)) {
        if (prev.length <= 1) return prev;
        return prev.filter((item) => item !== mode);
      }
      return ALL_QUAD_CHARTS.filter((item) => item === mode || prev.includes(item));
    });
  }, []);

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

    if (enableSubsonic && subsonicFreq > 0) {
      list.push({
        value: subsonicFreq,
        borderColor: '#a855f7',
        borderWidth: 1.5,
        borderDash: [3, 3],
        label: `HPF: ${subsonicFreq} Hz`
      });
    }

    return list;
  }, [showRefLines, rangeMode, sealedData, portedData, bandpassData, crossoverWays, fc, fcLow, fcHigh, enableSubsonic, subsonicFreq]);

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
    if (effectiveDisplayLayout === 'single' && chartMode !== 'excursion') return [];
    const list: Record<string, unknown>[] = [];
    if (sealedData && sealedData.valid) {
      const vals = calcExcursionCurve(params, sealedData.Vb, sealedData.Fc, false, simPower, true);
      list.push({
        label: `${t("Caja Sellada")} - Excursión (${simPower}W${enableSubsonic ? `, HPF ${subsonicFreq}Hz` : ''})`,
        data: frequencies.map((f, i) => ({
          x: f,
          y: (vals[i] ?? 0) * getSubsonicLinearGain(f)
        })),
        borderColor: sealedBorderColor,
        borderWidth: 2.2,
        pointRadius: 0,
        fill: false,
      });
    }
    if (portedData && portedData.valid) {
      const vals = calcExcursionCurve(params, portedData.Vb, portedData.Fb, true, simPower, true);
      list.push({
        label: `${t("Caja Ventilada")} - Excursión (${simPower}W${enableSubsonic ? `, HPF ${subsonicFreq}Hz` : ''})`,
        data: frequencies.map((f, i) => ({
          x: f,
          y: (vals[i] ?? 0) * getSubsonicLinearGain(f)
        })),
        borderColor: portedBorderColor,
        borderWidth: 2.2,
        pointRadius: 0,
        fill: false,
      });
    }
    if (params.xmax && params.xmax > 0) {
      list.push({
        label: `Xmax (${params.xmax} mm)`,
        data: frequencies.map(f => ({ x: f, y: params.xmax })),
        borderColor: '#ef4444',
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        borderDash: [5, 4]
      });
    }
    return list;
  }, [effectiveDisplayLayout, chartMode, sealedData, portedData, params, simPower, enableSubsonic, subsonicFreq, getSubsonicLinearGain, t]);

  const velocityDatasets = React.useMemo(() => {
    if (effectiveDisplayLayout === 'single' && chartMode !== 'velocity') return [];
    const list: Record<string, unknown>[] = [];
    const pArea = portAreaM2 || 0.0044;
    if (portedData && portedData.valid) {
      const vals = calcAirVelocityCurve(params, portedData.Vb, portedData.Fb, pArea, simPower, true);
      list.push({
        label: `${t("Velocidad Aire Puerto")} (${simPower}W${enableSubsonic ? `, HPF ${subsonicFreq}Hz` : ''})`,
        data: frequencies.map((f, i) => ({
          x: f,
          y: (vals[i] ?? 0) * getSubsonicLinearGain(f)
        })),
        borderColor: portedBorderColor,
        backgroundColor: chartPortedBg,
        borderWidth: 2.2,
        pointRadius: 0,
        fill: true,
      });
    }
    list.push({
      label: `Límite 5% c (17 m/s)`,
      data: frequencies.map(f => ({ x: f, y: 17 })),
      borderColor: '#f59e0b',
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
      borderDash: [4, 4]
    });
    list.push({
      label: `Límite 10% c (34 m/s)`,
      data: frequencies.map(f => ({ x: f, y: 34 })),
      borderColor: '#ef4444',
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
      borderDash: [6, 3]
    });
    return list;
  }, [effectiveDisplayLayout, chartMode, portedData, params, portAreaM2, simPower, enableSubsonic, subsonicFreq, getSubsonicLinearGain, t]);

  const subsonicAlert = React.useMemo(() => {
    if (!portedData || !portedData.valid || portedData.Fb <= 0) return null;
    const pArea = portAreaM2 || 0.0044;
    const velVals = calcAirVelocityCurve(params, portedData.Vb, portedData.Fb, pArea, simPower, true);
    const excVals = calcExcursionCurve(params, portedData.Vb, portedData.Fb, true, simPower, true);
    const gainFor = (f: number) => getSubsonicLinearGain(f);

    let maxVelBelowFb = 0;
    let maxExcBelowFb = 0;
    frequencies.forEach((f, idx) => {
      if (f < portedData.Fb) {
        const g = gainFor(f);
        maxVelBelowFb = Math.max(maxVelBelowFb, (velVals[idx] ?? 0) * g);
        maxExcBelowFb = Math.max(maxExcBelowFb, (excVals[idx] ?? 0) * g);
      }
    });

    const overVel = maxVelBelowFb > 17;
    const overExc = Boolean(params.xmax && params.xmax > 0 && maxExcBelowFb > params.xmax);
    if (!overVel && !overExc) return null;

    return {
      overVel,
      overExc,
      maxVelBelowFb,
      maxExcBelowFb,
      recommendedHz: recommendedSubsonicHz,
    };
  }, [portedData, portAreaM2, params, simPower, getSubsonicLinearGain, recommendedSubsonicHz]);

  const impedanceDatasets = React.useMemo(() => {
    if (effectiveDisplayLayout === 'single' && chartMode !== 'impedance') return [];
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
        label: `${t("Caja Sellada")}${useExtendedZ ? ' (Thorborg/Knudsen)' : ''} (Ω)`,
        data: frequencies.map((f, i) => ({
          x: f,
          y: vals[i] ?? 0
        })),
        borderColor: sealedBorderColor,
        borderWidth: 2.2,
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
        label: `${t("Caja Ventilada")}${useExtendedZ ? ' (Thorborg/Knudsen)' : ''} (Ω)`,
        data: frequencies.map((f, i) => ({
          x: f,
          y: vals[i] ?? 0
        })),
        borderColor: portedBorderColor,
        borderWidth: 2.2,
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
  }, [effectiveDisplayLayout, chartMode, sealedData, portedData, params, useExtendedZ, t]);

  const phaseDatasets = React.useMemo(() => {
    if (effectiveDisplayLayout === 'single' && chartMode !== 'phase') return [];
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
        borderWidth: 2.2,
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
        borderWidth: 2.2,
        pointRadius: 0,
        fill: false,
      });
    }
    return list;
  }, [effectiveDisplayLayout, chartMode, sealedData, portedData, params, t]);

  const delayDatasets = React.useMemo(() => {
    if (effectiveDisplayLayout === 'single' && chartMode !== 'delay') return [];
    const list: Record<string, unknown>[] = [];
    if (sealedData && sealedData.valid) {
      const delays = calcGroupDelayCurve(frequencies, params, sealedData.Vb, sealedData.Fc, false);
      list.push({
        label: `${t("Retardo Grupo Sellada")} (ms)`,
        data: frequencies.map((f, idx) => ({ x: f, y: delays[idx] })),
        borderColor: sealedBorderColor,
        borderWidth: 2.2,
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
        borderWidth: 2.2,
        pointRadius: 0,
        fill: false,
      });
    }
    return list;
  }, [effectiveDisplayLayout, chartMode, sealedData, portedData, params, t]);

  const splDatasets = React.useMemo(() => {
    if (rangeMode === 'bass') {
      return [
        ...(sealedData && sealedData.valid ? [{
          label: `${t("Caja Sellada")} (Vb ${sealedData.Vb.toFixed(1)}L, Qtc ${sealedData.Qtc.toFixed(2)})`,
          data: sealedPoints,
          borderColor: sealedBorderColor,
          backgroundColor: chartSealedBg,
          borderWidth: 2.2,
          pointRadius: 0,
          fill: true,
          tension: 0.2,
        }] : []),
        ...(portedData && portedData.valid ? [{
          label: `${t("Caja Ventilada")} (Vb ${portedData.Vb.toFixed(1)}L, Fb ${portedData.Fb.toFixed(1)}Hz)`,
          data: portedPoints,
          borderColor: portedBorderColor,
          backgroundColor: chartPortedBg,
          borderWidth: 2.2,
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
          borderWidth: 2.2,
          pointRadius: 0,
          fill: true,
          tension: 0.2,
        }] : []),
      ];
    }
    return fullRangeDatasets;
  }, [rangeMode, sealedData, portedData, bandpassData, sealedPoints, portedPoints, bandpassPoints, fullRangeDatasets, t]);

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
        return splDatasets;
    }
  }, [chartMode, splDatasets, excursionDatasets, velocityDatasets, impedanceDatasets, phaseDatasets, delayDatasets]);

  const getDatasetMaxY = (datasets: Record<string, unknown>[], minMax: number, roundStep: number) => {
    let maxVal = 0;
    for (const ds of datasets) {
      const pts = ds.data as Array<{ y: number }> | undefined;
      if (!pts) continue;
      for (const p of pts) {
        if (Number.isFinite(p.y) && p.y > maxVal) maxVal = p.y;
      }
    }
    if (maxVal <= 0) return minMax;
    const padded = maxVal * 1.08;
    return Math.max(minMax, Math.ceil(padded / roundStep) * roundStep);
  };

  const excursionMaxY = React.useMemo(
    () => getDatasetMaxY(excursionDatasets, Math.max(12, Math.ceil(((params.xmax || 8) * 1.6) / 2) * 2), 2),
    [excursionDatasets, params.xmax]
  );
  const velocityMaxY = React.useMemo(
    () => getDatasetMaxY(velocityDatasets, 40, 5),
    [velocityDatasets]
  );
  const impedanceMaxY = React.useMemo(
    () => getDatasetMaxY(impedanceDatasets, Math.max(30, Math.ceil(((params.re || 4) * 7) / 10) * 10), 10),
    [impedanceDatasets, params.re]
  );
  const delayMaxY = React.useMemo(
    () => getDatasetMaxY(delayDatasets, 40, 5),
    [delayDatasets]
  );

  // Dynamic Y Axis parameters
  const yAxisConfig = React.useMemo(() => {
    switch (chartMode) {
      case 'excursion':
        return {
          min: 0,
          max: excursionMaxY,
          stepSize: excursionMaxY > 24 ? 5 : 2,
          title: t('Desplazamiento Pico (mm)'),
          unit: 'mm',
        };
      case 'velocity':
        return {
          min: 0,
          max: velocityMaxY,
          stepSize: velocityMaxY > 60 ? 10 : 5,
          title: t('Velocidad del Aire (m/s)'),
          unit: 'm/s',
        };
      case 'impedance':
        return {
          min: 0,
          max: impedanceMaxY,
          stepSize: impedanceMaxY > 80 ? 10 : 5,
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
          max: delayMaxY,
          stepSize: delayMaxY > 60 ? 10 : 5,
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
  }, [chartMode, excursionMaxY, velocityMaxY, impedanceMaxY, delayMaxY, dynamicMin, dynamicMax, t]);

  const cadFontFamily = "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif";
  const isLight = true;

  const createChartOptions = useCallback((
    yMin: number,
    yMax: number,
    yStep: number,
    yTitle: string,
    yUnit: string,
    isCompact: boolean = false,
    annList: AnnotationOption[] = []
  ) => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      interaction: {
        mode: 'nearest' as const,
        axis: 'xy' as const,
        intersect: false,
      },
      hover: {
        mode: 'nearest' as const,
        axis: 'xy' as const,
        intersect: false,
      },
      scales: {
        x: {
          type: 'logarithmic' as const,
          min: 10,
          max: (chartMode === 'spl' && rangeMode === 'full' && !isCompact) ? 20000 : 500,
          grid: { display: false },
          border: { display: false },
          title: {
            display: !isCompact,
            text: t('Frecuencia (Hz)'),
            color: isLight ? '#0f172a' : '#bae6fd',
            font: { family: cadFontFamily, size: isCompact ? 10.5 : 12, weight: 700 },
          },
          ticks: {
            color: isLight ? '#1e293b' : '#93c5fd',
            font: { family: cadFontFamily, size: isCompact ? 10.5 : 11.5, weight: 600 },
            callback: function (value: string | number) {
              const targets = (chartMode === 'spl' && rangeMode === 'full' && !isCompact)
                ? [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
                : [10, 20, 50, 100, 200, 500];
              const numVal = Number(value);
              if (targets.includes(numVal)) {
                return numVal >= 1000 ? (numVal / 1000) + 'k' : String(numVal);
              }
              return null;
            },
          },
        },
        y: {
          min: yMin,
          max: yMax,
          grid: { display: false },
          border: { display: false },
          title: {
            display: !isCompact,
            text: yTitle,
            color: isLight ? '#0f172a' : '#bae6fd',
            font: { family: cadFontFamily, size: isCompact ? 10.5 : 12, weight: 700 },
          },
          ticks: {
            color: isLight ? '#1e293b' : '#93c5fd',
            font: { family: cadFontFamily, size: isCompact ? 10.5 : 11.5, weight: 600 },
            stepSize: yStep,
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            usePointStyle: true,
            pointStyle: 'line' as const,
            boxWidth: isCompact ? 16 : 24,
            color: isLight ? '#0f172a' : '#f1f5f9',
            font: { family: cadFontFamily, size: isCompact ? 11 : 12.5, weight: 600 },
            padding: isCompact ? 8 : 12,
          },
        },
        tooltip: {
          backgroundColor: isLight ? 'rgba(255, 255, 255, 0.97)' : 'rgba(6, 14, 29, 0.95)',
          titleColor: isLight ? '#0369a1' : '#38bdf8',
          bodyColor: isLight ? '#0f172a' : '#e0f2fe',
          titleFont: { family: cadFontFamily, size: isCompact ? 11 : 12, weight: 700 },
          bodyFont: { family: cadFontFamily, size: isCompact ? 10.5 : 11.5, weight: 500 },
          borderColor: isLight ? 'rgba(2, 132, 199, 0.45)' : 'rgba(56, 189, 248, 0.4)',
          borderWidth: 1,
          callbacks: {
            label: function (context: TooltipItem<'line'>) {
              const yVal = context.parsed.y !== null && context.parsed.y !== undefined ? context.parsed.y.toFixed(1) : '0.0';
              const xVal = context.parsed.x !== null && context.parsed.x !== undefined ? context.parsed.x : 0;
              return `${context.dataset.label}: ${yVal} ${yUnit} @ ${xVal >= 1000 ? (xVal/1000).toFixed(1)+'k' : xVal} Hz`;
            },
          },
        },
        cadBlueprint: {
          yUnit,
        },
        lineAnnotation: {
          annotations: annList
        }
      },
    };
  }, [chartMode, rangeMode, isLight, t, cadFontFamily]);

  const splOptionsQuad = useMemo(() => 
    createChartOptions(dynamicMin, dynamicMax, 3, t('Ganancia (dB)'), 'dB', true, annotations),
    [createChartOptions, dynamicMin, dynamicMax, annotations, t]
  );

  const impedanceOptionsQuad = useMemo(() => 
    createChartOptions(0, impedanceMaxY, impedanceMaxY > 80 ? 10 : 5, t('Impedancia (Ω)'), 'Ω', true, []),
    [createChartOptions, impedanceMaxY, t]
  );

  const excursionOptionsQuad = useMemo(() => 
    createChartOptions(0, excursionMaxY, excursionMaxY > 24 ? 5 : 2, t('Excursión (mm)'), 'mm', true, []),
    [createChartOptions, excursionMaxY, t]
  );

  const velocityOptionsQuad = useMemo(() => 
    createChartOptions(0, velocityMaxY, velocityMaxY > 60 ? 10 : 5, t('Velocidad (m/s)'), 'm/s', true, []),
    [createChartOptions, velocityMaxY, t]
  );

  const phaseOptionsQuad = useMemo(() =>
    createChartOptions(-180, 180, 45, t('Fase (°)'), '°', true, []),
    [createChartOptions, t]
  );

  const delayOptionsQuad = useMemo(() =>
    createChartOptions(0, delayMaxY, delayMaxY > 60 ? 10 : 5, t('Retardo (ms)'), 'ms', true, []),
    [createChartOptions, delayMaxY, t]
  );

  const quadChartItems = useMemo(() => ([
    {
      id: 'spl' as SimulationChartMode,
      shortLabel: t('SPL'),
      title: t('Respuesta SPL (dB vs Hz)'),
      color: '#0ea5e9',
      datasets: splDatasets,
      options: splOptionsQuad,
      plugins: [cadBlueprintPlugin, lineAnnotationPlugin],
    },
    {
      id: 'impedance' as SimulationChartMode,
      shortLabel: t('Impedancia'),
      title: t('Impedancia Eléctrica |Z| (Ω)'),
      color: '#10b981',
      datasets: impedanceDatasets,
      options: impedanceOptionsQuad,
      plugins: [cadBlueprintPlugin],
    },
    {
      id: 'excursion' as SimulationChartMode,
      shortLabel: t('Excursión'),
      title: t('Excursión de Cono (mm vs Xmax)'),
      color: '#f59e0b',
      datasets: excursionDatasets,
      options: excursionOptionsQuad,
      plugins: [cadBlueprintPlugin],
    },
    {
      id: 'velocity' as SimulationChartMode,
      shortLabel: t('Velocidad'),
      title: t('Velocidad de Aire en Conducto (m/s)'),
      color: '#ef4444',
      datasets: velocityDatasets,
      options: velocityOptionsQuad,
      plugins: [cadBlueprintPlugin],
    },
    {
      id: 'phase' as SimulationChartMode,
      shortLabel: t('Fase'),
      title: t('Fase Acústica (°)'),
      color: '#8b5cf6',
      datasets: phaseDatasets,
      options: phaseOptionsQuad,
      plugins: [cadBlueprintPlugin],
    },
    {
      id: 'delay' as SimulationChartMode,
      shortLabel: t('Retardo'),
      title: t('Retardo de Grupo (ms)'),
      color: '#06b6d4',
      datasets: delayDatasets,
      options: delayOptionsQuad,
      plugins: [cadBlueprintPlugin],
    },
  ]), [
    t,
    splDatasets, splOptionsQuad,
    impedanceDatasets, impedanceOptionsQuad,
    excursionDatasets, excursionOptionsQuad,
    velocityDatasets, velocityOptionsQuad,
    phaseDatasets, phaseOptionsQuad,
    delayDatasets, delayOptionsQuad,
  ]);

  const visibleQuadCharts = useMemo(
    () => quadChartItems.filter((item) => selectedQuadCharts.includes(item.id)),
    [quadChartItems, selectedQuadCharts]
  );

  const quadColsClass = visibleQuadCharts.length === 1
    ? 'cols-1'
    : visibleQuadCharts.length >= 5
      ? 'cols-3'
      : 'cols-2';

  const optionsSingle = useMemo(() => 
    createChartOptions(
      yAxisConfig.min,
      yAxisConfig.max,
      yAxisConfig.stepSize,
      yAxisConfig.title,
      yAxisConfig.unit,
      false,
      chartMode === 'spl' ? annotations : []
    ),
    [createChartOptions, yAxisConfig, chartMode, annotations]
  );

  return (
    <div className="panel chart-card" style={{ display: 'flex', flexDirection: 'column', padding: '0.4rem 0.65rem' }}>
      {/* CAD Dock Header */}
      <div className="cad-dock-header">
        <div className="cad-dock-title">
          <span className="cad-dock-icon">≡</span>
          <span>{effectiveDisplayLayout === 'quad' ? t("SIMULACIÓN ELECTROACÚSTICA MULTIPANEL") : t("SIMULACIÓN ELECTROACÚSTICA")}</span>
        </div>
        <div className="cad-dock-actions">
          {/* Switcher Cuadrícula vs Vista Única (Oculto en Modo Estudio) */}
          {!isStudioMode && (
            <div className="segmented-control" style={{ display: 'inline-flex', width: 'auto', padding: '1px' }}>
              <button
                type="button"
                className={displayLayout === 'quad' ? 'active' : ''}
                onClick={() => setDisplayLayout('quad')}
                title={t("Cuadrícula sincronizada personalizable (hasta 6 gráficas)")}
                style={{ padding: '0 0.5rem', fontSize: '0.67rem', height: '20px' }}
              >
                ⊞ {t("Cuadrícula")} ({selectedQuadCharts.length})
              </button>
              <button
                type="button"
                className={displayLayout === 'single' ? 'active' : ''}
                onClick={() => setDisplayLayout('single')}
                title={t("Vista maximizada de un solo gráfico")}
                style={{ padding: '0 0.5rem', fontSize: '0.67rem', height: '20px' }}
              >
                □ {t("Vista Única")}
              </button>
            </div>
          )}
          <span className="cad-dock-tag tag-primary">96 kHz</span>
        </div>
      </div>

      {/* Selector de Vista + Controles de Simulación (Potencia, Baffle Step, Extended Z, Líneas Ref.) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.35rem', paddingBottom: '0.35rem', borderBottom: '1px solid var(--card-border)' }}>
        {setWorkspaceView && (
          <div className="cad-ribbon-group">
            <span className="cad-ribbon-tag">{t("VISTA:")}</span>
            <div className="segmented-control" style={{ display: 'inline-flex', width: 'auto', padding: '1px' }}>
              <button
                type="button"
                className={workspaceView === 'split' ? 'active' : ''}
                onClick={() => setWorkspaceView('split')}
                style={{ flex: '0 0 auto', padding: '0 0.5rem', fontSize: '0.68rem', height: '20px' }}
                title={t("Estudio Completo Multi-Panel")}
              >
                {t("Estudio")}
              </button>
              <button
                type="button"
                className={workspaceView === 'simulation' ? 'active' : ''}
                onClick={() => setWorkspaceView('simulation')}
                style={{ flex: '0 0 auto', padding: '0 0.5rem', fontSize: '0.68rem', height: '20px' }}
                title={t("Simulación SPL/Z")}
              >
                {t("Simulación")}
              </button>
              <button
                type="button"
                className={workspaceView === 'cabinet' ? 'active' : ''}
                onClick={() => setWorkspaceView('cabinet')}
                style={{ flex: '0 0 auto', padding: '0 0.5rem', fontSize: '0.68rem', height: '20px' }}
                title={t("Gabinete 3D y Lista de Corte")}
              >
                {t("Gabinete 3D")}
              </button>
              <button
                type="button"
                className={workspaceView === 'crossover' ? 'active' : ''}
                onClick={() => setWorkspaceView('crossover')}
                style={{ flex: '0 0 auto', padding: '0 0.5rem', fontSize: '0.68rem', height: '20px' }}
                title={t("Crossover CAD Circuital")}
              >
                {t("Crossover")}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {/* Ajuste de Potencia Eléctrica */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--card-border)' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t("Potencia:")}</span>
            <input
              type="number"
              min="1"
              max="5000"
              value={simPower}
              onChange={(e) => setSimPower(Math.max(1, parseFloat(e.target.value) || 1))}
              style={{ width: '72px', height: '22px', padding: '0 4px', fontSize: '0.72rem', background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--accent)', borderRadius: '2px', textAlign: 'center', fontWeight: 600 }}
            />
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>W</span>
          </div>

          {/* Toggle Baffle Step */}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', color: 'var(--text-main)', cursor: 'pointer', margin: 0, fontWeight: 600 }} title="Difracción de bordes y transición Baffle Step 4pi a 2pi según ancho y alto del mueble (+6dB)">
            <input
              type="checkbox"
              checked={applyBaffleDiffraction}
              onChange={(e) => setApplyBaffleDiffraction(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>{t("Baffle Step (+6dB)")}</span>
          </label>

          {/* Toggle Modelo Extendido Z */}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', color: 'var(--text-main)', cursor: 'pointer', margin: 0, fontWeight: 600 }} title="Modelo extendido de Thorborg/Futtrup (semi-inductancia Ke, Leb, Rss) y viscoelasticidad de suspensión Knudsen LOG creep">
            <input
              type="checkbox"
              checked={useExtendedZ}
              onChange={(e) => setUseExtendedZ(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>{t("Modelo Extendido Z")}</span>
          </label>

          {/* Toggle Filtro Subsónico (24 dB/oct) */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.04)', padding: '2px 7px', borderRadius: '4px', border: '1px solid var(--card-border)' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: 'var(--text-main)', cursor: 'pointer', margin: 0, fontWeight: 600 }} title="Filtro pasa-altos subsónico 24 dB/oct para proteger excursión y velocidad debajo de Fb">
              <input
                type="checkbox"
                checked={enableSubsonic}
                onChange={(e) => {
                  const next = e.target.checked;
                  setEnableSubsonic(next);
                  if (next && (!subsonicFreq || subsonicFreq <= 0)) {
                    setSubsonicFreq(recommendedSubsonicHz);
                  }
                }}
                style={{ cursor: 'pointer' }}
              />
              <span>{t("Subsónico HPF")}</span>
            </label>
            {enableSubsonic && (
              <>
                <input
                  type="number"
                  min={10}
                  max={120}
                  step={1}
                  value={subsonicFreq}
                  onChange={(e) => setSubsonicFreq(Math.max(10, parseFloat(e.target.value) || 10))}
                  style={{ width: '48px', height: '20px', padding: '0 3px', fontSize: '0.7rem', background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--accent)', borderRadius: '2px', textAlign: 'center', fontWeight: 600 }}
                />
                <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>Hz</span>
              </>
            )}
          </div>

          {/* Toggle Líneas Ref */}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', color: 'var(--text-main)', cursor: 'pointer', margin: 0, fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={showRefLines}
              onChange={(e) => setShowRefLines(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>{t("Líneas Ref.")}</span>
          </label>
        </div>
      </div>

      {/* Alerta automática de Filtro Subsónico cuando se excede Xmax o 17 m/s debajo de Fb */}
      {subsonicAlert && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.6rem',
            flexWrap: 'wrap',
            padding: '0.3rem 0.6rem',
            marginBottom: '0.35rem',
            background: 'rgba(245, 158, 11, 0.10)',
            border: '1px solid rgba(245, 158, 11, 0.45)',
            fontSize: '0.7rem',
            color: 'var(--text-main)',
          }}
        >
          <span>
            <strong style={{ color: '#d97706' }}>{t("Filtro Subsónico Recomendado:")}</strong>{' '}
            {t("Debajo de Fb")} ({portedData?.Fb.toFixed(1)} Hz) {t("a")} {simPower}W{' '}
            {subsonicAlert.overExc && `${t("excede Xmax")} (${subsonicAlert.maxExcBelowFb.toFixed(1)} mm)`}
            {subsonicAlert.overExc && subsonicAlert.overVel && ' · '}
            {subsonicAlert.overVel && `${t("velocidad supera 17 m/s")} (${subsonicAlert.maxVelBelowFb.toFixed(1)} m/s)`}.{' '}
            {t("Sugerido:")} <strong>{subsonicAlert.recommendedHz} Hz (24 dB/oct)</strong>.
          </span>
          {!enableSubsonic && (
            <button
              type="button"
              onClick={() => {
                setSubsonicFreq(subsonicAlert.recommendedHz);
                setEnableSubsonic(true);
              }}
              style={{
                background: '#d97706',
                color: '#fff',
                border: 'none',
                padding: '0.18rem 0.5rem',
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t("Activar")} {subsonicAlert.recommendedHz} Hz
            </button>
          )}
        </div>
      )}

      {/* Controles de selección de gráficas en Modo Cuadrícula */}
      {effectiveDisplayLayout === 'quad' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t("Gráficas:")}</span>
            <div className="segmented-control" style={{ display: 'inline-flex', width: 'auto', padding: '1px' }}>
              {quadChartItems.map((chart) => {
                const isSelected = selectedQuadCharts.includes(chart.id);
                const isLastSelected = isSelected && selectedQuadCharts.length === 1;
                return (
                  <button
                    key={chart.id}
                    type="button"
                    className={isSelected ? 'active' : ''}
                    onClick={() => toggleQuadChart(chart.id)}
                    style={{ flex: '0 0 auto', padding: '0 0.5rem', fontSize: '0.68rem', height: '20px' }}
                    title={isLastSelected ? t("Debe quedar al menos 1 gráfica visible") : (isSelected ? t("Ocultar gráfica") : t("Mostrar gráfica"))}
                  >
                    {chart.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="segmented-control" style={{ display: 'inline-flex', width: 'auto', padding: '1px' }}>
            <button
              type="button"
              className={selectedQuadCharts.length === DEFAULT_QUAD_CHARTS.length && DEFAULT_QUAD_CHARTS.every((m) => selectedQuadCharts.includes(m)) ? 'active' : ''}
              onClick={() => setSelectedQuadCharts(DEFAULT_QUAD_CHARTS)}
              style={{ flex: '0 0 auto', padding: '0 0.5rem', fontSize: '0.68rem', height: '20px' }}
              title={t("Mostrar las 4 gráficas principales (2×2)")}
            >
              {t("2×2 (4)")}
            </button>
            <button
              type="button"
              className={selectedQuadCharts.length === ALL_QUAD_CHARTS.length ? 'active' : ''}
              onClick={() => setSelectedQuadCharts(ALL_QUAD_CHARTS)}
              style={{ flex: '0 0 auto', padding: '0 0.5rem', fontSize: '0.68rem', height: '20px' }}
              title={t("Mostrar las 6 gráficas simultáneamente")}
            >
              {t("Todas (6)")}
            </button>
          </div>
        </div>
      )}

      {/* Controles exclusivos de Vista Única */}
      {effectiveDisplayLayout === 'single' && (
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Segmented range selector solo en modo SPL */}
            {chartMode === 'spl' && (
              <div className="segmented-control" style={{ display: 'inline-flex', width: 'auto' }}>
                <button
                  type="button"
                  className={rangeMode === 'bass' ? 'active' : ''}
                  onClick={() => setRangeMode('bass')}
                  style={{ flex: '0 0 auto', padding: '0 0.5rem', fontSize: '0.68rem', height: '20px' }}
                >
                  {t("Graves")}
                </button>
                <button
                  type="button"
                  className={rangeMode === 'full' ? 'active' : ''}
                  onClick={() => setRangeMode('full')}
                  style={{ flex: '0 0 auto', padding: '0 0.5rem', fontSize: '0.68rem', height: '20px' }}
                >
                  {t("Filtros / 20kHz")}
                </button>
              </div>
            )}

            {/* Pestañas de modo de simulación en Vista Única */}
            <div className="segmented-control" style={{ display: 'inline-flex', width: 'auto' }}>
              <button
                type="button"
                className={chartMode === 'spl' ? 'active' : ''}
                onClick={() => setChartMode('spl')}
                style={{ padding: '0 0.5rem', fontSize: '0.68rem', height: '20px' }}
              >
                SPL
              </button>
              <button
                type="button"
                className={chartMode === 'impedance' ? 'active' : ''}
                onClick={() => setChartMode('impedance')}
                style={{ padding: '0 0.5rem', fontSize: '0.68rem', height: '20px' }}
              >
                Impedancia
              </button>
              <button
                type="button"
                className={chartMode === 'excursion' ? 'active' : ''}
                onClick={() => setChartMode('excursion')}
                style={{ padding: '0 0.5rem', fontSize: '0.68rem', height: '20px' }}
              >
                Excursión
              </button>
              <button
                type="button"
                className={chartMode === 'velocity' ? 'active' : ''}
                onClick={() => setChartMode('velocity')}
                style={{ padding: '0 0.5rem', fontSize: '0.68rem', height: '20px' }}
              >
                Velocidad
              </button>
              <button
                type="button"
                className={chartMode === 'phase' ? 'active' : ''}
                onClick={() => setChartMode('phase')}
                style={{ padding: '0 0.5rem', fontSize: '0.68rem', height: '20px' }}
              >
                Fase
              </button>
              <button
                type="button"
                className={chartMode === 'delay' ? 'active' : ''}
                onClick={() => setChartMode('delay')}
                style={{ padding: '0 0.5rem', fontSize: '0.68rem', height: '20px' }}
              >
                Retardo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENDER CONDICIONAL: CUADRÍCULA CONFIGURABLE vs VISTA ÚNICA */}
      {effectiveDisplayLayout === 'quad' ? (
        <div className={`cad-quad-grid ${quadColsClass}`}>
          {visibleQuadCharts.map((chart) => (
            <div key={chart.id} className="cad-quad-tile">
              <div className="cad-quad-tile-header">
                <span className="cad-quad-tile-title">
                  {chart.title}
                </span>
                <button
                  type="button"
                  className="cad-quad-tile-btn"
                  onClick={() => { setChartMode(chart.id); setDisplayLayout('single'); }}
                  title={t("Ampliar a vista detallada")}
                >
                  ⤢ {t("Ampliar")}
                </button>
              </div>
              <div className="cad-quad-canvas-wrap">
                <Line data={{ datasets: chart.datasets as any }} options={chart.options as any} plugins={chart.plugins} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* VISTA ÚNICA DETALLADA */
        <div
          className="chart-container"
          style={
            isStudioMode
              ? { flex: 'none', height: '285px', minHeight: '260px', marginBottom: '0.35rem' }
              : { flex: 1, minHeight: '420px', marginBottom: '0.5rem' }
          }
        >
          {activeDatasets.length > 0 ? (
            <Line
              key={`single-${workspaceView}`}
              data={{ datasets: activeDatasets as any }}
              options={optionsSingle as any}
              plugins={[cadBlueprintPlugin, lineAnnotationPlugin]}
            />
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
              {t("Completa los parámetros mínimos del altavoz (Fs, Vas, Qts).")}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const SimulationChart = React.memo(SimulationChartComponent);

