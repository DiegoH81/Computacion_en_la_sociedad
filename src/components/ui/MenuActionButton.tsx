import type { ReactNode } from 'react';

interface MenuActionButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'admin';
}

export function MenuActionButton({
  icon,
  label,
  onClick,
  disabled = false,
  variant = 'default',
}: MenuActionButtonProps) {
  const baseStyles =
    'flex flex-col items-center justify-center gap-2 rounded-lg p-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40';

  const variantStyles =
    variant === 'admin'
      ? 'bg-emerald-900 text-white hover:bg-emerald-800'
      : 'bg-teal-600 text-white hover:bg-teal-500';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles}`}
    >
      <span className="text-2xl" aria-hidden="true">
        {icon}
      </span>
      <span className="text-center leading-tight">{label}</span>
    </button>
  );
}