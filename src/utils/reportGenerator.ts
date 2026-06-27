import { getWasm } from '../wasm/index';
import { type Lang, translate } from './translations';
import { type UnitSystem, getUnitLabel } from './units';
import type { SpeakerParams, CalculatedSealed, CalculatedPorted } from '../types';

export function generateReportHTML(
  lang: Lang,
  unitSystem: UnitSystem,
  params: SpeakerParams,
  boxType: 'sealed' | 'ported',
  sealedData: CalculatedSealed,
  portedData: CalculatedPorted,
  dampingType: 'none' | 'light' | 'moderate' | 'heavy',
  cabinetData: any,
  xoverData: any,
  portCount: number,
  portShape: 'round' | 'rectangular' | 'custom',
  portDiameter: number,
  portWidth: number,
  portHeight: number,
  portArea: number,
  pLen: string,
  vp: number | null
): string {
  const t = (text: string) => translate(text, lang);
  
  const formatNum = (val: any, decimals: number = 2, fallback: string = 'N/A'): string => {
    if (val === undefined || val === null || isNaN(val)) return fallback;
    const num = typeof val === 'number' ? val : parseFloat(val);
    return isNaN(num) ? fallback : num.toFixed(decimals);
  };
  
  // 1. Obtener curvas mediante WASM síncrono si está disponible
  let sealedCurve: number[] = [];
  let portedCurve: number[] = [];
  try {
    const wasm = getWasm();
    if (sealedData && sealedData.valid) {
      const res = wasm.calc_sealed_curve(params.fs, params.qts, params.vas, sealedData.Vb, true);
      res.forEach((v: any) => sealedCurve.push(v as number));
    }
    if (portedData && portedData.valid) {
      const res = wasm.calc_ported_curve(params.fs, params.qts, params.vas, portedData.Vb, portedData.Fb, true);
      res.forEach((v: any) => portedCurve.push(v as number));
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
      </g>
    </svg>
  `;

  // 4. Crossover (Zobel, Lpad)
  let crossoverHTML = '';
  if (xoverData && xoverData.xoverResults) {
    const { crossoverWays, crossoverType, fc, fcLow, fcHigh, enableZobel, enableLPad, xoverResults, zobelResults, lpadResults } = xoverData;
    
    let xoverDetails = '';
    if (crossoverWays === '2way') {
      const hp = xoverResults.hp || {};
      const lp = xoverResults.lp || {};
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
      const hp = xoverResults.hp || {};
      const bp = xoverResults.bp || {};
      const lp = xoverResults.lp || {};
      xoverDetails = `
        <div class="xover-box">
          <h4>${t("Vía de Agudos (High Pass)")}</h4>
          <ul>
            ${hp.c1 !== undefined && hp.c1 !== null ? `<li>C1: <strong>${formatNum(hp.c1, 2)} µF</strong></li>` : ''}
            ${hp.l1 !== undefined && hp.l1 !== null ? `<li>L1: <strong>${formatNum(hp.l1, 3)} mH</strong></li>` : ''}
          </ul>
        </div>
        <div class="xover-box">
          <h4>${t("Vía de Medios (Band Pass)")}</h4>
          <ul>
            ${(bp.c_hp !== undefined && bp.c_hp !== null) || (bp.c1_hp !== undefined && bp.c1_hp !== null) ? `<li>C_hp: <strong>${formatNum(bp.c_hp || bp.c1_hp, 2)} µF</strong></li>` : ''}
            ${(bp.l_lp !== undefined && bp.l_lp !== null) || (bp.l1_lp !== undefined && bp.l1_lp !== null) ? `<li>L_lp: <strong>${formatNum(bp.l_lp || bp.l1_lp, 3)} mH</strong></li>` : ''}
            ${bp.l_hp !== undefined && bp.l_hp !== null ? `<li>L_hp: <strong>${formatNum(bp.l_hp, 3)} mH</strong></li>` : ''}
            ${bp.c_lp !== undefined && bp.c_lp !== null ? `<li>C_lp: <strong>${formatNum(bp.c_lp, 2)} µF</strong></li>` : ''}
          </ul>
        </div>
        <div class="xover-box">
          <h4>${t("Vía de Graves (Low Pass)")}</h4>
          <ul>
            ${lp.l1 !== undefined && lp.l1 !== null ? `<li>L1: <strong>${formatNum(lp.l1, 3)} mH</strong></li>` : ''}
            ${lp.c1 !== undefined && lp.c1 !== null ? `<li>C1: <strong>${formatNum(lp.c1, 2)} µF</strong></li>` : ''}
          </ul>
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
    if (enableLPad && lpadResults) {
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
          <p><strong>${t("Vías")}:</strong> ${crossoverWays === '2way' ? '2 Vías' : '3 Vías'}</p>
          <p><strong>${t("Tipo de filtro")}:</strong> ${crossoverType === '1st_order' ? '1er Orden' : crossoverType === '2nd_butter' ? '2do Orden Butterworth' : crossoverType === '2nd_lr' ? '2do Orden Linkwitz-Riley' : '4to Orden Linkwitz-Riley'}</p>
          <p><strong>${t("Frecuencia(s) de Cruce")}:</strong> ${crossoverWays === '2way' ? `${fc} Hz` : `${fcLow} Hz / ${fcHigh} Hz`}</p>
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
    const isRect = cabinetData.woodShape === 'rectangular';
    woodDetailsHTML = `
      <div class="section-title">${t("Dimensiones y Corte de Madera")}</div>
      <div class="grid">
        <div class="card">
          <h3>${t("Ebanistería")}</h3>
          <p><strong>${t("Forma de la caja")}:</strong> ${isRect ? t("Rectangular") : t("Trapezoidal")}</p>
          <p><strong>${t("Grosor de madera")}:</strong> ${cabinetData.woodThickness} mm</p>
          <p><strong>${t("Volumen neto")}:</strong> ${formatNum(cabinetData.vNeto, 2)} L</p>
          <p><strong>${t("Volumen bruto")}:</strong> ${formatNum(cabinetData.vBruto, 2)} L</p>
          <p><strong>${t("Dimensiones externas")}:</strong></p>
          <ul>
            ${isRect ? `
              <li>${t("Alto")}: ${formatNum(cabinetData.extHeight, 1)} cm</li>
              <li>${t("Ancho")}: ${formatNum(cabinetData.extWidth, 1)} cm</li>
              <li>${t("Profundidad")}: ${formatNum(cabinetData.extDepth, 1)} cm</li>
            ` : `
              <li>${t("Alto")}: ${formatNum(cabinetData.extHeight, 1)} cm</li>
              <li>${t("Ancho")}: ${formatNum(cabinetData.extWidth, 1)} cm</li>
              <li>${t("Prof. Superior")}: ${formatNum(cabinetData.extDepthTop, 1)} cm</li>
              <li>${t("Prof. Inferior")}: ${formatNum(cabinetData.extDepthBot, 1)} cm</li>
            `}
          </ul>
        </div>
        <div class="card">
          <h3>${t("Relleno Acústico (Damping)")}</h3>
          <p><strong>${t("Tipo de relleno")}:</strong> ${
            dampingType === 'none' ? t("Sin Relleno") :
            dampingType === 'light' ? t("Relleno Leve (Damping de Paredes)") :
            dampingType === 'moderate' ? t("Relleno Moderado (Fibra Suelta)") :
            t("Relleno Denso (Fibra Uniforme)")
          }</p>
          <p><strong>${t("Aumento virtual de volumen")}:</strong> ${dampingType === 'none' ? '0%' : dampingType === 'light' ? '+5%' : dampingType === 'moderate' ? '+12%' : '+20%'}</p>
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
        <p>${t("Generado automáticamente")} - ${new Date().toLocaleDateString()}</p>
      </div>

      <div class="section-title">${t("Parámetros del Altavoz")}</div>
      <div class="grid">
        <div class="card">
          <h3>${t("Especificaciones T&S")}</h3>
          <p><strong>Fs:</strong> ${params.fs} Hz</p>
          <p><strong>Qts:</strong> ${params.qts}</p>
          <p><strong>Vas:</strong> ${params.vas} ${uVol}</p>
          ${params.qes ? `<p><strong>Qes:</strong> ${params.qes}</p>` : ''}
          ${params.qms ? `<p><strong>Qms:</strong> ${params.qms}</p>` : ''}
          ${params.re ? `<p><strong>Re:</strong> ${params.re} Ω</p>` : ''}
          ${params.le ? `<p><strong>Le:</strong> ${params.le} mH</p>` : ''}
        </div>
        <div class="card">
          <h3>${t("Alineación y Caja Sugerida")}</h3>
          <p><strong>${t("Tipo de caja")}:</strong> ${boxType === 'sealed' ? t("Sellada") : t("Ventilada")}</p>
          ${boxType === 'sealed' 
            ? `
              <p><strong>Qtc:</strong> ${formatNum(sealedData.Qtc, 3)}</p>
              <p><strong>Fc:</strong> ${formatNum(sealedData.Fc, 1)} Hz</p>
              <p><strong>F3:</strong> ${formatNum(sealedData.F3, 1)} Hz</p>
            ` : `
              <p><strong>Vb:</strong> ${formatNum(portedData.Vb, 1)} ${uVol}</p>
              <p><strong>Fb (Sintonía):</strong> ${formatNum(portedData.Fb, 1)} Hz</p>
              <p><strong>F3:</strong> ${formatNum(portedData.F3, 1)} Hz</p>
            `
          }
        </div>
      </div>

      ${boxType === 'ported' ? `
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

      ${crossoverHTML}

      <div class="footer">
        <p>${t("CajaAcústica Pro")}</p>
      </div>
    </body>
    </html>
  `;
}
