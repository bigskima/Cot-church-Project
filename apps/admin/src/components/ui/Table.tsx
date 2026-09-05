import React from 'react';

export interface Column<T> {
  header: string;
  accessor?: keyof T | ((item: T) => React.ReactNode);
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyMessage = 'No records found in this view.',
  onRowClick,
}: TableProps<T>) {
  if (loading) {
    return (
      <div className="admin-table-loading">
        <span className="admin-spinner" />
        <p>Loading records...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="admin-table-empty">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} className={col.className}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              onClick={() => onRowClick?.(item)}
              onKeyDown={(event) => {
                if (!onRowClick) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onRowClick(item);
                }
              }}
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? 'button' : undefined}
              className={onRowClick ? 'admin-table-row-clickable' : ''}
            >
              {columns.map((col, idx) => {
                let content: React.ReactNode = null;
                if (typeof col.accessor === 'function') {
                  content = col.accessor(item);
                } else if (col.accessor) {
                  content = (item[col.accessor] as unknown) as React.ReactNode;
                }
                return (
                  <td key={idx} className={col.className}>
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
