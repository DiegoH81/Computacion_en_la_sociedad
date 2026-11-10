export type FormKind = 'bautismo' | 'confirmacion' | 'matrimonio';

export type PrintSlot =
  | { kind: 'line'; x: number; y: number; width: number; lines?: number; gap?: number; align?: 'left' | 'center' }
  | { kind: 'box'; x: number; top: number; height: number; width: number; lines?: number; align?: 'left' | 'center' }
  | { kind: 'area'; x: number; top: number; height: number; width: number; fontSize: number };

export interface FormLayout {
  background: string;
  fontSize: number;
  slots: Record<string, PrintSlot>;
}

const line = (x: number, y: number, width: number, extra: Partial<Extract<PrintSlot, { kind: 'line' }>> = {}): PrintSlot => ({ kind: 'line', x, y, width, ...extra });

const NOTES_FONT_SIZE = 8;

const area = (x: number, top: number, bottom: number, width: number): PrintSlot => ({ kind: 'area', x, top, height: bottom - top, width, fontSize: NOTES_FONT_SIZE });

const box = (x: number, top: number, bottom: number, width: number, extra: Partial<Extract<PrintSlot, { kind: 'box' }>> = {}): PrintSlot => ({
  kind: 'box',
  x,
  top,
  height: bottom - top,
  width,
  ...extra,
});

const BAPTISM_DATE_Y = 175.3;
const CONFIRMATION_DATE_Y = 173.3;
const MARRIAGE_DATE_Y = 244.1;

export const FORM_LAYOUTS: Record<FormKind, FormLayout> = {
  bautismo: {
    background: './formatos/bautismo.jpg',
    fontSize: 10,
    slots: {
      parroquia: line(96, 53.2, 75),
      libro: line(24.5, 75.2, 45, { align: 'center' }),
      folio: line(25, 83.7, 44, { align: 'center' }),
      numero: line(30.5, 91.8, 38.5, { align: 'center' }),
      anotaciones: area(16.3, 122.5, 211, 53),
      nombres: line(92.5, 86.6, 100.5),
      apellidos: line(92.5, 94.3, 100.5),
      padre: line(87.5, 102.0, 105.5),
      madre: line(88, 109.7, 104.5),
      lugar_nacimiento: line(110, 117.4, 82),
      fecha_nacimiento: line(111, 125.0, 81),
      fecha_sacramento: line(108.5, 132.7, 84),
      celebrante: line(95.5, 140.4, 96.5),
      padrino: line(90, 148.1, 101.5),
      madrina: line(90.5, 155.8, 101),
      dia: line(103, BAPTISM_DATE_Y, 31, { align: 'center' }),
      mes: line(139, BAPTISM_DATE_Y, 34, { align: 'center' }),
      anio: line(181, BAPTISM_DATE_Y, 10.5),
    },
  },

  confirmacion: {
    background: './formatos/confirmacion.jpg',
    fontSize: 10,
    slots: {
      parroquia: line(93, 56.8, 98),
      libro: line(22, 79.4, 43.5, { align: 'center' }),
      folio: line(22, 87.1, 44.5, { align: 'center' }),
      numero: line(27, 94.9, 39.5, { align: 'center' }),
      anotaciones: area(12.3, 126.5, 211, 53.5),
      nombres: line(90, 93.9, 98),
      apellidos: line(90, 101.6, 98),
      padre: line(84.5, 109.2, 103.5),
      madre: line(85, 116.9, 102.5),
      fecha_sacramento: line(114, 124.5, 73.5),
      celebrante: line(93, 132.0, 95),
      padrino: line(87.5, 139.6, 100.5),
      madrina: line(88, 147.2, 100.5),
      dia: line(123.5, CONFIRMATION_DATE_Y, 10.5, { align: 'center' }),
      mes: line(138.5, CONFIRMATION_DATE_Y, 33.5, { align: 'center' }),
      anio: line(182.2, CONFIRMATION_DATE_Y, 9),
    },
  },


  matrimonio: {
    background: './formatos/matrimonio.jpg',
    fontSize: 9,
    slots: {
      parroquia: line(85, 42.3, 95),
      libro: line(69.5, 51.5, 26, { align: 'center' }),
      folio: line(106.5, 51.5, 28, { align: 'center' }),
      numero: line(150.5, 51.5, 29.5, { align: 'center' }),

      esposo_apellidos: box(12, 78.4, 87.5, 69, { align: 'center' }),
      esposo_nombres: box(12, 87.5, 96.5, 69, { align: 'center' }),
      esposo_lugar_nacimiento: box(12, 96.5, 105.5, 69, { align: 'center' }),
      esposo_fecha_nacimiento: box(12, 105.5, 114.6, 69, { align: 'center' }),
      esposo_dni: box(12, 114.6, 123.7, 69, { align: 'center' }),
      esposo_parroquia_bautismo: box(12, 123.7, 132.8, 69, { align: 'center' }),
      esposo_fecha_bautismo: box(12, 132.8, 141.9, 69, { align: 'center' }),
      esposo_padre: box(12, 141.9, 150.9, 69, { align: 'center' }),
      esposo_madre: box(12, 150.9, 160.0, 69, { align: 'center' }),

      esposa_apellidos: box(124.4, 77.4, 86.5, 70, { align: 'center' }),
      esposa_nombres: box(124.4, 86.5, 95.5, 70, { align: 'center' }),
      esposa_lugar_nacimiento: box(124.4, 95.5, 104.5, 70, { align: 'center' }),
      esposa_fecha_nacimiento: box(124.4, 104.5, 113.6, 70, { align: 'center' }),
      esposa_dni: box(124.4, 113.6, 122.8, 70, { align: 'center' }),
      esposa_parroquia_bautismo: box(124.4, 122.8, 131.8, 70, { align: 'center' }),
      esposa_fecha_bautismo: box(124.4, 131.8, 140.8, 70, { align: 'center' }),
      esposa_padre: box(124.4, 140.8, 149.9, 70, { align: 'center' }),
      esposa_madre: box(124.4, 149.9, 159.0, 70, { align: 'center' }),

      fecha_matrimonio: box(47.5, 174.3, 183.5, 54.5),
      celebrante: box(44.5, 183.5, 192.6, 57.5),
      lugar: line(47.5, 198.5, 54.5, { lines: 2, gap: 5 }),
      // Padrinos queda vacío: los cuatro testigos van en "Testigos".
      testigos: line(27, 225.6, 75, { lines: 2, gap: 5.2 }),
      // Toda la casilla de las anotaciones, debajo de su rótulo.
      anotaciones: area(105.5, 182, 232, 89),

      dia: line(128, MARRIAGE_DATE_Y, 15.5, { align: 'center' }),
      mes: line(148, MARRIAGE_DATE_Y, 29, { align: 'center' }),
      anio: line(186.5, MARRIAGE_DATE_Y, 9.5),
    },
  },
};
