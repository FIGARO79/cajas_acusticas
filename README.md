# AcousticSim - Calculadora Profesional de Cajas Acústicas

**AcousticSim** es una aplicación web interactiva (Single Page Application, SPA) de alto rendimiento diseñada para la simulación gráfica y el dimensionamiento de recintos acústicos (cajas de altavoces) basados en los parámetros electromecánicos **Thiele/Small**. 

Presenta un diseño claro de grado profesional inspirado en software técnico de escritorio (*BassBox Pro*, *WinISD*, *MATLAB*), optimizado para ofrecer la máxima legibilidad y precisión matemática con una tipografía limpia en pesos **Normal (400)** y **Semibold (600)**.

---

## 🚀 Características Clave

1. **Simulación de Respuesta en Frecuencia en Tiempo Real:**
   * Gráfico interactivo logarítmico (10 Hz - 500 Hz) con **Chart.js**.
   * Representación simultánea de las curvas de ganancia ($dB$) para recintos **Sellados (Sealed)** y **Ventilados (Ported)**.
   * Tooltips de alta precisión que muestran la ganancia exacta a cualquier frecuencia específica.
   * Curvas adaptadas dinámicamente con rejillas de alta visibilidad para temas claros.

2. **Cálculo de Dimensiones Físicas y Ebanistería:**
   * **Prisma Rectangular Estándar** con cálculo de proporciones acústicas áureas, clásicas o cúbicas.
   * **Caja Trapezoidal (Cuña)** para optimizar espacio en maleteros de vehículos, incluyendo el cálculo trigonométrico automático de la altura de inclinación del bafle ($H_{slant}$).
   * **Bloqueo de Dimensiones:** Permite fijar dos dimensiones de la caja (ej. Alto y Profundidad) y calcular automáticamente la tercera dimensión necesaria para alcanzar el volumen acústico neto.
   * **Lista de Corte Detallada:** Tabla de despiece de madera optimizada para grosores comerciales (15mm, 18mm, 19mm, 25mm de MDF/DM).

3. **Simulación Avanzada de Puertos (Bass-Reflex) y Turbulencia:**
   * Soporte para múltiples puertos redondos.
   * **Sugerencias de Puertos Comerciales:** Tabla de recomendaciones de diámetro (2", 3", 4", 6") y cantidad de puertos con enlace "Aplicar" instantáneo.
   * **Integración en Ebanistería:** Muestra las especificaciones del puerto (tamaño, cantidad, longitud de corte) directamente en la pestaña de corte de madera si se selecciona caja ventilada.
   * **Detector de Ruido de Soplido ("Chuffing"):** Calcula la velocidad de pico del aire en el puerto y muestra alertas visuales en código de color (Verde/Amarillo/Rojo) según el nivel de ruido esperado.

4. **Modo Pro - Parámetros Thiele/Small Extendidos:**
   * Permite ingresar y calcular parámetros adicionales: $BL$ (fuerza motor), $Mms$ (masa móvil), $Cms$ (compliancia), $Pe$ (potencia RMS) y $Xlim$ (excursión mecánica máxima).
   * **Deducción de Parámetros:** Si quedan vacíos, el sistema calcula de forma cruzada la Compliancia ($Cms$), la Masa ($Mms$) y el factor de motor ($BL$) basándose en el área del cono ($Sd$), resonancia ($Fs$) y volumen equivalente ($Vas$).
   * **Parámetros Derivados:** Muestra en tiempo real la Eficiencia de Referencia ($\eta_0$), Sensibilidad ($SPL_{1W/1m}$), SPL Máximo a potencia RMS ($SPL_{max}$), pérdidas de la suspensión ($R_{ms}$) e Impedancia en Resonancia ($Z_{max}$).

---

## 📐 Ecuaciones Matemáticas y Lógica de Simulación

### 1. Caja Sellada (Sealed)
* **Relación de volumen ($\alpha$):**
  $$\alpha = \frac{Vas}{Vb}$$
* **Q del sistema ($Qtc$):**
  $$Qtc = Qts \cdot \sqrt{\alpha + 1}$$
* **Frecuencia de resonancia del sistema ($Fc$):**
  $$Fc = Fs \cdot \sqrt{\alpha + 1}$$
* **Respuesta de magnitud:**
  $$20 \log_{10} \left( \frac{x^2}{\sqrt{(x^2 - 1)^2 + (x/Qtc)^2}} \right) \quad \text{donde } x = \frac{f}{Fc}$$

### 2. Caja Ventilada (Ported)
Modelado de cuarto orden con pérdidas acústicas por fugas ($Ql = 7.0$):
* **Frecuencia de corte inferior ($F3$):** Estimada numéricamente en tiempo real mediante búsqueda binaria de precisión (20 iteraciones) sobre la función de transferencia del sistema.
* **Respuesta de magnitud:**
  $$|H(jf)| = \frac{y^4}{\sqrt{(y^4 - a_2 \cdot y^2 + a_0)^2 + (a_1 \cdot y - a_3 \cdot y^3)^2}}$$
  donde $y = f/Fs$, $h = Fb/Fs$, $\alpha = Vas/Vb$, y los coeficientes de filtro son:
  $$a_3 = \frac{1}{Qts} + \frac{h}{Ql}$$
  $$a_2 = 1 + h^2(1 + \alpha) + \frac{h}{Qts \cdot Ql}$$
  $$a_1 = \frac{h^2}{Qts} + \frac{h}{Ql}$$
  $$a_0 = h^2$$

### 3. Ductos y Velocidad del Aire
* **Longitud del puerto corregida por extremos ($Lv$ en cm):**
  $$Lv = \frac{23562.5 \cdot d^2 \cdot N_p}{Fb^2 \cdot Vb} - 1.46 \cdot r$$
  *donde $d$ es el diámetro del puerto en cm, $r$ es el radio en cm, $N_p$ es la cantidad de puertos e indica una corrección de extremo de $1.46r$.*
* **Velocidad máxima del aire en el puerto ($v_{peak}$ en m/s):**
  $$v_{peak} = \frac{0.008 \cdot Fb \cdot Sd \cdot Xmax}{N_p \cdot d^2}$$
* **Diámetro mínimo para evitar turbulencia ($D_{min}$ en cm):**
  $$D_{min} = \sqrt{\frac{0.1 \cdot Sd \cdot Xmax}{\sqrt{Fb}}}$$

### 4. Parámetros Derivados (Modo Pro)
* **Eficiencia de Referencia ($\eta_0$):**
  $$\eta_0 = 9.64 \cdot 10^{-10} \cdot \frac{Fs^3 \cdot Vas}{Qes}$$
* **Sensibilidad ($SPL$ a 1W/1m en dB):**
  $$SPL = 112.2 + 10 \log_{10}(\eta_0)$$
* **SPL Máximo ($SPL_{max}$ en dB):**
  $$SPL_{max} = SPL + 10 \log_{10}(Pe)$$
* **Pérdidas mecánicas de suspensión ($R_{ms}$ en kg/s):**
  $$R_{ms} = \frac{2\pi \cdot Fs \cdot Mms}{1000 \cdot Qms}$$
* **Impedancia en resonancia ($Z_{max}$ en $\Omega$):**
  $$Z_{max} = Re \cdot \left( 1 + \frac{Qms}{Qes} \right)$$
* **Compliancia auto-calculada ($Cms$ en mm/N):**
  $$Cms = 716.1 \cdot \frac{Vas}{Sd^2}$$
* **Masa móvil auto-calculada ($Mms$ en g):**
  $$Mms = \frac{25330}{Fs^2 \cdot Cms}$$
* **Motor auto-calculado ($BL$ en T-m):**
  $$BL = \sqrt{\frac{2\pi \cdot Fs \cdot (Mms/1000) \cdot Re}{Qes}}$$

---

## 🛠️ Instalación y Uso

AcousticSim es completamente portable y autónomo. **No requiere base de datos, servidores backend ni procesos de compilación**.

1. Descarga o clona el repositorio.
2. Abre el archivo **[boxcalculator.html](boxcalculator.html)** haciendo doble clic en él o arrastrándolo a cualquier navegador moderno (Chrome, Firefox, Safari, Edge).
3. Todas las librerías externas (**Chart.js** y **Google Fonts**) se cargan de forma transparente a través de CDNs públicas.

---

## 📐 Métodos de Ensamble y Fabricación Recomendados

* **Caja Rectangular:** Las piezas laterales encierran las tapas frontal y trasera, y las tapas superior e inferior sellan y cubren toda la estructura exterior. 
* **Caja Trapezoidal:** Los paneles laterales (trapecios) definen el ángulo de inclinación frontal. Las tapas superior e inferior se ensamblan entre los laterales, y el bafle frontal inclinado requiere cortes angulares específicos en sus cantos exteriores (definidos por la inclinación trigonométrica $H_{slant}$).
* **Sellado:** Se recomienda aplicar abundante cola de carpintero en todas las juntas internas, reforzando con cordones de silicona o masilla de poliuretano para garantizar que el recinto sea 100% hermético.

---

## 📝 Licencia

Este proyecto está bajo la licencia MIT. Eres libre de modificarlo, compartirlo y adaptarlo a tus necesidades de diseño de audio DIY o comercial.
