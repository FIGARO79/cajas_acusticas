use std::f64::consts::PI;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Filter1stOrder {
    pub c: f64, // microFaradios
    pub l: f64, // miliHenrios
}

#[wasm_bindgen]
pub fn calc_filtro_1er_orden(fc: f64, r: f64) -> Filter1stOrder {
    if fc <= 0.0 || r <= 0.0 {
        return Filter1stOrder { c: 0.0, l: 0.0 };
    }
    let c = (1.0 / (2.0 * PI * fc * r)) * 1_000_000.0;
    let l = (r / (2.0 * PI * fc)) * 1000.0;
    Filter1stOrder { c, l }
}

#[wasm_bindgen]
pub struct Filter2ndOrder {
    pub c_hp: f64,
    pub l_hp: f64,
    pub c_lp: f64,
    pub l_lp: f64,
}

#[wasm_bindgen]
pub fn calc_filtro_2do_orden_butterworth(fc: f64, r: f64) -> Filter2ndOrder {
    if fc <= 0.0 || r <= 0.0 {
        return Filter2ndOrder { c_hp: 0.0, l_hp: 0.0, c_lp: 0.0, l_lp: 0.0 };
    }
    let sqrt2 = std::f64::consts::SQRT_2;
    
    let c_hp = (1.0 / (2.0 * PI * fc * r * sqrt2)) * 1_000_000.0;
    let c_lp = (sqrt2 / (2.0 * PI * fc * r)) * 1_000_000.0;
    
    let l_hp = (r / (2.0 * PI * fc * sqrt2)) * 1000.0;
    let l_lp = ((r * sqrt2) / (2.0 * PI * fc)) * 1000.0;

    Filter2ndOrder { c_hp, l_hp, c_lp, l_lp }
}

#[wasm_bindgen]
pub struct FilterLR {
    pub c: f64,
    pub l: f64,
}

#[wasm_bindgen]
pub fn calc_filtro_linkwitz_riley(fc: f64, r: f64) -> FilterLR {
    if fc <= 0.0 || r <= 0.0 {
        return FilterLR { c: 0.0, l: 0.0 };
    }
    let c = 1_000_000.0 / (4.0 * PI * fc * r);
    let l = (r * 1000.0) / (PI * fc);

    FilterLR { c, l }
}

#[wasm_bindgen]
pub struct ZobelResult {
    pub rz: f64,
    pub cz: f64,
}

#[wasm_bindgen]
pub fn calc_zobel(re: f64, le: f64) -> ZobelResult {
    if re <= 0.0 {
        return ZobelResult { rz: 0.0, cz: 0.0 };
    }
    let rz = 1.25 * re;
    let cz = if rz <= 0.0 { 0.0 } else { (le.max(0.0) * 1000.0) / (rz.powi(2)) };
    ZobelResult { rz, cz }
}

#[wasm_bindgen]
pub struct LPadResult {
    pub r1: f64,
    pub r2: f64,
}

#[wasm_bindgen]
pub fn calc_lpad(atenuacion_db: f64, r_load: f64) -> LPadResult {
    if r_load <= 0.0 {
        return LPadResult { r1: 0.0, r2: 0.0 };
    }
    if atenuacion_db <= 0.0 {
        return LPadResult { r1: 0.0, r2: 999999.0 }; // Circuito abierto ideal para 0dB
    }
    
    let k = 10.0_f64.powf(-atenuacion_db / 20.0);
    let r1_calc = r_load * (1.0 - k);
    let diff = 1.0 - k;
    let r2_calc = if diff.abs() < 1e-6 { 999999.0 } else { r_load * (k / diff) };
    
    LPadResult { 
        r1: r1_calc.max(0.0), 
        r2: r2_calc.max(0.0) 
    }
}

#[wasm_bindgen]
pub fn calc_inductor_wheeler(n: f64, d_mm: f64, l_cm: f64) -> f64 {
    if n <= 0.0 || d_mm <= 0.0 || l_cm <= 0.0 {
        return 0.0;
    }
    let l_uh = (d_mm.powi(2) * n.powi(2)) / (9.0 * d_mm + 10.0 * (l_cm * 10.0));
    l_uh / 1000.0 // Devolvemos mH
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_divisores_cero_y_negativos() {
        let f1 = calc_filtro_1er_orden(0.0, 0.0);
        assert_eq!(f1.c, 0.0);
        assert_eq!(f1.l, 0.0);

        let lr = calc_filtro_linkwitz_riley(-100.0, 8.0);
        assert_eq!(lr.c, 0.0);

        let lp = calc_lpad(0.0, 8.0);
        assert_eq!(lp.r1, 0.0);
        assert!(lp.r2 > 100000.0);
    }
}

