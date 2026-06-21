# Compendio de Fórmulas y Funciones de Cálculo para Cajas Acústicas

Este documento reúne todas las funciones matemáticas y algoritmos de cálculo acústico utilizados para el dimensionamiento de las diferentes topologías de recintos acústicos (cajas de altavoces/subwoofers).

---

## 1. Variables de Entrada y Constantes Físicas

Los cálculos requieren definir las propiedades mecánicas del transductor y del aire circundante:

| Variable / Parámetro | Descripción | Unidad (Métrica) | Unidad (Inglesa) |
| :--- | :--- | :--- | :--- |
| $F_s$ | Frecuencia de resonancia al aire libre | $\text{Hz}$ | $\text{Hz}$ |
| $V_{as}$ | Volumen de aire equivalente a la suspensión | $\text{Litros (L)}$ | $\text{Pies cúbicos (ft}^3)$ |
| $Q_{ts}$ | Factor de calidad total del altavoz | (Adimensional) | (Adimensional) |
| $S_d$ | Área proyectada efectiva del cono | $\text{cm}^2$ | $\text{in}^2$ |
| $X_{max}$ | Excursión máxima lineal en una dirección | $\text{mm}$ | $\text{in}$ |
| $P_{in}$ | Potencia eléctrica de entrada aplicada | $\text{Watts (W)}$ | $\text{Watts (W)}$ |
| $c$ | Velocidad del sonido en el aire ($\approx 343$) | $\text{m/s}$ | $\text{ft/s}$ |
| $\rho$ | Densidad del aire ($\approx 1.205$ a $20^\circ\text{C}$) | $\text{kg/m}^3$ | $\text{lb/ft}^3$ |

---

## 2. Caja Sellada (Closed / Sealed Box)

En la caja sellada, el volumen de la caja ($V_b$) ejerce una presión neumática de retorno sobre la suspensión del cono.

```
+---------------+
|    Caja       |
|    Sellada    |
|               |
|   [Altavoz]   |
+---------------+
```

### 1. Relación de Elasticidad (Compliance Ratio - $\alpha$)
Define cuánto aumenta la rigidez del aire sobre el altavoz montado:
$$\alpha = \frac{V_{as}}{V_b}$$

### 2. Factor de Calidad del Sistema Montado ($Q_{tc}$)
$$Q_{tc} = Q_{ts} \cdot \sqrt{\alpha + 1} = Q_{ts} \cdot \sqrt{\frac{V_{as}}{V_b} + 1}$$

### 3. Frecuencia de Resonancia en Caja ($F_c$)
$$F_c = F_s \cdot \sqrt{\alpha + 1} = F_s \cdot \sqrt{\frac{V_{as}}{V_b} + 1}$$

### 4. Volumen Neto de la Caja Requerido ($V_b$)
Para obtener un factor de calidad objetivo $Q_{tc}$ (usualmente **0.707** para respuesta plana o **0.577** para óptimo retardo de fase/Bessel):
$$V_b = \frac{V_{as}}{\left(\frac{Q_{tc}}{Q_{ts}}\right)^2 - 1}$$

### 5. Frecuencia de Corte Inferior a -3dB ($F_3$)
$$F_3 = F_c \cdot \left[ \frac{\left( \frac{1}{Q_{tc}^2} - 2 \right) + \sqrt{\left( \frac{1}{Q_{tc}^2} - 2 \right)^2 + 4}}{2} \right]^{0.5}$$

---

## 3. Caja Ventilada (Bass Reflex / Vented)

Aprovecha la resonancia de un ducto de aire para aumentar la respuesta a frecuencias bajas cerca de la sintonía ($F_b$).

```
+---------------+
|               |== Puerto (Lv, Dv)
|  Caja Vented  |== Salida
|               |
|   [Altavoz]   |
+---------------+
```

### 1. Frecuencia de Resonancia Helmholtz de la Caja ($F_b$)
$$F_b = \frac{c}{2\pi} \cdot \sqrt{\frac{A_v}{V_b \cdot (L_v + \delta)}}$$

### 2. Cálculo de Longitud de Puerto Circular ($L_v$)
Para calcular la longitud requerida de un ducto cilíndrico de diámetro $D_v$:

*   **En Sistema Métrico** ($L_v$ en $\text{cm}$, $D_v$ en $\text{cm}$, $V_b$ en $\text{Litros}$, $F_b$ en $\text{Hz}$):
    $$L_v = \frac{23407.2 \cdot D_v^2}{F_b^2 \cdot V_b} - 0.732 \cdot D_v$$
    *(Aplica corrección de extremo de brida simple de $0.732 \cdot r = 0.366 \cdot D_v$ en cada extremo plano).*

*   **En Sistema Inglés** ($L_v$ en $\text{pulgadas}$, $D_v$ en $\text{pulgadas}$, $V_b$ en $\text{ft}^3$, $F_b$ en $\text{Hz}$):
    $$L_v = \frac{2004 \cdot D_v^2}{F_b^2 \cdot V_b} - 0.732 \cdot D_v$$

### 3. Fórmulas de Alineación Óptima (Small/Bullock)
Si no se especifica el volumen, la aplicacion calcula alineaciones estándar basadas en aproximaciones polinómicas del $Q_{ts}$ del altavoz:

#### A. Alineación SBB4 (Sub-Butterworth de 4.º Orden)
*Recomendada para altavoces con $Q_{ts} < 0.35$ (proporciona respuesta plana con caída suave y rápida).*
*   Volumen de la caja: $V_b = 11 \cdot Q_{ts}^{2.87} \cdot V_{as}$
*   Frecuencia de sintonía: $F_b = 0.38 \cdot Q_{ts}^{-0.95} \cdot F_s$
*   Frecuencia de corte inferior: $F_3 = 0.38 \cdot Q_{ts}^{-0.95} \cdot F_s$

#### B. Alineación B4 (Butterworth de 4.º Orden)
*Recomendada para $Q_{ts} \approx 0.38 - 0.40$ (máxima respuesta plana en la banda de paso).*
*   Volumen de la caja: $V_b = 0.25 \cdot Q_{ts}^{-2} \cdot V_{as}$
*   Frecuencia de sintonía: $F_b = F_s$
*   Frecuencia de corte inferior: $F_3 = F_s$

#### C. Alineación QB3 (Quasi-Butterworth de 3.er Orden)
*Recomendada para $Q_{ts} > 0.4$ (permite cajas compactas sacrificando algo de extensión).*
*   Volumen de la caja: $V_b = 6.27 \cdot Q_{ts}^{1.44} \cdot V_{as}$
*   Frecuencia de sintonía: $F_b = 0.94 \cdot Q_{ts}^{-0.9} \cdot F_s$
*   Frecuencia de corte inferior: $F_3 = 1.2 \cdot Q_{ts}^{-0.9} \cdot F_s$

---

## 4. Caja de Paso de Banda (Bandpass Box)

El altavoz está encerrado internamente. La radiación al exterior se realiza únicamente por medio del puerto o puertos.

### A. Paso de Banda de 4.º Orden

```
+------------------------------------+
| Cámara Trasera | Cámara Delantera  |==== Puerto (Lv, Dv)
| Sellada (Vf)   | Ventilada (Vr)    |==== Salida
|                |                   |
|           [Altavoz]                |
+------------------------------------+
```

#### 1. Frecuencia de Resonancia Central ($F_0$)
Es la frecuencia media donde el sistema tiene mayor sensibilidad:
$$F_0 = \sqrt{F_c \cdot F_b}$$
Donde:
*   $F_c$: Resonancia de la cámara sellada trasera ($V_f$) con el altavoz montado.
*   $F_b$: Frecuencia de sintonía de la cámara delantera ($V_r$) con su ducto.

#### 2. Ecuaciones de Diseño Clásicas (Alineación Plana de Coeficiente de Acoplamiento - $S$)
Definiendo un factor de respuesta plana $S$ (usualmente $S = 0.707$):
*   Volumen de la cámara sellada ($V_f$):
    $$V_f = \frac{V_{as}}{\left(\frac{S}{Q_{ts}}\right)^2 - 1}$$
*   Volumen de la cámara ventilada ($V_r$):
    $$V_r = 2 \cdot S^2 \cdot Q_{ts}^2 \cdot V_{as}$$
*   Frecuencia de sintonía del puerto de la cámara delantera ($F_b$):
    $$F_b = F_s \cdot \frac{S}{Q_{ts}}$$
*   Ancho de Banda Acústico a -3dB ($\Delta f = F_{alta} - F_{baja}$):
    $$\Delta f = \frac{F_s}{Q_{ts}} \cdot S$$

---

### B. Paso de Banda de 6.º Orden (Paralelo / Clase B)

Ambas cámaras ($V_f$ trasera y $V_r$ delantera) están ventiladas directamente hacia el exterior. Se sintonizan a frecuencias diferentes ($F_L$ más baja y $F_H$ más alta).

```
Ducto Trasero (FL)
   ||
+------------------------------------+
| Cámara Trasera | Cámara Delantera  |==== Ducto Delantero (FH)
| Ventilada (Vf) | Ventilada (Vr)    |==== Salida
|                |                   |
|           [Altavoz]                |
+------------------------------------+
```

#### 1. Frecuencias de Sintonía Óptimas
Para obtener una banda de paso con rizado mínimo en función de un factor de alineación de sintonía $a$ (típicamente $a \approx 2$):
*   Sintonía Cámara Delantera ($F_H$):
    $$F_H = F_s \cdot \sqrt{\frac{1 + a}{2}}$$
*   Sintonía Cámara Trasera ($F_L$):
    $$F_L = F_s \cdot \sqrt{\frac{1}{2 \cdot (1 + a)}}$$

#### 2. Relación de Volúmenes
$$V_f = V_r = V_{as} \cdot Q_{ts} \cdot \sqrt{2 \cdot a}$$

---

## 5. Caja con Radiador Pasivo (Passive Radiator)

El radiador pasivo se comporta matemáticamente como el puerto de una caja ventilada, pero introduce variaciones debido a la compliancia mecánica del cono del radiador ($C_{ap}$) y su masa móvil ($M_{mp}$).

```
+---------------+
|               |
|  Caja         |== Radiador Pasivo (Map, Cap)
|  PR           |
|   [Altavoz]   |
+---------------+
```

### 1. Frecuencia de Sintonía de la Caja ($F_b$)
$$F_b = \frac{1}{2\pi} \cdot \sqrt{\frac{1}{M_{mp} \cdot (C_{ap} + C_{ab})}}$$
Donde $C_{ab}$ es la elasticidad acústica del volumen de la caja:
$$C_{ab} = \frac{V_b}{\rho \cdot c^2 \cdot S_d^2}$$

### 2. Masa Añadida Necesaria para Sintonización ($M_{ad}$)
Si se desea sintonizar la caja a una frecuencia $F_b$, y el radiador posee una masa mecánica inherente de cono $M_{ms(pr)}$ y un volumen equivalente $V_{as(pr)}$:
$$M_{ad} = \left[ \frac{V_{as(pr)}}{V_b \cdot 4\pi^2 \cdot F_b^2 \cdot C_{ms(pr)}} \right] - M_{ms(pr)}$$
Donde la compliancia del radiador pasivo es:
$$C_{ms(pr)} = \frac{V_{as(pr)}}{\rho \cdot c^2 \cdot S_{d(pr)}^2}$$

---

## 6. Múltiples Altavoces y Configuraciones Isobáricas (Isobaric)

Cuando se emplean múltiples altavoces idénticos en la misma caja, sus parámetros mecánicos equivalentes cambian afectando el cálculo de $V_b$.

```
Configuración Standard (Paralelo):                Configuración Isobaric (Push-Pull Acoplados):
   +---------------+                                 +---------------+
   |   [Altavoz 1] |                                 | [Alt 1]-[Alt 2]
   |               |                                 |   (Túnel)     |
   |   [Altavoz 2] |                                 |               |
   +---------------+                                 +---------------+
```

### 1. Modificación de Parámetros Equivalentes

| Configuración | Fs Equivalente ($F_{s\_eq}$) | Vas Equivalente ($V_{as\_eq}$) | Qts Equivalente ($Q_{ts\_eq}$) | Vol. Caja Sugerido ($V_{b\_eq}$) |
| :--- | :--- | :--- | :--- | :--- |
| **Un Altavoz** | $F_s$ | $V_{as}$ | $Q_{ts}$ | $V_b$ |
| **Múltiples en Serie** | $F_s$ | $n \cdot V_{as}$ | $Q_{ts}$ | $n \cdot V_b$ |
| **Múltiples en Paralelo** | $F_s$ | $n \cdot V_{as}$ | $Q_{ts}$ | $n \cdot V_b$ |
| **Isobaric (Túnel)** | $F_s$ | $\frac{V_{as}}{2}$ | $Q_{ts}$ | $\frac{V_b}{2}$ |
| **Isobaric Compuesto** | $F_s$ | $\frac{n \cdot V_{as}}{2}$ | $Q_{ts}$ | $\frac{n \cdot V_b}{2}$ |

*Nota: $n$ representa la cantidad de drivers.*

### 2. Ventaja de la Configuración Isobárica
Dado que $V_{as\_eq} = \frac{V_{as}}{2}$, se puede obtener el mismo valor de alineación de graves (misma frecuencia $F_3$) con la **mitad del volumen físico de caja** ($V_{b\_isobaric} = 0.5 \cdot V_b$). A cambio, la sensibilidad acústica del sistema compuesto se reduce en 3dB respecto a dos altavoces estándar trabajando en el exterior en el mismo volumen.
