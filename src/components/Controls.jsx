import { useEffect, useState, useMemo } from 'react'
import useSelectedBuilding from '../hooks/useSelectedBuilding'
import useCamera from '../hooks/useCamera'
import buildingsData from '../data/buildings.json'
import landmarksData from '../data/landmarks.json'
import BusinessCard from './BusinessCard'

function Controls() {
  const selectedId = useSelectedBuilding((state) => state.selectedId)
  const deselect = useSelectedBuilding((state) => state.deselect)
  const viewMode = useCamera((state) => state.viewMode)
  const exitToPlan = useCamera((state) => state.exitToPlan)
  const [buildingInfo, setBuildingInfo] = useState(null)

  // Create landmark lookup
  const landmarkLookup = useMemo(() => {
    const lookup = {}
    landmarksData.landmarks.forEach(l => { lookup[l.id] = l })
    return lookup
  }, [])

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

  const landmark = selectedId ? landmarkLookup[selectedId] : null

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

      {/* Business card - shows for ANY selected building */}
      {selectedId && buildingInfo && (
        <BusinessCard
          landmark={landmark}
          building={buildingInfo}
          onClose={deselect}
        />
      )}
    </>
  )
}

export default Controls
