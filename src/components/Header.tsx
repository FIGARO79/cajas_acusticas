import React, { useState, useRef, useEffect } from 'react';
import { type Lang, translate } from '../utils/translations';
import { type UnitSystem } from '../utils/units';

interface HeaderProps {
  lang: Lang;
  setLang: (lang: Lang) => void;
  unitSystem: UnitSystem;
  setUnitSystem: (system: UnitSystem) => void;
  onExportReport?: () => void;
  workspaceView?: 'split' | 'simulation' | 'cabinet' | 'crossover';
  setWorkspaceView?: (view: 'split' | 'simulation' | 'cabinet' | 'crossover') => void;
  boxType?: 'sealed' | 'ported' | 'bandpass';
  setBoxType?: (type: 'sealed' | 'ported' | 'bandpass') => void;
  ventedAlignment?: 'QB3' | 'B4' | 'SBB4';
  setVentedAlignment?: (align: 'QB3' | 'B4' | 'SBB4') => void;
  crossoverWays?: number;
  setCrossoverWays?: (ways: number) => void;
  onSaveProject?: () => void;
  onLoadProject?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNewProject?: () => void;
  onOpenDriverDatabase?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  setLang,
  unitSystem,
  setUnitSystem,
  onExportReport,
  workspaceView = 'split',
  setWorkspaceView,
  boxType = 'sealed',
  setBoxType,
  ventedAlignment = 'QB3',
  setVentedAlignment,
  crossoverWays = 2,
  setCrossoverWays,
  onSaveProject,
  onLoadProject,
  onNewProject,
  onOpenDriverDatabase,
}) => {
  const t = (text: string) => translate(text, lang);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuClick = (menu: string) => {
    setOpenMenu(openMenu === menu ? null : menu);
  };

  const closeMenu = () => setOpenMenu(null);

  const handleOpenFileClick = () => {
    fileInputRef.current?.click();
    closeMenu();
  };

  const handleResetConfig = () => {
    if (window.confirm(t("¿Restablecer toda la configuración a los valores predeterminados?"))) {
      localStorage.removeItem('lang');
      localStorage.removeItem('unitSystem');
      window.location.reload();
    }
    closeMenu();
  };

  return (
    <header className="cad-desktop-header cad-single-bar">
      {/* Input oculto para carga de archivos .aclab */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={onLoadProject}
        accept=".aclab,.json"
        style={{ display: 'none' }}
      />

      {/* FILA 1: MENÚ DE OPCIONES ALINEADO A LA IZQUIERDA */}
      <div className="cad-bar-row">
        {/* 1. Menús desplegables estándar alineados a la izquierda */}
        <div className="cad-menubar-inline" ref={menuBarRef} role="menubar">
          {/* ARCHIVO */}
          <div className="cad-menu-item" role="none">
            <button
              className={`cad-menu-trigger ${openMenu === 'archivo' ? 'active' : ''}`}
              onClick={() => handleMenuClick('archivo')}
              onMouseEnter={() => openMenu && setOpenMenu('archivo')}
              type="button"
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={openMenu === 'archivo'}
            >
              {t("Archivo")}
            </button>
            {openMenu === 'archivo' && (
              <div className="cad-menu-dropdown" role="menu">
                <button className="cad-menu-option" onClick={() => { onNewProject?.(); closeMenu(); }} type="button" role="menuitem">
                  <span>{t("Nuevo Proyecto")}</span>
                  <span className="cad-menu-shortcut">Ctrl+N</span>
                </button>
                <button className="cad-menu-option" onClick={handleOpenFileClick} type="button" role="menuitem">
                  <span>{t("Abrir Proyecto (.aclab)...")}</span>
                  <span className="cad-menu-shortcut">Ctrl+O</span>
                </button>
                <button className="cad-menu-option" onClick={() => { onSaveProject?.(); closeMenu(); }} type="button" role="menuitem">
                  <span>{t("Guardar Proyecto (.aclab)")}</span>
                  <span className="cad-menu-shortcut">Ctrl+S</span>
                </button>
                <div className="cad-menu-separator" role="separator" />
                <button className="cad-menu-option" onClick={() => { onExportReport?.(); closeMenu(); }} type="button" role="menuitem">
                  <span>{t("Exportar Reporte Técnico (PDF)")}</span>
                  <span className="cad-menu-shortcut">Ctrl+P</span>
                </button>
                <div className="cad-menu-separator" role="separator" />
                <button
                  className="cad-menu-option"
                  onClick={() => {
                    alert(
                      'AcousticLAB 3.0 Engineering CAD Suite\n\n' +
                      'Simulador Electroacústico Thiele-Small, Redes de Cruce y Planos CAD de Fabricación.\n\n' +
                      '© 2026 Fabio / AcousticLAB'
                    );
                    closeMenu();
                  }}
                  type="button"
                  role="menuitem"
                >
                  <span>{t("Acerca de AcousticLAB")}</span>
                </button>
              </div>
            )}
          </div>

          {/* EDICIÓN */}
          <div className="cad-menu-item" role="none">
            <button
              className={`cad-menu-trigger ${openMenu === 'edicion' ? 'active' : ''}`}
              onClick={() => handleMenuClick('edicion')}
              onMouseEnter={() => openMenu && setOpenMenu('edicion')}
              type="button"
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={openMenu === 'edicion'}
            >
              {t("Edición")}
            </button>
            {openMenu === 'edicion' && (
              <div className="cad-menu-dropdown" role="menu">
                <button
                  className="cad-menu-option"
                  onClick={() => {
                    onOpenDriverDatabase?.();
                    closeMenu();
                  }}
                  type="button"
                  role="menuitem"
                >
                  <span>{t("Base de Datos de Altavoces...")}</span>
                </button>
                <div className="cad-menu-separator" role="separator" />
                <button
                  className="cad-menu-option"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert(t("Enlace del proyecto copiado al portapapeles."));
                    closeMenu();
                  }}
                  type="button"
                  role="menuitem"
                >
                  <span>{t("Copiar Enlace de Simulación")}</span>
                </button>
                <div className="cad-menu-separator" role="separator" />
                <button className="cad-menu-option" onClick={handleResetConfig} type="button" role="menuitem">
                  <span>{t("Restablecer Valores de Fábrica")}</span>
                </button>
              </div>
            )}
          </div>

          {/* VER */}
          <div className="cad-menu-item" role="none">
            <button
              className={`cad-menu-trigger ${openMenu === 'ver' ? 'active' : ''}`}
              onClick={() => handleMenuClick('ver')}
              onMouseEnter={() => openMenu && setOpenMenu('ver')}
              type="button"
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={openMenu === 'ver'}
            >
              {t("Ver")}
            </button>
            {openMenu === 'ver' && (
              <div className="cad-menu-dropdown" role="menu">
                <div className="cad-menu-section-label">{t("Vistas de Trabajo")}</div>
                <button
                  className={`cad-menu-option ${workspaceView === 'split' ? 'checked' : ''}`}
                  onClick={() => { setWorkspaceView?.('split'); closeMenu(); }}
                  type="button"
                  role="menuitem"
                >
                  {workspaceView === 'split' && <span className="cad-menu-check">✓</span>}
                  <span>{t("Estudio (Multi-Panel Completo)")}</span>
                </button>
                <button
                  className={`cad-menu-option ${workspaceView === 'simulation' ? 'checked' : ''}`}
                  onClick={() => { setWorkspaceView?.('simulation'); closeMenu(); }}
                  type="button"
                  role="menuitem"
                >
                  {workspaceView === 'simulation' && <span className="cad-menu-check">✓</span>}
                  <span>{t("Simulación Acústica Maximizado")}</span>
                </button>
                <button
                  className={`cad-menu-option ${workspaceView === 'cabinet' ? 'checked' : ''}`}
                  onClick={() => { setWorkspaceView?.('cabinet'); closeMenu(); }}
                  type="button"
                  role="menuitem"
                >
                  {workspaceView === 'cabinet' && <span className="cad-menu-check">✓</span>}
                  <span>{t("Gabinete 3D & Lista de Corte")}</span>
                </button>
                <button
                  className={`cad-menu-option ${workspaceView === 'crossover' ? 'checked' : ''}`}
                  onClick={() => { setWorkspaceView?.('crossover'); closeMenu(); }}
                  type="button"
                  role="menuitem"
                >
                  {workspaceView === 'crossover' && <span className="cad-menu-check">✓</span>}
                  <span>{t("Crossover CAD Circuital")}</span>
                </button>
              </div>
            )}
          </div>

          {/* ALINEACIÓN */}
          <div className="cad-menu-item" role="none">
            <button
              className={`cad-menu-trigger ${openMenu === 'alineacion' ? 'active' : ''}`}
              onClick={() => handleMenuClick('alineacion')}
              onMouseEnter={() => openMenu && setOpenMenu('alineacion')}
              type="button"
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={openMenu === 'alineacion'}
            >
              {t("Alineación")}
            </button>
            {openMenu === 'alineacion' && (
              <div className="cad-menu-dropdown" role="menu">
                <div className="cad-menu-section-label">{t("Cajas Cerradas / Selladas")}</div>
                <button
                  className={`cad-menu-option ${boxType === 'sealed' ? 'checked' : ''}`}
                  onClick={() => { setBoxType?.('sealed'); closeMenu(); }}
                  type="button"
                  role="menuitem"
                >
                  {boxType === 'sealed' && <span className="cad-menu-check">✓</span>}
                  <span>{t("Caja Sellada (Acoustic Suspension)")}</span>
                </button>

                <div className="cad-menu-separator" role="separator" />
                <div className="cad-menu-section-label">{t("Cajas Ventiladas (Bass-Reflex)")}</div>
                <button
                  className={`cad-menu-option ${boxType === 'ported' && ventedAlignment === 'QB3' ? 'checked' : ''}`}
                  onClick={() => {
                    setBoxType?.('ported');
                    setVentedAlignment?.('QB3');
                    closeMenu();
                  }}
                  type="button"
                  role="menuitem"
                >
                  {boxType === 'ported' && ventedAlignment === 'QB3' && <span className="cad-menu-check">✓</span>}
                  <span>{t("Ventilada QB3 (Quasi-Butterworth 3)")}</span>
                </button>
                <button
                  className={`cad-menu-option ${boxType === 'ported' && ventedAlignment === 'B4' ? 'checked' : ''}`}
                  onClick={() => {
                    setBoxType?.('ported');
                    setVentedAlignment?.('B4');
                    closeMenu();
                  }}
                  type="button"
                  role="menuitem"
                >
                  {boxType === 'ported' && ventedAlignment === 'B4' && <span className="cad-menu-check">✓</span>}
                  <span>{t("Ventilada B4 (Butterworth 4to Orden)")}</span>
                </button>
                <button
                  className={`cad-menu-option ${boxType === 'ported' && ventedAlignment === 'SBB4' ? 'checked' : ''}`}
                  onClick={() => {
                    setBoxType?.('ported');
                    setVentedAlignment?.('SBB4');
                    closeMenu();
                  }}
                  type="button"
                  role="menuitem"
                >
                  {boxType === 'ported' && ventedAlignment === 'SBB4' && <span className="cad-menu-check">✓</span>}
                  <span>{t("Ventilada SBB4 (Super Boom-Box 4)")}</span>
                </button>

                <div className="cad-menu-separator" role="separator" />
                <div className="cad-menu-section-label">{t("Paso de Banda (Bandpass)")}</div>
                <button
                  className={`cad-menu-option ${boxType === 'bandpass' ? 'checked' : ''}`}
                  onClick={() => { setBoxType?.('bandpass'); closeMenu(); }}
                  type="button"
                  role="menuitem"
                >
                  {boxType === 'bandpass' && <span className="cad-menu-check">✓</span>}
                  <span>{t("Paso Banda (4to / 6to Orden)")}</span>
                </button>
              </div>
            )}
          </div>

          {/* FILTROS */}
          <div className="cad-menu-item" role="none">
            <button
              className={`cad-menu-trigger ${openMenu === 'filtros' ? 'active' : ''}`}
              onClick={() => handleMenuClick('filtros')}
              onMouseEnter={() => openMenu && setOpenMenu('filtros')}
              type="button"
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={openMenu === 'filtros'}
            >
              {t("Filtros")}
            </button>
            {openMenu === 'filtros' && (
              <div className="cad-menu-dropdown" role="menu">
                <button
                  className={`cad-menu-option ${crossoverWays === 2 ? 'checked' : ''}`}
                  onClick={() => { setCrossoverWays?.(2); closeMenu(); }}
                  type="button"
                  role="menuitem"
                >
                  {crossoverWays === 2 && <span className="cad-menu-check">✓</span>}
                  <span>{t("Divisor de Frecuencia 2 Vías")}</span>
                </button>
                <button
                  className={`cad-menu-option ${crossoverWays === 3 ? 'checked' : ''}`}
                  onClick={() => { setCrossoverWays?.(3); closeMenu(); }}
                  type="button"
                  role="menuitem"
                >
                  {crossoverWays === 3 && <span className="cad-menu-check">✓</span>}
                  <span>{t("Divisor de Frecuencia 3 Vías")}</span>
                </button>
                <div className="cad-menu-separator" role="separator" />
                <button
                  className="cad-menu-option"
                  onClick={() => { setWorkspaceView?.('crossover'); closeMenu(); }}
                  type="button"
                  role="menuitem"
                >
                  <span>{t("Abrir CAD Esquemático")}</span>
                </button>
              </div>
            )}
          </div>

          {/* HERRAMIENTAS */}
          <div className="cad-menu-item" role="none">
            <button
              className={`cad-menu-trigger ${openMenu === 'herramientas' ? 'active' : ''}`}
              onClick={() => handleMenuClick('herramientas')}
              onMouseEnter={() => openMenu && setOpenMenu('herramientas')}
              type="button"
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={openMenu === 'herramientas'}
            >
              {t("Herramientas")}
            </button>
            {openMenu === 'herramientas' && (
              <div className="cad-menu-dropdown" role="menu">
                <div className="cad-menu-section-label">{t("Sistema de Unidades")}</div>
                <button
                  className={`cad-menu-option ${unitSystem === 'metric' ? 'checked' : ''}`}
                  onClick={() => { setUnitSystem('metric'); closeMenu(); }}
                  type="button"
                  role="menuitem"
                >
                  {unitSystem === 'metric' && <span className="cad-menu-check">✓</span>}
                  <span>{t("Métrico (cm, mm, Litros)")}</span>
                </button>
                <button
                  className={`cad-menu-option ${unitSystem === 'metric_mm' ? 'checked' : ''}`}
                  onClick={() => { setUnitSystem('metric_mm'); closeMenu(); }}
                  type="button"
                  role="menuitem"
                >
                  {unitSystem === 'metric_mm' && <span className="cad-menu-check">✓</span>}
                  <span>{t("Métrico (mm, Litros)")}</span>
                </button>
                <button
                  className={`cad-menu-option ${unitSystem === 'imperial' ? 'checked' : ''}`}
                  onClick={() => { setUnitSystem('imperial'); closeMenu(); }}
                  type="button"
                  role="menuitem"
                >
                  {unitSystem === 'imperial' && <span className="cad-menu-check">✓</span>}
                  <span>{t("Imperial (in, ft³)")}</span>
                </button>

                <div className="cad-menu-separator" role="separator" />
                <div className="cad-menu-section-label">{t("Idioma")}</div>
                <button
                  className={`cad-menu-option ${lang === 'es' ? 'checked' : ''}`}
                  onClick={() => { setLang('es'); closeMenu(); }}
                  type="button"
                  role="menuitem"
                >
                  {lang === 'es' && <span className="cad-menu-check">✓</span>}
                  <span>Español (ES)</span>
                </button>
                <button
                  className={`cad-menu-option ${lang === 'en' ? 'checked' : ''}`}
                  onClick={() => { setLang('en'); closeMenu(); }}
                  type="button"
                  role="menuitem"
                >
                  {lang === 'en' && <span className="cad-menu-check">✓</span>}
                  <span>English (EN)</span>
                </button>
                <button
                  className={`cad-menu-option ${lang === 'pt' ? 'checked' : ''}`}
                  onClick={() => { setLang('pt'); closeMenu(); }}
                  type="button"
                  role="menuitem"
                >
                  {lang === 'pt' && <span className="cad-menu-check">✓</span>}
                  <span>Português (PT)</span>
                </button>
              </div>
            )}
          </div>

          {/* AYUDA */}
          <div className="cad-menu-item" role="none">
            <button
              className={`cad-menu-trigger ${openMenu === 'ayuda' ? 'active' : ''}`}
              onClick={() => handleMenuClick('ayuda')}
              onMouseEnter={() => openMenu && setOpenMenu('ayuda')}
              type="button"
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={openMenu === 'ayuda'}
            >
              {t("Ayuda")}
            </button>
            {openMenu === 'ayuda' && (
              <div className="cad-menu-dropdown" role="menu">
                <button
                  className="cad-menu-option"
                  onClick={() => {
                    alert(
                      'Atajos de Teclado:\n\n' +
                      'Ctrl+S : Guardar Proyecto\n' +
                      'Ctrl+O : Abrir Proyecto\n' +
                      'Ctrl+P : Exportar Reporte PDF\n' +
                      'Ctrl+N : Nuevo Proyecto'
                    );
                    closeMenu();
                  }}
                  type="button"
                  role="menuitem"
                >
                  <span>{t("Atajos de Teclado")}</span>
                </button>
                <div className="cad-menu-separator" role="separator" />
                <button
                  className="cad-menu-option"
                  onClick={() => {
                    alert(
                      'Guía Rápida AcousticLAB:\n\n' +
                      '1. Selecciona o carga los parámetros Thiele-Small en la columna izquierda.\n' +
                      '2. Configura el tipo de caja y dimensiones en la columna central.\n' +
                      '3. Analiza las curvas SPL/Z y planos CAD 2D/3D a la derecha.\n' +
                      '4. Exporta el reporte técnico de ingeniería con el botón PDF.'
                    );
                    closeMenu();
                  }}
                  type="button"
                  role="menuitem"
                >
                  <span>{t("Guía de Usuario CAD")}</span>
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </header>
  );
};
