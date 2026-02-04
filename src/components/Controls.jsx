import { useEffect, useState } from 'react'
import useSelectedBuilding from '../hooks/useSelectedBuilding'
import useCamera from '../hooks/useCamera'
import buildingsData from '../data/buildings.json'

function Controls() {
  const selectedId = useSelectedBuilding((state) => state.selectedId)
  const deselect = useSelectedBuilding((state) => state.deselect)
  const viewMode = useCamera((state) => state.viewMode)
  const exitToPlan = useCamera((state) => state.exitToPlan)
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

  const instructions = {
    plan: 'Drag to orbit · Scroll to zoom · Double-click building for street view',
    street: 'Drag to look around · Scroll to move · ESC to exit',
  }

  return (
    <>
      {/* Street view indicator and exit button */}
      {viewMode === 'street' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-gray-900/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-gray-700">
          <span className="text-white text-sm font-medium">Street View</span>
          <button
            onClick={exitToPlan}
            className="px-3 py-1.5 rounded-md text-sm font-medium bg-white text-gray-900 hover:bg-gray-200 transition-colors"
          >
            Exit
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 right-4 text-gray-500 text-sm text-right">
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
