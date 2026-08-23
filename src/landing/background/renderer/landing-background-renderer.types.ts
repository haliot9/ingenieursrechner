export interface LandingBackgroundRenderFrame {
  readonly elapsedSeconds: number
  readonly pointer: readonly [number, number]
}

export interface LandingBackgroundRenderer {
  resize(width: number, height: number, deviceDpr: number): void
  render(frame: LandingBackgroundRenderFrame): void
  dispose(): void
}

export interface LandingBackgroundRendererOptions {
  readonly onContextLost?: () => void
}
