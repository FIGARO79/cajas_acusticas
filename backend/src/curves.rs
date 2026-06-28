//! Cálculos de curvas de respuesta en frecuencia para cajas selladas y ventiladas.
use wasm_bindgen::prelude::*;
use js_sys::Array;

#[wasm_bindgen]
pub fn calc_sealed_curve(fs: f64, qts: f64, vas: f64, vb: f64, valid: bool) -> Array {
    if !valid || vb <= 0.0 {
        return Array::new();
    }
    let mut result = Array::new();
    // Generar frecuencias logarítmicas 10-500 Hz (101 puntos)
    for i in 0..=100 {
        let base = 500.0_f64 / 10.0_f64;
        let exponent = i as f64 / 100.0_f64;
        let f = 10.0_f64 * base.powf(exponent);
        let f = (f * 10.0_f64).round() / 10.0_f64;
        let alpha = vas / vb;
        let fc = fs * (alpha + 1.0).sqrt();
        let qtc = qts * (alpha + 1.0).sqrt();
        let fn_ = f / fc;
        let response = fn_.powi(2) / (( (fn_.powi(2) - 1.0).powi(2) + (fn_ / qtc).powi(2) ).sqrt());
        let response_db = 20.0 * (response + 1e-10).log10();
        let val = (response_db * 100.0_f64).round() / 100.0_f64;
        result.push(&JsValue::from_f64(val));
    }
    result
}

#[wasm_bindgen]
pub fn calc_ported_curve(fs: f64, qts: f64, vas: f64, vb: f64, fb: f64, valid: bool) -> Array {
    if !valid || vb <= 0.0 {
        return Array::new();
    }
    let mut result = Array::new();
    let h = fb / fs;
    let alpha = vas / vb;
    let ql = 7.0; // QL_LOSSES constante utilizada en TS
    let a3 = 1.0 / qts + h / ql;
    let a2 = 1.0 + h * h * (1.0 + alpha) + h / (qts * ql);
    let a1 = h * h / qts + h / ql;
    let a0 = h * h;
    for i in 0..=100 {
        let base = 500.0_f64 / 10.0_f64;
        let exponent = i as f64 / 100.0_f64;
        let f = 10.0_f64 * base.powf(exponent);
        let f = (f * 10.0_f64).round() / 10.0_f64;
        let y = f / fs;
        let real = y.powi(4) - a2 * y * y + a0;
        let imag = a1 * y - a3 * y.powi(3);
        let response = y.powi(4) / ((real * real + imag * imag + 1e-20).sqrt());
        let response_db = 20.0 * (response + 1e-10).log10();
        let val = (response_db * 100.0_f64).round() / 100.0_f64;
        result.push(&JsValue::from_f64(val));
    }
    result
}

#[wasm_bindgen]
pub fn calc_bandpass4_curve(fs: f64, qts: f64, vas: f64, vf: f64, vr: f64, fb: f64, valid: bool) -> Array {
    if !valid || vf <= 0.0 || vr <= 0.0 || fb <= 0.0 {
        return Array::new();
    }
    let mut result = Array::new();
    let h = fb / fs;
    let alpha_f = vas / vf; // sellada (cámara trasera)
    let alpha_r = vas / vr; // ventilada (cámara delantera)
    let ql = 7.0; // Pérdidas del puerto

    let a3 = 1.0 / qts + h / ql;
    let a2 = 1.0 + h * h * (1.0 + alpha_r) + alpha_f + h / (qts * ql);
    let a1 = h * h / qts + (h / ql) * (1.0 + alpha_f);
    let a0 = h * h;

    for i in 0..=100 {
        let base = 500.0_f64 / 10.0_f64;
        let exponent = i as f64 / 100.0_f64;
        let f = 10.0_f64 * base.powf(exponent);
        let f = (f * 10.0_f64).round() / 10.0_f64;
        let y = f / fs;

        let real = y.powi(4) - a2 * y * y + a0;
        let imag = a1 * y - a3 * y.powi(3);
        let denom = (real * real + imag * imag + 1e-20).sqrt();

        // La respuesta acústica del paso banda es proporcional a y^2 * alpha_f
        // Multiplicada por un factor de escala para alinear la ganancia de la banda de paso
        let response = (y * y * alpha_f) / denom;
        let response_db = 20.0 * (response + 1e-10).log10();
        
        let val = (response_db * 100.0_f64).round() / 100.0_f64;
        result.push(&JsValue::from_f64(val));
    }
    result
}

#[wasm_bindgen]
pub fn calc_bandpass6_curve(fs: f64, qts: f64, vas: f64, vf: f64, vr: f64, fl: f64, fh: f64, valid: bool) -> Array {
    if !valid || vf <= 0.0 || vr <= 0.0 || fl <= 0.0 || fh <= 0.0 {
        return Array::new();
    }
    let mut result = Array::new();

    // Aproximación en cascada de Butterworth acústica (paso alto de 2do orden en fl + paso bajo de 2do orden en fh)
    let q = 0.707;

    for i in 0..=100 {
        let base = 500.0_f64 / 10.0_f64;
        let exponent = i as f64 / 100.0_f64;
        let f = 10.0_f64 * base.powf(exponent);
        let f = (f * 10.0_f64).round() / 10.0_f64;

        // Filtro paso alto en fl
        let y_l = f / fl;
        let den_l = ((1.0 - y_l * y_l).powi(2) + (y_l / q).powi(2) + 1e-20).sqrt();
        let hp = (y_l * y_l) / den_l;

        // Filtro paso bajo en fh
        let y_h = f / fh;
        let den_h = ((1.0 - y_h * y_h).powi(2) + (y_h / q).powi(2) + 1e-20).sqrt();
        let lp = 1.0 / den_h;

        // Respuesta combinada
        // A escala de nivel: sumamos ganancia según el tamaño relativo de vas / (vf + vr)
        let alpha = vas / (vf + vr);
        let response = hp * lp * (1.0 + alpha).sqrt();
        
        let response_db = 20.0 * (response + 1e-10).log10();
        let val = (response_db * 100.0_f64).round() / 100.0_f64;
        result.push(&JsValue::from_f64(val));
    }
    result
}

