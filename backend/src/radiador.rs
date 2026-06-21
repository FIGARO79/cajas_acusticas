use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct PassiveRadiatorResult {
    pub fb: f64,
    pub cap_acustica: f64,
    pub masa_añadida: f64,
}

#[wasm_bindgen]
pub fn calc_radiador_pasivo(vb: f64, dv: f64, vas: f64, fs: f64, cd: f64, mp: f64) -> PassiveRadiatorResult {
    // Fórmulas del documento (sección Radiador Pasivo)
    // fb = (1/(2π)) * sqrt(1 / (Mp * (Cap + Cab)) )
    // Cab = vb / (rho * c^2 * cd^2)
    // Cap = vas / (rho * c^2 * cd^2)
    let rho = 1.205_f64;
    let c = 343.0_f64;
    let cab = vb / (rho * c * c * cd * cd);
    let cap = vas / (rho * c * c * cd * cd);
    let fb = (1.0/(2.0*std::f64::consts::PI)) * ((1.0)/(mp * (cap + cab))).sqrt();
    // Masa añadida según la fórmula del documento
    let masa_añadida = ((vas)/(vb * 4.0 * std::f64::consts::PI * std::f64::consts::PI * fb * fb * cap)) - mp;
    PassiveRadiatorResult { fb, cap_acustica: cap, masa_añadida }
}
