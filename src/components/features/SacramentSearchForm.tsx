import { useId, useState, type FormEvent } from 'react';
import { NUMBER_ROWS, DATE_ROWS, emptyValues, countAdvanced, chosenParishIds, describeRange, toSearchFilters, type SacramentSearchValues, type SearchParish, type FormValues, type TextKey, type RangeKey, type RangeValue } from './sacramentSearchValues';

export type { SacramentSearchValues, SearchParish } from './sacramentSearchValues';

// La búsqueda de partidas: los tres campos de nombre, y una búsqueda avanzada que se despliega con:
//   - Dónde buscar: la parroquia que se está viendo, o también otras (se marcan en una lista).
//   - Libro, folio, registro y fechas en dos columnas, "de" y "a": si se llena solo "de", se busca
//     ese valor exacto; si se llenan los dos, el rango; si se llena solo "a", hasta ese valor.
//   - Celebrante, padres, DNI, padrinos, estado y anotaciones.
// Todos los filtros que se llenan se suman (la partida debe cumplirlos todos). Debajo, una frase
// dice en palabras qué se va a buscar.

const SEARCH_BUTTON = 'rounded-lg px-6 py-2 text-base font-bold text-white uppercase hover:opacity-90 disabled:opacity-50';
const INPUT = 'w-full rounded-lg bg-white px-3 py-2 text-base text-black outline-none focus:ring-2 focus:ring-darker-app';
const LABEL = 'mb-1 block text-sm font-bold text-black uppercase';
const SECTION_TITLE = 'mb-2 text-sm font-bold tracking-wide text-dark-app uppercase';
const HINT = 'mt-1 text-sm text-slate-600';

interface SacramentSearchFormProps {
  isLoading: boolean;
  /** "Padrino o madrina" (bautismo, confirmación) o "Testigo" (matrimonio). */
  godparentLabel: string;
  /** Todas las parroquias, para buscar también en otras. */
  parishes: SearchParish[];
  /** La parroquia que se está viendo: la búsqueda normal es solo en ella. */
  currentParishId: number | null;
  onSearch: (filters: SacramentSearchValues) => void;
  onClear: () => void;
}

export function SacramentSearchForm({ isLoading, godparentLabel, parishes, currentParishId, onSearch, onClear }: SacramentSearchFormProps) {
  const fieldId = useId();
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const advancedCount = countAdvanced(values, currentParishId);
  const currentParishName = parishes.find((parish) => parish.id === currentParishId)?.nombre ?? 'la parroquia actual';
  const allChosen = parishes.length > 0 && parishes.every((parish) => values.chosenParishes.includes(parish.id));

  function setText(key: TextKey, value: string) {
    setValues((previous) => ({ ...previous, texts: { ...previous.texts, [key]: value } }));
  }

  function setRange(key: RangeKey, side: keyof RangeValue, value: string) {
    setValues((previous) => ({ ...previous, ranges: { ...previous.ranges, [key]: { ...previous.ranges[key], [side]: value } } }));
  }

  /** Al marcar "otras parroquias" se empieza con la actual ya marcada. */
  function toggleOtherParishes(checked: boolean) {
    const onlyCurrent = currentParishId === null ? [] : [currentParishId];
    setValues((previous) => ({ ...previous, otherParishes: checked, chosenParishes: onlyCurrent }));
  }

  function toggleParish(parishId: number) {
    setValues((previous) => {
      const isChosen = previous.chosenParishes.includes(parishId);
      const chosen = isChosen ? previous.chosenParishes.filter((id) => id !== parishId) : [...previous.chosenParishes, parishId];
      return { ...previous, chosenParishes: chosen };
    });
  }

  /** Un solo botón: marca todas; si ya están todas, vuelve a dejar solo la actual. */
  function toggleAllParishes() {
    const onlyCurrent = currentParishId === null ? [] : [currentParishId];
    const chosen = allChosen ? onlyCurrent : parishes.map((parish) => parish.id);
    setValues((previous) => ({ ...previous, chosenParishes: chosen }));
  }

  function describeSearch(): string {
    const parts: string[] = [];

    const fullName = [values.texts.nombres, values.texts.apellido_paterno, values.texts.apellido_materno].map((text) => text.trim()).filter(Boolean).join(' ');
    if (fullName) parts.push(`a nombre de ${fullName}`);

    for (const row of NUMBER_ROWS) parts.push(describeRange(row.label, values.ranges[row.key], false) ?? '');
    for (const row of DATE_ROWS) parts.push(describeRange(row.label, values.ranges[row.key], true) ?? '');

    let where = `solo en ${currentParishName}`;
    const ids = chosenParishIds(values, currentParishId);
    // Sin ninguna marcada se busca en la actual, como si la casilla no estuviera marcada.
    if (allChosen && ids.length > 0) where = 'en todas las parroquias';
    else if (ids.length > 0) where = 'en ' + parishes.filter((parish) => ids.includes(parish.id)).map((parish) => parish.nombre).join(', ');

    const filled = parts.filter(Boolean);
    if (filled.length === 0) return `Se buscarán todas las partidas ${where}.`;
    return `Se buscarán partidas ${where}, con ${filled.join(', ')}.`;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSearch(toSearchFilters(values, currentParishId));
  }

  function handleClear() {
    setValues(emptyValues());
    onClear();
  }

  function textField(key: TextKey, label: string) {
    return (
      <div key={key}>
        <label htmlFor={`${fieldId}-${key}`} className={LABEL}>
          {label}
        </label>
        <input id={`${fieldId}-${key}`} type="text" value={values.texts[key]} onChange={(e) => setText(key, e.target.value)} className={INPUT} />
      </div>
    );
  }

  /** Una fila: etiqueta, "de" y "a". */
  function rangeRow(key: RangeKey, label: string, isDate: boolean, example?: string) {
    const range = values.ranges[key];
    const type = isDate ? 'date' : 'text';

    return (
      <div key={key} className="contents">
        <label htmlFor={`${fieldId}-${key}-de`} className="text-sm font-bold text-black uppercase">
          {label}
        </label>
        <input
          id={`${fieldId}-${key}-de`}
          type={type}
          placeholder={example}
          value={range.de}
          onChange={(e) => setRange(key, 'de', e.target.value)}
          className={INPUT}
        />
        <span className="text-sm text-slate-600">a</span>
        <input
          id={`${fieldId}-${key}-a`}
          type={type}
          aria-label={`${label}: a`}
          value={range.a}
          onChange={(e) => setRange(key, 'a', e.target.value)}
          className={INPUT}
        />
      </div>
    );
  }

  function rangeHeader() {
    return (
      <>
        <span />
        <span className="text-xs tracking-wide text-slate-600 uppercase">de</span>
        <span />
        <span className="text-xs tracking-wide text-slate-600 uppercase">a</span>
      </>
    );
  }

  const RANGE_GRID = 'grid grid-cols-[12rem_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2';

  return (
    <form onSubmit={handleSubmit} className="col-start-1 rounded-2xl bg-lighter-green p-4">
      <div className="grid grid-cols-3 gap-4">
        {textField('nombres', 'Nombres completos')}
        {textField('apellido_paterno', 'Apellido paterno')}
        {textField('apellido_materno', 'Apellido materno')}
      </div>

      {isAdvancedOpen && (
        <fieldset className="mt-4 flex flex-col gap-5 border-t border-black/20 pt-4">
          <legend className="sr-only">Búsqueda avanzada</legend>

          <div>
            <p className={SECTION_TITLE}>¿Dónde buscar?</p>
            <label className="flex cursor-pointer items-center gap-2 font-bold text-black">
              <input
                type="checkbox"
                checked={values.otherParishes}
                onChange={(e) => toggleOtherParishes(e.target.checked)}
                className="h-5 w-5 accent-darker-app"
              />
              Buscar también en otras parroquias
            </label>

            {values.otherParishes ? (
              <div className="mt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={toggleAllParishes}
                  className="self-start rounded-full border border-darker-app bg-white px-3 py-1 text-sm font-bold text-dark-app hover:bg-lighter-green"
                >
                  {allChosen ? 'Desmarcar todas' : 'Marcar todas'}
                </button>
                <div className="grid max-h-44 grid-cols-2 gap-x-4 gap-y-1 overflow-auto rounded-lg bg-white p-3">
                  {parishes.map((parish) => (
                    <label key={parish.id} className="flex cursor-pointer items-center gap-2 text-sm text-black">
                      <input
                        type="checkbox"
                        checked={values.chosenParishes.includes(parish.id)}
                        onChange={() => toggleParish(parish.id)}
                        className="h-4 w-4 accent-darker-app"
                      />
                      {parish.nombre}
                      {parish.id === currentParishId && <span className="text-xs font-bold text-darker-app">actual</span>}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <p className={HINT}>Ahora se busca solo en {currentParishName}.</p>
            )}
          </div>

          <div>
            <p className={SECTION_TITLE}>Ubicación en el libro</p>
            <div className={RANGE_GRID}>
              {rangeHeader()}
              {NUMBER_ROWS.map((row) => rangeRow(row.key, row.label, false, row.example))}
            </div>
            <p className={HINT}>Para buscar uno solo, llene solo “de”. Para un rango, llene los dos.</p>
          </div>

          <div>
            <p className={SECTION_TITLE}>Fechas</p>
            <div className={RANGE_GRID}>
              {rangeHeader()}
              {DATE_ROWS.map((row) => rangeRow(row.key, row.label, true))}
            </div>
            <p className={HINT}>Solo “de”: ese día. Solo “a”: hasta ese día. Los dos: entre esas fechas.</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {textField('celebrante', 'Celebrante')}
            {textField('padre', 'Padre')}
            {textField('madre', 'Madre')}
            {textField('dni', 'DNI')}
            {textField('padrino', godparentLabel)}
            <div>
              <label htmlFor={`${fieldId}-estado`} className={LABEL}>
                Estado
              </label>
              <select id={`${fieldId}-estado`} value={values.estado} onChange={(e) => setValues((previous) => ({ ...previous, estado: e.target.value }))} className={INPUT}>
                <option value="">Todas</option>
                <option value="vigente">Vigentes</option>
                <option value="anulado">Anuladas</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${fieldId}-anotaciones`} className={LABEL}>
                Anotación marginal
              </label>
              <select
                id={`${fieldId}-anotaciones`}
                value={values.anotaciones}
                onChange={(e) => setValues((previous) => ({ ...previous, anotaciones: e.target.value }))}
                className={INPUT}
              >
                <option value="">Todas</option>
                <option value="con">Con anotación</option>
                <option value="sin">Sin anotación</option>
              </select>
            </div>
          </div>

          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" aria-live="polite">
            {describeSearch()}
          </p>
        </fieldset>
      )}

      <div className="mt-3 flex items-end justify-end gap-2">
        <button
          type="button"
          onClick={() => setIsAdvancedOpen((open) => !open)}
          aria-expanded={isAdvancedOpen}
          className="mr-auto rounded-lg bg-white px-4 py-2 text-sm font-bold text-black uppercase hover:opacity-90"
        >
          {isAdvancedOpen ? '▴ Ocultar búsqueda avanzada' : '▾ Búsqueda avanzada'}
          {!isAdvancedOpen && advancedCount > 0 && ` (${advancedCount})`}
        </button>
        <button type="submit" disabled={isLoading} className={`${SEARCH_BUTTON} bg-solid-blue`}>
          Buscar
        </button>
        <button type="button" onClick={handleClear} disabled={isLoading} className={`${SEARCH_BUTTON} bg-solid-red`}>
          Limpiar búsqueda
        </button>
      </div>
    </form>
  );
}
