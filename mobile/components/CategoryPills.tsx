import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { THEME, getCategoryColor } from '../lib/theme';

interface CategoryPillsProps {
  categories: string[];
  selected: string | null;
  onSelect: (category: string | null) => void;
}

export function CategoryPills({ categories, selected, onSelect }: CategoryPillsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {/* All pill */}
      <TouchableOpacity
        style={[styles.pill, selected === null && styles.pillActive]}
        onPress={() => onSelect(null)}
      >
        <Text style={[styles.label, selected === null && styles.labelActive]}>All</Text>
      </TouchableOpacity>

      {categories.map((cat) => {
        const isSelected = selected === cat;
        return (
          <TouchableOpacity
            key={cat}
            style={[
              styles.pill,
              isSelected && { backgroundColor: getCategoryColor(cat) },
            ]}
            onPress={() => onSelect(isSelected ? null : cat)}
          >
            <Text style={[styles.label, isSelected && styles.labelSelectedCat]}>{cat}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: THEME.feedBackground,
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    flexDirection: 'row',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  pillActive: {
    backgroundColor: THEME.canary,
    borderColor: THEME.canary,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  labelActive: {
    color: '#111827',
  },
  labelSelectedCat: {
    color: THEME.textPrimary,
  },
});
