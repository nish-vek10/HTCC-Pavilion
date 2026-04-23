// pavilion-app/src/components/ConfirmModal.jsx
// Reusable confirm/cancel modal — mirrors web ConfirmModal behaviour

import React from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, fonts, radius, spacing } from '../theme'

export default function ConfirmModal({
  visible,
  title       = 'Are you sure?',
  message     = '',
  confirmText = 'Confirm',
  cancelText  = 'Cancel',
  onConfirm,
  onCancel,
  danger      = false,   // renders confirm button in red if true
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      {/* Backdrop */}
      <View style={styles.backdrop}>
        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}

          <View style={styles.actions}>
            {/* Cancel */}
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>{cancelText}</Text>
            </TouchableOpacity>

            {/* Confirm */}
            <TouchableOpacity
              style={[styles.confirmBtn, danger && styles.dangerBtn]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    backgroundColor: colors.navyLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  title: {
    fontFamily: fonts.body,
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.sm,
  },
  message: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
  },
  dangerBtn: {
    backgroundColor: colors.red,
  },
  confirmText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.navy,
    fontWeight: '700',
  },
})