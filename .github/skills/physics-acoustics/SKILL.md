---
name: physics-acoustics
user-invocable: true
description: "Assist with mechanical physics, electromagnetics, and sound calculations to improve the acoustic speaker box application."
---

# Physics-Acoustics Skill

## Purpose

This skill helps the user enhance the existing speaker box calculator by adding and refining physics-based calculations in:
- mechanical dynamics
- electromagnetics / driver motor modeling
- acoustic sound performance

It is scoped to the current workspace and intended for project-specific improvements to `boxcalculator.html` and related simulation logic.

## Use When

Use this skill when the project needs:
- better physical accuracy for Thiele/Small and driver parameters
- sound pressure level (SPL), frequency response, or port tuning calculations
- mechanical motion, excursion, or force estimation
- electromagnetic motor, impedance, or efficiency modeling
- acoustic volume, resonance, or airflow validation

## Workflow

1. Review the current calculator implementation and simulation formulas in `boxcalculator.html`.
2. Identify the missing or approximate physics/electromagnetic/sound formula.
3. Propose a precise calculation or improved numeric method.
4. Implement the formula in JavaScript and wire it into the UI.
5. Validate with canonical Thiele/Small and acoustic engineering checks.

## Quality Criteria

- match known speaker design formulas and units
- keep calculations numerically stable
- preserve or improve the existing UI flow
- clearly label computed outputs for physics and acoustics
- avoid overfitting to one speaker type unless the user asked for it

## Example Prompts

- "Mejora los cálculos de SPL y velocidad de aire en el puerto de la aplicación."
- "Agrega un cálculo de BL, Cms y Mms cuando falten parámetros Thiele/Small."
- "Optimiza la respuesta en frecuencia para el modelo sellado y el reflex con una búsqueda numérica más precisa."
- "Evalúa si la caja trapezoidal tiene el volumen acústico neto correcto y ajusta el cálculo de dimensiones."
