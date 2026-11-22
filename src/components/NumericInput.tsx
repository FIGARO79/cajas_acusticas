import React, { useRef, useState } from 'react';

export interface NumericInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> {
  value: number | '' | undefined | null;
  onValueChange: (val: number | undefined) => void;
  decimals?: number;
  allowEmpty?: boolean;
  treatZeroAsEmpty?: boolean;
  allowNegative?: boolean;
  integer?: boolean;
  min?: number;
  max?: number;
  step?: number | string;
  showStepper?: boolean;
  onEnter?: (committedValue: number | undefined) => void;
}

function clampAndFormat(
  num: number,
  min?: number,
  max?: number,
  integer?: boolean
): number {
  let next = integer ? Math.round(num) : num;
  if (typeof min === 'number' && Number.isFinite(min)) {
    next = Math.max(min, next);
  }
  if (typeof max === 'number' && Number.isFinite(max)) {
    next = Math.min(max, next);
  }
  return next;
}

export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onValueChange,
  decimals,
  allowEmpty = false,
  treatZeroAsEmpty = false,
  allowNegative = false,
  integer = false,
  min,
  max,
  step,
  showStepper = false,
  onEnter,
  onFocus,
  onBlur,
  onKeyDown,
  ...rest
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const isDirtyRef = useRef<boolean>(false);

  const formatExternal = (val: number | '' | undefined | null): string => {
    if (val === '' || val === undefined || val === null) return '';
    if (typeof val !== 'number' || !Number.isFinite(val)) return '';
    if (treatZeroAsEmpty && val === 0) return '';
    if (typeof decimals === 'number') {
      const rounded = Number(val.toFixed(decimals));
      return Number.isFinite(rounded) ? String(rounded) : '';
    }
    return String(val);
  };

  const commitText = (text: string): number | undefined => {
    const trimmed = text.trim();
    if (
      trimmed === '' ||
      trimmed === '-' ||
      trimmed === '.' ||
      trimmed === '-.'
    ) {
      if (allowEmpty) {
        onValueChange(undefined);
      }
      return undefined;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      if (allowEmpty) {
        onValueChange(undefined);
      }
      return undefined;
    }
    const finalNum = clampAndFormat(parsed, min, max, integer);
    onValueChange(finalNum);
    return finalNum;
  };

  const stepBy = (direction: 1 | -1) => {
    const stepNum = typeof step === 'number'
      ? step
      : typeof step === 'string' && step !== 'any' && Number.isFinite(Number(step))
        ? Number(step)
        : (integer ? 1 : 0.1);
    const currentDraft = draftRef.current;
    const current = currentDraft !== null && currentDraft !== '' && Number.isFinite(Number(currentDraft))
      ? Number(currentDraft)
      : (typeof value === 'number' && Number.isFinite(value) ? value : 0);
    const next = clampAndFormat(current + direction * stepNum, min, max, integer);
    const rounded = Number(next.toFixed(typeof decimals === 'number' ? decimals : 4));
    isDirtyRef.current = true;
    const nextStr = String(rounded);
    if (draftRef.current !== null) {
      draftRef.current = nextStr;
      setDraft(nextStr);
    }
    onValueChange(rounded);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const initial = formatExternal(value);
    draftRef.current = initial;
    isDirtyRef.current = false;
    setDraft(initial);
    onFocus?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = e.target.value.replace(/,/g, '.');
    const pattern = integer
      ? allowNegative
        ? /^-?\d*$/
        : /^\d*$/
      : allowNegative
        ? /^-?\d*\.?\d*$/
        : /^\d*\.?\d*$/;

    if (!pattern.test(normalized)) {
      return;
    }

    isDirtyRef.current = true;
    draftRef.current = normalized;
    setDraft(normalized);

    if (normalized === '') {
      if (allowEmpty) {
        onValueChange(undefined);
      }
      return;
    }

    if (normalized === '-' || normalized === '.' || normalized === '-.') {
      return;
    }

    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      onValueChange(integer ? Math.round(parsed) : parsed);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const currentDraft = draftRef.current;
    if (currentDraft !== null && isDirtyRef.current) {
      commitText(currentDraft);
    }
    draftRef.current = null;
    isDirtyRef.current = false;
    setDraft(null);
    onBlur?.(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onEnter) {
      const currentDraft = draftRef.current;
      const committed = currentDraft !== null
        ? commitText(currentDraft)
        : (typeof value === 'number' ? value : undefined);
      const nextDraft = committed !== undefined ? formatExternal(committed) : null;
      isDirtyRef.current = false;
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      onEnter(committed);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      stepBy(e.key === 'ArrowUp' ? 1 : -1);
    }
    onKeyDown?.(e);
  };

  const inputEl = (
    <input
      {...rest}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      value={draft !== null ? draft : formatExternal(value)}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );

  if (!showStepper) {
    return inputEl;
  }

  return (
    <div className="numeric-stepper-wrap">
      {inputEl}
      <div className="numeric-stepper-btns">
        <button
          type="button"
          className="numeric-stepper-btn"
          tabIndex={-1}
          disabled={rest.disabled || rest.readOnly}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => stepBy(1)}
          aria-label="Incrementar"
        >
          ▲
        </button>
        <button
          type="button"
          className="numeric-stepper-btn"
          tabIndex={-1}
          disabled={rest.disabled || rest.readOnly}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => stepBy(-1)}
          aria-label="Decrementar"
        >
          ▼
        </button>
      </div>
    </div>
  );
};
