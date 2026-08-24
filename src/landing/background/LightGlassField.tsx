import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { LandingBackgroundLightConfig } from './config/landing-background-config.types'

interface LightGlassFieldProps {
  readonly config: LandingBackgroundLightConfig
}

interface GlassSize {
  readonly height: number
  readonly width: number
}

type GlassStyle = CSSProperties & {
  '--glass-brightness': number
  '--glass-edge-blur': string
  '--glass-filter': string
  '--glass-frost': number
  '--glass-saturation': number
  '--glass-surface-opacity': number
}

function supportsSvgBackdropFilter(filterId: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  const userAgent = window.navigator.userAgent
  const isSafari = /Safari/.test(userAgent) && !/(Chrome|Chromium)/.test(userAgent)
  const isFirefox = /Firefox/.test(userAgent)
  if (isSafari || isFirefox) return false

  const probe = document.createElement('div')
  probe.style.setProperty('backdrop-filter', `url(#${filterId})`)
  return probe.style.getPropertyValue('backdrop-filter') !== ''
}

function createDisplacementMap(
  config: LandingBackgroundLightConfig,
  size: GlassSize,
  redGradientId: string,
  blueGradientId: string,
) {
  const edgeSize = Math.min(size.width, size.height) * config.borderWidthRatio * 0.5
  const innerWidth = Math.max(0, size.width - edgeSize * 2)
  const innerHeight = Math.max(0, size.height - edgeSize * 2)
  const svg = `
    <svg viewBox="0 0 ${size.width} ${size.height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${redGradientId}" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#0000"/>
          <stop offset="100%" stop-color="red"/>
        </linearGradient>
        <linearGradient id="${blueGradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0000"/>
          <stop offset="100%" stop-color="blue"/>
        </linearGradient>
      </defs>
      <rect width="${size.width}" height="${size.height}" fill="black"/>
      <rect width="${size.width}" height="${size.height}" rx="${config.borderRadiusPx}" fill="url(#${redGradientId})"/>
      <rect width="${size.width}" height="${size.height}" rx="${config.borderRadiusPx}" fill="url(#${blueGradientId})" style="mix-blend-mode:difference"/>
      <rect x="${edgeSize}" y="${edgeSize}" width="${innerWidth}" height="${innerHeight}" rx="${config.borderRadiusPx}" fill="hsl(0 0% ${config.brightness}% / ${config.surfaceOpacity})" style="filter:blur(${config.edgeBlurPx}px)"/>
    </svg>
  `
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// Adapted from ReactBits GlassSurface at the pinned upstream revision:
// https://github.com/DavidHDev/react-bits/blob/4e0e030193b563be6be33d928f77d0d01cefe237/src/content/Components/GlassSurface/GlassSurface.jsx
export function LightGlassField({ config }: LightGlassFieldProps) {
  const uniqueId = useId().replaceAll(':', '-')
  const filterId = `landing-glass-filter-${uniqueId}`
  const redGradientId = `landing-glass-red-${uniqueId}`
  const blueGradientId = `landing-glass-blue-${uniqueId}`
  const hostRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<GlassSize>({ height: 200, width: 400 })
  const svgSupported = useMemo(() => supportsSvgBackdropFilter(filterId), [filterId])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const measure = () => {
      const rect = host.getBoundingClientRect()
      const next = {
        height: rect.height || 200,
        width: rect.width || 400,
      }
      setSize(current => (
        current.height === next.height && current.width === next.width ? current : next
      ))
    }

    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  const displacementMap = createDisplacementMap(
    config,
    size,
    redGradientId,
    blueGradientId,
  )
  const style: GlassStyle = {
    '--glass-brightness': config.brightness / 50,
    '--glass-edge-blur': `${config.edgeBlurPx}px`,
    '--glass-filter': `url(#${filterId})`,
    '--glass-frost': config.backgroundOpacity,
    '--glass-saturation': config.saturation,
    '--glass-surface-opacity': config.surfaceOpacity,
    borderRadius: `${config.borderRadiusPx}px`,
    height: `${config.heightRatio * 100}vh`,
    left: `${config.centerXRatio * 100}%`,
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: `${config.widthRatio * 100}vw`,
  }

  return <div
    ref={hostRef}
    className={`landing-background-field__light-glass landing-background-field__light-glass--${svgSupported ? 'svg' : 'fallback'}`}
    style={style}
    data-background-branch="light"
    data-glass-layer={config.layerPlacement}
    data-glass-renderer={svgSupported ? 'svg' : 'fallback'}
    data-glass-surface
  >
    <svg
      className="landing-background-field__light-glass-filter"
      data-glass-filter
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter
          id={filterId}
          colorInterpolationFilters="sRGB"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
        >
          <feImage
            href={displacementMap}
            x="0"
            y="0"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            result="map"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale={config.distortionScale + config.redOffset}
            xChannelSelector="R"
            yChannelSelector="G"
            result="displaced-red"
          />
          <feColorMatrix
            in="displaced-red"
            type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="red"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale={config.distortionScale + config.greenOffset}
            xChannelSelector="R"
            yChannelSelector="G"
            result="displaced-green"
          />
          <feColorMatrix
            in="displaced-green"
            type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="green"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale={config.distortionScale + config.blueOffset}
            xChannelSelector="R"
            yChannelSelector="G"
            result="displaced-blue"
          />
          <feColorMatrix
            in="displaced-blue"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
            result="blue"
          />
          <feBlend in="red" in2="green" mode="screen" result="red-green" />
          <feBlend in="red-green" in2="blue" mode="screen" result="output" />
          <feGaussianBlur
            in="output"
            stdDeviation={config.displacementBlurPx}
          />
        </filter>
      </defs>
    </svg>
  </div>
}
