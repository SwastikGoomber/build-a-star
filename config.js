// config.js
export const CONFIG = {
  PERFECT_THRESHOLD: 0.85, // Slightly more forgiving (was 0.92)
  GOOD_THRESHOLD: 0.65, // Lower threshold to properly categorize good vs bad stars (was 0.75)
  MIN_POINTS: 12, // Minimum points needed for valid path
  STAR_POINTS_MIN: 4, // Minimum points a star should have
  STAR_POINTS_MAX: 12, // Maximum points a star should have
  SAMPLE_RATE: 4, // Sample every Nth point for performance (was 5)
};
