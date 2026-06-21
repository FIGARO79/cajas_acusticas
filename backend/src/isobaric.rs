use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct IsobaricResult {
    pub fs_eq: f64,
    pub vas_eq: f64,
    pub qts_eq: f64,
    pub vb_eq: f64,
}

#[wasm_bindgen]
pub fn calc_isobari_multiple(fs: f64, vas: f64, qts: f64, n: u32, tipo: &str) -> IsobaricResult {
    // tipo: "standard", "serie", "paralelo", "isobaric", "isobaric_compuesto"
    match tipo {
        "standard" => IsobaricResult { fs_eq: fs, vas_eq: vas, qts_eq: qts, vb_eq: 0.0 },
        "serie" => {
            // n drivers en serie duplican Vas, Vb
            IsobaricResult { fs_eq: fs, vas_eq: vas * n as f64, qts_eq: qts, vb_eq: 0.0 }
        }
        "paralelo" => {
            // n drivers en paralelo también multiplican Vas y Vb
            IsobaricResult { fs_eq: fs, vas_eq: vas * n as f64, qts_eq: qts, vb_eq: 0.0 }
        }
        "isobaric" => {
            // dos drivers en configuración isobárica (push-pull) reducen Vas a la mitad y Vb a la mitad
            IsobaricResult { fs_eq: fs, vas_eq: vas / 2.0, qts_eq: qts, vb_eq: 0.0 }
        }
        "isobaric_compuesto" => {
            // n drivers en isobárico compuesto
            IsobaricResult { fs_eq: fs, vas_eq: (n as f64 * vas) / 2.0, qts_eq: qts, vb_eq: 0.0 }
        }
        _ => IsobaricResult { fs_eq: fs, vas_eq: vas, qts_eq: qts, vb_eq: 0.0 },
    }
}
