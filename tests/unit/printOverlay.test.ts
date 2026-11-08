// @vitest-environment node
// Imprimir sobre los formatos de la prelatura: qué dato va en cada lugar y el ajuste de la impresora.
import { beforeEach, describe, expect, it } from 'vitest';
import { loadPrintAdjustment, savePrintAdjustment } from '../../src/lib/printAdjustment';
import { baptismPrintValues, marriagePrintValues, printDateParts } from '../../src/lib/printFields';
import { FORM_LAYOUTS } from '../../src/lib/printLayouts';
import { baptism, marriage } from './helpers/records';

const TODAY = new Date(2026, 10, 7);

describe('datos para el formato', () => {
  it('la fecha del párroco es la de impresión, con el año en dos cifras', () => {
    expect(printDateParts(TODAY)).toEqual({ dia: '7', mes: 'noviembre', anio: '26' });
  });

  it('bautismo: cada dato tal como está guardado', () => {
    const values = baptismPrintValues(
      baptism('bautismo', {
        sacramento: { libro: '21', folio: '0.1', numero: '336', fecha_evento: '1959-10-11', anotaciones: 'Nota' },
        persona: { nombres: 'Juan', apellido_paterno: 'Quispe', apellido_materno: 'Mamani', fecha_nacimiento: '1959-01-15' },
        padrino_1: 'Dionisio Quispe',
      }),
      TODAY,
    );

    expect(values).toMatchObject({
      libro: '21',
      folio: '0.1',
      numero: '336',
      nombres: 'Juan',
      apellidos: 'Quispe Mamani',
      fecha_nacimiento: '15 de enero de 1959',
      fecha_sacramento: '11 de octubre de 1959',
      padrino: 'Dionisio Quispe',
      madrina: '',
      anotaciones: 'Nota',
      anio: '26',
    });
  });

  it('matrimonio: los cuatro testigos juntos, y sin padrinos', () => {
    const values = marriagePrintValues(
      marriage({
        conyuge_1: { nombres: 'Tomás', apellido_paterno: 'Condori', dni: '45879632' },
        conyuge_2: { nombres: 'Carmen', apellido_paterno: 'Huamán' },
        testigo_1: 'Emilio Paz',
        testigo_2: 'Agustina Ríos',
        testigo_4: 'Adriana Soto',
      }),
      TODAY,
    );

    expect(values).toMatchObject({ esposo_nombres: 'Tomás', esposo_dni: '45879632', esposa_nombres: 'Carmen', testigos: 'Emilio Paz, Agustina Ríos, Adriana Soto' });
    expect(values).not.toHaveProperty('padrinos');
  });
});

describe('posiciones de los formatos', () => {
  it('cada dato tiene su lugar en el formato, y todos los lugares están dentro de la hoja A4', () => {
    const cases = [
      { layout: FORM_LAYOUTS.bautismo, values: baptismPrintValues(baptism('bautismo')) },
      { layout: FORM_LAYOUTS.matrimonio, values: marriagePrintValues(marriage()) },
    ];

    for (const { layout, values } of cases) {
      expect(Object.keys(layout.slots).sort()).toEqual(Object.keys(values).sort());
      for (const slot of Object.values(layout.slots)) {
        const top = slot.kind === 'line' ? slot.y : slot.top;
        expect(slot.x).toBeGreaterThan(0);
        expect(slot.x + slot.width).toBeLessThan(210);
        expect(top).toBeGreaterThan(0);
        expect(top).toBeLessThan(297);
      }
    }

    // La confirmación no lleva el nacimiento.
    const confirmation = Object.keys(baptismPrintValues(baptism('confirmacion'))).filter((key) => !key.endsWith('nacimiento'));
    expect(Object.keys(FORM_LAYOUTS.confirmacion.slots).sort()).toEqual(confirmation.sort());
  });
});

describe('ajuste de la impresora', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    globalThis.localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
    } as Storage;
  });

  it('se guarda en esta PC y no pasa de 20 mm', () => {
    expect(loadPrintAdjustment()).toEqual({ x: 0, y: 0 });
    expect(savePrintAdjustment({ x: 2.5, y: -40 })).toEqual({ x: 2.5, y: -20 });
    expect(loadPrintAdjustment()).toEqual({ x: 2.5, y: -20 });
  });

  it('un valor guardado que no sirve cuenta como sin ajuste', () => {
    storage.set('impresion.ajuste', 'no es JSON');
    expect(loadPrintAdjustment()).toEqual({ x: 0, y: 0 });
  });
});
