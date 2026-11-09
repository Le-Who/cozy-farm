// Keep decoded source images across scene visits, without retaining every large
// kitchen and island image for the lifetime of the page. Live scenes own their
// own references; evicting a source here does not invalidate an active texture.
const decodedImageBudget = 64 * 1024 * 1024;
const images = new Map<string, { promise: Promise<HTMLImageElement>; bytes: number }>();
let decodedBytes = 0;

export function loadImage(url: string): Promise<HTMLImageElement> {
  const key = new URL(url, document.baseURI).href;
  const cached = images.get(key);
  if (cached) {
    images.delete(key);
    images.set(key, cached);
    return cached.promise;
  }
  const image = new Image();
  image.decoding = 'async';
  const entry = {
    promise: Promise.resolve(image),
    bytes: 0,
  };
  entry.promise = new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => { image.onload = image.onerror = null; resolve(image); };
    image.onerror = () => { image.onload = image.onerror = null; reject(new Error(`Image failed to load: ${url}`)); };
    image.src = url;
  }).then(async loaded => {
    await loaded.decode();
    entry.bytes = loaded.naturalWidth * loaded.naturalHeight * 4;
    decodedBytes += entry.bytes;
    for (const [key, source] of images) {
      if (decodedBytes <= decodedImageBudget) break;
      if (!source.bytes) continue;
      images.delete(key);
      decodedBytes -= source.bytes;
    }
    return loaded;
  }).catch(error => {
    images.delete(key);
    throw error;
  });
  images.set(key, entry);
  return entry.promise;
}
