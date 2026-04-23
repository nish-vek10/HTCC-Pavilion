// pavilion-app/src/screens/public/SignupScreen.jsx
// Mirrors pavilion-web/src/pages/public/SignupPage.jsx
// Includes: phone code dropdown (Modal-based), password checklist, strength bar

import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Image, Modal, FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import useAuthStore from '../../store/authStore'
import { SCREENS, APP_NAME, CLUB_NAME } from '../../lib/constants'
import { colors, fonts, spacing, radius } from '../../theme'

// ─── CONFIGURABLE: Phone country codes — iso used for flagcdn.com images ──────
const PHONE_CODES = [
  { code: '+44',  iso: 'gb', label: 'United Kingdom' },
  { code: '+1',   iso: 'us', label: 'United States' },
  { code: '+1',   iso: 'ca', label: 'Canada' },
  { code: '+91',  iso: 'in', label: 'India' },
  { code: '+92',  iso: 'pk', label: 'Pakistan' },
  { code: '+880', iso: 'bd', label: 'Bangladesh' },
  { code: '+94',  iso: 'lk', label: 'Sri Lanka' },
  { code: '+971', iso: 'ae', label: 'UAE' },
  { code: '+966', iso: 'sa', label: 'Saudi Arabia' },
  { code: '+27',  iso: 'za', label: 'South Africa' },
  { code: '+254', iso: 'ke', label: 'Kenya' },
  { code: '+234', iso: 'ng', label: 'Nigeria' },
  { code: '+61',  iso: 'au', label: 'Australia' },
  { code: '+64',  iso: 'nz', label: 'New Zealand' },
  { code: '+33',  iso: 'fr', label: 'France' },
  { code: '+49',  iso: 'de', label: 'Germany' },
  { code: '+34',  iso: 'es', label: 'Spain' },
  { code: '+39',  iso: 'it', label: 'Italy' },
  { code: '+31',  iso: 'nl', label: 'Netherlands' },
  { code: '+351', iso: 'pt', label: 'Portugal' },
  { code: '+353', iso: 'ie', label: 'Ireland' },
  { code: '+212', iso: 'ma', label: 'Morocco' },
  { code: '+20',  iso: 'eg', label: 'Egypt' },
  { code: '+60',  iso: 'my', label: 'Malaysia' },
  { code: '+65',  iso: 'sg', label: 'Singapore' },
  { code: '+86',  iso: 'cn', label: 'China' },
  { code: '+81',  iso: 'jp', label: 'Japan' },
  { code: '+82',  iso: 'kr', label: 'South Korea' },
  { code: '+55',  iso: 'br', label: 'Brazil' },
  { code: '+52',  iso: 'mx', label: 'Mexico' },
]

// ─── Password strength helper — driven by live check results ──────────────────
function getPasswordStrength(password, checks) {
  if (!password) return null
  const score = Object.values(checks).filter(Boolean).length
  if (score <= 1) return { label: 'Too weak', color: colors.red,   width: '25%' }
  if (score === 2) return { label: 'Weak',    color: '#F97316',    width: '50%' }
  if (score === 3) return { label: 'Good',    color: colors.gold,  width: '75%' }
  return                  { label: 'Strong',  color: colors.green, width: '100%' }
}

// ─── Phone code dropdown ──────────────────────────────────────────────────────
// React Native has no DOM positioning — uses Modal for the overlay panel
function PhoneCodeDropdown({ value, onChange, disabled }) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')

  // Resolve selected entry — prefer GB for +44 default
  const selected =
    PHONE_CODES.find(c => c.code === value && c.iso === 'gb') ||
    PHONE_CODES.find(c => c.code === value) ||
    PHONE_CODES[0]

  // Filter list by search term
  const filtered = search.trim()
    ? PHONE_CODES.filter(c =>
        c.label.toLowerCase().includes(search.toLowerCase()) ||
        c.code.includes(search)
      )
    : PHONE_CODES

  return (
    <View style={drop.wrapper}>

      {/* ── Trigger button ── */}
      <TouchableOpacity
        style={[drop.trigger, open && drop.triggerOpen]}
        onPress={() => { setOpen(true); setSearch('') }}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: `https://flagcdn.com/w40/${selected.iso}.png` }}
          style={drop.flag}
        />
        <Text style={drop.code}>{selected.code}</Text>
        <Text style={drop.chevron}>▼</Text>
      </TouchableOpacity>

      {/* ── Full-screen modal with centred panel ── */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        {/* Tap-outside backdrop */}
        <TouchableOpacity
          style={drop.backdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          {/* Panel — onStartShouldSetResponder stops taps propagating to backdrop */}
          <View style={drop.panel} onStartShouldSetResponder={() => true}>

            {/* Search input */}
            <View style={drop.searchWrap}>
              <TextInput
                style={drop.searchInput}
                placeholder="🔍  Search country or code…"
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
            </View>

            {/* Country list — keyboardShouldPersistTaps allows tap while keyboard open */}
            <FlatList
              data={filtered}
              keyExtractor={(item, index) => `${item.iso}-${index}`}
              keyboardShouldPersistTaps="handled"
              style={drop.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    drop.option,
                    item.code === value && item.iso === selected.iso && drop.optionSelected,
                  ]}
                  onPress={() => { onChange(item.code); setOpen(false) }}
                  activeOpacity={0.7}
                >
                  <Image
                    source={{ uri: `https://flagcdn.com/w40/${item.iso}.png` }}
                    style={drop.flagLg}
                  />
                  <Text style={drop.optionLabel} numberOfLines={1}>{item.label}</Text>
                  <Text style={drop.optionCode}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function SignupScreen({ navigation }) {

  // ─── Form state ───────────────────────────────────────────────────────────
  const [fullName,    setFullName]    = useState('')
  const [email,       setEmail]       = useState('')
  const [phoneCode,   setPhoneCode]   = useState('+44')   // dial code
  const [phoneNumber, setPhoneNumber] = useState('')       // local number
  const [password,    setPassword]    = useState('')
  const [confirmPw,   setConfirmPw]   = useState('')
  const [showPw,      setShowPw]      = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const { signUp } = useAuthStore()

  // ─── Live password checks — mirrors web pwChecks ──────────────────────────
  const pwChecks = {
    hasUpper:  /[A-Z]/.test(password),
    hasLower:  /[a-z]/.test(password),
    hasDigit:  /[0-9]/.test(password),
    hasLength: password.length >= 8,
  }
  const allChecksPassed = Object.values(pwChecks).every(Boolean)
  const strength        = getPasswordStrength(password, pwChecks)

  // ─── Submit ───────────────────────────────────────────────────────────────
  async function handleSignup() {
    setError('')

    if (!fullName.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.')
      return
    }
    if (!phoneNumber.trim()) {
      setError('Phone number is required.')
      return
    }
    if (password !== confirmPw) {
      setError('Passwords do not match.')
      return
    }
    if (!allChecksPassed) {
      setError('Password must meet all requirements below.')
      return
    }

    // Combine code + number — strip leading 0 (e.g. 07307 → +447307)
    const fullPhone = phoneCode + phoneNumber.replace(/^0/, '')

    setLoading(true)
    try {
      await signUp({ email, password, fullName, phone: fullPhone, phoneCode })
      navigation.navigate(SCREENS.CHECK_EMAIL)
    } catch (err) {
      if (err.message?.includes('already registered')) {
        setError('An account with this email already exists. Try signing in.')
      } else {
        setError(err.message || 'Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── HTCC Crest ── */}
          <View style={styles.crestWrap}>
            <Image
              source={require('../../../assets/htcc-logo.png')}
              style={styles.crestImage}
              resizeMode="cover"
            />
          </View>

          <Text style={styles.appName}>Join {APP_NAME}</Text>
          <Text style={styles.subHeading}>
            Register for {CLUB_NAME}.{'\n'}An admin will approve your account shortly.
          </Text>

          {/* ── Error banner ── */}
          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* ── Form card ── */}
          <View style={styles.card}>

            {/* Full Name */}
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="John Smith"
              placeholderTextColor={colors.textMuted}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              editable={!loading}
            />

            {/* Email */}
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              editable={!loading}
            />

            {/* Phone — code picker + number input */}
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.phoneRow}>
              <PhoneCodeDropdown
                value={phoneCode}
                onChange={setPhoneCode}
                disabled={loading}
              />
              <TextInput
                style={[styles.input, styles.phoneInput]}
                placeholder="07123 456 789"
                placeholderTextColor={colors.textMuted}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                editable={!loading}
              />
            </View>

            {/* Password + show/hide toggle */}
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity onPress={() => setShowPw(p => !p)}>
                <Text style={styles.showHide}>{showPw ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Min. 8 characters"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              autoComplete="new-password"
              editable={!loading}
            />

            {/* Password strength bar */}
            {strength && (
              <View style={styles.strengthWrap}>
                <View style={styles.strengthTrack}>
                  <View style={[
                    styles.strengthFill,
                    { width: strength.width, backgroundColor: strength.color },
                  ]} />
                </View>
                <Text style={[styles.strengthLabel, { color: strength.color }]}>
                  {strength.label}
                </Text>
              </View>
            )}

            {/* Live password requirements checklist — shown as user types */}
            {password.length > 0 && (
              <View style={styles.checklist}>
                {[
                  { key: 'hasUpper',  label: 'At least one uppercase letter' },
                  { key: 'hasLower',  label: 'At least one lowercase letter' },
                  { key: 'hasDigit',  label: 'At least one number' },
                  { key: 'hasLength', label: 'Minimum 8 characters' },
                ].map(req => (
                  <View key={req.key} style={styles.checkRow}>
                    <Text style={[
                      styles.checkIcon,
                      { color: pwChecks[req.key] ? colors.green : colors.textMuted },
                    ]}>
                      {pwChecks[req.key] ? '✓' : '○'}
                    </Text>
                    <Text style={[
                      styles.checkText,
                      { color: pwChecks[req.key] ? colors.green : colors.textMuted },
                    ]}>
                      {req.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Confirm Password */}
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Repeat password"
              placeholderTextColor={colors.textMuted}
              value={confirmPw}
              onChangeText={setConfirmPw}
              secureTextEntry={!showPw}
              editable={!loading}
            />
            {/* Inline mismatch hint */}
            {!!confirmPw && password !== confirmPw && (
              <Text style={styles.mismatch}>Passwords don't match</Text>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>
                {loading ? 'Creating account…' : 'Create Account →'}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <Text style={styles.switchText}>
              Already a member?{' '}
              <Text
                style={styles.switchLink}
                onPress={() => navigation.navigate(SCREENS.LOGIN)}
              >
                Sign in
              </Text>
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate(SCREENS.WELCOME)}
            style={styles.backLink}
          >
            <Text style={styles.backLinkText}>← Back to home</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Dropdown styles ──────────────────────────────────────────────────────────
const drop = StyleSheet.create({
  wrapper:  { width: 110, flexShrink: 0 },

  trigger: {
    height: 50,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.navy,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
  },
  triggerOpen: { borderColor: 'rgba(245,197,24,0.5)' },

  flag:    { width: 24, height: 18, borderRadius: 2 },
  flagLg:  { width: 28, height: 21, borderRadius: 2, flexShrink: 0 },
  code:    { fontFamily: fonts.body, fontWeight: '700', fontSize: 13, color: colors.white },
  chevron: { fontSize: 8, color: colors.textMuted, marginLeft: 'auto' },

  // Modal overlay — tap outside to dismiss
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  // Centred panel
  panel: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1A2F4A',
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)',
    overflow: 'hidden',
  },
  searchWrap: { padding: 10 },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  list: { maxHeight: 260 },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  optionSelected: { backgroundColor: 'rgba(245,197,24,0.08)' },
  optionLabel:    { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.white, fontWeight: '500' },
  optionCode:     { fontFamily: fonts.body, fontSize: 12, color: colors.gold, fontWeight: '700' },
})

// ─── Screen styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.navy },
  scroll: { flexGrow: 1, alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xl },

  crestWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.navy,
    borderWidth: 2, borderColor: colors.gold,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
    marginBottom: spacing.md,
  },
  crestImage: { width: '100%', height: '100%' },

  appName:    { fontFamily: fonts.display, fontSize: 28, letterSpacing: 2, color: colors.white, marginBottom: 4 },
  subHeading: {
    fontFamily: fonts.body, fontSize: 13, color: colors.textMuted,
    textAlign: 'center', lineHeight: 20, marginBottom: spacing.xl,
  },

  errorBanner: {
    width: '100%',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: radius.md, padding: 12, marginBottom: spacing.md,
  },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.red },

  card: {
    width: '100%',
    backgroundColor: colors.navyLight,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.lg,
  },

  labelRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: spacing.sm, marginBottom: 6,
  },
  label:    { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginBottom: 6, marginTop: spacing.sm },
  showHide: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },

  input: {
    backgroundColor: colors.navy,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: 14,
    color: colors.white, fontFamily: fonts.body, fontSize: 15,
    marginBottom: spacing.sm,
  },

  // Phone row: dropdown (fixed 110px) + number input (flex fills rest)
  phoneRow:   { flexDirection: 'row', gap: 8, marginBottom: spacing.sm, alignItems: 'center' },
  phoneInput: { flex: 1, marginBottom: 0 },

  strengthWrap:  { marginBottom: spacing.sm },
  strengthTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  strengthFill:  { height: '100%', borderRadius: 2 },
  strengthLabel: { fontFamily: fonts.body, fontSize: 11, textAlign: 'right' },

  // Password requirements checklist box
  checklist: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: 12,
    marginBottom: spacing.sm, gap: 6,
  },
  checkRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkIcon: { fontSize: 11, width: 14, textAlign: 'center' },
  checkText: { fontFamily: fonts.body, fontSize: 12 },

  mismatch: { fontFamily: fonts.body, fontSize: 12, color: colors.red, marginTop: -4, marginBottom: spacing.sm },

  btn:         { width: '100%', backgroundColor: colors.gold, padding: 15, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.sm },
  btnDisabled: { opacity: 0.6 },
  btnText:     { fontFamily: fonts.body, fontWeight: '700', fontSize: 15, color: colors.navy },

  divider:    { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  switchText: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  switchLink: { color: colors.gold, fontWeight: '600' },

  backLink:     { marginTop: spacing.lg },
  backLinkText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
})