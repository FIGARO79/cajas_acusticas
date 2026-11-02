#![allow(clippy::needless_range_loop)]
use std::f64::consts::PI;
use wasm_bindgen::prelude::*;
use js_sys::Array;
use serde::Serialize;
use crate::complex::Complex;
use crate::curves::default_chart_frequencies;

/// Tipo de componente circuital para el solver MNA
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ComponentType {
    Resistor,
    Inductor,
    Capacitor,
    DriverLoad,
}

#[derive(Debug, Clone)]
pub struct CircuitBranch {
    pub node_a: usize,
    pub node_b: usize,
    pub comp_type: ComponentType,
    pub value: f64,     // Ohms, Henrios, Faradios, o Re
    pub param2: f64,    // DCR para inductores, Le para driver, etc.
}

/// Solver matricial de Análisis Nodal Modificado (MNA) para redes de filtrado
pub struct CrossoverSolver {
    pub num_nodes: usize, // Excluyendo el nodo 0 (Tierra) y nodo 1 (Entrada 1V)
    pub branches: Vec<CircuitBranch>,
}

impl Default for CrossoverSolver {
    fn default() -> Self {
        Self::new()
    }
}

impl CrossoverSolver {
    pub fn new() -> Self {
        CrossoverSolver {
            num_nodes: 0,
            branches: Vec::new(),
        }
    }

    pub fn add_branch(&mut self, node_a: usize, node_b: usize, comp_type: ComponentType, value: f64, param2: f64) {
        let max_n = node_a.max(node_b);
        if max_n > self.num_nodes {
            self.num_nodes = max_n;
        }
        self.branches.push(CircuitBranch {
            node_a,
            node_b,
            comp_type,
            value,
            param2,
        });
    }

    /// Calcula la admitancia compleja de una rama en la frecuencia f
    fn branch_admittance(&self, branch: &CircuitBranch, f: f64) -> Complex {
        if f <= 0.0 {
            return Complex::new(1e-12, 0.0);
        }
        let omega = 2.0 * PI * f;
        match branch.comp_type {
            ComponentType::Resistor => {
                let r = branch.value.max(1e-6);
                Complex::new(1.0 / r, 0.0)
            }
            ComponentType::Inductor => {
                let l = branch.value.max(1e-10);
                let dcr = branch.param2.max(1e-4);
                let z = Complex::new(dcr, omega * l);
                z.inv()
            }
            ComponentType::Capacitor => {
                let c = branch.value.max(1e-15);
                Complex::new(1e-6, omega * c) // Conductancia parásita mínima
            }
            ComponentType::DriverLoad => {
                let re = branch.value.max(1.0);
                let le_h = branch.param2.max(0.0) * 1e-3;
                let z = Complex::new(re, omega * le_h);
                z.inv()
            }
        }
    }

    /// Resuelve las tensiones nodales complejas en la frecuencia f
    /// Nodo 0 = Tierra (0V), Nodo 1 = Fuente AC de entrada (1.0 V + j0.0)
    /// Retorna vector de tensiones para nodos 0..=num_nodes
    pub fn solve_voltages(&self, f: f64) -> Vec<Complex> {
        let n = self.num_nodes;
        if n < 1 {
            return vec![Complex::ZERO, Complex::ONE];
        }

        // Sistema Y * V = I para los nodos incógnita (2..=n)
        // Dimensión del sistema lineal: m = n - 1 (para nodos 2 a n)
        let m = if n >= 2 { n - 1 } else { 0 };
        if m == 0 {
            return vec![Complex::ZERO, Complex::ONE];
        }

        let mut y_matrix = vec![vec![Complex::ZERO; m]; m];
        let mut i_vector = vec![Complex::ZERO; m];

        let v_in = Complex::ONE; // 1V en nodo 1

        for b in &self.branches {
            let y = self.branch_admittance(b, f);
            let na = b.node_a;
            let nb = b.node_b;

            // Mapeo de índices a la submatriz (nodo 2 -> fila 0)
            let row_a = if na >= 2 { Some(na - 2) } else { None };
            let row_b = if nb >= 2 { Some(nb - 2) } else { None };

            if let Some(ra) = row_a {
                y_matrix[ra][ra] += y;
                if let Some(rb) = row_b {
                    y_matrix[ra][rb] -= y;
                } else if nb == 1 {
                    i_vector[ra] += y * v_in;
                }
            }

            if let Some(rb) = row_b {
                y_matrix[rb][rb] += y;
                if let Some(ra) = row_a {
                    y_matrix[rb][ra] -= y;
                } else if na == 1 {
                    i_vector[rb] += y * v_in;
                }
            }
        }

        // Eliminación Gaussiana con pivoteo parcial sobre números complejos
        for i in 0..m {
            // Pivoteo
            let mut max_row = i;
            let mut max_val = y_matrix[i][i].norm_sq();
            for k in (i + 1)..m {
                let val = y_matrix[k][i].norm_sq();
                if val > max_val {
                    max_val = val;
                    max_row = k;
                }
            }
            if max_row != i {
                y_matrix.swap(i, max_row);
                i_vector.swap(i, max_row);
            }

            let pivot = y_matrix[i][i];
            if pivot.norm_sq() < 1e-24 {
                continue;
            }

            for j in (i + 1)..m {
                let factor = y_matrix[j][i] / pivot;
                for col in i..m {
                    let sub = factor * y_matrix[i][col];
                    y_matrix[j][col] -= sub;
                }
                let sub_i = factor * i_vector[i];
                i_vector[j] -= sub_i;
            }
        }

        // Sustitución hacia atrás
        let mut v_unknown = vec![Complex::ZERO; m];
        for i in (0..m).rev() {
            let mut sum = i_vector[i];
            for j in (i + 1)..m {
                sum -= y_matrix[i][j] * v_unknown[j];
            }
            let diag = y_matrix[i][i];
            v_unknown[i] = if diag.norm_sq() > 1e-24 { sum / diag } else { Complex::ZERO };
        }

        // Construir vector total de nodos 0..=n
        let mut result = vec![Complex::ZERO; n + 1];
        result[0] = Complex::ZERO;
        result[1] = Complex::ONE;
        if m > 0 {
            result[2..(m + 2)].copy_from_slice(&v_unknown[..m]);
        }
        result
    }
}

/// Simulación de filtro paso bajo de 2.º orden con compensación Zobel opcional
/// Entrada: L (mH), DCR (Ohm), C (uF), Re (Ohm), Le (mH), Rz (Ohm), Cz (uF), use_zobel (bool)
#[wasm_bindgen]
pub fn calc_crossover_lowpass_transfer(
    f: f64,
    l_mh: f64,
    dcr_ohm: f64,
    c_uf: f64,
    re_ohm: f64,
    le_mh: f64,
    rz_ohm: f64,
    cz_uf: f64,
    use_zobel: bool,
) -> f64 {
    if f <= 0.0 {
        return 0.0;
    }

    let mut solver = CrossoverSolver::new();
    // Nodo 1: Entrada Vin (1V)
    // Nodo 2: Salida al altavoz / Woofer
    // Nodo 0: Tierra
    
    // Bobina L1 entre Nodo 1 y Nodo 2
    solver.add_branch(1, 2, ComponentType::Inductor, l_mh * 1e-3, dcr_ohm);
    
    // Condensador C1 en paralelo con altavoz (entre Nodo 2 y Tierra 0)
    if c_uf > 0.0 {
        solver.add_branch(2, 0, ComponentType::Capacitor, c_uf * 1e-6, 0.0);
    }

    // Carga del altavoz (Woofer Re + Le) entre Nodo 2 y Tierra 0
    solver.add_branch(2, 0, ComponentType::DriverLoad, re_ohm, le_mh);

    // Red Zobel (Rz + Cz en serie) entre Nodo 2 y Tierra 0
    if use_zobel && rz_ohm > 0.0 && cz_uf > 0.0 {
        // Nodo 3: Nodo intermedio entre Rz y Cz
        solver.add_branch(2, 3, ComponentType::Resistor, rz_ohm, 0.0);
        solver.add_branch(3, 0, ComponentType::Capacitor, cz_uf * 1e-6, 0.0);
    }

    let voltages = solver.solve_voltages(f);
    let v_driver = if voltages.len() > 2 { voltages[2] } else { Complex::ONE };
    
    // Magnitud en dB relativa a 1V de entrada
    let mag = v_driver.norm();
    20.0 * mag.max(1e-5).log10()
}

/// Genera la curva vectorial completa de respuesta del crossover pasivo
#[wasm_bindgen]
pub fn calc_crossover_lowpass_curve(
    l_mh: f64,
    dcr_ohm: f64,
    c_uf: f64,
    re_ohm: f64,
    le_mh: f64,
    rz_ohm: f64,
    cz_uf: f64,
    use_zobel: bool,
    valid: bool,
) -> Array {
    let freqs = default_chart_frequencies();
    let result = Array::new();
    if !valid || l_mh <= 0.0 || re_ohm <= 0.0 {
        return result;
    }

    for &f in freqs.iter() {
        let gain = calc_crossover_lowpass_transfer(
            f, l_mh, dcr_ohm, c_uf, re_ohm, le_mh, rz_ohm, cz_uf, use_zobel,
        );
        result.push(&JsValue::from_f64((gain * 100.0).round() / 100.0));
    }
    result
}

/// Resultado de la optimización Nelder-Mead de filtro crossover
#[derive(Debug, Clone, Copy, Serialize)]
#[wasm_bindgen]
pub struct NelderMeadCrossoverResult {
    pub l_opt_mh: f64,
    pub c_opt_uf: f64,
    pub rms_error_db: f64,
    pub iterations: u32,
}

/// Optimizador Nelder-Mead Simplex en Rust para ajustar bobina L y condensador C
/// contra una frecuencia de corte y pendiente objetivo
#[wasm_bindgen]
pub fn optimize_crossover_lowpass(
    target_fc: f64,
    re_ohm: f64,
    le_mh: f64,
    dcr_ohm: f64,
) -> NelderMeadCrossoverResult {
    if target_fc <= 0.0 || re_ohm <= 0.0 {
        return NelderMeadCrossoverResult {
            l_opt_mh: 1.0,
            c_opt_uf: 10.0,
            rms_error_db: 0.0,
            iterations: 0,
        };
    }

    // Valores iniciales según aproximación Butterworth teórica:
    // L_teorica = (Re * sqrt(2)) / (2*PI*fc)
    // C_teorica = 1 / (2*PI*fc * Re * sqrt(2))
    let sqrt2 = std::f64::consts::SQRT_2;
    let l_init = ((re_ohm * sqrt2) / (2.0 * PI * target_fc)) * 1000.0;
    let c_init = (1.0 / (2.0 * PI * target_fc * re_ohm * sqrt2)) * 1_000_000.0;

    // Función de coste: error cuadrático medio respecto a Butterworth 2.º orden
    let cost = |params: &[f64; 2]| -> f64 {
        let l = params[0].max(0.01);
        let c = params[1].max(0.01);
        
        let mut total_sq_err = 0.0;
        let test_freqs = [
            target_fc * 0.25,
            target_fc * 0.5,
            target_fc * 0.707,
            target_fc * 1.0,
            target_fc * 1.414,
            target_fc * 2.0,
            target_fc * 4.0,
        ];

        for &f in &test_freqs {
            let actual = calc_crossover_lowpass_transfer(f, l, dcr_ohm, c, re_ohm, le_mh, 0.0, 0.0, false);
            // Objetivo teórico Butterworth 2do orden
            let fn_ = f / target_fc;
            let target = -10.0 * (1.0 + fn_.powi(4)).log10();
            let err = actual - target;
            total_sq_err += err * err;
        }
        (total_sq_err / test_freqs.len() as f64).sqrt()
    };

    // Algoritmo Nelder-Mead en 2 dimensiones (Simplex con 3 vértices)
    let mut simplex = [
        [l_init, c_init],
        [l_init * 1.25, c_init],
        [l_init, c_init * 1.25],
    ];

    let mut scores = [cost(&simplex[0]), cost(&simplex[1]), cost(&simplex[2])];

    let alpha = 1.0;  // Reflexión
    let gamma = 2.0;  // Expansión
    let rho = 0.5;    // Contracción
    let sigma = 0.5;  // Reducción

    let mut iterations = 0;
    while iterations < 60 {
        iterations += 1;

        // Ordenar vértices de mejor a peor
        let mut indices = [0, 1, 2];
        indices.sort_by(|&a, &b| scores[a].partial_cmp(&scores[b]).unwrap());
        
        let best = indices[0];
        let second_worst = indices[1];
        let worst = indices[2];

        // Centroide de los mejores puntos
        let centroid = [
            0.5 * (simplex[best][0] + simplex[second_worst][0]),
            0.5 * (simplex[best][1] + simplex[second_worst][1]),
        ];

        // Reflexión
        let xr = [
            centroid[0] + alpha * (centroid[0] - simplex[worst][0]),
            centroid[1] + alpha * (centroid[1] - simplex[worst][1]),
        ];
        let score_r = cost(&xr);

        if score_r < scores[second_worst] && score_r >= scores[best] {
            simplex[worst] = xr;
            scores[worst] = score_r;
            continue;
        }

        // Expansión
        if score_r < scores[best] {
            let xe = [
                centroid[0] + gamma * (xr[0] - centroid[0]),
                centroid[1] + gamma * (xr[1] - centroid[1]),
            ];
            let score_e = cost(&xe);
            if score_e < score_r {
                simplex[worst] = xe;
                scores[worst] = score_e;
            } else {
                simplex[worst] = xr;
                scores[worst] = score_r;
            }
            continue;
        }

        // Contracción
        let xc = [
            centroid[0] + rho * (simplex[worst][0] - centroid[0]),
            centroid[1] + rho * (simplex[worst][1] - centroid[1]),
        ];
        let score_c = cost(&xc);
        if score_c < scores[worst] {
            simplex[worst] = xc;
            scores[worst] = score_c;
            continue;
        }

        // Reducción
        for i in 1..3 {
            let idx = indices[i];
            simplex[idx][0] = simplex[best][0] + sigma * (simplex[idx][0] - simplex[best][0]);
            simplex[idx][1] = simplex[best][1] + sigma * (simplex[idx][1] - simplex[best][1]);
            scores[idx] = cost(&simplex[idx]);
        }
    }

    let mut best_idx = 0;
    for i in 1..3 {
        if scores[i] < scores[best_idx] {
            best_idx = i;
        }
    }

    NelderMeadCrossoverResult {
        l_opt_mh: (simplex[best_idx][0] * 100.0).round() / 100.0,
        c_opt_uf: (simplex[best_idx][1] * 10.0).round() / 10.0,
        rms_error_db: (scores[best_idx] * 100.0).round() / 100.0,
        iterations,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mna_solver_voltage_divider() {
        let mut solver = CrossoverSolver::new();
        // Divisor de tensión simple con dos resistencias R1 = 10 Ohm, R2 = 10 Ohm
        solver.add_branch(1, 2, ComponentType::Resistor, 10.0, 0.0);
        solver.add_branch(2, 0, ComponentType::Resistor, 10.0, 0.0);

        let v = solver.solve_voltages(100.0);
        assert!((v[2].re - 0.5).abs() < 1e-4);
        assert!(v[2].im.abs() < 1e-4);
    }

    #[test]
    fn test_nelder_mead_optimization() {
        let res = optimize_crossover_lowpass(2000.0, 6.0, 0.8, 0.3);
        println!("Nelder Mead result: {:?}", res);
        assert!(res.l_opt_mh > 0.1);
        assert!(res.c_opt_uf > 0.5);
        assert!(res.rms_error_db < 6.0);
    }
}
