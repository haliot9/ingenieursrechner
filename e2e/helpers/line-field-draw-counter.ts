import type { Page } from '@playwright/test'

export interface LineFieldDrawCounterSnapshot {
  readonly count: number
}

interface LineFieldDrawCounterControls {
  snapshot(): LineFieldDrawCounterSnapshot
}

type AuditedWindow = Window & {
  __lineFieldDrawCounter?: LineFieldDrawCounterControls
}

export async function installLineFieldDrawCounter(page: Page) {
  await page.addInitScript(() => {
    const auditedWindow = window as AuditedWindow
    if (auditedWindow.__lineFieldDrawCounter) return

    let count = 0
    const drawMethods = ['drawArrays', 'drawElements'] as const
    const patchPrototype = (prototype: object | null) => {
      if (!prototype) return
      for (const method of drawMethods) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, method)
        if (!descriptor || typeof descriptor.value !== 'function') continue
        const nativeDraw = descriptor.value as (...args: unknown[]) => unknown
        Object.defineProperty(prototype, method, {
          ...descriptor,
          value(this: WebGLRenderingContext | WebGL2RenderingContext, ...args: unknown[]) {
            const canvas = this.canvas
            if (
              canvas instanceof HTMLCanvasElement
              && canvas.parentElement?.matches('.landing-line-field__renderer-host')
            ) {
              count += 1
            }
            return Reflect.apply(nativeDraw, this, args)
          },
        })
      }
    }

    patchPrototype(typeof WebGLRenderingContext === 'undefined'
      ? null
      : WebGLRenderingContext.prototype)
    patchPrototype(typeof WebGL2RenderingContext === 'undefined'
      ? null
      : WebGL2RenderingContext.prototype)

    Object.defineProperty(auditedWindow, '__lineFieldDrawCounter', {
      configurable: false,
      enumerable: false,
      value: Object.freeze({
        snapshot: () => Object.freeze({ count }),
      }),
      writable: false,
    })
  })
}

export async function lineFieldDrawCount(page: Page) {
  return page.evaluate(() => {
    const counter = (window as AuditedWindow).__lineFieldDrawCounter
    if (!counter) throw new Error('Line-field WebGL draw counter was not installed before app code')
    return counter.snapshot().count
  })
}
