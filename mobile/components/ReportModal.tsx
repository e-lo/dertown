/**
 * Flag-objectionable-content modal (App Store Guideline 1.2).
 *
 * Presents report reasons, optionally lets the user block the organizer,
 * and submits to /api/mobile/report so the developer is notified and can
 * act within 24 hours.
 */
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { THEME } from '../lib/theme';
import { submitReport } from '../lib/moderation';
import type { ReportContentType } from '../lib/moderation';
import { useBlocked } from '../contexts/BlockContext';

const REASONS = [
  'Inappropriate or offensive',
  'Spam or misleading',
  'Harassment or abuse',
  'Inaccurate information',
  'Other',
] as const;

interface Props {
  visible: boolean;
  onClose: () => void;
  contentType: ReportContentType;
  contentId: string;
  contentTitle: string;
  /** When set, offers a "Block this organizer" option alongside the report. */
  organization?: { id: string; name: string } | null;
}

export function ReportModal({
  visible,
  onClose,
  contentType,
  contentId,
  contentTitle,
  organization,
}: Props) {
  const { blockOrg, blockedOrgIds } = useBlocked();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const orgBlockable = organization != null && !blockedOrgIds.has(organization.id);

  const reset = () => {
    setReason(null);
    setDetails('');
    setAlsoBlock(false);
    setSubmitted(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    if (!reason) return;
    // Fire-and-forget: confirmation shows immediately; the block (if chosen)
    // applies locally right away regardless of network state.
    submitReport({
      action: 'report',
      contentType,
      contentId,
      contentTitle,
      reason,
      details: details.trim() || undefined,
    });
    if (alsoBlock && organization) {
      blockOrg(organization);
    }
    setSubmitted(true);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          {submitted ? (
            <>
              <Text style={styles.title}>Thank you</Text>
              <Text style={styles.body}>
                Your report has been sent. We review reports within 24 hours and
                remove content that violates our terms of use.
                {alsoBlock && organization
                  ? ` Content from ${organization.name} is now hidden.`
                  : ''}
              </Text>
              <TouchableOpacity style={styles.submitBtn} onPress={handleClose}>
                <Text style={styles.submitBtnText}>Done</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>Report content</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {contentTitle}
              </Text>

              {REASONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.reasonRow, reason === r && styles.reasonRowActive]}
                  onPress={() => setReason(r)}
                >
                  <View style={[styles.radio, reason === r && styles.radioActive]} />
                  <Text style={styles.reasonText}>{r}</Text>
                </TouchableOpacity>
              ))}

              <TextInput
                style={styles.detailsInput}
                placeholder="Additional details (optional)"
                placeholderTextColor={THEME.textMuted}
                value={details}
                onChangeText={setDetails}
                multiline
              />

              {orgBlockable && (
                <TouchableOpacity
                  style={styles.blockRow}
                  onPress={() => setAlsoBlock((b) => !b)}
                >
                  <View style={[styles.checkbox, alsoBlock && styles.checkboxActive]}>
                    {alsoBlock ? <Text style={styles.checkboxMark}>✓</Text> : null}
                  </View>
                  <Text style={styles.blockText}>
                    Also block {organization!.name} — hide all their content
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, !reason && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={!reason}
              >
                <Text style={styles.submitBtnText}>Submit report</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: THEME.cardBackground,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 36,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.textMuted,
    marginBottom: 14,
  },
  body: {
    fontSize: 14,
    color: THEME.textSecondary,
    lineHeight: 21,
    marginVertical: 10,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  reasonRowActive: {
    backgroundColor: 'rgba(255,230,0,0.08)',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: THEME.textMuted,
  },
  radioActive: {
    borderColor: THEME.canary,
    backgroundColor: THEME.canary,
  },
  reasonText: {
    fontSize: 15,
    color: THEME.textPrimary,
  },
  detailsInput: {
    marginTop: 10,
    minHeight: 60,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: 10,
    color: THEME.textPrimary,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: THEME.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    borderColor: THEME.canary,
    backgroundColor: THEME.canary,
  },
  checkboxMark: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111111',
  },
  blockText: {
    flex: 1,
    fontSize: 13,
    color: THEME.textSecondary,
    lineHeight: 18,
  },
  submitBtn: {
    marginTop: 18,
    backgroundColor: THEME.canary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    color: THEME.textMuted,
  },
});
