import { getWasm, dampingTypeToLevel, getBoxLosses, calcExtendedImpedanceCurveCustom } from '../wasm/index';
import { calcExcursionCurve, calcAirVelocityCurve, getKCorrection } from './acousticMath';
import { type Lang, translate } from './translations';
import { type UnitSystem, getUnitLabel } from './units';
import type {
  SpeakerParams,
  CalculatedSealed,
  CalculatedPorted,
  CalculatedBandpass,
  WoodCabinetData,
  CrossoverExportData,
  DampingType,
  PassiveRadiatorExportData,
} from '../types';

export interface ReportExtraData {
  driverName?: string;
  driverConfig?: string;
  powerW?: number;
  externalSubwoofer?: boolean;
  flaredEnds?: 0 | 1 | 2 | 3;
  useExtendedZ?: boolean;
}

export function generateReportHTML(
  lang: Lang,
  unitSystem: UnitSystem,
  params: SpeakerParams,
  boxType: 'sealed' | 'ported' | 'bandpass',
  sealedData: CalculatedSealed,
  portedData: CalculatedPorted,
  bandpassData: CalculatedBandpass | null,
  dampingType: DampingType,
  classicalModel: boolean,
  cabinetData: WoodCabinetData | null,
  xoverData: CrossoverExportData | null,
  portCount: number,
  portShape: 'round' | 'rectangular' | 'custom',
  portDiameter: number,
  portWidth: number,
  portHeight: number,
  portArea: number,
  pLen: string,
  vp: number | null,
  prData?: PassiveRadiatorExportData | null,
  extraData?: ReportExtraData | null
): string {
  const t = (text: string) => translate(text, lang);
  const dampingLevel = dampingTypeToLevel(dampingType);
  const isPassiveRadiator = boxType === 'ported' && prData?.prTuning === 'radiator';
  const activeVbRef = boxType === 'sealed'
    ? sealedData.Vb
    : boxType === 'ported'
      ? portedData.Vb
      : ((bandpassData?.Vf || 0) + (bandpassData?.Vr || 0));
  const boxLosses = getBoxLosses(activeVbRef || 40, dampingType, classicalModel);
  
  const formatNum = (val: number | string | null | undefined, decimals: number = 2, fallback: string = 'N/A'): string => {
    if (val === undefined || val === null || (typeof val === 'number' && isNaN(val))) return fallback;
    const num = typeof val === 'number' ? val : parseFloat(val);
    return isNaN(num) ? fallback : num.toFixed(decimals);
  };
  
  // 1. Obtener curvas mediante WASM síncrono si está disponible
  const sealedCurve: number[] = [];
  const portedCurve: number[] = [];
  const bandpassCurve: number[] = [];
  try {
    const wasm = getWasm();
    if (sealedData && sealedData.valid) {
      const res = wasm.calc_sealed_curve_ex(params.fs, params.qts, params.vas, sealedData.Vb, true, dampingLevel, classicalModel);
      res.forEach((v: number) => sealedCurve.push(v));
    }
    if (portedData && portedData.valid) {
      const res = (portedData.activeHpEnabled && portedData.hpFx && portedData.hpQx)
        ? wasm.calc_ported_b6_curve_ex(
            params.fs,
            params.qts,
            params.vas,
            portedData.Vb,
            portedData.Fb,
            portedData.hpFx,
            portedData.hpQx,
            true,
            dampingLevel,
            classicalModel
          )
        : wasm.calc_ported_curve_ex(params.fs, params.qts, params.vas, portedData.Vb, portedData.Fb, true, dampingLevel, classicalModel);
      res.forEach((v: number) => portedCurve.push(v));
    }
    if (boxType === 'bandpass' && bandpassData && bandpassData.valid) {
      const res = bandpassData.order === 4
        ? wasm.calc_bandpass4_curve_ex(
            params.fs,
            params.qts,
            params.vas,
            bandpassData.Vf,
            bandpassData.Vr,
            bandpassData.Fb,
            true,
            dampingLevel,
            classicalModel
          )
        : wasm.calc_bandpass6_curve_ex(
            params.fs,
            params.qts,
            params.vas,
            bandpassData.Vf,
            bandpassData.Vr,
            bandpassData.Fl || 0,
            bandpassData.Fh || 0,
            bandpassData.topology || 'parallel',
            true,
            dampingLevel,
            classicalModel
          );
      res.forEach((v: number) => bandpassCurve.push(v));
    }
  } catch (e) {
    console.error("WASM curves calculation error for report:", e);
  }

  // 2. Generar frecuencias (los mismos 101 puntos de 10Hz a 500Hz)
  const frequencies: number[] = [];
  for (let i = 0; i <= 100; i++) {
    const f = 10 * Math.pow(500 / 10, i / 100);
    frequencies.push(Math.round(f * 10) / 10);
  }

  // 3. Generar el path SVG para la gráfica
  // Rango X: logarítmico de 10 a 500 Hz.
  // Rango Y: lineal de -24 a +6 dB.
  const mapX = (f: number) => {
    const logMin = Math.log10(10);
    const logMax = Math.log10(500);
    const pct = (Math.log10(f) - logMin) / (logMax - logMin);
    return 50 + pct * 520; // 50px de margen izquierdo, 520px de ancho util
  };

  const mapY = (db: number) => {
    const minDb = -24;
    const maxDb = 6;
    const pct = (db - minDb) / (maxDb - minDb);
    return 220 - pct * 190; // 30px a 220px (190px de alto util), invertido para coordenadas SVG
  };

  let sealedPath = '';
  if (sealedCurve.length > 0) {
    sealedPath = sealedCurve.map((db, idx) => {
      const x = mapX(frequencies[idx]);
      const y = mapY(Math.max(-24, Math.min(6, db)));
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }

  let portedPath = '';
  if (portedCurve.length > 0) {
    portedPath = portedCurve.map((db, idx) => {
      const x = mapX(frequencies[idx]);
      const y = mapY(Math.max(-24, Math.min(6, db)));
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }

  let bandpassPath = '';
  if (bandpassCurve.length > 0) {
    bandpassPath = bandpassCurve.map((db, idx) => {
      const x = mapX(frequencies[idx]);
      const y = mapY(Math.max(-24, Math.min(6, db)));
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }

  // Líneas de grilla de frecuencia en 20, 50, 100, 200 Hz
  const gridFreqs = [20, 50, 100, 200];
  const freqGridLines = gridFreqs.map(f => {
    const x = mapX(f);
    return `<line x1="${x}" y1="30" x2="${x}" y2="220" stroke="rgba(0,0,0,0.1)" stroke-dasharray="2,2"/>
            <text x="${x}" y="235" font-size="9" text-anchor="middle" fill="#666">${f}Hz</text>`;
  }).join('\n');

  // Líneas de grilla de ganancia en 6, 0, -3, -6, -12, -18, -24 dB
  const gridDbs = [6, 0, -3, -6, -12, -18, -24];
  const dbGridLines = gridDbs.map(db => {
    const y = mapY(db);
    const stroke = db === 0 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)';
    const weight = db === 0 ? 'bold' : 'normal';
    return `<line x1="50" y1="${y}" x2="570" y2="${y}" stroke="${stroke}"/>
            <text x="45" y="${y + 3}" font-size="9" text-anchor="end" font-weight="${weight}" fill="#666">${db} dB</text>`;
  }).join('\n');

  const svgChart = `
    <svg viewBox="0 0 600 250" width="100%" height="auto" style="background:#fff; border:1px solid #ccc; border-radius:6px; font-family:sans-serif;">
      <!-- Grid -->
      ${freqGridLines}
      ${dbGridLines}
      
      <!-- Border -->
      <rect x="50" y="30" width="520" height="190" fill="none" stroke="#888" stroke-width="1"/>
      
      <!-- Curves -->
      ${sealedPath ? `<path d="${sealedPath}" fill="none" stroke="#0ea5e9" stroke-width="2.5" />` : ''}
      ${portedPath ? `<path d="${portedPath}" fill="none" stroke="#10b981" stroke-width="2.5" />` : ''}
      ${bandpassPath ? `<path d="${bandpassPath}" fill="none" stroke="#f59e0b" stroke-width="2.5" />` : ''}
      
      <!-- Legend -->
      <g transform="translate(60, 45)">
        ${sealedPath ? `
          <line x1="0" y1="0" x2="15" y2="0" stroke="#0ea5e9" stroke-width="3" />
          <text x="20" y="4" font-size="10" fill="#333">${t("Sellada")}</text>
        ` : ''}
        ${portedPath ? `
          <g transform="translate(100, 0)">
            <line x1="0" y1="0" x2="15" y2="0" stroke="#10b981" stroke-width="3" />
            <text x="20" y="4" font-size="10" fill="#333">${t("Ventilada")}</text>
          </g>
        ` : ''}
        ${bandpassPath ? `
          <g transform="translate(210, 0)">
            <line x1="0" y1="0" x2="15" y2="0" stroke="#f59e0b" stroke-width="3" />
            <text x="20" y="4" font-size="10" fill="#333">${bandpassData?.order === 6 ? (bandpassData.topology === 'series' ? t("Paso Banda 6.º Serie") : t("Paso Banda 6.º Paralelo")) : t("Paso Banda 4.º")}</text>
          </g>
        ` : ''}
      </g>
    </svg>
  `;

  // 4. Gráficas adicionales: Impedancia, Excursión y Velocidad del Aire
  const simPowerW = extraData?.powerW && extraData.powerW > 0 ? extraData.powerW : (params.pe && params.pe > 0 ? params.pe : 80);
  const useExtZ = extraData?.useExtendedZ ?? true;
  const activeVbForCurves = boxType === 'sealed' ? sealedData.Vb : portedData.Vb;
  const activeFbForCurves = boxType === 'sealed' ? sealedData.Fc : portedData.Fb;
  const isPortedActive = boxType === 'ported' && portedData.valid;

  let impedanceCurve: number[] = [];
  let excursionCurve: number[] = [];
  let velocityCurve: number[] = [];

  try {
    const wasm = getWasm();
    if ((boxType === 'sealed' && sealedData.valid) || isPortedActive) {
      if (useExtZ) {
        impedanceCurve = calcExtendedImpedanceCurveCustom(
          frequencies,
          params.fs || 35,
          params.qms || 3.5,
          params.qes || 0.38,
          params.re || 6.0,
          params.vas || 50,
          activeVbForCurves,
          activeFbForCurves,
          isPortedActive,
          params.le ? params.le * 0.7 : 0.5,
          0.8,
          35.0,
          0.015,
          true
        );
      } else {
        const res = wasm.calc_impedance_curve(
          params.fs, params.qts, params.qes || 0.4, params.qms || 4.0, params.vas,
          params.re || 6.0, params.le || 0.5, activeVbForCurves, activeFbForCurves, isPortedActive, true
        );
        res.forEach((v: number) => impedanceCurve.push(v));
      }

      excursionCurve = calcExcursionCurve(
        params,
        activeVbForCurves,
        activeFbForCurves,
        isPortedActive,
        simPowerW,
        true,
        dampingType,
        classicalModel
      );
    }

    if (isPortedActive && !isPassiveRadiator && portCount > 0) {
      const pDiaCm = portShape === 'round'
        ? portDiameter
        : portShape === 'custom'
          ? 2 * Math.sqrt(portArea / Math.PI)
          : 2 * Math.sqrt((portWidth * portHeight) / Math.PI);
      const areaM2 = pDiaCm > 0 ? portCount * Math.PI * Math.pow(pDiaCm / 200, 2) : 0;
      if (areaM2 > 0) {
        velocityCurve = calcAirVelocityCurve(
          params,
          portedData.Vb,
          portedData.Fb,
          areaM2,
          simPowerW,
          true,
          dampingType,
          classicalModel
        );
      }
    }
  } catch (e) {
    console.error("Extra charts calculation error for report:", e);
  }

  const buildMiniSvgChart = (
    values: number[],
    unit: string,
    color: string,
    yMaxRaw: number,
    refLines: Array<{ val: number; label: string; color: string }> = []
  ): string => {
    if (!values || values.length === 0) return '';
    const yMax = Math.max(yMaxRaw, 1);
    const mapYVal = (v: number) => 170 - (Math.min(yMax, Math.max(0, v)) / yMax) * 145;
    const pathD = values.map((v, idx) => {
      const x = mapX(frequencies[idx]);
      const y = mapYVal(v);
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => {
      const v = yMax * r;
      const y = mapYVal(v);
      return `<line x1="50" y1="${y.toFixed(1)}" x2="570" y2="${y.toFixed(1)}" stroke="rgba(0,0,0,0.08)"/>
              <text x="45" y="${(y + 3).toFixed(1)}" font-size="8.5" text-anchor="end" fill="#666">${v.toFixed(yMax >= 10 ? 0 : 1)}${unit}</text>`;
    }).join('\n');

    const xTicks = [20, 50, 100, 200].map((f) => {
      const x = mapX(f);
      return `<line x1="${x.toFixed(1)}" y1="25" x2="${x.toFixed(1)}" y2="170" stroke="rgba(0,0,0,0.08)" stroke-dasharray="2,2"/>
              <text x="${x.toFixed(1)}" y="184" font-size="8.5" text-anchor="middle" fill="#666">${f}Hz</text>`;
    }).join('\n');

    const refsSvg = refLines
      .filter((r) => r.val > 0 && r.val <= yMax)
      .map((r) => {
        const y = mapYVal(r.val);
        return `<line x1="50" y1="${y.toFixed(1)}" x2="570" y2="${y.toFixed(1)}" stroke="${r.color}" stroke-width="1.3" stroke-dasharray="4,3"/>
                <text x="565" y="${(y - 3).toFixed(1)}" font-size="8" text-anchor="end" fill="${r.color}" font-weight="bold">${r.label}</text>`;
      })
      .join('\n');

    return `
      <svg viewBox="0 0 600 198" width="100%" height="auto" style="background:#fff; border:1px solid #ccc; border-radius:6px; font-family:sans-serif;">
        ${xTicks}
        ${yTicks}
        <rect x="50" y="25" width="520" height="145" fill="none" stroke="#888" stroke-width="1"/>
        ${refsSvg}
        <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.2" />
      </svg>
    `;
  };

  const maxZ = impedanceCurve.length > 0 ? Math.ceil(Math.max(...impedanceCurve, 20) / 5) * 5 : 40;
  const svgImpedance = buildMiniSvgChart(
    impedanceCurve,
    'Ω',
    '#0284c7',
    maxZ,
    params.re ? [{ val: params.re, label: `Re ${params.re.toFixed(1)}Ω`, color: '#64748b' }] : []
  );

  const maxExc = excursionCurve.length > 0 ? Math.max(Math.ceil(Math.max(...excursionCurve) * 1.1), (params.xmax || 5) * 1.5, 4) : 10;
  const svgExcursion = buildMiniSvgChart(
    excursionCurve,
    'mm',
    '#10b981',
    maxExc,
    params.xmax ? [{ val: params.xmax, label: `Xmax ${params.xmax} mm`, color: '#ef4444' }] : []
  );

  const maxVel = velocityCurve.length > 0 ? Math.max(Math.ceil(Math.max(...velocityCurve) * 1.1), 22) : 25;
  const svgVelocity = buildMiniSvgChart(
    velocityCurve,
    'm/s',
    '#8b5cf6',
    maxVel,
    [
      { val: 17, label: '17 m/s (5% c)', color: '#f59e0b' },
      { val: 34, label: '34 m/s (10% c)', color: '#ef4444' },
    ]
  );

  // Datos físicos adicionales del puerto y driver
  const ebpVal = params.fs && params.qes ? params.fs / params.qes : null;
  const flaredVal = extraData?.flaredEnds ?? 0;
  const kCorrVal = getKCorrection(flaredVal);
  const flaredLabel = flaredVal === 0
    ? `${t("Recto / Estándar")} (k=${kCorrVal.toFixed(3)})`
    : flaredVal === 1
      ? `${t("Dos a Ras")} (k=${kCorrVal.toFixed(3)})`
      : flaredVal === 3
        ? `${t("Abocinado 1 Extremo")} (k=${kCorrVal.toFixed(3)})`
        : `${t("Abocinado 2 Extremos")} (k=${kCorrVal.toFixed(3)})`;
  const lvParsed = parseFloat(pLen);
  const pDiaEff = portShape === 'round'
    ? portDiameter
    : portShape === 'custom'
      ? 2 * Math.sqrt(portArea / Math.PI)
      : 2 * Math.sqrt((portWidth * portHeight) / Math.PI);
  const pipeResHz = (!isNaN(lvParsed) && lvParsed > 0 && pDiaEff > 0)
    ? Math.round(34400 / (2 * (lvParsed + kCorrVal * pDiaEff)))
    : null;
  const rearClearanceCm = (!isNaN(lvParsed) && lvParsed > 0 && cabinetData?.dInt && cabinetData.dInt > 0)
    ? (cabinetData.dInt - lvParsed)
    : null;

  // 4. Crossover (Zobel, Lpad)
  let crossoverHTML = '';
  if (xoverData && xoverData.xoverResults) {
    const { crossoverWays, crossoverType, fc, fcLow, fcHigh, enableZobel, enableLPad, xoverResults, zobelResults, lpadResults } = xoverData;
    
    let xoverDetails: string;
    if (xoverResults.ways === '1way') {
      const lp = xoverResults.lp;
      xoverDetails = `
        <div class="xover-box">
          <h4>${t("Vía de Graves / Subwoofer (Low Pass)")}</h4>
          <ul>
            ${lp.l1 !== undefined && lp.l1 !== null ? `<li>L1: <strong>${formatNum(lp.l1, 3)} mH</strong></li>` : ''}
            ${lp.l2 !== undefined && lp.l2 !== null ? `<li>L2: <strong>${formatNum(lp.l2, 3)} mH</strong></li>` : ''}
            ${lp.c1 !== undefined && lp.c1 !== null ? `<li>C1: <strong>${formatNum(lp.c1, 2)} µF</strong></li>` : ''}
            ${lp.c2 !== undefined && lp.c2 !== null ? `<li>C2: <strong>${formatNum(lp.c2, 2)} µF</strong></li>` : ''}
          </ul>
        </div>
      `;
    } else if (xoverResults.ways === '2way') {
      const hp = xoverResults.hp;
      const lp = xoverResults.lp;
      xoverDetails = `
        <div class="xover-box">
          <h4>${t("Vía de Agudos (High Pass)")}</h4>
          <ul>
            ${hp.c1 !== undefined && hp.c1 !== null ? `<li>C1: <strong>${formatNum(hp.c1, 2)} µF</strong></li>` : ''}
            ${hp.c2 !== undefined && hp.c2 !== null ? `<li>C2: <strong>${formatNum(hp.c2, 2)} µF</strong></li>` : ''}
            ${hp.l1 !== undefined && hp.l1 !== null ? `<li>L1: <strong>${formatNum(hp.l1, 3)} mH</strong></li>` : ''}
            ${hp.l2 !== undefined && hp.l2 !== null ? `<li>L2: <strong>${formatNum(hp.l2, 3)} mH</strong></li>` : ''}
          </ul>
        </div>
        <div class="xover-box">
          <h4>${t("Vía de Graves (Low Pass)")}</h4>
          <ul>
            ${lp.l1 !== undefined && lp.l1 !== null ? `<li>L1: <strong>${formatNum(lp.l1, 3)} mH</strong></li>` : ''}
            ${lp.l2 !== undefined && lp.l2 !== null ? `<li>L2: <strong>${formatNum(lp.l2, 3)} mH</strong></li>` : ''}
            ${lp.c1 !== undefined && lp.c1 !== null ? `<li>C1: <strong>${formatNum(lp.c1, 2)} µF</strong></li>` : ''}
            ${lp.c2 !== undefined && lp.c2 !== null ? `<li>C2: <strong>${formatNum(lp.c2, 2)} µF</strong></li>` : ''}
          </ul>
        </div>
      `;
    } else {
      const hp = xoverResults.hp;
      const bp = xoverResults.bp;
      const lp = xoverResults.lp;
      
      let hpList: string;
      let bpList: string;
      let lpList: string;

      if (crossoverType === '4th_lr') {
        hpList = `
          ${hp.c1 !== undefined && hp.c1 !== null ? `<li>C1: <strong>${formatNum(hp.c1, 2)} µF</strong></li>` : ''}
          ${hp.c2 !== undefined && hp.c2 !== null ? `<li>C2: <strong>${formatNum(hp.c2, 2)} µF</strong></li>` : ''}
          ${hp.l1 !== undefined && hp.l1 !== null ? `<li>L1: <strong>${formatNum(hp.l1, 3)} mH</strong></li>` : ''}
          ${hp.l2 !== undefined && hp.l2 !== null ? `<li>L2: <strong>${formatNum(hp.l2, 3)} mH</strong></li>` : ''}
        `;
        bpList = `
          <li style="list-style: none; font-weight: bold; margin: 3px 0; font-size: 0.85em; opacity: 0.85;">— ${t("Sección Paso Alto (fL)")} —</li>
          ${bp.c1_hp !== undefined && bp.c1_hp !== null ? `<li>C1_HP: <strong>${formatNum(bp.c1_hp, 2)} µF</strong></li>` : ''}
          ${bp.c2_hp !== undefined && bp.c2_hp !== null ? `<li>C2_HP: <strong>${formatNum(bp.c2_hp, 2)} µF</strong></li>` : ''}
          ${bp.l1_hp !== undefined && bp.l1_hp !== null ? `<li>L1_HP: <strong>${formatNum(bp.l1_hp, 3)} mH</strong></li>` : ''}
          ${bp.l2_hp !== undefined && bp.l2_hp !== null ? `<li>L2_HP: <strong>${formatNum(bp.l2_hp, 3)} mH</strong></li>` : ''}
          
          <li style="list-style: none; font-weight: bold; margin: 8px 0 3px 0; font-size: 0.85em; opacity: 0.85;">— ${t("Sección Paso Bajo (fH)")} —</li>
          ${bp.l1_lp !== undefined && bp.l1_lp !== null ? `<li>L1_LP: <strong>${formatNum(bp.l1_lp, 3)} mH</strong></li>` : ''}
          ${bp.l2_lp !== undefined && bp.l2_lp !== null ? `<li>L2_LP: <strong>${formatNum(bp.l2_lp, 3)} mH</strong></li>` : ''}
          ${bp.c1_lp !== undefined && bp.c1_lp !== null ? `<li>C1_LP: <strong>${formatNum(bp.c1_lp, 2)} µF</strong></li>` : ''}
          ${bp.c2_lp !== undefined && bp.c2_lp !== null ? `<li>C2_LP: <strong>${formatNum(bp.c2_lp, 2)} µF</strong></li>` : ''}
        `;
        lpList = `
          ${lp.l1 !== undefined && lp.l1 !== null ? `<li>L1: <strong>${formatNum(lp.l1, 3)} mH</strong></li>` : ''}
          ${lp.l2 !== undefined && lp.l2 !== null ? `<li>L2: <strong>${formatNum(lp.l2, 3)} mH</strong></li>` : ''}
          ${lp.c1 !== undefined && lp.c1 !== null ? `<li>C1: <strong>${formatNum(lp.c1, 2)} µF</strong></li>` : ''}
          ${lp.c2 !== undefined && lp.c2 !== null ? `<li>C2: <strong>${formatNum(lp.c2, 2)} µF</strong></li>` : ''}
        `;
      } else {
        hpList = `
          ${hp.c1 !== undefined && hp.c1 !== null ? `<li>C1: <strong>${formatNum(hp.c1, 2)} µF</strong></li>` : ''}
          ${hp.l1 !== undefined && hp.l1 !== null ? `<li>L1: <strong>${formatNum(hp.l1, 3)} mH</strong></li>` : ''}
        `;
        bpList = `
          ${bp.c_hp !== undefined && bp.c_hp !== null ? `<li>C_HP (Serie): <strong>${formatNum(bp.c_hp, 2)} µF</strong></li>` : ''}
          ${bp.c1_hp !== undefined && bp.c1_hp !== null ? `<li>C1_HP (Serie): <strong>${formatNum(bp.c1_hp, 2)} µF</strong></li>` : ''}
          ${bp.l_lp !== undefined && bp.l_lp !== null ? `<li>L_LP (Serie): <strong>${formatNum(bp.l_lp, 3)} mH</strong></li>` : ''}
          ${bp.l1_lp !== undefined && bp.l1_lp !== null ? `<li>L1_LP (Serie): <strong>${formatNum(bp.l1_lp, 3)} mH</strong></li>` : ''}
          ${bp.l_hp !== undefined && bp.l_hp !== null ? `<li>L_HP (Paralelo): <strong>${formatNum(bp.l_hp, 3)} mH</strong></li>` : ''}
          ${bp.c_lp !== undefined && bp.c_lp !== null ? `<li>C_LP (Paralelo): <strong>${formatNum(bp.c_lp, 2)} µF</strong></li>` : ''}
        `;
        lpList = `
          ${lp.l1 !== undefined && lp.l1 !== null ? `<li>L1: <strong>${formatNum(lp.l1, 3)} mH</strong></li>` : ''}
          ${lp.c1 !== undefined && lp.c1 !== null ? `<li>C1: <strong>${formatNum(lp.c1, 2)} µF</strong></li>` : ''}
        `;
      }

      xoverDetails = `
        <div class="xover-box">
          <h4>${t("Vía de Agudos (High Pass)")}</h4>
          <ul>${hpList}</ul>
        </div>
        <div class="xover-box">
          <h4>${t("Vía de Medios (Band Pass)")}</h4>
          <ul>${bpList}</ul>
        </div>
        <div class="xover-box">
          <h4>${t("Vía de Graves (Low Pass)")}</h4>
          <ul>${lpList}</ul>
        </div>
      `;
    }

    let extraNetworks = '';
    if (enableZobel && zobelResults) {
      extraNetworks += `
        <div class="xover-box highlight">
          <h4>${t("Red Zobel")}</h4>
          <ul>
            <li>Cz: <strong>${formatNum(zobelResults.cz, 2)} µF</strong></li>
            <li>Rz: <strong>${formatNum(zobelResults.rz, 2)} Ω</strong></li>
          </ul>
        </div>
      `;
    }
    if (enableLPad && lpadResults && crossoverWays !== '1way') {
      extraNetworks += `
        <div class="xover-box highlight">
          <h4>${t("Atenuador L-Pad")}</h4>
          <ul>
            <li>R1 (Serie): <strong>${formatNum(lpadResults.r1, 2)} Ω</strong></li>
            <li>R2 (Paralelo): <strong>${formatNum(lpadResults.r2, 2)} Ω</strong></li>
          </ul>
        </div>
      `;
    }

    crossoverHTML = `
      <div class="section-title">${t("Divisor de Frecuencias (Crossover)")}</div>
      <div class="grid">
        <div class="card">
          <h3>${t("Configuración y Componentes")}</h3>
          <p><strong>${t("Vías")}:</strong> ${crossoverWays === '1way' ? t("Subwoofer (1 Vía)") : crossoverWays === '2way' ? t("2 Vías") : t("3 Vías")}</p>
          <p><strong>${t("Tipo de filtro")}:</strong> ${crossoverType === '1st_order' ? t("1er Orden") : crossoverType === '2nd_butter' ? t("2do Orden Butterworth") : crossoverType === '2nd_lr' ? t("2do Orden Linkwitz-Riley") : t("4to Orden Linkwitz-Riley")}</p>
          <p><strong>${t("Frecuencia(s) de Cruce")}:</strong> ${crossoverWays === '3way' ? `${fcLow} Hz / ${fcHigh} Hz` : crossoverWays === '1way' ? `${fc} Hz (LPF)` : `${fc} Hz`}</p>
          <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:15px;">
            ${xoverDetails}
            ${extraNetworks}
          </div>
        </div>
      </div>
    `;
  }

  // 5. Ebanistería y Relleno
  let woodDetailsHTML = '';
  if (cabinetData && cabinetData.valid) {
    const isRect = !cabinetData.dTrapTopExt;
    woodDetailsHTML = `
      <div class="section-title">${t("Dimensiones y Corte de Madera")}</div>
      <div class="grid">
        <div class="card">
          <h3>${t("Ebanistería")}</h3>
          <p><strong>${t("Forma de la caja")}:</strong> ${isRect ? t("Rectangular") : t("Trapezoidal")}</p>
          <p><strong>${t("Grosor de madera")}:</strong> ${cabinetData.thickness} mm</p>
          <p><strong>${t("Volumen neto")}:</strong> ${formatNum(cabinetData.vNeto, 2)} L</p>
          <p><strong>${t("Volumen bruto")}:</strong> ${formatNum(cabinetData.vTotal, 2)} L</p>
          <p><strong>${t("Dimensiones externas")}:</strong></p>
          <ul>
            ${isRect ? `
              <li>${t("Alto")}: ${formatNum(cabinetData.hExt, 1)} cm</li>
              <li>${t("Ancho")}: ${formatNum(cabinetData.wExt, 1)} cm</li>
              <li>${t("Profundidad")}: ${formatNum(cabinetData.dExt, 1)} cm</li>
            ` : `
              <li>${t("Alto")}: ${formatNum(cabinetData.hExt, 1)} cm</li>
              <li>${t("Ancho")}: ${formatNum(cabinetData.wExt, 1)} cm</li>
              <li>${t("Prof. Superior")}: ${formatNum(cabinetData.dTrapTopExt, 1)} cm</li>
              <li>${t("Prof. Inferior")}: ${formatNum(cabinetData.dTrapBotExt, 1)} cm</li>
            `}
          </ul>
        </div>
        <div class="card">
          <h3>${t("Relleno Acústico (Damping)")}</h3>
          <p><strong>${t("Modelo activo")}:</strong> ${classicalModel ? t("Clásico (sin ajuste térmico)") : t("Avanzado (absorción Qa y fugas QL)")}</p>
          <p><strong>${t("Tipo de relleno")}:</strong> ${
            dampingType === 'none' ? t("Sin Relleno") :
            dampingType === 'light' ? t("Relleno Leve (Damping de Paredes)") :
            dampingType === 'moderate' ? t("Relleno Moderado (Fibra Suelta)") :
            t("Relleno Denso (Fibra Uniforme)")
          }</p>
          <p><strong>${t("Aumento virtual de volumen")}:</strong> ${classicalModel || dampingType === 'none' ? '0%' : dampingType === 'light' ? '+5%' : dampingType === 'moderate' ? '+12%' : '+20%'}</p>
          <p><strong>${t("Pérdidas de recinto")}:</strong> QL = ${formatNum(boxLosses.ql, 1)} · ${classicalModel ? 'Qa = ∞' : `Qa = ${formatNum(boxLosses.qa, 0)}`} · Qb = ${formatNum(boxLosses.qb, 2)}</p>
        </div>
      </div>
    `;
  }

  const uVol = getUnitLabel('volume', unitSystem);

  return `
    <!DOCTYPE html>
    <html lang="${lang}">
    <head>
      <meta charset="UTF-8">
      <title>${t("Ficha Técnica del Bafle")}</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          color: #1e293b;
          margin: 0;
          padding: 30px;
          line-height: 1.5;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 10px;
          margin-bottom: 25px;
        }
        .header h1 {
          margin: 0;
          font-size: 22px;
          color: #0f172a;
        }
        .header p {
          margin: 5px 0 0 0;
          color: #64748b;
          font-size: 13px;
        }
        .section-title {
          font-size: 15px;
          font-weight: bold;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 5px;
          margin-top: 25px;
          margin-bottom: 15px;
          color: #0f172a;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .grid {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          margin-bottom: 15px;
        }
        .card {
          flex: 1;
          min-width: 250px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 15px;
          background-color: #f8fafc;
        }
        .card h3 {
          margin-top: 0;
          margin-bottom: 10px;
          font-size: 14px;
          color: #0f172a;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 5px;
        }
        .card p, .card li {
          font-size: 13px;
          margin: 5px 0;
        }
        .card ul {
          padding-left: 20px;
          margin: 5px 0;
        }
        .xover-box {
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          padding: 8px 12px;
          background-color: #fff;
          font-size: 12px;
          min-width: 140px;
          flex: 1;
        }
        .xover-box h4 {
          margin: 0 0 5px 0;
          font-size: 12px;
          color: #334155;
        }
        .xover-box.highlight {
          border-color: #bae6fd;
          background-color: #f0f9ff;
        }
        .chart-container {
          margin-top: 15px;
          margin-bottom: 20px;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 11px;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
          padding-top: 10px;
        }
        @media print {
          body {
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
          .card {
            background-color: #fff !important;
            border: 1px solid #ccc !important;
          }
        }
        .btn-print {
          display: inline-block;
          background-color: #0f172a;
          color: #fff;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: bold;
          border-radius: 4px;
          text-decoration: none;
          cursor: pointer;
          border: none;
          margin-bottom: 20px;
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="text-align: right;">
        <button class="btn-print" onclick="window.print()">${t("Imprimir / Guardar PDF")}</button>
      </div>

      <div class="header">
        <h1>${t("Reporte Técnico de Diseño de Caja Acústica")}</h1>
        <p>${extraData?.driverName ? `<strong>${extraData.driverName}</strong> · ` : ''}${t("Generado automáticamente")} - ${new Date().toLocaleDateString()}</p>
      </div>

      <div class="section-title">${t("Parámetros del Altavoz")}</div>
      <div class="grid">
        <div class="card">
          <h3>${t("Especificaciones T&S")}</h3>
          ${extraData?.driverName ? `<p><strong>${t("Altavoz")}:</strong> ${extraData.driverName}</p>` : ''}
          <p><strong>Fs:</strong> ${params.fs} Hz &nbsp;|&nbsp; <strong>Qts:</strong> ${params.qts}</p>
          <p><strong>Vas:</strong> ${params.vas} ${uVol}${ebpVal ? ` &nbsp;|&nbsp; <strong>EBP:</strong> ${ebpVal.toFixed(1)}` : ''}</p>
          ${params.qes || params.qms ? `<p>${params.qes ? `<strong>Qes:</strong> ${params.qes}` : ''}${params.qes && params.qms ? ' &nbsp;|&nbsp; ' : ''}${params.qms ? `<strong>Qms:</strong> ${params.qms}` : ''}</p>` : ''}
          ${params.re || params.le ? `<p>${params.re ? `<strong>Re:</strong> ${params.re} Ω` : ''}${params.re && params.le ? ' &nbsp;|&nbsp; ' : ''}${params.le ? `<strong>Le:</strong> ${params.le} mH` : ''}</p>` : ''}
          ${params.sd || params.xmax ? `<p>${params.sd ? `<strong>Sd:</strong> ${params.sd} cm²` : ''}${params.sd && params.xmax ? ' &nbsp;|&nbsp; ' : ''}${params.xmax ? `<strong>Xmax:</strong> ${params.xmax} mm` : ''}</p>` : ''}
          ${params.sens || params.pe ? `<p>${params.sens ? `<strong>${t("Sensibilidad")}:</strong> ${params.sens} dB (1W/1m)` : ''}${params.sens && params.pe ? ' &nbsp;|&nbsp; ' : ''}${params.pe ? `<strong>Pe (RMS):</strong> ${params.pe} W` : ''}</p>` : ''}
          ${params.bl || params.mms ? `<p>${params.bl ? `<strong>Bl:</strong> ${params.bl} T·m` : ''}${params.bl && params.mms ? ' &nbsp;|&nbsp; ' : ''}${params.mms ? `<strong>Mms:</strong> ${params.mms} g` : ''}</p>` : ''}
        </div>
        <div class="card">
          <h3>${t("Alineación y Caja Sugerida")}</h3>
          <p><strong>${t("Tipo de caja")}:</strong> ${
            boxType === 'sealed'
              ? t("Sellada")
              : boxType === 'bandpass'
                ? (bandpassData?.order === 6
                    ? (bandpassData.topology === 'series' ? t("Paso Banda 6.º Orden Serie") : t("Paso Banda 6.º Orden Paralelo"))
                    : t("Paso Banda 4.º Orden"))
                : (isPassiveRadiator ? t("Radiador Pasivo") : t("Ventilada"))
          }</p>
          ${boxType === 'sealed' 
            ? `
              <p><strong>Vb:</strong> ${formatNum(sealedData.Vb, 1)} ${uVol}</p>
              <p><strong>Qtc:</strong> ${formatNum(sealedData.Qtc, 3)}</p>
              <p><strong>Fc:</strong> ${formatNum(sealedData.Fc, 1)} Hz</p>
              <p><strong>F3:</strong> ${formatNum(sealedData.F3, 1)} Hz</p>
            ` : boxType === 'bandpass' && bandpassData
            ? `
              <p><strong>${t("Orden y Topología")}:</strong> ${bandpassData.order === 6 ? (bandpassData.topology === 'series' ? t("6.º Orden Serie (Vr → Vf → Ext)") : t("6.º Orden Paralelo (Vr → Ext, Vf → Ext)")) : t("4.º Orden (Vr Sellada + Vf Ventilada)")}</p>
              <p><strong>Vr (${t("Cámara Trasera")}):</strong> ${formatNum(bandpassData.Vr, 1)} ${uVol}</p>
              <p><strong>Vf (${t("Cámara Frontal")}):</strong> ${formatNum(bandpassData.Vf, 1)} ${uVol}</p>
              ${bandpassData.order === 4
                ? `
                  <p><strong>Fb / F0:</strong> ${formatNum(bandpassData.Fb, 1)} Hz</p>
                  ${bandpassData.delta_f ? `<p><strong>Δf:</strong> ${formatNum(bandpassData.delta_f, 1)} Hz</p>` : ''}
                ` : `
                  <p><strong>Fl (${t("Sintonía Baja")}):</strong> ${formatNum(bandpassData.Fl, 1)} Hz</p>
                  <p><strong>Fh (${t("Sintonía Alta")}):</strong> ${formatNum(bandpassData.Fh, 1)} Hz</p>
                `
              }
            ` : `
              <p><strong>${t("Alineación")}:</strong> ${portedData.alignment || 'N/A'}${portedData.clampedToMinVol ? ` (${t("Ajustado a volumen físico mínimo")})` : ''}</p>
              <p><strong>Vb:</strong> ${formatNum(portedData.Vb, 1)} ${uVol}</p>
              <p><strong>Fb (${t("Sintonía")}):</strong> ${formatNum(portedData.Fb, 1)} Hz</p>
              <p><strong>F3:</strong> ${formatNum(portedData.F3, 1)} Hz</p>
              <p><strong>${t("Damping / Relleno")}:</strong> ${dampingType} (QL: ${formatNum(boxLosses.ql, 1)})</p>
              ${extraData?.externalSubwoofer ? `<p><strong>${t("Modo")}:</strong> ${t("Refuerzo con Subwoofer Externo (Satélite)")}</p>` : ''}
              ${portedData.activeHpEnabled && portedData.hpFx ? `
                <p><strong>${t("Filtro Activo Paso-Alto B6")}:</strong> 2.º Orden · Fx = ${formatNum(portedData.hpFx, 1)} Hz · Qx = ${formatNum(portedData.hpQx, 2)}</p>
              ` : ''}
            `
          }
        </div>
      </div>

      ${boxType === 'ported' && isPassiveRadiator && prData ? `
        <div class="section-title">${t("Radiador Pasivo (Sintonía sin Puerto)")}</div>
        <div class="grid">
          <div class="card">
            <h3>${t("Especificaciones del Radiador Pasivo")}</h3>
            <p><strong>${t("Diámetro")}:</strong> ${formatNum(prData.prDia, 1)} cm (${formatNum(prData.prDia / 2.54, 1)}")</p>
            <p><strong>Vas (PR):</strong> ${formatNum(prData.prVas, 1)} ${uVol}</p>
            <p><strong>Fs (PR):</strong> ${formatNum(prData.prFs, 1)} Hz</p>
            <p><strong>Mms (PR):</strong> ${formatNum(prData.prMms, 1)} g</p>
            <p><strong>${t("Fb Natural Resultante")}:</strong> ${formatNum(prData.prFbNatural, 1)} Hz</p>
            <p><strong>${t("Masa Añadida Requerida")}:</strong> ${formatNum(prData.prMasaAnadidaG, 1)} g</p>
          </div>
        </div>
      ` : boxType === 'ported' ? `
        <div class="section-title">${t("Conducto de Sintonía (Puerto)")}</div>
        <div class="grid">
          <div class="card">
            <h3>${t("Detalles del Puerto")}</h3>
            <p><strong>${t("Cantidad")}:</strong> ${portCount}</p>
            <p><strong>${t("Forma del puerto")}:</strong> ${
              portShape === 'round' ? t("Redondo / Tubo") :
              portShape === 'rectangular' ? t("Rectangular / Ranura") :
              t("Área de Sección Libre (Personalizado)")
            }</p>
            ${portShape === 'round' ? `<p><strong>${t("Diámetro")}:</strong> ${portDiameter} cm</p>` : ''}
            ${portShape === 'rectangular' ? `<p><strong>${t("Dimensiones")}:</strong> ${portWidth} x ${portHeight} cm</p>` : ''}
            ${portShape === 'custom' ? `<p><strong>${t("Área del puerto")}:</strong> ${portArea} cm²</p>` : ''}
            <p><strong>${t("Longitud calculada")}:</strong> ${pLen}</p>
            <p><strong>${t("Corrección de extremos")}:</strong> ${flaredLabel}</p>
            ${pipeResHz ? `<p><strong>${t("Resonancia de tubo")}:</strong> ~${pipeResHz} Hz</p>` : ''}
            ${rearClearanceCm !== null ? `<p><strong>${t("Despeje pared trasera")}:</strong> ${formatNum(rearClearanceCm, 1)} cm</p>` : ''}
            ${vp !== null ? `<p><strong>${t("Velocidad de aire")}:</strong> ${formatNum(vp, 1)} m/s (${
              vp < 17 ? t("Excelente (silencioso)") :
              vp < 27 ? t("Moderada (aceptable)") :
              t("Crítica (soplo de turbulencia)")
            })</p>` : ''}
          </div>
        </div>
      ` : ''}

      ${woodDetailsHTML}

      <div class="section-title">${t("Gráfica de Respuesta de Frecuencia (Ganancia)")}</div>
      <div class="chart-container">
        ${svgChart}
      </div>

      ${(svgImpedance || svgExcursion || svgVelocity) ? `
        <div class="section-title">${t("Simulación Electroacústica Complementaria")} (${simPowerW} W)</div>
        <div class="grid">
          ${svgImpedance ? `
            <div class="card">
              <h3>${t("Impedancia Eléctrica")} (Ω)</h3>
              ${svgImpedance}
            </div>
          ` : ''}
          ${svgExcursion ? `
            <div class="card">
              <h3>${t("Excursión del Cono")} (mm vs Xmax)</h3>
              ${svgExcursion}
            </div>
          ` : ''}
        </div>
        ${svgVelocity ? `
          <div class="chart-container" style="margin-top: 12px;">
            <h3 style="margin: 0 0 8px 0; font-size: 13px; color: #0f172a;">${t("Velocidad del Aire en Puerto")} (m/s)</h3>
            ${svgVelocity}
          </div>
        ` : ''}
      ` : ''}

      ${boxType === 'ported' && portedData.valid ? `
        <div class="section-title">${t("Guía de Protección y Operación")}</div>
        <div class="card">
          <p><strong>${t("Filtro Subsónico Recomendado")}:</strong> ${Math.max(25, Math.round(portedData.Fb * 0.85))} Hz (24 dB/oct) ${t("para proteger la excursión por debajo de Fb")}.</p>
          ${pipeResHz && xoverData && xoverData.crossoverWays !== '1way' && pipeResHz < xoverData.fc ? `<p><strong>${t("Control de Resonancia")}:</strong> ${t("Resonancia de tubo en")} ~${pipeResHz} Hz (&lt; ${xoverData.fc} Hz); ${t("se recomienda damping moderado en paredes sin obstruir puertos")}.</p>` : ''}
          ${extraData?.externalSubwoofer ? `<p><strong>${t("Integración con Subwoofer")}:</strong> ${t("Diseñado para operar como satélite/top con corte pasa-altos recomendado en 80–100 Hz")}.</p>` : ''}
        </div>
      ` : ''}

      ${crossoverHTML}

      <div class="footer">
        <p>${t("CajaAcústica Pro")}</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Imprime o exporta a PDF un reporte HTML mediante un iframe oculto,
 * evitando bloqueos de ventanas emergentes del navegador.
 */
export function printReportHtml(htmlContent: string): void {
  const frameId = 'acoustic-report-print-frame';
  const previousFrame = document.getElementById(frameId);
  if (previousFrame) {
    previousFrame.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = frameId;
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';

  document.body.appendChild(iframe);

  const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!frameDoc || !iframe.contentWindow) {
    iframe.remove();
    throw new Error('No se pudo inicializar el marco de impresión.');
  }

  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;

    const win = iframe.contentWindow;
    if (!win) {
      iframe.remove();
      return;
    }

    const cleanup = () => {
      setTimeout(() => {
        iframe.remove();
      }, 500);
    };

    win.addEventListener('afterprint', cleanup, { once: true });
    win.focus();
    win.print();

    // Respaldo si el navegador no emite afterprint
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        iframe.remove();
      }
    }, 60000);
  };

  iframe.onload = () => {
    setTimeout(triggerPrint, 100);
  };

  frameDoc.open();
  frameDoc.write(htmlContent);
  frameDoc.close();

  // Respaldo si document.write/close no dispara onload
  setTimeout(triggerPrint, 250);
}
