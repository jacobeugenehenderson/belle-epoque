import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Html } from '@react-three/drei'
import * as THREE from 'three'
import buildingsData from '../data/buildings.json'
import streetsData from '../data/streets.json'
import landuseData from '../data/landuse.json'
import aoData from '../data/building-ao.json'
import landmarksData from '../data/landmarks.json'
import useSelectedBuilding from '../hooks/useSelectedBuilding'
import useBusinessState from '../hooks/useBusinessState'
import useTimeOfDay from '../hooks/useTimeOfDay'
import useCamera from '../hooks/useCamera'
import useLandmarkFilter, { SUBCATEGORY_EMOJI, CATEGORY_EMOJI } from '../hooks/useLandmarkFilter'

// ============ ROAD GEOMETRY BUILDER ============
function buildRoadGeometry(points, width, yOffset) {
  const vec3Points = points.map(([x, z]) => new THREE.Vector3(x, 0, z))

  // Create smooth curve
  let curve
  if (points.length === 2) {
    curve = new THREE.LineCurve3(vec3Points[0], vec3Points[1])
  } else {
    curve = new THREE.CatmullRomCurve3(vec3Points, false, 'catmullrom', 0.5)
  }

  // Very high resolution sampling for smooth curves
  const divisions = Math.max(points.length * 50, 200)
  const sampledPoints = curve.getPoints(divisions)

  const vertices = []
  const indices = []
  const halfWidth = width / 2

  for (let i = 0; i < sampledPoints.length; i++) {
    const p = sampledPoints[i]

    let tangent
    if (i === 0) {
      tangent = new THREE.Vector3().subVectors(sampledPoints[1], sampledPoints[0]).normalize()
    } else if (i === sampledPoints.length - 1) {
      tangent = new THREE.Vector3().subVectors(sampledPoints[i], sampledPoints[i - 1]).normalize()
    } else {
      tangent = new THREE.Vector3().subVectors(sampledPoints[i + 1], sampledPoints[i - 1]).normalize()
    }

    const perp = new THREE.Vector3(-tangent.z, 0, tangent.x)

    vertices.push(
      p.x + perp.x * halfWidth, yOffset, p.z + perp.z * halfWidth,
      p.x - perp.x * halfWidth, yOffset, p.z - perp.z * halfWidth
    )

    if (i > 0) {
      const base = (i - 1) * 2
      indices.push(base, base + 2, base + 1)
      indices.push(base + 1, base + 2, base + 3)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

// ============ SMOOTH ROAD WITH CENTER MARKINGS ============
function Road({ street }) {
  const points = street.points
  if (!points || points.length < 2) return null

  const isPrimary = street.type === 'primary' || street.type === 'secondary'

  // Road widths
  const width = street.type === 'primary' ? 14 :
                street.type === 'secondary' ? 11 :
                street.type === 'tertiary' ? 8 : 6

  const { roadGeo, lineGeo } = useMemo(() => {
    try {
      const roadGeo = buildRoadGeometry(points, width, 0.15)
      const lineGeo = isPrimary ? buildRoadGeometry(points, 0.5, 0.18) : null
      return { roadGeo, lineGeo }
    } catch (e) {
      return { roadGeo: null, lineGeo: null }
    }
  }, [points, width, isPrimary])

  if (!roadGeo) return null

  // Lighter asphalt colors - clearly visible
  const roadColor = street.type === 'primary' ? '#555555' :
                    street.type === 'secondary' ? '#4d4d4d' :
                    street.type === 'tertiary' ? '#454545' : '#404040'

  return (
    <group>
      {/* Road surface */}
      <mesh geometry={roadGeo} receiveShadow>
        <meshStandardMaterial color={roadColor} roughness={0.9} />
      </mesh>

      {/* Yellow center line for major roads */}
      {lineGeo && (
        <mesh geometry={lineGeo}>
          <meshStandardMaterial
            color="#d4c46a"
            emissive="#d4c46a"
            emissiveIntensity={0.15}
            roughness={0.4}
          />
        </mesh>
      )}
    </group>
  )
}

// ============ LAND USE ============
function LandUseFeature({ feature }) {
  const geometry = useMemo(() => {
    const pts = feature.points
    if (pts.length < 3) return null

    try {
      const shape = new THREE.Shape()
      shape.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length; i++) {
        shape.lineTo(pts[i][0], pts[i][1])
      }
      shape.closePath()

      const geo = new THREE.ShapeGeometry(shape)
      geo.rotateX(-Math.PI / 2)
      return geo
    } catch (e) {
      return null
    }
  }, [feature.points])

  if (!geometry) return null

  // Richer, more vibrant land use colors
  const colors = {
    park: '#2d4a2d',
    grass: '#3a5a3a',
    water: '#2a4060',
    waterway: '#2a4060',
    parking: '#35353d',
    railway: '#28282e',
    residential: '#3a3a40',
    commercial: '#3d3d45',
    industrial: '#333338',
  }

  return (
    <mesh geometry={geometry} position={[0, -0.02, 0]} receiveShadow>
      <meshStandardMaterial color={colors[feature.type] || '#1a1a22'} roughness={0.95} />
    </mesh>
  )
}

// ============ STREET LABELS ============
function StreetLabel({ street }) {
  if (!street.name) return null

  const points = street.points
  if (points.length < 2) return null

  // Calculate total length
  let totalLen = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0]
    const dz = points[i][1] - points[i - 1][1]
    totalLen += Math.sqrt(dx * dx + dz * dz)
  }

  // Skip short streets
  if (totalLen < 80) return null

  // Find point at 50% of street length for label placement
  let targetDist = totalLen * 0.5
  let accumulated = 0
  let labelX = points[0][0], labelZ = points[0][1]
  let angle = 0

  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0]
    const dz = points[i][1] - points[i - 1][1]
    const segLen = Math.sqrt(dx * dx + dz * dz)

    if (accumulated + segLen >= targetDist) {
      const t = (targetDist - accumulated) / segLen
      labelX = points[i - 1][0] + dx * t
      labelZ = points[i - 1][1] + dz * t
      angle = Math.atan2(dz, dx)
      break
    }
    accumulated += segLen
  }

  // Keep text readable (not upside down)
  if (angle > Math.PI / 2) angle -= Math.PI
  if (angle < -Math.PI / 2) angle += Math.PI

  const isPrimary = street.type === 'primary' || street.type === 'secondary'
  const fontSize = isPrimary ? 5 : 3.5
  const text = street.name.toUpperCase()

  return (
    <group position={[labelX, 2.5, labelZ]} rotation={[-Math.PI / 2, 0, -angle]}>
      <Text
        fontSize={fontSize}
        color={isPrimary ? '#c8c8d0' : '#888890'}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        outlineWidth={fontSize * 0.2}
        outlineColor="#14141c"
      >
        {text}
      </Text>
    </group>
  )
}

// ============ PUBLIC SQUARE ============
// Scaled to fit inside the 16m radius roundabout at center
function PublicSquare() {
  return (
    <group position={[75, 0, 62]}>
      {/* Plaza base - above road level (roads are at y=0.16) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
        <circleGeometry args={[14, 64]} />
        <meshStandardMaterial color="#28282f" roughness={0.85} />
      </mesh>

      {/* Inner circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.22, 0]}>
        <circleGeometry args={[10, 64]} />
        <meshStandardMaterial color="#303038" roughness={0.8} />
      </mesh>

      {/* Fountain base */}
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[4, 5, 1.2, 32]} />
        <meshStandardMaterial color="#484850" roughness={0.6} />
      </mesh>

      {/* Fountain middle */}
      <mesh position={[0, 1.7, 0]}>
        <cylinderGeometry args={[2, 3, 1, 24]} />
        <meshStandardMaterial color="#585860" roughness={0.5} />
      </mesh>

      {/* Fountain top */}
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.8, 1.5, 1, 16]} />
        <meshStandardMaterial color="#686870" roughness={0.4} />
      </mesh>

      {/* Water */}
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[3.5, 3.5, 0.2, 32]} />
        <meshStandardMaterial color="#4080b0" transparent opacity={0.5} />
      </mesh>

      {/* Label - positioned north of fountain (negative z) */}
      <Text
        position={[0, 4, -20]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={5}
        color="#e8e8f0"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.15}
        outlineWidth={0.6}
        outlineColor="#14141c"
      >
        PUBLIC SQUARE
      </Text>
      <Text
        position={[0, 4, -27]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={2.5}
        color="#888890"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        outlineWidth={0.3}
        outlineColor="#14141c"
      >
        BELLEVILLE · EST. 1814
      </Text>
    </group>
  )
}

// ============ NEON BAND ============
// Creates a glowing tube around the top perimeter of a building
function NeonBand({ building }) {
  const bandRef = useRef()
  const prevStateRef = useRef({ isOpen: null, shouldGlow: null })
  const getLightingPhase = useTimeOfDay((state) => state.getLightingPhase)
  const baseColor = useMemo(() => new THREE.Color(building.color), [building.color])

  // Create tube geometry around the top perimeter
  const bandGeometry = useMemo(() => {
    const height = building.size[1]
    const bandRadius = 0.075 // Thickness of neon tube - small and clean
    const footprint = building.footprint

    // Get the perimeter points at building top
    let points = []
    if (!footprint || footprint.length < 3) {
      // Box building - create rectangle
      const [w, , d] = building.size
      const hw = w / 2, hd = d / 2
      points = [
        new THREE.Vector3(-hw, height, -hd),
        new THREE.Vector3(hw, height, -hd),
        new THREE.Vector3(hw, height, hd),
        new THREE.Vector3(-hw, height, hd),
        new THREE.Vector3(-hw, height, -hd), // Close the loop
      ]
    } else {
      // Custom footprint - negate Z to match building's rotated geometry
      points = footprint.map(([x, z]) =>
        new THREE.Vector3(x - building.position[0], height, -(z - building.position[2]))
      )
      // Close the loop
      points.push(points[0].clone())
    }

    // Create a path from the points
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0)

    // Create tube geometry along the path
    const tubeGeo = new THREE.TubeGeometry(curve, points.length * 8, bandRadius, 8, false)
    return tubeGeo
  }, [building])

  // Emissive material for bloom - starts invisible
  const bandMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: baseColor,
    emissive: baseColor,
    emissiveIntensity: 0,
    roughness: 0.3,
    metalness: 0.1,
    transparent: true,
    opacity: 0,
  }), [baseColor])

  useFrame(() => {
    if (!bandRef.current) return
    const mat = bandRef.current.material
    const { shouldGlow } = getLightingPhase()
    // Read current state directly to avoid stale closures
    const isOpen = useBusinessState.getState().openBuildings.has(building.id)

    // Check if state changed
    const prev = prevStateRef.current
    const stateChanged = prev.isOpen !== isOpen || prev.shouldGlow !== shouldGlow

    if (stateChanged) {
      prev.isOpen = isOpen
      prev.shouldGlow = shouldGlow

      if (shouldGlow && isOpen) {
        mat.opacity = 1
        mat.emissiveIntensity = 2.5
        mat.color.copy(baseColor)
        mat.emissive.copy(baseColor)
      } else {
        mat.opacity = 0
        mat.emissiveIntensity = 0
      }
    }
  })

  return (
    <mesh
      ref={bandRef}
      position={[building.position[0], 0, building.position[2]]}
      geometry={bandGeometry}
      material={bandMaterial}
    />
  )
}

// ============ BUILDINGS ============
const NEUTRAL_GRAY = new THREE.Color(0x2a2a2a)

function Building({ building }) {
  const meshRef = useRef()
  const prevStateRef = useRef({ isOpen: null, shouldGlow: null })
  const { selectedId, hoveredId, select, setHovered, clearHovered } = useSelectedBuilding()
  const getLightingPhase = useTimeOfDay((state) => state.getLightingPhase)
  const enterStreetView = useCamera((state) => state.enterStreetView)

  const isSelected = selectedId === building.id
  const isHovered = hoveredId === building.id
  const baseColor = useMemo(() => new THREE.Color(building.color), [building.color])

  const geometry = useMemo(() => {
    const footprint = building.footprint
    let geo

    if (!footprint || footprint.length < 3) {
      geo = new THREE.BoxGeometry(building.size[0], building.size[1], building.size[2])
      // Translate up so bottom sits at y=0 (BoxGeometry is centered by default)
      geo.translate(0, building.size[1] / 2, 0)
    } else {
      try {
        const shape = new THREE.Shape()
        shape.moveTo(footprint[0][0] - building.position[0], footprint[0][1] - building.position[2])
        for (let i = 1; i < footprint.length; i++) {
          shape.lineTo(footprint[i][0] - building.position[0], footprint[i][1] - building.position[2])
        }
        shape.closePath()

        geo = new THREE.ExtrudeGeometry(shape, { depth: building.size[1], bevelEnabled: false })
        geo.rotateX(-Math.PI / 2)
      } catch (e) {
        geo = new THREE.BoxGeometry(building.size[0], building.size[1], building.size[2])
        geo.translate(0, building.size[1] / 2, 0)
      }
    }

    // Apply baked AO as vertex colors
    const ao = aoData[building.id]
    if (ao && ao.length === geo.attributes.position.count) {
      const colors = new Float32Array(ao.length * 3)
      for (let i = 0; i < ao.length; i++) {
        const aoVal = ao[i]
        // Modulate base color by AO
        colors[i * 3] = baseColor.r * aoVal
        colors[i * 3 + 1] = baseColor.g * aoVal
        colors[i * 3 + 2] = baseColor.b * aoVal
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    }

    return geo
  }, [building, baseColor])

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: !!aoData[building.id],
    color: aoData[building.id] ? 0xffffff : baseColor,
    flatShading: true,
    roughness: 0.9,
    metalness: 0.05,
  }), [baseColor, building.id])

  useFrame(() => {
    if (!meshRef.current) return
    const mat = meshRef.current.material
    const { shouldGlow } = getLightingPhase()
    // Read current state directly to avoid stale closures
    const isOpen = useBusinessState.getState().openBuildings.has(building.id)

    // Check if state changed to avoid unnecessary updates
    const prev = prevStateRef.current
    const stateChanged = prev.isOpen !== isOpen || prev.shouldGlow !== shouldGlow

    if (stateChanged) {
      prev.isOpen = isOpen
      prev.shouldGlow = shouldGlow

      if (shouldGlow && !isOpen) {
        // Neutral gray for closed buildings at night
        // Disable vertex colors so gray shows through uniformly
        mat.vertexColors = false
        mat.color.copy(NEUTRAL_GRAY)
        mat.emissive.setHex(0x000000)
        mat.emissiveIntensity = 0
        mat.needsUpdate = true
      } else {
        // Daytime OR open at night - restore normal appearance
        mat.vertexColors = !!aoData[building.id]
        if (aoData[building.id]) {
          mat.color.setHex(0xffffff)
        } else {
          mat.color.copy(baseColor)
        }
        mat.emissive.setHex(0x000000)
        mat.emissiveIntensity = 0
        mat.needsUpdate = true
      }
    }

    // Apply selection/hover highlight on top
    if (isSelected) {
      mat.emissive.setHex(0x333333)
    } else if (isHovered) {
      mat.emissive.setHex(0x222222)
    }
  })

  return (
    <group>
      <mesh
        ref={meshRef}
        position={[building.position[0], 0, building.position[2]]}
        geometry={geometry}
        material={material}
        castShadow
        receiveShadow
        onPointerOver={(e) => { e.stopPropagation(); setHovered(building.id); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { clearHovered(); document.body.style.cursor = 'auto' }}
        onClick={(e) => { e.stopPropagation(); select(building.id) }}
        onDoubleClick={(e) => { e.stopPropagation(); enterStreetView(building.position) }}
      />
      <NeonBand building={building} />
    </group>
  )
}

function ClickCatcher() {
  const deselect = useSelectedBuilding((state) => state.deselect)
  return (
    <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={() => deselect()}>
      <planeGeometry args={[2000, 2000]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  )
}

// ============ FLOATING EMOJI MARKERS ============

function FloatingEmoji({ landmark, building }) {
  const select = useSelectedBuilding((state) => state.select)

  const emoji = SUBCATEGORY_EMOJI[landmark.subcategory] || CATEGORY_EMOJI[landmark.category] || '📍'
  const height = building.size[1] + 25 // Float high above building

  return (
    <group position={[building.position[0], height, building.position[2]]}>
      <Html center zIndexRange={[1, 10]}>
        <div
          style={{
            fontSize: '48px',
            cursor: 'pointer',
            userSelect: 'none',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.9))',
          }}
          onClick={(e) => { e.stopPropagation(); select(landmark.id) }}
        >
          {emoji}
        </div>
      </Html>
    </group>
  )
}

function LandmarkMarkers() {
  const activeTags = useLandmarkFilter((state) => state.activeTags)

  // Get filtered landmarks
  const filteredLandmarks = useMemo(() => {
    if (activeTags.size === 0) return []
    return landmarksData.landmarks.filter(l =>
      activeTags.has(l.subcategory) || activeTags.has(l.category)
    )
  }, [activeTags])

  // Build lookup for buildings
  const buildingMap = useMemo(() => {
    const map = {}
    buildingsData.buildings.forEach(b => { map[b.id] = b })
    return map
  }, [])

  if (filteredLandmarks.length === 0) return null

  return (
    <group>
      {filteredLandmarks.map(landmark => {
        const building = buildingMap[landmark.id]
        if (!building) return null
        return (
          <FloatingEmoji
            key={landmark.id}
            landmark={landmark}
            building={building}
          />
        )
      })}
    </group>
  )
}

// ============ MAIN ============
function GeometricCity() {
  const deselect = useSelectedBuilding((state) => state.deselect)
  const randomize = useBusinessState((state) => state.randomize)

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') deselect() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deselect])

  // Initialize business state on mount
  useEffect(() => {
    const ids = buildingsData.buildings.map(b => b.id)
    randomize(ids, 65)
  }, [])

  // Dedupe street labels
  const labeledStreets = useMemo(() => {
    const seen = new Set()
    return streetsData.streets
      .filter(s => {
        if (!s.name || seen.has(s.name)) return false
        seen.add(s.name)
        return true
      })
      .sort((a, b) => {
        const order = { primary: 0, secondary: 1, tertiary: 2, residential: 3 }
        return (order[a.type] || 4) - (order[b.type] || 4)
      })
  }, [])

  return (
    <group>
      <ClickCatcher />

      {/* Land use and roads rendered by VectorStreets */}

      {/* Public Square plaza (inside the roundabout at center) */}
      <PublicSquare />

      {/* Buildings */}
      {buildingsData.buildings.map(b => (
        <Building key={b.id} building={b} />
      ))}

      {/* Street labels (top 30) */}
      {labeledStreets.slice(0, 30).map(s => (
        <StreetLabel key={`label-${s.id}`} street={s} />
      ))}

      {/* Landmark markers - floating emojis when tags are active */}
      <LandmarkMarkers />
    </group>
  )
}

export default GeometricCity
