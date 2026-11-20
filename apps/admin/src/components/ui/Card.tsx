import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  glass?: boolean;
}

export function Card({
  title,
  subtitle,
  headerAction,
  children,
  className = '',
  glass = false,
}: CardProps) {
  return (
    <div className={`admin-card ${glass ? 'admin-card-glass' : ''} ${className}`}>
      {(title || subtitle || headerAction) && (
        <div className="admin-card-header">
          <div>
            {title && <h3 className="admin-card-title">{title}</h3>}
            {subtitle && <p className="admin-card-subtitle">{subtitle}</p>}
          </div>
          {headerAction && <div className="admin-card-action">{headerAction}</div>}
        </div>
      )}
      <div className="admin-card-body">{children}</div>
    </div>
  );
}
