import { useMemo } from 'react'
import * as THREE from 'three'
import streetsData from '../data/streets.json'
import landuseData from '../data/landuse.json'

// Map bounds (from data analysis)
const MAP_BOUNDS = {
  minX: -800,
  maxX: 800,
  minZ: -600,
  maxZ: 700,
}

const MAP_WIDTH = MAP_BOUNDS.maxX - MAP_BOUNDS.minX
const MAP_HEIGHT = MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ

// Texture resolution - higher = sharper
const TEXTURE_SCALE = 4
const TEX_WIDTH = MAP_WIDTH * TEXTURE_SCALE
const TEX_HEIGHT = MAP_HEIGHT * TEXTURE_SCALE

// Convert world coords to canvas coords
function toCanvas(x, z) {
  const cx = (x - MAP_BOUNDS.minX) * TEXTURE_SCALE
  const cy = (z - MAP_BOUNDS.minZ) * TEXTURE_SCALE
  return [cx, cy]
}

// Create the 2D map texture
function createMapTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_WIDTH
  canvas.height = TEX_HEIGHT
  const ctx = canvas.getContext('2d')

  // Background - dark ground
  ctx.fillStyle = '#2a2a30'
  ctx.fillRect(0, 0, TEX_WIDTH, TEX_HEIGHT)

  // Draw land use features first (parks, water, etc.)
  const landuseColors = {
    park: '#2d4a2d',
    grass: '#3a5a3a',
    water: '#2a4060',
    waterway: '#2a4060',
    parking: '#35353d',
    railway: '#28282e',
    residential: '#32323a',
    commercial: '#35353d',
    industrial: '#303038',
  }

  landuseData.features.forEach(feature => {
    if (feature.points.length < 3) return

    ctx.fillStyle = landuseColors[feature.type] || '#2a2a30'
    ctx.beginPath()

    const [startX, startZ] = toCanvas(feature.points[0][0], feature.points[0][1])
    ctx.moveTo(startX, startZ)

    for (let i = 1; i < feature.points.length; i++) {
      const [x, z] = toCanvas(feature.points[i][0], feature.points[i][1])
      ctx.lineTo(x, z)
    }

    ctx.closePath()
    ctx.fill()
  })

  // Street colors by type
  const streetColors = {
    primary: '#4a4a50',
    secondary: '#454548',
    tertiary: '#404045',
    residential: '#3a3a40',
    service: '#353538',
  }

  const streetWidths = {
    primary: 14 * TEXTURE_SCALE,
    secondary: 11 * TEXTURE_SCALE,
    tertiary: 8 * TEXTURE_SCALE,
    residential: 6 * TEXTURE_SCALE,
    service: 4 * TEXTURE_SCALE,
  }

  // Draw streets
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  streetsData.streets.forEach(street => {
    if (street.points.length < 2) return

    const width = streetWidths[street.type] || streetWidths.residential
    const color = streetColors[street.type] || streetColors.residential

    // Road surface
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()

    const [startX, startZ] = toCanvas(street.points[0][0], street.points[0][1])
    ctx.moveTo(startX, startZ)

    for (let i = 1; i < street.points.length; i++) {
      const [x, z] = toCanvas(street.points[i][0], street.points[i][1])
      ctx.lineTo(x, z)
    }

    ctx.stroke()
  })

  // Draw center lines on major roads
  ctx.strokeStyle = '#c9b858'
  ctx.lineWidth = 1 * TEXTURE_SCALE

  streetsData.streets.forEach(street => {
    if (street.type !== 'primary' && street.type !== 'secondary') return
    if (street.points.length < 2) return

    ctx.beginPath()
    const [startX, startZ] = toCanvas(street.points[0][0], street.points[0][1])
    ctx.moveTo(startX, startZ)

    for (let i = 1; i < street.points.length; i++) {
      const [x, z] = toCanvas(street.points[i][0], street.points[i][1])
      ctx.lineTo(x, z)
    }

    ctx.stroke()
  })

  // Create Three.js texture from canvas
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter

  return texture
}

// Component that renders the textured ground
function MapGround() {
  const texture = useMemo(() => createMapTexture(), [])

  // Center of the map data
  const centerX = (MAP_BOUNDS.minX + MAP_BOUNDS.maxX) / 2
  const centerZ = (MAP_BOUNDS.minZ + MAP_BOUNDS.maxZ) / 2

  return (
    <group>
      {/* Extended dark ground underneath */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[4000, 4000]} />
        <meshStandardMaterial color="#1a1a20" roughness={0.95} />
      </mesh>

      {/* Map texture centered on data */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, 0.01, centerZ]} receiveShadow>
        <planeGeometry args={[MAP_WIDTH, MAP_HEIGHT]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.9}
        />
      </mesh>
    </group>
  )
}

export default MapGround
