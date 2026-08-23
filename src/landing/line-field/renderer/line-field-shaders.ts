export const lineFieldVertexShader = `#version 300 es
in vec2 position;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

/**
 * Browser translation of the owner-accepted Blender parent.
 *
 * Lower branch: pinned ReactBits Threads at neutral mouse, amplitude 1,
 * distance 0. Upper branch: the same reveal length with amplitude 0. Each
 * thread owns its staggered endpoint, so no shared rectangular reveal edge can
 * cut across the field.
 */
export const lineFieldFragmentShader = `#version 300 es
precision highp float;

const int THREAD_COUNT = 40;
const float TAU = 6.283185307179586;

uniform vec2 cssSizePx;
uniform float effectiveDpr;
uniform vec2 sourceOriginLocalPx;
uniform vec2 physicalOriginLocalPx;
uniform float physicalFrontLocalY;
uniform float endpointLocalYs[THREAD_COUNT];
uniform float sourceTimeSeconds;
uniform float sourceLengthPx;
uniform float sourceLateralScalePx;
uniform float endpointCenterlines[THREAD_COUNT];
uniform float endpointTangentXs[THREAD_COUNT];
uniform float endpointTangentYs[THREAD_COUNT];
uniform float endpointCurvatures[THREAD_COUNT];
uniform float motionOpacity;
uniform float themeMode;
uniform vec3 bodyColor0;
uniform vec3 bodyColor1;
uniform vec3 bodyColor2;
uniform vec3 bodyColor3;
uniform float bodyCoreOpacity;
uniform float bodyEffectOpacity;
uniform float bodyEffectRadiusPx;
uniform float bodyFreshTrailLengthPx;
uniform float bodyFiberScalePx;
uniform float bodyFiberStrength;
uniform float bodySheenOpacity;
uniform vec3 linePrimary;
uniform vec3 lineSecondary;
uniform vec3 lineAccentOrFiber;
uniform vec3 wetInkColor;
uniform float baseOpacity;
uniform float lineGlowOpacity;
uniform float lineEffectRadiusPx;
uniform float tipDiameterToLineWidth;
uniform float tipTailLengthToDiameter;
uniform float tipEffectDiameterToHead;
uniform float tipTailOpacityAtTip;
uniform float tipGlowOpacity;
uniform float tipSpecularOpacity;
uniform float freshTrailLengthPx;
uniform float pinkMix;
uniform float cyanMix;
uniform float pulseHz;
uniform float pulseDepth;
uniform float secondaryPulseRatio;
uniform float inkIrregularity;
uniform float absorptionOpacity;

out vec4 fragmentColor;

float sourceSmoothstep(float edge0, float edge1, float value) {
  float progress = clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0);
  return progress * progress * (3.0 - 2.0 * progress);
}

float perlin2D(vec2 point) {
  vec2 integerPoint = floor(point);
  vec4 fractions = point.xyxy - vec4(integerPoint, integerPoint + 1.0);
  vec4 periodPoint = vec4(integerPoint.xy, integerPoint.xy + 1.0);
  periodPoint = periodPoint - floor(periodPoint * (1.0 / 71.0)) * 71.0;
  periodPoint += vec2(26.0, 161.0).xyxy;
  periodPoint *= periodPoint;
  periodPoint = periodPoint.xzxz * periodPoint.yyww;
  vec4 hashX = fract(periodPoint * (1.0 / 951.135664));
  vec4 hashY = fract(periodPoint * (1.0 / 642.949883));
  vec4 gradientX = hashX - 0.49999;
  vec4 gradientY = hashY - 0.49999;
  vec4 gradientResults = inversesqrt(
    gradientX * gradientX + gradientY * gradientY
  ) * (
    gradientX * fractions.xzxz + gradientY * fractions.yyww
  );
  gradientResults *= 1.4142135623730950;
  vec2 blend = fractions.xy * fractions.xy * fractions.xy
    * (fractions.xy * (fractions.xy * 6.0 - 15.0) + 10.0);
  vec4 blend2 = vec4(blend, vec2(1.0 - blend));
  return dot(gradientResults, blend2.zxzx * blend2.wwyy);
}

float sourcePixel(float count, vec2 resolution) {
  return (1.0 / max(resolution.x, resolution.y)) * count;
}

float hash21(vec2 value) {
  vec3 point = fract(vec3(value.xyx) * vec3(0.1031, 0.1030, 0.0973));
  point += dot(point, point.yzx + 33.33);
  return fract((point.x + point.y) * point.z);
}

float sourceHaloMask(
  float centerY,
  float width,
  float softness,
  float threadWeight,
  vec2 sourcePoint,
  vec2 resolution,
  float radiusPx
) {
  float haloWidth = radiusPx * effectiveDpr / max(1.0, resolution.y);
  float haloStart = sourceSmoothstep(
    centerY + width / 2.0 + softness + haloWidth,
    centerY,
    sourcePoint.y
  );
  float haloEnd = sourceSmoothstep(
    centerY,
    centerY - width / 2.0 - softness - haloWidth,
    sourcePoint.y
  );
  return clamp((haloStart - haloEnd) * threadWeight, 0.0, 1.0);
}

vec3 sourceLineMasks(
  vec2 sourcePoint,
  float p,
  vec2 resolution,
  float amplitude,
  float haloRadiusPx,
  float bodyRadiusPx
) {
  float splitPoint = 0.1 + p * 0.4;
  float amplitudeNormal = sourceSmoothstep(splitPoint, 0.7, sourcePoint.x);
  float finalAmplitude = amplitudeNormal * 0.5 * amplitude;
  float timeScaled = sourceTimeSeconds / 10.0;
  float blur = sourceSmoothstep(
    splitPoint,
    splitPoint + 0.05,
    sourcePoint.x
  ) * p;
  float xNoise = mix(
    perlin2D(vec2(timeScaled, sourcePoint.x + p) * 2.5),
    perlin2D(vec2(timeScaled, sourcePoint.x + timeScaled) * 3.5) / 1.5,
    sourcePoint.x * 0.3
  );
  float centerY = 0.5 + xNoise / 2.0 * finalAmplitude;
  float width = 7.0 * sourcePixel(1.0, resolution) * (1.0 - p);
  float softness = 10.0 * sourcePixel(1.0, resolution) * blur;
  float lineStart = sourceSmoothstep(
    centerY + width / 2.0 + softness,
    centerY,
    sourcePoint.y
  );
  float lineEnd = sourceSmoothstep(
    centerY,
    centerY - width / 2.0 - softness,
    sourcePoint.y
  );
  float threadWeight = 1.0 - sourceSmoothstep(0.0, 1.0, pow(p, 0.3));
  float coreMask = clamp(
    (lineStart - lineEnd)
      * threadWeight,
    0.0,
    1.0
  );
  float haloMask = sourceHaloMask(
    centerY, width, softness, threadWeight, sourcePoint, resolution, haloRadiusPx
  );
  float bodyMask = sourceHaloMask(
    centerY, width, softness, threadWeight, sourcePoint, resolution, bodyRadiusPx
  );
  return vec3(coreMask, haloMask, bodyMask);
}

vec3 sourceFlatLineMasks(
  vec2 sourcePoint,
  float p,
  vec2 resolution,
  float haloRadiusPx,
  float bodyRadiusPx
) {
  float splitPoint = 0.1 + p * 0.4;
  float blur = sourceSmoothstep(
    splitPoint,
    splitPoint + 0.05,
    sourcePoint.x
  ) * p;
  float centerY = 0.5;
  float width = 7.0 * sourcePixel(1.0, resolution) * (1.0 - p);
  float softness = 10.0 * sourcePixel(1.0, resolution) * blur;
  float lineStart = sourceSmoothstep(
    centerY + width / 2.0 + softness,
    centerY,
    sourcePoint.y
  );
  float lineEnd = sourceSmoothstep(
    centerY,
    centerY - width / 2.0 - softness,
    sourcePoint.y
  );
  float threadWeight = 1.0 - sourceSmoothstep(0.0, 1.0, pow(p, 0.3));
  float coreMask = clamp((lineStart - lineEnd) * threadWeight, 0.0, 1.0);
  float haloMask = sourceHaloMask(
    centerY, width, softness, threadWeight, sourcePoint, resolution, haloRadiusPx
  );
  float bodyMask = sourceHaloMask(
    centerY, width, softness, threadWeight, sourcePoint, resolution, bodyRadiusPx
  );
  return vec3(coreMask, haloMask, bodyMask);
}

float endpointLineWidthPx(float p, vec2 resolution, float lateralScalePx) {
  float normalizedWidth = 7.0 * sourcePixel(1.0, resolution) * (1.0 - p);
  return max(1.0 / effectiveDpr, normalizedWidth * lateralScalePx);
}

float antialiasedShapeMask(float signedDistancePx) {
  float shoulderPx = max(0.5 / effectiveDpr, fwidth(signedDistancePx));
  return 1.0 - sourceSmoothstep(-shoulderPx, shoulderPx, signedDistancePx);
}

float endpointEffectMask(float signedDistancePx, float effectPaddingPx) {
  float coreMask = antialiasedShapeMask(signedDistancePx);
  float safePaddingPx = max(effectPaddingPx, 0.5 / effectiveDpr);
  float outsideDistancePx = max(0.0, signedDistancePx);
  float exteriorFalloff = 1.0 - sourceSmoothstep(
    0.0,
    safePaddingPx,
    outsideDistancePx
  );
  return max(coreMask, exteriorFalloff);
}

vec2 tangentTailDistanceAndProgress(
  vec2 point,
  vec2 center,
  vec2 forwardTangent,
  float curvature,
  float headRadiusPx,
  float tailLengthPx
) {
  vec2 tangent = normalize(forwardTangent);
  vec2 normal = vec2(tangent.y, -tangent.x);
  vec2 relative = point - center;
  float behind = -dot(relative, tangent);
  float lateral = dot(relative, normal);
  float safeTailLength = max(tailLengthPx, headRadiusPx * 1.25);

  // For a circle at the origin and a tail tip at (L, 0), this is the exact
  // tangent contact. The tail therefore never cuts through the circular head.
  float contactBehind = headRadiusPx * headRadiusPx / safeTailLength;
  float contactRatio = contactBehind / headRadiusPx;
  float contactHalfWidth = headRadiusPx * sqrt(max(0.0, 1.0 - contactRatio * contactRatio));
  float tailProgress = clamp(
    (behind - contactBehind) / max(0.0001, safeTailLength - contactBehind),
    0.0,
    1.0
  );
  float tailHalfWidth = contactHalfWidth * (1.0 - tailProgress);

  // Bending begins with zero offset and zero slope at the tangent contact.
  // That preserves the circle tangent while the two sides flex with the lane.
  float bendDistance = max(0.0, behind - contactBehind);
  float bentCenter = 0.5 * curvature * bendDistance * bendDistance;
  float tailDistance = max(
    abs(lateral - bentCenter) - tailHalfWidth,
    max(contactBehind - behind, behind - safeTailLength)
  );
  return vec2(tailDistance, tailProgress);
}

float endpointEdgeVisibility(float endpointY, float outerRadiusPx) {
  float fadeBandPx = max(32.0, outerRadiusPx * 2.0);
  float visibleAtTop = sourceSmoothstep(-outerRadiusPx, fadeBandPx, endpointY);
  float visibleAtBottom = 1.0 - sourceSmoothstep(
    cssSizePx.y - fadeBandPx,
    cssSizePx.y + outerRadiusPx,
    endpointY
  );
  return visibleAtTop * visibleAtBottom;
}

void composite(
  inout vec3 color,
  inout float alpha,
  vec3 layerColor,
  float layerAlpha
) {
  float boundedAlpha = clamp(layerAlpha, 0.0, 1.0);
  color = layerColor * boundedAlpha + color * (1.0 - boundedAlpha);
  alpha = boundedAlpha + alpha * (1.0 - boundedAlpha);
}

void screenComposite(
  inout vec3 color,
  inout float alpha,
  vec3 layerColor,
  float layerAlpha
) {
  float boundedAlpha = clamp(layerAlpha, 0.0, 1.0);
  vec3 premultipliedLayer = layerColor * boundedAlpha;
  color = color + premultipliedLayer - color * premultipliedLayer;
  alpha = boundedAlpha + alpha * (1.0 - boundedAlpha);
}

void main() {
  vec2 cssPoint = vec2(
    gl_FragCoord.x / effectiveDpr,
    cssSizePx.y - gl_FragCoord.y / effectiveDpr
  );
  float safeLength = max(1.0, sourceLengthPx);
  float safeLateral = max(1.0, sourceLateralScalePx);
  float lowerSourceX = (cssPoint.y - sourceOriginLocalPx.y) / safeLength;
  float upperSourceX = (sourceOriginLocalPx.y - cssPoint.y) / safeLength;
  float sourceY = 0.5 + (cssPoint.x - sourceOriginLocalPx.x) / safeLateral;
  vec2 sourceResolution = effectiveDpr * vec2(safeLength, safeLateral);
  float upperPhysicalFrontLocalY = physicalOriginLocalPx.y
    - (physicalFrontLocalY - physicalOriginLocalPx.y);
  float lowerEndpointSourceX = (physicalFrontLocalY - sourceOriginLocalPx.y) / safeLength;
  float upperEndpointSourceX = (sourceOriginLocalPx.y - upperPhysicalFrontLocalY) / safeLength;

  float lowerStrength = 1.0;
  float upperStrength = 1.0;
  float lowerHaloStrength = 1.0;
  float upperHaloStrength = 1.0;
  float lowerBodyEffectStrength = 1.0;
  float upperBodyEffectStrength = 1.0;
  for (int i = 0; i < THREAD_COUNT; i += 1) {
    float p = float(i) / 40.0;
    float lowerEndpointY = endpointLocalYs[i];
    float upperEndpointY = physicalOriginLocalPx.y
      - (lowerEndpointY - physicalOriginLocalPx.y);
    float lowerLaneVisible = step(physicalOriginLocalPx.y, cssPoint.y)
      * step(cssPoint.y, lowerEndpointY);
    float upperLaneVisible = step(upperEndpointY, cssPoint.y)
      * step(cssPoint.y, physicalOriginLocalPx.y);
    vec3 lowerMasks = sourceLineMasks(
      vec2(lowerSourceX, sourceY),
      p,
      sourceResolution,
      1.0,
      lineEffectRadiusPx,
      bodyEffectRadiusPx
    );
    vec3 upperMasks = sourceFlatLineMasks(
      vec2(upperSourceX, sourceY),
      p,
      sourceResolution,
      lineEffectRadiusPx,
      bodyEffectRadiusPx
    );
    lowerStrength *= 1.0 - lowerMasks.x * lowerLaneVisible;
    lowerHaloStrength *= 1.0 - lowerMasks.y * lowerLaneVisible;
    upperStrength *= 1.0 - upperMasks.x * upperLaneVisible;
    upperHaloStrength *= 1.0 - upperMasks.y * upperLaneVisible;
    lowerBodyEffectStrength *= 1.0 - lowerMasks.z * lowerLaneVisible;
    upperBodyEffectStrength *= 1.0 - upperMasks.z * upperLaneVisible;
  }
  float lowerAlpha = 1.0 - lowerStrength;
  float upperAlpha = 1.0 - upperStrength;
  float lineAlpha = max(lowerAlpha, upperAlpha);
  float lineHaloAlpha = max(1.0 - lowerHaloStrength, 1.0 - upperHaloStrength);
  float bodyEffectAlpha = max(
    1.0 - lowerBodyEffectStrength,
    1.0 - upperBodyEffectStrength
  );
  float bodyFringeAlpha = max(0.0, bodyEffectAlpha - lineHaloAlpha);

  float trailLength = themeMode < 0.5
    ? clamp(freshTrailLengthPx / safeLength, 0.07, 0.16)
    : clamp(freshTrailLengthPx / safeLength, 0.055, 0.11);
  float lowerFresh = (
    1.0 - sourceSmoothstep(0.0, trailLength, max(0.0, lowerEndpointSourceX - lowerSourceX))
  );
  float upperFresh = (
    1.0 - sourceSmoothstep(0.0, trailLength, max(0.0, upperEndpointSourceX - upperSourceX))
  );
  float freshness = max(lowerFresh, upperFresh);
  float bodyTrailLength = themeMode < 0.5
    ? clamp(bodyFreshTrailLengthPx / safeLength, 0.07, 0.16)
    : clamp(bodyFreshTrailLengthPx / safeLength, 0.055, 0.11);
  float lowerBodyFresh = (
    1.0 - sourceSmoothstep(0.0, bodyTrailLength, max(0.0, lowerEndpointSourceX - lowerSourceX))
  );
  float upperBodyFresh = (
    1.0 - sourceSmoothstep(0.0, bodyTrailLength, max(0.0, upperEndpointSourceX - upperSourceX))
  );
  float bodyFreshness = max(lowerBodyFresh, upperBodyFresh);

  float lowerTipHeadCore = 0.0;
  float upperTipHeadCore = 0.0;
  float lowerTipTailCore = 0.0;
  float upperTipTailCore = 0.0;
  float lowerTipHeadEffect = 0.0;
  float upperTipHeadEffect = 0.0;
  float lowerTipTailEffect = 0.0;
  float upperTipTailEffect = 0.0;
  float lowerTipHighlight = 0.0;
  float upperTipHighlight = 0.0;
  for (int i = 0; i < THREAD_COUNT; i += 1) {
    float p = float(i) / 40.0;
    float lowerEndpointY = endpointLocalYs[i];
    float upperEndpointY = physicalOriginLocalPx.y
      - (lowerEndpointY - physicalOriginLocalPx.y);
    float endpointCenterline = endpointCenterlines[i];
    vec2 lowerEndpoint = vec2(
      physicalOriginLocalPx.x + (endpointCenterline - 0.5) * safeLateral,
      lowerEndpointY
    );
    vec2 upperEndpoint = vec2(physicalOriginLocalPx.x, upperEndpointY);
    vec2 lowerTangent = normalize(vec2(endpointTangentXs[i], endpointTangentYs[i]));
    vec2 upperTangent = vec2(0.0, -1.0);
    float lineWidthPx = endpointLineWidthPx(p, sourceResolution, safeLateral);
    float headRadiusPx = 0.5 * lineWidthPx * tipDiameterToLineWidth;
    float tipTailLengthPx = 2.0 * headRadiusPx * tipTailLengthToDiameter;
    float effectPaddingPx = headRadiusPx * (tipEffectDiameterToHead - 1.0);
    float effectExtentPx = max(
      headRadiusPx + effectPaddingPx,
      tipTailLengthPx + effectPaddingPx
    );
    float lowerTipVisibility = endpointEdgeVisibility(lowerEndpointY, effectExtentPx);
    float upperTipVisibility = endpointEdgeVisibility(upperEndpointY, effectExtentPx);
    float threadWeight = 1.0 - sourceSmoothstep(0.0, 1.0, pow(p, 0.3));
    float lowerHeadDistance = distance(cssPoint, lowerEndpoint) - headRadiusPx;
    float upperHeadDistance = distance(cssPoint, upperEndpoint) - headRadiusPx;
    vec2 lowerTailData = tangentTailDistanceAndProgress(
      cssPoint,
      lowerEndpoint,
      lowerTangent,
      endpointCurvatures[i],
      headRadiusPx,
      tipTailLengthPx
    );
    vec2 upperTailData = tangentTailDistanceAndProgress(
      cssPoint,
      upperEndpoint,
      upperTangent,
      0.0,
      headRadiusPx,
      tipTailLengthPx
    );
    float lowerHeadMask = antialiasedShapeMask(lowerHeadDistance);
    float upperHeadMask = antialiasedShapeMask(upperHeadDistance);
    float lowerTailMask = antialiasedShapeMask(lowerTailData.x);
    float upperTailMask = antialiasedShapeMask(upperTailData.x);
    float lowerTailOpacity = mix(1.0, tipTailOpacityAtTip, lowerTailData.y);
    float upperTailOpacity = mix(1.0, tipTailOpacityAtTip, upperTailData.y);
    lowerTipHeadCore = max(
      lowerTipHeadCore,
      lowerHeadMask * lowerTipVisibility * threadWeight
    );
    upperTipHeadCore = max(
      upperTipHeadCore,
      upperHeadMask * upperTipVisibility * threadWeight
    );
    lowerTipTailCore = max(
      lowerTipTailCore,
      lowerTailMask * lowerTailOpacity * lowerTipVisibility * threadWeight
    );
    upperTipTailCore = max(
      upperTipTailCore,
      upperTailMask * upperTailOpacity * upperTipVisibility * threadWeight
    );
    lowerTipHeadEffect = max(
      lowerTipHeadEffect,
      endpointEffectMask(lowerHeadDistance, effectPaddingPx)
        * sqrt(lowerTipVisibility * threadWeight)
    );
    upperTipHeadEffect = max(
      upperTipHeadEffect,
      endpointEffectMask(upperHeadDistance, effectPaddingPx)
        * sqrt(upperTipVisibility * threadWeight)
    );
    lowerTipTailEffect = max(
      lowerTipTailEffect,
      endpointEffectMask(lowerTailData.x, effectPaddingPx)
        * lowerTailOpacity * sqrt(lowerTipVisibility * threadWeight)
    );
    upperTipTailEffect = max(
      upperTipTailEffect,
      endpointEffectMask(upperTailData.x, effectPaddingPx)
        * upperTailOpacity * sqrt(upperTipVisibility * threadWeight)
    );

    vec2 lowerNormal = vec2(lowerTangent.y, -lowerTangent.x);
    vec2 upperNormal = vec2(upperTangent.y, -upperTangent.x);
    float highlightRadiusPx = max(0.25 / effectiveDpr, headRadiusPx * 0.24);
    vec2 lowerHighlightCenter = lowerEndpoint
      + lowerTangent * headRadiusPx * 0.28
      - lowerNormal * headRadiusPx * 0.28;
    vec2 upperHighlightCenter = upperEndpoint
      + upperTangent * headRadiusPx * 0.28
      - upperNormal * headRadiusPx * 0.28;
    lowerTipHighlight = max(
      lowerTipHighlight,
      antialiasedShapeMask(distance(cssPoint, lowerHighlightCenter) - highlightRadiusPx)
        * lowerHeadMask * lowerTipVisibility * threadWeight
    );
    upperTipHighlight = max(
      upperTipHighlight,
      antialiasedShapeMask(distance(cssPoint, upperHighlightCenter) - highlightRadiusPx)
        * upperHeadMask * upperTipVisibility * threadWeight
    );
  }

  float tipHeadCore = max(lowerTipHeadCore, upperTipHeadCore);
  float tipTailCore = max(lowerTipTailCore, upperTipTailCore);
  float tipCore = max(tipHeadCore, tipTailCore);
  float tipHeadEffect = max(lowerTipHeadEffect, upperTipHeadEffect);
  float tipTailEffect = max(lowerTipTailEffect, upperTipTailEffect);
  float tipEffect = max(tipHeadEffect, tipTailEffect);
  float tipHighlight = max(lowerTipHighlight, upperTipHighlight);
  vec3 accumulatedColor = vec3(0.0);
  float accumulatedAlpha = 0.0;

  if (themeMode < 0.5) {
    float bodyPosition = clamp(max(lowerSourceX, upperSourceX), 0.0, 1.0);
    vec3 bodyColor = bodyPosition < 0.5
      ? mix(bodyColor0, bodyColor1, bodyPosition * 2.0)
      : mix(bodyColor1, bodyColor2, (bodyPosition - 0.5) * 2.0);
    float primaryPulse = 0.5 + 0.5 * sin(
      TAU * pulseHz * sourceTimeSeconds + sourceY * 11.0
    );
    float secondaryPulse = 0.5 + 0.5 * sin(
      TAU * pulseHz * secondaryPulseRatio * sourceTimeSeconds + sourceY * 17.0 + 1.7
    );
    float glowPulse = mix(
      1.0 - pulseDepth,
      1.0,
      primaryPulse * secondaryPulse
    );
    vec3 pinkGlow = mix(linePrimary, lineSecondary, pinkMix);
    vec3 glowColor = mix(pinkGlow, lineAccentOrFiber, cyanMix * secondaryPulse);
    composite(
      accumulatedColor,
      accumulatedAlpha,
      glowColor,
      lineHaloAlpha * lineGlowOpacity * glowPulse * mix(0.9, 3.2, freshness)
    );
    float inverseDistanceLikeEmission = bodyFringeAlpha / (
      1.0 + 3.0 * max(0.0, 1.0 - bodyEffectAlpha)
    );
    screenComposite(
      accumulatedColor,
      accumulatedAlpha,
      bodyColor,
      inverseDistanceLikeEmission
        * bodyEffectOpacity
        * mix(0.92, 1.0, bodyFreshness)
    );
    composite(
      accumulatedColor,
      accumulatedAlpha,
      bodyColor,
      lineAlpha
        * mix(baseOpacity, 1.0, freshness * 0.35)
        * bodyCoreOpacity
    );
    composite(
      accumulatedColor,
      accumulatedAlpha,
      glowColor,
      tipTailEffect * tipGlowOpacity * mix(0.18, 0.46, glowPulse)
    );
    composite(
      accumulatedColor,
      accumulatedAlpha,
      glowColor,
      tipHeadEffect * tipGlowOpacity * mix(0.56, 1.0, glowPulse)
    );
    composite(
      accumulatedColor,
      accumulatedAlpha,
      mix(glowColor, linePrimary, 0.38),
      tipHeadEffect * tipHeadEffect * tipGlowOpacity * mix(0.42, 0.78, glowPulse)
    );
    composite(accumulatedColor, accumulatedAlpha, linePrimary, tipCore);
  } else {
    float fiberNoise = mix(
      1.0,
      0.62 + 0.38 * hash21(floor(cssPoint * 0.72)),
      inkIrregularity
    );
    vec3 absorbedColor = mix(lineAccentOrFiber, wetInkColor, freshness * 0.72);
    composite(
      accumulatedColor,
      accumulatedAlpha,
      absorbedColor,
      lineHaloAlpha * absorptionOpacity * fiberNoise * mix(0.8, 1.35, freshness)
    );
    float coherentFiber = 0.5 + 0.5 * perlin2D(
      cssPoint / max(1.0, bodyFiberScalePx)
    );
    float bodyFiber = mix(
      1.0,
      0.72 + 0.28 * coherentFiber,
      bodyFiberStrength
    );
    float bodyAge = 1.0 - bodyFreshness;
    vec3 bodyColor = bodyAge < 0.18
      ? mix(bodyColor0, bodyColor1, bodyAge / 0.18)
      : bodyAge < 0.58
        ? mix(bodyColor1, bodyColor2, (bodyAge - 0.18) / 0.40)
        : mix(bodyColor2, bodyColor3, (bodyAge - 0.58) / 0.42);
    composite(
      accumulatedColor,
      accumulatedAlpha,
      bodyColor3,
      bodyFringeAlpha * bodyEffectOpacity * bodyFiber
    );
    composite(
      accumulatedColor,
      accumulatedAlpha,
      bodyColor,
      lineAlpha
        * mix(baseOpacity, 0.92, freshness)
        * bodyCoreOpacity
        * bodyFiber
    );
    screenComposite(
      accumulatedColor,
      accumulatedAlpha,
      mix(bodyColor, vec3(1.0), 0.24),
      lineAlpha * bodySheenOpacity * bodyFreshness * bodyFreshness
    );
    composite(
      accumulatedColor,
      accumulatedAlpha,
      mix(lineAccentOrFiber, wetInkColor, 0.82),
      tipEffect * absorptionOpacity * fiberNoise * 1.15
    );
    composite(accumulatedColor, accumulatedAlpha, wetInkColor, tipCore * 0.96);
    composite(
      accumulatedColor,
      accumulatedAlpha,
      mix(wetInkColor, vec3(1.0), 0.72),
      tipHighlight * tipSpecularOpacity
    );
  }

  accumulatedColor *= motionOpacity;
  accumulatedAlpha *= motionOpacity;
  vec3 straightColor = accumulatedAlpha > 0.000001
    ? accumulatedColor / accumulatedAlpha
    : vec3(0.0);
  fragmentColor = vec4(straightColor, accumulatedAlpha);
}
`
