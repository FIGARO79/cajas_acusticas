import React, { useMemo, useState } from 'react';
import type { SpeakerParams, CalculatedPorted, CalculatedSealed } from '../types';

interface GuidanceStep {
  id: string;
  step: string;
  level: 'ok' | 'warn' | 'alert';
  currentVal: string;
  targetVal: string;
  instruction: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface AcousticAssistantPanelProps {
  boxType: 'sealed' | 'ported' | 'bandpass';
  params: SpeakerParams;
  portedData: CalculatedPorted;
  sealedData: CalculatedSealed;
  externalSubwoofer?: boolean;
  vPeak: number | null;
  pipeResonanceHz?: number | null;
  crossoverWays: number;
  fc: number;
  recommendedFb?: number;
  optimalVb?: number | null;
  currentLvCm?: number | null;
  targetLvCm?: number | null;
  portDiaCm?: number | null;
  portCount?: number;
  onApplyOptimalFb?: () => void;
  t: (text: string) => string;
}

export const AcousticAssistantPanel: React.FC<AcousticAssistantPanelProps> = ({
  boxType,
  params,
  portedData,
  sealedData,
  externalSubwoofer = false,
  vPeak,
  pipeResonanceHz,
  crossoverWays,
  fc,
  recommendedFb,
  optimalVb,
  currentLvCm,
  targetLvCm,
  portDiaCm,
  portCount = 1,
  onApplyOptimalFb,
  t,
}) => {
  const [expanded, setExpanded] = useState<boolean>(true);

  const steps = useMemo<GuidanceStep[]>(() => {
    const list: GuidanceStep[] = [];
    const fs = params.fs || 0;
    const qts = params.qts || 0;
    if (fs <= 0 || qts <= 0) return list;

    if (boxType === 'sealed' && sealedData.valid) {
      const qtc = sealedData.Qtc;
      const vbCur = sealedData.Vb;
      const vbOpt = optimalVb && optimalVb > 0 ? optimalVb : vbCur;
      const diffVb = vbOpt - vbCur;

      list.push({
        id: 'sealed-vb',
        step: t('1. Volumen (Vb)'),
        level: Math.abs(diffVb) <= vbOpt * 0.18 ? 'ok' : 'warn',
        currentVal: `${vbCur.toFixed(1)} L`,
        targetVal: `${vbOpt.toFixed(1)} L`,
        instruction:
          Math.abs(diffVb) <= vbOpt * 0.18
            ? t('Volumen en rango óptimo para caja sellada.')
            : diffVb > 0
              ? `${t('Aumenta el volumen')} (+${diffVb.toFixed(1)} L) ${t('o añade relleno suave.')}`
              : `${t('Reduce el volumen')} (${diffVb.toFixed(1)} L) ${t('para mayor control.')}`,
      });

      list.push({
        id: 'sealed-qtc',
        step: t('2. Factor Qtc / F3'),
        level: qtc <= 1.15 ? 'ok' : 'warn',
        currentVal: `Qtc ${qtc.toFixed(2)}`,
        targetVal: '0.71 – 1.10',
        instruction:
          qtc <= 0.85
            ? `${t('Respuesta plana y rápida')} (F3: ${sealedData.F3.toFixed(1)} Hz).`
            : qtc <= 1.15
              ? `${t('Buena pegada controlada')} (F3: ${sealedData.F3.toFixed(1)} Hz).`
              : t('Qtc alto: amplía el volumen para evitar realce excesivo.'),
      });

      return list;
    }

    if (boxType !== 'ported' || !portedData.valid) return list;

    const vbCur = portedData.Vb;
    const fbCur = portedData.Fb;
    const f3Cur = portedData.F3;

    // Paso 1: Volumen Neto (Vb)
    if (optimalVb && optimalVb > 0) {
      const diffVb = optimalVb - vbCur;
      const tol = optimalVb * 0.20;
      const vbOk = Math.abs(diffVb) <= tol || (qts > 0.49 && vbCur >= params.vas! * 0.32 && vbCur <= params.vas! * 0.70);
      list.push({
        id: 'step-vb',
        step: t('1. Volumen (Vb)'),
        level: vbOk ? 'ok' : 'warn',
        currentVal: `${vbCur.toFixed(1)} L`,
        targetVal: `${optimalVb.toFixed(1)} L`,
        instruction: vbOk
          ? t('Volumen adecuado para este driver.')
          : diffVb > 0
            ? `${t('Sube el volumen')} (+${diffVb.toFixed(1)} L) ${t('o usa damping en paredes.')}`
            : `${t('Reduce el volumen')} (${diffVb.toFixed(1)} L) ${t('para mayor control de cono.')}`,
      });
    }

    // Paso 2: Sintonía (Fb)
    const fbTarget = externalSubwoofer
      ? (recommendedFb && recommendedFb > 0 ? recommendedFb : Math.min(95, Math.max(55, Math.round(fs * 1.12 * 10) / 10)))
      : (recommendedFb && recommendedFb > 0 ? recommendedFb : fs);
    const diffFb = fbTarget - fbCur;
    const fbOk = externalSubwoofer
      ? (fbCur >= fs * 0.98 && f3Cur <= 98 && Math.abs(diffFb) <= 4.5)
      : (Math.abs(diffFb) <= 4.0 && fbCur <= fs * 1.25);

    list.push({
      id: 'step-fb',
      step: t('2. Sintonía (Fb)'),
      level: fbOk ? 'ok' : 'warn',
      currentVal: `${fbCur.toFixed(1)} Hz`,
      targetVal: `${fbTarget.toFixed(1)} Hz`,
      instruction: fbOk
        ? `${externalSubwoofer ? t('Empalme óptimo c/ subwoofer') : t('Sintonía equilibrada')} (F3: ${f3Cur.toFixed(1)} Hz).`
        : diffFb > 0
          ? `${t('Sube Fb')} (+${diffFb.toFixed(1)} Hz) ${externalSubwoofer ? t('para proteger excursión con sub.') : t('para mejorar control.')}`
          : `${t('Baja Fb')} (${diffFb.toFixed(1)} Hz) ${externalSubwoofer ? t('para suavizar el realce.') : t('para recuperar graves profundos.')}`,
      actionLabel: !fbOk && onApplyOptimalFb ? `${t('Aplicar')} ${fbTarget.toFixed(1)} Hz` : undefined,
      onAction: onApplyOptimalFb,
    });

    // Paso 3: Longitud exacta del puerto (Lv)
    if (currentLvCm && currentLvCm > 0 && targetLvCm && targetLvCm > 0) {
      const diffLv = targetLvCm - currentLvCm;
      const lvOk = Math.abs(diffLv) <= 0.4;
      list.push({
        id: 'step-lv',
        step: t('3. Largo del Tubo'),
        level: lvOk ? 'ok' : 'warn',
        currentVal: `${currentLvCm.toFixed(1)} cm`,
        targetVal: `${targetLvCm.toFixed(1)} cm`,
        instruction: lvOk
          ? `${t('Longitud óptima para tus')} ${portCount}× ${portDiaCm?.toFixed(1) ?? ''} cm.`
          : diffLv > 0
            ? `${t('Alarga el tubo')} +${diffLv.toFixed(1)} cm (${t('hacia adentro')}) ${t('para bajar a')} ${fbTarget.toFixed(1)} Hz.`
            : `${t('Acorta el tubo')} ${diffLv.toFixed(1)} cm ${t('para subir a')} ${fbTarget.toFixed(1)} Hz.`,
      });
    }

    // Paso 4: Diámetro / Velocidad de Aire
    if (vPeak !== null) {
      const targetV = 12.0;
      let diaHint = '';
      if (vPeak > targetV && params.sd && params.xmax && fbTarget > 0 && portCount > 0) {
        const dMinSingle = Math.sqrt((0.1 * params.sd * params.xmax) / Math.sqrt(fbTarget));
        const dMinEach = dMinSingle / Math.sqrt(portCount);
        if (portDiaCm && dMinEach > portDiaCm) {
          diaHint = ` (${t('sube Ø a')} ≥ ${dMinEach.toFixed(1)} cm)`;
        }
      }
      list.push({
        id: 'step-air',
        step: t('4. Flujo de Aire'),
        level: vPeak > 17 ? 'alert' : vPeak > 12 ? 'warn' : 'ok',
        currentVal: `${vPeak.toFixed(1)} m/s`,
        targetVal: '≤ 12.0 m/s',
        instruction:
          vPeak <= 12
            ? t('Flujo laminar silencioso, sin turbulencias.')
            : vPeak <= 17
              ? `${t('Redondea/abocina bordes del tubo')}${diaHint}.`
              : `${t('Soplido probable: amplía diámetro o añade otro puerto')}${diaHint}.`,
      });
    }

    // Paso 5: Resonancia / Protección Subsónica
    const subsonicHz = Math.max(25, Math.round(fbCur * 0.85));
    const hasPipeWarn = Boolean(pipeResonanceHz && crossoverWays >= 2 && pipeResonanceHz < fc);
    list.push({
      id: 'step-prot',
      step: t('5. Protección y EQ'),
      level: hasPipeWarn || qts > 0.50 ? 'warn' : 'ok',
      currentVal: `Xmax ${params.xmax || 0} mm`,
      targetVal: `HPF ≥ ${subsonicHz} Hz`,
      instruction: hasPipeWarn
        ? `${t('Resonancia de tubo')} (~${Math.round(pipeResonanceHz!)} Hz): ${t('usa damping moderado en paredes y subsónico en')} ~${subsonicHz} Hz.`
        : qts > 0.50 && fbCur > fs * 1.05
          ? `${t('Activa subsónico')} (~${subsonicHz} Hz) ${t('o atenúa 30 Hz (-12 dB) y ~125 Hz (-3/-5 dB).')}`
          : `${t('Activa filtro subsónico alrededor de')} ${subsonicHz} Hz ${t('para proteger el cono.')}`,
    });

    return list;
  }, [
    boxType,
    params.fs,
    params.qts,
    params.vas,
    params.sd,
    params.xmax,
    portedData,
    sealedData,
    externalSubwoofer,
    vPeak,
    pipeResonanceHz,
    crossoverWays,
    fc,
    recommendedFb,
    optimalVb,
    currentLvCm,
    targetLvCm,
    portDiaCm,
    portCount,
    onApplyOptimalFb,
    t,
  ]);

  if (steps.length === 0) return null;

  const pendingCount = steps.filter((s) => s.level !== 'ok').length;

  const getStatusGlyph = (level: GuidanceStep['level']) => {
    if (level === 'ok') return '✓';
    if (level === 'alert') return '!';
    return '›';
  };

  return (
    <div className="premium-form-card">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'none',
          border: 'none',
          padding: 0,
          margin: 0,
          textAlign: 'left',
          cursor: 'pointer',
          color: 'var(--text-main)',
        }}
      >
        <span className="form-subsection-title" style={{ margin: 0 }}>
          {t('Guía de Ajuste Óptimo')}
        </span>
        <span style={{ fontSize: '0.66rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span>{pendingCount === 0 ? t('Óptimo') : `${pendingCount} ${pendingCount === 1 ? t('ajuste') : t('ajustes')}`}</span>
          <span>{expanded ? '▾' : '▸'}</span>
        </span>
      </button>

      {expanded && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: '0.45rem',
            border: '1px solid var(--card-border)',
            background: 'var(--bg-main)',
            borderRadius: '2px',
          }}
        >
          {steps.map((item, idx) => (
            <div
              key={item.id}
              style={{
                padding: '0.32rem 0.45rem',
                borderBottom: idx < steps.length - 1 ? '1px solid var(--card-border)' : 'none',
                fontSize: '0.65rem',
                lineHeight: 1.32,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.32rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  <span style={{ width: '10px', textAlign: 'center', fontWeight: 700, color: item.level === 'ok' ? 'var(--text-muted)' : 'var(--text-main)' }}>
                    {getStatusGlyph(item.level)}
                  </span>
                  <span>{item.step}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.28rem', fontFamily: 'monospace', fontSize: '0.62rem', whiteSpace: 'nowrap' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{item.currentVal}</span>
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                  <strong style={{ color: 'var(--text-main)' }}>{item.targetVal}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem', marginTop: '0.14rem', paddingLeft: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{item.instruction}</span>
                {item.actionLabel && item.onAction && (
                  <button
                    type="button"
                    onClick={item.onAction}
                    className="preset-select"
                    style={{
                      borderRadius: '2px',
                      padding: '0.1rem 0.4rem',
                      fontSize: '0.6rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {item.actionLabel}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
