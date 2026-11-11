// Downscale photos on the device before upload: keeps detail for jewellery (2000px long edge)
// while turning 5-10 MB camera files into ~400-900 KB JPEGs.
export async function compressImage(file: File, maxEdge = 2000, quality = 0.88): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
  return blob && blob.size < file.size ? blob : file;
}
