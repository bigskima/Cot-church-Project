import React from 'react';

export type AdminButtonVariant = 'primary' | 'gold' | 'danger' | 'outline' | 'ghost' | 'secondary';
export type AdminButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconRight,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const getVariantClass = () => {
    switch (variant) {
      case 'gold':
        return 'admin-btn-gold';
      case 'danger':
        return 'admin-btn-danger';
      case 'secondary':
        return 'admin-btn-secondary';
      case 'outline':
        return 'admin-btn-outline';
      case 'ghost':
        return 'admin-btn-ghost';
      case 'primary':
      default:
        return 'admin-btn-primary';
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm':
        return 'admin-btn-sm';
      case 'lg':
        return 'admin-btn-lg';
      case 'md':
      default:
        return 'admin-btn-md';
    }
  };

  return (
    <button
      disabled={disabled || loading}
      className={`admin-btn-base ${getVariantClass()} ${getSizeClass()} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="admin-spinner" />
      ) : (
        <>
          {icon && <span className="admin-btn-icon-left">{icon}</span>}
          <span>{children}</span>
          {iconRight && <span className="admin-btn-icon-right">{iconRight}</span>}
        </>
      )}
    </button>
  );
}
