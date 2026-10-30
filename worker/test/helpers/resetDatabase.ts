// Limpia todas las tablas de dominio de la base de test.
//
// ORDEN IMPORTANTE: primero las tablas hijas (las que tienen FK hacia otras)
// y al final las padres. Al agregar una tabla nueva con FKs, se añade AQUÍ
// y ningún archivo de test necesita tocarse.
//
//   cambios_persona                          -> personas, sacramentos, usuarios
//   matrimonios, bautismos, confirmaciones   -> sacramentos, personas
//   sacramentos                              -> parroquias, sacerdotes, usuarios
//   personas                                 -> parroquias
//   *_legacy (modelo antiguo)                -> parroquias, sacerdotes, usuarios
//   sacerdotes, usuarios                     -> parroquias
//   parroquias                               -> raíz
const TABLES_IN_DELETE_ORDER = [
  'cambios_persona',
  'matrimonios',
  'bautismos',
  'confirmaciones',
  'sacramentos',
  'personas',
  'matrimonios_legacy',
  'bautismos_legacy',
  'confirmaciones_legacy',
  'sacerdotes',
  'usuarios',
  'parroquias',
] as const;

export async function resetDatabase(db: D1Database): Promise<void> {
  for (const table of TABLES_IN_DELETE_ORDER) {
    await db.exec(`DELETE FROM ${table}`);
  }
}
