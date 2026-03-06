export interface EntityMatchingSettings {
  defaultNameMatchThreshold: number;
  possibleNameMatchThreshold: number;
  weakTokenWeight: number;
  weakTokenFloor: number;
  weakMatchTokens: string[];
}

export const ENTITY_MATCHING_SETTINGS: EntityMatchingSettings = {
  defaultNameMatchThreshold: 0.75,
  possibleNameMatchThreshold: 0.6,
  weakTokenWeight: 0.15,
  weakTokenFloor: 0.2,
  weakMatchTokens: ['leavenworth', 'wa', 'washington'],
};
