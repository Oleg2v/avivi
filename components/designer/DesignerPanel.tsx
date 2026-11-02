'use client';
/* Placeholder replaced by the full chat panel below in this build. */
export function DesignerPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true">
      <button type="button" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
