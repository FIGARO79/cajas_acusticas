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
pub fn calc_radiador_pasivo(vb: f64, vas: f64, fs: f64, cd: f64, mp: f64) -> PassiveRadiatorResult {
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
}

