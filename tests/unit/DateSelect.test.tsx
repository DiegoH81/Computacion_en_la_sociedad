import { fireEvent, render, screen } from '@testing-library/react';
import { DateSelect } from '../../src/components/ui/DateSelect';
import { formatLongDate } from '../../src/lib/dates';

function renderDate(value = '') {
  const onChange = vi.fn();
  render(<DateSelect value={value} onChange={onChange} ariaLabel="Fecha" />);
  return {
    onChange,
    day: screen.getByLabelText('Fecha: día'),
    month: screen.getByLabelText('Fecha: mes'),
    year: screen.getByLabelText('Fecha: año'),
  };
}

describe('DateSelect', () => {
  it('las tres listas se pueden elegir en cualquier orden (el Tab va de izquierda a derecha)', () => {
    const { onChange, day, month, year } = renderDate();

    expect(day).toBeEnabled();
    expect(month).toBeEnabled();
    expect(year).toBeEnabled();

    fireEvent.change(day, { target: { value: '14' } });
    expect(onChange).toHaveBeenLastCalledWith('?-?-14');
    expect(screen.getByRole('alert')).toHaveTextContent('falta el año');

    fireEvent.change(month, { target: { value: '02' } });
    expect(onChange).toHaveBeenLastCalledWith('?-02-14');

    fireEvent.change(year, { target: { value: '2006' } });
    expect(onChange).toHaveBeenLastCalledWith('2006-02-14');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('avisa si hay día y año pero falta el mes', () => {
    const { onChange, day, year } = renderDate();

    fireEvent.change(year, { target: { value: '2006' } });
    fireEvent.change(day, { target: { value: '05' } });

    expect(onChange).toHaveBeenLastCalledWith('2006-?-05');
    expect(screen.getByRole('alert')).toHaveTextContent('falta el mes');
  });

  it('borra un día que no existe en el mes elegido', () => {
    const { onChange, day, month, year } = renderDate();

    fireEvent.change(day, { target: { value: '31' } });
    fireEvent.change(month, { target: { value: '04' } });
    fireEvent.change(year, { target: { value: '2006' } });

    expect(day).toHaveValue('');
    expect(onChange).toHaveBeenLastCalledWith('2006-04');
  });

  it('guarda solo el año, o el año y el mes, si falta el resto', () => {
    const { onChange, day, month, year } = renderDate();

    fireEvent.change(year, { target: { value: '2006' } });
    expect(onChange).toHaveBeenLastCalledWith('2006');

    fireEvent.change(month, { target: { value: '02' } });
    expect(onChange).toHaveBeenLastCalledWith('2006-02');

    fireEvent.change(day, { target: { value: '14' } });
    expect(onChange).toHaveBeenLastCalledWith('2006-02-14');
  });

  it('al quitar el año quedan el mes y el día, y avisa que falta el año', () => {
    const { onChange, day, month, year } = renderDate('2006-02-14');

    fireEvent.change(year, { target: { value: '' } });

    expect(onChange).toHaveBeenLastCalledWith('?-02-14');
    expect(month).toHaveValue('02');
    expect(day).toHaveValue('14');
    expect(screen.getByRole('alert')).toHaveTextContent('falta el año');
  });

  it('carga una fecha incompleta guardada', () => {
    const { day, month, year } = renderDate('2006-02');

    expect(year).toHaveValue('2006');
    expect(month).toHaveValue('02');
    expect(day).toHaveValue('');
  });
});

describe('formatLongDate', () => {
  it('escribe lo que se sabe de la fecha', () => {
    expect(formatLongDate('1979-02-25')).toBe('25 de febrero de 1979');
    expect(formatLongDate('1979-02')).toBe('febrero de 1979');
    expect(formatLongDate('1979')).toBe('1979');
    expect(formatLongDate('25/02/1979')).toBe('25/02/1979');
  });
});
