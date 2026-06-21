use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct AutoParamsResult {
    pub cms: f64,
    pub mms: f64,
    pub bl: f64,
    pub vd: f64,
    pub auto_cms: bool,
    pub auto_mms: bool,
    pub auto_bl: bool,
    pub auto_vd: bool,
}

#[wasm_bindgen]
pub fn calc_auto_params(
    vas: f64, sd: f64, fs: f64, re: f64, qes: f64, xmax: f64,
    mms_opt: Option<f64>, cms_opt: Option<f64>, bl_opt: Option<f64>, vd_opt: Option<f64>
) -> AutoParamsResult {
    let mut cms = cms_opt.unwrap_or(0.0);
    let mut mms = mms_opt.unwrap_or(0.0);
    let mut bl = bl_opt.unwrap_or(0.0);
    let mut vd = vd_opt.unwrap_or(0.0);
    let mut auto_cms = false;
    let mut auto_mms = false;
    let mut auto_bl = false;
    let mut auto_vd = false;

    if cms == 0.0 && vas > 0.0 && sd > 0.0 {
        cms = 716.1 * vas / (sd * sd);
        auto_cms = true;
    }
    if mms == 0.0 && fs > 0.0 && cms > 0.0 {
        mms = 25330.0 / (fs * fs * cms);
        auto_mms = true;
    }
    if bl == 0.0 && fs > 0.0 && mms > 0.0 && re > 0.0 && qes > 0.0 {
        bl = ((2.0 * std::f64::consts::PI * fs * (mms/1000.0) * re) / qes).sqrt();
        auto_bl = true;
    }
    if vd == 0.0 && sd > 0.0 && xmax > 0.0 {
        vd = sd * (xmax / 10.0);
        auto_vd = true;
    }
    AutoParamsResult { cms, mms, bl, vd, auto_cms, auto_mms, auto_bl, auto_vd }
}
