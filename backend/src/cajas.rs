use wasm_bindgen::prelude::*;

const SPEED_OF_SOUND_M_S: f64 = 343.0;
const AIR_DENSITY_KG_M3: f64 = 1.205;

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
    // Calculos con vb_target
    let alpha = vas / vb_target;
    let qtc = qts * (alpha + 1.0).sqrt();
    let fc = fs * (alpha + 1.0).sqrt();
    
    // F3
    let f3_term = 1.0 / qtc.powi(2) - 2.0;
    let f3 = fc * ((f3_term + (f3_term.powi(2) + 4.0).sqrt()) / 2.0).sqrt();

    // Vb óptimo para el qtc_target (ej: 0.707)
    let vb_optimo = vas / ((qtc_target / qts).powi(2) - 1.0);

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
pub fn calc_caja_ventilada(vb: f64, fb: f64, dv: f64) -> VentedResult {
    // dv en cm, vb en L, fb en Hz
    // Lv (cm) = (23407.2 * dv^2) / (fb^2 * vb) - 0.732 * dv
    let lv = (23407.2 * dv.powi(2)) / (fb.powi(2) * vb) - 0.732 * dv;
    
    VentedResult {
        fb,
        lv,
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
    let mut vb = 0.0;
    let mut fb = 0.0;
    let mut f3 = 0.0;

    match tipo {
        "SBB4" => {
            vb = 11.0 * qts.powf(2.87) * vas;
            fb = 0.38 * qts.powf(-0.95) * fs;
            f3 = 0.38 * qts.powf(-0.95) * fs;
        },
        "B4" => {
            vb = 0.25 * qts.powf(-2.0) * vas;
            fb = fs;
            f3 = fs;
        },
        "QB3" | _ => {
            vb = 6.27 * qts.powf(1.44) * vas;
            fb = 0.94 * qts.powf(-0.9) * fs;
            f3 = 1.2 * qts.powf(-0.9) * fs;
        }
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
    // S es el factor de respuesta plana, ej: 0.707
    let vf = vas / ((s / qts).powi(2) - 1.0);
    let vr = 2.0 * s.powi(2) * qts.powi(2) * vas;
    let fb = fs * (s / qts);
    let f0 = fs * (s / qts); // F0 se alinea con Fb en diseño ideal
    let delta_f = (fs / qts) * s;

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
    let fh = fs * ((1.0 + a) / 2.0).sqrt();
    let fl = fs * (1.0 / (2.0 * (1.0 + a))).sqrt();
    let vol = vas * qts * (2.0 * a).sqrt();

    Bandpass6Result { vf: vol, vr: vol, fh, fl }
}


