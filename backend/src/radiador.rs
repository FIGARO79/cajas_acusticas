use wasm_bindgen::prelude::*;

const RHO_AIR: f64 = 1.205;
const SPEED_OF_SOUND: f64 = 343.0;

#[wasm_bindgen]
pub struct PassiveRadiatorResult {
    pub fb: f64,
    pub cap_acustica: f64,
    pub masa_añadida: f64,
}

#[wasm_bindgen]
pub fn calc_radiador_pasivo(vb: f64, vas: f64, _fs: f64, cd: f64, mp: f64) -> PassiveRadiatorResult {
    // Parámetros de aire y acústicos
    let cd_val = if cd <= 0.0 { 0.001 } else { cd };
    let mp_val = if mp <= 0.0 { 0.001 } else { mp };
    let vb_val = vb.max(0.0);
    let vas_val = vas.max(0.0);

    let factor = RHO_AIR * SPEED_OF_SOUND * SPEED_OF_SOUND * cd_val * cd_val;
    let cab = if factor <= 0.0 { 0.0 } else { vb_val / factor };
    let cap = if factor <= 0.0 { 0.0 } else { vas_val / factor };
    
    let denom = mp_val * (cap + cab);
    let fb = if denom <= 0.0 {
        0.0
    } else {
        (1.0 / (2.0 * std::f64::consts::PI)) * (1.0 / denom).sqrt()
    };

    // Masa añadida según la fórmula del documento
    let denom_ma = vb_val * 4.0 * std::f64::consts::PI * std::f64::consts::PI * fb * fb * cap;
    let masa_añadida = if denom_ma <= 0.0 {
        0.0
    } else {
        let ma = (vas_val / denom_ma) - mp_val;
        ma.max(0.0) // No puede haber masa negativa añadida
    };

    PassiveRadiatorResult { fb, cap_acustica: cap, masa_añadida }
}

#[wasm_bindgen]
pub struct PassiveRadiatorSuggestion {
    pub dia_cm: f64,
    pub dia_inches: f64,
    pub sd_pr_cm2: f64,
    pub vas_pr: f64,
    pub fs_pr: f64,
    pub mms_pr: f64,
    pub masa_anadida_g: f64,
}

#[wasm_bindgen]
pub fn suggest_passive_radiator(
    fs: f64,
    vas: f64,
    qts: f64,
    sd_cm2: f64,
    xmax_mm: f64,
    vb: f64,
    fb: f64,
) -> PassiveRadiatorSuggestion {
    let (target_vb, target_fb) = if vb > 0.0 && fb > 0.0 {
        (vb, fb)
    } else {
        let align = crate::cajas::calc_alineacion_ventilada(fs, vas, qts, "B4");
        (
            if align.vb > 0.0 { align.vb } else { 40.0 },
            if align.fb > 0.0 { align.fb } else { fs.max(30.0) },
        )
    };

    // Diámetro efectivo del driver en metros
    let d_drv_m = if sd_cm2 > 0.0 {
        2.0 * (sd_cm2 / std::f64::consts::PI).sqrt() / 100.0
    } else {
        0.20
    };
    // Desplazamiento recomendado del PR >= 2x Vd del driver -> diámetro equivalente * sqrt(2)
    let _xmax_ref = xmax_mm;
    let d_req_m = d_drv_m * std::f64::consts::SQRT_2;

    // Escalera comercial estándar de radiadores pasivos (umbral en m -> pulgadas)
    const COMMERCIAL_PRS: [(f64, f64); 11] = [
        (0.127, 6.0),
        (0.178, 8.0),
        (0.229, 10.0),
        (0.279, 12.0),
        (0.356, 15.0),
        (0.432, 18.0),
        (0.508, 21.0),
        (0.711, 30.0),
        (0.864, 36.0),
        (1.016, 42.0),
        (1.168, 48.0),
    ];

    let dia_inches = COMMERCIAL_PRS
        .iter()
        .find(|&&(thresh, _)| d_req_m <= thresh)
        .map(|&(_, inches)| inches)
        .unwrap_or(48.0);

    let dia_cm = dia_inches * 2.54;
    let sd_pr_cm2 = std::f64::consts::PI * (dia_cm / 2.0).powi(2);
    let vas_pr = (target_vb * 1.5).max(10.0);
    let fs_pr = (target_fb * 0.55).max(12.0);

    // Calcular Mms natural del PR (en gramos) consistente con Vas_pr y Fs_pr
    let sd_m2 = sd_pr_cm2 * 1e-4;
    let vas_m3 = vas_pr * 1e-3;
    let cms_pr = vas_m3 / (RHO_AIR * SPEED_OF_SOUND * SPEED_OF_SOUND * sd_m2 * sd_m2);
    let omega_fs = 2.0 * std::f64::consts::PI * fs_pr;
    let mms_kg = if cms_pr > 0.0 && omega_fs > 0.0 {
        1.0 / (omega_fs * omega_fs * cms_pr)
    } else {
        0.05
    };
    let mms_pr = (mms_kg * 1000.0).clamp(10.0, 2000.0);

    // Masa total requerida para sintonizar target_vb a target_fb
    let vb_m3 = target_vb * 1e-3;
    let cab_m = vb_m3 / (RHO_AIR * SPEED_OF_SOUND * SPEED_OF_SOUND * sd_m2 * sd_m2);
    let omega_fb = 2.0 * std::f64::consts::PI * target_fb;
    let m_total_g = if (cab_m + cms_pr) > 0.0 && omega_fb > 0.0 {
        (1.0 / (omega_fb * omega_fb * (cab_m + cms_pr))) * 1000.0
    } else {
        mms_pr
    };
    let masa_anadida_g = (m_total_g - mms_pr).max(0.0);

    PassiveRadiatorSuggestion {
        dia_cm,
        dia_inches,
        sd_pr_cm2,
        vas_pr,
        fs_pr,
        mms_pr,
        masa_anadida_g,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_radiador_pasivo_extremas() {
        // Ceros
        let res = calc_radiador_pasivo(0.0, 0.0, 0.0, 0.0, 0.0);
        assert!(!res.fb.is_nan());
        assert!(!res.masa_añadida.is_nan());
        assert!(res.masa_añadida >= 0.0);
    }

    #[test]
    fn test_suggest_passive_radiator() {
        let s = suggest_passive_radiator(35.0, 60.0, 0.38, 346.0, 8.0, 50.0, 32.0);
        assert!(s.dia_inches >= 10.0 && s.dia_inches <= 15.0);
        assert!(s.dia_cm > 20.0);
        assert!(s.vas_pr >= 50.0);
        assert!(s.fs_pr > 12.0 && s.fs_pr < 32.0);
        assert!(s.mms_pr >= 10.0);
        assert!(s.masa_anadida_g >= 0.0);
    }
}

