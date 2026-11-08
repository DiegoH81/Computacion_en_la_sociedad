interface MarginalNotesButtonProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function MarginalNotesButton({ isOpen, onToggle }: MarginalNotesButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className="rounded-lg border border-white bg-solid-blue px-4 py-1 text-xs font-bold uppercase text-white hover:opacity-90"
    >
      {isOpen ? 'Ocultar notas marginales' : 'Añadir notas marginales'}
    </button>
  );
}
