//! Cálculos de curvas de respuesta en frecuencia, excursión, velocidad, impedancia, fase y retardo de grupo.
use js_sys::Array;
use wasm_bindgen::prelude::*;

pub fn default_chart_frequencies() -> Vec<f64> {
    let mut freqs = Vec::with_capacity(101);
    for i in 0..=100 {
        let base = 500.0_f64 / 10.0_f64;
        let exponent = i as f64 / 100.0_f64;
        let f = 10.0_f64 * base.powf(exponent);
        freqs.push((f * 10.0_f64).round() / 10.0_f64);
    }
    freqs
}

#[wasm_bindgen]
pub struct DriverMechResult {
    pub re: f64,
    pub bl: f64,
    pub mms: f64,
    pub cms: f64,
    pub sd_m2: f64,
}

#[wasm_bindgen]
pub fn calc_driver_mechanicals(
    re: f64,
    fs: f64,
    qes: f64,
    vas: f64,
    sd_cm2: f64,
    mms_g: f64,
    cms_mm_n: f64,
    bl_tm: f64,
) -> DriverMechResult {
    let (re, bl, mms, cms, sd_m2) = driver_mechanicals(re, fs, qes, vas, sd_cm2, mms_g, cms_mm_n, bl_tm);
    DriverMechResult {
        re,
        bl,
        mms,
        cms,
        sd_m2,
    }
}

pub fn driver_mechanicals(
    re: f64,
    fs: f64,
    qes: f64,
    vas: f64,
    sd_cm2: f64,
    mms_g: f64,
    cms_mm_n: f64,
    bl_tm: f64,
) -> (f64, f64, f64, f64, f64) {
    let re_v = if re > 0.0 { re } else { 6.0 };
    let fs_v = if fs > 0.0 { fs } else { 38.0 };
    let qes_v = if qes > 0.0 { qes } else { 0.45 };
    let vas_l = if vas > 0.0 { vas } else { 45.0 };
    let sd_m2 = (if sd_cm2 > 0.0 { sd_cm2 } else { 215.0 }) * 1e-4;

    let cms = if cms_mm_n > 0.0 {
        cms_mm_n * 1e-3
    } else {
        (vas_l * 1e-3) / (1.204 * 344.0_f64.powi(2) * sd_m2.powi(2))
    };

    let mms = if mms_g > 0.0 {
        mms_g * 1e-3
    } else {
        1.0 / ((2.0 * std::f64::consts::PI * fs_v).powi(2) * cms)
    };

    let bl = if bl_tm > 0.0 {
        bl_tm
    } else {
        ((2.0 * std::f64::consts::PI * fs_v * mms * re_v) / qes_v).sqrt()
    };

    (re_v, bl, mms, cms, sd_m2)
}

#[wasm_bindgen]
pub fn calc_sealed_response_at(f: f64, fs: f64, qts: f64, vas: f64, vb: f64) -> f64 {
    if f <= 0.0 || vb <= 0.0 || fs <= 0.0 || qts <= 0.0 {
        return -45.0;
    }
    let alpha = vas / vb;
    let fc = fs * (alpha + 1.0).sqrt();
    let qtc = qts * (alpha + 1.0).sqrt();
    let fn_ = f / fc;
    let response = fn_.powi(2) / (((fn_.powi(2) - 1.0).powi(2) + (fn_ / qtc).powi(2) + 1e-20).sqrt());
    20.0 * (response + 1e-10).log10()
}

#[wasm_bindgen]
pub fn calc_ported_response_at(f: f64, fs: f64, qts: f64, vas: f64, vb: f64, fb: f64) -> f64 {
    if f <= 0.0 || vb <= 0.0 || fs <= 0.0 || qts <= 0.0 || fb <= 0.0 {
        return -45.0;
    }
    let h = fb / fs;
    let alpha = vas / vb;
    let ql = 7.0;
    let a3 = 1.0 / qts + h / ql;
    let a2 = 1.0 + h * h * (1.0 + alpha) + h / (qts * ql);
    let a1 = h * h / qts + h / ql;
    let a0 = h * h;
    let y = f / fs;
    let real = y.powi(4) - a2 * y * y + a0;
    let imag = a1 * y - a3 * y.powi(3);
    let response = y.powi(4) / ((real * real + imag * imag + 1e-20).sqrt());
    20.0 * (response + 1e-10).log10()
}

#[wasm_bindgen]
pub fn calc_bandpass4_response_at(f: f64, fs: f64, qts: f64, vas: f64, vf: f64, vr: f64, fb: f64) -> f64 {
    if f <= 0.0 || vf <= 0.0 || vr <= 0.0 || fb <= 0.0 || fs <= 0.0 || qts <= 0.0 {
        return -45.0;
    }
    let h = fb / fs;
    let alpha_f = vas / vf;
    let alpha_r = vas / vr;
    let ql = 7.0;
    let a3 = 1.0 / qts + h / ql;
    let a2 = 1.0 + h * h * (1.0 + alpha_r) + alpha_f + h / (qts * ql);
    let a1 = h * h / qts + (h / ql) * (1.0 + alpha_f);
    let a0 = h * h;
    let y = f / fs;
    let real = y.powi(4) - a2 * y * y + a0;
    let imag = a1 * y - a3 * y.powi(3);
    let denom = (real * real + imag * imag + 1e-20).sqrt();
    let response = (y * y * alpha_f) / denom;
    20.0 * (response + 1e-10).log10()
}

#[wasm_bindgen]
pub fn calc_bandpass6_response_at(f: f64, vas: f64, vf: f64, vr: f64, fl: f64, fh: f64) -> f64 {
    if f <= 0.0 || vf <= 0.0 || vr <= 0.0 || fl <= 0.0 || fh <= 0.0 {
        return -45.0;
    }
    let q = 0.707;
    let y_l = f / fl;
    let den_l = ((1.0 - y_l * y_l).powi(2) + (y_l / q).powi(2) + 1e-20).sqrt();
    let hp = (y_l * y_l) / den_l;

    let y_h = f / fh;
    let den_h = ((1.0 - y_h * y_h).powi(2) + (y_h / q).powi(2) + 1e-20).sqrt();
    let lp = 1.0 / den_h;

    let alpha = vas / (vf + vr);
    let response = hp * lp * (1.0 + alpha).sqrt();
    20.0 * (response + 1e-10).log10()
}

#[wasm_bindgen]
pub fn calc_sealed_curve(fs: f64, qts: f64, vas: f64, vb: f64, valid: bool) -> Array {
    let freqs = default_chart_frequencies();
    calc_sealed_curve_custom(&freqs, fs, qts, vas, vb, valid)
}

#[wasm_bindgen]
pub fn calc_sealed_curve_custom(freqs: &[f64], fs: f64, qts: f64, vas: f64, vb: f64, valid: bool) -> Array {
    let result = Array::new();
    if !valid || vb <= 0.0 {
        return result;
    }
    for &f in freqs {
        let db = calc_sealed_response_at(f, fs, qts, vas, vb);
        let val = (db * 100.0_f64).round() / 100.0_f64;
        result.push(&JsValue::from_f64(val));
    }
    result
}

#[wasm_bindgen]
pub fn calc_ported_curve(fs: f64, qts: f64, vas: f64, vb: f64, fb: f64, valid: bool) -> Array {
    let freqs = default_chart_frequencies();
    calc_ported_curve_custom(&freqs, fs, qts, vas, vb, fb, valid)
}

#[wasm_bindgen]
pub fn calc_ported_curve_custom(freqs: &[f64], fs: f64, qts: f64, vas: f64, vb: f64, fb: f64, valid: bool) -> Array {
    let result = Array::new();
    if !valid || vb <= 0.0 {
        return result;
    }
    for &f in freqs {
        let db = calc_ported_response_at(f, fs, qts, vas, vb, fb);
        let val = (db * 100.0_f64).round() / 100.0_f64;
        result.push(&JsValue::from_f64(val));
    }
    result
}

#[wasm_bindgen]
pub fn calc_bandpass4_curve(
    fs: f64,
    qts: f64,
    vas: f64,
    vf: f64,
    vr: f64,
    fb: f64,
    valid: bool,
) -> Array {
    let freqs = default_chart_frequencies();
    calc_bandpass4_curve_custom(&freqs, fs, qts, vas, vf, vr, fb, valid)
}

#[wasm_bindgen]
pub fn calc_bandpass4_curve_custom(
    freqs: &[f64],
    fs: f64,
    qts: f64,
    vas: f64,
    vf: f64,
    vr: f64,
    fb: f64,
    valid: bool,
) -> Array {
    let result = Array::new();
    if !valid || vf <= 0.0 || vr <= 0.0 || fb <= 0.0 {
        return result;
    }
    for &f in freqs {
        let db = calc_bandpass4_response_at(f, fs, qts, vas, vf, vr, fb);
        let val = (db * 100.0_f64).round() / 100.0_f64;
        result.push(&JsValue::from_f64(val));
    }
    result
}

#[wasm_bindgen]
pub fn calc_bandpass6_curve(
    _fs: f64,
    _qts: f64,
    vas: f64,
    vf: f64,
    vr: f64,
    fl: f64,
    fh: f64,
    valid: bool,
) -> Array {
    let freqs = default_chart_frequencies();
    calc_bandpass6_curve_custom(&freqs, vas, vf, vr, fl, fh, valid)
}

#[wasm_bindgen]
pub fn calc_bandpass6_curve_custom(
    freqs: &[f64],
    vas: f64,
    vf: f64,
    vr: f64,
    fl: f64,
    fh: f64,
    valid: bool,
) -> Array {
    let result = Array::new();
    if !valid || vf <= 0.0 || vr <= 0.0 || fl <= 0.0 || fh <= 0.0 {
        return result;
    }
    for &f in freqs {
        let db = calc_bandpass6_response_at(f, vas, vf, vr, fl, fh);
        let val = (db * 100.0_f64).round() / 100.0_f64;
        result.push(&JsValue::from_f64(val));
    }
    result
}

#[wasm_bindgen]
pub fn calc_excursion_cono(
    f: f64,
    fs: f64,
    qts: f64,
    qes: f64,
    vas: f64,
    re: f64,
    sd: f64,
    mms: f64,
    cms: f64,
    bl: f64,
    vb: f64,
    fb: f64,
    is_ported: bool,
    power_watts: f64,
) -> f64 {
    if f <= 0.0 || vb <= 0.0 {
        return 0.0;
    }
    let fs_v = if fs > 0.0 { fs } else { 38.0 };
    let qts_v = if qts > 0.0 { qts } else { 0.38 };
    let vas_v = if vas > 0.0 { vas } else { 45.0 };
    let (re_m, bl_m, mms_m, _cms_m, _sd_m2) =
        driver_mechanicals(re, fs_v, qes, vas_v, sd, mms, cms, bl);
    let eg = (power_watts.max(0.1) * re_m).sqrt();
    let pi2_4 = 4.0 * std::f64::consts::PI.powi(2);

    if !is_ported {
        let alpha = vas_v / vb;
        let fc = fs_v * (1.0 + alpha).sqrt();
        let qtc = qts_v * (1.0 + alpha).sqrt();
        let denom = ((f.powi(2) - fc.powi(2)).powi(2) + ((f * fc) / qtc).powi(2) + 1e-18).sqrt();
        let x_m = (eg * (bl_m / re_m) / (mms_m * pi2_4)) * (1.0 / denom);
        (x_m * 1000.0).max(0.0)
    } else {
        let h = fb / fs_v;
        let alpha = vas_v / vb;
        let ql = 7.0;
        let a3 = 1.0 / qts_v + h / ql;
        let a2 = 1.0 + h * h * (1.0 + alpha) + h / (qts_v * ql);
        let a1 = (h * h) / qts_v + h / ql;
        let a0 = h * h;

        let y = f / fs_v;
        let real = y.powi(4) - a2 * y.powi(2) + a0;
        let imag = a1 * y - a3 * y.powi(3);
        let denom = (real * real + imag * imag + 1e-18).sqrt();
        let num_x = (y.powi(2) - h.powi(2)).abs();
        let x_m = (eg * (bl_m / re_m) / (mms_m * pi2_4 * fs_v.powi(2))) * (num_x / denom);
        (x_m * 1000.0).max(0.0)
    }
}

#[wasm_bindgen]
pub fn calc_excursion_curve(
    fs: f64,
    qts: f64,
    qes: f64,
    vas: f64,
    re: f64,
    sd: f64,
    mms: f64,
    cms: f64,
    bl: f64,
    vb: f64,
    fb: f64,
    is_ported: bool,
    power_watts: f64,
    valid: bool,
) -> Array {
    let freqs = default_chart_frequencies();
    calc_excursion_curve_custom(&freqs, fs, qts, qes, vas, re, sd, mms, cms, bl, vb, fb, is_ported, power_watts, valid)
}

#[wasm_bindgen]
pub fn calc_excursion_curve_custom(
    freqs: &[f64],
    fs: f64,
    qts: f64,
    qes: f64,
    vas: f64,
    re: f64,
    sd: f64,
    mms: f64,
    cms: f64,
    bl: f64,
    vb: f64,
    fb: f64,
    is_ported: bool,
    power_watts: f64,
    valid: bool,
) -> Array {
    let result = Array::new();
    if !valid || vb <= 0.0 {
        return result;
    }
    for &f in freqs {
        let val = calc_excursion_cono(f, fs, qts, qes, vas, re, sd, mms, cms, bl, vb, fb, is_ported, power_watts);
        let rounded = (val * 100.0_f64).round() / 100.0_f64;
        result.push(&JsValue::from_f64(rounded));
    }
    result
}

#[wasm_bindgen]
pub fn calc_velocidad_aire_frec(
    f: f64,
    fs: f64,
    qts: f64,
    qes: f64,
    vas: f64,
    re: f64,
    sd: f64,
    mms: f64,
    cms: f64,
    bl: f64,
    vb: f64,
    fb: f64,
    port_area_m2: f64,
    power_watts: f64,
) -> f64 {
    if f <= 0.0 || vb <= 0.0 || fb <= 0.0 || port_area_m2 <= 0.0 {
        return 0.0;
    }
    let fs_v = if fs > 0.0 { fs } else { 38.0 };
    let qts_v = if qts > 0.0 { qts } else { 0.38 };
    let vas_v = if vas > 0.0 { vas } else { 45.0 };
    let (re_m, bl_m, mms_m, _cms_m, sd_m2) =
        driver_mechanicals(re, fs_v, qes, vas_v, sd, mms, cms, bl);
    let eg = (power_watts.max(0.1) * re_m).sqrt();

    let h = fb / fs_v;
    let alpha = vas_v / vb;
    let ql = 7.0;
    let a3 = 1.0 / qts_v + h / ql;
    let a2 = 1.0 + h * h * (1.0 + alpha) + h / (qts_v * ql);
    let a1 = (h * h) / qts_v + h / ql;
    let a0 = h * h;

    let y = f / fs_v;
    let real = y.powi(4) - a2 * y.powi(2) + a0;
    let imag = a1 * y - a3 * y.powi(3);
    let denom = (real * real + imag * imag + 1e-18).sqrt();

    let u_port = (eg * (bl_m / re_m) * sd_m2 / (mms_m * 2.0 * std::f64::consts::PI * fs_v))
        * (h.powi(2) / denom);
    (u_port / port_area_m2).max(0.0)
}

#[wasm_bindgen]
pub fn calc_air_velocity_curve(
    fs: f64,
    qts: f64,
    qes: f64,
    vas: f64,
    re: f64,
    sd: f64,
    mms: f64,
    cms: f64,
    bl: f64,
    vb: f64,
    fb: f64,
    port_area_m2: f64,
    power_watts: f64,
    valid: bool,
) -> Array {
    let freqs = default_chart_frequencies();
    calc_air_velocity_curve_custom(&freqs, fs, qts, qes, vas, re, sd, mms, cms, bl, vb, fb, port_area_m2, power_watts, valid)
}

#[wasm_bindgen]
pub fn calc_air_velocity_curve_custom(
    freqs: &[f64],
    fs: f64,
    qts: f64,
    qes: f64,
    vas: f64,
    re: f64,
    sd: f64,
    mms: f64,
    cms: f64,
    bl: f64,
    vb: f64,
    fb: f64,
    port_area_m2: f64,
    power_watts: f64,
    valid: bool,
) -> Array {
    let result = Array::new();
    if !valid || vb <= 0.0 || fb <= 0.0 || port_area_m2 <= 0.0 {
        return result;
    }
    for &f in freqs {
        let val = calc_velocidad_aire_frec(f, fs, qts, qes, vas, re, sd, mms, cms, bl, vb, fb, port_area_m2, power_watts);
        let rounded = (val * 100.0_f64).round() / 100.0_f64;
        result.push(&JsValue::from_f64(rounded));
    }
    result
}

#[wasm_bindgen]
pub fn calc_impedancia_sistema(
    f: f64,
    fs: f64,
    qts: f64,
    qes: f64,
    qms: f64,
    vas: f64,
    re: f64,
    le_mh: f64,
    vb: f64,
    fb: f64,
    is_ported: bool,
) -> f64 {
    let re_v = if re > 0.0 { re } else { 3.6 };
    if f <= 0.0 || vb <= 0.0 {
        return re_v;
    }
    let fs_v = if fs > 0.0 { fs } else { 35.0 };
    let qes_v = if qes > 0.0 { qes } else { 0.42 };
    let qms_v = if qms > 0.0 { qms } else { 4.0 };
    let qts_v = if qts > 0.0 {
        qts
    } else {
        (qes_v * qms_v) / (qes_v + qms_v)
    };
    let vas_v = if vas > 0.0 { vas } else { 60.0 };
    let le_v = if le_mh > 0.0 { le_mh } else { 1.0 };
    let r0 = re_v * (qms_v / qes_v);
    let omega_l = 2.0 * std::f64::consts::PI * f * (le_v * 1e-3);

    if !is_ported {
        let alpha = vas_v / vb;
        let fc = fs_v * (1.0 + alpha).sqrt();
        let qmc = qms_v * (1.0 + alpha).sqrt();
        let fn_ = f / fc;
        let denom_imag = qmc * (fn_ - 1.0 / fn_);
        let den_mag_sq = 1.0 + denom_imag * denom_imag + 1e-18;
        let z_mot_real = r0 / den_mag_sq;
        let z_mot_imag = (-r0 * denom_imag) / den_mag_sq;
        let z_tot_real = re_v + z_mot_real;
        let z_tot_imag = z_mot_imag + omega_l;
        (z_tot_real * z_tot_real + z_tot_imag * z_tot_imag).sqrt()
    } else {
        let h = fb / fs_v;
        let alpha = vas_v / vb;
        let ql = 7.0;
        let a3 = 1.0 / qts_v + h / ql;
        let a2 = 1.0 + h * h * (1.0 + alpha) + h / (qts_v * ql);
        let a1 = (h * h) / qts_v + h / ql;
        let a0 = h * h;

        let y = f / fs_v;
        let real_den = y.powi(4) - a2 * y.powi(2) + a0;
        let imag_den = a1 * y - a3 * y.powi(3);

        let yh = y / h;
        let box_real = 1.0 - yh.powi(2);
        let box_imag = yh / ql;

        let num_real = r0 * (-y * box_imag);
        let num_imag = r0 * (y * box_real);

        let den_mag_sq = real_den * real_den + imag_den * imag_den + 1e-18;
        let z_mot_real = (num_real * real_den + num_imag * imag_den) / den_mag_sq;
        let z_mot_imag = (num_imag * real_den - num_real * imag_den) / den_mag_sq;

        let z_tot_real = re_v + z_mot_real;
        let z_tot_imag = z_mot_imag + omega_l;
        (re_v * 0.8).max((z_tot_real * z_tot_real + z_tot_imag * z_tot_imag).sqrt())
    }
}

#[wasm_bindgen]
pub fn calc_impedance_curve(
    fs: f64,
    qts: f64,
    qes: f64,
    qms: f64,
    vas: f64,
    re: f64,
    le_mh: f64,
    vb: f64,
    fb: f64,
    is_ported: bool,
    valid: bool,
) -> Array {
    let freqs = default_chart_frequencies();
    calc_impedance_curve_custom(&freqs, fs, qts, qes, qms, vas, re, le_mh, vb, fb, is_ported, valid)
}

#[wasm_bindgen]
pub fn calc_impedance_curve_custom(
    freqs: &[f64],
    fs: f64,
    qts: f64,
    qes: f64,
    qms: f64,
    vas: f64,
    re: f64,
    le_mh: f64,
    vb: f64,
    fb: f64,
    is_ported: bool,
    valid: bool,
) -> Array {
    let result = Array::new();
    if !valid || vb <= 0.0 {
        return result;
    }
    for &f in freqs {
        let val = calc_impedancia_sistema(f, fs, qts, qes, qms, vas, re, le_mh, vb, fb, is_ported);
        let rounded = (val * 100.0_f64).round() / 100.0_f64;
        result.push(&JsValue::from_f64(rounded));
    }
    result
}

#[wasm_bindgen]
pub fn calc_fase_acustica(
    f: f64,
    fs: f64,
    qts: f64,
    vas: f64,
    vb: f64,
    fb: f64,
    is_ported: bool,
) -> f64 {
    if f <= 0.0 || vb <= 0.0 {
        return 0.0;
    }
    let fs_v = if fs > 0.0 { fs } else { 38.0 };
    let qts_v = if qts > 0.0 { qts } else { 0.38 };
    let vas_v = if vas > 0.0 { vas } else { 45.0 };

    if !is_ported {
        let alpha = vas_v / vb;
        let fc = fs_v * (1.0 + alpha).sqrt();
        let qtc = qts_v * (1.0 + alpha).sqrt();
        let fn_ = f / fc;
        let real = 1.0 - fn_.powi(2);
        let imag = fn_ / qtc;
        let angle_rad = std::f64::consts::PI - imag.atan2(real);
        let mut deg = (angle_rad * 180.0) / std::f64::consts::PI;
        if deg > 180.0 {
            deg -= 360.0;
        }
        deg
    } else {
        let h = fb / fs_v;
        let alpha = vas_v / vb;
        let ql = 7.0;
        let a3 = 1.0 / qts_v + h / ql;
        let a2 = 1.0 + h * h * (1.0 + alpha) + h / (qts_v * ql);
        let a1 = (h * h) / qts_v + h / ql;
        let a0 = h * h;

        let y = f / fs_v;
        let real = y.powi(4) - a2 * y.powi(2) + a0;
        let imag = a1 * y - a3 * y.powi(3);
        let angle_rad = -imag.atan2(real);
        let mut deg = (angle_rad * 180.0) / std::f64::consts::PI;
        while deg < 0.0 {
            deg += 360.0;
        }
        if deg > 180.0 {
            deg -= 360.0;
        }
        deg
    }
}

#[wasm_bindgen]
pub fn calc_phase_curve(
    fs: f64,
    qts: f64,
    vas: f64,
    vb: f64,
    fb: f64,
    is_ported: bool,
    valid: bool,
) -> Array {
    let freqs = default_chart_frequencies();
    calc_phase_curve_custom(&freqs, fs, qts, vas, vb, fb, is_ported, valid)
}

#[wasm_bindgen]
pub fn calc_phase_curve_custom(
    freqs: &[f64],
    fs: f64,
    qts: f64,
    vas: f64,
    vb: f64,
    fb: f64,
    is_ported: bool,
    valid: bool,
) -> Array {
    let result = Array::new();
    if !valid || vb <= 0.0 {
        return result;
    }
    for &f in freqs {
        let val = calc_fase_acustica(f, fs, qts, vas, vb, fb, is_ported);
        let rounded = (val * 10.0_f64).round() / 10.0_f64;
        result.push(&JsValue::from_f64(rounded));
    }
    result
}

#[wasm_bindgen]
pub fn calc_group_delay_curve(
    fs: f64,
    qts: f64,
    vas: f64,
    vb: f64,
    fb: f64,
    is_ported: bool,
    valid: bool,
) -> Array {
    let freqs = default_chart_frequencies();
    calc_group_delay_curve_custom(&freqs, fs, qts, vas, vb, fb, is_ported, valid)
}

#[wasm_bindgen]
pub fn calc_group_delay_curve_custom(
    freqs: &[f64],
    fs: f64,
    qts: f64,
    vas: f64,
    vb: f64,
    fb: f64,
    is_ported: bool,
    valid: bool,
) -> Array {
    let result = Array::new();
    if !valid || vb <= 0.0 || freqs.is_empty() {
        return result;
    }

    let phases: Vec<f64> = freqs
        .iter()
        .map(|&f| calc_fase_acustica(f, fs, qts, vas, vb, fb, is_ported))
        .collect();

    let len = freqs.len();
    for i in 0..len {
        let (d_phase, d_freq) = if i == 0 {
            if len > 1 {
                (phases[1] - phases[0], freqs[1] - freqs[0])
            } else {
                (0.0, 1.0)
            }
        } else if i == len - 1 {
            (phases[i] - phases[i - 1], freqs[i] - freqs[i - 1])
        } else {
            (phases[i + 1] - phases[i - 1], freqs[i + 1] - freqs[i - 1])
        };

        let mut unwrapped_d_phase = d_phase;
        if unwrapped_d_phase > 180.0 {
            unwrapped_d_phase -= 360.0;
        }
        if unwrapped_d_phase < -180.0 {
            unwrapped_d_phase += 360.0;
        }

        let gd_ms = if d_freq.abs() > 1e-9 {
            (-((1.0 / 360.0) * (unwrapped_d_phase / d_freq)) * 1000.0).max(0.0)
        } else {
            0.0
        };

        let rounded = (gd_ms * 100.0_f64).round() / 100.0_f64;
        result.push(&JsValue::from_f64(rounded.min(100.0)));
    }

    result
}
