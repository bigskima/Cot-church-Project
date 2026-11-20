import React from 'react';

interface StatWidgetProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  icon?: string;
  variant?: 'default' | 'gold' | 'live' | 'success';
}

export function StatWidget({
  title,
  value,
  subtitle,
  trend,
  icon,
  variant = 'default',
}: StatWidgetProps) {
  return (
    <div className={`admin-stat-card admin-stat-${variant}`}>
      <div className="admin-stat-header">
        <span className="admin-stat-title">{title}</span>
        {icon && <span className="admin-stat-icon">{icon}</span>}
      </div>
      <div className="admin-stat-value-row">
        <span className="admin-stat-value">{value}</span>
        {trend && (
          <span
            className={`admin-stat-trend ${
              trend.isPositive ? 'trend-positive' : 'trend-negative'
            }`}
          >
            {trend.isPositive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
      {subtitle && <p className="admin-stat-subtitle">{subtitle}</p>}
    </div>
  );
}
