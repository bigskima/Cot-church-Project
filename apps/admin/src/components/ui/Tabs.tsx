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
  ariaLabel?: string;
}

export function Tabs({ tabs, activeKey, onChange, className = '', ariaLabel = 'Section navigation' }: TabsProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;

    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    if (!nextTab) return;

    onChange(nextTab.key);
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      .item(nextIndex)
      ?.focus();
  };

  return (
    <div className={`admin-tabs-nav ${className}`} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab, index) => {
        const isActive = activeKey === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`admin-tab-btn ${isActive ? 'admin-tab-active' : ''}`}
          >
            {tab.icon && <span className="admin-tab-icon" aria-hidden="true">{tab.icon}</span>}
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
