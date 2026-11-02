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
    pub eta0: f64,
    pub spl: f64,
    pub spl_max: f64,
    pub rms: f64,
    pub zmax: f64,
}

#[wasm_bindgen]
pub fn calc_auto_params(
    vas: f64,
    sd: f64,
    fs: f64,
    re: f64,
    qes: f64,
    xmax: f64,
    mms_opt: Option<f64>,
    cms_opt: Option<f64>,
    bl_opt: Option<f64>,
    vd_opt: Option<f64>,
    qms_opt: Option<f64>,
    pe_opt: Option<f64>,
    sens_opt: Option<f64>,
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
        bl = ((2.0 * std::f64::consts::PI * fs * (mms / 1000.0) * re) / qes).sqrt();
        auto_bl = true;
    }
    if vd == 0.0 && sd > 0.0 && xmax > 0.0 {
        vd = sd * (xmax / 10.0);
        auto_vd = true;
    }

    let qms = qms_opt.unwrap_or(0.0);
    let pe = pe_opt.unwrap_or(0.0);
    let sens = sens_opt.unwrap_or(0.0);

    let mut eta0 = 0.0;
    if qes > 0.0 && fs > 0.0 && vas > 0.0 {
        eta0 = 9.64e-10 * fs.powi(3) * vas / qes;
    }

    let mut spl = sens;
    if spl == 0.0 && eta0 > 0.0 {
        spl = 112.2 + 10.0 * eta0.log10();
    }

    let mut spl_max = 0.0;
    if spl > 0.0 && pe > 0.0 {
        spl_max = spl + 10.0 * pe.log10();
    }

    let mut rms = 0.0;
    if fs > 0.0 && mms > 0.0 && qms > 0.0 {
        rms = (2.0 * std::f64::consts::PI * fs * (mms / 1000.0)) / qms;
    }

    let mut zmax = 0.0;
    if re > 0.0 && qms > 0.0 && qes > 0.0 {
        zmax = re * (1.0 + qms / qes);
    }

    AutoParamsResult {
        cms,
        mms,
        bl,
        vd,
        auto_cms,
        auto_mms,
        auto_bl,
        auto_vd,
        eta0,
        spl,
        spl_max,
        rms,
        zmax,
    }
}
