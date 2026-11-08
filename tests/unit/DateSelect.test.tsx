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
  it('el mes espera al año y el día espera al mes', () => {
    const { day, month, year } = renderDate();

    expect(month).toBeDisabled();
    expect(day).toBeDisabled();

    fireEvent.change(year, { target: { value: '2006' } });
    expect(month).toBeEnabled();
    expect(day).toBeDisabled();

    fireEvent.change(month, { target: { value: '02' } });
    expect(day).toBeEnabled();
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

  it('al quitar el año se borran el mes y el día', () => {
    const { onChange, day, month, year } = renderDate('2006-02-14');

    fireEvent.change(year, { target: { value: '' } });

    expect(onChange).toHaveBeenLastCalledWith('');
    expect(month).toHaveValue('');
    expect(day).toHaveValue('');
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
