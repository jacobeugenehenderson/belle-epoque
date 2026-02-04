import { create } from 'zustand'

const useCamera = create((set, get) => ({
  viewMode: 'plan', // 'plan' or 'street'

  // Target position for street view (where the user double-clicked)
  streetTarget: null,

  // Camera azimuth angle in radians (for compass)
  azimuth: 0,

  // Enter street view at a specific location
  enterStreetView: (position) => set({
    viewMode: 'street',
    streetTarget: position
  }),

  // Return to plan view
  exitToPlan: () => set({
    viewMode: 'plan',
    streetTarget: null
  }),

  // Update azimuth (called from CameraRig)
  setAzimuth: (angle) => set({ azimuth: angle }),
}))

export default useCamera
