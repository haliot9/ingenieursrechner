import { useRef, type RefObject } from 'react'
import { useWrightTimeline } from '../motion/useWrightTimeline'
import type { LandingTheme } from '../theme/useLandingTheme'
import { WrightCopyStage } from './WrightCopyStage'
import { WrightMottoPanel } from './WrightMottoPanel'
import './WrightHero.css'

export interface WrightHeroProps {
  readonly theme: LandingTheme
  readonly reducedMotion: boolean
  readonly filmTrackRef?: RefObject<HTMLDivElement | null>
  readonly videoRef?: RefObject<HTMLVideoElement | null>
  readonly mottoPanelRef?: RefObject<HTMLDivElement | null>
  readonly mottoCardSlotRef?: RefObject<HTMLDivElement | null>
}

export function WrightHero({
  theme,
  reducedMotion,
  filmTrackRef,
  videoRef,
  mottoPanelRef,
  mottoCardSlotRef,
}: WrightHeroProps) {
  const internalFilmTrackRef = useRef<HTMLDivElement>(null)
  const internalVideoRef = useRef<HTMLVideoElement>(null)
  const internalMottoPanelRef = useRef<HTMLDivElement>(null)
  const internalMottoCardSlotRef = useRef<HTMLDivElement>(null)
  const resolvedFilmTrackRef = filmTrackRef ?? internalFilmTrackRef
  const resolvedVideoRef = videoRef ?? internalVideoRef
  const resolvedMottoPanelRef = mottoPanelRef ?? internalMottoPanelRef
  const resolvedMottoCardSlotRef = mottoCardSlotRef ?? internalMottoCardSlotRef
  const turbulenceRef = useRef<SVGFETurbulenceElement>(null)
  const displacementRef = useRef<SVGFEDisplacementMapElement>(null)
  const fractureAlphaRef = useRef<SVGFEFuncAElement>(null)
  const charredFloodRef = useRef<SVGFEFloodElement>(null)
  const ashFloodRef = useRef<SVGFEFloodElement>(null)
  const filterRefs = {
    turbulence: turbulenceRef,
    displacement: displacementRef,
    fractureAlpha: fractureAlphaRef,
    charredFlood: charredFloodRef,
    ashFlood: ashFloodRef,
  }

  const activeCopyTheme = useWrightTimeline(
    resolvedFilmTrackRef,
    resolvedVideoRef,
    filterRefs,
    theme,
    reducedMotion,
  )

  return <section id="haltung" className="wright-hero" aria-labelledby="landing-title">
    <div ref={resolvedFilmTrackRef} className="wright-film-track">
      <div className="wright-hero-sticky">
        <video
          ref={resolvedVideoRef}
          className="wright-hero-media"
          muted
          playsInline
          preload="metadata"
          poster="./wright-flyer-poster.webp"
          aria-hidden="true"
        >
          <source src="./wright-flyer-scroll-gop6.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="wright-hero-copy-overlay">
        <div className="wright-hero-copy-sticky">
          <WrightCopyStage activeCopyTheme={activeCopyTheme} filterRefs={filterRefs} />
        </div>
      </div>
    </div>
    <WrightMottoPanel
      ref={resolvedMottoPanelRef}
      cardSlotRef={resolvedMottoCardSlotRef}
      theme={theme}
      reducedMotion={reducedMotion}
    />
  </section>
}
