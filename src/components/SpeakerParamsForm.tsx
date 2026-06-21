import React, { useState, useEffect } from 'react';
import type { SpeakerParams } from '../types';
import { type Lang, translate } from '../utils/translations';
import { runProCalculations } from '../utils/acousticMath';
import { PRESETS } from '../utils/presets';

interface SpeakerParamsFormProps {
  lang: Lang;
  params: SpeakerParams;
  onParamsChange: (newParams: SpeakerParams) => void;
  driverConfig: string;
  onDriverConfigChange: (config: string) => void;
  validationError: string | null;
  preset: string;
  onPresetChange: (presetId: string, params: SpeakerParams | null) => void;
}

export const SpeakerParamsForm: React.FC<SpeakerParamsFormProps> = ({
  lang,
  params,
  onParamsChange,
  driverConfig,
  onDriverConfigChange,
  validationError,
  preset,
  onPresetChange,
}) => {
  const t = (text: string) => translate(text, lang);
  const [proMode, setProMode] = useState(false);

  const handleSelectPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val && PRESETS[val]) {
      onPresetChange(val, PRESETS[val].params);
    } else {
      onPresetChange('', null);
    }
  };

  // Derived calculations
  const [derived, setDerived] = useState<ReturnType<typeof runProCalculations> | null>(null);

  useEffect(() => {
    if (params.fs && params.vas && params.qts) {
      const results = runProCalculations(params);
      setDerived(results);
    } else {
      setDerived(null);
    }
  }, [params]);

  const handleInputChange = (field: keyof SpeakerParams, val: string) => {
    const nextParams = { ...params };
    if (field === 'diaNominal') {
      nextParams.diaNominal = val;
    } else {
      const num = parseFloat(val);
      if (isNaN(num)) {
        delete nextParams[field];
      } else {
        (nextParams[field] as number) = num;
      }
    }

    // Auto-calculate Qts if Qes and Qms exist, and Qts is not manually set/overridden
    if (field === 'qms' || field === 'qes') {
      const qms = field === 'qms' ? parseFloat(val) : params.qms;
      const qes = field === 'qes' ? parseFloat(val) : params.qes;
      if (qms && qes) {
        nextParams.qts = Math.round((qms * qes) / (qms + qes) * 1000) / 1000;
      }
    }

    onParamsChange(nextParams);
  };

  return (
    <aside className="panel">
      {/* Selector de altavoz encima del título */}
      <div className="input-group input-group-full" style={{ marginBottom: '1rem' }}>
        <label>{t("Cargar Altavoz:")}</label>
        <select
          value={preset}
          onChange={handleSelectPreset}
          className="input-select"
          style={{ width: '100%', height: '34px' }}
        >
          <option value="">{t("-- Personalizado o vacío --")}</option>
          <option value="sub12">{t("Subwoofer 12\" de Coche (Excursión Larga)")}</option>
          <option value="hifi8">{t("Woofer 8\" de Alta Fidelidad (Respuesta Suave)")}</option>
          <option value="pro10">{t("Medio-Bajo Pro 10\" (Alta Sensibilidad)")}</option>
          <option value="eminence10">{t("Eminence 10\" (Ejemplo de Especificación)")}</option>
        </select>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
        <h2 className="panel-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>{t("Parámetros")}</h2>
      </div>

      <div className="form-section">
        {/* BLOQUE 1: ESPECIFICACIONES DEL ALTAVOZ */}
        <div className="form-subsection-title">{t("Especificaciones del Altavoz")}</div>
        <div className="input-group input-group-full">
          <label>{t("Configuración de Altavoces")}</label>
          <select 
            value={driverConfig} 
            onChange={(e) => onDriverConfigChange(e.target.value)} 
            className="input-select"
            style={{ width: '100%', height: '34px' }}
          >
            <option value="single">{t("Un Altavoz (Estándar)")}</option>
            <option value="parallel_2">{t("2 Altavoces en Paralelo (2x Vb)")}</option>
            <option value="series_2">{t("2 Altavoces en Serie (2x Vb)")}</option>
            <option value="isobaric">{t("Isobárica / Push-Pull (0.5x Vb)")}</option>
          </select>
        </div>

        <div className="input-grid">
          <div className="input-group">
            <label>{t("Diámetro Nominal")}</label>
            <div className="input-wrapper">
              <input 
                type="text" 
                value={params.diaNominal || ''} 
                onChange={(e) => handleInputChange('diaNominal', e.target.value)}
                placeholder='e.g. 10" o 254mm' 
              />
            </div>
          </div>
          <div className="input-group">
            <label>{t("Impedancia Nominal")}</label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.zNominal ?? ''} 
                onChange={(e) => handleInputChange('zNominal', e.target.value)}
                placeholder="8" 
                step="any" 
              />
              <span className="unit-badge">Ω</span>
            </div>
          </div>
          <div className="input-group">
            <label>{t("Potencia RMS (Watts)")}</label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.pe ?? ''} 
                onChange={(e) => handleInputChange('pe', e.target.value)}
                placeholder="150" 
                step="any" 
              />
              <span className="unit-badge">W</span>
            </div>
          </div>
          <div className="input-group">
            <label>{t("Program Power")}</label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.pProg ?? ''} 
                onChange={(e) => handleInputChange('pProg', e.target.value)}
                placeholder="300" 
                step="any" 
              />
              <span className="unit-badge">W</span>
            </div>
          </div>
          <div className="input-group">
            <label>{t("Rango Frec. (Mín)")}</label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.freqMin ?? ''} 
                onChange={(e) => handleInputChange('freqMin', e.target.value)}
                placeholder="57" 
                step="any" 
              />
              <span className="unit-badge">Hz</span>
            </div>
          </div>
          <div className="input-group">
            <label>{t("Rango Frec. (Máx)")}</label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.freqMax ?? ''} 
                onChange={(e) => handleInputChange('freqMax', e.target.value)}
                placeholder="4500" 
                step="any" 
              />
              <span className="unit-badge">Hz</span>
            </div>
          </div>
          <div className="input-group">
            <label>{t("Sensibilidad (1W/1m)")}</label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.sens ?? ''} 
                onChange={(e) => handleInputChange('sens', e.target.value)}
                placeholder="95.6" 
                step="any" 
              />
              <span className="unit-badge">dB</span>
            </div>
          </div>
          <div className="input-group">
            <label>{t("Peso del Imán")}</label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.magWeight ?? ''} 
                onChange={(e) => handleInputChange('magWeight', e.target.value)}
                placeholder="20" 
                step="any" 
              />
              <span className="unit-badge">oz</span>
            </div>
          </div>
          <div className="input-group">
            <label style={{ whiteSpace: 'nowrap' }}>{t("Altura del Gap")}</label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.gapHeight ?? ''} 
                onChange={(e) => handleInputChange('gapHeight', e.target.value)}
                placeholder="6.4" 
                step="any" 
              />
              <span className="unit-badge">mm</span>
            </div>
          </div>
          <div className="input-group">
            <label>{t("Diám. Bobina Móvil")}</label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.vcDiameter ?? ''} 
                onChange={(e) => handleInputChange('vcDiameter', e.target.value)}
                placeholder="38" 
                step="any" 
              />
              <span className="unit-badge">mm</span>
            </div>
          </div>
        </div>

        {/* BLOQUE 2: PARÁMETROS THIELE & SMALL */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem', marginTop: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
          <div className="form-subsection-title" style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>{t("Parámetros Thiele & Small")}</div>
          <label className="checkbox-container" style={{ fontWeight: 500, marginBottom: 0, cursor: 'pointer' }}>
            <input type="checkbox" checked={proMode} onChange={(e) => setProMode(e.target.checked)} />
            <div className="custom-checkbox"></div>
            <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>{t("Parámetros Avanzados")}</span>
          </label>
        </div>

        <div className="input-grid">
          <div className="input-group">
            <label>Fs <span className="label-desc">({t("Resonancia")})</span></label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.fs ?? ''} 
                onChange={(e) => handleInputChange('fs', e.target.value)}
                placeholder="45" 
                step="any" 
                required
              />
              <span className="unit-badge">Hz</span>
            </div>
          </div>
          <div className="input-group">
            <label>Vas <span className="label-desc">({t("Vol. Eq")})</span></label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.vas ?? ''} 
                onChange={(e) => handleInputChange('vas', e.target.value)}
                placeholder="60" 
                step="any" 
                required
              />
              <span className="unit-badge">L</span>
            </div>
          </div>
          <div className="input-group">
            <label>Qms <span className="label-desc">({t("Q Mecánico")})</span></label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.qms ?? ''} 
                onChange={(e) => handleInputChange('qms', e.target.value)}
                placeholder="4.5" 
                step="any" 
              />
            </div>
          </div>
          <div className="input-group">
            <label>Qes <span className="label-desc">({t("Q Eléctrico")})</span></label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.qes ?? ''} 
                onChange={(e) => handleInputChange('qes', e.target.value)}
                placeholder="0.45" 
                step="any" 
              />
            </div>
          </div>
          <div className="input-group input-group-full">
            <label>Qts <span className="label-desc">({t("Q Total - se auto-calcula si queda vacío")})</span></label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.qts ?? ''} 
                onChange={(e) => handleInputChange('qts', e.target.value)}
                placeholder="0.41" 
                step="any" 
              />
            </div>
          </div>
          <div className="input-group">
            <label>Sd <span className="label-desc">({t("Área Cono")})</span></label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.sd ?? ''} 
                onChange={(e) => handleInputChange('sd', e.target.value)}
                placeholder="350" 
                step="any" 
              />
              <span className="unit-badge">cm²</span>
            </div>
          </div>
          <div className="input-group">
            <label>Xmax <span className="label-desc">({t("Excursión")})</span></label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.xmax ?? ''} 
                onChange={(e) => handleInputChange('xmax', e.target.value)}
                placeholder="6.5" 
                step="any" 
              />
              <span className="unit-badge">mm</span>
            </div>
          </div>
          <div className="input-group">
            <label>Re <span className="label-desc">({t("Resist. DC")})</span></label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.re ?? ''} 
                onChange={(e) => handleInputChange('re', e.target.value)}
                placeholder="3.6" 
                step="any" 
              />
              <span className="unit-badge">Ω</span>
            </div>
          </div>
          <div className="input-group">
            <label>Le <span className="label-desc">({t("Inductancia")})</span></label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.le ?? ''} 
                onChange={(e) => handleInputChange('le', e.target.value)}
                placeholder="0.8" 
                step="any" 
              />
              <span className="unit-badge">mH</span>
            </div>
          </div>
        </div>

        {/* TS Avanzados (Se despliegan en el mismo bloque al activar pro) */}
        {proMode && (
          <div className="input-grid" style={{ marginTop: '0.75rem' }}>
            <div className="input-group">
              <label>BL <span className="label-desc">({t("Fuerza Motor")})</span></label>
              <div className="input-wrapper">
                <input 
                  type="number" 
                  value={params.bl ?? ''} 
                  onChange={(e) => handleInputChange('bl', e.target.value)}
                  placeholder={derived?.bl.toFixed(2) || "7.5"} 
                  step="any" 
                />
                <span className="unit-badge">T-m</span>
              </div>
            </div>
            <div className="input-group">
              <label>Mms <span className="label-desc">({t("Masa Móvil")})</span></label>
              <div className="input-wrapper">
                <input 
                  type="number" 
                  value={params.mms ?? ''} 
                  onChange={(e) => handleInputChange('mms', e.target.value)}
                  placeholder={derived?.mms.toFixed(1) || "22"} 
                  step="any" 
                />
                <span className="unit-badge">g</span>
              </div>
            </div>
            <div className="input-group">
              <label>Cms <span className="label-desc">({t("Compliancia")})</span></label>
              <div className="input-wrapper">
                <input 
                  type="number" 
                  value={params.cms ?? ''} 
                  onChange={(e) => handleInputChange('cms', e.target.value)}
                  placeholder={derived?.cms.toFixed(3) || "0.46"} 
                  step="any" 
                />
                <span className="unit-badge">mm/N</span>
              </div>
            </div>
            <div className="input-group">
              <label>Xlim <span className="label-desc">({t("Límite Mecánico")})</span></label>
              <div className="input-wrapper">
                <input 
                  type="number" 
                  value={params.xlim ?? ''} 
                  onChange={(e) => handleInputChange('xlim', e.target.value)}
                  placeholder="9.1" 
                  step="any" 
                />
                <span className="unit-badge">mm</span>
              </div>
            </div>
            <div className="input-group input-group-full">
              <label>Vd <span className="label-desc">({t("Vol. Desplazado")})</span></label>
              <div className="input-wrapper">
                <input 
                  type="number" 
                  value={params.vd ?? ''} 
                  onChange={(e) => handleInputChange('vd', e.target.value)}
                  placeholder={derived?.vd.toFixed(1) || "114"} 
                  step="any" 
                />
                <span className="unit-badge">cc</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Parámetros Derivados Pro */}
      {proMode && derived && (
        <div className="pro-calc-panel">
          <span className="pro-calc-title">{t("Parámetros Derivados (Pro)")}</span>
          <div className="pro-calc-row">
            <span className="pro-calc-label">{t("Eficiencia de Ref. (η₀):")}</span>
            <span className="pro-calc-value">{derived.eta0 > 0 ? `${(derived.eta0 * 100).toFixed(3)} %` : '-- %'}</span>
          </div>
          <div className="pro-calc-row">
            <span className="pro-calc-label">{t("Sensibilidad Ref. (1W/1m):")}</span>
            <span className="pro-calc-value">{(derived.spl ?? 0) > 0 ? `${derived.spl?.toFixed(1)} dB${params.sens ? ' (' + t("Manual") + ')' : ' (' + t("Sugerida") + ')'}` : '-- dB'}</span>
          </div>
          <div className="pro-calc-row">
            <span className="pro-calc-label">{t("SPL Máximo (RMS a Pe):")}</span>
            <span className="pro-calc-value">{derived.splMax > 0 ? `${derived.splMax.toFixed(1)} dB` : '-- dB'}</span>
          </div>
          <div className="pro-calc-row">
            <span className="pro-calc-label">{t("Pérdidas Susp. (Rms):")}</span>
            <span className="pro-calc-value">{derived.rms > 0 ? `${derived.rms.toFixed(2)} kg/s` : '-- kg/s'}</span>
          </div>
          <div className="pro-calc-row">
            <span className="pro-calc-label">{t("Impedancia Resonancia (Zmax):")}</span>
            <span className="pro-calc-value">{derived.zmax > 0 ? `${derived.zmax.toFixed(1)} Ω` : '-- Ω'}</span>
          </div>
          {(derived.autoCms || derived.autoMms || derived.autoBl || derived.autoVd) && (
            <div className="pro-calc-row" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {t("* Compliancia y Masa auto-calculadas.")}
            </div>
          )}
        </div>
      )}

      {/* Notificaciones en vivo */}
      {validationError && (
        <div className="notification-area active error">
          <span>{validationError}</span>
        </div>
      )}
    </aside>
  );
};
