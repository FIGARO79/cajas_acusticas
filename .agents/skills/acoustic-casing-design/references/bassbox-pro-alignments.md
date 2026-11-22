# Referencia Técnica: Alineaciones y Tablas de BassBox 6 Pro

## 1. Procedencia y Evidencia REA
- **Binario**: `BassBox 6.exe` (v6.23, PE32 `i386`, Visual Basic 5.0 Native Code)
- **SHA-256**: `7633efab325261539c59baad5b018c2bab1f07983c09e94d2e58086684115e08`
- **Rutinas clave**:
  - Recomendación EBP / $Q_{ts}$ (`winDesignWiz`): `0x006e3250–0x006e3750` (umbrales `60.0f` en `0x00412b30`, `90.0f` en `0x00412b48`, `Qts` `0.3` / `0.5` en `0x00412b38` / `0x00412b40`).
  - Prioridades (`winPriority::Form_Load`): `0x00f79c52–0x00f7af27` (`1` High Output, `2` High Fidelity, `3` Extended Bass solo en `BoxType=2`, `4` Desired F3).
  - `winBox::SuggestFb_Click`: `0x0091c571–0x0091cfa0`.
  - `winBox::SuggestOpt_Click`: `0x0091cfa0–0x00934937` (Closed, Vented, B6, Bandpass 4/6, Passive Radiator).

---

## 2. Tabla Continua por Tramos de Keele (`B4` Hi-Fi y `calc_suggest_fb`)

Implementada en `backend/src/cajas.rs` (`bassbox_vented_coeffs`):

| Rango de $Q_{ts}$ | $K_v$ | $P_v$ | $K_f$ | $P_f$ | $C_{vas}$ |
| :--- | :---: | :---: | :---: | :---: | :--- |
| $Q_{ts} \le 0.259$ | `6.096` | `2.432` | `0.3985` | `0.940` | `6.096` |
| $0.259 < Q_{ts} \le 0.313$ | `6.096` | `2.432` | `0.428` | `0.883` | `6.096` |
| $0.313 < Q_{ts} \le 0.383$ | `18.029` | `3.365` | `0.428` | `0.883` | `18.029` |
| $0.383 < Q_{ts} \le 0.490$ | `18.029` | `3.365` | `0.397` | `0.963` | `18.029` |
| $0.490 < Q_{ts} \le 0.750$ | `6.427` | `1.943` | `0.457` | `0.766` | `6.5 + ((Qts - 0.49) / 0.05) * 1.1` |
| $Q_{ts} > 0.750$ | `6.427` | `1.943` | `0.457` | `0.766` | `12.0 + ((Qts - 0.75) / 0.05) * 1.6` |

- **Hi-Fi (`B4`)**:
  $$V_b = K_v \cdot V_{as} \cdot Q_{ts}^{P_v}, \qquad F_b = K_f \cdot F_s \cdot Q_{ts}^{-P_f}$$
- **Suggest $F_b$ para $V_b$ dado**:
  $$F_b = K_f \cdot F_s \cdot \left(\frac{C_{vas} \cdot V_{as}}{V_b}\right)^{P_f / P_v}$$

---

## 3. Tablas de Paso Banda 6.º Orden (`calc_bandpass_6_bassbox`)

Partiendo de la base Keele: $V_{b,\text{base}} = K_v V_{as} Q_{ts}^{P_v}$ y $F_{b,\text{base}} = K_f F_s Q_{ts}^{-P_f}$.

### 3.1 Topología Paralela (`topology == "parallel"`, `0x00928baf–0x0092900e`)
$V_r = \max(V_{b,\text{base}}, 0.5)$, $V_f = \max(V_r / \text{Vb\_ratio}, 0.5)$, $F_l = \max(F_{b,\text{base}}, 15.0)$, $F_h = F_l \cdot \text{Fb\_ratio}$.

| Rango de $Q_{ts}$ | $\text{Vb\_ratio}$ ($V_r / V_f$) | $\text{Fb\_ratio}$ ($F_h / F_l$) |
| :--- | :--- | :--- |
| $Q_{ts} \le 0.2$ | `1.3 + (Qts / 0.3) * 0.15` | `2.83 - (Qts / 0.2) * 0.58` |
| $0.2 < Q_{ts} \le 0.3$ | `1.3 + (Qts / 0.3) * 0.15` | `2.25 - ((Qts - 0.2) / 0.1) * 0.15` |
| $0.3 < Q_{ts} \le 0.5$ | `1.5 + ((Qts - 0.3) / 0.2) * 1.0` | `2.10 - ((Qts - 0.3) / 0.2) * 0.25` |
| $0.5 < Q_{ts} \le 0.6$ | `2.5 + ((Qts - 0.5) / 0.1) * 0.9` | `1.85` |
| $Q_{ts} > 0.6$ | `3.4` | `1.85` |

### 3.2 Topología Serie (`topology == "series"`, `0x0092c45a–0x0092d7a9`)
$V_r = \max(V_{b,\text{base}} \cdot m_{Vr}, 0.5)$, $V_f = \max(V_{b,\text{base}} \cdot m_{Vf}, 0.5)$, $F_l = \max(F_{b,\text{base}} \cdot m_{Fl}, 15.0)$, $F_h = \max(F_l \cdot 2.5, 1.4 \cdot F_l)$.

| Rango de $Q_{ts}$ | $m_{Fl}$ | $m_{Vf}$ | $m_{Vr}$ |
| :--- | :--- | :--- | :--- |
| $Q_{ts} \le 0.2$ ($t = Q_{ts}/0.2$) | `0.925 - t * 0.05` | `1.17 - t * 0.34` | `0.78 - t * 0.10` |
| $0.2 < Q_{ts} \le 0.3$ ($t = (Q_{ts}-0.2)/0.1$) | `0.875 - t * 0.025` | `0.83 - t * 0.27` | `0.68 + t * 0.11` |
| $0.3 < Q_{ts} \le 0.4$ ($t = (Q_{ts}-0.3)/0.1$) | `0.85 - t * 0.08` | `0.56 - t * 0.25` | `0.79 + t * 0.11` |
| $0.4 < Q_{ts} \le 0.5$ ($t = (Q_{ts}-0.4)/0.1$) | `0.77 - t * 0.07` | `0.31 - t * 0.11` | `0.90 + t * 0.12` |
| $0.5 < Q_{ts} \le 0.6$ ($t = (Q_{ts}-0.5)/0.1$) | `0.70 - t * 0.075` | `0.20 - t * 0.03` | `1.02 + t * 0.04` |
| $0.6 < Q_{ts} \le 0.7$ ($t = (Q_{ts}-0.6)/0.1$) | `0.625 - t * 0.075` | `0.17 - t * 0.01` | `1.06 + t * 0.05` |
| $Q_{ts} > 0.7$ ($t = \min((Q_{ts}-0.7)/0.1, 3.0)$) | `max(0.55 - t * 0.05, 0.35)` | `0.16` | `1.11` |

---

## 4. Escalera Comercial de Radiadores Pasivos (`suggest_passive_radiator`)

Para $d_{\text{req}} = d_{\text{drv}} \cdot \sqrt{2}$ (desplazamiento $\ge 2\times V_d$):

| Umbral $d_{\text{req}}$ (m) | Diámetro sugerido (in) | Diámetro (cm) |
| :---: | :---: | :---: |
| $\le 0.127$ | `6"` | `15.24` |
| $\le 0.178$ | `8"` | `20.32` |
| $\le 0.229$ | `10"` | `25.40` |
| $\le 0.279$ | `12"` | `30.48` |
| $\le 0.356$ | `15"` | `38.10` |
| $\le 0.432$ | `18"` | `45.72` |
| $\le 0.508$ | `21"` | `53.34` |
| $\le 0.711$ | `30"` | `76.20` |
| $\le 0.864$ | `36"` | `91.44` |
| $\le 1.016$ | `42"` | `106.68` |
| $\le 1.168$ (o mayor) | `48"` | `121.92` |

---

## 5. Pérdidas por Absorción ($Q_a$), Fugas ($Q_L(V_b)$) y Transferencia BP6 Serie/Paralelo

### 5.1 Pérdidas del Recinto (Modelo BassBox vs. Clásico)
Implementadas en `backend/src/cajas.rs` y `backend/src/curves.rs` (variantes `*_ex` y `*_model`):
- **Modo Clásico (`classical_model == true`)**: $Q_L = 7.0$, $Q_a \to \infty$, $Q_B = 7.0$.
- **Modo BassBox (`classical_model == false`)**:
  - Fugas dependientes del volumen: $Q_L(V_b) = \text{clamp}\left(7.0 \cdot \left(\frac{50.0}{\max(V_b, 1.0)}\right)^{0.22},\; 5.0,\; 20.0\right)$.
  - Absorción según nivel de relleno (`0..3`): $Q_a \in \{100, 50, 15, 6\}$ (`none`, `light`, `moderate`, `heavy`).
  - Combinación en paralelo: $Q_B = \left(\frac{1}{Q_L} + \frac{1}{Q_a}\right)^{-1}$.
  - En caja sellada: $Q_{tc,\text{eff}} = \left(\frac{1}{Q_{ts}\sqrt{1+\alpha}} + \frac{\alpha}{(1+\alpha) Q_B}\right)^{-1}$.

### 5.2 Función de Transferencia Paso Banda 6.º Orden (`calc_bandpass6_response_at_ex`)
Evaluada mediante admitancias complejas normalizadas ($y = f / F_s$, $s = j y$, $C_{ar} = V_r / V_{as}$, $C_{af} = V_f / V_{as}$, $M_{pr} = \alpha_r / h_l^2$, $M_{pf} = \alpha_f / h_h^2$, pérdidas $Q_{br}, Q_{bf}$ y $Q_p = 50$):
- **Topología Serie (`"series"`)**: puerto interno $V_r \leftrightarrow V_f$ ($F_l$) y puerto externo $V_f \to \text{aire}$ ($F_h$):
  $$Y_{12} = Y_{pr} + Y_d,\quad \Delta = (Y_{cr} + Y_{12})(Y_{cf} + Y_{pf} + Y_{12}) - Y_{12}^2,\quad H_{\text{series}}(s) = s \cdot Y_{pf} \cdot \frac{Y_d \cdot Y_{cr}}{\Delta}$$
- **Topología Paralelo (`"parallel"`)**: ambas cámaras ventilan al exterior ($F_l$ y $F_h$):
  $$Z_r = (Y_{cr} + Y_{pr})^{-1},\quad Z_f = (Y_{cf} + Y_{pf})^{-1},\quad U_d = (Z_d + Z_r + Z_f)^{-1},\quad H_{\text{parallel}}(s) = s \cdot U_d \cdot (Z_f Y_{pf} - Z_r Y_{pr})$$

---

## 6. Estado de Integración (Completado)
1. **Pérdidas por absorción ($Q_a$) y fugas ($Q_L(V_b)$)**: integradas en `backend/src/cajas.rs`, `backend/src/curves.rs`, `src/wasm/index.ts`, `src/utils/acousticMath.ts`, `src/App.tsx` y `src/components/SimulationChart.tsx`.
2. **Función de transferencia dedicada Paso Banda 6.º Orden Serie y Paralelo**: integrada en `backend/src/curves.rs` (`calc_bandpass6_response_at_ex` y curvas asociadas) y conectada a la simulación y reportes.
3. **Reportes y CAD 2D/3D**: actualizados `src/utils/reportGenerator.ts`, `src/components/CabinetTab.tsx`, `src/components/CabinetDiagram.tsx`, `src/components/CabinetCad2D.tsx` y `src/components/CabinetViewer3DModal.tsx` para reflejar topología 6.º serie vs paralelo, filtro activo `B6` y radiador pasivo sugerido.
4. **ESLint y verificación visual en ejecución**: limpieza aplicada en `eslint.config.js` y componentes React/TS; verificación de tests, build y `npm run dev`.
