import { expect, type Locator, type Page } from '@playwright/test';

// Ayudas para llenar los formularios de partidas en las pruebas E2E.

/** Un campo por su rótulo. El asterisco de obligatorio no forma parte del nombre. */
export const field = (window: Page, label: string) => window.getByLabel(label, { exact: true }).last();

async function fillIfEmpty(locator: Locator, value: string): Promise<void> {
  if ((await locator.inputValue()) === '') await locator.fill(value);
}

// La fecha de nacimiento: si no se eligió ninguna, se escribe una aproximada.
async function completeBirth(dialog: Locator, suffix: string): Promise<void> {
  const approximate = dialog.getByRole('textbox', { name: `Fecha aproximada${suffix}`, exact: true });
  if ((await approximate.count()) > 0) {
    await fillIfEmpty(approximate, '30 años');
    return;
  }

  const year = dialog.getByRole('combobox', { name: `Fecha de nacimiento${suffix}: año` });
  if ((await year.inputValue()) !== '') return;

  await dialog.getByRole('checkbox', { name: `Prefiere fecha aproximada${suffix}`, exact: true }).check();
  await approximate.fill('30 años');
}

async function completePerson(dialog: Locator, suffix: string): Promise<void> {
  const values: [string, string][] = [
    ['Apellido paterno', 'Prueba'],
    ['Apellido materno', 'Prueba'],
    ['Lugar de nacimiento', 'Juli'],
    ['Padre', 'Pedro Prueba'],
    ['Madre', 'María Prueba'],
  ];
  for (const [label, value] of values) await fillIfEmpty(dialog.getByLabel(`${label}${suffix}`, { exact: true }).last(), value);
  await completeBirth(dialog, suffix);
}

/**
 * Completa los datos obligatorios que la prueba no llenó (todos los de la persona menos el DNI, y el
 * celebrante): así cada prueba escribe solo lo que le importa. El celebrante es Braulio Guido, de Parroquia 1.
 */
export async function completeRequired(window: Page): Promise<void> {
  const dialog = window.getByRole('dialog', { name: /partida/i }).last();

  if ((await dialog.getByRole('textbox', { name: 'Nombres del esposo' }).count()) > 0) {
    await completePerson(dialog, ' del esposo');
    await completePerson(dialog, ' de la esposa');
  } else {
    await completePerson(dialog, '');
  }

  const celebrant = dialog.getByPlaceholder('Buscar celebrante...');
  if ((await celebrant.inputValue()) === '') {
    await celebrant.fill('Braulio');
    await window.getByRole('button', { name: /Braulio Guido/ }).click();
    await expect(celebrant).toHaveValue(/Braulio Guido/);
  }
}

/** Completa lo obligatorio, guarda y espera que se cierre el formulario. */
export async function saveRecord(window: Page): Promise<void> {
  await completeRequired(window);
  await window.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(window.getByRole('button', { name: 'Guardar cambios' })).toBeHidden();
}

/** Elige el año en estadísticas: con un botón, o en "Otro año" si es de los más viejos. */
export async function chooseYear(window: Page, year: number | string): Promise<void> {
  const group = window.getByRole('group', { name: 'Año' });
  await expect(group).toBeVisible();
  const button = group.getByRole('button', { name: String(year), exact: true });
  if ((await button.count()) > 0) {
    await button.click();
    return;
  }
  await window.getByRole('combobox', { name: 'Otro año' }).selectOption(String(year));
}
