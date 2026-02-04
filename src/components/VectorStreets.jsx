import { useMemo } from 'react'
import * as THREE from 'three'
import streetsData from '../data/streets.json'
import landuseData from '../data/landuse.json'

// Street widths by type
const STREET_WIDTHS = {
  primary: 14,
  secondary: 11,
  tertiary: 8,
  residential: 6,
  service: 4,
}

// Y-offset for layering (larger roads on top)
const STREET_Y_OFFSET = {
  primary: 0.16,
  secondary: 0.14,
  tertiary: 0.12,
  residential: 0.10,
  service: 0.08,
}

// Street colors
const STREET_COLORS = {
  primary: '#4a4a50',
  secondary: '#454548',
  tertiary: '#404045',
  residential: '#3a3a40',
  service: '#353538',
}

// Land use colors
const LANDUSE_COLORS = {
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

// Calculate total path length
function getPathLength(points) {
  let length = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i-1][0]
    const dz = points[i][1] - points[i-1][1]
    length += Math.sqrt(dx * dx + dz * dz)
  }
  return length
}

// Catmull-Rom spline interpolation for smooth curves
function catmullRomSpline(points, numSegments) {
  if (points.length < 2) return points
  if (points.length === 2) {
    // Linear interpolation for 2 points
    const result = []
    for (let i = 0; i <= numSegments; i++) {
      const t = i / numSegments
      result.push([
        points[0][0] + (points[1][0] - points[0][0]) * t,
        points[0][1] + (points[1][1] - points[0][1]) * t
      ])
    }
    return result
  }

  const result = []

  // Extend points array with phantom points for smooth ends
  const extended = [
    [2 * points[0][0] - points[1][0], 2 * points[0][1] - points[1][1]],
    ...points,
    [2 * points[points.length-1][0] - points[points.length-2][0],
     2 * points[points.length-1][1] - points[points.length-2][1]]
  ]

  // Segments per original segment, based on total desired segments
  const segsPerSection = Math.max(2, Math.ceil(numSegments / (points.length - 1)))

  for (let i = 1; i < extended.length - 2; i++) {
    const p0 = extended[i - 1]
    const p1 = extended[i]
    const p2 = extended[i + 1]
    const p3 = extended[i + 2]

    for (let j = 0; j < segsPerSection; j++) {
      const t = j / segsPerSection
      const t2 = t * t
      const t3 = t2 * t

      // Catmull-Rom basis functions (tension = 0.5)
      const x = 0.5 * (
        (2 * p1[0]) +
        (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
      )
      const z = 0.5 * (
        (2 * p1[1]) +
        (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
      )
      result.push([x, z])
    }
  }

  // Add final point
  result.push([points[points.length-1][0], points[points.length-1][1]])

  return result
}

// Build road geometry with Catmull-Rom spline smoothing and adaptive segmentation
function buildRoadGeometry(points, width, yOffset = 0.1) {
  if (points.length < 2) return null

  // Calculate path length for adaptive segment count
  const pathLength = getPathLength(points)

  // Adaptive segments: more segments for longer/curvier roads
  // Base: 1 segment per 2 units of length, minimum 8, maximum 400
  const baseSegments = Math.ceil(pathLength / 2)
  const numSegments = Math.min(400, Math.max(8, baseSegments))

  // Apply Catmull-Rom smoothing (skip for very short paths)
  const smoothedPoints = points.length >= 3 && pathLength > 10
    ? catmullRomSpline(points, numSegments)
    : points

  const halfWidth = width / 2
  const vertices = []
  const indices = []

  // Miter limit: prevent spikes at sharp angles (max 2x width extension)
  const miterLimit = 2.0

  // Calculate perpendicular direction at each point using averaged tangent
  const perps = []
  const miterScales = []

  for (let i = 0; i < smoothedPoints.length; i++) {
    let tangent
    let miterScale = 1.0

    if (i === 0) {
      // First point: use direction to next point
      tangent = [
        smoothedPoints[1][0] - smoothedPoints[0][0],
        smoothedPoints[1][1] - smoothedPoints[0][1]
      ]
    } else if (i === smoothedPoints.length - 1) {
      // Last point: use direction from previous point
      tangent = [
        smoothedPoints[i][0] - smoothedPoints[i-1][0],
        smoothedPoints[i][1] - smoothedPoints[i-1][1]
      ]
    } else {
      // Middle points: compute miter join
      const t1 = [
        smoothedPoints[i][0] - smoothedPoints[i-1][0],
        smoothedPoints[i][1] - smoothedPoints[i-1][1]
      ]
      const t2 = [
        smoothedPoints[i+1][0] - smoothedPoints[i][0],
        smoothedPoints[i+1][1] - smoothedPoints[i][1]
      ]

      // Normalize
      const len1 = Math.sqrt(t1[0]*t1[0] + t1[1]*t1[1]) || 1
      const len2 = Math.sqrt(t2[0]*t2[0] + t2[1]*t2[1]) || 1
      const n1 = [t1[0]/len1, t1[1]/len1]
      const n2 = [t2[0]/len2, t2[1]/len2]

      // Average tangent
      tangent = [n1[0] + n2[0], n1[1] + n2[1]]

      // Calculate miter scale based on angle between segments
      const dot = n1[0] * n2[0] + n1[1] * n2[1]
      // Clamp dot product to valid range
      const clampedDot = Math.max(-1, Math.min(1, dot))
      const angle = Math.acos(clampedDot)

      // Miter scale = 1 / cos(angle/2)
      const halfAngle = angle / 2
      if (halfAngle > 0.01) {
        miterScale = 1 / Math.cos(halfAngle)
        // Apply miter limit
        miterScale = Math.min(miterScale, miterLimit)
      }
    }

    // Normalize tangent
    const len = Math.sqrt(tangent[0]*tangent[0] + tangent[1]*tangent[1]) || 1
    // Perpendicular (rotate 90 degrees)
    perps.push([-tangent[1]/len, tangent[0]/len])
    miterScales.push(miterScale)
  }

  // Create vertices at each point
  for (let i = 0; i < smoothedPoints.length; i++) {
    const [x, z] = smoothedPoints[i]
    const [px, pz] = perps[i]
    const scale = miterScales[i]
    const adjustedHalfWidth = halfWidth * scale

    vertices.push(
      x + px * adjustedHalfWidth, yOffset, z + pz * adjustedHalfWidth,
      x - px * adjustedHalfWidth, yOffset, z - pz * adjustedHalfWidth
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

// Build rounded end cap geometry
function buildEndCap(centerX, centerZ, perpX, perpZ, halfWidth, yOffset, isStart, baseIndex) {
  const vertices = []
  const indices = []
  const segments = 8 // Number of segments for semicircle

  // Direction for the cap (pointing away from road)
  const dirX = isStart ? -perpZ : perpZ
  const dirZ = isStart ? perpX : -perpX

  // Center vertex
  vertices.push(centerX, yOffset, centerZ)
  const centerIdx = baseIndex

  // Arc vertices
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    // Rotate around perpendicular axis
    const x = centerX + (perpX * cos + dirX * sin) * halfWidth
    const z = centerZ + (perpZ * cos + dirZ * sin) * halfWidth
    vertices.push(x, yOffset, z)

    if (i > 0) {
      indices.push(centerIdx, baseIndex + i, baseIndex + i + 1)
    }
  }

  return { vertices, indices, vertexCount: segments + 2 }
}

// Build road geometry with optional rounded end caps
function buildRoadGeometryWithCaps(points, width, yOffset = 0.1, addCaps = false) {
  const mainGeo = buildRoadGeometry(points, width, yOffset)
  if (!mainGeo || !addCaps || points.length < 2) return mainGeo

  // Get first and last points and perpendiculars for caps
  const smoothedLen = mainGeo.attributes.position.count / 2

  // Extract first and last perpendiculars from the geometry
  const pos = mainGeo.attributes.position.array

  // First point cap
  const x0 = (pos[0] + pos[3]) / 2
  const z0 = (pos[2] + pos[5]) / 2
  const px0 = (pos[0] - pos[3]) / width
  const pz0 = (pos[2] - pos[5]) / width

  // Last point cap
  const lastBase = (smoothedLen - 1) * 6
  const xN = (pos[lastBase] + pos[lastBase + 3]) / 2
  const zN = (pos[lastBase + 2] + pos[lastBase + 5]) / 2
  const pxN = (pos[lastBase] - pos[lastBase + 3]) / width
  const pzN = (pos[lastBase + 2] - pos[lastBase + 5]) / width

  const halfWidth = width / 2

  // Build caps
  const startCap = buildEndCap(x0, z0, px0, pz0, halfWidth, yOffset, true, smoothedLen)
  const endCap = buildEndCap(xN, zN, pxN, pzN, halfWidth, yOffset, false, smoothedLen + startCap.vertexCount)

  // Merge main geometry with caps
  const totalVertices = mainGeo.attributes.position.count + startCap.vertexCount + endCap.vertexCount
  const totalIndices = mainGeo.index.count + startCap.indices.length + endCap.indices.length

  const newPositions = new Float32Array(totalVertices * 3)
  const newIndices = new Uint32Array(totalIndices)

  // Copy main geometry
  newPositions.set(mainGeo.attributes.position.array)
  newIndices.set(mainGeo.index.array)

  // Add start cap
  let vOffset = mainGeo.attributes.position.count * 3
  for (let i = 0; i < startCap.vertices.length; i++) {
    newPositions[vOffset + i] = startCap.vertices[i]
  }
  let iOffset = mainGeo.index.count
  for (let i = 0; i < startCap.indices.length; i++) {
    newIndices[iOffset + i] = startCap.indices[i]
  }

  // Add end cap
  vOffset += startCap.vertices.length
  for (let i = 0; i < endCap.vertices.length; i++) {
    newPositions[vOffset + i] = endCap.vertices[i]
  }
  iOffset += startCap.indices.length
  for (let i = 0; i < endCap.indices.length; i++) {
    newIndices[iOffset + i] = endCap.indices[i]
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(newPositions, 3))
  geo.setIndex(new THREE.BufferAttribute(newIndices, 1))
  geo.computeVertexNormals()

  mainGeo.dispose()
  return geo
}

// Build center line geometry (above primary roads) - higher resolution for visibility
function buildCenterLineGeometry(points, width = 0.5) {
  return buildRoadGeometry(points, width, 0.18)
}

// Batch all streets of a type into one geometry for performance
function BatchedStreets({ streets, type }) {
  const geometry = useMemo(() => {
    const geometries = []
    const width = STREET_WIDTHS[type] || STREET_WIDTHS.residential
    const yOffset = STREET_Y_OFFSET[type] || 0.1
    // Add rounded caps for major roads
    const addCaps = type === 'primary' || type === 'secondary'

    streets.forEach(street => {
      if (street.points && street.points.length >= 2) {
        const geo = addCaps
          ? buildRoadGeometryWithCaps(street.points, width, yOffset, true)
          : buildRoadGeometry(street.points, width, yOffset)
        if (geo) geometries.push(geo)
      }
    })

    if (geometries.length === 0) return null

    // Merge all geometries
    const merged = mergeBufferGeometries(geometries)
    geometries.forEach(g => g.dispose())
    return merged
  }, [streets, type])

  if (!geometry) return null

  const color = STREET_COLORS[type] || STREET_COLORS.residential
  // Slightly varied roughness by road type for subtle visual hierarchy
  const roughness = type === 'primary' ? 0.85 : type === 'secondary' ? 0.87 : 0.9

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  )
}

// Build offset line geometry for edge markings
function buildOffsetLineGeometry(points, lineWidth, offset, yOffset) {
  if (points.length < 2) return null

  const pathLength = getPathLength(points)
  const baseSegments = Math.ceil(pathLength / 2)
  const numSegments = Math.min(400, Math.max(8, baseSegments))

  const smoothedPoints = points.length >= 3 && pathLength > 10
    ? catmullRomSpline(points, numSegments)
    : points

  const halfWidth = lineWidth / 2
  const vertices = []
  const indices = []

  // Calculate perpendiculars
  const perps = []
  for (let i = 0; i < smoothedPoints.length; i++) {
    let tangent
    if (i === 0) {
      tangent = [smoothedPoints[1][0] - smoothedPoints[0][0], smoothedPoints[1][1] - smoothedPoints[0][1]]
    } else if (i === smoothedPoints.length - 1) {
      tangent = [smoothedPoints[i][0] - smoothedPoints[i-1][0], smoothedPoints[i][1] - smoothedPoints[i-1][1]]
    } else {
      const t1 = [smoothedPoints[i][0] - smoothedPoints[i-1][0], smoothedPoints[i][1] - smoothedPoints[i-1][1]]
      const t2 = [smoothedPoints[i+1][0] - smoothedPoints[i][0], smoothedPoints[i+1][1] - smoothedPoints[i][1]]
      const len1 = Math.sqrt(t1[0]*t1[0] + t1[1]*t1[1]) || 1
      const len2 = Math.sqrt(t2[0]*t2[0] + t2[1]*t2[1]) || 1
      tangent = [t1[0]/len1 + t2[0]/len2, t1[1]/len1 + t2[1]/len2]
    }
    const len = Math.sqrt(tangent[0]*tangent[0] + tangent[1]*tangent[1]) || 1
    perps.push([-tangent[1]/len, tangent[0]/len])
  }

  // Create vertices offset from center line
  for (let i = 0; i < smoothedPoints.length; i++) {
    const [x, z] = smoothedPoints[i]
    const [px, pz] = perps[i]
    // Offset the entire line by the specified amount
    const cx = x + px * offset
    const cz = z + pz * offset

    vertices.push(
      cx + px * halfWidth, yOffset, cz + pz * halfWidth,
      cx - px * halfWidth, yOffset, cz - pz * halfWidth
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

// Center lines for major roads
function CenterLines({ streets }) {
  const geometry = useMemo(() => {
    const geometries = []

    streets.forEach(street => {
      if ((street.type === 'primary' || street.type === 'secondary') &&
          street.points && street.points.length >= 2) {
        const geo = buildCenterLineGeometry(street.points, 0.6)
        if (geo) geometries.push(geo)
      }
    })

    if (geometries.length === 0) return null

    const merged = mergeBufferGeometries(geometries)
    geometries.forEach(g => g.dispose())
    return merged
  }, [streets])

  if (!geometry) return null

  return (
    <mesh geometry={geometry} position={[0, 0.02, 0]}>
      <meshStandardMaterial
        color="#d4c46a"
        emissive="#d4c46a"
        emissiveIntensity={0.12}
        roughness={0.35}
      />
    </mesh>
  )
}

// Edge lines for primary roads (white shoulder markings)
function EdgeLines({ streets }) {
  const geometry = useMemo(() => {
    const geometries = []
    const lineWidth = 0.3
    const yOffset = 0.17

    streets.forEach(street => {
      if (street.type === 'primary' && street.points && street.points.length >= 2) {
        const roadWidth = STREET_WIDTHS.primary
        const edgeOffset = (roadWidth / 2) - 0.5 // Slightly inside the road edge

        // Left edge
        const leftGeo = buildOffsetLineGeometry(street.points, lineWidth, edgeOffset, yOffset)
        if (leftGeo) geometries.push(leftGeo)

        // Right edge
        const rightGeo = buildOffsetLineGeometry(street.points, lineWidth, -edgeOffset, yOffset)
        if (rightGeo) geometries.push(rightGeo)
      }
    })

    if (geometries.length === 0) return null

    const merged = mergeBufferGeometries(geometries)
    geometries.forEach(g => g.dispose())
    return merged
  }, [streets])

  if (!geometry) return null

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color="#e8e8e8"
        emissive="#e8e8e8"
        emissiveIntensity={0.05}
        roughness={0.5}
      />
    </mesh>
  )
}

// Simple geometry merge function
function mergeBufferGeometries(geometries) {
  if (geometries.length === 0) return null
  if (geometries.length === 1) return geometries[0].clone()

  let totalVertices = 0
  let totalIndices = 0

  geometries.forEach(geo => {
    totalVertices += geo.attributes.position.count
    totalIndices += geo.index ? geo.index.count : 0
  })

  const positions = new Float32Array(totalVertices * 3)
  const indices = new Uint32Array(totalIndices)

  let vertexOffset = 0
  let indexOffset = 0
  let vertexCount = 0

  geometries.forEach(geo => {
    const pos = geo.attributes.position.array
    positions.set(pos, vertexOffset * 3)

    if (geo.index) {
      const idx = geo.index.array
      for (let i = 0; i < idx.length; i++) {
        indices[indexOffset + i] = idx[i] + vertexCount
      }
      indexOffset += idx.length
    }

    vertexCount += geo.attributes.position.count
    vertexOffset += geo.attributes.position.count
  })

  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  merged.setIndex(new THREE.BufferAttribute(indices, 1))
  merged.computeVertexNormals()
  return merged
}

// Land use polygon
function LandUsePolygon({ feature }) {
  const geometry = useMemo(() => {
    const pts = feature.points
    if (!pts || pts.length < 3) return null

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

  const color = LANDUSE_COLORS[feature.type] || '#2a2a30'

  return (
    <mesh geometry={geometry} position={[0, 0.02, 0]} receiveShadow>
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  )
}

// Main component
function VectorStreets() {
  // Group streets by type for batched rendering
  const streetsByType = useMemo(() => {
    const grouped = {
      primary: [],
      secondary: [],
      tertiary: [],
      residential: [],
      service: [],
    }

    streetsData.streets.forEach(street => {
      const type = street.type || 'residential'
      if (grouped[type]) {
        grouped[type].push(street)
      } else {
        grouped.residential.push(street)
      }
    })

    return grouped
  }, [])

  return (
    <group>
      {/* Base ground plane - circular to match sky dome */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <circleGeometry args={[4000, 128]} />
        <meshStandardMaterial color="#1a1a22" roughness={0.95} />
      </mesh>

      {/* Land use features */}
      {landuseData.features.map(f => (
        <LandUsePolygon key={f.id} feature={f} />
      ))}

      {/* Streets - rendered from smallest to largest so larger roads overlay */}
      <BatchedStreets streets={streetsByType.service} type="service" />
      <BatchedStreets streets={streetsByType.residential} type="residential" />
      <BatchedStreets streets={streetsByType.tertiary} type="tertiary" />
      <BatchedStreets streets={streetsByType.secondary} type="secondary" />
      <BatchedStreets streets={streetsByType.primary} type="primary" />

      {/* Center lines on major roads */}
      <CenterLines streets={streetsData.streets} />

      {/* Edge lines on primary roads */}
      <EdgeLines streets={streetsData.streets} />
    </group>
  )
}

export default VectorStreets
