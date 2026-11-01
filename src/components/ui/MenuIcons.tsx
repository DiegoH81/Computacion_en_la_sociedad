interface IconProps {
  className?: string;
}

const lineProps = {
  viewBox: '0 0 64 64',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

export function ParishIcon({ className }: IconProps) {
  return (
    <svg {...lineProps} className={className}>
      <path d="M32 3C20 3 11 12 11 24c0 15 21 37 21 37s21-22 21-37C53 12 44 3 32 3z" />
      <path d="M32 10v6M29 13h6" />
      <path d="M23 35V25l9-7 9 7v10z" />
      <path d="M29 35v-6h6v6" />
    </svg>
  );
}

export function BaptismIcon({ className }: IconProps) {
  return (
    <svg {...lineProps} className={className}>
      <path d="M6 24h34c0 13-7 21-17 21S6 37 6 24z" />
      <path d="M23 45v9M13 58h20M16 54h14" />
      <path d="M51 6v30M43 15h16" />
    </svg>
  );
}

export function ConfirmationIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M32 3l-7 18h14z" />
      <ellipse cx="32" cy="32" rx="7" ry="13" />
      <circle cx="32" cy="48" r="5.5" />
      <path d="M29 52h6l-3 7z" />
      <path d="M27 25C20 16 11 13 3 15c1 11 10 22 24 23z" />
      <path d="M37 25C44 16 53 13 61 15c-1 11-10 22-24 23z" />
    </svg>
  );
}

export function MarriageIcon({ className }: IconProps) {
  return (
    <svg {...lineProps} className={className}>
      <circle cx="23" cy="39" r="17" />
      <circle cx="41" cy="39" r="17" />
      <path d="M36 15l5 6 5-6-2-5h-6z" />
    </svg>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" aria-hidden="true" className={className}>
      <circle cx="32" cy="32" r="16" strokeWidth="10" />
      <circle cx="32" cy="32" r="24" strokeWidth="9" strokeDasharray="9.5 9.35" />
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <circle cx="32" cy="32" r="31" fill="currentColor" />
      <circle cx="32" cy="24" r="10" fill="none" stroke="white" strokeWidth="4" />
      <path d="M13 53c3-11 10-16 19-16s16 5 19 16" fill="none" stroke="white" strokeWidth="4" />
    </svg>
  );
}
