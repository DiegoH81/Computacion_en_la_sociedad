import { useState, type FocusEvent, type PointerEvent } from 'react';

export interface TooltipContent {
  title: string;
  rows: { label: string; value: number | string; color?: string }[];
}

export interface TooltipState extends TooltipContent {
  x: number;
  y: number;
}

/** Un mismo aviso para el ratón y el teclado: lo que se ve al pasar también se ve al tabular. */
export function useChartTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  function bind(content: TooltipContent) {
    return {
      onPointerEnter: (event: PointerEvent) => setTooltip({ ...content, x: event.clientX, y: event.clientY }),
      onPointerMove: (event: PointerEvent) => setTooltip({ ...content, x: event.clientX, y: event.clientY }),
      onPointerLeave: () => setTooltip(null),
      onFocus: (event: FocusEvent<Element>) => {
        const box = event.currentTarget.getBoundingClientRect();
        setTooltip({ ...content, x: box.left + box.width / 2, y: box.top });
      },
      onBlur: () => setTooltip(null),
    };
  }

  return { tooltip, bind };
}
