import React, { useState, useEffect } from 'react';
import type { SpeakerParams, CustomDriver } from '../types';
import { type Lang, translate } from '../utils/translations';
import { calcAutoParams } from '../wasm/index.ts';
import { type UnitSystem, convertTo, convertFrom, getUnitLabel } from '../utils/units';

interface SpeakerParamsFormProps {
  lang: Lang;
  unitSystem: UnitSystem;
  params: SpeakerParams;
  onParamsChange: (newParams: SpeakerParams) => void;
  driverConfig: string;
  onDriverConfigChange: (config: string) => void;
  validationError: string | null;
  preset: string;
  onPresetChange: (presetId: string, params: SpeakerParams | null) => void;
  customDrivers?: CustomDriver[];
  onCustomDriversChange?: (drivers: CustomDriver[]) => void;
}

const UNIT_TYPES: Record<string, 'volume' | 'volume_small' | 'length' | 'length_small' | 'area'> = {
  vas: 'volume',
  sd: 'area',
  xmax: 'length_small',
  gapHeight: 'length_small',
  vcDiameter: 'length_small',
  vd: 'volume_small'
};

export const SpeakerParamsForm: React.FC<SpeakerParamsFormProps> = ({
  lang,
  unitSystem,
  params,
  onParamsChange,
  driverConfig,
  onDriverConfigChange,
  validationError,
  preset,
  onPresetChange,
  customDrivers = [],
  onCustomDriversChange = () => {},
}) => {
  const t = (text: string) => translate(text, lang);
  const [proMode, setProMode] = useState(false);

  // Lógica de base de datos de altavoces
  const [driversDb, setDriversDb] = useState<{ companies: Record<number, string>; woofers: any[] } | null>(null);
  const [loadingDb, setLoadingDb] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);

  // Computar brandsList dinámicamente combinando marcas oficiales y personalizadas
  const brandsList = React.useMemo(() => {
    const brandsSet = new Set<string>();
    
    // Añadir marcas oficiales
    if (driversDb) {
      driversDb.woofers.forEach((w: any) => {
        const brand = driversDb.companies[w["Company ID"]];
        if (brand) brandsSet.add(brand);
      });
    }
    
    // Añadir marcas personalizadas
    customDrivers.forEach(cd => {
      if (cd.brand) brandsSet.add(cd.brand);
    });
    
    return Array.from(brandsSet).sort();
  }, [driversDb, customDrivers]);

  // Cargar base de datos al montar
  useEffect(() => {
    const loadDrivers = async () => {
      setLoadingDb(true);
      try {
        const response = await fetch('/driverdb.json');
        if (!response.ok) throw new Error('No se pudo cargar la base de datos');
        const data = await response.json();
        
        const companiesMap: Record<number, string> = {};
        if (data.companies) {
          data.companies.forEach((c: any) => {
            companiesMap[c.ID] = c.Company;
          });
        }
        
        const validWoofers = (data.woofers || []).filter((w: any) => 
          w.Model && w.Model.trim() && w.Fs > 0 && w.Vas > 0 && w.Qts > 0
        );
        
        setDriversDb({
          companies: companiesMap,
          woofers: validWoofers
        });
      } catch (err) {
        console.error('Error al cargar la base de datos de drivers:', err);
      } finally {
        setLoadingDb(false);
      }
    };
    loadDrivers();
  }, []);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Estado para la pestaña de driver activa (estilo Chrome)
  const [driverTab, setDriverTab] = useState<'view' | 'edit'>('view');

  // Estados para guardar/editar driver personalizado
  const [saveBrand, setSaveBrand] = useState('');
  const [saveModel, setSaveModel] = useState('');

  // Identificar si el driver actual es personalizado
  const currentCustomDriver = React.useMemo(() => {
    return customDrivers.find(d => d.id === preset);
  }, [customDrivers, preset]);

  // Precargar marca y modelo al cambiar a la pestaña de edición
  useEffect(() => {
    if (driverTab === 'edit') {
      if (currentCustomDriver) {
        setSaveBrand(currentCustomDriver.brand);
        setSaveModel(currentCustomDriver.model);
      } else {
        setSaveBrand(selectedBrand || '');
        setSaveModel(searchQuery || '');
      }
    }
  }, [driverTab, currentCustomDriver, selectedBrand, searchQuery]);

  // Guardar altavoz actual como personalizado
  const handleSaveCustomDriver = () => {
    if (!saveBrand.trim() || !saveModel.trim()) {
      alert(t("Por favor introduce Marca y Modelo."));
      return;
    }

    if (!params.fs || params.fs <= 0 || !params.vas || params.vas <= 0) {
      alert(t("Por favor completa los parámetros mínimos (Fs y Vas) con valores mayores que cero."));
      return;
    }

    // Calcular Qts si falta pero existen Qms y Qes
    let finalQts = params.qts || 0;
    if (finalQts <= 0 && params.qms && params.qes) {
      finalQts = Math.round((params.qms * params.qes) / (params.qms + params.qes) * 1000) / 1000;
    }

    if (finalQts <= 0) {
      alert(t("Por favor introduce Qts o provee Qms y Qes para auto-calcularlo."));
      return;
    }

    const newDriver: CustomDriver = {
      id: 'custom_' + Date.now(),
      brand: saveBrand.trim(),
      model: saveModel.trim(),
      params: { ...params, qts: finalQts },
      isCustom: true
    };

    onCustomDriversChange([...customDrivers, newDriver]);
    onPresetChange(newDriver.id, newDriver.params);
    setSearchQuery(`${newDriver.brand} ${newDriver.model}`);
    setSelectedBrand(newDriver.brand);
    setDriverTab('view');
    alert(t("Altavoz guardado correctamente en tu base de datos local."));
  };

  // Actualizar parámetros del altavoz personalizado seleccionado
  const handleUpdateCustomDriver = () => {
    if (!currentCustomDriver) return;
    
    // Calcular Qts si falta pero existen Qms y Qes
    let finalQts = params.qts || 0;
    if (finalQts <= 0 && params.qms && params.qes) {
      finalQts = Math.round((params.qms * params.qes) / (params.qms + params.qes) * 1000) / 1000;
    }

    const updatedList = customDrivers.map(d => 
      d.id === currentCustomDriver.id 
        ? { ...d, params: { ...params, qts: finalQts || d.params.qts } } 
        : d
    );

    onCustomDriversChange(updatedList);
    alert(t("Parámetros actualizados correctamente para el altavoz " + currentCustomDriver.brand + " " + currentCustomDriver.model + "."));
  };

  // Eliminar altavoz personalizado seleccionado
  const handleDeleteCustomDriver = () => {
    if (!currentCustomDriver) return;
    if (window.confirm(t("¿Seguro que deseas eliminar este altavoz personalizado?"))) {
      onCustomDriversChange(customDrivers.filter(d => d.id !== currentCustomDriver.id));
      onPresetChange('', null);
      setSearchQuery('');
    }
  };

  // Mapear campos de la base de datos a SpeakerParams
  const mapDriverToSpeakerParams = (driver: any): SpeakerParams => {
    return {
      fs: driver.Fs || 0,
      vas: (driver.Vas || 0) * 1000, // m³ a litros
      qms: driver.Qms || 0,
      qes: driver.Qes || 0,
      qts: driver.Qts || 0,
      sd: (driver.Sd || 0) * 10000, // m² a cm²
      xmax: (driver.Xlin || 0) * 1000, // m a mm
      re: driver.Re || 0,
      le: (driver.Le || 0) * 1000, // H a mH
      bl: driver.BL || undefined,
      mms: driver.Mms ? driver.Mms * 1000 : undefined,
      cms: driver.Cms ? driver.Cms * 1000 : undefined,
      pe: driver.Pe || undefined,
      xlim: driver.Xmech ? driver.Xmech * 1000 : undefined,
      diaNominal: driver["Dimen A1"] ? `${Math.round(driver["Dimen A1"] * 39.3701)}" (${Math.round(driver["Dimen A1"] * 1000)} mm)` : undefined,
      zNominal: driver.Z || undefined,
      sens: driver.SPL1 || undefined,
      vd: driver["P-Vd"] ? driver["P-Vd"] * 1000000 : undefined,
    };
  };

  // Filtrar los woofers basados en la marca y la consulta de búsqueda
  const filteredDrivers = React.useMemo(() => {
    // Mapear los customDrivers al formato de woofers de la DB
    const mappedCustomWoofers = customDrivers.map(cd => {
      return {
        ID: cd.id,
        Model: cd.model,
        "Company ID": -1, // Ficticio
        _customBrand: cd.brand,
        _isCustom: true,
        Fs: cd.params.fs,
        Vas: cd.params.vas / 1000, // De litros a m³
        Qms: cd.params.qms,
        Qes: cd.params.qes,
        Qts: cd.params.qts,
        Sd: cd.params.sd / 10000, // De cm² a m²
        Xlin: cd.params.xmax / 1000, // De mm a m
        Re: cd.params.re,
        Le: cd.params.le / 1000, // De mH a H
        BL: cd.params.bl,
        Mms: cd.params.mms ? cd.params.mms / 1000 : undefined,
        Cms: cd.params.cms ? cd.params.cms / 1000 : undefined,
        Pe: cd.params.pe,
        Xmech: cd.params.xlim ? cd.params.xlim / 1000 : undefined,
        Z: cd.params.zNominal,
        SPL1: cd.params.sens,
        "Dimen A1": cd.params.diaNominal ? (parseFloat(cd.params.diaNominal) / 39.3701 || undefined) : undefined,
        "P-Vd": cd.params.vd ? cd.params.vd / 1000000 : undefined,
      };
    });

    const officialWoofers = driversDb ? driversDb.woofers : [];
    const allWoofers = [...mappedCustomWoofers, ...officialWoofers];
    
    // Normalizar la consulta de búsqueda dividiéndola en palabras y limpiando guiones/barras
    const queryTokens = searchQuery
      .toLowerCase()
      .replace(/[-\/]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
      
    // Si no hay marca seleccionada Y tampoco hay búsqueda, no mostramos nada
    if (!selectedBrand && queryTokens.length === 0) return [];
    
    // 1. Obtener los woofers correspondientes a la marca (si hay una)
    let brandWoofers = allWoofers;
    if (selectedBrand) {
      brandWoofers = allWoofers.filter(w => {
        const brand = w._isCustom ? w._customBrand : (driversDb ? driversDb.companies[w["Company ID"]] : '');
        return brand === selectedBrand;
      });
      
      // 2. Ordenar alfabéticamente por nombre de modelo
      brandWoofers.sort((a, b) => {
        const modelA = (a.Model || '').toLowerCase();
        const modelB = (b.Model || '').toLowerCase();
        return modelA.localeCompare(modelB);
      });
    }
    
    // 3. Filtrar y aplicar límite
    const results = [];
    for (const w of brandWoofers) {
      const isCustom = w._isCustom;
      const brand = isCustom ? w._customBrand : (driversDb ? driversDb.companies[w["Company ID"]] : 'Genérico');
      const model = w.Model || '';
      // Nombre limpio sin etiquetas
      const displayName = selectedBrand ? model : `${brand} ${model}`;
      
      // Si hay tokens de búsqueda, aplicar filtro
      if (queryTokens.length > 0) {
        const targetText = `${brand} ${model}`
          .toLowerCase()
          .replace(/[-\/]/g, ' ');
          
        const matchesAll = queryTokens.every(token => {
          // Permitir coincidencia flexible para terminaciones comunes como "10a" -> "10" si no hay coincidencia exacta
          if (targetText.includes(token)) return true;
          
          // Si el token es algo como "10a" y no coincide, intentamos con "10" (número + letra al final)
          const numWithCharMatch = token.match(/^(\d+)[a-z]$/);
          if (numWithCharMatch && targetText.includes(numWithCharMatch[1])) {
            return true;
          }
          return false;
        });
        
        if (!matchesAll) continue;
      }
      
      results.push({
        driver: w,
        brand,
        displayName
      });
      
      // Límite de resultados: 100 si hay marca para hacer scroll, 30 si es búsqueda general
      if (results.length >= (selectedBrand ? 100 : 30)) break;
    }
    return results;
  }, [driversDb, searchQuery, selectedBrand, customDrivers]);

  const handleSelectDriver = (item: { driver: any; brand: string; displayName: string }) => {
    const mapped = mapDriverToSpeakerParams(item.driver);
    onPresetChange(item.driver.ID.toString(), mapped);
    setSearchQuery(item.displayName);
    setShowDropdown(false);
  };

  // Sincronizar input si el preset cambia a vacío desde fuera (como al limpiar parámetros)
  useEffect(() => {
    if (!preset) {
      setSearchQuery('');
    }
  }, [preset]);

  // Derived calculations
  const [derived, setDerived] = useState<Awaited<ReturnType<typeof calcAutoParams>> | null>(null);

  useEffect(() => {
    const fetchDerived = async () => {
      if (params.fs && params.vas && params.qts) {
        const results = await calcAutoParams(params);
        setDerived(results);
      } else {
        setDerived(null);
      }
    };
    fetchDerived();
  }, [params]);

  const displayValue = (field: keyof SpeakerParams) => {
    const val = params[field];
    if (val === undefined || val === null) return '';
    const unitType = UNIT_TYPES[field];
    if (unitType) {
      const converted = convertTo(val as number, unitType, unitSystem);
      return (Math.round(converted * 10000) / 10000).toString();
    }
    return val.toString();
  };

  const handleInputChange = (field: keyof SpeakerParams, val: string) => {
    const nextParams = { ...params };
    if (field === 'diaNominal') {
      nextParams.diaNominal = val;
    } else {
      let num = parseFloat(val);
      if (isNaN(num)) {
        delete nextParams[field];
      } else {
        const unitType = UNIT_TYPES[field];
        if (unitType) {
          num = convertFrom(num, unitType, unitSystem);
        }
        (nextParams[field] as number) = num;
      }
    }

    // Auto-calculate Qts if Qes and Qms exist, and Qts is not manually set/overridden
    if (field === 'qms' || field === 'qes') {
      const qms = field === 'qms' ? parseFloat(val) : params.qms;
      const qes = field === 'qes' ? parseFloat(val) : params.qes;
      if (qms && qes) {
        nextParams.qts = Math.round((qms * qes) / (qms + qes) * 1000) / 1000;
      }
    }

    onParamsChange(nextParams);
  };

  return (
    <aside className="panel">
      {/* Selector de Pestañas (Segmented Control) */}
      <div className="driver-tabs">
        <button 
          type="button"
          className={`driver-tab ${driverTab === 'view' ? 'active' : ''}`}
          onClick={() => setDriverTab('view')}
        >
          {t("Cargar Altavoz")}
        </button>
        <button 
          type="button"
          className={`driver-tab ${driverTab === 'edit' ? 'active' : ''}`}
          onClick={() => setDriverTab('edit')}
        >
          {t("Agregar / Editar")}
        </button>
      </div>

      {/* PESTAÑA 1: CARGAR / SIMULACIÓN */}
      {driverTab === 'view' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }} ref={searchRef}>
          <div className="input-group input-group-full" style={{ marginBottom: 0 }}>
            <label>{t("Marca / Fabricante:")}</label>
            <select
              value={selectedBrand}
              onChange={(e) => {
                setSelectedBrand(e.target.value);
                setSearchQuery(''); // Limpiar modelo al cambiar de marca
                onPresetChange('', null); // Limpiar parámetros cargados
                setShowDropdown(true); // Abrir el dropdown para sugerir modelos
              }}
              className="input-select"
              style={{ width: '100%', height: '34px' }}
              disabled={loadingDb}
            >
              <option value="">{t("Todas las marcas")}</option>
              {brandsList.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>

          <div className="input-group input-group-full" style={{ marginBottom: 0 }}>
            <label>{t("Modelo del Altavoz:")}</label>
            <div className="search-container">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder={
                  loadingDb 
                    ? t("Cargando base de datos (27 MB)...") 
                    : selectedBrand 
                      ? t("Selecciona modelo de " + selectedBrand + "...")
                      : t("Buscar modelo o escribe marca...")
                }
                disabled={loadingDb}
                className="input-text"
                style={{ width: '100%', height: '34px', paddingRight: '2rem' }}
              />
              {loadingDb && (
                <div className="search-loading">
                  {t("Cargando base de datos...")}
                </div>
              )}
              {showDropdown && filteredDrivers.length > 0 && (
                <ul className="search-dropdown">
                  {filteredDrivers.map((item) => (
                    <li
                      key={item.driver.ID}
                      onClick={() => handleSelectDriver(item)}
                      className="search-item"
                    >
                      {item.displayName}
                    </li>
                  ))}
                </ul>
              )}
              {showDropdown && (searchQuery.trim() || selectedBrand) && filteredDrivers.length === 0 && !loadingDb && (
                <ul className="search-dropdown" style={{ maxHeight: 'none' }}>
                  <li className="search-item" style={{ cursor: 'default', color: 'var(--text-muted)' }}>
                    {t("No se encontraron resultados")}
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: AGREGAR / EDITAR */}
      {driverTab === 'edit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem', padding: '0.5rem', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>
          <div className="input-group input-group-full" style={{ marginBottom: 0 }}>
            <label>{t("Marca / Fabricante:")}</label>
            <input 
              type="text"
              value={saveBrand}
              onChange={(e) => setSaveBrand(e.target.value)}
              placeholder={t("Ej. Pioneer, Eminence...")}
              className="input-text"
              style={{ width: '100%', height: '34px' }}
            />
          </div>

          <div className="input-group input-group-full" style={{ marginBottom: 0 }}>
            <label>{t("Modelo del Altavoz:")}</label>
            <input 
              type="text"
              value={saveModel}
              onChange={(e) => setSaveModel(e.target.value)}
              placeholder={t("Ej. TS-W311, Alpha-10...")}
              className="input-text"
              style={{ width: '100%', height: '34px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            {currentCustomDriver ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 650, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>📁</span> {t("Modificando altavoz guardado")}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={handleUpdateCustomDriver}
                    style={{ flex: 1, fontSize: '0.8rem', padding: '0.45rem 0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                  >
                    <span>💾</span> {t("Guardar Cambios")}
                  </button>
                  <button 
                    type="button" 
                    className="btn" 
                    onClick={handleDeleteCustomDriver}
                    style={{ fontSize: '0.8rem', padding: '0.45rem 0.6rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                  >
                    {t("Eliminar")}
                  </button>
                </div>
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => {
                    // Desvincular de este preset para poder guardarlo como uno nuevo
                    onPresetChange('', null);
                    // Cambiar el nombre a un modelo diferente o mantenerlo para guardarlo como una nueva copia
                    setSaveModel(saveModel + " Copia");
                    alert(t("Desvinculado del altavoz original. Ahora puedes cambiar el nombre y hacer click en 'Guardar como Nuevo'."));
                  }}
                  style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem', width: '100%', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}
                >
                  {t("Duplicar / Guardar como Nuevo")}
                </button>
              </div>
            ) : (
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleSaveCustomDriver}
                style={{ fontSize: '0.8rem', padding: '0.5rem 0.6rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
              >
                <span>💾</span> {t("Guardar como Altavoz Personalizado")}
              </button>
            )}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
        <h2 className="panel-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>{t("Parámetros")}</h2>
      </div>

      <div className="form-section">
        {/* BLOQUE 1: ESPECIFICACIONES DEL ALTAVOZ */}
        <div className="form-subsection-title">{t("Especificaciones del Altavoz")}</div>
        <div className="input-group input-group-full">
          <label>{t("Configuración de Altavoces")}</label>
          <select 
            value={driverConfig} 
            onChange={(e) => onDriverConfigChange(e.target.value)} 
            className="input-select"
            style={{ width: '100%', height: '34px' }}
          >
            <option value="single">{t("Un Altavoz (Estándar)")}</option>
            <option value="parallel_2">{t("2 Altavoces en Paralelo (2x Vb)")}</option>
            <option value="series_2">{t("2 Altavoces en Serie (2x Vb)")}</option>
            <option value="isobaric">{t("Isobárica / Push-Pull (0.5x Vb)")}</option>
          </select>
        </div>

        <div className="input-grid">
          <div className="input-group">
            <label>{t("Diámetro Nominal")}</label>
            <div className="input-wrapper">
              <input 
                type="text" 
                value={params.diaNominal || ''} 
                onChange={(e) => handleInputChange('diaNominal', e.target.value)}
                placeholder='e.g. 10" o 254mm' 
              />
            </div>
          </div>
          <div className="input-group">
            <label>{t("Impedancia Nominal")}</label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.zNominal ?? ''} 
                onChange={(e) => handleInputChange('zNominal', e.target.value)}
                placeholder="8" 
                step="any" 
              />
              <span className="unit-badge">Ω</span>
            </div>
          </div>
          <div className="input-group">
            <label>{t("Potencia RMS (Watts)")}</label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.pe ?? ''} 
                onChange={(e) => handleInputChange('pe', e.target.value)}
                placeholder="150" 
                step="any" 
              />
              <span className="unit-badge">W</span>
            </div>
          </div>
          <div className="input-group">
            <label>{t("Program Power")}</label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.pProg ?? ''} 
                onChange={(e) => handleInputChange('pProg', e.target.value)}
                placeholder="300" 
                step="any" 
              />
              <span className="unit-badge">W</span>
            </div>
          </div>
          <div className="input-group">
            <label>{t("Rango Frec. (Mín)")}</label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.freqMin ?? ''} 
                onChange={(e) => handleInputChange('freqMin', e.target.value)}
                placeholder="57" 
                step="any" 
              />
              <span className="unit-badge">Hz</span>
            </div>
          </div>
          <div className="input-group">
            <label>{t("Rango Frec. (Máx)")}</label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.freqMax ?? ''} 
                onChange={(e) => handleInputChange('freqMax', e.target.value)}
                placeholder="4500" 
                step="any" 
              />
              <span className="unit-badge">Hz</span>
            </div>
          </div>
          <div className="input-group">
            <label>{t("Sensibilidad (1W/1m)")}</label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.sens ?? ''} 
                onChange={(e) => handleInputChange('sens', e.target.value)}
                placeholder="95.6" 
                step="any" 
              />
              <span className="unit-badge">dB</span>
            </div>
          </div>
          <div className="input-group">
            <label>{t("Peso del Imán")}</label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.magWeight ?? ''} 
                onChange={(e) => handleInputChange('magWeight', e.target.value)}
                placeholder="20" 
                step="any" 
              />
              <span className="unit-badge">oz</span>
            </div>
          </div>
          <div className="input-group">
            <label style={{ whiteSpace: 'nowrap' }}>{t("Altura del Gap")}</label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.gapHeight ?? ''} 
                onChange={(e) => handleInputChange('gapHeight', e.target.value)}
                placeholder="6.4" 
                step="any" 
              />
              <span className="unit-badge">mm</span>
            </div>
          </div>
          <div className="input-group">
            <label>{t("Diám. Bobina Móvil")}</label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.vcDiameter ?? ''} 
                onChange={(e) => handleInputChange('vcDiameter', e.target.value)}
                placeholder="38" 
                step="any" 
              />
              <span className="unit-badge">mm</span>
            </div>
          </div>
        </div>

        {/* BLOQUE 2: PARÁMETROS THIELE & SMALL */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem', marginTop: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
          <div className="form-subsection-title" style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>{t("Parámetros Thiele & Small")}</div>
          <label className="checkbox-container" style={{ fontWeight: 500, marginBottom: 0, cursor: 'pointer' }}>
            <input type="checkbox" checked={proMode} onChange={(e) => setProMode(e.target.checked)} />
            <div className="custom-checkbox"></div>
            <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>{t("Parámetros Avanzados")}</span>
          </label>
        </div>

        <div className="input-grid">
          <div className="input-group">
            <label>Fs <span className="label-desc">({t("Resonancia")})</span></label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.fs ?? ''} 
                onChange={(e) => handleInputChange('fs', e.target.value)}
                placeholder="45" 
                step="any" 
                required
              />
              <span className="unit-badge">Hz</span>
            </div>
          </div>
          <div className="input-group">
            <label>Vas <span className="label-desc">({t("Vol. Eq")})</span></label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={displayValue('vas')} 
                onChange={(e) => handleInputChange('vas', e.target.value)}
                placeholder={convertTo(60, 'volume', unitSystem).toFixed(1)} 
                step="any" 
                required
              />
              <span className="unit-badge">{getUnitLabel('volume', unitSystem)}</span>
            </div>
          </div>
          <div className="input-group">
            <label>Qms <span className="label-desc">({t("Q Mecánico")})</span></label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.qms ?? ''} 
                onChange={(e) => handleInputChange('qms', e.target.value)}
                placeholder="4.5" 
                step="any" 
              />
            </div>
          </div>
          <div className="input-group">
            <label>Qes <span className="label-desc">({t("Q Eléctrico")})</span></label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.qes ?? ''} 
                onChange={(e) => handleInputChange('qes', e.target.value)}
                placeholder="0.45" 
                step="any" 
              />
            </div>
          </div>
          <div className="input-group">
            <label>Qts <span className="label-desc">({t("Q Total")})</span></label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.qts ?? ''} 
                onChange={(e) => handleInputChange('qts', e.target.value)}
                placeholder="0.41" 
                step="any" 
              />
            </div>
          </div>
          <div className="input-group">
            <label>Sd <span className="label-desc">({t("Área Cono")})</span></label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={displayValue('sd')} 
                onChange={(e) => handleInputChange('sd', e.target.value)}
                placeholder={convertTo(350, 'area', unitSystem).toFixed(1)} 
                step="any" 
              />
              <span className="unit-badge">{getUnitLabel('area', unitSystem)}</span>
            </div>
          </div>
          <div className="input-group">
            <label>Xmax <span className="label-desc">({t("Excursión")})</span></label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={displayValue('xmax')} 
                onChange={(e) => handleInputChange('xmax', e.target.value)}
                placeholder={convertTo(6.5, 'length_small', unitSystem).toFixed(2)} 
                step="any" 
              />
              <span className="unit-badge">{getUnitLabel('length_small', unitSystem)}</span>
            </div>
          </div>
          <div className="input-group">
            <label>Re <span className="label-desc">({t("Resist. DC")})</span></label>
            <div className="input-wrapper">
              <input 
                type="number" 
                value={params.re ?? ''} 
                onChange={(e) => handleInputChange('re', e.target.value)}
                placeholder="3.6" 
                step="any" 
              />
              <span className="unit-badge">Ω</span>
            </div>
          </div>
        </div>

        {/* TS Avanzados (Se despliegan en el mismo bloque al activar pro) */}
        {proMode && (
          <div className="input-grid" style={{ marginTop: '0.75rem' }}>
            <div className="input-group">
              <label>BL <span className="label-desc">({t("Fuerza Motor")})</span></label>
              <div className="input-wrapper">
                <input 
                  type="number" 
                  value={params.bl ?? ''} 
                  onChange={(e) => handleInputChange('bl', e.target.value)}
                  placeholder={derived?.bl.toFixed(2) || "7.5"} 
                  step="any" 
                />
                <span className="unit-badge">T-m</span>
              </div>
            </div>
            <div className="input-group">
              <label>Mms <span className="label-desc">({t("Masa Móvil")})</span></label>
              <div className="input-wrapper">
                <input 
                  type="number" 
                  value={params.mms ?? ''} 
                  onChange={(e) => handleInputChange('mms', e.target.value)}
                  placeholder={derived?.mms.toFixed(1) || "22"} 
                  step="any" 
                />
                <span className="unit-badge">g</span>
              </div>
            </div>
            <div className="input-group">
              <label>Cms <span className="label-desc">({t("Compliancia")})</span></label>
              <div className="input-wrapper">
                <input 
                  type="number" 
                  value={params.cms ?? ''} 
                  onChange={(e) => handleInputChange('cms', e.target.value)}
                  placeholder={derived?.cms.toFixed(3) || "0.46"} 
                  step="any" 
                />
                <span className="unit-badge">mm/N</span>
              </div>
            </div>
            <div className="input-group">
              <label>Xlim <span className="label-desc">({t("Límite Mecánico")})</span></label>
              <div className="input-wrapper">
                <input 
                  type="number" 
                  value={displayValue('xlim')} 
                  onChange={(e) => handleInputChange('xlim', e.target.value)}
                  placeholder={convertTo(9.1, 'length_small', unitSystem).toFixed(2)} 
                  step="any" 
                />
                <span className="unit-badge">{getUnitLabel('length_small', unitSystem)}</span>
              </div>
            </div>
            <div className="input-group">
              <label>Le <span className="label-desc">({t("Inductancia")})</span></label>
              <div className="input-wrapper">
                <input 
                  type="number" 
                  value={params.le ?? ''} 
                  onChange={(e) => handleInputChange('le', e.target.value)}
                  placeholder="0.8" 
                  step="any" 
                />
                <span className="unit-badge">mH</span>
              </div>
            </div>
            <div className="input-group">
              <label>Vd <span className="label-desc">({t("Vol. Desplazado")})</span></label>
              <div className="input-wrapper">
                <input 
                  type="number" 
                  value={displayValue('vd')} 
                  onChange={(e) => handleInputChange('vd', e.target.value)}
                  placeholder={derived ? convertTo(derived.vd, 'volume_small', unitSystem).toFixed(1) : convertTo(114, 'volume_small', unitSystem).toFixed(1)} 
                  step="any" 
                />
                <span className="unit-badge">{getUnitLabel('volume_small', unitSystem)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Parámetros Derivados Pro */}
      {proMode && derived && (
        <div className="pro-calc-panel">
          <span className="pro-calc-title">{t("Parámetros Derivados (Pro)")}</span>
          <div className="pro-calc-row">
            <span className="pro-calc-label">{t("Eficiencia de Ref. (η₀):")}</span>
            <span className="pro-calc-value">{derived.eta0 > 0 ? `${(derived.eta0 * 100).toFixed(3)} %` : '-- %'}</span>
          </div>
          <div className="pro-calc-row">
            <span className="pro-calc-label">{t("Sensibilidad Ref. (1W/1m):")}</span>
            <span className="pro-calc-value">{(derived.spl ?? 0) > 0 ? `${derived.spl?.toFixed(1)} dB${params.sens ? ' (' + t("Manual") + ')' : ' (' + t("Sugerida") + ')'}` : '-- dB'}</span>
          </div>
          <div className="pro-calc-row">
            <span className="pro-calc-label">{t("SPL Máximo (RMS a Pe):")}</span>
            <span className="pro-calc-value">{derived.splMax > 0 ? `${derived.splMax.toFixed(1)} dB` : '-- dB'}</span>
          </div>
          <div className="pro-calc-row">
            <span className="pro-calc-label">{t("Pérdidas Susp. (Rms):")}</span>
            <span className="pro-calc-value">{derived.rms > 0 ? `${derived.rms.toFixed(2)} kg/s` : '-- kg/s'}</span>
          </div>
          <div className="pro-calc-row">
            <span className="pro-calc-label">{t("Impedancia Resonancia (Zmax):")}</span>
            <span className="pro-calc-value">{derived.zmax > 0 ? `${derived.zmax.toFixed(1)} Ω` : '-- Ω'}</span>
          </div>
          {(derived.autoCms || derived.autoMms || derived.autoBl || derived.autoVd) && (
            <div className="pro-calc-row" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {t("* Compliancia y Masa auto-calculadas.")}
            </div>
          )}
        </div>
      )}

      {/* Notificaciones en vivo */}
      {validationError && (
        <div className="notification-area active error">
          <span>{validationError}</span>
        </div>
      )}
    </aside>
  );
};
