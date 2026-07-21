import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  error,
  label,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-semibold text-[var(--color-text-secondary)] font-sans"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`w-full min-h-[44px] px-3 py-2 bg-[var(--color-bg-primary)] border ${error ? 'border-[var(--color-error)]' : 'border-[var(--color-text-muted)]'} rounded-md text-[var(--color-text-primary)] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] focus:ring-offset-2 transition-all duration-150 ${className}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error && (
        <span
          id={`${inputId}-error`}
          className="text-xs text-[var(--color-state-error)] font-sans mt-0.5"
        >
          {error}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
