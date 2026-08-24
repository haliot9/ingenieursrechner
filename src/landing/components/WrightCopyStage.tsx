import { useId } from 'react'
import type React from 'react'
import type { RefObject } from 'react'

export interface WrightFilterRefs {
  turbulence: RefObject<SVGFETurbulenceElement | null>
  displacement: RefObject<SVGFEDisplacementMapElement | null>
  fractureAlpha: RefObject<SVGFEFuncAElement | null>
  charredFlood: RefObject<SVGFEFloodElement | null>
  ashFlood: RefObject<SVGFEFloodElement | null>
}

export interface WrightCopyStageProps {
  activeCopyTheme: 'light' | 'dark'
  filterRefs: WrightFilterRefs
}

const HERO_COPY = {
  light: {
    kicker: 'Deterministische Rechenwege',
    headline: ['Nicht nur rechnen.', 'Systeme verstehen.'],
    support: 'Bekannte Größen eingeben. Beziehungen prüfen. Den vollständigen Rechenweg nachvollziehen.',
  },
  dark: {
    kicker: 'BEOBACHTUNGSFELD // SYSTEMLOGIK',
    headline: ['Aus Größen werden Spuren.', 'Aus Spuren wird Verständnis.'],
    support: 'Bekannte Größen setzen. Abhängigkeiten beobachten. Den vollständigen Rechenweg Schritt für Schritt bis zum Ergebnis verfolgen.',
  },
} as const

export function WrightCopyStage({
  activeCopyTheme,
  filterRefs: { turbulence, displacement, fractureAlpha, charredFlood, ashFlood },
}: WrightCopyStageProps): React.ReactElement {
  const filterId = `${useId()}-wright-copy-filter`

  return <div
    className="wright-hero-copy wright-copy-stage"
    style={{
      filter: `url(#${filterId}) blur(var(--wright-panel-blur)) grayscale(var(--wright-desaturation, 0)) contrast(var(--wright-contrast, 1))`,
    }}
  >
    <svg className="wright-copy-filter" width="0" height="0" aria-hidden="true" focusable="false">
      <filter
        id={filterId}
        x="-30%"
        y="-30%"
        width="160%"
        height="160%"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence
          ref={turbulence}
          type="fractalNoise"
          baseFrequency="0.008 0.014"
          numOctaves="2"
          seed="17"
          stitchTiles="stitch"
          result="noise"
        />
        <feDisplacementMap
          ref={displacement}
          in="SourceGraphic"
          in2="noise"
          scale="0"
          xChannelSelector="R"
          yChannelSelector="G"
          result="displaced"
        />
        <feColorMatrix in="noise" type="luminanceToAlpha" result="fractureNoise" />
        <feComponentTransfer in="fractureNoise" result="fractureMask">
          <feFuncA ref={fractureAlpha} type="linear" slope="0" intercept="1" />
        </feComponentTransfer>
        <feComposite
          in="fractureMask"
          in2="SourceAlpha"
          operator="in"
          result="sourceFractureMask"
        />
        <feComposite in="displaced" in2="fractureMask" operator="in" result="fragments" />
        <feMorphology in="sourceFractureMask" operator="dilate" radius="1.25" result="outerMask" />
        <feComposite in="outerMask" in2="sourceFractureMask" operator="out" result="outerEdge" />
        <feFlood
          ref={charredFlood}
          data-ash-edge="charred"
          floodColor="#080B12"
          floodOpacity="0"
          result="charcoal"
        />
        <feComposite in="charcoal" in2="outerEdge" operator="in" result="charredEdge" />
        <feMorphology in="sourceFractureMask" operator="erode" radius="0.75" result="innerMask" />
        <feComposite in="sourceFractureMask" in2="innerMask" operator="out" result="innerEdge" />
        <feFlood
          ref={ashFlood}
          data-ash-edge="light"
          floodColor="#F3F6FB"
          floodOpacity="0"
          result="ash"
        />
        <feComposite in="ash" in2="innerEdge" operator="in" result="ashEdge" />
        <feMerge>
          <feMergeNode in="charredEdge" />
          <feMergeNode in="fragments" />
          <feMergeNode in="ashEdge" />
        </feMerge>
      </filter>
    </svg>

    <div className="wright-copy-register">
      {(['light', 'dark'] as const).map((theme) => {
        const copy = HERO_COPY[theme]
        const isActive = activeCopyTheme === theme

        return <div
          key={theme}
          className={`wright-copy-panel wright-copy-panel--${theme}`}
          data-copy-theme={theme}
          aria-hidden={!isActive}
          inert={isActive ? undefined : true}
          style={theme === 'dark' ? {
            position: 'absolute',
            inset: 0,
          } : undefined}
        >
          <p className="wright-hero-kicker">{copy.kicker}</p>
          <h1 id={isActive ? 'landing-title' : undefined} aria-label={copy.headline.join(' ')}>
            {copy.headline.map((line) => <span key={line}>{line}</span>)}
          </h1>
          <p className="wright-hero-support">{copy.support}</p>
        </div>
      })}
    </div>
  </div>
}
