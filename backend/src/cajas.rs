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
pub fn calc_box_ql(vb: f64, classical_model: bool) -> f64 {
    if classical_model {
        7.0
    } else {
        (7.0 * (50.0 / vb.max(1.0)).powf(0.22)).clamp(5.0, 20.0)
    }
}

#[wasm_bindgen]
pub fn calc_box_qa(damping_level: u8, classical_model: bool) -> f64 {
    if classical_model {
        1e9
    } else {
        match damping_level {
            0 => 100.0,
            1 => 50.0,
            2 => 15.0,
            _ => 6.0,
        }
    }
}

#[wasm_bindgen]
pub fn calc_box_qb(vb: f64, damping_level: u8, classical_model: bool) -> f64 {
    if classical_model {
        7.0
    } else {
        let ql = calc_box_ql(vb, false);
        let qa = calc_box_qa(damping_level, false);
        1.0 / (1.0 / ql + 1.0 / qa)
    }
}

#[wasm_bindgen]
pub fn calc_sealed_qtc_eff(
    qts: f64,
    alpha: f64,
    vb: f64,
    damping_level: u8,
    classical_model: bool,
) -> f64 {
    let qtc_lossless = qts * (alpha + 1.0).sqrt();
    if classical_model || alpha <= 0.0 {
        qtc_lossless
    } else {
        let qb = calc_box_qb(vb, damping_level, false);
        let inv_qtc = 1.0 / qtc_lossless.max(1e-6) + (alpha / (1.0 + alpha)) / qb.max(1e-6);
        1.0 / inv_qtc
    }
}

#[wasm_bindgen]
pub fn calc_caja_sellada(fs: f64, vas: f64, qts: f64, vb_target: f64, qtc_target: f64) -> SealedResult {
    calc_caja_sellada_ex(fs, vas, qts, vb_target, qtc_target, 0, true)
}

#[wasm_bindgen]
pub fn calc_caja_sellada_ex(
    fs: f64,
    vas: f64,
    qts: f64,
    vb_target: f64,
    qtc_target: f64,
    damping_level: u8,
    classical_model: bool,
) -> SealedResult {
    // Evitar divisiones por cero o valores negativos
    let vb_t = if vb_target <= 0.0 { 1.0 } else { vb_target };
    let qts_val = if qts <= 0.0 { 0.001 } else { qts };
    let fs_val = if fs <= 0.0 { 0.0 } else { fs };
    
    let alpha = (vas / vb_t).max(0.0);
    let qtc = calc_sealed_qtc_eff(qts_val, alpha, vb_t, damping_level, classical_model);
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
    calc_f3_ventilada_ex(fs, qts, vb, fb, vas, 0, true)
}

#[wasm_bindgen]
pub fn calc_f3_ventilada_ex(
    fs: f64,
    qts: f64,
    vb: f64,
    fb: f64,
    vas: f64,
    damping_level: u8,
    classical_model: bool,
) -> f64 {
    if fs <= 0.0 || qts <= 0.0 || vb <= 0.0 || fb <= 0.0 || vas <= 0.0 {
        return 0.0;
    }
    let h = fb / fs;
    let alpha = vas / vb;
    let ql = calc_box_qb(vb, damping_level, classical_model);

    let a3 = 1.0 / qts + h / ql;
    let a2 = 1.0 + h * h * (1.0 + alpha) + h / (qts * ql);
    let a1 = h * h / qts + h / ql;
    let a0 = h * h;

    let eval_mag = |freq: f64| -> f64 {
        let y = freq / fs;
        let real = y.powi(4) - a2 * y * y + a0;
        let imag = a1 * y - a3 * y.powi(3);
        y.powi(4) / (real * real + imag * imag + 1e-20).sqrt()
    };

    // Seguimiento descendente desde la banda de paso hasta el primer cruce absoluto a -3 dB
    let start_f = (fs * 8.0).max(500.0);
    let min_f = 5.0_f64;
    let mut prev_f = start_f;
    if eval_mag(prev_f) < std::f64::consts::FRAC_1_SQRT_2 {
        return prev_f;
    }

    let mut curr_f = prev_f * 0.99;
    while curr_f >= min_f {
        if eval_mag(curr_f) < std::f64::consts::FRAC_1_SQRT_2 {
            let mut low = curr_f;
            let mut high = prev_f;
            for _ in 0..20 {
                let mid = (low + high) / 2.0;
                if eval_mag(mid) < std::f64::consts::FRAC_1_SQRT_2 {
                    low = mid;
                } else {
                    high = mid;
                }
            }
            return (low + high) / 2.0;
        }
        prev_f = curr_f;
        curr_f *= 0.99;
    }

    min_f
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

    let commercial = [4.0_f64, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 10.0, 12.0, 15.0];
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

    // Ratio de área saludable para prevenir soplidos y desacoplamiento subsónico
    // Para altavoces de 10" o más (Sd >= 280), se requiere al menos 12% de área respecto al cono
    let min_safe_ratio = if sd_val >= 280.0 {
        0.12
    } else if sd_val >= 180.0 {
        0.10
    } else {
        0.07
    };

    let target_v = target_silent_vel.max(9.5);

    // Prioridad 1: Cabe en la caja, flujo silencioso (< 10-12 m/s) Y ratio de área seguro (entre min_safe_ratio y 30% Sd)
    let tier1_candidates: Vec<&OptimalPortWasm> = candidates
        .iter()
        .filter(|c| {
            if !c.fits_in_box || c.v_peak > target_v {
                return false;
            }
            let total_area = (c.num_ports as f64) * std::f64::consts::PI * (c.diameter / 2.0).powi(2);
            let ratio = total_area / sd_val;
            ratio >= min_safe_ratio && ratio <= 0.30
        })
        .collect();

    if let Some(best) = tier1_candidates.iter().min_by(|a, b| {
        let max_l = if max_len_cm > 0.0 { max_len_cm } else { 35.0 };
        let score_a = a.v_peak * 2.0 + (a.num_ports as f64 - 1.0) * 1.5 + (a.length / max_l) * 2.0;
        let score_b = b.v_peak * 2.0 + (b.num_ports as f64 - 1.0) * 1.5 + (b.length / max_l) * 2.0;
        score_a.partial_cmp(&score_b).unwrap_or(std::cmp::Ordering::Equal)
    }) {
        return **best;
    }

    // Prioridad 2: Cabe en la caja y flujo silencioso (v_peak <= target_v), ratio <= 30% Sd
    if let Some(best) = candidates
        .iter()
        .filter(|c| {
            if !c.fits_in_box || c.v_peak > target_v {
                return false;
            }
            let total_area = (c.num_ports as f64) * std::f64::consts::PI * (c.diameter / 2.0).powi(2);
            let ratio = total_area / sd_val;
            ratio <= 0.30
        })
        .min_by(|a, b| {
            let total_area_a = (a.num_ports as f64) * std::f64::consts::PI * (a.diameter / 2.0).powi(2);
            let total_area_b = (b.num_ports as f64) * std::f64::consts::PI * (b.diameter / 2.0).powi(2);
            let ratio_a = total_area_a / sd_val;
            let ratio_b = total_area_b / sd_val;
            let score_a = a.v_peak * 2.5 - ratio_a * 15.0 + (a.num_ports as f64 - 1.0) * 1.0;
            let score_b = b.v_peak * 2.5 - ratio_b * 15.0 + (b.num_ports as f64 - 1.0) * 1.0;
            score_a.partial_cmp(&score_b).unwrap_or(std::cmp::Ordering::Equal)
        })
    {
        return *best;
    }

    // Prioridad 3: Cabe en la caja y velocidad moderada sin soplido crítico (v_peak <= 17.0 m/s), ratio <= 32%
    if let Some(best) = candidates
        .iter()
        .filter(|c| {
            if !c.fits_in_box || c.v_peak > 17.0 {
                return false;
            }
            let total_area = (c.num_ports as f64) * std::f64::consts::PI * (c.diameter / 2.0).powi(2);
            let ratio = total_area / sd_val;
            ratio <= 0.32
        })
        .min_by(|a, b| {
            a.v_peak
                .partial_cmp(&b.v_peak)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.num_ports.cmp(&b.num_ports))
        })
    {
        return *best;
    }

    // Prioridad 4: Cualquiera que quepa en la caja con ratio razonable y menor velocidad de aire
    if let Some(best) = candidates
        .iter()
        .filter(|c| {
            if !c.fits_in_box {
                return false;
            }
            let total_area = (c.num_ports as f64) * std::f64::consts::PI * (c.diameter / 2.0).powi(2);
            let ratio = total_area / sd_val;
            ratio <= 0.35
        })
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
    pub active_hp: bool,
    pub hp_fx: f64,
    pub hp_qx: f64,
    pub clamped_to_min_vol: bool,
}

/// Coeficientes continuos por tramos (Keele): (kv, pv, kf, pf, c_vas)
fn keele_vented_coeffs(qts: f64) -> (f64, f64, f64, f64, f64) {
    let (kv, pv) = if qts > 0.49 {
        (6.427, 1.943)
    } else if qts > 0.313 {
        (18.029, 3.365)
    } else {
        (6.096, 2.432)
    };

    let (kf, pf) = if qts > 0.49 {
        (0.457, 0.766)
    } else if qts > 0.383 {
        (0.397, 0.963)
    } else if qts > 0.259 {
        (0.428, 0.883)
    } else {
        (0.3985, 0.940)
    };

    let c_vas = if qts > 0.75 {
        12.0 + ((qts - 0.75) / 0.05) * 1.6
    } else if qts > 0.49 {
        6.5 + ((qts - 0.49) / 0.05) * 1.1
    } else if qts > 0.313 {
        18.029
    } else {
        6.096
    };

    (kv, pv, kf, pf, c_vas)
}

#[wasm_bindgen]
pub fn calc_suggest_fb(fs: f64, vas: f64, qts: f64, vb: f64) -> f64 {
    if fs <= 0.0 || vas <= 0.0 || qts <= 0.0 || vb <= 0.0 {
        return 0.0;
    }
    let (_, pv, kf, pf, c_vas) = keele_vented_coeffs(qts);
    kf * fs * ((c_vas * vas) / vb).powf(pf / pv)
}

#[wasm_bindgen]
pub fn calc_f3_ventilada_b6(
    fs: f64,
    qts: f64,
    vb: f64,
    fb: f64,
    vas: f64,
    fx: f64,
    qx: f64,
) -> f64 {
    calc_f3_ventilada_b6_ex(fs, qts, vb, fb, vas, fx, qx, 0, true)
}

#[wasm_bindgen]
pub fn calc_f3_ventilada_b6_ex(
    fs: f64,
    qts: f64,
    vb: f64,
    fb: f64,
    vas: f64,
    fx: f64,
    qx: f64,
    damping_level: u8,
    classical_model: bool,
) -> f64 {
    if fs <= 0.0 || qts <= 0.0 || vb <= 0.0 || fb <= 0.0 || vas <= 0.0 || fx <= 0.0 || qx <= 0.0 {
        return 0.0;
    }
    let h = fb / fs;
    let alpha = vas / vb;
    let ql = calc_box_qb(vb, damping_level, classical_model);

    let a3 = 1.0 / qts + h / ql;
    let a2 = 1.0 + h * h * (1.0 + alpha) + h / (qts * ql);
    let a1 = h * h / qts + h / ql;
    let a0 = h * h;

    let eval_mag = |freq: f64| -> f64 {
        let y = freq / fs;
        let real = y.powi(4) - a2 * y * y + a0;
        let imag = a1 * y - a3 * y.powi(3);
        let vented_mag = y.powi(4) / (real * real + imag * imag + 1e-20).sqrt();

        let r = freq / fx;
        let hp = (r * r) / ((1.0 - r * r).powi(2) + (r / qx).powi(2) + 1e-20).sqrt();
        vented_mag * hp
    };

    let start_f = (fs * 8.0).max(500.0);
    let min_f = 5.0_f64;
    let mut prev_f = start_f;
    if eval_mag(prev_f) < std::f64::consts::FRAC_1_SQRT_2 {
        return prev_f;
    }

    let mut curr_f = prev_f * 0.99;
    while curr_f >= min_f {
        if eval_mag(curr_f) < std::f64::consts::FRAC_1_SQRT_2 {
            let mut low = curr_f;
            let mut high = prev_f;
            for _ in 0..20 {
                let mid = (low + high) / 2.0;
                if eval_mag(mid) < std::f64::consts::FRAC_1_SQRT_2 {
                    low = mid;
                } else {
                    high = mid;
                }
            }
            return (low + high) / 2.0;
        }
        prev_f = curr_f;
        curr_f *= 0.99;
    }

    min_f
}

#[wasm_bindgen]
pub fn calc_alineacion_ventilada(fs: f64, vas: f64, qts: f64, tipo: &str) -> VentedAlignment {
    calc_alineacion_ventilada_ex(fs, vas, qts, tipo, 0.0)
}

#[wasm_bindgen]
pub fn calc_alineacion_ventilada_ex(
    fs: f64,
    vas: f64,
    qts: f64,
    tipo: &str,
    vb_min: f64,
) -> VentedAlignment {
    calc_alineacion_ventilada_model(fs, vas, qts, tipo, vb_min, 0, true)
}

#[wasm_bindgen]
pub fn calc_alineacion_ventilada_model(
    fs: f64,
    vas: f64,
    qts: f64,
    tipo: &str,
    vb_min: f64,
    damping_level: u8,
    classical_model: bool,
) -> VentedAlignment {
    let qts_val = if qts <= 0.0 { 0.001 } else { qts };
    let fs_val = if fs <= 0.0 { 0.0 } else { fs };
    let vas_val = if vas <= 0.0 { 0.0 } else { vas };

    if fs_val <= 0.0 || vas_val <= 0.0 {
        return VentedAlignment {
            vb: 0.0,
            fb: 0.0,
            f3: 0.0,
            active_hp: false,
            hp_fx: 0.0,
            hp_qx: 0.0,
            clamped_to_min_vol: false,
        };
    }

    let (kv, pv, kf, pf, _) = keele_vented_coeffs(qts_val);
    let mut active_hp = false;
    let mut hp_fx = 0.0;
    let mut hp_qx = 0.0;

    let (mut vb, mut fb) = match tipo {
        "B4" => {
            let vb_hifi = kv * vas_val * qts_val.powf(pv);
            let fb_hifi = kf * fs_val * qts_val.powf(-pf);
            (vb_hifi, fb_hifi)
        }
        "SBB4" => {
            let vb_ext = 12.3 * vas_val * qts_val.powf(2.4);
            let fb_ext = calc_suggest_fb(fs_val, vas_val, qts_val, vb_ext);
            (vb_ext, fb_ext)
        }
        "B6" => {
            let vb_b6 = 4.1 * vas_val * qts_val.powi(2);
            let fb_b6 = ((0.30 / qts_val) * fs_val).clamp(fs_val * 0.45, fs_val * 1.4);
            active_hp = true;
            hp_fx = 1.07 * fb_b6;
            hp_qx = 1.93;
            (vb_b6, fb_b6)
        }
        "COMPACT" => {
            if qts_val <= 0.45 {
                let vb_c = (15.0 * qts_val.powf(2.87) * vas_val)
                    .clamp(vas_val * 0.25, vas_val * 1.5);
                let fb_c = ((vas_val / vb_c.max(1e-6)).powf(0.31) * fs_val)
                    .clamp(fs_val * 0.86, fs_val * 1.30);
                (vb_c, fb_c)
            } else {
                let vb_c = (vas_val * (1.20 - (qts_val - 0.45) * 2.5))
                    .clamp(vas_val * 0.55, vas_val * 1.25);
                let fb_c = ((vas_val / vb_c.max(1e-6)).powf(0.31) * fs_val)
                    .clamp(fs_val * 0.92, fs_val * 1.30);
                (vb_c, fb_c)
            }
        }
        _ => {
            // High Output (QB3): Qtc objetivo -> alpha -> Vb = Vas / alpha
            let qtc_target = if qts_val > 0.75 {
                0.8 + ((qts_val - 0.75) / 0.35) * 0.3
            } else {
                0.8
            };
            let qtc_eff = qtc_target.max(qts_val + 0.01);
            let alpha = (qtc_eff / qts_val).powi(2) - 1.0;
            let vb_out = (vas_val / alpha.max(1e-6)).max(vas_val * 0.12);
            let fb_out = calc_suggest_fb(fs_val, vas_val, qts_val, vb_out);
            (vb_out, fb_out)
        }
    };

    let mut clamped_to_min_vol = false;
    if vb_min > 0.0 && vb < vb_min {
        let vb_opt = vb;
        vb = vb_min;
        fb *= (vb_opt / vb_min).powf(0.125);
        clamped_to_min_vol = true;
        if active_hp {
            hp_fx = 1.07 * fb;
        }
    }

    let f3 = if active_hp {
        calc_f3_ventilada_b6_ex(fs_val, qts_val, vb, fb, vas_val, hp_fx, hp_qx, damping_level, classical_model)
    } else {
        calc_f3_ventilada_ex(fs_val, qts_val, vb, fb, vas_val, damping_level, classical_model)
    };

    VentedAlignment {
        vb,
        fb,
        f3,
        active_hp,
        hp_fx,
        hp_qx,
        clamped_to_min_vol,
    }
}

#[wasm_bindgen]
pub struct DesiredF3Result {
    pub valid: bool,
    pub vb: f64,
    pub fb_or_fc: f64,
    pub qtc: f64,
    pub f3: f64,
    /// 0 = ok, 1 = too_low, 2 = too_high, 3 = invalid
    pub status_code: u8,
}

#[wasm_bindgen]
pub fn calc_sealed_for_f3(fs: f64, vas: f64, qts: f64, target_f3: f64) -> DesiredF3Result {
    calc_sealed_for_f3_ex(fs, vas, qts, target_f3, 0, true)
}

#[wasm_bindgen]
pub fn calc_sealed_for_f3_ex(
    fs: f64,
    vas: f64,
    qts: f64,
    target_f3: f64,
    damping_level: u8,
    classical_model: bool,
) -> DesiredF3Result {
    if fs <= 0.0 || vas <= 0.0 || qts <= 0.0 || target_f3 <= 0.0 {
        return DesiredF3Result {
            valid: false,
            vb: 0.0,
            fb_or_fc: 0.0,
            qtc: 0.0,
            f3: 0.0,
            status_code: 3,
        };
    }

    let eval_qtc = |qtc_lossless: f64| -> (f64, SealedResult) {
        let denom = (qtc_lossless / qts).powi(2) - 1.0;
        let vb = if denom > 1e-9 { vas / denom } else { vas * 1e4 };
        let res = calc_caja_sellada_ex(fs, vas, qts, vb, qtc_lossless, damping_level, classical_model);
        (vb, res)
    };

    let qtc_min = (qts + 0.02).max(0.2);
    let qtc_max = 2.5_f64.max(qtc_min + 0.2);

    // Buscar mínimo de F3(Qtc) escaneando [qtc_min, qtc_max] en pasos de 0.01
    let mut best_qtc = qtc_min;
    let (_, mut best_res) = eval_qtc(qtc_min);
    let mut q = qtc_min + 0.01;
    while q <= qtc_max + 1e-9 {
        let (_, r) = eval_qtc(q);
        if r.f3 < best_res.f3 {
            best_res = r;
            best_qtc = q;
        }
        q += 0.01;
    }

    if target_f3 < best_res.f3 - 0.1 {
        return DesiredF3Result {
            valid: false,
            vb: 0.0,
            fb_or_fc: 0.0,
            qtc: 0.0,
            f3: best_res.f3,
            status_code: 1,
        };
    }

    let (_, res_at_min_qtc) = eval_qtc(qtc_min);
    let (_, res_at_max_qtc) = eval_qtc(qtc_max);

    if target_f3 > res_at_max_qtc.f3.max(res_at_min_qtc.f3) + 0.1 {
        return DesiredF3Result {
            valid: false,
            vb: 0.0,
            fb_or_fc: 0.0,
            qtc: 0.0,
            f3: res_at_max_qtc.f3,
            status_code: 2,
        };
    }

    // Preferir rama Hi-Fi [qtc_min, best_qtc] si alcanza el F3 objetivo; si no, rama compacta [best_qtc, qtc_max]
    let (mut lo, mut hi, decreasing) = if best_qtc > qtc_min + 0.005
        && target_f3 <= res_at_min_qtc.f3 + 0.1
        && target_f3 >= best_res.f3 - 0.1
    {
        (qtc_min, best_qtc, true)
    } else {
        (best_qtc, qtc_max, false)
    };

    for _ in 0..40 {
        let mid = 0.5 * (lo + hi);
        let (_, r) = eval_qtc(mid);
        if decreasing {
            if r.f3 > target_f3 {
                lo = mid;
            } else {
                hi = mid;
            }
        } else if r.f3 < target_f3 {
            lo = mid;
        } else {
            hi = mid;
        }
    }

    let qtc_sol = 0.5 * (lo + hi);
    let (vb_sol, final_res) = eval_qtc(qtc_sol);

    DesiredF3Result {
        valid: true,
        vb: vb_sol,
        fb_or_fc: final_res.fc,
        qtc: final_res.qtc,
        f3: final_res.f3,
        status_code: 0,
    }
}

#[wasm_bindgen]
pub fn calc_vented_for_f3(fs: f64, vas: f64, qts: f64, target_f3: f64) -> DesiredF3Result {
    calc_vented_for_f3_ex(fs, vas, qts, target_f3, 0, true)
}

#[wasm_bindgen]
pub fn calc_vented_for_f3_ex(
    fs: f64,
    vas: f64,
    qts: f64,
    target_f3: f64,
    damping_level: u8,
    classical_model: bool,
) -> DesiredF3Result {
    if fs <= 0.0 || vas <= 0.0 || qts <= 0.0 || target_f3 <= 0.0 {
        return DesiredF3Result {
            valid: false,
            vb: 0.0,
            fb_or_fc: 0.0,
            qtc: 0.0,
            f3: 0.0,
            status_code: 3,
        };
    }

    let eval_vb = |vb: f64| -> (f64, f64) {
        let fb = calc_suggest_fb(fs, vas, qts, vb);
        let f3 = calc_f3_ventilada_ex(fs, qts, vb, fb, vas, damping_level, classical_model);
        (fb, f3)
    };

    let vb_low = (vas * 0.08).max(0.5);
    let vb_high = (vas * 10.0).max(500.0);
    let lo_ln_all = vb_low.ln();
    let hi_ln_all = vb_high.ln();

    // F3(Vb) desciende hasta un mínimo (antes de que un Vb gigante cree un valle > 3 dB sobre Fb).
    // Muestrear en escala logarítmica para localizar el mínimo y el tramo monótono [vb_low, vb_at_min].
    const SAMPLES: usize = 80;
    let mut sample_ln = Vec::with_capacity(SAMPLES + 1);
    let mut sample_f3 = Vec::with_capacity(SAMPLES + 1);
    let mut min_idx = 0_usize;
    let mut f3_min = f64::INFINITY;
    let mut f3_max = 0.0_f64;

    for i in 0..=SAMPLES {
        let frac = (i as f64) / (SAMPLES as f64);
        let ln_v = lo_ln_all + frac * (hi_ln_all - lo_ln_all);
        let (_, f3_val) = eval_vb(ln_v.exp());
        if f3_val < f3_min {
            f3_min = f3_val;
            min_idx = i;
        }
        if f3_val > f3_max {
            f3_max = f3_val;
        }
        sample_ln.push(ln_v);
        sample_f3.push(f3_val);
    }

    if target_f3 < f3_min - 0.2 {
        return DesiredF3Result {
            valid: false,
            vb: 0.0,
            fb_or_fc: 0.0,
            qtc: 0.0,
            f3: f3_min,
            status_code: 1,
        };
    }

    let f3_at_small = sample_f3[0];
    if target_f3 > f3_at_small.max(f3_max) + 0.2 {
        return DesiredF3Result {
            valid: false,
            vb: 0.0,
            fb_or_fc: 0.0,
            qtc: 0.0,
            f3: f3_at_small,
            status_code: 2,
        };
    }

    // Buscar primer intervalo en [0..=min_idx] que cruce target_f3 (caja más práctica)
    let mut lo_ln = sample_ln[0];
    let mut hi_ln = sample_ln[min_idx];
    let mut found_bracket = false;
    for i in 0..min_idx {
        let a = sample_f3[i] - target_f3;
        let b = sample_f3[i + 1] - target_f3;
        if (a >= 0.0 && b <= 0.0) || (a <= 0.0 && b >= 0.0) {
            lo_ln = sample_ln[i];
            hi_ln = sample_ln[i + 1];
            found_bracket = true;
            break;
        }
    }

    if !found_bracket {
        // Fallback al rango [min_idx..=SAMPLES] si el usuario pidió un F3 alto en la rama ascendente
        for i in min_idx..SAMPLES {
            let a = sample_f3[i] - target_f3;
            let b = sample_f3[i + 1] - target_f3;
            if (a >= 0.0 && b <= 0.0) || (a <= 0.0 && b >= 0.0) {
                lo_ln = sample_ln[i];
                hi_ln = sample_ln[i + 1];
                found_bracket = true;
                break;
            }
        }
    }

    if !found_bracket {
        let vb_best = sample_ln[min_idx].exp();
        let (fb_best, f3_best) = eval_vb(vb_best);
        return DesiredF3Result {
            valid: (f3_best - target_f3).abs() < 0.5,
            vb: vb_best,
            fb_or_fc: fb_best,
            qtc: 0.0,
            f3: f3_best,
            status_code: if f3_best > target_f3 { 1 } else { 2 },
        };
    }

    let increasing = eval_vb(hi_ln.exp()).1 > eval_vb(lo_ln.exp()).1;
    for _ in 0..40 {
        let mid_ln = 0.5 * (lo_ln + hi_ln);
        let (_, f3_mid) = eval_vb(mid_ln.exp());
        if increasing {
            if f3_mid < target_f3 {
                lo_ln = mid_ln;
            } else {
                hi_ln = mid_ln;
            }
        } else if f3_mid > target_f3 {
            lo_ln = mid_ln;
        } else {
            hi_ln = mid_ln;
        }
    }

    let vb_sol = (0.5 * (lo_ln + hi_ln)).exp();
    let (fb_sol, f3_sol) = eval_vb(vb_sol);

    DesiredF3Result {
        valid: true,
        vb: vb_sol,
        fb_or_fc: fb_sol,
        qtc: 0.0,
        f3: f3_sol,
        status_code: 0,
    }
}

#[wasm_bindgen]
pub fn calc_vented_fb_for_f3_ex(
    fs: f64,
    vas: f64,
    qts: f64,
    vb: f64,
    target_f3: f64,
    damping_level: u8,
    classical_model: bool,
) -> DesiredF3Result {
    if fs <= 0.0 || vas <= 0.0 || qts <= 0.0 || vb <= 0.0 || target_f3 <= 0.0 {
        return DesiredF3Result {
            valid: false,
            vb: 0.0,
            fb_or_fc: 0.0,
            qtc: 0.0,
            f3: 0.0,
            status_code: 3,
        };
    }

    let eval_fb = |fb: f64| -> f64 {
        calc_f3_ventilada_ex(fs, qts, vb, fb, vas, damping_level, classical_model)
    };

    let fb_low = (fs * 0.35).max(12.0);
    let fb_high = (fs * 2.5).max(fb_low * 1.5);
    let lo_ln_all = fb_low.ln();
    let hi_ln_all = fb_high.ln();

    const SAMPLES: usize = 80;
    let mut sample_ln = Vec::with_capacity(SAMPLES + 1);
    let mut sample_f3 = Vec::with_capacity(SAMPLES + 1);
    let mut min_idx = 0_usize;
    let mut f3_min = f64::INFINITY;
    let mut f3_max = 0.0_f64;

    for i in 0..=SAMPLES {
        let frac = (i as f64) / (SAMPLES as f64);
        let ln_f = lo_ln_all + frac * (hi_ln_all - lo_ln_all);
        let f3_val = eval_fb(ln_f.exp());
        if f3_val < f3_min {
            f3_min = f3_val;
            min_idx = i;
        }
        if f3_val > f3_max {
            f3_max = f3_val;
        }
        sample_ln.push(ln_f);
        sample_f3.push(f3_val);
    }

    if target_f3 < f3_min - 0.2 {
        return DesiredF3Result {
            valid: false,
            vb,
            fb_or_fc: 0.0,
            qtc: 0.0,
            f3: f3_min,
            status_code: 1,
        };
    }

    if target_f3 > f3_max + 0.2 {
        return DesiredF3Result {
            valid: false,
            vb,
            fb_or_fc: 0.0,
            qtc: 0.0,
            f3: f3_max,
            status_code: 2,
        };
    }

    let mut lo_ln = sample_ln[0];
    let mut hi_ln = sample_ln[SAMPLES];
    let mut found_bracket = false;
    // Preferir rama [0..=min_idx] y luego [min_idx..=SAMPLES]
    for &(start, end) in &[(0_usize, min_idx), (min_idx, SAMPLES)] {
        if found_bracket {
            break;
        }
        for i in start..end {
            let a = sample_f3[i] - target_f3;
            let b = sample_f3[i + 1] - target_f3;
            if (a >= 0.0 && b <= 0.0) || (a <= 0.0 && b >= 0.0) {
                lo_ln = sample_ln[i];
                hi_ln = sample_ln[i + 1];
                found_bracket = true;
                break;
            }
        }
    }

    if !found_bracket {
        let fb_best = sample_ln[min_idx].exp();
        let f3_best = eval_fb(fb_best);
        return DesiredF3Result {
            valid: (f3_best - target_f3).abs() < 0.5,
            vb,
            fb_or_fc: fb_best,
            qtc: 0.0,
            f3: f3_best,
            status_code: if f3_best > target_f3 { 1 } else { 2 },
        };
    }

    let increasing = eval_fb(hi_ln.exp()) > eval_fb(lo_ln.exp());
    for _ in 0..40 {
        let mid_ln = 0.5 * (lo_ln + hi_ln);
        let f3_mid = eval_fb(mid_ln.exp());
        if increasing {
            if f3_mid < target_f3 {
                lo_ln = mid_ln;
            } else {
                hi_ln = mid_ln;
            }
        } else if f3_mid > target_f3 {
            lo_ln = mid_ln;
        } else {
            hi_ln = mid_ln;
        }
    }

    let fb_sol = (0.5 * (lo_ln + hi_ln)).exp();
    let f3_sol = eval_fb(fb_sol);

    DesiredF3Result {
        valid: true,
        vb,
        fb_or_fc: fb_sol,
        qtc: 0.0,
        f3: f3_sol,
        status_code: 0,
    }
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
    // Vr es la cámara trasera sellada con factor Qtc = S
    let vr = if denom <= 0.0 { 0.0 } else { vas_val / denom };
    // Vf es la cámara frontal sintonizada según alineación simétrica Dickason/Keele
    let vf = (2.0 * s_val * qts_val).powi(2) * vas_val;
    let fb = fs_val * (s_val / qts_val);
    let f0 = fb;
    let delta_f = (fs_val / qts_val) * s_val;

    Bandpass4Result { vf, vr, fb, f0, delta_f }
}

#[wasm_bindgen]
pub fn calc_bandpass_4_df(
    fs: f64,
    vas: f64,
    qts: f64,
    df: f64,
    qt_prime: f64,
) -> Bandpass4Result {
    let qts_val = if qts <= 0.0 { 0.001 } else { qts };
    let fs_val = if fs <= 0.0 { 0.0 } else { fs };
    let vas_val = if vas <= 0.0 { 0.0 } else { vas };

    if fs_val <= 0.0 || vas_val <= 0.0 {
        return Bandpass4Result {
            vf: 0.0,
            vr: 0.0,
            fb: 0.0,
            f0: 0.0,
            delta_f: 0.0,
        };
    }

    let df_val = if df > 0.0 { df } else { 0.65 };
    let qt_base = if qt_prime > 0.0 {
        qt_prime
    } else {
        (qts_val + 0.1).max(0.8)
    };
    let qt_val = qt_base.max(qts_val + 0.01);

    let denom = (qt_val / qts_val).powi(2) - 1.0;
    let vr = if denom <= 0.0 { 0.0 } else { vas_val / denom };
    let vf = (2.0 * df_val * qts_val).powi(2) * vas_val;
    let fb = fs_val * (qt_val / qts_val);
    let f0 = fb;
    let delta_f = (fs_val / qts_val) * df_val;

    Bandpass4Result {
        vf,
        vr,
        fb,
        f0,
        delta_f,
    }
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

#[wasm_bindgen]
pub fn calc_bandpass_6_topology(
    fs: f64,
    vas: f64,
    qts: f64,
    topology: &str,
) -> Bandpass6Result {
    if fs <= 0.0 || vas <= 0.0 || qts <= 0.0 {
        return Bandpass6Result {
            vf: 0.0,
            vr: 0.0,
            fh: 0.0,
            fl: 0.0,
        };
    }

    let (kv, pv, kf, pf, _) = keele_vented_coeffs(qts);
    let vb_base = kv * vas * qts.powf(pv);
    let fb_base = kf * fs * qts.powf(-pf);

    if topology == "series" {
        let (m_fl, m_vf, m_vr) = if qts <= 0.2 {
            let t = qts / 0.2;
            (0.925 - t * 0.05, 1.17 - t * 0.34, 0.78 - t * 0.10)
        } else if qts <= 0.3 {
            let t = (qts - 0.2) / 0.1;
            (0.875 - t * 0.025, 0.83 - t * 0.27, 0.68 + t * 0.11)
        } else if qts <= 0.4 {
            let t = (qts - 0.3) / 0.1;
            (0.85 - t * 0.08, 0.56 - t * 0.25, 0.79 + t * 0.11)
        } else if qts <= 0.5 {
            let t = (qts - 0.4) / 0.1;
            (0.77 - t * 0.07, 0.31 - t * 0.11, 0.90 + t * 0.12)
        } else if qts <= 0.6 {
            let t = (qts - 0.5) / 0.1;
            (0.70 - t * 0.075, 0.20 - t * 0.03, 1.02 + t * 0.04)
        } else if qts <= 0.7 {
            let t = (qts - 0.6) / 0.1;
            (0.625 - t * 0.075, 0.17 - t * 0.01, 1.06 + t * 0.05)
        } else {
            let t = ((qts - 0.7) / 0.1).min(3.0);
            ((0.55 - t * 0.05).max(0.35), 0.16, 1.11)
        };

        let vr = (vb_base * m_vr).max(0.5);
        let vf = (vb_base * m_vf).max(0.5);
        let fl = (fb_base * m_fl).max(15.0);
        let fh = (fl * 2.5).max(fl * 1.4);
        Bandpass6Result { vf, vr, fh, fl }
    } else {
        let (vb_ratio, fb_ratio) = if qts <= 0.2 {
            (1.3 + (qts / 0.3) * 0.15, 2.83 - (qts / 0.2) * 0.58)
        } else if qts <= 0.3 {
            (
                1.3 + (qts / 0.3) * 0.15,
                2.25 - ((qts - 0.2) / 0.1) * 0.15,
            )
        } else if qts <= 0.5 {
            (
                1.5 + ((qts - 0.3) / 0.2) * 1.0,
                2.10 - ((qts - 0.3) / 0.2) * 0.25,
            )
        } else if qts <= 0.6 {
            (2.5 + ((qts - 0.5) / 0.1) * 0.9, 1.85)
        } else {
            (3.4, 1.85)
        };

        let vr = vb_base.max(0.5);
        let vf = (vr / vb_ratio).max(0.5);
        let fl = fb_base.max(15.0);
        let fh = fl * fb_ratio;
        Bandpass6Result { vf, vr, fh, fl }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct PortOptionRust {
    pub num_ports: u32,
    pub diameter: f64,
    pub length: f64,
    pub is_custom: bool,
    #[serde(rename = "vPeak")]
    pub v_peak: f64,
    #[serde(rename = "areaRatio")]
    pub area_ratio: f64,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct PortSuggestionsRust {
    pub valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(rename = "dMin", skip_serializing_if = "Option::is_none")]
    pub d_min: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<PortOptionRust>>,
}

#[wasm_bindgen]
pub fn suggest_port_config(
    vb: f64,
    fb: f64,
    sd: f64,
    xmax: f64,
    flared_ends: u8,
    min_length: f64,
) -> Result<JsValue, JsValue> {
    if sd <= 0.0 || xmax <= 0.0 || vb <= 0.0 || fb <= 0.0 {
        let res = PortSuggestionsRust {
            valid: false,
            reason: Some("Ingresa parámetros válidos (Sd, Xmax, Vb, Fb) para recibir sugerencias de puertos sin ruido de viento.".to_string()),
            d_min: None,
            options: None,
        };
        return serde_wasm_bindgen::to_value(&res).map_err(|e| JsValue::from_str(&e.to_string()));
    }

    let make_option = |num_ports: u32, diameter: f64, length: f64, is_custom: bool| -> PortOptionRust {
        let v_peak = ((0.008 * fb * sd * xmax) / ((num_ports as f64) * diameter * diameter) * 10.0).round() / 10.0;
        let area_total = (num_ports as f64) * std::f64::consts::PI * (diameter / 2.0).powi(2);
        let area_ratio = ((area_total / sd) * 1000.0).round() / 10.0;
        PortOptionRust {
            num_ports,
            diameter,
            length: (length * 10.0).round() / 10.0,
            is_custom,
            v_peak,
            area_ratio,
        }
    };

    let target_vel = if flared_ends >= 2 { 13.0 } else { 10.0 };
    let d_min_silent = ((0.008 * fb * sd * xmax) / target_vel).sqrt();

    let mut all_candidates: Vec<PortOptionRust> = Vec::new();

    // Tamaños estándar comerciales para 1 puerto
    let standard_1 = [4.5, 5.0, 6.0, 6.8, 7.5, 8.2, 9.0, 10.0];
    // Tamaños estándar comerciales para 2 puertos
    let standard_2 = [4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5];

    let min_l = min_length.max(2.8);
    let max_l = 45.0; // Máxima longitud viable en caja sin codos imposibles

    // 1) Evaluar candidatos para 1 puerto
    let mut dias_1 = vec![(d_min_silent * 10.0).round() / 10.0];
    dias_1.extend_from_slice(&standard_1);
    dias_1.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    dias_1.dedup_by(|a, b| (*a - *b).abs() < 0.2);

    for dia in dias_1 {
        let total_area = std::f64::consts::PI * (dia / 2.0).powi(2);
        let ratio = total_area / sd;
        // Restricción acústica estricta: el área total del puerto nunca debe exceder el 30% del cono
        if !(0.07..=0.30).contains(&ratio) {
            continue;
        }
        let lv = calc_longitud_puerto(vb, fb, dia, flared_ends, 1);
        let v_peak = (0.008 * fb * sd * xmax) / (dia * dia);
        if lv >= min_l && lv <= max_l && v_peak <= 17.0 {
            all_candidates.push(make_option(1, dia, lv, !standard_1.contains(&dia)));
        }
    }

    // 2) Evaluar candidatos para 2 puertos
    let d_opt2 = ((d_min_silent / 2.0_f64.sqrt()) * 10.0).round() / 10.0;
    let mut dias_2 = vec![d_opt2];
    dias_2.extend_from_slice(&standard_2);
    dias_2.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    dias_2.dedup_by(|a, b| (*a - *b).abs() < 0.2);

    for dia in dias_2 {
        let total_area = 2.0 * std::f64::consts::PI * (dia / 2.0).powi(2);
        let ratio = total_area / sd;
        if !(0.07..=0.30).contains(&ratio) {
            continue;
        }
        let lv = calc_longitud_puerto(vb, fb, dia, flared_ends, 2);
        let v_peak = (0.008 * fb * sd * xmax) / (2.0 * dia * dia);
        if lv >= min_l && lv <= max_l && v_peak <= 17.0 {
            all_candidates.push(make_option(2, dia, lv, !standard_2.contains(&dia)));
        }
    }

    // Seleccionar y ordenar las mejores opciones
    let mut opts_1: Vec<PortOptionRust> = all_candidates.iter().filter(|c| c.num_ports == 1).cloned().collect();
    let mut opts_2: Vec<PortOptionRust> = all_candidates.iter().filter(|c| c.num_ports == 2).cloned().collect();

    let score = |c: &PortOptionRust| -> f64 {
        // Velocidad ideal entre 6.0 y 11.0 m/s (zona silenciosa óptima). Penalizar turbulencia > 12 m/s o sobredimensionamiento < 5 m/s
        let vel_pen = if c.v_peak > 12.0 {
            (c.v_peak - 12.0) * 4.0
        } else if c.v_peak < 5.0 {
            (5.0 - c.v_peak) * 1.5
        } else {
            (c.v_peak - 8.5).abs() * 0.4
        };
        // Longitud práctica ideal en caja entre 8 y 22 cm
        let len_pen = if c.length > 25.0 {
            (c.length - 25.0) * 0.6
        } else if c.length < 6.0 {
            (6.0 - c.length) * 1.2
        } else {
            0.0
        };
        // Premiar ratio de área balanceado entre 10% y 24% de Sd
        let ratio_pen = if c.area_ratio < 10.0 {
            (10.0 - c.area_ratio) * 0.6
        } else if c.area_ratio > 25.0 {
            (c.area_ratio - 25.0) * 0.6
        } else {
            -2.5 // bonus por relación cono-conducto óptima
        };

        vel_pen + len_pen + ratio_pen
    };

    opts_1.sort_by(|a, b| score(a).partial_cmp(&score(b)).unwrap_or(std::cmp::Ordering::Equal));
    opts_2.sort_by(|a, b| score(a).partial_cmp(&score(b)).unwrap_or(std::cmp::Ordering::Equal));

    let mut final_options = Vec::new();
    for opt in opts_1.into_iter().take(2) {
        final_options.push(opt);
    }
    for opt in opts_2.into_iter().take(2) {
        final_options.push(opt);
    }

    if final_options.is_empty() {
        for dia in [5.0, 6.0, 7.5, 8.5] {
            let lv = calc_longitud_puerto(vb, fb, dia, flared_ends, 1);
            let area = std::f64::consts::PI * (dia / 2.0).powi(2);
            let ratio = area / sd;
            if ratio <= 0.32 && lv >= 2.0 {
                final_options.push(make_option(1, dia, lv, false));
                break;
            }
        }
    }

    let res = PortSuggestionsRust {
        valid: !final_options.is_empty(),
        reason: if final_options.is_empty() {
            Some("No se encontraron tubos estándar con longitud viable para este volumen y sintonía. Considera ajustar Fb o usar radiador pasivo.".to_string())
        } else {
            None
        },
        d_min: Some((d_min_silent * 10.0).round() / 10.0),
        options: Some(final_options),
    };
    serde_wasm_bindgen::to_value(&res).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub struct VolumenNetoResult {
    pub v_bruto: f64,
    pub v_extra: f64,
    pub v_port: f64,
    pub v_neto_fisico: f64,
    pub v_neto_acustico: f64,
    pub port_length: f64,
    pub exceeds_depth: bool,
}

#[wasm_bindgen]
pub fn calc_volumen_neto_madera(
    v_bruto: f64,
    v_extra: f64,
    box_type: &str,
    fb: f64,
    num_ports: u32,
    port_dia: f64,
    flared_ends: u8,
    max_depth_cm: f64,
    use_custom_port_len: bool,
    custom_port_len: f64,
    damping_factor: f64,
) -> VolumenNetoResult {
    let bruto = v_bruto.max(0.0);
    let extra = v_extra.max(0.0);
    let v_base = (bruto - extra).max(0.05);
    let dfactor = if damping_factor > 0.0 { damping_factor } else { 1.0 };

    if box_type != "ported" || num_ports == 0 || port_dia <= 0.0 {
        let v_fisico = v_base;
        let v_acustico = v_fisico * dfactor;
        return VolumenNetoResult {
            v_bruto: bruto,
            v_extra: extra,
            v_port: 0.0,
            v_neto_fisico: v_fisico,
            v_neto_acustico: v_acustico,
            port_length: 0.0,
            exceeds_depth: false,
        };
    }

    let n_ports = num_ports as f64;
    let area_one = std::f64::consts::PI * (port_dia / 2.0).powi(2);
    let area_total = n_ports * area_one;
    let max_in_len = if max_depth_cm > 4.0 { (max_depth_cm - 3.5).max(2.0) } else { 35.0 };

    if use_custom_port_len && custom_port_len > 0.0 {
        let lv = custom_port_len;
        let in_box_len = lv.min(max_in_len);
        let max_allowed_port_vol = v_base * 0.15;
        let v_port = (area_total * in_box_len / 1000.0).min(max_allowed_port_vol);
        let v_fisico = (v_base - v_port).max(0.1);
        let v_acustico = v_fisico * dfactor;
        return VolumenNetoResult {
            v_bruto: bruto,
            v_extra: extra,
            v_port,
            v_neto_fisico: v_fisico,
            v_neto_acustico: v_acustico,
            port_length: lv,
            exceeds_depth: lv > max_in_len,
        };
    }

    // Cálculo convergente amortiguado para sintonía automática Fb:
    // Evita bucles divergentes acotando la penetración física del tubo y el volumen desplazado
    let fb_val = if fb > 0.0 { fb } else { 45.0 };
    let mut current_acustico = v_base * dfactor;
    let mut final_lv = 0.0;
    let mut final_vport = 0.0;

    for _ in 0..8 {
        let lv_calc = calc_longitud_puerto(current_acustico, fb_val, port_dia, flared_ends, num_ports);
        let in_box_len = lv_calc.min(max_in_len);
        let max_allowed_port_vol = v_base * 0.12;
        let v_port = (area_total * in_box_len / 1000.0).min(max_allowed_port_vol);
        let v_fisico = (v_base - v_port).max(v_base * 0.85); // Un puerto nunca resta más del 15% del volumen libre
        let next_acustico = v_fisico * dfactor;

        final_lv = lv_calc;
        final_vport = v_port;

        if (next_acustico - current_acustico).abs() < 0.01 {
            break;
        }
        current_acustico = 0.5 * current_acustico + 0.5 * next_acustico;
    }

    let v_fisico = (v_base - final_vport).max(0.1);
    let v_acustico = v_fisico * dfactor;

    VolumenNetoResult {
        v_bruto: bruto,
        v_extra: extra,
        v_port: final_vport,
        v_neto_fisico: v_fisico,
        v_neto_acustico: v_acustico,
        port_length: final_lv,
        exceeds_depth: final_lv > max_in_len,
    }
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

    #[test]
    fn test_calc_volumen_neto_madera_estabilidad() {
        // Caso del usuario: caja 55 x 30 x 30 con 18mm madera:
        // Int: 51.4 x 26.4 x 26.4 cm => 35.79 L bruto. Extra: 3.5 L.
        // Diámetro 15 cm a 50 Hz. Antes colapsaba a 2.07 L y 1013 cm!
        let res = calc_volumen_neto_madera(
            35.79,
            3.5,
            "ported",
            50.0,
            1,
            15.0,
            0,
            26.4,
            false,
            0.0,
            1.0,
        );

        // El volumen neto físico debe ser realista (~28 L a 32.3 L) y NUNCA 2.07 L
        assert!(res.v_neto_fisico > 25.0, "v_neto_fisico colapsó: {}", res.v_neto_fisico);
        assert!(res.v_neto_fisico <= 32.3);
        assert!(res.exceeds_depth, "Un tubo de 15cm a 50Hz en 32L debe marcar exceeds_depth");
    }

    #[test]
    fn test_calc_volumen_neto_madera_puerto_normal() {
        // Puerto normal de 7.5 cm en caja de 35.79 L bruto, 3.5 L extra
        let res = calc_volumen_neto_madera(
            35.79,
            3.5,
            "ported",
            50.0,
            1,
            7.5,
            0,
            26.4,
            false,
            0.0,
            1.0,
        );

        assert!(res.v_neto_fisico > 30.0 && res.v_neto_fisico <= 32.3);
        assert!(!res.exceeds_depth);
        assert!(res.port_length > 8.0 && res.port_length < 20.0);
    }

    #[test]
    fn test_vented_keele_alignments() {
        let fs = 40.0;
        let vas = 100.0;

        // B4 Keele tabla por tramos
        let b4_25 = calc_alineacion_ventilada(fs, vas, 0.25, "B4");
        assert!((b4_25.vb - 6.096 * vas * 0.25_f64.powf(2.432)).abs() < 1e-4);
        assert!((b4_25.fb - 0.3985 * fs * 0.25_f64.powf(-0.940)).abs() < 1e-4);

        let b4_35 = calc_alineacion_ventilada(fs, vas, 0.35, "B4");
        assert!((b4_35.vb - 18.029 * vas * 0.35_f64.powf(3.365)).abs() < 1e-4);
        assert!((b4_35.fb - 0.428 * fs * 0.35_f64.powf(-0.883)).abs() < 1e-4);

        let b4_40 = calc_alineacion_ventilada(fs, vas, 0.40, "B4");
        assert!((b4_40.vb - 18.029 * vas * 0.40_f64.powf(3.365)).abs() < 1e-4);
        assert!((b4_40.fb - 0.397 * fs * 0.40_f64.powf(-0.963)).abs() < 1e-4);

        let b4_55 = calc_alineacion_ventilada(fs, vas, 0.55, "B4");
        assert!((b4_55.vb - 6.427 * vas * 0.55_f64.powf(1.943)).abs() < 1e-4);
        assert!((b4_55.fb - 0.457 * fs * 0.55_f64.powf(-0.766)).abs() < 1e-4);

        // SBB4 Extended Bass: 12.3 * Vas * Qts^2.4
        let sbb4 = calc_alineacion_ventilada(fs, vas, 0.38, "SBB4");
        assert!((sbb4.vb - 12.3 * vas * 0.38_f64.powf(2.4)).abs() < 1e-4);
        assert!(!sbb4.active_hp);

        // QB3 High Output
        let qb3 = calc_alineacion_ventilada(fs, vas, 0.38, "QB3");
        assert!(qb3.vb > 0.0 && qb3.vb < b4_40.vb);
        assert!(qb3.fb > b4_40.fb);

        // B6 Active HP
        let b6 = calc_alineacion_ventilada(fs, vas, 0.40, "B6");
        assert!(b6.active_hp);
        assert!((b6.vb - 4.1 * vas * 0.40_f64.powi(2)).abs() < 1e-4);
        assert!((b6.hp_fx - 1.07 * b6.fb).abs() < 1e-4);
        assert!((b6.hp_qx - 1.93).abs() < 1e-6);

        // COMPACT
        let compact = calc_alineacion_ventilada(fs, vas, 0.55, "COMPACT");
        assert!(compact.vb <= vas * 1.25 && compact.vb >= vas * 0.55);

        // Clamp a vb_min con exponente 0.125
        let vb_min = 35.0;
        let clamped = calc_alineacion_ventilada_ex(fs, vas, 0.25, "B4", vb_min);
        assert!(clamped.clamped_to_min_vol);
        assert!((clamped.vb - vb_min).abs() < 1e-6);
        let expected_fb = b4_25.fb * (b4_25.vb / vb_min).powf(0.125);
        assert!((clamped.fb - expected_fb).abs() < 1e-4);
    }

    #[test]
    fn test_desired_f3_solvers() {
        let fs = 40.0;
        let vas = 80.0;
        let qts = 0.38;

        // Sellada alcanzable (para Fs=40, Qts=0.38 el F3 mínimo sellado es ~74.4 Hz)
        let ok_s = calc_sealed_for_f3(fs, vas, qts, 85.0);
        assert!(ok_s.valid && ok_s.status_code == 0);
        assert!((ok_s.f3 - 85.0).abs() < 0.5);
        assert!(ok_s.vb > 0.0);

        // Sellada demasiado baja
        let low_s = calc_sealed_for_f3(fs, vas, qts, 20.0);
        assert!(!low_s.valid && low_s.status_code == 1);

        // Sellada demasiado alta
        let high_s = calc_sealed_for_f3(fs, vas, qts, 300.0);
        assert!(!high_s.valid && high_s.status_code == 2);

        // Ventilada alcanzable
        let ok_v = calc_vented_for_f3(fs, vas, qts, 42.0);
        assert!(ok_v.valid && ok_v.status_code == 0);
        assert!((ok_v.f3 - 42.0).abs() < 0.5);
        assert!(ok_v.vb > 0.0 && ok_v.fb_or_fc > 0.0);

        // Ventilada demasiado baja
        let low_v = calc_vented_for_f3(fs, vas, qts, 8.0);
        assert!(!low_v.valid && low_v.status_code == 1);

        // Ventilada demasiado alta
        let high_v = calc_vented_for_f3(fs, vas, qts, 350.0);
        assert!(!high_v.valid && high_v.status_code == 2);
    }

    #[test]
    fn test_bandpass_variants() {
        let bp4 = calc_bandpass_4_df(38.0, 70.0, 0.36, 0.0, 0.0);
        assert!(bp4.vf > 0.0 && bp4.vr > 0.0 && bp4.fb > 0.0);

        for &qts in &[0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80] {
            let par = calc_bandpass_6_topology(38.0, 70.0, qts, "parallel");
            assert!(par.vf.is_finite() && par.vf > 0.0);
            assert!(par.vr.is_finite() && par.vr > 0.0);
            assert!(par.fh > par.fl && par.fl > 0.0, "parallel invertida en qts={qts}");

            let ser = calc_bandpass_6_topology(38.0, 70.0, qts, "series");
            assert!(ser.vf.is_finite() && ser.vf > 0.0);
            assert!(ser.vr.is_finite() && ser.vr > 0.0);
            assert!(ser.fh > ser.fl && ser.fl > 0.0, "series invertida en qts={qts}");
        }
    }

    #[test]
    fn test_box_losses_ql_qa_qb() {
        // QL(Vb) monótonamente decreciente con Vb y acotado a [5, 20]
        let ql_small = calc_box_ql(5.0, false);
        let ql_50 = calc_box_ql(50.0, false);
        let ql_large = calc_box_ql(500.0, false);
        assert!(ql_small > ql_50 && ql_50 > ql_large);
        assert!((ql_50 - 7.0).abs() < 1e-6);
        assert!(ql_small <= 20.0 && ql_large >= 5.0);
        assert_eq!(calc_box_ql(12.0, true), 7.0);

        // Qa decreciente con nivel de relleno
        let qa0 = calc_box_qa(0, false);
        let qa1 = calc_box_qa(1, false);
        let qa2 = calc_box_qa(2, false);
        let qa3 = calc_box_qa(3, false);
        assert!(qa0 > qa1 && qa1 > qa2 && qa2 > qa3);
        assert!(calc_box_qa(3, true) > 1e8);

        // Diferencia Modelo Térmico vs Clásico en sellada y ventilada
        let s_classic = calc_caja_sellada_ex(38.0, 45.0, 0.36, 30.0, 0.707, 3, true);
        let s_bb = calc_caja_sellada_ex(38.0, 45.0, 0.36, 30.0, 0.707, 3, false);
        assert!(s_bb.qtc < s_classic.qtc, "La absorción debe amortiguar Qtc");
        assert!(s_bb.f3 != s_classic.f3);

        let f3_classic = calc_f3_ventilada_ex(40.0, 0.38, 60.0, 38.0, 80.0, 3, true);
        let f3_bb = calc_f3_ventilada_ex(40.0, 0.38, 60.0, 38.0, 80.0, 3, false);
        assert!((f3_bb - f3_classic).abs() > 0.1);
    }

    #[test]
    fn test_desired_f3_ex_and_fixed_vb_fb() {
        let fs = 28.0;
        let vas = 80.0;
        let qts = 0.48;

        // Sellada con relleno moderado (damping=2, classical=false): Vb devuelto debe reproducir F3
        let s_bb = calc_sealed_for_f3_ex(fs, vas, qts, 52.9, 2, false);
        assert!(s_bb.valid && s_bb.status_code == 0);
        assert!((s_bb.f3 - 52.9).abs() < 0.25);
        let verify_s = calc_caja_sellada_ex(fs, vas, qts, s_bb.vb, s_bb.qtc, 2, false);
        assert!((verify_s.f3 - s_bb.f3).abs() < 1e-4);

        // Ventilada con relleno
        let v_bb = calc_vented_for_f3_ex(fs, vas, qts, 32.0, 1, false);
        assert!(v_bb.valid && v_bb.status_code == 0);
        assert!((v_bb.f3 - 32.0).abs() < 0.25);

        // Ventilada con Vb fijo resolviendo solo Fb
        let vb_fixed = 55.0;
        let fb_only = calc_vented_fb_for_f3_ex(fs, vas, qts, vb_fixed, 34.0, 0, false);
        assert!(fb_only.valid && fb_only.status_code == 0);
        assert!((fb_only.vb - vb_fixed).abs() < 1e-9);
        assert!((fb_only.f3 - 34.0).abs() < 0.25);
        let verify_f3 = calc_f3_ventilada_ex(fs, qts, vb_fixed, fb_only.fb_or_fc, vas, 0, false);
        assert!((verify_f3 - fb_only.f3).abs() < 1e-4);
    }
}



