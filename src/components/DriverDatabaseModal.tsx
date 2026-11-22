import React, { useMemo, useState } from 'react';
import type { CustomDriver, SpeakerParams } from '../types';
import { type Lang, translate } from '../utils/translations';
import { NumericInput } from './NumericInput';

interface DriverDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Lang;
  customDrivers: CustomDriver[];
  onCustomDriversChange: (drivers: CustomDriver[]) => void;
  activePresetId: string;
  currentParams: SpeakerParams;
  onLoadDriver: (driverId: string, params: SpeakerParams) => void;
}

interface DriverFormState {
  id: string | null;
  brand: string;
  model: string;
  params: SpeakerParams;
}

const NUMERIC_FIELDS: Array<{ key: keyof SpeakerParams; label: string; unit: string }> = [
  { key: 'fs', label: 'Fs', unit: 'Hz' },
  { key: 'vas', label: 'Vas', unit: 'L' },
  { key: 'qts', label: 'Qts', unit: '' },
  { key: 'qes', label: 'Qes', unit: '' },
  { key: 'qms', label: 'Qms', unit: '' },
  { key: 'sd', label: 'Sd', unit: 'cm²' },
  { key: 'xmax', label: 'Xmax', unit: 'mm' },
  { key: 're', label: 'Re', unit: 'Ω' },
  { key: 'le', label: 'Le', unit: 'mH' },
  { key: 'bl', label: 'BL', unit: 'T·m' },
  { key: 'mms', label: 'Mms', unit: 'g' },
  { key: 'pe', label: 'Pe', unit: 'W' },
  { key: 'zNominal', label: 'Z', unit: 'Ω' },
  { key: 'sens', label: 'Sens', unit: 'dB' },
];

export const DriverDatabaseModal: React.FC<DriverDatabaseModalProps> = ({
  isOpen,
  onClose,
  lang,
  customDrivers,
  onCustomDriversChange,
  activePresetId,
  currentParams,
  onLoadDriver,
}) => {
  const t = (text: string) => translate(text, lang);
  const [search, setSearch] = useState('');
  const [formState, setFormState] = useState<DriverFormState | null>(null);
  const [editingBrand, setEditingBrand] = useState<string | null>(null);
  const [brandRenameValue, setBrandRenameValue] = useState('');

  const customBrands = useMemo(() => {
    const counts = new Map<string, number>();
    customDrivers.forEach((d) => {
      const b = d.brand.trim() || 'Sin marca';
      counts.set(b, (counts.get(b) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [customDrivers]);

  const filteredDrivers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customDrivers;
    return customDrivers.filter(
      (d) =>
        d.brand.toLowerCase().includes(q) ||
        d.model.toLowerCase().includes(q)
    );
  }, [customDrivers, search]);

  if (!isOpen) return null;

  const openNewForm = () => {
    setFormState({
      id: null,
      brand: '',
      model: '',
      params: { ...currentParams },
    });
  };

  const openEditForm = (driver: CustomDriver) => {
    setFormState({
      id: driver.id,
      brand: driver.brand,
      model: driver.model,
      params: { ...driver.params },
    });
  };

  const handleFieldChange = (key: keyof SpeakerParams, val: number | undefined) => {
    if (!formState) return;
    const nextParams = { ...formState.params };
    if (val === undefined || Number.isNaN(val)) {
      delete nextParams[key];
    } else {
      (nextParams as Record<string, unknown>)[key] = val;
    }
    setFormState({
      ...formState,
      params: nextParams,
    });
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState) return;
    const brand = formState.brand.trim();
    const model = formState.model.trim();
    if (!brand || !model) {
      alert(t('Ingresa fabricante y modelo del altavoz.'));
      return;
    }

    if (formState.id) {
      const updated = customDrivers.map((d) =>
        d.id === formState.id
          ? { ...d, brand, model, params: { ...formState.params } }
          : d
      );
      onCustomDriversChange(updated);
      if (activePresetId === formState.id) {
        onLoadDriver(formState.id, formState.params);
      }
    } else {
      const newDriver: CustomDriver = {
        id: `custom_${Date.now()}`,
        brand,
        model,
        isCustom: true,
        params: { ...formState.params },
      };
      onCustomDriversChange([...customDrivers, newDriver]);
      onLoadDriver(newDriver.id, newDriver.params);
    }
    setFormState(null);
  };

  const handleDeleteDriver = (driver: CustomDriver) => {
    if (!window.confirm(`${t('¿Eliminar el altavoz')} "${driver.brand} ${driver.model}"?`)) return;
    onCustomDriversChange(customDrivers.filter((d) => d.id !== driver.id));
  };

  const handleRenameBrand = (oldBrand: string) => {
    const nextBrand = brandRenameValue.trim();
    if (!nextBrand || nextBrand === oldBrand) {
      setEditingBrand(null);
      return;
    }
    const updated = customDrivers.map((d) =>
      (d.brand.trim() || 'Sin marca') === oldBrand ? { ...d, brand: nextBrand } : d
    );
    onCustomDriversChange(updated);
    setEditingBrand(null);
  };

  const handleDeleteBrand = (brand: string) => {
    if (
      !window.confirm(
        `${t('¿Eliminar todos los altavoces del fabricante')} "${brand}"?`
      )
    ) {
      return;
    }
    onCustomDriversChange(
      customDrivers.filter((d) => (d.brand.trim() || 'Sin marca') !== brand)
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000000,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(920px, 95vw)',
          maxHeight: '88vh',
          background: '#ffffff',
          border: '1px solid #98a2b3',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)',
          display: 'flex',
          flexDirection: 'column',
          color: '#000000',
          fontFamily: 'var(--font-sans)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dialog Titlebar */}
        <div
          style={{
            height: '30px',
            background: 'linear-gradient(to bottom, #e6e9ef, #d9dee6)',
            borderBottom: '1px solid #c5cbd4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 10px',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '0.78rem', fontWeight: 500, color: '#000000' }}>
            {t('Base de Datos de Altavoces Personalizados')}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#000000',
              fontSize: '1rem',
              lineHeight: 1,
              cursor: 'pointer',
              padding: '2px 6px',
            }}
            title={t('Cerrar')}
          >
            ×
          </button>
        </div>

        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 0.75rem',
            background: '#eef0f4',
            borderBottom: '1px solid #c9cfd8',
            flexShrink: 0,
          }}
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Filtrar por fabricante o modelo...')}
            style={{
              flex: 1,
              height: '28px',
              background: '#ffffff',
              border: '1px solid #c5cbd4',
              padding: '0 0.55rem',
              fontSize: '0.78rem',
              color: '#000000',
            }}
          />
          <button
            type="button"
            onClick={openNewForm}
            style={{
              height: '28px',
              padding: '0 0.75rem',
              background: '#3874b4',
              border: '1px solid #2d5f96',
              color: '#ffffff',
              fontSize: '0.76rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            + {t('Añadir Driver')}
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Gestión rápida de fabricantes guardados */}
          {customBrands.length > 0 && (
            <div style={{ border: '1px solid #c9cfd8', background: '#f8fafc', padding: '0.5rem 0.65rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 500, color: '#000000', marginBottom: '0.4rem' }}>
                {t('Fabricantes guardados en Personalizar (renombrar o eliminar):')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {customBrands.map(([brand, count]) => (
                  <div
                    key={brand}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      background: '#ffffff',
                      border: '1px solid #c5cbd4',
                      padding: '2px 6px',
                      fontSize: '0.74rem',
                      color: '#000000',
                    }}
                  >
                    {editingBrand === brand ? (
                      <>
                        <input
                          type="text"
                          value={brandRenameValue}
                          onChange={(e) => setBrandRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameBrand(brand);
                            if (e.key === 'Escape') setEditingBrand(null);
                          }}
                          style={{
                            width: '120px',
                            height: '22px',
                            padding: '0 4px',
                            fontSize: '0.74rem',
                            border: '1px solid #3874b4',
                            color: '#000000',
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleRenameBrand(brand)}
                          style={{ background: '#3874b4', color: '#ffffff', border: 'none', padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer' }}
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingBrand(null)}
                          style={{ background: '#e4e7ec', color: '#000000', border: '1px solid #c5cbd4', padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer' }}
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <>
                        <span>{brand} ({count})</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBrand(brand);
                            setBrandRenameValue(brand);
                          }}
                          style={{ background: '#eef0f4', color: '#000000', border: '1px solid #c5cbd4', padding: '1px 5px', fontSize: '0.68rem', cursor: 'pointer' }}
                          title={t('Renombrar fabricante')}
                        >
                          {t('Editar')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBrand(brand)}
                          style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '1px 5px', fontSize: '0.68rem', cursor: 'pointer' }}
                          title={t('Eliminar fabricante y sus drivers')}
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formulario Añadir / Editar Driver */}
          {formState && (
            <form
              onSubmit={handleSaveForm}
              style={{
                border: '1px solid #3874b4',
                background: '#f8fafc',
                padding: '0.65rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.55rem',
              }}
            >
              <div style={{ fontSize: '0.78rem', fontWeight: 500, color: '#000000', borderBottom: '1px solid #c9cfd8', paddingBottom: '0.3rem' }}>
                {formState.id ? t('Editar Altavoz') : t('Nuevo Altavoz Personalizado (valores iniciales tomados del driver actual)')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: '#000000', marginBottom: '2px' }}>{t('Fabricante')}</label>
                  <input
                    type="text"
                    value={formState.brand}
                    onChange={(e) => setFormState({ ...formState, brand: e.target.value })}
                    placeholder="Ej. Eminence, Pioneer..."
                    style={{ width: '100%', height: '28px', padding: '0 6px', fontSize: '0.76rem', color: '#000000' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: '#000000', marginBottom: '2px' }}>{t('Modelo')}</label>
                  <input
                    type="text"
                    value={formState.model}
                    onChange={(e) => setFormState({ ...formState, model: e.target.value })}
                    placeholder="Ej. Alpha-10A"
                    style={{ width: '100%', height: '28px', padding: '0 6px', fontSize: '0.76rem', color: '#000000' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '0.4rem' }}>
                {NUMERIC_FIELDS.map(({ key, label, unit }) => (
                  <div key={String(key)}>
                    <label style={{ display: 'block', fontSize: '0.68rem', color: '#000000', marginBottom: '2px' }}>
                      {label}{unit ? ` (${unit})` : ''}
                    </label>
                    <NumericInput
                      step="any"
                      allowEmpty={true}
                      treatZeroAsEmpty={true}
                      value={(formState.params[key] as number | undefined) ?? ''}
                      onValueChange={(val) => handleFieldChange(key, val)}
                      style={{ width: '100%', height: '26px', padding: '0 4px', fontSize: '0.74rem', color: '#000000' }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.45rem' }}>
                <button
                  type="button"
                  onClick={() => setFormState(null)}
                  style={{ height: '26px', padding: '0 0.7rem', background: '#e4e7ec', border: '1px solid #c5cbd4', color: '#000000', fontSize: '0.74rem', cursor: 'pointer' }}
                >
                  {t('Cancelar')}
                </button>
                <button
                  type="submit"
                  style={{ height: '26px', padding: '0 0.85rem', background: '#3874b4', border: '1px solid #2d5f96', color: '#ffffff', fontSize: '0.74rem', cursor: 'pointer' }}
                >
                  {t('Guardar')}
                </button>
              </div>
            </form>
          )}

          {/* Tabla de Drivers Personalizados */}
          <div style={{ border: '1px solid #c9cfd8', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', color: '#000000' }}>
              <thead>
                <tr style={{ background: '#e6e9ef', borderBottom: '1px solid #c5cbd4', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px', fontWeight: 500 }}>{t('Fabricante')}</th>
                  <th style={{ padding: '6px 8px', fontWeight: 500 }}>{t('Modelo')}</th>
                  <th style={{ padding: '6px 8px', fontWeight: 500 }}>Fs</th>
                  <th style={{ padding: '6px 8px', fontWeight: 500 }}>Vas</th>
                  <th style={{ padding: '6px 8px', fontWeight: 500 }}>Qts</th>
                  <th style={{ padding: '6px 8px', fontWeight: 500 }}>Re</th>
                  <th style={{ padding: '6px 8px', fontWeight: 500 }}>Pe</th>
                  <th style={{ padding: '6px 8px', fontWeight: 500, textAlign: 'right' }}>{t('Acciones')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '1rem', textAlign: 'center', color: '#000000' }}>
                      {t('No hay altavoces personalizados que coincidan.')}
                    </td>
                  </tr>
                ) : (
                  filteredDrivers.map((d) => (
                    <tr
                      key={d.id}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        background: activePresetId === d.id ? '#e8f1fb' : '#ffffff',
                      }}
                    >
                      <td style={{ padding: '5px 8px' }}>{d.brand}</td>
                      <td style={{ padding: '5px 8px' }}>{d.model}</td>
                      <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono)' }}>{d.params.fs} Hz</td>
                      <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono)' }}>{d.params.vas} L</td>
                      <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono)' }}>{d.params.qts}</td>
                      <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono)' }}>{d.params.re} Ω</td>
                      <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono)' }}>{d.params.pe ?? '-'} W</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => {
                            onLoadDriver(d.id, d.params);
                            onClose();
                          }}
                          style={{ marginRight: '4px', padding: '2px 7px', background: '#eef0f4', border: '1px solid #c5cbd4', color: '#000000', fontSize: '0.72rem', cursor: 'pointer' }}
                        >
                          {t('Cargar')}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditForm(d)}
                          style={{ marginRight: '4px', padding: '2px 7px', background: '#eef0f4', border: '1px solid #c5cbd4', color: '#000000', fontSize: '0.72rem', cursor: 'pointer' }}
                        >
                          {t('Editar')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDriver(d)}
                          style={{ padding: '2px 7px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: '0.72rem', cursor: 'pointer' }}
                        >
                          {t('Eliminar')}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
