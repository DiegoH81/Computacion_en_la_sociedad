import { useEffect, useState } from 'react';
import { DuplicateService, type DuplicatePerson, type DuplicateResult, type DuplicateSacrament } from '../../services/DuplicateService';

const WAIT_AFTER_TYPING_MS = 400;
const NO_RESULT: DuplicateResult = { matches: [], total: 0 };

/** Revisa si las personas del formulario ya tienen este sacramento, cuando se deja de escribir. */
export function useDuplicateCheck(
  tipo: DuplicateSacrament,
  excludeId: number | undefined,
  personas: DuplicatePerson[],
): DuplicateResult {
  const [result, setResult] = useState<DuplicateResult>(NO_RESULT);
  const personasKey = JSON.stringify(personas);

  useEffect(() => {
    let isCurrent = true;
    const timer = setTimeout(() => {
      DuplicateService.find(tipo, excludeId, JSON.parse(personasKey) as DuplicatePerson[])
        .then((found) => {
          if (isCurrent) setResult(found);
        })
        // Es solo un aviso: si la revisión falla, no debe impedir llenar el formulario.
        .catch(() => {
          if (isCurrent) setResult(NO_RESULT);
        });
    }, WAIT_AFTER_TYPING_MS);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [tipo, excludeId, personasKey]);

  return result;
}
