import { useMemo, useState } from 'react'

// Category display names
const CATEGORY_LABELS = {
  survival: 'Survival & Stability',
  health: 'Health & Care',
  work: 'Work & Services',
  goods: 'Goods & Shopping',
  culture: 'Culture & Community',
  government: 'Government & Civic',
}

// Subcategory display names
const SUBCATEGORY_LABELS = {
  'food-access': 'Food Access',
  'housing': 'Housing',
  'medical': 'Medical',
  'emergency': 'Emergency Services',
  'fitness': 'Fitness & Wellness',
  'services': 'Services',
  'local-makers': 'Local Makers',
  'repair': 'Repair',
  'food-drink': 'Food & Drink',
  'arts': 'Arts & Entertainment',
  'learning': 'Learning',
  'faith': 'Faith & Spiritual',
  'community-spaces': 'Community Spaces',
  'municipal': 'City Services',
  'courts': 'Courts & Legal',
  'postal': 'Postal',
  'public-health': 'Public Health',
  'family-services': 'Family Services',
}

// Day names for hours display
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_LABELS = {
  sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat'
}

// Format time from 24h to 12h
function formatTime(time) {
  if (!time) return null
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

// Check if currently open based on hours
function getOpenStatus(hours) {
  if (!hours) return { isOpen: null, text: 'Hours not available' }

  const now = new Date()
  const dayName = DAY_NAMES[now.getDay()]
  const todayHours = hours[dayName]

  if (!todayHours) {
    for (let i = 1; i <= 7; i++) {
      const nextDayIndex = (now.getDay() + i) % 7
      const nextDay = DAY_NAMES[nextDayIndex]
      if (hours[nextDay]) {
        return {
          isOpen: false,
          text: `Closed · Opens ${DAY_LABELS[nextDay]} ${formatTime(hours[nextDay].open)}`
        }
      }
    }
    return { isOpen: false, text: 'Closed' }
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const [openH, openM] = todayHours.open.split(':').map(Number)
  const [closeH, closeM] = todayHours.close.split(':').map(Number)
  const openMinutes = openH * 60 + openM
  let closeMinutes = closeH * 60 + closeM

  if (closeMinutes < openMinutes) {
    closeMinutes += 24 * 60
    if (currentMinutes < openMinutes) {
      const adjustedCurrent = currentMinutes + 24 * 60
      if (adjustedCurrent < closeMinutes) {
        return { isOpen: true, text: `Open · Closes ${formatTime(todayHours.close)}` }
      }
    }
  }

  if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
    return { isOpen: true, text: `Open · Closes ${formatTime(todayHours.close)}` }
  }

  if (currentMinutes < openMinutes) {
    return { isOpen: false, text: `Closed · Opens ${formatTime(todayHours.open)}` }
  }

  for (let i = 1; i <= 7; i++) {
    const nextDayIndex = (now.getDay() + i) % 7
    const nextDay = DAY_NAMES[nextDayIndex]
    if (hours[nextDay]) {
      if (i === 1) {
        return { isOpen: false, text: `Closed · Opens tomorrow ${formatTime(hours[nextDay].open)}` }
      }
      return { isOpen: false, text: `Closed · Opens ${DAY_LABELS[nextDay]} ${formatTime(hours[nextDay].open)}` }
    }
  }

  return { isOpen: false, text: 'Closed' }
}

// Format hours for display
function formatHoursDisplay(hours) {
  if (!hours) return null

  const formatted = []
  DAY_NAMES.forEach(day => {
    const dayHours = hours[day]
    if (dayHours) {
      formatted.push({
        day: DAY_LABELS[day],
        hours: `${formatTime(dayHours.open)} - ${formatTime(dayHours.close)}`
      })
    } else {
      formatted.push({ day: DAY_LABELS[day], hours: 'Closed' })
    }
  })
  return formatted
}

// Star rating component
function StarRating({ rating, size = 'sm' }) {
  const stars = []
  const fullStars = Math.floor(rating)
  const hasHalf = rating % 1 >= 0.5
  const sizeClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(
        <svg key={i} className={`${sizeClass} text-yellow-400 fill-current`} viewBox="0 0 20 20">
          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
        </svg>
      )
    } else if (i === fullStars && hasHalf) {
      stars.push(
        <svg key={i} className={`${sizeClass} text-yellow-400`} viewBox="0 0 20 20">
          <defs>
            <linearGradient id="half">
              <stop offset="50%" stopColor="currentColor" />
              <stop offset="50%" stopColor="#4a4a4a" />
            </linearGradient>
          </defs>
          <path fill="url(#half)" d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
        </svg>
      )
    } else {
      stars.push(
        <svg key={i} className={`${sizeClass} text-gray-600 fill-current`} viewBox="0 0 20 20">
          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
        </svg>
      )
    }
  }

  return <div className="flex gap-0.5">{stars}</div>
}

// Placeholder photos based on category
function getPlaceholderPhotos(category) {
  // These would be actual photos in production
  const colors = {
    government: ['#2a3f5f', '#1e3a5f', '#3d5a80'],
    health: ['#2d4a4a', '#1e3d3d', '#3d5f5f'],
    culture: ['#4a2d4a', '#3d1e3d', '#5f3d5f'],
    goods: ['#4a4a2d', '#3d3d1e', '#5f5f3d'],
    work: ['#3d4a4a', '#2d3d3d', '#4a5f5f'],
    survival: ['#4a3d2d', '#3d2d1e', '#5f4a3d'],
  }
  return colors[category] || ['#3a3a3a', '#2a2a2a', '#4a4a4a']
}

// Sample reviews (placeholder data)
function getPlaceholderReviews(name) {
  const reviewTemplates = [
    { author: 'Sarah M.', neighborhood: 'West End', rating: 5, text: 'A true Belleville gem. Been coming here for years.', time: '2 weeks ago' },
    { author: 'Mike R.', neighborhood: 'Downtown', rating: 4, text: 'Great service, friendly staff. Highly recommend to locals.', time: '1 month ago' },
    { author: 'Linda K.', neighborhood: 'Signal Hill', rating: 5, text: 'This is what community businesses should be. Love supporting local.', time: '3 weeks ago' },
  ]
  // Return 0-3 reviews randomly based on name hash
  const hash = name?.split('').reduce((a, b) => a + b.charCodeAt(0), 0) || 0
  const count = hash % 4
  return reviewTemplates.slice(0, count)
}

function BusinessCard({ landmark, building, onClose }) {
  const [activeTab, setActiveTab] = useState('overview')
  const openStatus = useMemo(() => getOpenStatus(landmark?.hours), [landmark?.hours])
  const formattedHours = useMemo(() => formatHoursDisplay(landmark?.hours), [landmark?.hours])

  // Determine what we know
  const hasLandmarkInfo = !!landmark
  const name = landmark?.name || building?.name || 'Unknown Building'
  const address = landmark?.address || null
  const phone = landmark?.phone || null
  const website = landmark?.website || null
  const category = landmark?.category || null
  const subcategory = landmark?.subcategory || null
  const hours = landmark?.hours || null
  const photos = landmark?.photos || null
  const reviews = landmark?.reviews || null

  // Placeholder data for demo
  const placeholderPhotos = getPlaceholderPhotos(category)
  const placeholderReviews = getPlaceholderReviews(name)
  const placeholderRating = hasLandmarkInfo ? 3.5 + (name.length % 15) / 10 : null
  const reviewCount = placeholderReviews.length

  const verified = hasLandmarkInfo // For now, landmarks are "verified"

  return (
    <div className="absolute top-4 right-4 bg-black/95 backdrop-blur-md rounded-xl w-96 text-white shadow-2xl border border-white/10 overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col">
      {/* Hero Photo Area */}
      <div className="relative h-40 bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden flex-shrink-0">
        {photos ? (
          <img src={photos[0]} alt={name} className="w-full h-full object-cover" />
        ) : hasLandmarkInfo ? (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${placeholderPhotos[0]}, ${placeholderPhotos[1]})` }}
          >
            <div className="text-center text-white/30">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xs">No photos yet</p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-900">
            <div className="text-center text-white/20">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
        )}

        {/* Photo count badge */}
        {hasLandmarkInfo && (
          <button className="absolute bottom-3 right-3 bg-black/70 hover:bg-black/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {photos?.length || 0} photos
          </button>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Verified badge */}
        {verified && (
          <div className="absolute top-3 left-3 bg-blue-500/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Verified
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="overflow-y-auto flex-1">
        {/* Header */}
        <div className="p-4 pb-3">
          <h2 className="text-xl font-semibold text-white leading-tight">{name}</h2>

          {/* Rating and reviews summary */}
          {hasLandmarkInfo && placeholderRating && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-white font-medium">{placeholderRating.toFixed(1)}</span>
              <StarRating rating={placeholderRating} />
              <span className="text-white/50 text-sm">({reviewCount} reviews)</span>
            </div>
          )}

          {/* Category badges */}
          {(category || subcategory) && (
            <div className="flex flex-wrap gap-2 mt-2">
              {subcategory && (
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/70 text-xs">
                  {SUBCATEGORY_LABELS[subcategory] || subcategory}
                </span>
              )}
              {category && (
                <span className="px-2 py-0.5 rounded-md bg-white/5 text-white/50 text-xs">
                  {CATEGORY_LABELS[category] || category}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Open/Closed Status */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2">
            {openStatus.isOpen !== null && (
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${openStatus.isOpen ? 'bg-green-500' : 'bg-red-500'}`} />
            )}
            <span className={`text-sm ${openStatus.isOpen ? 'text-green-400' : openStatus.isOpen === false ? 'text-red-400' : 'text-white/50'}`}>
              {openStatus.text}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'overview' ? 'text-white border-b-2 border-white' : 'text-white/50 hover:text-white/70'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'reviews' ? 'text-white border-b-2 border-white' : 'text-white/50 hover:text-white/70'}`}
          >
            Reviews
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'photos' ? 'text-white border-b-2 border-white' : 'text-white/50 hover:text-white/70'}`}
          >
            Photos
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {activeTab === 'overview' && (
            <div className="space-y-3">
              {/* Address */}
              {address ? (
                <div className="flex items-start gap-3">
                  <svg className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm text-white/70">{address}, Belleville, IL</span>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <svg className="w-4 h-4 text-white/20 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm text-white/30 italic">Address unknown</span>
                </div>
              )}

              {/* Phone */}
              {phone ? (
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-white/40 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <a href={`tel:${phone}`} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">{phone}</a>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-white/20 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-sm text-white/30 italic">Phone unknown</span>
                </div>
              )}

              {/* Website */}
              {website ? (
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-white/40 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors truncate"
                  >
                    {website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-white/20 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  <span className="text-sm text-white/30 italic">Website unknown</span>
                </div>
              )}

              {/* Hours */}
              {formattedHours && (
                <details className="group mt-2">
                  <summary className="cursor-pointer text-sm text-white/60 hover:text-white/80 transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Hours</span>
                    <svg className="w-3 h-3 transform group-open:rotate-180 transition-transform ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="mt-2 ml-6 space-y-1">
                    {formattedHours.map(({ day, hours }) => (
                      <div key={day} className="flex justify-between text-xs">
                        <span className="text-white/50">{day}</span>
                        <span className={hours === 'Closed' ? 'text-white/30' : 'text-white/70'}>{hours}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Building info for unclaimed buildings */}
              {!hasLandmarkInfo && building && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-xs text-white/40 mb-2">Building Information</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/40">Footprint</span>
                      <span className="text-white/60">{building.size[0].toFixed(0)} × {building.size[2].toFixed(0)}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Height</span>
                      <span className="text-white/60">{building.size[1].toFixed(0)}m</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              {hasLandmarkInfo ? (
                <>
                  {/* Write review button */}
                  <button className="w-full py-2 px-4 rounded-lg border border-white/20 hover:border-white/40 text-white/70 hover:text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Write a review
                  </button>

                  {/* Reviews list */}
                  {placeholderReviews.length > 0 ? (
                    <div className="space-y-4">
                      {placeholderReviews.map((review, idx) => (
                        <div key={idx} className="border-b border-white/10 pb-4 last:border-0">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-medium flex-shrink-0">
                              {review.author.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white">{review.author}</span>
                                <span className="text-xs text-white/40">{review.neighborhood}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <StarRating rating={review.rating} size="sm" />
                                <span className="text-xs text-white/40">{review.time}</span>
                              </div>
                              <p className="text-sm text-white/70 mt-2">{review.text}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <svg className="w-12 h-12 mx-auto text-white/20 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="text-white/40 text-sm">No reviews yet</p>
                      <p className="text-white/30 text-xs mt-1">Be the first to share your experience</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 mx-auto text-white/20 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-white/40 text-sm">Unclaimed building</p>
                  <p className="text-white/30 text-xs mt-1">Claim this building to enable reviews</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'photos' && (
            <div>
              {hasLandmarkInfo ? (
                <>
                  {/* Add photo button */}
                  <button className="w-full py-2 px-4 rounded-lg border border-white/20 hover:border-white/40 text-white/70 hover:text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 mb-4">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add a photo
                  </button>

                  {/* Photo grid placeholder */}
                  {photos?.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {photos.map((photo, idx) => (
                        <div key={idx} className="aspect-square rounded-lg overflow-hidden">
                          <img src={photo} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <svg className="w-12 h-12 mx-auto text-white/20 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-white/40 text-sm">No photos yet</p>
                      <p className="text-white/30 text-xs mt-1">Be the first to add a photo</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 mx-auto text-white/20 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-white/40 text-sm">Unclaimed building</p>
                  <p className="text-white/30 text-xs mt-1">Claim this building to add photos</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Claim Button - sticky at bottom */}
      <div className="p-4 pt-2 border-t border-white/10 bg-black/95 flex-shrink-0">
        <button
          onClick={() => {
            alert('Claim flow coming soon! You\'ll verify ownership by scanning a QR code at this location.')
          }}
          className="w-full py-2.5 px-4 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Is this your business?
        </button>
      </div>
    </div>
  )
}

export default BusinessCard
