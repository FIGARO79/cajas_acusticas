import React from 'react';
import { type Lang, translate } from '../utils/translations';
import { type UnitSystem } from '../utils/units';

interface HeaderProps {
  lang: Lang;
  setLang: (l: Lang) => void;
  unitSystem: UnitSystem;
  setUnitSystem: (u: UnitSystem) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  setLang,
  unitSystem,
  setUnitSystem,
  toggleTheme,
}) => {
  const t = (text: string) => translate(text, lang);


  return (
    <>
      <div className="top-bar-controls">
        <button className="theme-toggle-btn" onClick={toggleTheme} title={t("Cambiar tema")}>
          {/* Icono sol */}
          <svg className="sun-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M14.25 12a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
          {/* Icono luna */}
          <svg className="moon-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </button>
        <div className="control-divider"></div>
        <div className="unit-selector" style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '6px' }}>
          <button 
            className={`lang-btn ${unitSystem === 'metric' ? 'active' : ''}`} 
            onClick={() => setUnitSystem('metric')} 
            title={t("Sistema Métrico (Litros, cm, mm)")}
            style={{ minWidth: '40px', fontSize: '0.72rem', padding: '4px 8px' }}
          >
            {t("Métrico")}
          </button>
          <button 
            className={`lang-btn ${unitSystem === 'imperial' ? 'active' : ''}`} 
            onClick={() => setUnitSystem('imperial')} 
            title={t("Sistema Inglés (Pies cúbicos, pulgadas)")}
            style={{ minWidth: '40px', fontSize: '0.72rem', padding: '4px 8px' }}
          >
            {t("Inglés")}
          </button>
        </div>
        <div className="control-divider"></div>
        <div className="lang-selector">
          <button className={`lang-btn ${lang === 'es' ? 'active' : ''}`} onClick={() => setLang('es')} title="Español">ES</button>
          <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')} title="English">EN</button>
          <button className={`lang-btn ${lang === 'pt' ? 'active' : ''}`} onClick={() => setLang('pt')} title="Português">PT</button>
        </div>
      </div>

      <header>
        <div className="logo-area">
          <h1>Acoustic<span className="logo-highlight">LAB</span></h1>
        </div>
        <p>{t("Calculadora y simulador Thiele/Small de cajas acústicas en tiempo real.")}</p>
      </header>
    </>
  );
};
