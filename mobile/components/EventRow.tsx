import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { THEME, getCategoryColor, getCategoryTextColor, getCategoryTextMuted } from '../lib/theme';
import { formatTimeRange } from '../lib/dateUtils';
import { Icon } from './Icon';
import type { MobileEvent } from '../lib/types';

export interface EventRowProps {
  event: MobileEvent;
  isStarred: boolean;
  onPress: () => void;
  onStar: () => void;
}

export function EventRow({ event, isStarred, onPress, onStar }: EventRowProps) {
  const category = event.primary_tag?.name ?? null;
  const bgColor   = getCategoryColor(category);
  const fgColor   = getCategoryTextColor(category);
  const fgMuted   = getCategoryTextMuted(category);
  const isLightBg = category ? ['Arts+Culture','Sports','Featured'].includes(category) : false;
  const starColor = isLightBg
    ? (isStarred ? '#111111' : 'rgba(0,0,0,0.25)')   // dark star on yellow bg
    : (isStarred ? THEME.starFilled : THEME.starUnstarred); // yellow star on dark bg
  const [year, month, day] = event.start_date.split('-').map(Number);
  const dayNum = String(day); // no leading zero
  const monthStr = new Date(year, month - 1, 1)
    .toLocaleDateString('en-US', { month: 'short' })
    .toUpperCase();
  const timeStr = formatTimeRange(event.start_time, event.end_time);

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: bgColor }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Left: date column — month label above large day number */}
      <View style={styles.dateCol}>
        <Text style={[styles.month, { color: fgMuted }]}>{monthStr}</Text>
        <Text style={[styles.dayNum, { color: fgColor }]}>{dayNum}</Text>
      </View>

      {/* Center: event info */}
      <View style={styles.content}>
        <Text style={[styles.title, { color: fgColor }]} numberOfLines={2}>{event.title}</Text>
        {timeStr ? <Text style={[styles.meta, { color: fgMuted }]}>{timeStr}</Text> : null}
        {event.location ? (
          <Text style={[styles.meta, { color: fgMuted }]} numberOfLines={1}>{event.location.name}</Text>
        ) : null}

        {/* Category pills at bottom of content */}
        <View style={styles.pills}>
          {event.primary_tag ? (
            <View style={[styles.pill, { backgroundColor: 'rgba(0,0,0,0.2)' }]}>
              <Text style={[styles.pillText, { color: fgColor }]}>{event.primary_tag.name}</Text>
            </View>
          ) : null}
          {event.secondary_tag ? (
            <View style={[styles.pill, { backgroundColor: 'rgba(0,0,0,0.2)' }]}>
              <Text style={[styles.pillText, { color: fgColor }]}>{event.secondary_tag.name}</Text>
            </View>
          ) : null}
          {event.registration ? (
            <View style={[styles.pill, styles.regPill]}>
              <Text style={[styles.pillText, { color: '#ffffff' }]}>Register</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Right: star button */}
      <TouchableOpacity
        style={styles.starBtn}
        onPress={onStar}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        testID="star-button"
      >
        <Icon
          name="star"
          size={22}
          color={starColor}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 0,
    minHeight: 80,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.15)',
  },
  dateCol: {
    width: 48,
    alignItems: 'center',
    marginRight: 12,
  },
  dayNum: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
  },
  month: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  regPill: {
    backgroundColor: '#166534',
  },
  pillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  starBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignSelf: 'center',
  },
});
