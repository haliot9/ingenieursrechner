export type AnimatedContentDirection = 'vertical' | 'horizontal'
export type AnimatedContentEntryEase = 'power3.out' | 'bounce.out'
export type AnimatedContentDisappearEase = 'power3.in'

export interface AnimatedContentMotionProfile {
  readonly distance: number
  readonly direction: AnimatedContentDirection
  readonly reverse: boolean
  readonly duration: number
  readonly ease: AnimatedContentEntryEase
  readonly initialOpacity: number
  readonly animateOpacity: boolean
  readonly scale: number
  readonly delay: number
  readonly disappearDuration: number
  readonly disappearEase: AnimatedContentDisappearEase
}

export interface ElasticMenuChainConfig {
  readonly profiles: {
    readonly lead: AnimatedContentMotionProfile & { readonly ease: 'power3.out' }
    readonly follower: AnimatedContentMotionProfile & { readonly ease: 'bounce.out' }
  }
  readonly chain: {
    readonly threshold: number
    readonly pullAtPreviousProgress: number
    readonly exitStartViewportPercent: number
  }
}
