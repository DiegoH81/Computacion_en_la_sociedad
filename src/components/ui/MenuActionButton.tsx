import type { ReactNode } from 'react';

interface MenuActionButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

export function MenuActionButton({ icon, label, onClick }: MenuActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-64 flex-col items-center justify-center gap-4 rounded-lg bg-icon-button p-4 text-xl font-medium text-white shadow-md transition-colors hover:bg-icon-button-light"
    >
      {icon}
      <span className="text-center leading-tight">{label}</span>
    </button>
  );
}
