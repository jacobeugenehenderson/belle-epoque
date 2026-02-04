import { useState, useEffect, useRef } from 'react'
import SunCalc from 'suncalc'
import useTimeOfDay from '../hooks/useTimeOfDay'
import useBusinessState from '../hooks/useBusinessState'
import buildingsData from '../data/buildings.json'
import streetsData from '../data/streets.json'

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
  const index = Math.floor(phase * 8) % 8
  return MOON_PHASES[index]
}

function formatTimeShort(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).replace(' ', '')
}

// ============ ALMANAC TAB ============

function AlmanacTab({ showAdmin = false }) {
  const { currentTime, setTime, setHour } = useTimeOfDay()
  const [useRealTime, setUseRealTime] = useState(true)
  const [use24Hour, setUse24Hour] = useState(false)
  const { openPercentage, setOpenPercentage, randomize, openAll, closeAll } = useBusinessState()
  const [sliderValue, setSliderValue] = useState(openPercentage)
  const buildingIds = useRef(buildingsData.buildings.map(b => b.id))

  useEffect(() => {
    if (!useRealTime) return
    const interval = setInterval(() => {
      setTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [useRealTime, setTime])

  const sunTimes = SunCalc.getTimes(currentTime, LATITUDE, LONGITUDE)
  const moonIllum = SunCalc.getMoonIllumination(currentTime)
  const moonPhase = getMoonPhase(moonIllum.phase)

  const hours = currentTime.getHours()
  const minutes = currentTime.getMinutes()

  const timeString = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: !use24Hour,
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

  const isSunUp = currentTime > sunTimes.sunrise && currentTime < sunTimes.sunset

  return (
    <div className="flex flex-col h-full">
      {/* Digital clock header */}
      <div className="px-4 py-3 border-b border-white/10 bg-white/5">
        <div className="flex items-baseline gap-3">
          <span
            className="text-3xl font-light text-white tracking-wider cursor-pointer hover:text-white/80 transition-colors"
            onClick={() => setUse24Hour(!use24Hour)}
            title="Click to toggle 12/24 hour format"
          >
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

      {/* Admin controls */}
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

      {/* Location badge */}
      <div className="mt-auto px-4 py-2 border-t border-white/5 text-[10px] text-white/30 tracking-wide">
        <div>{buildingsData.buildings.length.toLocaleString()} buildings · {streetsData.streets.length} streets</div>
        <div className="mt-0.5">38.52°N 89.98°W · Belleville, IL</div>
      </div>
    </div>
  )
}

// ============ RESOURCES TAB ============

const RESOURCE_CATEGORIES = [
  {
    id: 'survival',
    title: 'Survival & Stability',
    subtitle: 'What keeps people safe enough to exist',
    icon: '1️⃣',
    color: 'rose',
    note: 'This is the anti-GoFundMe layer.',
    sections: [
      { name: 'Food access', items: ['Free fridges', 'Food pantries', 'Mutual aid groceries', 'Community kitchens'] },
      { name: 'Housing help', items: ['Room shares', 'Temporary shelter', 'Eviction defense', 'Tenant unions'] },
      { name: 'Utilities & transport', items: ['Ride shares', 'Gas cards', 'Power/water help'] },
      { name: 'Emergency cash', items: ['Mutual aid funds', 'Rent bridges', 'Medical bill help'] },
      { name: 'Legal help', items: ['Housing lawyers', 'Immigration help', 'Expungement clinics'] }
    ]
  },
  {
    id: 'health',
    title: 'Health & Care',
    subtitle: 'Who keeps you alive and okay',
    icon: '2️⃣',
    color: 'emerald',
    note: 'This is where most platforms quietly fail people.',
    sections: [
      { name: 'Medical', items: ['Free clinics', 'Low-cost doctors', 'Mobile health vans'] },
      { name: 'Mental health', items: ['Sliding-scale therapists', 'Peer support groups', 'Crisis lines'] },
      { name: 'Disability & elder care', items: ['Home aides', 'Accessibility services'] },
      { name: 'Reproductive & gender care', items: ['Planned Parenthood-type services', 'Trans health', 'Abortion access'] },
      { name: 'Harm reduction', items: ['Narcan', 'Clean supplies', 'Testing'] }
    ]
  },
  {
    id: 'work',
    title: 'Work, Skills & Exchange',
    subtitle: 'How people survive economically without being exploited',
    icon: '3️⃣',
    color: 'amber',
    note: 'This becomes a parallel economy.',
    sections: [
      { name: 'Services', items: ['Plumbing', 'Childcare', 'Tutoring', 'Housecleaning'] },
      { name: 'Skill exchange', items: ['Trade hours', 'Barter', 'Mentorship'] },
      { name: 'Freelance & gig', items: ['Short-term work', 'Creative services', 'Tech help'] },
      { name: 'Worker co-ops', items: ['Local worker-owned businesses'] },
      { name: 'Union & labor', items: ['Worker centers', 'Organizing'] }
    ]
  },
  {
    id: 'goods',
    title: 'Goods & Sharing',
    subtitle: 'The Buy Nothing layer, but dignified',
    icon: '4️⃣',
    color: 'violet',
    note: 'This reduces poverty without money changing hands.',
    sections: [
      { name: 'Free stuff', items: [] },
      { name: 'Borrow', items: ['Tools', 'Ladders', 'Projectors'] },
      { name: 'Swap', items: [] },
      { name: 'Local makers', items: [] },
      { name: 'Repair', items: ['Fix-it clinics', 'Bike co-ops'] }
    ]
  },
  {
    id: 'culture',
    title: 'Culture, Learning & Belonging',
    subtitle: 'Why people stay human',
    icon: '5️⃣',
    color: 'sky',
    note: 'This is the Zagat + Meetup + Library + Church layer.',
    sections: [
      { name: 'Food & drink', items: ['Restaurants', 'Community dinners', 'Pop-ups'] },
      { name: 'Arts', items: ['Music', 'Theatre', 'Galleries'] },
      { name: 'Learning', items: ['Adult ed', 'Free classes', 'Tutoring'] },
      { name: 'Kids', items: ['After-school', 'Playgroups'] },
      { name: 'Faith & spiritual', items: ['Churches', 'Meditation', 'Secular gatherings'] },
      { name: 'Community spaces', items: ['Libraries', 'Third places'] }
    ]
  }
]

const colorClasses = {
  rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', hover: 'hover:bg-rose-500/15', dot: 'bg-rose-400', activeBg: 'bg-rose-500/20' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', hover: 'hover:bg-emerald-500/15', dot: 'bg-emerald-400', activeBg: 'bg-emerald-500/20' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', hover: 'hover:bg-amber-500/15', dot: 'bg-amber-400', activeBg: 'bg-amber-500/20' },
  violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-400', hover: 'hover:bg-violet-500/15', dot: 'bg-violet-400', activeBg: 'bg-violet-500/20' },
  sky: { bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-400', hover: 'hover:bg-sky-500/15', dot: 'bg-sky-400', activeBg: 'bg-sky-500/20' }
}

const ChevronIcon = ({ expanded }) => (
  <svg
    className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
)

function Subsection({ section, color }) {
  const [expanded, setExpanded] = useState(false)
  const colors = colorClasses[color]
  const hasItems = section.items.length > 0

  return (
    <div className="border-l-2 border-white/5 ml-3">
      <button
        onClick={() => hasItems && setExpanded(!expanded)}
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors duration-150 ${
          hasItems ? 'hover:bg-white/5 cursor-pointer' : 'cursor-default'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} opacity-60`} />
        <span className="text-xs text-white/80 flex-1">{section.name}</span>
        {hasItems && <span className="text-[10px] text-white/30">{section.items.length}</span>}
        {hasItems && <ChevronIcon expanded={expanded} />}
      </button>

      <div className={`overflow-hidden transition-all duration-200 ${expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="ml-6 py-1">
          {section.items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 px-3 py-1 hover:bg-white/5 rounded transition-colors cursor-pointer">
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-[11px] text-white/60">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CategoryAccordion({ category, isExpanded, onToggle }) {
  const colors = colorClasses[category.color]

  return (
    <div className={`border ${colors.border} rounded-lg overflow-hidden transition-all duration-200 ${isExpanded ? colors.activeBg : 'bg-black/40'}`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 p-3 text-left transition-colors duration-150 ${colors.hover}`}
      >
        <span className="text-base leading-none">{category.icon}</span>
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-medium ${colors.text}`}>{category.title}</div>
        </div>
        <div className="text-white/40">
          <ChevronIcon expanded={isExpanded} />
        </div>
      </button>

      <div className={`overflow-hidden transition-all duration-300 ease-out ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-2 pb-3">
          {category.sections.map((section, idx) => (
            <Subsection key={idx} section={section} color={category.color} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ResourcesTab() {
  const [expandedId, setExpandedId] = useState(null)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-2">
          {RESOURCE_CATEGORIES.map((category) => (
            <CategoryAccordion
              key={category.id}
              category={category}
              isExpanded={expandedId === category.id}
              onToggle={() => setExpandedId(expandedId === category.id ? null : category.id)}
            />
          ))}
        </div>
      </div>
      <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between">
        <span className="text-[10px] text-white/30">5 categories</span>
        <button className="text-[10px] px-2 py-1 rounded bg-white/10 text-white/60 hover:bg-white/20 transition-colors">
          Give
        </button>
      </div>
    </div>
  )
}

// ============ MAIN SIDEPANEL ============

const TABS = [
  { id: 'almanac', label: 'Almanac', icon: '◐' },
  { id: 'resources', label: 'Resources', icon: '◈' },
]

function SidePanel({ showAdmin = true }) {
  const [activeTab, setActiveTab] = useState('almanac')

  return (
    <div
      className="absolute bottom-4 left-4 w-80 max-h-[calc(100vh-2rem)] flex flex-col select-none bg-black/80 backdrop-blur-md rounded-lg border border-white/10 overflow-hidden"
      style={{ fontFamily: 'ui-monospace, monospace' }}
    >
      {/* Tab bar */}
      <div className="flex border-b border-white/10">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs transition-colors duration-150 ${
              activeTab === tab.id
                ? 'bg-white/10 text-white border-b-2 border-white/50'
                : 'text-white/50 hover:text-white/70 hover:bg-white/5'
            }`}
          >
            <span className="text-sm">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'almanac' && <AlmanacTab showAdmin={showAdmin} />}
        {activeTab === 'resources' && <ResourcesTab />}
      </div>
    </div>
  )
}

export default SidePanel
