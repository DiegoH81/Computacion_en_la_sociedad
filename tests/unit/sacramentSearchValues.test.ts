import { describe, expect, it } from 'vitest';
import { countAdvanced, describeRange, emptyValues, toSearchFilters } from '../../src/components/features/sacramentSearchValues';

describe('filtros del formulario de sacramentos', () => {
  it('omite vacíos, recorta texto y conserva búsquedas exactas, hasta y entre', () => {
    const values = emptyValues();
    values.texts.nombres = '  Ana María  ';
    values.texts.padre = '   ';
    values.ranges.libro = { de: ' 7 ', a: '' };
    values.ranges.folio = { de: '', a: ' 20 ' };
    values.ranges.fecha_evento = { de: '2020-01-01', a: '2020-12-31' };
    values.estado = 'anulado';
    values.anotaciones = 'sin';
    expect(toSearchFilters(values, 1)).toEqual({
      nombres: 'Ana María', libro: { operador: '=', valor: '7' },
      folio: { operador: 'hasta', valor: '20' },
      fecha_evento: { operador: 'entre', valor: '2020-01-01', hasta: '2020-12-31' },
      estado: 'anulado', con_anotaciones: false,
    });
    expect(countAdvanced(values, 1)).toBe(5);
  });

  it('busca en la parroquia actual salvo selección explícita de otras', () => {
    const values = emptyValues();
    values.chosenParishes = [1, 2];
    expect(toSearchFilters(values, 1)).toEqual({});
    values.otherParishes = true;
    expect(toSearchFilters(values, 1)).toEqual({ parroquias: [1, 2] });
    expect(countAdvanced(values, 1)).toBe(1);
    values.chosenParishes = [1];
    expect(toSearchFilters(values, 1)).toEqual({});
    values.chosenParishes = [];
    expect(toSearchFilters(values, null)).toEqual({});
  });

  it('limpiar crea rangos independientes y elimina todos los filtros', () => {
    const first = emptyValues();
    first.ranges.libro.de = '12';
    first.texts.dni = '12345678';
    const cleared = emptyValues();
    expect(toSearchFilters(cleared, 1)).toEqual({});
    expect(countAdvanced(cleared, 1)).toBe(0);
    expect(first.ranges.folio.de).toBe('');
  });

  it('mantiene el resumen de fechas y números', () => {
    expect(describeRange('Libro', { de: '7', a: '' }, false)).toBe('libro 7');
    expect(describeRange('Fecha', { de: '2020-01-02', a: '' }, true)).toBe('fecha el 02/01/2020');
    expect(describeRange('Fecha', { de: '', a: '2020-01-02' }, true)).toBe('fecha hasta 02/01/2020');
    expect(describeRange('Libro', { de: '', a: '' }, false)).toBeNull();
  });
});
