import { useState } from 'react';
import type { Parish } from '../../../shared/models';
import { FormDialog } from '../ui/FormDialog';
import { FormPanel } from '../ui/FormPanel';
import { Field } from '../ui/Field';
import type { ParishFields } from '../../controllers/ParishController';

interface ParishFormModalProps {
  mode: 'create' | 'edit';
  /** La parroquia que se edita, tal como llegó del Worker. */
  initialValues?: Parish;
  onSave: (parish: ParishFields) => void;
  onCancel: () => void;
  isLoading: boolean;
  errorMessage: string | null;
}

export function ParishFormModal({ mode, initialValues, onSave, onCancel, isLoading, errorMessage }: ParishFormModalProps) {
  const [parish, setParish] = useState<ParishFields>(
    initialValues
      ? { id: initialValues.id, nombre: initialValues.nombre, ubicacion: initialValues.ubicacion }
      : { nombre: '', ubicacion: null },
  );
  const update = (changes: Partial<ParishFields>) => setParish((prev) => ({ ...prev, ...changes }));

  return (
    <FormDialog
      title={mode === 'create' ? 'Añadir nueva parroquia' : 'Editar parroquia'}
      onSave={() => onSave(parish)}
      onCancel={onCancel}
      isLoading={isLoading}
      errorMessage={errorMessage}
      size="small"
    >
      <FormPanel title="Datos de la parroquia">
        <Field variant="panel" label="Nombre" value={parish.nombre} onChange={(v) => update({ nombre: v })} />
        <Field variant="panel" label="Ubicación" value={parish.ubicacion ?? ''} onChange={(v) => update({ ubicacion: v })} />

        {mode === 'edit' && (
          <p className="text-xs text-slate-600">El nuevo nombre llega a las demás PCs en su siguiente sincronización.</p>
        )}
      </FormPanel>
    </FormDialog>
  );
}
