import { create } from 'zustand'
import landmarksData from '../data/landmarks.json'

// Category emoji mapping
export const CATEGORY_EMOJI = {
  government: '🏛️',
  health: '🏥',
  culture: '🎭',
  goods: '🛍️',
  work: '🛠️',
  survival: '🏠',
}

// Subcategory emoji mapping (more specific)
export const SUBCATEGORY_EMOJI = {
  // Government
  'courts': '⚖️',
  'municipal': '🏛️',
  'postal': '📮',
  // Health
  'public-health': '🏥',
  'emergency': '🚑',
  'family-services': '👨‍👩‍👧',
  'fitness': '💪',
  // Culture
  'arts': '🎭',
  'learning': '📚',
  'community-spaces': '📖',
  'food-drink': '🍽️',
  'faith': '⛪',
  // Goods
  'repair': '🔧',
  'local-makers': '🛍️',
  // Work
  'services': '🛠️',
  // Survival
  'housing': '🏨',
}

const useLandmarkFilter = create((set, get) => ({
  // Active filter tags (subcategories)
  activeTags: new Set(),

  // Toggle a tag on/off
  toggleTag: (tag) => set((state) => {
    const newTags = new Set(state.activeTags)
    if (newTags.has(tag)) {
      newTags.delete(tag)
    } else {
      newTags.add(tag)
    }
    return { activeTags: newTags }
  }),

  // Clear all tags
  clearTags: () => set({ activeTags: new Set() }),

  // Check if a tag is active
  isTagActive: (tag) => get().activeTags.has(tag),

  // Get filtered landmarks based on active tags
  getFilteredLandmarks: () => {
    const { activeTags } = get()
    if (activeTags.size === 0) return []

    return landmarksData.landmarks.filter(l =>
      activeTags.has(l.subcategory) || activeTags.has(l.category)
    )
  },

  // Get emoji for a landmark
  getEmojiForLandmark: (landmark) => {
    return SUBCATEGORY_EMOJI[landmark.subcategory] || CATEGORY_EMOJI[landmark.category] || '📍'
  },
}))

export default useLandmarkFilter
