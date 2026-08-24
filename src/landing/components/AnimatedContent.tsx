import React, { useContext, useEffect, useRef } from 'react'
import {
  AnimatedContentRegistrationContext,
  createAnimatedContentRuntimeScope,
  createStandaloneAnimatedContentTrigger,
  resolveAnimatedContentScroller,
  type AnimatedContentProps,
  type ResolvedAnimatedContentMotion,
} from './AnimatedContentRuntime'

export const AnimatedContent: React.FC<AnimatedContentProps> = ({
  children,
  container,
  distance = 100,
  direction = 'vertical',
  reverse = false,
  duration = 0.8,
  ease = 'power3.out',
  initialOpacity = 0,
  animateOpacity = true,
  scale = 1,
  threshold = 0.1,
  delay = 0,
  disappearAfter = 0,
  disappearDuration = 0.5,
  disappearEase = 'power3.in',
  onComplete,
  onDisappearanceComplete,
  className = '',
  style,
  ...props
}) => {
  const ref = useRef<HTMLDivElement>(null)
  const registration = useContext(AnimatedContentRegistrationContext)
  const isReady = registration?.isReady
  const register = registration?.register
  const reducedMotion = registration?.reducedMotion ?? false

  useEffect(() => {
    const element = ref.current
    if (!element || isReady && !isReady()) return
    if (register && container !== undefined) {
      throw new Error(
        'AnimatedContent container is owned by AnimatedContentChain; pass the explicit container to AnimatedContentChain',
      )
    }
    const scrollerTarget = register
      ? null
      : resolveAnimatedContentScroller('AnimatedContent', container, element.ownerDocument)
    if (reducedMotion) return

    const profile: ResolvedAnimatedContentMotion = {
      distance,
      direction,
      reverse,
      duration,
      ease,
      initialOpacity,
      animateOpacity,
      scale,
      threshold,
      delay,
      disappearAfter,
      disappearDuration,
      disappearEase,
    }
    const runtimeScope = createAnimatedContentRuntimeScope(
      element,
      profile,
      { onComplete, onDisappearanceComplete },
    )
    const { controller } = runtimeScope

    if (register) {
      const unregister = register(controller)
      return () => {
        unregister()
        controller.kill()
        runtimeScope.revert()
      }
    }
    if (!scrollerTarget) {
      throw new Error('AnimatedContent standalone scroller resolution did not complete')
    }

    const scrollTrigger = createStandaloneAnimatedContentTrigger(
      element,
      scrollerTarget,
      threshold,
      controller,
    )

    return () => {
      scrollTrigger.kill()
      controller.kill()
      runtimeScope.revert()
    }
  }, [
    isReady,
    register,
    reducedMotion,
    container,
    distance,
    direction,
    reverse,
    duration,
    ease,
    initialOpacity,
    animateOpacity,
    scale,
    threshold,
    delay,
    disappearAfter,
    disappearDuration,
    disappearEase,
    onComplete,
    onDisappearanceComplete,
  ])

  return (
    <div
      ref={ref}
      className={className}
      style={{ visibility: reducedMotion ? 'visible' : 'hidden', ...style }}
      {...props}
    >
      {children}
    </div>
  )
}

export default AnimatedContent
