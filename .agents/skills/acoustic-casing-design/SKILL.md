---
name: acoustic-casing-design
description: Fórmulas, metodologías y estándares para el diseño de cajas acústicas profesionales (selladas, ventiladas, paso de banda, radiador pasivo, isobáricas), simulación electroacústica avanzada (curvas SPL, excursión de cono, velocidad de aire en puerto, impedancia compleja, fase, retardo de grupo), diseño de crossovers pasivos (1.º a 4.º orden, Zobel, RLC, L-Pad, bobinas Wheeler) y planos CAD 2D/3D.
---

# Guía de Diseño Acústico Profesional de Recintos, Simulación Electroacústica y Divisores de Frecuencia

Esta habilidad asiste en el desarrollo, cálculo y validación de herramientas de simulación de cajas acústicas (en Rust/WebAssembly y TypeScript), filtros divisores pasivos (crossovers), redes de ecualización de impedancia y generación de planos técnicos CAD 2D/3D.

---

## 1. Parámetros Thiele-Small y Deducción Automática Mecánica

| Variable | Descripción | Unidad (Métrica) | Unidad (Imperial) |
| :--- | :--- | :--- | :--- |
| $F_s$ | Frecuencia de resonancia al aire libre | $\text{Hz}$ | $\text{Hz}$ |
| $V_{as}$ | Volumen de aire equivalente a la compliancia de la suspensión | $\text{Litros (L)}$ | $\text{ft}^3$ |
| $Q_{es}$ | Factor de mérito eléctrico del altavoz en $F_s$ | Adimensional | Adimensional |
| $Q_{ms}$ | Factor de mérito mecánico del altavoz en $F_s$ | Adimensional | Adimensional |
| $Q_{ts}$ | Factor de calidad total ($\frac{Q_{es} \cdot Q_{ms}}{Q_{es} + Q_{ms}}$) | Adimensional | Adimensional |
| $R_e$ | Resistencia en corriente continua (DC) de la bobina móvil | $\Omega$ | $\Omega$ |
| $L_e$ | Inductancia de la bobina móvil | $\text{mH}$ | $\text{mH}$ |
| $S_d$ | Área proyectada efectiva del diafragma/cono | $\text{cm}^2$ | $\text{in}^2$ |
| $X_{max}$ | Excursión lineal máxima en una dirección | $\text{mm}$ | $\text{in}$ |
| $Bl$ | Factor de fuerza magnética del motor | $\text{T}\cdot\text{m}$ | $\text{T}\cdot\text{m}$ |
| $M_{ms}$ | Masa mecánica móvil del conjunto diafragma-bobina | $\text{g}$ | $\text{oz}$ |
| $C_{ms}$ | Compliancia mecánica de la suspensión | $\text{mm/N}$ | $\text{in/lb}$ |
| $V_d$ | Volumen de aire desplazado por excursión máxima | $\text{cm}^3$ | $\text{in}^3$ |
| $c$ | Velocidad del sonido en el aire ($\approx 343$) | $\text{m/s}$ | $\text{ft/s}$ |
| $\rho$ | Densidad del aire ($\approx 1.205$ a $20^\circ\text{C}$) | $\text{kg/m}^3$ | $\text{lb/ft}^3$ |

### 1.1 Deducción Automática de Parámetros Faltantes (`auto_params.rs` / `getDriverMechanicals`)
Cuando la hoja de datos del fabricante omite parámetros electromecánicos secundarios, se deducen automáticamente mediante:
* **Compliancia mecánica ($C_{ms}$ en $\text{mm/N}$):**
  $$C_{ms} = \frac{716.1 \cdot V_{as}}{S_d^2}$$
* **Masa móvil ($M_{ms}$ en $\text{g}$):**
  $$M_{ms} = \frac{25330}{F_s^2 \cdot C_{ms}}$$
* **Factor de fuerza ($Bl$ en $\text{T}\cdot\text{m}$):**
  $$Bl = \sqrt{\frac{2\pi \cdot F_s \cdot (M_{ms} / 1000) \cdot R_e}{Q_{es}}}$$
* **Volumen desplazado ($V_d$ en $\text{cm}^3$):**
  $$V_d = S_d \cdot \frac{X_{max}}{10}$$
* **Sensibilidad acústica ($\text{dB}_{\text{SPL}}$ a $1\text{ m} / 2.83\text{ V}$):**
  $$\text{dB}_{\text{SPL}} = 88.49 + 20 \cdot \log_{10}\left(\frac{Bl \cdot S_d}{R_e \cdot M_{ms}}\right)$$

---

## 2. Topologías y Modelos de Alineación de Recintos (`cajas.rs` / `radiador.rs` / `isobaric.rs`)

### 2.1 Cajas Selladas (Closed / Sealed)
* **Relación de elasticidad ($\alpha$):** $\alpha = \frac{V_{as}}{V_b}$
* **Factor de calidad del sistema ($Q_{tc}$):** $Q_{tc} = Q_{ts} \cdot \sqrt{\alpha + 1}$
* **Frecuencia de resonancia en caja ($F_c$):** $F_c = F_s \cdot \sqrt{\alpha + 1}$
* **Volumen neto óptimo ($V_b$) para un $Q_{tc}$ objetivo** (con restricción $Q_{tc} > Q_{ts}$):
  $$V_b = \frac{V_{as}}{\left(\frac{Q_{tc}}{Q_{ts}}\right)^2 - 1}$$
* **Frecuencia de corte a $-3\text{ dB}$ ($F_3$):**
  $$F_3 = F_c \cdot \sqrt{\frac{\left(\frac{1}{Q_{tc}^2} - 2\right) + \sqrt{\left(\frac{1}{Q_{tc}^2} - 2\right)^2 + 4}}{2}}$$

### 2.2 Cajas Ventiladas (Bass-Reflex / Ported) y Geometría de Puertos
* **Longitud de puerto cilíndrico ($L_v$ en $\text{cm}$) para $N_{ports}$ ductos y factor de campana $k$:**
  $$L_v = \frac{23562.5 \cdot D_v^2 \cdot N_{ports}}{F_b^2 \cdot V_b} - k \cdot D_v \quad \text{(o constante } 23407.2 \text{ en puerto simple en } \texttt{cajas.rs}\text{)}$$
  * **Factor de corrección de extremo ($k$ según extremos acampanados `flaredEnds`):**
    * $0$ extremos acampanados (corte recto): $k = 0.732$
    * $1$ extremo acampanado: $k = 0.850$
    * $2$ extremos acampanados: $k = 0.968$
* **Diámetro mínimo anti-turbulencia (sin ruido de viento, $D_{min}$ en $\text{cm}$):**
  $$D_{min} = \sqrt{\frac{0.1 \cdot S_d \cdot X_{max}}{\sqrt{F_b}}}$$
* **Alineaciones clásicas óptimas (Small / Bullock en `calc_alineacion_ventilada`):**
  * **SBB4 ($Q_{ts} < 0.35$):** $V_b = 11 \cdot Q_{ts}^{2.87} \cdot V_{as}$, $F_b = 0.38 \cdot Q_{ts}^{-0.95} \cdot F_s$, $F_3 = F_b$.
  * **B4 ($Q_{ts} \approx 0.38 - 0.40$):** $V_b = 0.25 \cdot Q_{ts}^{-2} \cdot V_{as}$, $F_b = F_s$, $F_3 = F_s$.
  * **QB3 ($Q_{ts} > 0.40$):** $V_b = 6.27 \cdot Q_{ts}^{1.44} \cdot V_{as}$, $F_b = 0.94 \cdot Q_{ts}^{-0.9} \cdot F_s$, $F_3 = 1.2 \cdot Q_{ts}^{-0.9} \cdot F_s$.

### 2.3 Cajas de Paso de Banda (Bandpass 4.º y 6.º Orden)
* **4.º Orden (`calc_bandpass_4`, factor plano $S > Q_{ts}$, usualmente $S = 0.707$):**
  * Cámara trasera sellada: $V_f = \frac{V_{as}}{(S / Q_{ts})^2 - 1}$
  * Cámara delantera ventilada: $V_r = 2 \cdot S^2 \cdot Q_{ts}^2 \cdot V_{as}$
  * Sintonía y ancho de banda: $F_b = F_0 = F_s \cdot \frac{S}{Q_{ts}}$, $\Delta f = \frac{F_s}{Q_{ts}} \cdot S$
* **6.º Orden Paralelo / Clase B (`calc_bandpass_6`, factor $a \approx 2$):**
  * Sintonías: $F_H = F_s \cdot \sqrt{\frac{1 + a}{2}}$, $F_L = F_s \cdot \sqrt{\frac{1}{2(1 + a)}}$
  * Volúmenes simétricos: $V_f = V_r = V_{as} \cdot Q_{ts} \cdot \sqrt{2a}$

### 2.4 Cajas con Radiador Pasivo (`calc_radiador_pasivo`)
* **Compliancias acústicas** ($\text{factor} = \rho \cdot c^2 \cdot S_{d(pr)}^2$):
  $$C_{ab} = \frac{V_b}{\rho \cdot c^2 \cdot S_{d(pr)}^2}, \quad C_{ap} = \frac{V_{as(pr)}}{\rho \cdot c^2 \cdot S_{d(pr)}^2}$$
* **Frecuencia de sintonía ($F_b$) y masa añadida requerida ($M_{ad}$):**
  $$F_b = \frac{1}{2\pi \sqrt{M_p \cdot (C_{ap} + C_{ab})}}, \quad M_{ad} = \max\left(0, \frac{V_{as(pr)}}{V_b \cdot 4\pi^2 \cdot F_b^2 \cdot C_{ap}} - M_p\right)$$

### 2.5 Múltiples Altavoces y Configuraciones Isobáricas (`calc_isobari_multiple`)

| Configuración (`tipo`) | $F_{s\_eq}$ | $V_{as\_eq}$ | $Q_{ts\_eq}$ | Efecto en Volumen Neto ($V_b$) |
| :--- | :--- | :--- | :--- | :--- |
| `"standard"` (1 driver) | $F_s$ | $V_{as}$ | $Q_{ts}$ | $1 \times V_b$ |
| `"serie"` / `"paralelo"` ($n$ drivers) | $F_s$ | $n \cdot V_{as}$ | $Q_{ts}$ | $n \times V_b$ |
| `"isobaric"` (Túnel Push-Pull, 2 drivers) | $F_s$ | $\frac{V_{as}}{2}$ | $Q_{ts}$ | $0.5 \times V_b$ ($-3\text{ dB}$ SPL) |
| `"isobaric_compuesto"` ($n$ drivers) | $F_s$ | $\frac{n \cdot V_{as}}{2}$ | $Q_{ts}$ | $\frac{n}{2} \times V_b$ |

---

## 3. Simulación Electroacústica Avanzada y Curvas (`curves.rs` / `acousticMath.ts`)

El barrido estándar se evalúa en **101 puntos logarítmicos** entre $10\text{ Hz}$ y $500\text{ Hz}$ ($f_i = 10 \cdot 50^{i/100}$), considerando pérdidas de recinto $Q_L = 7.0$.

### 3.1 Funciones de Transferencia de Magnitud SPL (`curves.rs`)
* **Polinomio característico de 4.º orden (Ventilada, con $h = F_b / F_s$, $\alpha = V_{as} / V_b$, $y = f / F_s$):**
  * $a_3 = \frac{1}{Q_{ts}} + \frac{h}{Q_L}$
  * $a_2 = 1 + h^2(1 + \alpha) + \frac{h}{Q_{ts} Q_L}$
  * $a_1 = \frac{h^2}{Q_{ts}} + \frac{h}{Q_L}$
  * $a_0 = h^2$
  * $\text{Re}(y) = y^4 - a_2 y^2 + a_0, \quad \text{Im}(y) = a_1 y - a_3 y^3$
  * Magnitud Bass-Reflex: $|H(y)| = \frac{y^4}{\sqrt{\text{Re}(y)^2 + \text{Im}(y)^2}}$
* **Polinomio de Paso de Banda 4.º Orden ($\alpha_f = V_{as}/V_f$, $\alpha_r = V_{as}/V_r$):**
  * $a_3 = \frac{1}{Q_{ts}} + \frac{h}{Q_L}$
  * $a_2 = h^2 + 1 + \alpha_r + \alpha_f + \frac{h}{Q_{ts} Q_L}$
  * $a_1 = \frac{h^2}{Q_{ts}} + \frac{h}{Q_L}(1 + \alpha_r + \alpha_f)$
  * $a_0 = h^2(1 + \alpha_r)$
  * $\text{Re}(y) = y^4 - a_2 y^2 + a_0, \quad \text{Im}(y) = a_1 y - a_3 y^3$
  * Magnitud Bandpass 4th: $|H(y)| = \frac{y^2 \cdot \alpha_f}{\sqrt{\text{Re}(y)^2 + \text{Im}(y)^2}}$

### 3.2 Excursión Pico del Cono (`calcConeExcursion`, modelo Small-Margolis)
Con tensión de entrada $E_g = \sqrt{P_{in} \cdot R_e}$ y masa móvil $M_{ms}$ en $\text{kg}$:
* **Caja Sellada:**
  $$X(f)\text{ [mm]} = 1000 \cdot \frac{E_g \cdot (Bl / R_e)}{M_{ms} \cdot 4\pi^2} \cdot \frac{1}{\sqrt{(f^2 - F_c^2)^2 + (f \cdot F_c / Q_{tc})^2}}$$
* **Caja Ventilada** (presenta nulo de excursión en $y = h$, es decir, $f = F_b$):
  $$X(f)\text{ [mm]} = 1000 \cdot \frac{E_g \cdot (Bl / R_e)}{M_{ms} \cdot 4\pi^2 \cdot F_s^2} \cdot \frac{|y^2 - h^2|}{\sqrt{\text{Re}(y)^2 + \text{Im}(y)^2}}$$

### 3.3 Velocidad del Aire en el Puerto (`calcVentAirVelocity`)
Flujo volumétrico en el conducto $U_{port}$ ($\text{m}^3/\text{s}$) dividido entre el área total del puerto $A_{port}$ ($\text{m}^2$):
$$U_{port}(f) = \frac{E_g \cdot (Bl / R_e) \cdot S_d}{M_{ms} \cdot 2\pi \cdot F_s} \cdot \frac{h^2}{\sqrt{\text{Re}(y)^2 + \text{Im}(y)^2}}, \quad v_{port}(f)\text{ [m/s]} = \frac{U_{port}(f)}{A_{port}}$$

### 3.4 Impedancia Eléctrica Compleja (`calcSystemImpedance`)
Con resistencia de resonancia $R_0 = R_e \cdot \frac{Q_{ms}}{Q_{es}}$ y reactancia inductiva $\omega L_e = 2\pi f L_e$:
* **Caja Sellada** ($f_n = f / F_c$, $Q_{mc} = Q_{ms}\sqrt{1+\alpha}$):
  $$Z_{mot}(f) = \frac{R_0}{1 + j Q_{mc}(f_n - 1/f_n)}, \quad |Z_{tot}(f)| = \left|R_e + Z_{mot}(f) + j\omega L_e\right|$$
* **Caja Ventilada** (doble pico con mínimo en $F_b$):
  $$Z_{mot}(y) = \frac{R_0 \cdot (j y) \cdot \left[\left(1 - (y/h)^2\right) + j\frac{y}{h Q_L}\right]}{\text{Re}(y) + j\text{Im}(y)}, \quad |Z_{tot}(f)| = \left|R_e + Z_{mot}(y) + j\omega L_e\right|$$

### 3.5 Fase Acústica y Retardo de Grupo (`calcPhaseResponse` / `calcGroupDelayCurve`)
* **Fase ($\phi$ en grados):**
  * Sellada: $\phi(f) = 180^\circ - \text{atan2}\left(\frac{f_n}{Q_{tc}}, 1 - f_n^2\right) \cdot \frac{180}{\pi}$
  * Ventilada: $\phi(f) = -\text{atan2}\left(\text{Im}(y), \text{Re}(y)\right) \cdot \frac{180}{\pi}$
* **Retardo de Grupo ($\tau_g$ en $\text{ms}$ por diferencias finitas con desenrollado de fase):**
  $$\tau_g(f) = -\frac{1}{360} \cdot \frac{\Delta \phi}{\Delta f} \cdot 1000$$

---

## 4. Volumen Neto vs. Bruto y Geometría de Corte

* **Volumen Bruto ($V_{bruto}$):** $V_{bruto} = V_b + V_{driver} + V_{port} + V_{bracing}$
  * $V_{port} = \pi \cdot (D_{ext}/2)^2 \cdot L_v \cdot N_{ports}$
* **Proporción áurea interna ($W_{in} : H_{in} : D_{in}$):** $1 : 1.618 : 0.618$ para minimizar ondas estacionarias.
* **Desglose de paneles con espesor $T$:**
  * Laterales (2x): $H_{ext} \times D_{ext}$ | Superior/Inferior (2x): $W_{in} \times D_{ext}$ | Frontal/Trasero (2x): $W_{in} \times H_{in}$ (donde $X_{ext} = X_{in} + 2T$).

---

## 5. Divisores de Frecuencia Pasivos (Crossovers) y Bobinas (`divisores.rs`)

En todas las ecuaciones: $f_c$ en $\text{Hz}$, $Z$ (o $R$) en $\Omega$, $L$ en $\text{mH}$ ($\times 10^3$), $C$ en $\mu\text{F}$ ($\times 10^6$).

### 5.1 Filtros de 1.º a 4.º Orden
* **1.er Orden (`calc_filtro_1er_orden`):**
  * $C = \frac{10^6}{2\pi f_c R}\text{ [}\mu\text{F]}$, $\quad L = \frac{10^3 \cdot R}{2\pi f_c}\text{ [mH]}$
* **2.º Orden Butterworth (`calc_filtro_2do_orden_butterworth`, $Q = 0.7071$):**
  * Paso Alto (HP): $C_{hp} = \frac{10^6}{2\pi f_c R \sqrt{2}}$, $\quad L_{hp} = \frac{10^3 \cdot R}{2\pi f_c \sqrt{2}}$
  * Paso Bajo (LP): $C_{lp} = \frac{10^6 \cdot \sqrt{2}}{2\pi f_c R}$, $\quad L_{lp} = \frac{10^3 \cdot R \sqrt{2}}{2\pi f_c}$
* **2.º Orden Linkwitz-Riley (`calc_filtro_linkwitz_riley`, $Q = 0.5$, fase $0^\circ$):**
  * $C = \frac{10^6}{4\pi f_c R}\text{ [}\mu\text{F]}$, $\quad L = \frac{10^3 \cdot R}{\pi f_c}\text{ [mH]}$
* **3.er Orden Butterworth ($18\text{ dB/oct}$):**
  * LP: $L_1 = \frac{3Z}{2 \cdot 2\pi f_c} 10^3$, $C = \frac{4}{3Z \cdot 2\pi f_c} 10^6$, $L_2 = \frac{Z}{2 \cdot 2\pi f_c} 10^3$
  * HP: $C_1 = \frac{2}{3Z \cdot 2\pi f_c} 10^6$, $L = \frac{3Z}{4 \cdot 2\pi f_c} 10^3$, $C_2 = \frac{2}{Z \cdot 2\pi f_c} 10^6$
* **4.º Orden ($24\text{ dB/oct}$, coeficientes $a=2.6131, b=3.4142, d=2.4142, e=1.5307$):**
  * LP: $L_1 = \frac{e Z}{2\pi f_c} 10^3$, $C_1 = \frac{d}{e Z 2\pi f_c} 10^6$, $L_2 = \frac{a Z}{d 2\pi f_c} 10^3$, $C_2 = \frac{1}{a Z 2\pi f_c} 10^6$
  * HP: $C_1 = \frac{1}{e Z 2\pi f_c} 10^6$, $L_1 = \frac{e Z}{d 2\pi f_c} 10^3$, $C_2 = \frac{d}{a Z 2\pi f_c} 10^6$, $L_2 = \frac{a Z}{2\pi f_c} 10^3$

### 5.2 Redes de Ecualización y Atenuación
* **Red Zobel (`calc_zobel`):** $R_z = 1.25 \cdot R_e\text{ [}\Omega\text{]}$, $\quad C_z = \frac{L_e \cdot 1000}{R_z^2}\text{ [}\mu\text{F]}$
* **Celda No Resonante RLC (en paralelo para compensar $F_s$):**
  * $R = R_e \frac{Q_{es}}{Q_{ms}}$, $\quad C = \frac{10^6}{2\pi F_s R_e Q_{es}}$, $\quad L = \frac{10^3 \cdot R_e Q_{es}}{2\pi F_s}$
* **Atenuador L-Pad (`calc_lpad`, atenuación $A\text{ dB}$ sobre carga $R_{load}$):**
  * Con $k = 10^{-A/20}$: $R_1\text{ (serie)} = R_{load}(1 - k)$, $\quad R_2\text{ (paralelo)} = R_{load}\left(\frac{k}{1 - k}\right)$

### 5.3 Cálculo Directo e Inverso de Inductores de Núcleo de Aire (Wheeler)
Con diámetro de bobina $d_{\text{mm}}$ en $\text{mm}$, longitud $l_{\text{cm}}$ en $\text{cm}$ ($10 \cdot l_{\text{cm}}$ en $\text{mm}$) y $N$ vueltas:
* **Inductancia directa (`calc_inductor_wheeler`):**
  $$L\text{ [mH]} = \frac{1}{1000} \cdot \frac{d_{\text{mm}}^2 \cdot N^2}{9 \cdot d_{\text{mm}} + 100 \cdot l_{\text{cm}}}$$
* **Número de espiras requerido (`calc_vueltas_inductor_wheeler`):**
  $$N = \sqrt{\frac{(L_{\text{mH}} \cdot 1000) \cdot (9 \cdot d_{\text{mm}} + 100 \cdot l_{\text{cm}})}{d_{\text{mm}}^2}}$$

---

## 6. Visualizaciones CAD 2D/3D y Diagramas Técnicos en la Interfaz (UI)

Los componentes gráficos (`CabinetDiagram.tsx`, `CabinetCad2D.tsx`, `CabinetViewer3DModal.tsx` y `CrossoverCad2D.tsx`) representan planos de ingeniería acústica con estándares CAD:

### Estructura de Vistas (Ortogonales e Interactivas)
1. **Vista Frontal y Lateral en Corte 2D (`CabinetDiagram` / `CabinetCad2D`)**:
   - Contorno externo e interno a escala según el espesor real del tablero ($T$ en $\text{mm}$).
   - Posicionamiento exacto de cada altavoz (woofer, midrange, tweeter) con diámetros reales de montaje, rebajes (baffles), imán y canasta en corte transversal.
   - Representación visual del material fonoabsorbente interno (`dampingType`: sin relleno, fibra de poliéster/guata, espuma acústica piramidal, lana de roca).
   - Tubos de sintonía (ports) con indicación de extremos rectos o acampanados (`flaredEnds`), refuerzos internos perforados (bracing), divisores pasivos y borneras traseras.
2. **Visor Interactivo 3D (`CabinetViewer3DModal`)**:
   - Proyección tridimensional del recinto con explosión de paneles, inspección de cámaras internas (sellada, bass-reflex, paso de banda de 4.º y 6.º orden) y verificación geométrica de colisiones entre el tubo de sintonía y el motor del altavoz.
3. **Plano CAD de Crossover (`CrossoverCad2D`)**:
   - Esquema técnico acotado del circuito divisor pasivo, disposición física de bobinas (orientación ortogonal para evitar acoplamiento inductivo mutuo), capacitores y resistencias cerámicas de los bloques Zobel y L-Pad.
