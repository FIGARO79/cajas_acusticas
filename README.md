# AcousticLAB - Calculadora de Cajas Acústicas Premium

[![CI Status](https://img.shields.io/github/actions/workflow/status/FIGARO79/cajas_acusticas/ci.yml?branch=main)](https://github.com/FIGARO79/cajas_acusticas/actions)
[![License](https://img.shields.io/github/license/FIGARO79/cajas_acusticas)](LICENSE)

AcousticLAB es una aplicación web interactiva premium diseñada para ingenieros de audio, entusiastas del DIY y diseñadores de altavoces. Permite simular y calcular de manera profesional cajas acústicas y divisores de frecuencia en tiempo real.

El corazón matemático de la aplicación está escrito en **Rust** y compilado a **WebAssembly**, lo que garantiza un rendimiento ultrarrápido y simulaciones complejas en tiempo real directamente en el navegador del usuario. El frontend está desarrollado con **React 19**, **TypeScript** y **Vite**, ofreciendo una interfaz de usuario interactiva, fluida y con un diseño oscuro premium.

## 🛠️ Stack Tecnológico

AcousticLAB combina tecnologías modernas tanto para el desarrollo del cliente como para el motor de cálculo:

### Frontend
- **React 19:** Biblioteca principal para la interfaz de usuario reactiva.
- **TypeScript:** Tipado estático para garantizar la robustez del código.
- **Vite:** Empaquetador y entorno de desarrollo de alta velocidad.
- **Chart.js & React-Chartjs-2:** Biblioteca gráfica para la visualización en tiempo real de las curvas de respuesta en frecuencia.
- **CSS3 Personalizado (Vanilla CSS):** Estilos fluidos, diseño oscuro premium, efectos de *glassmorphism* y micro-animaciones responsivas.

### Core de Cálculo (Backend / WASM)
- **Rust (Edición 2024):** Motor de cálculo de alto rendimiento enfocado en la precisión matemática y la seguridad de memoria.
- **WebAssembly (`wasm-bindgen`):** Compilación del código Rust a binario web para su ejecución nativa en el navegador, minimizando la latencia de cómputo en simulaciones de curvas complejas.

---

## ✨ Características y Funcionalidades

### 1. Simulación y Diseño de Cajas Acústicas
- **Caja Sellada (Sealed):** Cálculo automático del volumen óptimo, factor de calidad total ($Q_{tc}$), frecuencia de resonancia de la caja ($F_c$), y punto de atenuación a -3dB ($F_3$).
- **Caja Bass-Reflex / Ventilada (Ported):** Alineaciones clásicas sugeridas ($QB_3$, $B_4$, $SBB_4$). Cálculo preciso de la longitud y dimensiones del conducto de sintonía para puertos circulares y rectangulares.
- **Cajas de Paso Banda (Bandpass):** Fórmulas integradas para el diseño y simulación de cajas paso banda de 4.º y 6.º orden.
- **Simulación de Radiadores Pasivos:** Simulación y cálculo completo para cajas con radiador pasivo y masa añadida para sintonización sin puerto físico.
- **Configuración Multitransductor:** Soporte para simulaciones con configuraciones en Serie, Paralelo, e Isobárico / Isobárico Compuesto (Push-Pull), con auto-cálculo de parámetros T/S equivalentes.

### 2. Motor de Auto-cálculo y Estimación de Parámetros T/S
- Estimación en tiempo real de parámetros avanzados a partir de los datos básicos:
  - Compliancia mecánica ($C_{ms}$), masa móvil del diafragma ($M_{ms}$), e inducción magnética ($BL$).
  - Volumen de desplazamiento máximo del cono ($V_d$), eficiencia de referencia ($\eta_0$), factor de eficiencia EBP (para selección de caja), resistencia mecánica ($R_{ms}$), impedancia máxima ($Z_{max}$) y niveles de presión sonora ($SPL$ y $SPL_{max}$).

### 3. Diseño de Divisores de Frecuencia (Crossovers) y Filtros
- **Filtros de 1.º y 2.º Orden:** Cálculo de componentes para topologías Butterworth y Linkwitz-Riley de 2.º orden.
- **Red de Compensación Zobel:** Cálculo de resistencia y capacitancia para compensar el aumento de la impedancia del altavoz a altas frecuencias causado por la inductancia de la bobina de voz.
- **Atenuadores Resistivos L-Pad:** Cálculo de resistencias serie y paralelo para atenuar la sensibilidad de transductores (ej. tweeters) manteniendo constante la impedancia de carga.
- **Cálculo de Inductores:** Fórmula de Wheeler integrada para calcular las espiras y dimensiones de inductores de núcleo de aire.

### 4. Dimensionamiento del Mueble y Cubicaciones (Woodworking)
- Formas de cajas rectangulares y trapezoidales.
- Cálculo de volumen neto versus bruto teniendo en cuenta el grosor de las paredes de madera, volumen desplazado por el altavoz y conductos.
- Optimización automática de dimensiones basada en proporciones ideales (Proporción Áurea, Proporción Clásica, Cúbica) o fijando medidas personalizadas con bloqueos dinámicos.
- Despiece de paneles listo para el taller con dimensiones exactas para cada pieza.

### 5. Características Adicionales
- **Internacionalización (i18n):** Soporte multilingüe completo (Español e Inglés).
- **Reportes Técnicos Interactivos:** Generación y exportación de informes técnicos completos en formato PDF o datos en formato JSON para el guardado y carga de proyectos de simulación.

---

## 🚀 Instalación Rápida

Sigue estos pasos para compilar y ejecutar el proyecto localmente:

### Requisitos Previos
- **Node.js** (versión 18 o superior) y **npm**.
- (Opcional para desarrollo del backend) **Rust** (con soporte `wasm32-unknown-unknown` e instalada la herramienta `wasm-pack`).

### Pasos
```bash
# 1. Clonar el repositorio
git clone https://github.com/FIGARO79/cajas_acusticas.git
cd cajas_acusticas

# 2. Instalar dependencias del frontend
npm ci

# 3. Compilar el Backend en Rust (si modificas código Rust)
# (Si ya tienes el build wasm compilado en src/wasm/pkg/, puedes saltar este paso)
cd backend
wasm-pack build --target web --out-dir ../src/wasm/pkg
cd ..

# 4. Ejecutar la aplicación en modo desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.

---

## 📦 Estructura del Proyecto

El repositorio está organizado de la siguiente manera:

- `backend/`: Código fuente de Rust compilado a WebAssembly.
  - `backend/src/cajas.rs`: Funciones matemáticas de volumen y alineación de cajas.
  - `backend/src/divisores.rs`: Cálculos de filtros crossover, redes Zobel y L-Pad.
  - `backend/src/curves.rs`: Generación de curvas de respuesta en frecuencia.
  - `backend/src/isobaric.rs`: Parámetros equivalentes para drivers en serie/paralelo/isobárico.
  - `backend/src/auto_params.rs`: Estimación y autocompletado de parámetros T/S.
- `src/`: Interfaz de usuario en React y TypeScript.
  - `src/components/`: Componentes UI modulares (fórmulas de parámetros, pestañas de cálculo de caja, diseño de mueble y despiece de madera, cruce de frecuencias, gráfico interactivo).
  - `src/wasm/`: Inicialización y adaptadores de llamadas a WebAssembly.
  - `src/utils/`: Generador de reportes en PDF, traducciones multilingües y constantes acústicas.

---

## 📚 Fórmulas y Referencia Teórica

Si deseas explorar la teoría detrás de los cálculos acústicos implementados, puedes consultar los documentos internos:
- [Fórmulas de Cálculo de Cajas Acústicas](formulas_calculo_cajas.md)
- [Fórmulas de Divisores de Frecuencia y Filtros](formulas_divisores.md)
- [Crossovers e Inductores Wheeler](Crossovers.docx.md)

---

## 🛠️ Contribuir

1. Forkea el proyecto.
2. Crea una rama `feature/nueva-funcionalidad`.
3. Envía un Pull Request describiendo detalladamente los cambios.

## 📄 Licencia

Distribuido bajo la licencia MIT. Ver el archivo [LICENSE](LICENSE) para más información.

---

_Desarrollado con ❤️ por **Fabio** y la comunidad open‑source._
