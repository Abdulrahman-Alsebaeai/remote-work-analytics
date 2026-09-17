"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { Icon } from "./icons";
import "./modal-dialog.css";

type ModalDialogProps = {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  description?: string;
  closeLabel: string;
  children: ReactNode;
  className?: string;
};

export function ModalDialog({
  open,
  onClose,
  eyebrow,
  title,
  description,
  closeLabel,
  children,
  className = "",
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`app-dialog ${className}`.trim()}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="app-dialog-frame">
        <header className="app-dialog-head">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            type="button"
            className="app-dialog-close"
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
          >
            <Icon name="close" size={19} />
          </button>
        </header>
        <div className="app-dialog-content">{children}</div>
      </div>
    </dialog>
  );
}
