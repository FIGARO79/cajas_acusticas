# AcousticLAB - Calculadora de Cajas Acústicas Premium

[![CI Status](https://img.shields.io/github/actions/workflow/status/FIGARO79/cajas_acusticas/ci.yml?branch=main)](https://github.com/FIGARO79/cajas_acusticas/actions)
[![License](https://img.shields.io/github/license/FIGARO79/cajas_acusticas)](LICENSE)

AcousticLAB es una aplicación web interactiva que permite diseñar y simular cajas acústicas para altavoces, ofreciendo cálculos precisos de volúmenes, frecuencias de resonancia y respuesta en frecuencia. La herramienta está construida con **React**, **TypeScript** y **Vite**, y utiliza WebAssembly, compilado a partir de **Rust**, para procesos intensivos de cálculo, garantizando una experiencia fluida y responsiva.

## ✨ Características

- **Cálculo automático** de dimensiones óptimas usando fórmulas avanzadas.
- Visualización de la respuesta en frecuencia mediante gráficos interactivos.
- Soporte para diferentes tipos de cajas: sellada, bass‑reflex y transmisión.
- Interfaz moderna con diseño oscuro, efectos suaves y animaciones micro‑interactivas.
- Exportación de resultados a PDF/JSON para documentación y fabricación.

## 🚀 Instalación rápida

```bash
# Clonar el repositorio
git clone https://github.com/FIGARO79/cajas_acusticas.git
cd cajas_acusticas

# Instalar dependencias
npm ci

# Ejecutar en modo desarrollo
npm run dev
```

Accede a `http://localhost:5173` en tu navegador.

## 📦 Uso

1. Selecciona el tipo de caja y el modelo de altavoz.
2. Introduce parámetros como Fs, Qts, Vas y Sd.
3. Pulsa **Calcular** y visualiza los resultados en la tabla y el gráfico.
4. Ajusta los parámetros y observa los cambios en tiempo real.

## 📚 Documentación

- [Guía de usuario](https://github.com/FIGARO79/cajas_acusticas/wiki)
- [API interna](https://github.com/FIGARO79/cajas_acusticas/blob/main/src/README_API.md)

## 🛠️ Contribuir

1. Forkea el proyecto.
2. Crea una rama `feature/nueva-funcionalidad`.
3. Envía un Pull Request describiendo los cambios.

## 📄 Licencia

Distribuido bajo la licencia MIT. Ver el archivo [LICENSE](LICENSE) para más información.

---

_Desarrollado con ❤️ por **Fabio** y la comunidad open‑source._
