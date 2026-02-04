import { useEffect, useState } from 'react'
import useSelectedBuilding from '../hooks/useSelectedBuilding'
import useCamera from '../hooks/useCamera'
import buildingsData from '../data/buildings.json'
import streetsData from '../data/streets.json'

function Controls() {
  const selectedId = useSelectedBuilding((state) => state.selectedId)
  const deselect = useSelectedBuilding((state) => state.deselect)
  const viewMode = useCamera((state) => state.viewMode)
  const setViewMode = useCamera((state) => state.setViewMode)
  const [buildingInfo, setBuildingInfo] = useState(null)

  useEffect(() => {
    if (selectedId) {
      const building = buildingsData.buildings.find((b) => b.id === selectedId)
      if (building) {
        setBuildingInfo(building)
      }
    } else {
      setBuildingInfo(null)
    }
  }, [selectedId])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '1') setViewMode('fly')
      if (e.key === '2') setViewMode('plan')
      if (e.key === '3') setViewMode('street')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setViewMode])

  const buildingCount = buildingsData.buildings.length
  const streetCount = streetsData.streets.length

  const viewModes = [
    { id: 'fly', label: 'Fly', key: '1' },
    { id: 'plan', label: 'Plan', key: '2' },
    { id: 'street', label: 'Street', key: '3' },
  ]

  const instructions = {
    fly: 'Drag to orbit · Scroll to zoom · Right-drag to pan',
    plan: 'Drag to pan · Scroll to zoom',
    street: 'Drag to look · Scroll to move · Right-drag to walk',
  }

  return (
    <>
      {/* Title overlay */}
      <div className="absolute top-4 left-4 text-white">
        <h1 className="text-2xl font-bold tracking-wide">Belle Epoque</h1>
        <p className="text-sm text-gray-400">Downtown Belleville, IL</p>
        <p className="text-xs text-gray-500 mt-1">
          {buildingCount.toLocaleString()} buildings · {streetCount} streets
        </p>
      </div>

      {/* View mode switcher */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1 bg-gray-900/90 backdrop-blur-sm rounded-lg p-1 border border-gray-700">
        {viewModes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setViewMode(mode.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === mode.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {mode.label}
            <span className="ml-1.5 text-xs opacity-40">{mode.key}</span>
          </button>
        ))}
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 text-gray-500 text-sm">
        <p>{instructions[viewMode]}</p>
      </div>

      {/* Selected building info panel */}
      {buildingInfo && (
        <div className="absolute top-20 right-4 bg-gray-900/95 backdrop-blur-sm rounded-lg p-4 w-64 text-white shadow-xl border border-gray-700">
          <div className="flex justify-between items-start mb-3">
            <h2 className="text-base font-medium text-gray-300">{buildingInfo.id}</h2>
            <button
              onClick={deselect}
              className="text-gray-500 hover:text-white transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Size</span>
              <span className="text-gray-300">{buildingInfo.size[0].toFixed(0)} × {buildingInfo.size[2].toFixed(0)}m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Height</span>
              <span className="text-gray-300">{buildingInfo.size[1].toFixed(0)}m</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-800">
            <div
              className="w-full h-3 rounded"
              style={{ backgroundColor: buildingInfo.color }}
            />
          </div>
        </div>
      )}
    </>
  )
}

export default Controls
