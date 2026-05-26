import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { THEME } from '../lib/theme';
import {
  getTodayDateString,
  getDateString,
  getThisWeekendRange,
  getNextWeekRange,
} from '../lib/dateUtils';
import { Icon } from './Icon';

interface DatePickerModalProps {
  visible: boolean;
  /** Currently highlighted date in the calendar ("YYYY-MM-DD") */
  selectedDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay(); // 0=Sunday
}

export function DatePickerModal({
  visible,
  selectedDate,
  onSelect,
  onClose,
}: DatePickerModalProps) {
  const today = getTodayDateString();
  const [viewYear, setViewYear]   = useState(() => parseInt(selectedDate.split('-')[0]));
  const [viewMonth, setViewMonth] = useState(() => parseInt(selectedDate.split('-')[1])); // 1-12

  // When the modal opens, reset the view to the currently selected month
  useEffect(() => {
    if (visible) {
      setViewYear(parseInt(selectedDate.split('-')[0]));
      setViewMonth(parseInt(selectedDate.split('-')[1]));
    }
  }, [visible]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDow    = getFirstDayOfWeek(viewYear, viewMonth);
  const monthName   = new Date(viewYear, viewMonth - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(viewYear - 1); setViewMonth(12); }
    else setViewMonth(viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear(viewYear + 1); setViewMonth(1); }
    else setViewMonth(viewMonth + 1);
  }

  function selectDay(day: number) {
    const d = getDateString(new Date(viewYear, viewMonth - 1, day));
    onSelect(d);
    onClose();
  }

  function selectToday() {
    onSelect(today);
    onClose();
  }

  function selectWeekend() {
    const { start } = getThisWeekendRange();
    onSelect(start);
    onClose();
  }

  function selectNextWeek() {
    const { start } = getNextWeekRange();
    onSelect(start);
    onClose();
  }

  const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          {/* Quick buttons */}
          <View style={styles.quickRow}>
            {[
              { label: 'Today',        fn: selectToday   },
              { label: 'This Weekend', fn: selectWeekend },
              { label: 'Next Week',    fn: selectNextWeek},
            ].map(({ label, fn }) => (
              <TouchableOpacity key={label} style={styles.quickBtn} onPress={fn}>
                <Text style={styles.quickLabel}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.divider} />

          {/* Month navigation */}
          <View style={styles.monthRow}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
              <Icon name="chevron-left" size={20} color={THEME.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{monthName}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
              <Icon name="chevron-right" size={20} color={THEME.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Day-of-week header */}
          <View style={styles.dowRow}>
            {DAY_LABELS.map((d, i) => (
              <Text key={i} style={styles.dowLabel}>{d}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.grid}>
            {/* Empty cells for first-day-of-week offset */}
            {Array.from({ length: firstDow }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.cell} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dateStr = getDateString(new Date(viewYear, viewMonth - 1, day));
              const isSelected = dateStr === selectedDate;
              const isToday    = dateStr === today;
              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.cell,
                    isSelected && styles.cellSelected,
                    isToday && !isSelected && styles.cellToday,
                  ]}
                  onPress={() => selectDay(day)}
                >
                  <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const CELL_WIDTH = `${(100 / 7).toFixed(4)}%` as `${number}%`;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 20,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  dowRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dowLabel: {
    width: CELL_WIDTH,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: THEME.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: CELL_WIDTH,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSelected: {
    backgroundColor: THEME.canary,
    borderRadius: 100,
  },
  cellToday: {
    borderWidth: 1,
    borderColor: THEME.canary,
    borderRadius: 100,
  },
  dayNum: {
    fontSize: 14,
    color: THEME.textPrimary,
  },
  dayNumSelected: {
    color: '#111827',
    fontWeight: '700',
  },
});
