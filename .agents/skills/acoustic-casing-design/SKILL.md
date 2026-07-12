---
name: acoustic-casing-design
description: Fórmulas, metodologías y estándares para el diseño de cajas acústicas profesionales, cálculos de Thiele-Small, crossovers y diagramas de corte.
---

# Guía de Diseño Acústico Profesional de Recintos (Cajas)

Esta habilidad asiste en el desarrollo y mejora de herramientas de simulación de cajas acústicas, filtros pasivos y diagramado de paneles.

## 1. Fórmulas y Modelos de Alineación

### Cajas Selladas (Sealed / Acoustic Suspension)
* **Relación de volumen ($alpha$ = Vas / Vb):**
  $$Qtc = Qts \cdot \sqrt{\alpha + 1}$$
* **Frecuencia de corte a -3dB ($f_3$):**
  $$f_3 = fs \cdot \frac{Qtc}{Qts} \cdot \sqrt{\frac{(1/Qtc^2 - 2) + \sqrt{(1/Qtc^2 - 2)^2 + 4}}{2}}$$
* **Resonancia del sistema ($fc$):**
  $$fc = fs \cdot \sqrt{\alpha + 1}$$

### Cajas Ventiladas (Bass-Reflex / Ported)
* **Cálculo de la frecuencia de sintonía óptima ($Fb$) y volumen ($Vb$) según alineaciones clásicas:**
  * **SBB4/Super Boom Box (Alineación con Qts bajo):**
    $$Vb = 11 \cdot V_{as} \cdot Q_{ts}^{2.87}$$
    $$Fb = 0.56 \cdot f_s / Q_{ts}^{0.9}$$
  * **QB3/Quasi-Butterworth (Qts medio-bajo):**
    $$Vb = 15 \cdot V_{as} \cdot Q_{ts}^{2.87}$$
    $$Fb = 0.42 \cdot f_s / Q_{ts}^{0.9}$$
  * **SC4/Sub-Chebyshev (Qts medio-alto):**
    $$Vb = 4 \cdot V_{as} \cdot Q_{ts}^2$$
    $$Fb = f_s \cdot \sqrt{V_{as} / Vb}$$

## 2. Volumen Neto vs. Volumen Bruto (Estructural)

Al calcular las dimensiones físicas externas de la caja, siempre se debe calcular primero el volumen bruto ($V_{bruto}$):
$$V_{bruto} = Vb + V_{driver} + V_{port} + V_{bracing}$$

* **$V_{driver}$ (Volumen desplazado por el parlante):** Generalmente de $0.5$ a $4.5$ litros según el diámetro (p. ej., 8" $\approx$ 1L, 10" $\approx$ 1.8L, 12" $\approx$ 3L, 15" $\approx$ 5.5L).
* **$V_{port}$ (Volumen físico del tubo de sintonía):**
  $$V_{port} = \pi \cdot \left(\frac{D_{externo}}{2}\right)^2 \cdot L$$
* **$V_{bracing}$ (Refuerzos de madera):** Suma del volumen de los listones de soporte internos.

## 3. Diagramas de Corte y Geometría de Paneles
Para calcular las piezas de corte de una caja rectangular con paneles solapados (asumiendo unión a tope):
* **Dimensiones Internas ($W_{in}, H_{in}, D_{in}$):**
  * Proporción áurea clásica (Golden Ratio) para minimizar ondas estacionarias internas: $1 : 1.618 : 0.618$ (Ancho, Alto, Profundidad).
* **Conversión a Externas (con espesor $T$ del material):**
  * $W_{ext} = W_{in} + 2T$
  * $H_{ext} = H_{in} + 2T$
  * $D_{ext} = D_{in} + 2T$
* **Desglose de piezas para corte:**
  * Paneles Lateral Izquierdo / Derecho (2x): $H_{ext} \times D_{ext}$ (o según el tipo de ensamblado).
  * Paneles Superior / Inferior (2x): $W_{in} \times D_{ext}$
  * Panel Frontal (Baffle) / Trasero (2x): $W_{in} \times H_{in}$

## 4. Filtros Crossover Pasivos (2 vías - 2nd Order Linkwitz-Riley de ejemplo)
* **Punto de cruce ($f_x$):**
  * Condensador (C): $C = \frac{1}{2\pi \cdot \sqrt{2} \cdot R \cdot f_x}$
  * Inductor (L): $L = \frac{\sqrt{2} \cdot R}{2\pi \cdot f_x}$

## 5. Visualizaciones y Diagramas Técnicos en la Interfaz (UI)

Los diagramas generados en la aplicación deben imitar el estilo de un plano de ingeniería acústica profesional, caracterizado por:

### Estructura de Vistas (Ortogonales)
1. **Vista Frontal**:
   - Muestra el contorno externo de la caja.
   - Posicionamiento exacto de cada altavoz (woofer, mid, tweeter) con sus diámetros reales de montaje y rebajes (baffles).
   - Indicación visual de chaflanes (chamfers/bevels) con anotaciones angulares (p. ej., "20°", "40° to 15 mm depth").
   - Cotas superiores e izquierdas de ancho y altura de altavoces.

2. **Vista Lateral en Corte (Cross-Section)**:
   - Representación del espesor del material (grosor de los paneles como MDF de 19mm - 22mm) usando sombreados o bordes oscuros definidos.
   - División de cámaras acústicas independientes (sub-recintos sellados para medios/tweeters y cámaras sintonizadas para woofers).
   - Dibujo a escala de los componentes internos:
     - **Altavoces**: Silueta trasera simplificada que muestre la profundidad del imán y la canasta.
     - **Tubo de Sintonía (Port)**: Perfil cilíndrico en corte con su respectiva campana de entrada/salida (flared port) y cotas de diámetro/longitud (p. ej., "Ø68 x 70 mm").
     - **Refuerzos (Bracing)**: Elementos estructurales horizontales y verticales en corte, con enlaces de referencia a su desglose.
     - **Crossovers / Filtros**: Ubicación física esquemática ("bass x-over", "mid-tweeter x-over").
     - **Terminales**: Copas de conexión en la pared trasera.

3. **Vistas de Desglose de Refuerzos (Braces)**:
   - Planos secundarios 2D que muestren las plantillas de perforación de los refuerzos internos para permitir el paso de aire sin comprometer la rigidez mecánica (p. ej., circles de paso "Ø145", "Ø80").

### Estilo de Cotas y Acotaciones (Dimensioning)
- **Líneas de Cota**: Delgadas, de color gris oscuro o negro con puntas de flecha limpias.
- **Líneas de Extensión**: Líneas guías delgadas que parten desde las caras o centros geométricos hacia afuera del dibujo para evitar colisiones visuales.
- **Valores numéricos**: Texto limpio en milímetros sobre la línea de cota (p. ej., "220", "280", "1100").
- **Tipografía**: Monoespaciada o de ingeniería sin serifa para máxima legibilidad técnica.
- **Escala Dinámica**: Ajustar dinámicamente el ancho y alto del contenedor SVG para que todo el plano de despiece y corte quepa perfectamente con márgenes uniformes.
