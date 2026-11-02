# AcousticLAB - Calculadora y Simulador de Cajas Acústicas Premium

[![CI Status](https://img.shields.io/github/actions/workflow/status/FIGARO79/cajas_acusticas/ci.yml?branch=main)](https://github.com/FIGARO79/cajas_acusticas/actions)
[![License](https://img.shields.io/github/license/FIGARO79/cajas_acusticas)](LICENSE)

AcousticLAB es una plataforma web interactiva de ingeniería electroacústica diseñada para ingenieros de audio, diseñadores de altavoces y entusiastas del DIY. Permite modelar, simular y diseñar sistemas de cajas acústicas, puertos bass-reflex, divisores de frecuencia (crossovers pasivos), cubicaciones de carpintería (CAD 2D) y visualización tridimensional en tiempo real.

El **100% del motor de cálculo matemático y simulación física está escrito en Rust** y compilado a **WebAssembly (WASM)**, logrando tiempos de ejecución instantáneos directamente en el navegador sin intermediación de servidores ni sobrecargas en JavaScript. El frontend está construido con **React 19**, **TypeScript**, **Three.js** y **Vite**, ofreciendo una interfaz fluida, responsiva y con estética oscura profesional.

---

## 🛠️ Stack Tecnológico

### Frontend & Visualización
- **React 19:** Arquitectura moderna de componentes reactivos.
- **TypeScript:** Tipado estático y desacoplamiento estricto de la lógica matemática.
- **Three.js:** Motor 3D acelerado por WebGL para la renderización interactiva del bafle, transductores y conductos.
- **Chart.js & React-Chartjs-2:** Representación de curvas acústicas logarítmicas de alta precisión.
- **Vite:** Entorno de compilación ultra-rápido con soporte nativo para ES modules y WebAssembly.
- **CSS3 Personalizado (Vanilla):** Efectos de *glassmorphism*, microinteracciones y diseño responsivo sin dependencias pesadas de UI.

### Core Matemático y Físico (Backend / WASM)
- **Rust (Edición 2024):** Motor nativo de alta fidelidad numérica y concurrencia segura.
- **WebAssembly (`wasm-bindgen` & `serde-wasm-bindgen`):** Ejecución nativa en el cliente a velocidad de código compilado.
- **Cero Lógica Matemática en JS:** TypeScript actúa exclusivamente como puente de comunicación y capa de renderizado; todas las fórmulas, iteraciones numéricas y modelos electroacústicos residen en Rust.

---

## ✨ Características Principales

### 1. Simulación y Alineación de Cajas Acústicas
- **Caja Sellada (Sealed / Acoustic Suspension):** Cálculo de volumen óptimo, factor de calidad total del sistema ($Q_{tc}$), frecuencia de resonancia en caja ($F_c$), punto de corte a -3 dB ($F_3$) y respuesta en frecuencia normalizada.
- **Caja Bass-Reflex / Ventilada (Ported):** Alineaciones clásicas automatizadas ($QB_3$, $B_4$ Hi-Fi, $SBB_4$ Subgraves). Cálculo de sintonía ($F_b$), pérdidas por absorción ($Q_L = 7.0$) y punto de corte a -3 dB mediante bisección numérica de alta precisión en Rust.
- **Cajas Paso Banda (Bandpass):**
  - **4.º Orden:** Cámara trasera sellada y delantera ventilada con sintonía $F_b$, frecuencia central $F_0$ y ancho de banda $\Delta F$.
  - **6.º Orden (Paralelo):** Doble cámara sintonizada con frecuencias de sintonía baja ($F_L$) y alta ($F_H$).
- **Radiador Pasivo (Drone Cone):** Modelado electroacústico de masa añadida, compliancia acústica ($C_{ab}, C_{ap}$) y sintonización $F_b$ sin conductos físicos.
- **Configuraciones Multitransductor e Isobáricas:** Modelado en Serie, Paralelo, e Isobárico Compuesto (Push-Pull, Cara a Cara o Tándem), calculando los parámetros Thiele-Small equivalentes ($F_{s,eq}, V_{as,eq}, Q_{ts,eq}$).

### 2. Dimensionamiento Aerodinámico de Puertos Réflex (Anti-Chuffing)
- **Criterio de Tolerancia de Área ($S_v / S_d$):** El algoritmo descarta puertos angostos y exige una sección de paso de al menos el **$14\% - 19\%$ del área del cono ($S_d$)** para altavoces de 10" o superiores ($S_d \ge 280\text{ cm}^2$), manteniendo velocidades ultra-silenciosas ($< 6.5\text{ m/s}$) incluso en subgraves profundos.
- **Corrección de Extremos Abocinados (Flared Ends):** Factores de corrección de longitud acústica según la geometría del conducto ($k = 0.732$ a $0.968$).
- **Sugerencias Automáticas Enriquecidas:** Evalúa en tiempo real 1 y 2 puertos sobre medidas comerciales estándar (Ø 4.5, 5.0, 6.0, 7.5, 8.5, 10.0, 12.5, 15.0 cm), informando la velocidad de aire resultante ($v_{peak}$), el ratio de área $(\% S_d)$ y alertando si la longitud excede la profundidad interna del mueble.
- **Botón $F_b$ Óptima Dinámico:** Acoplado a la alineación activa (B4: plana a $F_s$, QB3: máxima potencia, SBB4: extensión de subgraves).

### 3. Suite Gráfica de Simulación Electroacústica (Modo Vectorial en Rust)
Todas las curvas se calculan en Rust en un único pase vectorial (`calc_*_curve`), eliminando la latencia de llamadas punto a punto:
- **Respuesta en Frecuencia (SPL / Magnitud en dB):** Curvas de 10 Hz a 500 Hz y modo de Rango Completo (Full-Range, 10 Hz a 20.000 Hz).
- **Excursión del Cono ($X_{max}$ en mm):** Modelo electroacústico de Small-Margolis dependiente de la potencia aplicada ($W$), $B\cdot l$, $M_{ms}$, $C_{ms}$ y $R_e$, con línea de advertencia del límite lineal del driver.
- **Velocidad del Aire en el Puerto ($v_{peak}$ en m/s):** Flujo volumétrico acústico $U_{port}$ dependiente de la potencia, con umbrales normativos de velocidad audiófila ($17\text{ m/s}$) y límite crítico de turbulencia ($34\text{ m/s}$).
- **Impedancia Compleja del Sistema ($Z_{sys}$ en $\Omega$):** Curva completa con doble pico en cajas réflex (resonancia de caja y driver) modelando componentes resistivas, reactivas inductivas ($\omega L_e$) y motionales.
- **Modelo Extendido de Impedancia y *Suspension Creep* (Thorborg/Futtrup & Knudsen):** Cálculo de semi-inductancia ($K_e, L_{eb}, R_{ss}$) para pérdidas en el entrehierro de la bobina móvil y factor de arrastre viscoelástico logarítmico ($\beta$) de la suspensión mecánica a muy baja frecuencia.
- **Respuesta de Fase Acústica ($\phi$ en grados):** Comportamiento de fase de 2.º y 4.º orden.
- **Retardo de Grupo (Group Delay, $\tau_g$ en ms):** Derivación numérica $\tau_g = -\frac{1}{360}\frac{\Delta\phi}{\Delta f}\times 1000$ con desenrollado angular de fase ($\pm 180^\circ$) ejecutada directamente en Rust.

### 4. Divisores de Frecuencia Pasivos (Crossovers), Solver MNA y Optimizador
- **Topologías de 1.º a 4.º Orden:** Cálculo de capacitores e inductores para filtros paso-bajo, paso-alto y paso-banda (1st Order, Butterworth 2nd Order, Linkwitz-Riley 2nd y 4th Order).
- **Solver Matricial MNA (Modified Nodal Analysis):** Resolución por eliminación Gaussiana compleja con pivoteo parcial de matrices de admitancia $\mathbf{Y}(\omega) \cdot \mathbf{V}(\omega) = \mathbf{I}$, permitiendo simular filtros pasivos acoplados a la impedancia reactiva real del transductor.
- **Optimizador Nelder-Mead Simplex en Rust:** Ajuste numérico multidimensional automatizado de inductores ($L$) y capacitores ($C$) contra curvas acústicas objetivo (ej. Butterworth o Linkwitz-Riley) en menos de 1 milisegundo.
- **Curva de Atenuación de Filtros (`calc_filter_gain`):** Simulación combinada de la respuesta acústica del altavoz con la pendiente del filtro crossover.
- **Red de Compensación Zobel:** Cálculo de $R_z$ y $C_z$ para neutralizar el ascenso inductivo de la bobina ($L_e$) del woofer a altas frecuencias.
- **Atenuadores Resistivos L-Pad:** Cálculo de $R_1$ y $R_2$ para igualar sensibilidades en dB manteniendo la impedancia nominal constante.
- **Devanador de Inductores Wheeler:** Cálculo de inductancia a partir de dimensiones físicas y cálculo inverso de número de espiras requeridas para bobinas de núcleo de aire.

### 5. Efecto Baffle Step y Difracción de Bordes (3D Acoustics)
- **Transición de Radiación $4\pi \to 2\pi$:** Predicción exacta de la pérdida de $-6\text{ dB}$ en graves (*baffle step*) según el ancho y alto real del frontal del gabinete ($W \times H$).
- **Ondulaciones por Difracción de Aristas:** Cálculo integral de las ondas secundarias difractadas en los cuatro bordes del bafle considerando la posición tridimensional del transductor (centrado o descentrado), reflejando la respuesta acústica real en sala.

### 6. Carpintería, Despiece y CAD 2D/3D (Woodworking)
- **Modelado 3D Interactivo:** Visualización con Three.js del recinto acústico con controles de órbita, corte de sección, visualización de volumen neto vs. bruto y ubicación del driver y puerto.
- **Planos CAD 2D:** Cotas milimétricas del bafle frontal y despiece optimizado de piezas de madera (MDF / Multilaminado) considerando el espesor del material.
- **Proporciones Áureas y Clásicas:** Sugerencia automática de dimensiones exteriores e interiores para minimizar ondas estacionarias internas.

### 6. Gestión de Proyectos y Exportación
- **Exportación Técnica en PDF:** Generación de informes profesionales con parámetros T/S, dimensiones de corte, especificaciones de puertos y gráficos de respuesta.
- **Persistencia en JSON:** Guardado y carga local de proyectos completos.
- **Soporte Bilingüe Completo (i18n):** Interfaz totalmente traducida a Español e Inglés.

---

## 🚀 Instalación y Ejecución Local

### Requisitos Previos
- **Node.js** (v18 o superior) y **npm**.
- **Rust toolchain** (con target `wasm32-unknown-unknown`).
- **wasm-pack** (`cargo install wasm-pack`).

### Pasos de Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/FIGARO79/cajas_acusticas.git
cd cajas_acusticas

# 2. Instalar dependencias del frontend
npm install

# 3. Compilar el backend en Rust a WebAssembly
cd backend
wasm-pack build --target web --out-dir ../src/wasm/pkg
cd ..

# 4. Iniciar el servidor de desarrollo
npm run dev
```

La aplicación iniciará en `http://localhost:5173`.

### Verificación y Calidad de Código
```bash
# Verificar y analizar código Rust (0 warnings / 0 errors)
cd backend
cargo clippy
cargo test
cd ..

# Compilación de producción y typecheck de TypeScript
npm run build
```

---

## 📂 Arquitectura del Repositorio

```text
cajas_acusticas/
├── backend/                         # Motor electroacústico nativo en Rust
│   ├── Cargo.toml                   # Dependencias (wasm-bindgen, js-sys, serde)
│   └── src/
│       ├── lib.rs                   # Re-exportación y configuración FFI
│       ├── auto_params.rs           # Cálculo de parámetros Thiele-Small derivados
│       ├── cajas.rs                 # Alineaciones (Sealed, Vented, Bandpass, Puertos)
│       ├── curves.rs                # Generador vectorial de curvas (SPL, Excursión, Z, Fase, Retardo)
│       ├── divisores.rs             # Crossovers (1.º-4.º orden, Zobel, L-Pad, Wheeler)
│       ├── isobaric.rs              # Modelado de cargas isobáricas
│       └── radiador.rs              # Modelado de radiador pasivo
├── src/                             # Aplicación Web React 19 + TypeScript
│   ├── components/                  # Componentes visuales y de interacción
│   │   ├── BoxParamsForm.tsx        # Controles de caja, sintonía Fb y sugerencia de puertos
│   │   ├── SpeakerParamsForm.tsx    # Parámetros del altavoz y estimador T/S
│   │   ├── SimulationChart.tsx      # Renderizador de curvas con Chart.js
│   │   ├── CrossoverTab.tsx         # Calculadora de filtros y redes pasivas
│   │   ├── CabinetVisualizer3D.tsx  # Visor 3D con Three.js
│   │   └── CrossoverCad2D.tsx       # Esquemas y planos técnicos 2D
│   ├── utils/
│   │   ├── acousticMath.ts          # Adaptador TypeScript -> Rust WASM
│   │   ├── translations.ts          # Diccionario multilingüe (ES / EN)
│   │   └── reportGenerator.ts       # Generación de informes técnicos en PDF
│   ├── wasm/                        # Módulo puente de inicialización WebAssembly
│   │   ├── index.ts                 # Envoltorios tipados asíncronos
│   │   └── pkg/                     # Binarios generados por wasm-pack (.wasm, .d.ts, .js)
│   ├── App.tsx                      # Orquestador del estado global
│   └── main.tsx                     # Inicialización de React y precarga de WASM
├── package.json                     # Configuración del frontend y scripts npm
└── vite.config.ts                   # Configuración del empaquetador Vite
```

---

## 📖 Documentación Teórica Adicional

Para profundizar en las ecuaciones físicas implementadas en el código:
- [Fórmulas de Cálculo de Cajas Acústicas](formulas_calculo_cajas.md)
- [Fórmulas de Divisores de Frecuencia y Filtros](formulas_divisores.md)
- [Crossovers e Inductores Wheeler](Crossovers.docx.md)

---

## 📄 Licencia

Distribuido bajo la Licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.

---

_Desarrollado con pasión para la comunidad de ingeniería de audio y diseño electroacústico._
