import React from 'react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function InputField({
  label,
  error,
  helperText,
  className = '',
  ...props
}: InputFieldProps) {
  return (
    <div className="admin-form-group">
      {label && <label className="admin-form-label">{label}</label>}
      <input
        className={`admin-form-input ${error ? 'admin-input-error' : ''} ${className}`}
        {...props}
      />
      {error && <span className="admin-form-error">{error}</span>}
      {helperText && !error && <span className="admin-form-helper">{helperText}</span>}
    </div>
  );
}

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ label: string; value: string }>;
}

export function SelectField({
  label,
  error,
  options,
  className = '',
  ...props
}: SelectFieldProps) {
  return (
    <div className="admin-form-group">
      {label && <label className="admin-form-label">{label}</label>}
      <select
        className={`admin-form-select ${error ? 'admin-input-error' : ''} ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="admin-form-error">{error}</span>}
    </div>
  );
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search records, providers, accounts...',
  className = '',
}: SearchBarProps) {
  return (
    <div className={`admin-search-container ${className}`}>
      <span className="admin-search-icon" aria-hidden="true" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="admin-search-input"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="admin-search-clear"
          aria-label="Clear search"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  disabled?: boolean;
}

export function Toggle({
  label,
  checked,
  onChange,
  description,
  disabled = false,
}: ToggleProps) {
  return (
    <label className={`admin-toggle-wrapper ${disabled ? 'admin-toggle-disabled' : ''}`}>
      <div className="admin-toggle-switch">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="admin-toggle-slider" />
      </div>
      <div className="admin-toggle-label-box">
        <span className="admin-toggle-label">{label}</span>
        {description && <span className="admin-toggle-desc">{description}</span>}
      </div>
    </label>
  );
}
