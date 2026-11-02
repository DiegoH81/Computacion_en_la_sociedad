import { useEffect, useState, type ChangeEvent } from 'react';
import { ApiError } from '../../lib/apiClient';
import { fileToLogoDataUrl } from '../../lib/logoImage';
import { ParishService } from '../../services/ParishService';
import { CrestIcon } from '../ui/MenuIcons';

interface ParishLogoSettingsProps {
  parroquiaId: number | null;
  canEdit: boolean;
}

const BUTTON = 'cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold text-white uppercase hover:opacity-90';

export function ParishLogoSettings({ parroquiaId, canEdit }: ParishLogoSettingsProps) {
  const [logo, setLogo] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (parroquiaId === null) return;
    let isCurrent = true;
    ParishService.getLogo(parroquiaId)
      .then((result) => {
        if (isCurrent) setLogo(result.logo);
      })
      .catch(() => {
        if (isCurrent) setLogo(null);
      });
    return () => {
      isCurrent = false;
    };
  }, [parroquiaId]);

  async function save(next: () => Promise<string | null>) {
    if (parroquiaId === null) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const value = await next();
      await ParishService.saveLogo(parroquiaId, value);
      setLogo(value);
    } catch (error) {
      setErrorMessage(error instanceof ApiError || error instanceof Error ? error.message : 'No se pudo guardar el logo.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) save(() => fileToLogoDataUrl(file));
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-full bg-white p-4 text-icon-button">
        {logo ? (
          <img src={logo} alt="Logo de la parroquia" className="h-full w-full object-contain" />
        ) : (
          <CrestIcon className="h-full w-full" />
        )}
      </div>

      {canEdit && (
        <div className="flex gap-2">
          <label className={`${BUTTON} bg-solid-blue ${isSaving ? 'pointer-events-none opacity-50' : ''}`}>
            {isSaving ? 'Guardando...' : logo ? 'Cambiar logo' : 'Agregar logo'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Archivo del logo"
              onChange={handleFile}
              disabled={isSaving}
              className="sr-only"
            />
          </label>
          {logo && (
            <button type="button" onClick={() => save(async () => null)} disabled={isSaving} className={`${BUTTON} bg-solid-red disabled:opacity-50`}>
              Quitar logo
            </button>
          )}
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="max-w-md text-center text-sm font-medium text-solid-red">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
