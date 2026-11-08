import { useRef, useState } from 'react';

/** El botón y el subformulario de notas viven en lugares distintos de la ventana. */
export function useMarginalNotes(initiallyOpen: boolean) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const sectionRef = useRef<HTMLElement>(null);

  function toggle() {
    const opening = !isOpen;
    setIsOpen(opening);
    // Se despliega al final de la ventana: hay que llevar al usuario hasta allí.
    if (opening) requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ block: 'start' }));
  }

  return { isOpen, toggle, sectionRef };
}
