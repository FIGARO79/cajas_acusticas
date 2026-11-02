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
        if mag < std::f64::consts::FRAC_1_SQRT_2 {
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
}

#[wasm_bindgen]
pub fn calc_alineacion_ventilada(fs: f64, vas: f64, qts: f64, tipo: &str) -> VentedAlignment {
    let qts_val = if qts <= 0.0 { 0.001 } else { qts };
    let fs_val = if fs <= 0.0 { 0.0 } else { fs };
    let vas_val = if vas <= 0.0 { 0.0 } else { vas };

    let (mut vb, mut fb, mut f3) = match tipo {
        "SBB4" => (
            11.0 * qts_val.powf(2.87) * vas_val,
            0.38 * qts_val.powf(-0.95) * fs_val,
            0.38 * qts_val.powf(-0.95) * fs_val,
        ),
        "B4" => (
            0.25 * qts_val.powf(-2.0) * vas_val,
            fs_val,
            fs_val,
        ),
        _ => (
            6.27 * qts_val.powf(1.44) * vas_val,
            0.94 * qts_val.powf(-0.9) * fs_val,
            1.2 * qts_val.powf(-0.9) * fs_val,
        ),
    };

    // Para altavoces con Qts moderado a alto (Qts >= 0.40):
    // La fórmula teórica de alineaciones como QB3 proyecta un Fb excesivo (hasta 2x Fs) y un Vb gigante
    // generando un pico resonante ("joroba") en la respuesta de graves y tubos de sintonía inviables.
    // Acotamos acústicamente Fb y Vb para mantener una respuesta controlada y factible.
    if qts_val >= 0.45 {
        fb = fb.min(fs_val * 1.05).max(fs_val * 0.85);
        vb = vb.min(vas_val * 1.5).max(vas_val * 0.35);
        f3 = f3.min(fs_val * 1.25);
    } else if qts_val >= 0.40 {
        fb = fb.min(fs_val * 1.18);
        vb = vb.min(vas_val * 2.0);
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
}



