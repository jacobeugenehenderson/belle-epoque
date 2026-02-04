import { useState } from 'react'

// Material Design Icons as simple SVG components
const ChevronIcon = ({ expanded }) => (
  <svg
    className={`w-5 h-5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
)

const CategoryIcon = ({ icon }) => (
  <span className="text-lg leading-none">{icon}</span>
)

// Resource data structure
const RESOURCE_CATEGORIES = [
  {
    id: 'survival',
    title: 'Survival & Stability',
    subtitle: 'What keeps people safe enough to exist',
    icon: '1️⃣',
    color: 'rose',
    note: 'This is the anti-GoFundMe layer.',
    sections: [
      {
        name: 'Food access',
        items: ['Free fridges', 'Food pantries', 'Mutual aid groceries', 'Community kitchens']
      },
      {
        name: 'Housing help',
        items: ['Room shares', 'Temporary shelter', 'Eviction defense', 'Tenant unions']
      },
      {
        name: 'Utilities & transport',
        items: ['Ride shares', 'Gas cards', 'Power/water help']
      },
      {
        name: 'Emergency cash',
        items: ['Mutual aid funds', 'Rent bridges', 'Medical bill help']
      },
      {
        name: 'Legal help',
        items: ['Housing lawyers', 'Immigration help', 'Expungement clinics']
      }
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
      {
        name: 'Medical',
        items: ['Free clinics', 'Low-cost doctors', 'Mobile health vans']
      },
      {
        name: 'Mental health',
        items: ['Sliding-scale therapists', 'Peer support groups', 'Crisis lines']
      },
      {
        name: 'Disability & elder care',
        items: ['Home aides', 'Accessibility services']
      },
      {
        name: 'Reproductive & gender care',
        items: ['Planned Parenthood-type services', 'Trans health', 'Abortion access']
      },
      {
        name: 'Harm reduction',
        items: ['Narcan', 'Clean supplies', 'Testing']
      }
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
      {
        name: 'Services',
        items: ['Plumbing', 'Childcare', 'Tutoring', 'Housecleaning']
      },
      {
        name: 'Skill exchange',
        items: ['Trade hours', 'Barter', 'Mentorship']
      },
      {
        name: 'Freelance & gig',
        items: ['Short-term work', 'Creative services', 'Tech help']
      },
      {
        name: 'Worker co-ops',
        items: ['Local worker-owned businesses']
      },
      {
        name: 'Union & labor',
        items: ['Worker centers', 'Organizing']
      }
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
      {
        name: 'Free stuff',
        items: []
      },
      {
        name: 'Borrow',
        items: ['Tools', 'Ladders', 'Projectors']
      },
      {
        name: 'Swap',
        items: []
      },
      {
        name: 'Local makers',
        items: []
      },
      {
        name: 'Repair',
        items: ['Fix-it clinics', 'Bike co-ops']
      }
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
      {
        name: 'Food & drink',
        items: ['Restaurants', 'Community dinners', 'Pop-ups']
      },
      {
        name: 'Arts',
        items: ['Music', 'Theatre', 'Galleries']
      },
      {
        name: 'Learning',
        items: ['Adult ed', 'Free classes', 'Tutoring']
      },
      {
        name: 'Kids',
        items: ['After-school', 'Playgroups']
      },
      {
        name: 'Faith & spiritual',
        items: ['Churches', 'Meditation', 'Secular gatherings']
      },
      {
        name: 'Community spaces',
        items: ['Libraries', 'Third places']
      }
    ]
  }
]

const colorClasses = {
  rose: {
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    text: 'text-rose-400',
    hover: 'hover:bg-rose-500/15',
    dot: 'bg-rose-400',
    activeBg: 'bg-rose-500/20'
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    hover: 'hover:bg-emerald-500/15',
    dot: 'bg-emerald-400',
    activeBg: 'bg-emerald-500/20'
  },
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    hover: 'hover:bg-amber-500/15',
    dot: 'bg-amber-400',
    activeBg: 'bg-amber-500/20'
  },
  violet: {
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    text: 'text-violet-400',
    hover: 'hover:bg-violet-500/15',
    dot: 'bg-violet-400',
    activeBg: 'bg-violet-500/20'
  },
  sky: {
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
    text: 'text-sky-400',
    hover: 'hover:bg-sky-500/15',
    dot: 'bg-sky-400',
    activeBg: 'bg-sky-500/20'
  }
}

// Subsection component with expandable items
function Subsection({ section, color }) {
  const [expanded, setExpanded] = useState(false)
  const colors = colorClasses[color]
  const hasItems = section.items.length > 0

  return (
    <div className="border-l-2 border-white/5 ml-3">
      <button
        onClick={() => hasItems && setExpanded(!expanded)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors duration-150 ${
          hasItems ? 'hover:bg-white/5 cursor-pointer' : 'cursor-default'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} opacity-60`} />
        <span className="text-sm text-white/80 flex-1">{section.name}</span>
        {hasItems && (
          <span className="text-[10px] text-white/30">{section.items.length}</span>
        )}
        {hasItems && (
          <ChevronIcon expanded={expanded} />
        )}
      </button>

      {/* Items list */}
      <div className={`overflow-hidden transition-all duration-200 ${
        expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="ml-6 py-1">
          {section.items.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 rounded transition-colors cursor-pointer"
            >
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-xs text-white/60">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Main category accordion
function CategoryAccordion({ category, isExpanded, onToggle }) {
  const colors = colorClasses[category.color]

  return (
    <div className={`border ${colors.border} rounded-lg overflow-hidden transition-all duration-200 ${
      isExpanded ? colors.activeBg : 'bg-black/40'
    }`}>
      {/* Category header */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 p-4 text-left transition-colors duration-150 ${colors.hover}`}
      >
        <CategoryIcon icon={category.icon} />
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${colors.text}`}>
            {category.title}
          </div>
        </div>
        <div className="text-white/40">
          <ChevronIcon expanded={isExpanded} />
        </div>
      </button>

      {/* Expanded content */}
      <div className={`overflow-hidden transition-all duration-300 ease-out ${
        isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="px-2 pb-3">
          {/* Subsections */}
          {category.sections.map((section, idx) => (
            <Subsection key={idx} section={section} color={category.color} />
          ))}
        </div>
      </div>
    </div>
  )
}

// Main ResourceDirectory component
function ResourceDirectory() {
  const [expandedId, setExpandedId] = useState(null)

  const handleToggle = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div
      className="absolute top-4 right-4 w-80 max-h-[calc(100vh-2rem)] flex flex-col select-none"
      style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
    >
      {/* Header */}
      <div className="bg-black/80 backdrop-blur-md rounded-t-lg border border-white/10 px-4 py-3">
        <h2 className="text-sm font-medium text-white">Community Resources</h2>
        <p className="text-[10px] text-white/40 mt-0.5">Local mutual aid directory</p>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto bg-black/60 backdrop-blur-md border-x border-white/10 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <div className="p-2 space-y-2">
          {RESOURCE_CATEGORIES.map((category) => (
            <CategoryAccordion
              key={category.id}
              category={category}
              isExpanded={expandedId === category.id}
              onToggle={() => handleToggle(category.id)}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-black/80 backdrop-blur-md rounded-b-lg border border-t-0 border-white/10 px-4 py-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/30">5 categories</span>
          <button className="text-[10px] px-2 py-1 rounded bg-white/10 text-white/60 hover:bg-white/20 transition-colors">
            Give
          </button>
        </div>
      </div>
    </div>
  )
}

export default ResourceDirectory
