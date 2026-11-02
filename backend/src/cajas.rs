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
pub fn calc_k_puerto(flared_ends: u8) -> f64 {
    match flared_ends {
        1 | 3 => 0.850,
        2 => 0.968,
        _ => 0.732,
    }
}

#[wasm_bindgen]
pub fn calc_longitud_puerto(vb: f64, fb: f64, dv: f64, flared_ends: u8, num_ports: u32) -> f64 {
    if vb <= 0.0 || fb <= 0.0 || dv <= 0.0 || num_ports == 0 {
        return 0.0;
    }
    let k = calc_k_puerto(flared_ends);
    let n = num_ports as f64;
    let len = ((23562.5 * dv.powi(2) * n) / (fb.powi(2) * vb)) - (k * dv);
    len.max(0.0)
}

#[wasm_bindgen]
pub fn calc_velocidad_puerto(fb: f64, sd: f64, xmax: f64, num_ports: u32, dv: f64) -> f64 {
    if fb <= 0.0 || sd <= 0.0 || xmax <= 0.0 || num_ports == 0 || dv <= 0.0 {
        return 0.0;
    }
    (0.008 * fb * sd * xmax) / ((num_ports as f64) * dv.powi(2))
}

#[wasm_bindgen]
pub fn calc_f3_ventilada(fs: f64, qts: f64, vb: f64, fb: f64, vas: f64) -> f64 {
    if fs <= 0.0 || qts <= 0.0 || vb <= 0.0 || fb <= 0.0 || vas <= 0.0 {
        return 0.0;
    }
    let h = fb / fs;
    let alpha = vas / vb;
    let ql = 7.0_f64;

    let a3 = 1.0 / qts + h / ql;
    let a2 = 1.0 + h * h * (1.0 + alpha) + h / (qts * ql);
    let a1 = h * h / qts + h / ql;
    let a0 = h * h;

    let mut low = 10.0_f64;
    let mut high = 500.0_f64;
    for _ in 0..24 {
        let mid = (low + high) / 2.0;
        let y = mid / fs;
        let real = y.powi(4) - a2 * y * y + a0;
        let imag = a1 * y - a3 * y.powi(3);
        let mag = y.powi(4) / (real * real + imag * imag + 1e-20).sqrt();
        if mag < 0.70710678 {
            low = mid;
        } else {
            high = mid;
        }
    }
    (low + high) / 2.0
}

#[wasm_bindgen]
#[derive(Clone, Copy)]
pub struct OptimalPortWasm {
    pub num_ports: u32,
    pub diameter: f64,
    pub length: f64,
    pub v_peak: f64,
    pub fits_in_box: bool,
    pub d_min_silent: f64,
}

#[wasm_bindgen]
pub fn calc_puerto_optimo(
    vb: f64,
    fb: f64,
    sd: f64,
    xmax: f64,
    flared_ends: u8,
    min_len_cm: f64,
    max_len_cm: f64,
) -> OptimalPortWasm {
    let sd_val = if sd > 0.0 { sd } else { 215.0 };
    let xmax_val = if xmax > 0.0 { xmax } else { 4.0 };
    let fb_val = if fb > 0.0 { fb } else { 40.0 };
    let vb_val = if vb > 0.0 { vb } else { 35.0 };

    let target_silent_vel = if flared_ends >= 2 { 12.0 } else { 9.5 };
    let d_silent_total = ((0.008 * fb_val * sd_val * xmax_val) / target_silent_vel).sqrt();
    let d_min_total = ((0.008 * fb_val * sd_val * xmax_val) / 16.0).sqrt();

    let commercial = [4.0_f64, 5.0, 6.5, 7.5, 8.5, 10.0, 12.5, 15.0];
    let mut candidates: Vec<OptimalPortWasm> = Vec::new();

    for num_ports in 1..=3_u32 {
        let n_sqrt = (num_ports as f64).sqrt();
        let exact_silent = ((d_silent_total / n_sqrt) * 10.0).round() / 10.0;
        let exact_min = ((d_min_total / n_sqrt) * 10.0).round() / 10.0;

        let mut test_dias = vec![exact_silent, exact_min];
        test_dias.extend_from_slice(&commercial);
        test_dias.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        test_dias.dedup_by(|a, b| (*a - *b).abs() < 0.05);

        for dia in test_dias {
            if !(2.5..=20.0).contains(&dia) {
                continue;
            }
            let lv = calc_longitud_puerto(vb_val, fb_val, dia, flared_ends, num_ports);
            let v_peak = calc_velocidad_puerto(fb_val, sd_val, xmax_val, num_ports, dia);
            let fits_in_box = lv >= min_len_cm && lv <= max_len_cm;
            candidates.push(OptimalPortWasm {
                num_ports,
                diameter: dia,
                length: lv,
                v_peak,
                fits_in_box,
                d_min_silent: d_silent_total,
            });
        }
    }

    // Prioridad 1: cabe en la caja y flujo silencioso (v_peak <= 10.0)
    if let Some(best) = candidates
        .iter()
        .filter(|c| c.fits_in_box && c.v_peak <= 10.0)
        .min_by(|a, b| {
            a.num_ports
                .cmp(&b.num_ports)
                .then_with(|| a.diameter.partial_cmp(&b.diameter).unwrap_or(std::cmp::Ordering::Equal))
        })
    {
        return *best;
    }

    // Prioridad 2: cabe en la caja y velocidad moderada (v_peak <= 17.0)
    if let Some(best) = candidates
        .iter()
        .filter(|c| c.fits_in_box && c.v_peak <= 17.0)
        .min_by(|a, b| {
            a.v_peak
                .partial_cmp(&b.v_peak)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.num_ports.cmp(&b.num_ports))
        })
    {
        return *best;
    }

    // Prioridad 3: cualquiera que quepa en la caja con menor velocidad
    if let Some(best) = candidates
        .iter()
        .filter(|c| c.fits_in_box)
        .min_by(|a, b| a.v_peak.partial_cmp(&b.v_peak).unwrap_or(std::cmp::Ordering::Equal))
    {
        return *best;
    }

    let fallback_dia = ((d_min_total.max(4.0)) * 10.0).round() / 10.0;
    let fallback_lv = calc_longitud_puerto(vb_val, fb_val, fallback_dia, flared_ends, 1);
    OptimalPortWasm {
        num_ports: 1,
        diameter: fallback_dia,
        length: fallback_lv,
        v_peak: calc_velocidad_puerto(fb_val, sd_val, xmax_val, 1, fallback_dia),
        fits_in_box: fallback_lv >= min_len_cm && fallback_lv <= max_len_cm,
        d_min_silent: d_silent_total,
    }
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



