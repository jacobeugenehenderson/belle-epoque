import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
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

// Sky dome with gradient
function SkyDome({ topColor, bottomColor }) {
  const materialRef = useRef()

  // Update uniforms every frame to ensure they're current
  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.topColor.value.set(topColor)
      materialRef.current.uniforms.bottomColor.value.set(bottomColor)
    }
  })

  return (
    <mesh>
      <sphereGeometry args={[3000, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={{
          topColor: { value: new THREE.Color(topColor) },
          bottomColor: { value: new THREE.Color(bottomColor) },
        }}
        vertexShader={`
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 topColor;
          uniform vec3 bottomColor;
          varying vec3 vWorldPosition;
          void main() {
            float h = normalize(vWorldPosition).y;
            float t = smoothstep(-0.1, 0.5, h);
            gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
          }
        `}
        side={THREE.BackSide}
      />
    </mesh>
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

    if (isNight) {
      // Night: Moon is primary, blue tones
      const moonBrightness = 0.3 + moonIllum.fraction * 0.4
      primary = {
        position: moonAlt > 0 ? moonPosition : new THREE.Vector3(200, 150, 200),
        color: '#9ab8e0',
        intensity: moonBrightness,
        showOrb: moonAlt > 0,
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

    return { primary, secondary, sky, ambient, isNight }
  }, [currentTime])

  return (
    <>
      {/* Sky gradient dome */}
      <SkyDome topColor={lighting.sky.top} bottomColor={lighting.sky.bottom} />

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

      {/* Primary orb - sun or moon */}
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
