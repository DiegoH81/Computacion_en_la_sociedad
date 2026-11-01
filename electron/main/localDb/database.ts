import Database from 'better-sqlite3-multiple-ciphers';
import { LOCAL_MIGRATIONS } from './schema';

export type LocalDatabase = Database.Database;

const HEX_KEY = /^[0-9a-f]{64}$/i;

function migrate(db: LocalDatabase, migrations: readonly string[]): void {
  const current = db.pragma('user_version', { simple: true }) as number;
  if (current > migrations.length) {
    throw new Error(
      `La base local está en la versión ${current} y esta app solo conoce hasta la ${migrations.length}.`,
    );
  }

  migrations.slice(current).forEach((sql, index) => {
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${current + index + 1}`);
    })();
  });
}

export function openLocalDatabase(
  filePath: string,
  hexKey: string,
  migrations: readonly string[] = LOCAL_MIGRATIONS,
): LocalDatabase {
  if (!HEX_KEY.test(hexKey)) {
    throw new Error('La clave de la base local debe tener 32 bytes en hexadecimal.');
  }

  const db = new Database(filePath);
  try {
    db.pragma(`cipher='chacha20'`);
    db.pragma(`hexkey='${hexKey}'`);

    db.prepare('SELECT count(*) FROM sqlite_master').get();

    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    
    db.pragma('synchronous = FULL');

    migrate(db, migrations);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
