import * as THREE from 'three'
import { createHoneyPlateFilm, onHoneyPlate } from './honey-plate'
import type { HoneyPoint } from './honey-cookery-model'

type Resources = { geometries: Set<THREE.BufferGeometry>; materials: Set<THREE.Material>; textures: Set<THREE.Texture> }
type Rect = { x: number; y: number; width: number; height: number }

/** Retained translucent syrup above the ceramic but below the fruit and its shadows. */
export function createHoneyPlateView(scene: THREE.Scene, ceramic: THREE.Texture, resources: Resources) {
  const film = createHoneyPlateFilm(), data = new Uint8Array(film.size * film.size * 4)
  const texture = new THREE.DataTexture(data, film.size, film.size)
  texture.minFilter = texture.magFilter = THREE.LinearFilter
  resources.textures.add(texture)
  const geometry = new THREE.PlaneGeometry(1, 1)
  resources.geometries.add(geometry)
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    uniforms: { ceramic: { value: ceramic }, coat: { value: texture } },
    vertexShader: `varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 uv0;uniform sampler2D ceramic;uniform sampler2D coat;
      float depth(vec2 uv){return exp(texture2D(coat,uv).r*4.)-1.;}
      void main(){vec2 uv=vec2(uv0.x,1.-uv0.y);float h=depth(uv);if(h<.003)discard;
        vec2 slope=vec2(depth(uv+vec2(.006,0.))-depth(uv-vec2(.006,0.)),depth(uv+vec2(0.,.006))-depth(uv-vec2(0.,.006)));
        vec3 N=normalize(vec3(-slope.x*2.5,slope.y*4.,1.));
        vec3 plate=texture2D(ceramic,uv0+vec2(slope.x,-slope.y)*.0015).rgb;
        vec3 transmitted=plate*exp(-min(h,5.)*vec3(.018,.12,.38));
        float gloss=pow(max(0.,dot(N,normalize(vec3(-.25,.45,1.)))),42.);
        gl_FragColor=vec4(transmitted+vec3(.27,.23,.15)*gloss,1.-exp(-h*8.));
        #include <colorspace_fragment>
      }`,
  })
  resources.materials.add(material)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.z = 2.2; mesh.renderOrder = 2.2; mesh.visible = false; scene.add(mesh)
  let rect: Rect = { x: 0, y: 0, width: 1, height: 1 }, wet = false
  const local = (p: HoneyPoint) => ({ x: (p.x - rect.x) / rect.width, y: (p.y - rect.y) / rect.height })
  const world = (p: HoneyPoint) => ({ x: rect.x + p.x * rect.width, y: rect.y + p.y * rect.height })
  return {
    layout(value: Rect) { rect = value; mesh.position.set(rect.x + rect.width / 2, rect.y + rect.height / 2, 2.2); mesh.scale.set(rect.width, -rect.height, 1) },
    hit(point: HoneyPoint) { return onHoneyPlate(local(point)) },
    paint(from: HoneyPoint, to: HoneyPoint, amount: number, flow: number, occluded: (point: HoneyPoint) => boolean) {
      const accepted = film.deposit(local(from), local(to), amount * 60, flow, p => occluded(world(p)))
      wet ||= accepted > 0
    },
    update(dt: number) {
      if (!wet || !film.step(dt)) return
      for (let i = 0; i < film.height.length; i++) {
        data[i * 4] = Math.min(255, Math.round(Math.log1p(film.height[i]) / 4 * 255))
        data[i * 4 + 3] = 255
      }
      texture.needsUpdate = true; mesh.visible = true
    },
  }
}
