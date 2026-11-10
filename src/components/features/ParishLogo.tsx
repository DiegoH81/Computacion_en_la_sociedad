import { useEffect, useState } from 'react';
import { ParishService } from '../../services/ParishService';
import { useSessionStore } from '../../store/sessionStore';
import { CrestIcon } from '../ui/MenuIcons';

// El logo de la parroquia que se está viendo. Sin logo guardado en esta PC se muestra el escudo.
// Al guardar o quitar un logo se avisa con este evento para que se actualice al momento.
export const LOGO_CHANGED_EVENT = 'parish-logo-changed';

export function ParishLogo({ className }: { className?: string })
{
  const parroquiaActivaId = useSessionStore((state) => state.parroquiaActivaId);
  // El logo que se cargó y de qué parroquia es: al cambiar de parroquia no se muestra el de la anterior.
  const [loaded, setLoaded] = useState<{ parish_id: number; logo: string | null } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() =>
  {
    const on_change = () => setVersion((value) => value + 1);
    window.addEventListener(LOGO_CHANGED_EVENT, on_change);
    return () => window.removeEventListener(LOGO_CHANGED_EVENT, on_change);
  }, []);

  useEffect(() =>
  {
    if (!parroquiaActivaId)
      return;

    let is_current = true;
    ParishService.getLogo(parroquiaActivaId)
      .then((result) =>
      {
        if (is_current) setLoaded({ parish_id: parroquiaActivaId, logo: result.logo });
      })
      .catch(() =>
      {
        if (is_current) setLoaded({ parish_id: parroquiaActivaId, logo: null });
      });
    return () =>
    {
      is_current = false;
    };
  }, [parroquiaActivaId, version]);

  const logo = loaded && loaded.parish_id === parroquiaActivaId ? loaded.logo : null;

  if (logo)
  {
    // Va junto al nombre de la parroquia: es decorativo (alt vacío).
    return <img src={logo} alt="" data-testid="parish-logo" className={`object-contain ${className ?? ''}`} />;
  }
  return <CrestIcon className={className} />;
}
