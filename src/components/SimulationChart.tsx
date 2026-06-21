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
import type { CalculatedSealed, CalculatedPorted, SpeakerParams } from '../types';
import { type Lang, translate } from '../utils/translations';
import { calcSealedCurve, calcPortedCurve } from '../wasm/index';

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

interface SimulationChartProps {
  lang: Lang;
  theme: 'dark' | 'light';
  sealedData: CalculatedSealed | null;
  portedData: CalculatedPorted | null;
  params: SpeakerParams;
}

export const SimulationChart: React.FC<SimulationChartProps> = ({
  lang,
  theme,
  sealedData,
  portedData,
  params,
}) => {
  const t = (text: string) => translate(text, lang);

  // Frequency points to evaluate
  const frequencies = (() => {
    const freqs: number[] = [];
    for (let i = 0; i <= 100; i++) {
      const f = 10 * Math.pow(500 / 10, i / 100);
      freqs.push(Math.round(f * 10) / 10);
    }
    return freqs;
  })();

  // State for curve points
  const [sealedPoints, setSealedPoints] = useState<{x:number,y:number}[]>([]);
  const [portedPoints, setPortedPoints] = useState<{x:number,y:number}[]>([]);

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
      setSealedPoints([]);
    }
    if (portedData) {
      calcPortedCurve(portedData, params).then(vals => {
        if (!cancelled) {
          const pts = vals.map((y:number, idx:number) => ({ x: frequencies[idx], y: Math.max(-35, y) }));
          setPortedPoints(pts);
        }
      });
    } else {
      setPortedPoints([]);
    }
    return () => { cancelled = true; };
  }, [sealedData, portedData, params]);

  // Encontrar el valor máximo de ganancia para evitar desbordes en el eje Y
  const allYValues = [...sealedPoints.map(p => p.y), ...portedPoints.map(p => p.y)];
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
  const sealedBorderColor = '#0ea5e9';
  const portedBorderColor = '#10b981';

  const data = {
    datasets: [
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
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'logarithmic' as const,
        min: 10,
        max: 500,
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
            if ([10, 20, 30, 50, 70, 100, 200, 300, 500].includes(value)) {
              return value + ' Hz';
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
          font: { family: 'Inter', size: 12 },
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
            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} dB ${t('a')} ${context.parsed.x} Hz`;
          },
        },
      },
    },
  };

  return (
    <div className="panel chart-card">
      <h3 className="panel-title">{t("Simulación de Respuesta en Frecuencia (dB vs Hz)")}</h3>
      <div className="chart-container">
        {data.datasets.length > 0 ? (
          <Line data={data} options={options} />
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
            {t("Completa los parámetros mínimos del altavoz (Fs, Vas, Qts).")}
          </div>
        )}
      </div>
    </div>
  );
};
