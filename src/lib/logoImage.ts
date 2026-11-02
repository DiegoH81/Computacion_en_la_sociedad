const MAX_SIZE_PX = 500;
// Debe caber en el límite al guardarlo (ver electron/main/services/parishLogo.ts).
const MAX_LENGTH = 400_000;

/** Reduce el archivo a un tamaño razonable. PNG y WEBP conservan el fondo transparente. */
export async function fileToLogoDataUrl(file: File): Promise<string> {
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error('El archivo no es una imagen válida.');
  }

  const scale = Math.min(1, MAX_SIZE_PX / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();

  const png = canvas.toDataURL('image/png');
  if (png.length <= MAX_LENGTH) return png;

  const webp = canvas.toDataURL('image/webp', 0.85);
  if (webp.length <= MAX_LENGTH) return webp;

  throw new Error('La imagen es demasiado pesada. Use una más simple o de menor tamaño.');
}
