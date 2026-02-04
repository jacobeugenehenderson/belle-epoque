import useTimeOfDay from '../hooks/useTimeOfDay'

function TimeControls() {
  const { currentTime, setHour } = useTimeOfDay()

  const hours = currentTime.getHours()
  const timeString = currentTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const presets = [
    { label: 'Dawn', hour: 6.5, icon: '🌅' },
    { label: 'Day', hour: 12, icon: '☀️' },
    { label: 'Golden', hour: 18, icon: '🌇' },
    { label: 'Dusk', hour: 20, icon: '🌆' },
    { label: 'Night', hour: 22, icon: '🌙' },
  ]

  // Find which preset is closest to current time
  const activePreset = presets.reduce((closest, preset) => {
    const diff = Math.abs(hours - preset.hour)
    const closestDiff = Math.abs(hours - closest.hour)
    return diff < closestDiff ? preset : closest
  }, presets[0])

  return (
    <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg p-2 text-white">
      <div className="flex items-center gap-1">
        {presets.map(({ label, hour, icon }) => (
          <button
            key={label}
            onClick={() => setHour(hour)}
            className={`px-2 py-1.5 rounded text-xs transition-colors ${
              activePreset.label === label
                ? 'bg-white/20 text-white'
                : 'hover:bg-white/10 text-gray-400'
            }`}
            title={label}
          >
            <span className="text-sm">{icon}</span>
          </button>
        ))}
        <span className="ml-2 text-xs text-gray-400 font-mono">{timeString}</span>
      </div>
    </div>
  )
}

export default TimeControls
