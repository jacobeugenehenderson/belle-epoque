import { useRef, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, MapControls, SoftShadows, ContactShadows } from '@react-three/drei'
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
  const controlsRef = useRef()
  const transitioning = useRef(false)

  const targetPosition = useRef(new THREE.Vector3(200, 150, 200))
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0))

  useEffect(() => {
    transitioning.current = true

    if (viewMode === 'plan') {
      targetPosition.current.set(0, 500, 0.01)
      targetLookAt.current.set(0, 0, 0)
    } else if (viewMode === 'street') {
      targetPosition.current.set(30, 6, 30)
      targetLookAt.current.set(0, 6, 0)
    } else {
      targetPosition.current.set(200, 150, 200)
      targetLookAt.current.set(0, 0, 0)
    }

    setTimeout(() => { transitioning.current = false }, 2000)
  }, [viewMode])

  useFrame(() => {
    if (transitioning.current) {
      camera.position.lerp(targetPosition.current, 0.04)
      if (controlsRef.current) {
        controlsRef.current.target.lerp(targetLookAt.current, 0.04)
        controlsRef.current.update()
      }
    }
  })

  if (viewMode === 'plan') {
    return (
      <MapControls
        ref={controlsRef}
        makeDefault
        enableRotate={false}
        minDistance={80}
        maxDistance={2000}
        panSpeed={2}
        zoomSpeed={1.5}
        screenSpacePanning={true}
      />
    )
  }

  if (viewMode === 'street') {
    return (
      <OrbitControls
        ref={controlsRef}
        makeDefault
        minDistance={3}
        maxDistance={100}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 2.02}
        enablePan={true}
        panSpeed={1}
        rotateSpeed={0.25}
        zoomSpeed={0.5}
        target={[0, 6, 0]}
      />
    )
  }

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      minDistance={30}
      maxDistance={2000}
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI / 2.1}
      enablePan={true}
      panSpeed={1.2}
      rotateSpeed={0.5}
      zoomSpeed={1.2}
    />
  )
}

function Scene() {
  return (
    <Canvas
      camera={{
        position: [200, 150, 200],
        fov: 45,
        near: 1,
        far: 5000,
      }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
      dpr={[1, 2]} // High DPI support
      shadows="soft"
    >
      {/* PCSS soft shadows - realistic distance-based penumbras */}
      <SoftShadows size={52} samples={32} focus={0.35} />

      {/* Time simulation */}
      <TimeTicker />

      {/* Sun, Moon, Sky, and Dynamic Lighting */}
      <CelestialBodies />

      {/* Vector streets - true 3D geometry, sharp at any zoom */}
      <VectorStreets />

      {/* 3D buildings on top */}
      <GeometricCity />

      {/* Camera controls */}
      <CameraRig />

      {/* Contact shadows - soft ambient occlusion where objects meet ground */}
      <ContactShadows
        position={[0, 0.02, 0]}
        opacity={0.5}
        scale={800}
        blur={2.5}
        far={30}
        resolution={512}
      />

      {/* Post-processing for neon glow effects */}
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
