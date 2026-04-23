// pavilion-app/src/screens/admin/AdminTrainingAnnouncementsScreen.jsx
// Combined tab — Training (default) + Announcements toggle

import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, fonts, spacing, radius } from '../../theme'
import AdminTrainingScreen      from './AdminTrainingScreen'
import AdminAnnouncementsScreen from './AdminAnnouncementsScreen'
import AppIcon                  from '../../components/AppIcon'

export default function AdminTrainingAnnouncementsScreen({ navigation }) {
  const [activePanel, setActivePanel] = useState('training')
  const insets = useSafeAreaInsets()

  return (
    <View style={styles.container}>
      {/* ── Toggle switcher — respects safe area on both iOS and Android ── */}
      <View style={[styles.switcher, { marginTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={[styles.switchBtn, activePanel === 'training' && styles.switchBtnActive]}
          onPress={() => setActivePanel('training')}
          activeOpacity={0.7}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <AppIcon name="training" size={13} tint={activePanel === 'training' ? colors.gold : colors.textMuted} />
            <Text style={[styles.switchBtnText, activePanel === 'training' && styles.switchBtnTextActive]}>Training</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.switchBtn, activePanel === 'announcements' && styles.switchBtnActiveAnnounce]}
          onPress={() => setActivePanel('announcements')}
          activeOpacity={0.7}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <AppIcon name="announcement" size={13} tint={activePanel === 'announcements' ? '#A78BFA' : colors.textMuted} />
            <Text style={[styles.switchBtnText, activePanel === 'announcements' && styles.switchBtnTextActiveAnnounce]}>Announce</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Active panel ── */}
      <View style={styles.panel}>
        {activePanel === 'training'
          ? <AdminTrainingScreen navigation={navigation} embedded />
          : <AdminAnnouncementsScreen navigation={navigation} embedded />
        }
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  switcher:  {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: colors.navyLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    padding: 3,
  },
  switchBtn: {
    flex: 1, paddingVertical: 9,
    borderRadius: radius.full,
    alignItems: 'center',
  },
  switchBtnActive: {
    backgroundColor: 'rgba(245,197,24,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.3)',
  },
  switchBtnActiveAnnounce: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.3)',
  },
  switchBtnText:             { fontFamily: fonts.bold, fontSize: 13, color: colors.textMuted },
  switchBtnTextActive:       { color: colors.gold },
  switchBtnTextActiveAnnounce: { color: '#A78BFA' },
  panel: { flex: 1 },
})