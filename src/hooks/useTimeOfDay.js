import { create } from 'zustand'
import SunCalc from 'suncalc'

const LATITUDE = 38.52
const LONGITUDE = -89.98

const useTimeOfDay = create((set, get) => ({
  // Current simulated time
  currentTime: new Date(),

  // Time speed multiplier (1 = real time, 60 = 1 minute per second, etc.)
  timeSpeed: 1,

  // Whether time is paused
  isPaused: false,

  // Set to a specific time
  setTime: (date) => set({ currentTime: date }),

  // Set time speed
  setTimeSpeed: (speed) => set({ timeSpeed: speed }),

  // Toggle pause
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),

  // Jump to specific hour of today
  setHour: (hour) => {
    const now = new Date()
    now.setHours(hour, 0, 0, 0)
    set({ currentTime: now })
  },

  // Advance time (call this from animation loop)
  tick: (deltaMs) => {
    const { isPaused, timeSpeed, currentTime } = get()
    if (isPaused) return

    const newTime = new Date(currentTime.getTime() + deltaMs * timeSpeed)
    set({ currentTime: newTime })
  },

  // Get lighting phase based on sun position
  getLightingPhase: () => {
    const { currentTime } = get()
    const sunPos = SunCalc.getPosition(currentTime, LATITUDE, LONGITUDE)
    const sunAlt = sunPos.altitude
    return {
      isNight: sunAlt < -0.12,
      isTwilight: sunAlt >= -0.12 && sunAlt < 0.05,
      shouldGlow: sunAlt < 0.05,  // twilight OR night
    }
  },
}))

export default useTimeOfDay
