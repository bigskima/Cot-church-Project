import React, { useEffect, useId } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'md',
}: ModalProps) {
  const titleId = useId();
  const subtitleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="admin-modal-overlay" role="presentation">
      <button type="button" className="admin-modal-backdrop" onClick={onClose} aria-label="Close dialog" />
      <section
        className={`admin-modal-dialog admin-modal-${maxWidth}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
      >
        <div className="admin-modal-header">
          <div>
            <h3 id={titleId} className="admin-modal-title">{title}</h3>
            {subtitle ? <p id={subtitleId} className="admin-modal-subtitle">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="admin-modal-close" aria-label="Close dialog">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="admin-modal-body">{children}</div>
        {footer ? <div className="admin-modal-footer">{footer}</div> : null}
      </section>
    </div>
  );
}
