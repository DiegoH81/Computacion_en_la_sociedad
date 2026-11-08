/**
 * El asterisco de un campo obligatorio. Va oculto para los lectores de pantalla (el campo ya dice
 * aria-required) y así el nombre del campo sigue siendo el mismo, por ejemplo "Nombres".
 */
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-solid-red">
      *
    </span>
  );
}

/** La nota que explica el asterisco, arriba de los formularios. */
export function RequiredNote() {
  return (
    <p className="text-xs text-slate-800">
      Los campos con <span className="font-bold text-solid-red">*</span> son obligatorios.
    </p>
  );
}
