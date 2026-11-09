import * as THREE from 'three';
import { loadImage } from './image-assets.ts';

// A scene owns its GPU texture; only the decoded, immutable image is shared.
// Texture transforms and disposal must never affect another open scene.
export function loadArtTexture(
  url: string, onLoad?: (texture: THREE.Texture) => void, onError?: (error: unknown) => void,
): THREE.Texture {
  const texture = new THREE.Texture();
  void loadImage(url).then(image => {
    texture.image = image;
    texture.needsUpdate = true;
    onLoad?.(texture);
  }).catch(error => onError?.(error));
  return texture;
}
