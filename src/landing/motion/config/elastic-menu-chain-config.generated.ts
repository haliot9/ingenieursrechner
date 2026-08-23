// GENERATED FILE - DO NOT EDIT.
// Edit src/landing/motion/config/elastic-menu-chain.motion.yaml and run `npm run elastic-menu-chain:config`.

import type { ElasticMenuChainConfig } from './elastic-menu-chain-config.types'

export const elasticMenuChainConfig = {
  "profiles": {
    "lead": {
      "distance": 180,
      "direction": "vertical",
      "reverse": false,
      "duration": 2.2,
      "ease": "power3.out",
      "initialOpacity": 0,
      "animateOpacity": true,
      "scale": 1,
      "delay": 0,
      "disappearDuration": 0.5,
      "disappearEase": "power3.in"
    },
    "follower": {
      "distance": 180,
      "direction": "vertical",
      "reverse": false,
      "duration": 2.2,
      "ease": "bounce.out",
      "initialOpacity": 0,
      "animateOpacity": true,
      "scale": 1,
      "delay": 0,
      "disappearDuration": 0.5,
      "disappearEase": "power3.in"
    }
  },
  "chain": {
    "threshold": 0.1,
    "pullAtPreviousProgress": 0.42,
    "exitStartViewportPercent": 22
  }
} as const satisfies ElasticMenuChainConfig
