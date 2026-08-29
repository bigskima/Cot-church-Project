import React from 'react';

interface TabItem {
  key: string;
  label: string;
  count?: number;
  icon?: string;
}

interface TabsProps {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeKey, onChange, className = '' }: TabsProps) {
  return (
    <div className={`admin-tabs-nav ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeKey === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`admin-tab-btn ${isActive ? 'admin-tab-active' : ''}`}
          >
            {tab.icon && <span className="admin-tab-icon">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`admin-tab-count ${isActive ? 'count-active' : ''}`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
