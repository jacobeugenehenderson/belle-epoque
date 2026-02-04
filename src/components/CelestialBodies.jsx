import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'
import SunCalc from 'suncalc'
import useTimeOfDay from '../hooks/useTimeOfDay'

// Belleville, IL coordinates
const LATITUDE = 38.52
const LONGITUDE = -89.98

// Orb distance from scene center
const ORB_RADIUS = 600

// Convert azimuth/altitude to 3D position
function celestialToPosition(azimuth, altitude, radius) {
  const x = radius * Math.cos(altitude) * Math.sin(azimuth)
  const y = radius * Math.sin(altitude)
  const z = radius * Math.cos(altitude) * Math.cos(azimuth)
  return new THREE.Vector3(x, Math.max(y, 20), z) // Keep minimum height for shadows
}

// Interpolate between colors
function lerpColor(color1, color2, t) {
  const c1 = new THREE.Color(color1)
  const c2 = new THREE.Color(color2)
  return c1.lerp(c2, t)
}

// Primary light orb (sun during day, moon at night)
function PrimaryOrb({ position, color, intensity, showOrb, orbColor, orbSize }) {
  const lightRef = useRef()

  return (
    <group>
      {/* The visible orb */}
      {showOrb && (
        <group position={position.toArray()}>
          <mesh>
            <sphereGeometry args={[orbSize, 32, 32]} />
            <meshBasicMaterial color={orbColor} />
          </mesh>
          {/* Glow */}
          <mesh scale={1.8}>
            <sphereGeometry args={[orbSize, 32, 32]} />
            <meshBasicMaterial color={orbColor} transparent opacity={0.3} />
          </mesh>
        </group>
      )}

      {/* Primary directional light with high-quality shadows */}
      <directionalLight
        ref={lightRef}
        position={position.toArray()}
        intensity={intensity}
        color={color}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-far={1200}
        shadow-camera-left={-600}
        shadow-camera-right={600}
        shadow-camera-top={600}
        shadow-camera-bottom={-600}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
      />
    </group>
  )
}

// Secondary fill light orb (softer, opposite side)
function SecondaryOrb({ position, color, intensity }) {
  return (
    <directionalLight
      position={position.toArray()}
      intensity={intensity}
      color={color}
    />
  )
}

// Moon with phase-accurate rendering using billboard approach
function Moon({ position, phase, illumination, visible }) {
  const moonRef = useRef()
  const glowRef = useRef()

  // Billboard shader that always faces camera with correct phase
  const moonMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        phase: { value: phase },
        baseColor: { value: new THREE.Color('#f5f3e8') },
        shadowColor: { value: new THREE.Color('#0a0a12') },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float phase;
        uniform vec3 baseColor;
        uniform vec3 shadowColor;
        varying vec2 vUv;

        void main() {
          // Center UV at origin, scale to -1 to 1
          vec2 uv = (vUv - 0.5) * 2.0;

          // Distance from center for circular mask
          float dist = length(uv);

          // Discard pixels outside the moon circle
          if (dist > 1.0) discard;

          // Calculate the "depth" on the sphere surface (z coordinate)
          float z = sqrt(1.0 - dist * dist);

          // SunCalc phase: 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter
          // We need to map this to a terminator position
          // At phase 0 (new): fully dark (sun behind moon)
          // At phase 0.25 (first quarter): right half lit
          // At phase 0.5 (full): fully lit (sun behind us)
          // At phase 0.75 (last quarter): left half lit

          // Convert phase to terminator x-position
          // Using cosine: at phase 0, terminator at x=1 (all dark)
          // at phase 0.5, terminator at x=-1 (all lit)
          float terminatorX = cos(phase * 2.0 * 3.14159);

          // The lit portion is where uv.x > terminatorX adjusted for sphere curvature
          // Account for the spherical surface - the terminator curves
          float sphereX = uv.x / max(z, 0.01);
          float lit = smoothstep(terminatorX - 0.15, terminatorX + 0.15, sphereX);

          // At new moon (phase~0), make it very dark
          // At full moon (phase~0.5), make it fully bright
          float fullness = 1.0 - abs(cos(phase * 2.0 * 3.14159));
          lit = mix(lit, 1.0, fullness * 0.3);

          // Add subtle surface variation
          float noise = sin(uv.x * 25.0 + uv.y * 18.0) * 0.03 +
                        sin(uv.x * 12.0 - uv.y * 22.0 + 1.5) * 0.04;

          // Limb darkening - darken edges of the moon
          float limb = pow(z, 0.3);

          vec3 surfaceColor = baseColor * (0.95 + noise) * limb;
          vec3 color = mix(shadowColor, surfaceColor, lit);

          // Soft edge antialiasing
          float alpha = smoothstep(1.0, 0.95, dist);

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
    })
  }, [])

  const glowMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color('#aaccee') },
        intensity: { value: illumination },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float intensity;
        varying vec2 vUv;

        void main() {
          vec2 uv = (vUv - 0.5) * 2.0;
          float dist = length(uv);

          // Soft circular glow - fades to zero well before edges
          // Moon is at ~0.3 of the plane size (30/100)
          float innerEdge = 0.28;
          float outerEdge = 0.7;

          float glow = smoothstep(outerEdge, innerEdge, dist);
          glow *= smoothstep(0.15, innerEdge, dist); // Fade inside moon area too
          glow *= intensity * 0.25;

          // Ensure fully transparent at edges
          if (dist > 0.9) glow = 0.0;

          gl_FragColor = vec4(glowColor, glow);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [])

  // Update uniforms
  useFrame(({ camera }) => {
    if (moonRef.current) {
      // Billboard: make moon always face camera
      moonRef.current.quaternion.copy(camera.quaternion)
      moonRef.current.material.uniforms.phase.value = phase
    }
    if (glowRef.current) {
      glowRef.current.quaternion.copy(camera.quaternion)
      glowRef.current.material.uniforms.intensity.value = illumination
    }
  })

  if (!visible) return null

  return (
    <group position={position.toArray()}>
      {/* Glow layer behind - large enough that edges never visible */}
      <mesh ref={glowRef} material={glowMaterial} renderOrder={1}>
        <planeGeometry args={[120, 120]} />
      </mesh>
      {/* Moon surface */}
      <mesh ref={moonRef} material={moonMaterial} renderOrder={2}>
        <planeGeometry args={[35, 35]} />
      </mesh>
    </group>
  )
}

// Gradient sky dome with smooth day/night transitions
function GradientSky({ sunAltitude }) {
  const materialRef = useRef()
  const starsRef = useRef()

  // Calculate sky colors based on sun altitude
  const colors = useMemo(() => {
    // Normalize sun altitude to useful ranges
    const dayAmount = Math.max(0, Math.min(1, (sunAltitude + 0.1) / 0.5)) // 0 at night, 1 at full day
    const twilightAmount = Math.max(0, Math.min(1, (sunAltitude + 0.15) / 0.25)) // twilight transition

    // Night colors
    const nightZenith = new THREE.Color('#0a0a15')
    const nightHorizon = new THREE.Color('#1a1a2a')

    // Twilight colors
    const twilightZenith = new THREE.Color('#1a2040')
    const twilightHorizon = new THREE.Color('#4a3050')

    // Day colors - darker blue at horizon, brighter at zenith (summer day feel)
    const dayZenith = new THREE.Color('#4a90e0')
    const dayHorizon = new THREE.Color('#87ceeb').lerp(new THREE.Color('#c0ddf0'), 0.3)

    // Blend based on time of day
    let zenith, horizon

    if (sunAltitude < -0.1) {
      // Full night
      zenith = nightZenith
      horizon = nightHorizon
    } else if (sunAltitude < 0.05) {
      // Twilight
      const t = (sunAltitude + 0.1) / 0.15
      zenith = nightZenith.clone().lerp(twilightZenith, t)
      horizon = nightHorizon.clone().lerp(twilightHorizon, t)
    } else if (sunAltitude < 0.3) {
      // Golden hour to day transition
      const t = (sunAltitude - 0.05) / 0.25
      zenith = twilightZenith.clone().lerp(dayZenith, t)
      horizon = twilightHorizon.clone().lerp(dayHorizon, t)
    } else {
      // Full day
      zenith = dayZenith
      horizon = dayHorizon
    }

    return { zenith, horizon }
  }, [sunAltitude])

  // Stars fade based on sun altitude
  const starOpacity = Math.max(0, Math.min(1, (-sunAltitude - 0.02) / 0.12))

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.zenithColor.value.copy(colors.zenith)
      materialRef.current.uniforms.horizonColor.value.copy(colors.horizon)
    }
    if (starsRef.current) {
      starsRef.current.material.opacity = starOpacity
    }
  })

  const skyMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      zenithColor: { value: new THREE.Color('#4a90e0') },
      horizonColor: { value: new THREE.Color('#87ceeb') },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 zenithColor;
      uniform vec3 horizonColor;
      varying vec3 vWorldPosition;

      void main() {
        vec3 dir = normalize(vWorldPosition);

        // Height above horizon (0 at horizon, 1 at zenith)
        float h = dir.y;

        // Smooth gradient from horizon to zenith
        // Using a curve that spends more time near horizon colors
        float t = pow(max(0.0, h), 0.6);

        // Below horizon, fade to darker
        float belowHorizon = smoothstep(0.0, -0.15, h);
        vec3 groundColor = horizonColor * 0.3;

        // Mix horizon → zenith for sky, darken below horizon
        vec3 skyColor = mix(horizonColor, zenithColor, t);
        vec3 finalColor = mix(skyColor, groundColor, belowHorizon);

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  }), [])

  return (
    <>
      {/* Sky dome */}
      <mesh>
        <sphereGeometry args={[3500, 64, 64]} />
        <primitive object={skyMaterial} ref={materialRef} />
      </mesh>

      {/* Stars - render inside sky dome */}
      <Stars
        ref={starsRef}
        radius={2000}
        depth={50}
        count={6000}
        factor={5}
        saturation={0.1}
        fade
        speed={0}
      />
    </>
  )
}

// Main component - orchestrates the two orbs based on time
function CelestialBodies() {
  const { currentTime } = useTimeOfDay()

  // Calculate astronomical data
  const lighting = useMemo(() => {
    const sunPos = SunCalc.getPosition(currentTime, LATITUDE, LONGITUDE)
    const moonPos = SunCalc.getMoonPosition(currentTime, LATITUDE, LONGITUDE)
    const moonIllum = SunCalc.getMoonIllumination(currentTime)

    const sunAlt = sunPos.altitude
    const moonAlt = moonPos.altitude

    // Time phases (using sun altitude)
    const isNight = sunAlt < -0.12
    const isTwilight = sunAlt >= -0.12 && sunAlt < 0.05
    const isGoldenHour = sunAlt >= 0.05 && sunAlt < 0.3
    const isDay = sunAlt >= 0.3

    // Sun position
    const sunPosition = celestialToPosition(sunPos.azimuth + Math.PI, sunPos.altitude, ORB_RADIUS)

    // Moon position
    const moonPosition = celestialToPosition(moonPos.azimuth + Math.PI, moonPos.altitude, ORB_RADIUS)

    // Primary orb settings based on time
    let primary = {}
    let secondary = {}
    let sky = {}
    let ambient = {}

    // Moon data for dedicated Moon component
    const moon = {
      position: moonPosition,
      phase: moonIllum.phase,
      illumination: moonIllum.fraction,
      visible: moonAlt > -0.05,
    }

    if (isNight) {
      // Night: Moon is primary light source, blue tones
      const moonBrightness = 0.3 + moonIllum.fraction * 0.4
      primary = {
        position: moonAlt > 0 ? moonPosition : new THREE.Vector3(200, 150, 200),
        color: '#9ab8e0',
        intensity: moonBrightness,
        showOrb: false, // Moon component handles the orb now
        orbColor: '#e8e8f0',
        orbSize: 12,
      }
      secondary = {
        position: new THREE.Vector3(-150, 100, -150),
        color: '#4466aa',
        intensity: 0.25,
      }
      sky = { top: '#0a1020', bottom: '#1a2545' }
      ambient = { color: '#334466', intensity: 0.35 }
    } else if (isTwilight) {
      // Twilight: Sun near horizon, warm/purple mix
      const t = (sunAlt + 0.12) / 0.17 // 0 to 1 through twilight
      primary = {
        position: sunPosition,
        color: lerpColor('#ff6644', '#ffaa66', t),
        intensity: 0.4 + t * 0.3,
        showOrb: true,
        orbColor: lerpColor('#ff4422', '#ffaa55', t),
        orbSize: 25 - t * 5,
      }
      secondary = {
        position: new THREE.Vector3(-sunPosition.x * 0.5, 80, -sunPosition.z * 0.5),
        color: '#8877aa',
        intensity: 0.2 + t * 0.1,
      }
      sky = {
        top: lerpColor('#1a1535', '#3a4570', t),
        bottom: lerpColor('#553333', '#885544', t),
      }
      ambient = { color: lerpColor('#443355', '#887766', t), intensity: 0.35 + t * 0.1 }
    } else if (isGoldenHour) {
      // Golden hour: Warm, romantic
      const t = (sunAlt - 0.05) / 0.25 // 0 to 1 through golden hour
      primary = {
        position: sunPosition,
        color: lerpColor('#ffaa55', '#fff8e8', t),
        intensity: 0.7 + t * 0.25,
        showOrb: true,
        orbColor: lerpColor('#ffcc66', '#ffffaa', t),
        orbSize: 20 - t * 2,
      }
      secondary = {
        position: new THREE.Vector3(-sunPosition.x * 0.5, 60, -sunPosition.z * 0.5),
        color: '#aabbdd',
        intensity: 0.2 + t * 0.1,
      }
      sky = {
        top: lerpColor('#4a6090', '#5080c0', t),
        bottom: lerpColor('#aa7755', '#88aacc', t),
      }
      ambient = { color: lerpColor('#998877', '#ccddee', t), intensity: 0.4 + t * 0.1 }
    } else {
      // Full day: Bright, clear, vibrant
      primary = {
        position: sunPosition,
        color: '#fffefa',
        intensity: 1.5,
        showOrb: true,
        orbColor: '#ffffee',
        orbSize: 18,
      }
      secondary = {
        position: new THREE.Vector3(-sunPosition.x * 0.4, 50, -sunPosition.z * 0.4),
        color: '#aaccff',
        intensity: 0.5,
      }
      sky = { top: '#5090dd', bottom: '#99ccee' }
      ambient = { color: '#eef4ff', intensity: 0.7 }
    }

    return { primary, secondary, sky, ambient, isNight, moon, sunPosition, sunAlt }
  }, [currentTime])

  return (
    <>
      {/* Gradient sky dome with stars */}
      <GradientSky sunAltitude={lighting.sunAlt} />

      {/* Moon with phase-accurate rendering */}
      <Moon {...lighting.moon} />

      {/* Base ambient - guarantees minimum visibility */}
      <ambientLight color="#ffffff" intensity={0.4} />

      {/* Tinted ambient light - adds color based on time */}
      <ambientLight
        color={lighting.ambient.color}
        intensity={lighting.ambient.intensity}
      />

      {/* Hemisphere light for natural ground/sky bounce */}
      <hemisphereLight
        color={lighting.isNight ? '#4466aa' : '#ffeedd'}
        groundColor={lighting.isNight ? '#222233' : '#443333'}
        intensity={0.25}
      />

      {/* Primary orb - sun or moon light */}
      <PrimaryOrb {...lighting.primary} />

      {/* Secondary fill orb - opposite side */}
      <SecondaryOrb {...lighting.secondary} />

      {/* Subtle rim light for depth */}
      <directionalLight
        position={[0, 100, -400]}
        intensity={lighting.isNight ? 0.15 : 0.1}
        color={lighting.isNight ? '#5577aa' : '#ffeedd'}
      />
    </>
  )
}

export default CelestialBodies
