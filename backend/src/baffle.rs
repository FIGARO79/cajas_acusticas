use std::f64::consts::PI;
use wasm_bindgen::prelude::*;
use js_sys::Array;
use serde::Serialize;
use crate::complex::Complex;
use crate::curves::default_chart_frequencies;

const SPEED_OF_SOUND: f64 = 344.0; // m/s

#[derive(Debug, Clone, Copy, Serialize)]
pub struct BaffleDiffractionPoint {
    pub freq: f64,
    pub step_gain_db: f64,
    pub ripple_db: f64,
    pub total_baffle_gain_db: f64,
    pub phase_deg: f64,
}

/// Calcula la respuesta de difracción y efecto de bafle (Baffle Step + Edge Diffraction)
/// Ancho y alto del bafle en cm, posición del driver relativa al centro en cm.
#[wasm_bindgen]
pub fn calc_baffle_step_gain(f: f64, width_cm: f64, height_cm: f64) -> f64 {
    if f <= 0.0 || width_cm <= 0.0 || height_cm <= 0.0 {
        return 0.0;
    }
    let w_m = width_cm * 0.01;
    let h_m = height_cm * 0.01;
    let a_eq = (w_m * h_m / PI).sqrt();
    let f_step = SPEED_OF_SOUND / (2.0 * PI * a_eq);

    // Función de transferencia normalizada (0 dB a alta frecuencia, -6 dB a baja frecuencia)
    let fn_ = f / f_step;
    let h_real = (1.0 + 0.5 * fn_ * fn_) / (1.0 + 0.25 * fn_ * fn_);
    let h_imag = (0.5 * fn_) / (1.0 + 0.25 * fn_ * fn_);
    let mag = (h_real * h_real + h_imag * h_imag).sqrt();
    
    // Normalizado a 0 dB en alta frecuencia (2pi)
    20.0 * (mag / 2.0).max(1e-4).log10()
}

/// Calcula el efecto completo de borde y bafle (Baffle Step + Ondulaciones de Difracción)
/// width_cm, height_cm: dimensiones de la cara frontal.
/// offset_x_cm, offset_y_cm: descentrado del driver respecto al centro de la caja.
#[wasm_bindgen]
pub fn calc_baffle_diffraction(
    f: f64,
    width_cm: f64,
    height_cm: f64,
    offset_x_cm: f64,
    offset_y_cm: f64,
) -> f64 {
    if f <= 0.0 || width_cm <= 0.0 || height_cm <= 0.0 {
        return 0.0;
    }

    let w = width_cm * 0.01;
    let h = height_cm * 0.01;
    let ox = offset_x_cm * 0.01;
    let oy = offset_y_cm * 0.01;

    // Distancias a los 4 bordes desde el centro del transductor
    let d_left = (w * 0.5 + ox).max(0.01);
    let d_right = (w * 0.5 - ox).max(0.01);
    let d_top = (h * 0.5 - oy).max(0.01);
    let d_bottom = (h * 0.5 + oy).max(0.01);

    let k = 2.0 * PI * f / SPEED_OF_SOUND;

    // 1. Efecto Baffle Step continuo (transición 4pi a 2pi)
    let a_eq = (w * h / PI).sqrt();
    let f_step = SPEED_OF_SOUND / (2.0 * PI * a_eq);
    let s_ratio = f / f_step;
    // Onda directa en el espacio
    let h_direct = Complex::new(1.0, s_ratio) / Complex::new(1.0, 0.5 * s_ratio);

    // 2. Ondas secundarias difractadas en los 4 bordes
    let distances = [
        (d_left, h),
        (d_right, h),
        (d_top, w),
        (d_bottom, w),
    ];
    let perimeter = 2.0 * (w + h);

    let mut diff_sum = Complex::ZERO;
    for (d, len) in distances.iter() {
        let weight = len / perimeter;
        let phase = k * d;
        // Amplitud de onda difractada cilíndrica decreciente con la distancia y frecuencia
        let atten = 0.5 / (1.0 + 0.8 * k * d).sqrt();
        let edge_wave = Complex::from_polar(atten * weight, -phase);
        diff_sum += edge_wave;
    }

    // Campo acústico total = Onda directa - Ondas difractadas de borde
    let total_field = h_direct - diff_sum;
    let mag = total_field.norm();

    // Normalizado a 0 dB en alta frecuencia (+6 dB de ganancia máxima sobre espacio libre)
    let gain_db = 20.0 * (mag / 2.0).max(1e-4).log10();
    
    // Limitar valores a un rango físico coherente (-6 dB a +3 dB)
    gain_db.clamp(-6.2, 4.0)
}

/// Genera la curva vectorial completa de respuesta del bafle para el gráfico
#[wasm_bindgen]
pub fn calc_baffle_diffraction_curve(
    width_cm: f64,
    height_cm: f64,
    offset_x_cm: f64,
    offset_y_cm: f64,
    valid: bool,
) -> Array {
    let freqs = default_chart_frequencies();
    let result = Array::new();
    if !valid || width_cm <= 0.0 || height_cm <= 0.0 {
        return result;
    }

    for &f in freqs.iter() {
        let gain = calc_baffle_diffraction(f, width_cm, height_cm, offset_x_cm, offset_y_cm);
        result.push(&JsValue::from_f64((gain * 100.0).round() / 100.0));
    }
    result
}

/// Aplica el efecto de bafle a una curva SPL existente (curva en 2pi / pistón ideal)
#[wasm_bindgen]
pub fn apply_baffle_step_to_spl(
    spl_values: &[f64],
    width_cm: f64,
    height_cm: f64,
    offset_x_cm: f64,
    offset_y_cm: f64,
) -> Array {
    let freqs = default_chart_frequencies();
    let result = Array::new();
    if spl_values.is_empty() || width_cm <= 0.0 || height_cm <= 0.0 {
        for &v in spl_values {
            result.push(&JsValue::from_f64(v));
        }
        return result;
    }

    let n = spl_values.len().min(freqs.len());
    for i in 0..n {
        let f = freqs[i];
        let bstep_delta = calc_baffle_diffraction(f, width_cm, height_cm, offset_x_cm, offset_y_cm);
        let corrected_spl = spl_values[i] + bstep_delta;
        result.push(&JsValue::from_f64((corrected_spl * 10.0).round() / 10.0));
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_baffle_step_limits() {
        let w = 30.0;
        let h = 50.0;
        
        // A muy baja frecuencia (< 20 Hz), debe estar cerca de -6 dB respecto a 2pi
        let low_gain = calc_baffle_step_gain(20.0, w, h);
        assert!(low_gain < -4.0);

        // A muy alta frecuencia (> 5000 Hz), debe converger hacia 0 dB
        let high_gain = calc_baffle_step_gain(8000.0, w, h);
        assert!(high_gain > -0.5);
    }
}
