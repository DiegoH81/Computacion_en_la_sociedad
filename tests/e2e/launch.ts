import { _electron as electron, type ElectronApplication } from '@playwright/test';
import path from 'node:path';

// Las pruebas abren la app compilada (dist-electron). Con la variable PRELATURA_EJECUTABLE abren el
// programa empaquetado por el instalador, por ejemplo:
//   $env:PRELATURA_EJECUTABLE = "release/win-unpacked/Registro Sacramental.exe"; npx playwright test
// La dirección del servidor siempre la pone global-setup.ts (PRELATURA_API_URL): nunca usan el real.
export function launchApp(userData: string, env?: Record<string, string>): Promise<ElectronApplication> {
  const userDataArg = `--user-data-dir=${userData}`;
  const executable = process.env.PRELATURA_EJECUTABLE;

  if (executable) {
    return electron.launch({ executablePath: path.resolve(executable), args: [userDataArg], env });
  }

  return electron.launch({ args: [path.join(process.cwd(), 'dist-electron/index.js'), userDataArg], env });
}
