import React from 'react';

export type AdminBadgeVariant =
  | 'active'
  | 'healthy'
  | 'success'
  | 'live'
  | 'degraded'
  | 'suspended'
  | 'pending'
  | 'warning'
  | 'gold'
  | 'neutral';

interface BadgeProps {
  label: string;
  variant?: AdminBadgeVariant;
  pulse?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export function Badge({
  label,
  variant = 'neutral',
  pulse = false,
  icon,
  className = '',
}: BadgeProps) {
  const visualVariant = variant === 'success' ? 'healthy' : variant;

  return (
    <span className={`admin-badge admin-badge-${visualVariant} ${className}`}>
      {pulse && <span className="admin-badge-pulse-dot" />}
      {icon && <span className="admin-badge-icon">{icon}</span>}
      <span className="admin-badge-text">{label}</span>
    </span>
  );
}
