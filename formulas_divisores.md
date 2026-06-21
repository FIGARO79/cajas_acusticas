
# Fórmulas para el diseño de divisores de frecuencia

## Introducción
Este documento resume las ecuaciones y constantes necesarias para calcular componentes de filtros pasivos (crossovers) de 1.º a 4.º orden, así como redes Zobel y atenuadores L‑Pad, tal como se describen en los recursos analizados:
- **pronine.ca** (cálculo de inductores y capacitancias para filtros de primer y segundo orden).
- **v‑cap.com** (calculadora de cruzadores de segundo y cuarto orden, Linkwitz‑Riley, Butterworth y componentes auxiliares).

---

## 1️⃣ Filtros de primer orden (RC o RL)

- **Paso alto (HP)**:
  - Capacitor serie: \( C = \frac{1}{2 \pi f_c R}\)
  - Inductor en serie (alternativa): \( L = \frac{R}{2 \pi f_c}\)
- **Paso bajo (LP)**:
  - Capacitor en paralelo: \( C = \frac{1}{2 \pi f_c R}\)
  - Inductor en paralelo: \( L = \frac{R}{2 \pi f_c}\)

Donde \(f_c\) es la frecuencia de cruce (Hz) y \(R\) la impedancia nominal del altavoz (Ω).

---

## 2️⃣ Filtros de segundo orden (Butterworth y Linkwitz‑Riley)

### 2.1 Butterworth (orden 2)
- **Q factor**: \(Q = \frac{1}{\sqrt{2}} \approx 0.7071\)
- **Componentes** (para una topología "RC" tradicional):
  - Capacitor serie (HP): \( C_{s} = \frac{1}{2 \pi f_c R \sqrt{2}}\)
  - Capacitor paralelo (LP): \( C_{p} = \frac{\sqrt{2}}{2 \pi f_c R}\)
  - Inductor serie (HP): \( L_{s} = \frac{R}{2 \pi f_c \sqrt{2}}\)
  - Inductor paralelo (LP): \( L_{p} = \frac{R \sqrt{2}}{2 \pi f_c}\)

### 2.2 Linkwitz‑Riley 2º orden (LR2)
- **Coeficientes** (igual a cascada de dos Butterworth de primer orden):
  - \(C = \frac{0.0796}{f_c}\)  (µF para \(f_c\) en kHz y \(R = 8\,\Omega\))
  - \(L = \frac{0.3183}{f_c}\) (mH para \(f_c\) en kHz y \(R = 8\,\Omega\))
- **Ventaja**: fase 0° total y respuesta plana en frecuencia sumada.

---

## 3️⃣ Filtros de tercer orden (Cascada 2º + 1º)

No se utilizan comúnmente en divisores pasivos, pero para completitud:
- **Crossover de 3.º orden** → combina un filtro de 2.º orden (Butterworth o LR) con un filtro de 1.º orden.
- **Componentes** se obtienen sumando las expresiones de 2.º y 1.º orden correspondientes.

---

## 4️⃣ Filtros de cuarto orden (Linkwitz‑Riley 4º)

### 4.1 LR4 (cascada de dos Butterworth de 2.º orden)
- **Frecuencia de cruce** \(f_c\) se mantiene igual que en LR2.
- **Componentes** (para \(R = 8\,\Omega\)):
  - Capacitor: \(C = \frac{0.0796}{f_c}\)  µF
  - Inductor: \(L = \frac{0.3183}{f_c}\)  mH
- **Ganancia**: \(\pm 0\) dB en la zona de cruce, fase nula.

---

## 5️⃣ Red Zobel (compensación de inductancia del altavoz)

Para un altavoz con resistencia \(R_e\) y inductancia \(L_e\) (mH):
- **Resistencia Zobel**: \( R_z = 1.25 \times R_e \)
- **Capacitor Zobel** (µF):
  \[ C_z = \frac{L_e \times 1000}{R_z^2} \]
  (el factor 1000 convierte mH a µH para que la unidad de \(C\) quede en µF).

---

## 6️⃣ Atenuador L‑Pad (para ajustar SPL)

Objetivo: obtener una atenuación \(A\) (dB) entre la fuente y el altavoz.
- **Relación de atenuación**: \( k = 10^{\frac{-A}{20}} \)
- **Resistencias** (para una carga \(R_{load}\)):
  - \( R_1 = \frac{R_{load} \times k}{1 - k}\)
  - \( R_2 = \frac{R_{load}}{1 - k}\)
- **Ejemplo**: \(A = 6\) dB → \(k = 0.501\)
  - Con \(R_{load}=8\,\Omega\): \(R_1 \approx 8.0\,\Omega\), \(R_2 \approx 15.9\,\Omega\).

---

## 7️⃣ Cálculo de inductores (Wheeler) – pronine.ca

Para una bobina de alambre de cobre con \(N\) vueltas, sección transversal media \(A\) (cm²) y longitud \(l\) (cm):
\[ L (mH) = \frac{(\mu_0 \times N^2 \times A)}{l} \times 10^3 \]
Donde \(\mu_0 = 4\pi \times 10^{-7} \) H/m.
- **Versión práctica (pronine)** para alambre sólido (AWG):
  \[ L = \frac{(d^2 \times N^2)}{9d + 10l} \]  (µH)  
  con \(d\) = diámetro del alambre (mm).
- Se emplea iterativamente para obtener la sección del alambre que cumpla con la inductancia requerida por el filtro.

---

## 8️⃣ Tabla de referencia rápida

| Tipo de filtro | Orden | Topología | Coeficiente \(C\) (µF) | Coeficiente \(L\) (mH) | Q / Factor | Comentario |
|----------------|-------|-----------|----------------------|----------------------|------------|------------|
| RC / RL | 1 | HP / LP | \(C = \frac{1}{2\pi f_c R}\) | \(L = \frac{R}{2\pi f_c}\) | — | Simple, usado para filtros de sub‑woofer de bajo cruce |
| Butterworth | 2 | LP/HP | \(C = \frac{\sqrt{2}}{2\pi f_c R}\) | \(L = \frac{R\sqrt{2}}{2\pi f_c}\) | Q = 0.707 | Respuesta plana en pasabanda |
| Linkwitz‑Riley | 2 (LR2) | LP/HP | \(C = \frac{0.0796}{f_c}\) | \(L = \frac{0.3183}{f_c}\) | — | Fase 0° al cruzar, suma 0 dB |
| Linkwitz‑Riley | 4 (LR4) | LP/HP | \(C = \frac{0.0796}{f_c}\) | \(L = \frac{0.3183}{f_c}\) | — | Cascada de dos Butterworth 2.º orden |
| Zobel | — | Red de compensación | \(C_z = \frac{L_e \times 1000}{(1.25 R_e)^2}\) | — | — | Suprime pico inductivo del driver |
| L‑Pad | — | Atenuador | — | — | — | Calcula \(R_1, R_2\) a partir de dB deseados |

---

## 9️⃣ Referencias
1. **pronine.ca – Inductors**: https://www.pronine.ca/multind.htm
2. **V‑Cap – Speaker Crossover Calculator**: https://www.v-cap.com/speaker-crossover-calculator.php
3. **BassBox Pro** – Código fuente analizado en el proyecto `cajas_acusticas`.

---

*Este documento está pensado para ser incluido en la aplicación de cálculo de cajas acústicas y servir como base para la futura pestaña “Divisores de frecuencia”.*
