use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct SealedResult {
    pub alpha: f64,
    pub qtc: f64,
    pub fc: f64,
    pub f3: f64,
    pub vb_optimo: f64,
}

#[wasm_bindgen]
pub fn calc_caja_sellada(fs: f64, vas: f64, qts: f64, vb_target: f64, qtc_target: f64) -> SealedResult {
    // Evitar divisiones por cero o valores negativos
    let vb_t = if vb_target <= 0.0 { 1.0 } else { vb_target };
    let qts_val = if qts <= 0.0 { 0.001 } else { qts };
    let fs_val = if fs <= 0.0 { 0.0 } else { fs };
    
    let alpha = (vas / vb_t).max(0.0);
    let qtc = qts_val * (alpha + 1.0).sqrt();
    let fc = fs_val * (alpha + 1.0).sqrt();
    
    // F3
    let f3_term = 1.0 / (qtc.powi(2).max(1e-6)) - 2.0;
    let f3_inner = f3_term + (f3_term.powi(2) + 4.0).sqrt();
    let f3 = if f3_inner > 0.0 {
        fc * (f3_inner / 2.0).sqrt()
    } else {
        0.0
    };

    // Vb óptimo para el qtc_target (ej: 0.707)
    // El ratio (qtc_target / qts) debe ser estrictamente mayor a 1.0
    let qtc_t = if qtc_target <= qts_val { qts_val + 0.001 } else { qtc_target };
    let denom = (qtc_t / qts_val).powi(2) - 1.0;
    let vb_optimo = if denom <= 0.0 { 0.0 } else { vas / denom };

    SealedResult {
        alpha,
        qtc,
        fc,
        f3,
        vb_optimo,
    }
}

#[wasm_bindgen]
pub struct VentedResult {
    pub fb: f64,
    pub lv: f64,
}

#[wasm_bindgen]
pub fn calc_caja_ventilada(vb: f64, fb: f64, dv: f64) -> VentedResult {
    // dv en cm, vb en L, fb en Hz
    // Lv (cm) = (23407.2 * dv^2) / (fb^2 * vb) - 0.732 * dv
    let vb_val = if vb <= 0.0 { 1.0 } else { vb };
    let fb_val = if fb <= 0.0 { 1.0 } else { fb };
    let dv_val = if dv <= 0.0 { 0.0 } else { dv };
    
    let lv = (23407.2 * dv_val.powi(2)) / (fb_val.powi(2) * vb_val) - 0.732 * dv_val;
    
    VentedResult {
        fb: fb_val,
        lv: lv.max(0.0), // No tiene sentido una longitud de tubo negativa
    }
}

#[wasm_bindgen]
pub struct VentedAlignment {
    pub vb: f64,
    pub fb: f64,
    pub f3: f64,
}

#[wasm_bindgen]
pub fn calc_alineacion_ventilada(fs: f64, vas: f64, qts: f64, tipo: &str) -> VentedAlignment {
    let qts_val = if qts <= 0.0 { 0.001 } else { qts };
    let fs_val = if fs <= 0.0 { 0.0 } else { fs };
    let vas_val = if vas <= 0.0 { 0.0 } else { vas };

    let mut vb = 0.0;
    let mut fb = 0.0;
    let mut f3 = 0.0;

    match tipo {
        "SBB4" => {
            vb = 11.0 * qts_val.powf(2.87) * vas_val;
            fb = 0.38 * qts_val.powf(-0.95) * fs_val;
            f3 = 0.38 * qts_val.powf(-0.95) * fs_val;
        },
        "B4" => {
            vb = 0.25 * qts_val.powf(-2.0) * vas_val;
            fb = fs_val;
            f3 = fs_val;
        },
        "QB3" | _ => {
            vb = 6.27 * qts_val.powf(1.44) * vas_val;
            fb = 0.94 * qts_val.powf(-0.9) * fs_val;
            f3 = 1.2 * qts_val.powf(-0.9) * fs_val;
        }
    }

    VentedAlignment { vb, fb, f3 }
}

#[wasm_bindgen]
pub struct Bandpass4Result {
    pub vf: f64,
    pub vr: f64,
    pub fb: f64,
    pub f0: f64,
    pub delta_f: f64,
}

#[wasm_bindgen]
pub fn calc_bandpass_4(fs: f64, vas: f64, qts: f64, s: f64) -> Bandpass4Result {
    let qts_val = if qts <= 0.0 { 0.001 } else { qts };
    let fs_val = if fs <= 0.0 { 0.0 } else { fs };
    let vas_val = if vas <= 0.0 { 0.0 } else { vas };
    
    // S es el factor de respuesta plana, ej: 0.707
    let s_val = if s <= qts_val { qts_val + 0.001 } else { s };
    
    let denom = (s_val / qts_val).powi(2) - 1.0;
    let vf = if denom <= 0.0 { 0.0 } else { vas_val / denom };
    let vr = 2.0 * s_val.powi(2) * qts_val.powi(2) * vas_val;
    let fb = fs_val * (s_val / qts_val);
    let f0 = fb;
    let delta_f = (fs_val / qts_val) * s_val;

    Bandpass4Result { vf, vr, fb, f0, delta_f }
}

#[wasm_bindgen]
pub struct Bandpass6Result {
    pub vf: f64,
    pub vr: f64,
    pub fh: f64,
    pub fl: f64,
}

#[wasm_bindgen]
pub fn calc_bandpass_6(fs: f64, vas: f64, qts: f64, a: f64) -> Bandpass6Result {
    let qts_val = if qts <= 0.0 { 0.001 } else { qts };
    let fs_val = if fs <= 0.0 { 0.0 } else { fs };
    let vas_val = if vas <= 0.0 { 0.0 } else { vas };
    let a_val = if a <= 0.0 { 0.001 } else { a };

    let fh = fs_val * ((1.0 + a_val) / 2.0).sqrt();
    let fl = fs_val * (1.0 / (2.0 * (1.0 + a_val))).sqrt();
    let vol = vas_val * qts_val * (2.0 * a_val).sqrt();

    Bandpass6Result { vf: vol, vr: vol, fh, fl }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cajas_extremas() {
        // Ceros
        let res_sealed = calc_caja_sellada(0.0, 0.0, 0.0, 0.0, 0.0);
        assert!(res_sealed.qtc > 0.0);
        assert!(!res_sealed.vb_optimo.is_nan());
        
        let res_vent = calc_caja_ventilada(0.0, 0.0, 0.0);
        assert!(res_vent.fb > 0.0);
        assert!(res_vent.lv >= 0.0);
        
        let res_bp4 = calc_bandpass_4(0.0, 0.0, 0.0, 0.0);
        assert!(res_bp4.fb >= 0.0);
        assert!(!res_bp4.vf.is_nan());
    }
}



