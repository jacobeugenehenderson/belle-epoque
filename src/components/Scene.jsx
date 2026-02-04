import { useRef, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, SoftShadows, ContactShadows } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import GeometricCity from './GeometricCity'
import CelestialBodies from './CelestialBodies'
import VectorStreets from './VectorStreets'
import useCamera from '../hooks/useCamera'
import useTimeOfDay from '../hooks/useTimeOfDay'

// Advances the simulation time each frame
function TimeTicker() {
  const tick = useTimeOfDay((state) => state.tick)
  const lastTime = useRef(Date.now())

  useFrame(() => {
    const now = Date.now()
    const delta = now - lastTime.current
    lastTime.current = now
    tick(delta)
  })

  return null
}

function CameraRig() {
  const { camera } = useThree()
  const viewMode = useCamera((state) => state.viewMode)
  const streetTarget = useCamera((state) => state.streetTarget)
  const exitToPlan = useCamera((state) => state.exitToPlan)
  const setAzimuth = useCamera((state) => state.setAzimuth)
  const controlsRef = useRef()
  const transitioning = useRef(false)
  const transitionStart = useRef(0)

  // Public Square is at [75, 0, 62]
  // Camera offset rotated ~30° CCW so North is up (N/S streets vertical)
  const PUBLIC_SQUARE = { x: 75, z: 62 }
  const PLAN_OFFSET = { x: 1.75, z: 100 } // +Z with 1° CW tweak for aesthetics

  const targetPosition = useRef(new THREE.Vector3(
    PUBLIC_SQUARE.x + PLAN_OFFSET.x,
    400,
    PUBLIC_SQUARE.z + PLAN_OFFSET.z
  ))
  const targetLookAt = useRef(new THREE.Vector3(PUBLIC_SQUARE.x, 0, PUBLIC_SQUARE.z))

  // Handle ESC key to exit street view
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && viewMode === 'street') {
        exitToPlan()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewMode, exitToPlan])

  // Handle view mode changes
  useEffect(() => {
    transitioning.current = true
    transitionStart.current = Date.now()

    if (viewMode === 'street' && streetTarget) {
      // Position camera near the target at eye level, offset slightly
      const offset = 15
      targetPosition.current.set(
        streetTarget[0] + offset,
        8, // Eye level
        streetTarget[2] + offset
      )
      targetLookAt.current.set(streetTarget[0], 6, streetTarget[2])
    } else {
      // Plan view - straight down on Public Square, North up
      targetPosition.current.set(
        PUBLIC_SQUARE.x + PLAN_OFFSET.x,
        400,
        PUBLIC_SQUARE.z + PLAN_OFFSET.z
      )
      targetLookAt.current.set(PUBLIC_SQUARE.x, 0, PUBLIC_SQUARE.z)
    }

    // End transition after animation completes
    const timer = setTimeout(() => { transitioning.current = false }, 1500)
    return () => clearTimeout(timer)
  }, [viewMode, streetTarget])

  useFrame(() => {
    // Smooth camera transition
    if (transitioning.current) {
      const elapsed = Date.now() - transitionStart.current
      const t = Math.min(elapsed / 1200, 1)
      // Ease out cubic
      const ease = 1 - Math.pow(1 - t, 3)

      camera.position.lerp(targetPosition.current, ease * 0.08)
      if (controlsRef.current) {
        controlsRef.current.target.lerp(targetLookAt.current, ease * 0.08)
        controlsRef.current.update()
      }
    }

    // Update azimuth for compass
    if (controlsRef.current) {
      const spherical = new THREE.Spherical()
      const offset = new THREE.Vector3()
      offset.copy(camera.position).sub(controlsRef.current.target)
      spherical.setFromVector3(offset)
      // Theta is the azimuth angle
      setAzimuth(spherical.theta)
    }
  })

  if (viewMode === 'street') {
    return (
      <OrbitControls
        ref={controlsRef}
        makeDefault
        minDistance={5}
        maxDistance={80}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2.05}
        enablePan={true}
        panSpeed={0.8}
        rotateSpeed={0.3}
        zoomSpeed={0.6}
        target={streetTarget ? [streetTarget[0], 6, streetTarget[2]] : [0, 6, 0]}
      />
    )
  }

  // Plan mode - allows tilt and rotation, centered on Public Square
  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      minDistance={30}
      maxDistance={2000}
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI / 2.2}
      enablePan={true}
      panSpeed={1.5}
      rotateSpeed={0.5}
      zoomSpeed={1.2}
      target={[75, 0, 62]}
    />
  )
}

function Scene() {
  return (
    <Canvas
      camera={{
        // Centered on Public Square, looking straight down, North up
        position: [75, 400, 63],
        fov: 45,
        near: 1,
        far: 5000,
      }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
      dpr={[1, 2]}
      shadows="soft"
    >
      <SoftShadows size={52} samples={32} focus={0.35} />
      <TimeTicker />
      <CelestialBodies />
      <VectorStreets />
      <GeometricCity />
      <CameraRig />
      <ContactShadows
        position={[0, 0.02, 0]}
        opacity={0.5}
        scale={800}
        blur={2.5}
        far={30}
        resolution={512}
      />
      <EffectComposer>
        <Bloom
          intensity={1.2}
          luminanceThreshold={0.3}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  )
}

export default Scene
