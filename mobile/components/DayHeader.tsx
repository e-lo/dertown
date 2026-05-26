import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../lib/theme';
import { formatDayHeader } from '../lib/dateUtils';

interface DayHeaderProps {
  dateStr: string; // "YYYY-MM-DD"
}

export function DayHeader({ dateStr }: DayHeaderProps) {
  const { dayOfWeek, dayNum, month } = formatDayHeader(dateStr);

  return (
    <View style={styles.container}>
      <Text style={styles.dayOfWeek}>{dayOfWeek.toUpperCase()}</Text>
      <Text style={styles.dayNum}>{dayNum}</Text>
      <Text style={styles.month}>{month}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.dayHeaderBg,
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  dayOfWeek: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.dayHeaderText,
    letterSpacing: 0.6,
    flex: 1,
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.dayHeaderText,
  },
  month: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.dayHeaderText,
    letterSpacing: 0.4,
    minWidth: 32,
  },
});
