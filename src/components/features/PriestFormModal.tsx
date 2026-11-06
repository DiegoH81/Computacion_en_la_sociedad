import { useState } from 'react';
import type { Minister } from '../../../shared/models';
import { emptyMinister } from '../../lib/emptyRecords';
import { FormDialog } from '../ui/FormDialog';
import { FormPanel } from '../ui/FormPanel';
import { Field } from '../ui/Field';

interface PriestFormModalProps {
  mode: 'create' | 'edit';
  /** El ministro que se edita; al crear, se puede traer ya el nombre escrito. */
  initialValues?: Minister;
  onSave: (minister: Minister) => void;
  onCancel: () => void;
  isLoading: boolean;
  errorMessage?: string | null;
}

export function PriestFormModal({
  mode,
  initialValues,
  onSave,
  onCancel,
  isLoading,
  errorMessage,
}: PriestFormModalProps) {
  const [minister, setMinister] = useState<Minister>(initialValues ?? emptyMinister());
  const update = (changes: Partial<Minister>) => setMinister((prev) => ({ ...prev, ...changes }));

  return (
    <FormDialog
      title={mode === 'create' ? 'Añadir nuevo ministro' : 'Editar ministro'}
      onSave={() => onSave(minister)}
      onCancel={onCancel}
      isLoading={isLoading}
      errorMessage={errorMessage}
      size="small"
    >
      <FormPanel title="Datos del ministro">
        <div className="grid grid-cols-2 gap-3">
          <Field variant="panel" label="Título" value={minister.titulo ?? ''} onChange={(v) => update({ titulo: v })} />
          <Field variant="panel" label="Nombre" value={minister.nombre} onChange={(v) => update({ nombre: v })} />
          <Field
            variant="panel"
            label="Apellido paterno"
            value={minister.apellido_paterno}
            onChange={(v) => update({ apellido_paterno: v })}
          />
          <Field
            variant="panel"
            label="Apellido materno"
            value={minister.apellido_materno}
            onChange={(v) => update({ apellido_materno: v })}
          />
        </div>
      </FormPanel>
    </FormDialog>
  );
}
