use std::f64::consts::PI;
use wasm_bindgen::prelude::*;
use js_sys::Array;
use serde::Serialize;
use crate::complex::Complex;
use crate::curves::default_chart_frequencies;

/// Estructura de parámetros extendidos del transductor
#[derive(Debug, Clone, Copy, Serialize)]
pub struct ExtendedZParams {
    pub fs: f64,
    pub qms: f64,
    pub qes: f64,
    pub re: f64,
    pub vas: f64,
    pub sd_cm2: f64,
    pub bl: f64,
    pub mms_g: f64,
    pub cms_mm_n: f64,
    pub rms_ns_m: f64,
    // Parámetros de semi-inductancia extendida de Thorborg / Futtrup
    pub leb_mh: f64,  // Inductancia libre (mH)
    pub ke_sh: f64,   // Semi-inductancia (sH o mH equivalente)
    pub rss_ohm: f64, // Resistencia de shunt de pérdidas en hierro (Ohm)
    // Parámetro de arrastre viscoelástico (Knudsen LOG creep model)
    pub beta: f64,    // Factor de creep de suspensión (típicamente 0.005 a 0.04)
}

impl Default for ExtendedZParams {
    fn default() -> Self {
        ExtendedZParams {
            fs: 35.0,
            qms: 4.0,
            qes: 0.42,
            re: 5.6,
            vas: 60.0,
            sd_cm2: 350.0,
            bl: 10.0,
            mms_g: 40.0,
            cms_mm_n: 0.5,
            rms_ns_m: 2.2,
            leb_mh: 0.5,
            ke_sh: 0.8,
            rss_ohm: 35.0,
            beta: 0.015,
        }
    }
}

/// Calcula la impedancia de la bobina móvil (modelo extendido Thorborg / Futtrup)
/// Zvc(jω) = Re + jω*Leb + (jω*Ke * Rss) / (jω*Ke + Rss)
pub fn calc_z_voice_coil(f: f64, re: f64, leb_mh: f64, ke_sh: f64, rss_ohm: f64) -> Complex {
    if f <= 0.0 {
        return Complex::new(re.max(0.1), 0.0);
    }
    let omega = 2.0 * PI * f;
    
    // Si no hay parámetros extendidos, usar inductancia estándar Leb
    if ke_sh <= 0.0 || rss_ohm <= 0.0 {
        let leb_h = (leb_mh.max(0.0)) * 1e-3;
        return Complex::new(re, omega * leb_h);
    }

    let leb_h = leb_mh.max(0.0) * 1e-3;
    let ke_h = ke_sh.max(0.0) * 1e-3;
    
    // jω * Leb
    let z_leb = Complex::new(0.0, omega * leb_h);
    
    // Rama semi-inductancia: (jω*Ke * Rss) / (jω*Ke + Rss)
    let j_omega_ke = Complex::new(0.0, omega * ke_h);
    let num = j_omega_ke * rss_ohm;
    let den = j_omega_ke + rss_ohm;
    let z_eddy = num / den;

    Complex::new(re, 0.0) + z_leb + z_eddy
}

/// Calcula la impedancia motriz con el modelo viscoelástico de Knudsen LOG Creep
/// Zem(s) = (Bl)^2 / [ Rms + s*Mms + 1 / (s * Cms(s)) ]
pub fn calc_z_motional_creep(
    f: f64,
    fs: f64,
    bl: f64,
    mms_kg: f64,
    cms_m_n: f64,
    rms: f64,
    beta: f64,
) -> Complex {
    if f <= 0.0 || mms_kg <= 0.0 || cms_m_n <= 0.0 {
        return Complex::ZERO;
    }
    let omega = 2.0 * PI * f;
    let s = Complex::new(0.0, omega);

    // Factor de creep viscoelástico de suspensión:
    // Cms_eff(s) = C0 * (1 + beta * ln(1 + omega_0 / s)) con omega_0 = 3*pi*fs
    let cms_complex = if beta > 0.0001 && fs > 0.0 {
        let omega_0 = 3.0 * PI * fs;
        let s_inv = Complex::ONE / s;
        let term = Complex::ONE + (s_inv * omega_0);
        let log_term = term.ln();
        Complex::new(cms_m_n, 0.0) * (Complex::ONE + (log_term * beta))
    } else {
        Complex::new(cms_m_n, 0.0)
    };

    // Rigidez mecánica dinámica: Kms(s) = 1 / (s * Cms_eff)
    let k_term = Complex::ONE / (s * cms_complex);

    // Impedancia mecánica total: Zmech(s) = Rms + s * Mms + Kms(s)
    let z_mech = Complex::new(rms, 0.0) + (s * mms_kg) + k_term;

    // Impedancia motriz reflejada al dominio eléctrico: Zem = (Bl)^2 / Zmech
    let bl_sq = bl * bl;
    Complex::new(bl_sq, 0.0) / z_mech
}

/// Calcula la impedancia compleja completa del sistema (Driver + Caja Sellada o Réflex)
/// incorporando Thorborg/Futtrup + Knudsen LOG Creep
#[wasm_bindgen]
pub fn calc_extended_system_impedance(
    f: f64,
    fs: f64,
    qms: f64,
    qes: f64,
    re: f64,
    vas: f64,
    vb: f64,
    fb: f64,
    is_ported: bool,
    leb_mh: f64,
    ke_sh: f64,
    rss_ohm: f64,
    beta: f64,
) -> f64 {
    if f <= 0.0 || re <= 0.0 {
        return re.max(0.1);
    }

    let z_vc = calc_z_voice_coil(f, re, leb_mh, ke_sh, rss_ohm);

    // Derivación de masa y compliancia a partir de fs, vas, qms, qes si no se proporcionan explícitos
    let rho = 1.194;
    let c_sound = 344.0;
    let omega_s = 2.0 * PI * fs.max(10.0);
    
    // Cas = Vas / (rho * c^2)
    let vas_m3 = vas.max(1.0) * 1e-3;
    let c_as = vas_m3 / (rho * c_sound * c_sound);
    
    // Mas = 1 / (omega_s^2 * Cas)
    let m_as = 1.0 / (omega_s * omega_s * c_as);
    
    // Ras = omega_s * Mas / Qms
    let r_as = omega_s * m_as / qms.max(0.1);
    
    // Rae = omega_s * Mas * Qes
    let r_ae = omega_s * m_as * qes.max(0.01);
    
    // Factor de transformación acústico-eléctrico: (Bl/Sd)^2 = Rae / Re
    let bl_sd_ratio_sq = (re * r_ae).max(1e-6);

    let z_total = if !is_ported || vb <= 0.0 || fb <= 0.0 {
        // Caja sellada
        let cab = if vb > 0.0 { (vb * 1e-3) / (rho * c_sound * c_sound) } else { c_as * 1e-3 };
        let qa = 30.0; // Factor de absorción de caja
        let ql = 15.0; // Factor de fugas
        
        let omega = 2.0 * PI * f;
        let s = Complex::new(0.0, omega);

        // Compliancia del altavoz con Creep
        let cas_eff = if beta > 0.0001 {
            let omega_0 = 3.0 * PI * fs;
            let term = Complex::ONE + ((Complex::ONE / s) * omega_0);
            Complex::new(c_as, 0.0) * (Complex::ONE + (term.ln() * beta))
        } else {
            Complex::new(c_as, 0.0)
        };

        // Impedancia acústica de la caja Cab // Rab // Ral
        let omega_b = omega_s * (c_as / cab).sqrt();
        let r_ab = 1.0 / (omega_b * cab * qa);
        let r_al = omega_b * cab * ql;
        let y_box = Complex::new(1.0 / r_ab + 1.0 / r_al, 0.0) + (s * cab);
        let z_box = Complex::ONE / y_box;

        // Impedancia acústica motriz: Zas = Ras + s*Mas + 1/(s*Cas_eff) + Zbox
        let z_as = Complex::new(r_as, 0.0) + (s * m_as) + (Complex::ONE / (s * cas_eff)) + z_box;
        
        // Reflejo al dominio eléctrico: Zem = bl_sd_ratio_sq / Zas
        let z_em = Complex::new(bl_sd_ratio_sq, 0.0) / z_as;
        z_vc + z_em
    } else {
        // Caja ventilada (Bass Reflex con pérdidas de absorción Qa, puerto Qp y fugas Ql)
        let cab = (vb * 1e-3) / (rho * c_sound * c_sound);
        let omega = 2.0 * PI * f;
        let omega_b = 2.0 * PI * fb;
        let s = Complex::new(0.0, omega);

        let map = 1.0 / (omega_b * omega_b * cab);
        let qp = 25.0; // Q de pérdidas del puerto
        let qa = 30.0;
        let ql = 15.0;

        let r_ap = omega_b * map / qp;
        let r_ab = 1.0 / (omega_b * cab * qa);
        let r_al = omega_b * cab * ql;

        // Rama del puerto: Zap = Rap + s*Map
        let z_ap = Complex::new(r_ap, 0.0) + (s * map);
        
        // Admitancia total de la cavidad: Ybox = 1/Zbox_losses + s*Cab + 1/Zap
        let y_cavity = Complex::new(1.0 / r_ab + 1.0 / r_al, 0.0) + (s * cab) + (Complex::ONE / z_ap);
        let z_cavity = Complex::ONE / y_cavity;

        // Compliancia del cono con Creep
        let cas_eff = if beta > 0.0001 {
            let omega_0 = 3.0 * PI * fs;
            let term = Complex::ONE + ((Complex::ONE / s) * omega_0);
            Complex::new(c_as, 0.0) * (Complex::ONE + (term.ln() * beta))
        } else {
            Complex::new(c_as, 0.0)
        };

        // Impedancia acústica total: Zas = Ras + s*Mas + 1/(s*Cas_eff) + Zcavity
        let z_as = Complex::new(r_as, 0.0) + (s * m_as) + (Complex::ONE / (s * cas_eff)) + z_cavity;
        let z_em = Complex::new(bl_sd_ratio_sq, 0.0) / z_as;
        z_vc + z_em
    };

    z_total.norm().max(re * 0.8)
}

/// Genera la curva vectorial completa de impedancia extendida para el gráfico
#[wasm_bindgen]
pub fn calc_extended_impedance_curve(
    fs: f64,
    qms: f64,
    qes: f64,
    re: f64,
    vas: f64,
    vb: f64,
    fb: f64,
    is_ported: bool,
    leb_mh: f64,
    ke_sh: f64,
    rss_ohm: f64,
    beta: f64,
    valid: bool,
) -> Array {
    let freqs = default_chart_frequencies();
    let result = Array::new();
    if !valid || vb <= 0.0 {
        return result;
    }

    for &f in freqs.iter() {
        let mag = calc_extended_system_impedance(
            f, fs, qms, qes, re, vas, vb, fb, is_ported, leb_mh, ke_sh, rss_ohm, beta,
        );
        result.push(&JsValue::from_f64((mag * 100.0).round() / 100.0));
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extended_impedance_at_dc() {
        let z_dc = calc_z_voice_coil(0.0, 5.6, 0.5, 0.8, 35.0);
        assert_eq!(z_dc.re, 5.6);
        assert_eq!(z_dc.im, 0.0);
    }

    #[test]
    fn test_extended_impedance_high_freq() {
        let z_10k = calc_z_voice_coil(10000.0, 5.6, 0.5, 0.8, 35.0);
        assert!(z_10k.re > 5.6); // Efecto de resistencia de pérdidas Rss
        assert!(z_10k.im > 10.0); // Efecto inductivo Leb + Ke
    }
}
