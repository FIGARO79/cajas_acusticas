import React, { useState, useRef, useEffect } from 'react';
import { type Lang, translate } from '../utils/translations';
import { type UnitSystem } from '../utils/units';

interface HeaderProps {
  lang: Lang;
  setLang: (l: Lang) => void;
  unitSystem: UnitSystem;
  setUnitSystem: (u: UnitSystem) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  onExportReport?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  setLang,
  unitSystem,
  setUnitSystem,
  theme,
  toggleTheme,
  onExportReport,
}) => {
  const t = (text: string) => translate(text, lang);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
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
    setOpenMenu(prev => (prev === menu ? null : menu));
  };

  const closeMenu = () => setOpenMenu(null);

  const handleResetConfig = () => {
    if (window.confirm(t("¿Restablecer toda la configuración a los valores predeterminados?"))) {
      localStorage.removeItem('lang');
      localStorage.removeItem('unitSystem');
      localStorage.removeItem('theme');
      window.location.reload();
    }
    closeMenu();
  };

  return (
    <div className="top-navbar">
      <div className="logo-area-nav">
        <h1>Acoustic<span className="logo-highlight">LAB</span></h1>
      </div>

      {/* Menu bar */}
      <div className="desktop-menu-bar" ref={menuBarRef} role="menubar">

        {/* ARCHIVO */}
        <div className="desktop-menu-item" role="none">
          <button
            className={`desktop-menu-trigger ${openMenu === 'archivo' ? 'active' : ''}`}
            onClick={() => handleMenuClick('archivo')}
            onMouseEnter={() => openMenu && setOpenMenu('archivo')}
            type="button"
            role="menuitem"
            aria-haspopup="true"
            aria-expanded={openMenu === 'archivo'}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeMenu();
            }}
          >
            {t("Archivo")}
          </button>
          {openMenu === 'archivo' && (
            <div className="desktop-menu-dropdown" role="menu" aria-label={t("Archivo")}>
              <button
                className="desktop-menu-option"
                onClick={() => { onExportReport?.(); closeMenu(); }}
                type="button"
                role="menuitem"
                onKeyDown={(e) => { if (e.key === 'Escape') closeMenu(); }}
              >
                {t("Exportar Reporte")}
              </button>
              <div className="desktop-menu-separator" role="separator" />
              <button
                className="desktop-menu-option"
                onClick={() => {
                  alert('AcousticLAB v1.0\n\nSimulador de cajas acústicas\nThiele/Small en tiempo real.\n\n© 2025 Fabio');
                  closeMenu();
                }}
                type="button"
                role="menuitem"
                onKeyDown={(e) => { if (e.key === 'Escape') closeMenu(); }}
              >
                {t("Acerca de AcousticLAB")}
              </button>
            </div>
          )}
        </div>

        {/* VENTANA */}
        <div className="desktop-menu-item" role="none">
          <button
            className={`desktop-menu-trigger ${openMenu === 'ventana' ? 'active' : ''}`}
            onClick={() => handleMenuClick('ventana')}
            onMouseEnter={() => openMenu && setOpenMenu('ventana')}
            type="button"
            role="menuitem"
            aria-haspopup="true"
            aria-expanded={openMenu === 'ventana'}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeMenu();
            }}
          >
            {t("Ventana")}
          </button>
          {openMenu === 'ventana' && (
            <div className="desktop-menu-dropdown" role="menu" aria-label={t("Ventana")}>
              <div className="desktop-menu-label" role="presentation">{t("Tema")}</div>
              <button
                className={`desktop-menu-option ${theme === 'dark' ? 'checked' : ''}`}
                onClick={() => { if (theme !== 'dark') toggleTheme(); closeMenu(); }}
                type="button"
                role="menuitemcheckbox"
                aria-checked={theme === 'dark'}
                onKeyDown={(e) => { if (e.key === 'Escape') closeMenu(); }}
              >
                {theme === 'dark' && <span className="menu-check" aria-hidden="true">✓</span>}
                {t("Modo Oscuro")}
              </button>
              <button
                className={`desktop-menu-option ${theme === 'light' ? 'checked' : ''}`}

                onClick={() => { if (theme !== 'light') toggleTheme(); closeMenu(); }}
                type="button"
              >
                {theme === 'light' && <span className="menu-check">✓</span>}
                {t("Modo Claro")}
              </button>
              <div className="desktop-menu-separator" />
              <div className="desktop-menu-label">{t("Idioma")}</div>
              <button
                className={`desktop-menu-option ${lang === 'es' ? 'checked' : ''}`}
                onClick={() => { setLang('es'); closeMenu(); }}
                type="button"
              >
                {lang === 'es' && <span className="menu-check">✓</span>}
                Español
              </button>
              <button
                className={`desktop-menu-option ${lang === 'en' ? 'checked' : ''}`}
                onClick={() => { setLang('en'); closeMenu(); }}
                type="button"
              >
                {lang === 'en' && <span className="menu-check">✓</span>}
                English
              </button>
              <button
                className={`desktop-menu-option ${lang === 'pt' ? 'checked' : ''}`}
                onClick={() => { setLang('pt'); closeMenu(); }}
                type="button"
              >
                {lang === 'pt' && <span className="menu-check">✓</span>}
                Português
              </button>
            </div>
          )}
        </div>

        {/* OPCIONES */}
        <div className="desktop-menu-item">
          <button
            className={`desktop-menu-trigger ${openMenu === 'opciones' ? 'active' : ''}`}
            onClick={() => handleMenuClick('opciones')}
            onMouseEnter={() => openMenu && setOpenMenu('opciones')}
            type="button"
          >
            {t("Opciones")}
          </button>
          {openMenu === 'opciones' && (
            <div className="desktop-menu-dropdown">
              <div className="desktop-menu-label">{t("Sistema de Unidades")}</div>
              <button
                className={`desktop-menu-option ${unitSystem === 'metric' ? 'checked' : ''}`}
                onClick={() => { setUnitSystem('metric'); closeMenu(); }}
                type="button"
              >
                {unitSystem === 'metric' && <span className="menu-check">✓</span>}
                {t("Métrico")} <span className="menu-shortcut">{t("Litros, cm, mm")}</span>
              </button>
              <button
                className={`desktop-menu-option ${unitSystem === 'imperial' ? 'checked' : ''}`}
                onClick={() => { setUnitSystem('imperial'); closeMenu(); }}
                type="button"
              >
                {unitSystem === 'imperial' && <span className="menu-check">✓</span>}
                {t("Imperial")} <span className="menu-shortcut">{t("ft³, in")}</span>
              </button>
              <div className="desktop-menu-separator" />
              <button
                className="desktop-menu-option"
                onClick={handleResetConfig}
                type="button"
              >
                {t("Restablecer Configuración")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
