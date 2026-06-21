export type UnitSystem = 'metric' | 'imperial';

// Conversion constants
export const LITERS_PER_FT3 = 28.3168466;
export const CM_PER_INCH = 2.54;
export const MM_PER_INCH = 25.4;
export const CM2_PER_IN2 = 6.4516;
export const CC_PER_CUIN = 16.387064;

/**
 * Converts a value from metric to the target unit system.
 */
export function convertTo(val: number, type: 'volume' | 'volume_small' | 'length' | 'length_small' | 'area', system: UnitSystem): number {
  if (system === 'metric') return val;
  switch (type) {
    case 'volume':
      return val / LITERS_PER_FT3;
    case 'volume_small':
      return val / CC_PER_CUIN;
    case 'length':
      return val / CM_PER_INCH;
    case 'length_small':
      return val / MM_PER_INCH;
    case 'area':
      return val / CM2_PER_IN2;
    default:
      return val;
  }
}

/**
 * Converts a value from the unit system to metric.
 */
export function convertFrom(val: number, type: 'volume' | 'volume_small' | 'length' | 'length_small' | 'area', system: UnitSystem): number {
  if (system === 'metric') return val;
  switch (type) {
    case 'volume':
      return val * LITERS_PER_FT3;
    case 'volume_small':
      return val * CC_PER_CUIN;
    case 'length':
      return val * CM_PER_INCH;
    case 'length_small':
      return val * MM_PER_INCH;
    case 'area':
      return val * CM2_PER_IN2;
    default:
      return val;
  }
}

/**
 * Format a value with units depending on the unit system.
 */
export function formatUnit(val: number, type: 'volume' | 'volume_small' | 'length' | 'length_small' | 'area', system: UnitSystem, decimals: number = 2): string {
  const converted = convertTo(val, type, system);
  const unit = getUnitLabel(type, system);
  return `${converted.toFixed(decimals)} ${unit}`;
}

/**
 * Get unit label for display
 */
export function getUnitLabel(type: 'volume' | 'volume_small' | 'length' | 'length_small' | 'area', system: UnitSystem): string {
  if (system === 'metric') {
    switch (type) {
      case 'volume': return 'L';
      case 'volume_small': return 'cc';
      case 'length': return 'cm';
      case 'length_small': return 'mm';
      case 'area': return 'cm²';
    }
  } else {
    switch (type) {
      case 'volume': return 'ft³';
      case 'volume_small': return 'cu in';
      case 'length': return 'in';
      case 'length_small': return 'in';
      case 'area': return 'in²';
    }
  }
  return '';
}
