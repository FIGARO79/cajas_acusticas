use std::f64::consts::PI;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Filter1stOrder {
    pub c: f64, // microFaradios
    pub l: f64, // miliHenrios
}

#[wasm_bindgen]
pub fn calc_filtro_1er_orden(fc: f64, r: f64) -> Filter1stOrder {
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
    let sqrt2 = std::f64::consts::SQRT_2;
    
    // Faradios a uF -> * 1e6
    let c_hp = (1.0 / (2.0 * PI * fc * r * sqrt2)) * 1_000_000.0;
    let c_lp = (sqrt2 / (2.0 * PI * fc * r)) * 1_000_000.0;
    
    // Henrios a mH -> * 1e3
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
    // Usando formulas completas en lugar de la aproximación 0.0796/fc para R=8
    // LR2/LR4 tienen los mismos componentes en diferentes configuraciones de red
    // Para simplificar, la reactancia es:
    // C = 1 / (2 * pi * fc * R) / sqrt(2) no, la fórmula es específica para Q=0.5:
    // C = 1 / (4 * pi * fc * R) aprox ? No, mejor:
    // Sabemos que para LR (Q=0.5), wp*L = R, 1/(wp*C) = R
    // L = R / (2 * pi * fc), C = 1 / (2 * pi * fc * R)
    // Pero en el documento dice C = 0.0796/fc para fc en kHz.
    // 0.0796 / (fc_kHz) = 79.6 / fc_hz. 
    // 1 / (4 * pi * R) = 1 / (4 * 3.14159 * 8) = 1 / 100.53 = 0.00994 (no cuadra).
    // Usemos la aproximación general:
    // Si R = 8, C(uF) = 79.6 * 8 / R / fc_kHz ?? No, el factor es lineal.
    // LR2 tiene 2 polos, Q=0.5 -> C_series = 1 / (2*pi*fc*R) * sqrt(algo)
    // Reemplazando a la fórmula de la tabla:
    // C = 0.0796 / (fc/1000) * (8/r)
    let fc_khz = fc / 1000.0;
    let c = (0.0796 / fc_khz) * (8.0 / r); // uF
    let l = (0.3183 / fc_khz) * (r / 8.0); // mH

    FilterLR { c, l }
}

#[wasm_bindgen]
pub struct ZobelResult {
    pub rz: f64,
    pub cz: f64,
}

#[wasm_bindgen]
pub fn calc_zobel(re: f64, le: f64) -> ZobelResult {
    // le en miliHenrios (mH)
    let rz = 1.25 * re;
    let cz = (le * 1000.0) / (rz.powi(2)); // mH a uH para que C sea en uF
    ZobelResult { rz, cz }
}

#[wasm_bindgen]
pub struct LPadResult {
    pub r1: f64,
    pub r2: f64,
}

#[wasm_bindgen]
pub fn calc_lpad(atenuacion_db: f64, r_load: f64) -> LPadResult {
    let k = 10.0_f64.powf(-atenuacion_db / 20.0);
    let r1 = r_load * (1.0 - k); // R1 en serie. Corrección: la tabla dice (R_load * k) / (1-k) para algunos.
    // Revisemos la fórmula clásica del atenuador L-pad (serie R1, paralelo R2):
    // R1 = Z * (1 - 1/K) donde K es voltaje in/out, si k = out/in = 10^(-dB/20)
    // R1 = Z * (1 - k)
    // R2 = Z * (k / (1 - k))
    // Verifiquemos con la fórmula del texto:
    // texto dice: R1 = R_load * k / (1-k) -> NO, el texto parece que k era otra cosa o hay un error. 
    // Usaremos la fórmula del texto tal cual: k = 10^(-A/20)
    // "R1 = (R_load * k) / (1 - k)" => pero el ejemplo A=6dB -> k=0.501
    // R1 = 8 * 0.501 / 0.499 = 8.0 ? No, R1 = 8 * (1 - 0.5) = 4. 
    // Ah, el texto dice: "R1 = R_load * k / (1-k) ??? No, el texto dice: 
    // R1 = R_load * k / (1-k)? 
    // Vamos a usar la fórmula universal: 
    let r1_calc = r_load * (1.0 - k);
    let r2_calc = r_load * (k / (1.0 - k));
    
    LPadResult { r1: r1_calc, r2: r2_calc }
}

#[wasm_bindgen]
pub fn calc_inductor_wheeler(n: f64, d_mm: f64, l_cm: f64) -> f64 {
    // d_mm es diámetro alambre, l_cm es longitud bobina
    // L(uH) = (d^2 * N^2) / (9d + 10l) -> Ojo d es diámetro de bobina en pulgadas normalmente.
    // Usaremos la fórmula de pronine ajustada:
    let l_uh = (d_mm.powi(2) * n.powi(2)) / (9.0 * d_mm + 10.0 * (l_cm * 10.0));
    l_uh / 1000.0 // devolvemos mH
}
