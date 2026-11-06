import type { ReactNode } from 'react';

interface InlineFormFieldProps {
  label: string;
  /** Para un control hecho de varios, como la fecha en tres listas (ver StackedFormField). */
  isGroup?: boolean;
  children: ReactNode;
}

/** Rótulo a la izquierda y control a la derecha, para los bloques oscuros de los formularios de partidas. */
export function InlineFormField({ label, isGroup = false, children }: InlineFormFieldProps) {
  const className = 'flex items-center gap-3 text-sm text-white';
  const content = (
    <>
      <span className="shrink-0">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </>
  );

  if (isGroup) {
    return (
      <div role="group" aria-label={label} className={className}>
        {content}
      </div>
    );
  }

  return <label className={className}>{content}</label>;
}
