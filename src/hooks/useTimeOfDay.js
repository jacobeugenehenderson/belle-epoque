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

  // Jump to specific hour of today (supports fractional hours like 6.5 for 6:30)
  setHour: (hour) => {
    const now = new Date()
    const wholeHour = Math.floor(hour)
    const minutes = Math.round((hour - wholeHour) * 60)
    now.setHours(wholeHour, minutes, 0, 0)
    set({ currentTime: now })
  },

  // Set time as minutes since midnight (for smooth slider)
  setMinuteOfDay: (minutes) => {
    const now = new Date()
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    now.setHours(hours, mins, 0, 0)
    set({ currentTime: now })
  },

  // Get current time as minutes since midnight
  getMinuteOfDay: () => {
    const { currentTime } = get()
    return currentTime.getHours() * 60 + currentTime.getMinutes()
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
