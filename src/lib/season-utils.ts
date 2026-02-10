/**
 * Determines the current season based on the date
 * Seasons are defined as:
 * - Winter: December 1 - February 28/29
 * - Spring: March 1 - May 31
 * - Summer: June 1 - August 31
 * - Fall: September 1 - November 30
 */
export function getCurrentSeason(date: Date = new Date()): 'winter' | 'spring' | 'summer' | 'fall' {
  const month = date.getMonth() + 1; // getMonth() returns 0-11, so add 1

  if (month === 12 || month <= 2) {
    return 'winter';
  } else if (month >= 3 && month <= 5) {
    return 'spring';
  } else if (month >= 6 && month <= 8) {
    return 'summer';
  } else {
    return 'fall';
  }
}

export type Season = 'winter' | 'spring' | 'summer' | 'fall';
