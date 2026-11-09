type Scene = { destroy(): void }
type Factory<Options> = (host: HTMLElement, options: Options) => Scene

/** Close/back may run while the chunk downloads. Only the current host may mount it. */
export function lazyScene<Options>(load: () => Promise<Factory<Options>>): Factory<Options> {
  let factory: Factory<Options> | undefined
  let pending: Promise<Factory<Options>> | undefined

  return (host, options) => {
    if (factory) return factory(host, options)
    let closed = false
    let scene: Scene | undefined
    const status = document.createElement('div')
    status.className = 'dialog-status'
    status.setAttribute('role', 'status')
    status.textContent = 'Открываем…'
    host.append(status)

    const mount = () => {
      status.textContent = 'Открываем…'
      pending ??= load().then(value => (factory = value)).catch(error => {
        pending = undefined
        throw error
      })
      void pending.then(create => {
        if (closed || !host.isConnected) return
        status.remove()
        scene = create(host, options)
      }).catch(() => {
        if (closed || !host.isConnected) return
        status.textContent = 'Не удалось открыть. '
        const retry = document.createElement('button')
        retry.type = 'button'
        retry.className = 'dialog-button'
        retry.textContent = 'Повторить'
        retry.onclick = mount
        status.append(retry)
        host.append(status)
      })
    }
    mount()
    return { destroy() { closed = true; status.remove(); scene?.destroy() } }
  }
}
