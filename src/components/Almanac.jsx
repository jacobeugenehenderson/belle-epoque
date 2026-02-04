import { useState, useEffect, useRef } from 'react'
import SunCalc from 'suncalc'
import useTimeOfDay from '../hooks/useTimeOfDay'
import useBusinessState from '../hooks/useBusinessState'
import buildingsData from '../data/buildings.json'

// Belleville, IL coordinates
const LATITUDE = 38.52
const LONGITUDE = -89.98

// Moon phase names and icons
const MOON_PHASES = [
  { name: 'New Moon', icon: '🌑' },
  { name: 'Waxing Crescent', icon: '🌒' },
  { name: 'First Quarter', icon: '🌓' },
  { name: 'Waxing Gibbous', icon: '🌔' },
  { name: 'Full Moon', icon: '🌕' },
  { name: 'Waning Gibbous', icon: '🌖' },
  { name: 'Last Quarter', icon: '🌗' },
  { name: 'Waning Crescent', icon: '🌘' },
]

function getMoonPhase(phase) {
  // phase is 0-1, map to 8 phases
  const index = Math.floor(phase * 8) % 8
  return MOON_PHASES[index]
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatTimeShort(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).replace(' ', '')
}

function Almanac({ showAdmin = false }) {
  const { currentTime, setTime, setHour } = useTimeOfDay()
  const [useRealTime, setUseRealTime] = useState(true)
  const { openPercentage, setOpenPercentage, randomize, openAll, closeAll } = useBusinessState()
  const [sliderValue, setSliderValue] = useState(openPercentage)
  const buildingIds = useRef(buildingsData.buildings.map(b => b.id))

  // Sync to real time when useRealTime is enabled
  useEffect(() => {
    if (!useRealTime) return
    const interval = setInterval(() => {
      setTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [useRealTime, setTime])

  // Calculate astronomical data
  const sunTimes = SunCalc.getTimes(currentTime, LATITUDE, LONGITUDE)
  const moonIllum = SunCalc.getMoonIllumination(currentTime)
  const moonPhase = getMoonPhase(moonIllum.phase)

  const hours = currentTime.getHours()
  const minutes = currentTime.getMinutes()
  const seconds = currentTime.getSeconds()

  const timeString = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const dateString = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const dayOfYear = Math.floor(
    (currentTime - new Date(currentTime.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24)
  )

  // Is sun up?
  const isSunUp = currentTime > sunTimes.sunrise && currentTime < sunTimes.sunset

  return (
    <div className="absolute bottom-4 left-4 select-none">
      {/* Main almanac display */}
      <div className="bg-black/80 backdrop-blur-md rounded-lg border border-white/10 overflow-hidden" style={{ fontFamily: 'ui-monospace, monospace' }}>

        {/* Digital clock header */}
        <div className="px-4 py-3 border-b border-white/10 bg-white/5">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-light text-white tracking-wider">
              {timeString}
            </span>
            <span className="text-xs text-white/50 uppercase tracking-widest">
              {isSunUp ? 'day' : 'night'}
            </span>
          </div>
          <div className="text-xs text-white/40 mt-1 tracking-wide">
            {dateString} · Day {dayOfYear}
          </div>
        </div>

        {/* Sun & Moon row */}
        <div className="px-4 py-3 flex gap-6">
          {/* Sun info */}
          <div className="flex-1">
            <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Sun</div>
            <div className="flex items-center gap-2 text-xs text-white/70">
              <span className="text-amber-400">↑</span>
              <span>{formatTimeShort(sunTimes.sunrise)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/70">
              <span className="text-orange-400">↓</span>
              <span>{formatTimeShort(sunTimes.sunset)}</span>
            </div>
          </div>

          {/* Moon info */}
          <div className="flex-1">
            <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Moon</div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{moonPhase.icon}</span>
              <div>
                <div className="text-xs text-white/70">{moonPhase.name}</div>
                <div className="text-[10px] text-white/40">{Math.round(moonIllum.fraction * 100)}% illuminated</div>
              </div>
            </div>
          </div>
        </div>

        {/* Golden hours */}
        <div className="px-4 py-2 border-t border-white/5 bg-white/5">
          <div className="flex justify-between text-[10px]">
            <div>
              <span className="text-amber-400/60">Golden </span>
              <span className="text-white/40">{formatTimeShort(sunTimes.goldenHour)}</span>
            </div>
            <div>
              <span className="text-orange-400/60">Noon </span>
              <span className="text-white/40">{formatTimeShort(sunTimes.solarNoon)}</span>
            </div>
            <div>
              <span className="text-purple-400/60">Dusk </span>
              <span className="text-white/40">{formatTimeShort(sunTimes.dusk)}</span>
            </div>
          </div>
        </div>

        {/* Admin controls (collapsible) */}
        {showAdmin && (
          <div className="px-4 py-3 border-t border-white/10 bg-black/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-white/30 uppercase tracking-widest">Time Control</span>
              <button
                onClick={() => setUseRealTime(!useRealTime)}
                className={`text-[10px] px-2 py-0.5 rounded ${
                  useRealTime
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}
              >
                {useRealTime ? 'LIVE' : 'MANUAL'}
              </button>
            </div>

            {!useRealTime && (
              <>
                <input
                  type="range"
                  min="0"
                  max="24"
                  step="0.1"
                  value={hours + minutes / 60}
                  onChange={(e) => setHour(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[9px] text-white/30 mt-1">
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>24:00</span>
                </div>
              </>
            )}

            {/* Business Simulation Controls */}
            <div className="mt-3 pt-3 border-t border-white/10">
              <span className="text-[10px] text-white/30 uppercase tracking-widest">Business Simulation</span>
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-white/50">Open: {sliderValue}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={sliderValue}
                  onChange={(e) => setSliderValue(parseInt(e.target.value))}
                  onMouseUp={() => randomize(buildingIds.current, sliderValue)}
                  onTouchEnd={() => randomize(buildingIds.current, sliderValue)}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => randomize(buildingIds.current, sliderValue)}
                    className="flex-1 text-[10px] px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                  >
                    Randomize
                  </button>
                  <button
                    onClick={() => { openAll(buildingIds.current); setSliderValue(100) }}
                    className="text-[10px] px-2 py-1 rounded bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
                  >
                    All
                  </button>
                  <button
                    onClick={() => { closeAll(); setSliderValue(0) }}
                    className="text-[10px] px-2 py-1 rounded bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
                  >
                    None
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Location badge */}
      <div className="mt-2 text-[10px] text-white/30 tracking-wide">
        38.52°N 89.98°W · Belleville, IL
      </div>
    </div>
  )
}

export default Almanac
