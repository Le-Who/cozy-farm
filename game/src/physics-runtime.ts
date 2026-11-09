type Physics = typeof import('@dimforge/rapier3d-compat')
let runtime: Promise<Physics> | undefined

export function loadPhysics(): Promise<Physics> {
  if (!runtime) runtime = import('@dimforge/rapier3d-compat').then(async module => {
    await module.init()
    return module
  }).catch(error => { runtime = undefined; throw error })
  return runtime
}
