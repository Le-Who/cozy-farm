import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createFarm } from '../src/farm.ts'
import { quoteExpedition } from '../src/ferry-expeditions.ts'

// Minimal browser boundary for the mounted shop's public navigation callback.
// Rendering, the click handler and the destination renderer are production code.
class RenderedButton {
  attributes: string
  textContent: string
  constructor(attributes: string, textContent: string) { this.attributes = attributes; this.textContent = textContent }
  disabled = false
  hasAttribute(name: string) { return new RegExp(`(?:^|\\s)${name}(?:\\s|=|$)`).test(this.attributes) }
  closest(selector: string) { return selector === 'button' ? this : null }
}
class SceneHost extends EventTarget {
  innerHTML = ''
  querySelector() { return null }
  querySelectorAll() { return [] }
  contains(button: RenderedButton) { return this.innerHTML.includes(`<button${button.attributes}>${button.textContent}</button>`) }
  button(attribute: string) {
    for (const [, attributes, text] of this.innerHTML.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)) {
      const button = new RenderedButton(attributes, text)
      if (button.hasAttribute(attribute)) return button
    }
  }
  click(button: RenderedButton) {
    const event = new Event('click')
    Object.defineProperty(event, 'target', { value: button })
    this.dispatchEvent(event)
  }
}

test('empty shop names the ferry destination and navigation neither transfers stock nor starts a voyage', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  const previous = new Map<string, PropertyDescriptor | undefined>()
  let scene: { destroy(): void } | undefined
  try {
    const { mountBayShop } = await server.ssrLoadModule('/src/bay-shop.ts')
    const { renderFreightPanel } = await server.ssrLoadModule('/src/bay-freight-ui.ts')
    const document = Object.assign(new EventTarget(), { activeElement: null, hidden: false })
    const globals = { document, HTMLElement: SceneHost, HTMLInputElement: class {},
      matchMedia: () => ({ matches: true }), requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
      ResizeObserver: class { observe() {} disconnect() {} } }
    for (const [name, value] of Object.entries(globals)) {
      previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
      Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
    }
    const farm = createFarm(); farm.boatOwned = true; farm.island = 'village'; farm.coins = 50
    const before = structuredClone(farm), host = new SceneHost()
    let visits = 0, mutations = 0, destination = ''
    scene = mountBayShop(host, {
      state: farm.bayShop, products: () => [], takeStock: () => { mutations++; return false },
      returnStock: () => mutations++, onEarn: () => mutations++, onChange: () => mutations++, onClose: () => {},
      onOpenFreight: () => {
        visits++
        destination = renderFreightPanel(farm.freight, { day: farm.day, coins: farm.coins, boatOwned: true,
          villageBuilt: true, playerPort: farm.island, openedPorts: ['home', 'village'], products: [], carried: {}, icon: () => '' })
      },
    })
    const link = host.button('data-freight')
    assert.ok(link)
    assert.equal(link.textContent, 'К парому')
    assert.equal(visits, 0)
    host.click(link)
    assert.equal(visits, 1)
    assert.match(destination, /aria-label="Торговые экспедиции"/)
    assert.match(destination, /Паром «Ласточка»/)
    assert.doesNotMatch(destination, /data-action="freight-(?:deposit|withdraw)"/)
    assert.equal(mutations, 0)
    assert.deepEqual(farm, before)
    // A money-only purchase remains useful even when all shop products are absent.
    assert.equal(quoteExpedition(farm.freight.expeditions, 'mill-buy',
      { boatOwned: true, bag: {}, coins: farm.coins })?.available, true)
  } finally {
    scene?.destroy()
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else Reflect.deleteProperty(globalThis, name)
    }
    await server.close()
  }
})
