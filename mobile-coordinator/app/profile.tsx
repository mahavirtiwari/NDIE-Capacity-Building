import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../src/api/client';
import { auth as authApi } from '../src/api/endpoints';
import type { AuthUser } from '../src/api/types';
import { useAuth } from '../src/auth/AuthContext';
import { Banner, Card, DetailRow, Loading, Title } from '../src/components/ui';
import { colors, font, radius, spacing } from '../src/theme';

/**
 * What a permission key means to somebody who did not write it.
 *
 * The keys are the vocabulary the API and the portal share; nobody signing
 * in on a phone should have to read "programs.manage" and work out what it
 * lets them do. Anything unrecognised is shown as it is rather than hidden:
 * a key added later is still something this account holds.
 */
const PERMISSION_WORDS: Record<string, string> = {
  'programs.view': 'See the programs assigned to you',
  'programs.manage': 'Record a program: venue, sessions, attendance and marks',
  'programs.create': 'Raise a new program',
  'programs.approve': 'Permit or postpone a program',
  'programs.qc': "Quality check a conducted program's report",
  'trainers.view': 'See the faculty register',
  'trainers.manage': 'Put a trainer on the record',
  'materials.view': 'Open the training material published to you',
  'coordinators.view': 'See coordinators',
  'applications.view': 'See applications',
};

/**
 * Who this account is and what it may do.
 *
 * Read from the server rather than from the stored session: a role can be
 * reshaped while somebody is signed in, and what the screen should show is
 * what is true today.
 */
export default function Profile() {
  const router = useRouter();
  const { session } = useAuth();

  const [me, setMe] = useState<AuthUser | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setFailure(null);
    try {
      setMe(await authApi.me());
    } catch (caught) {
      setFailure(
        caught instanceof ApiError ? caught.message : 'Could not load your profile.',
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!me && !failure) return <Loading label="Loading your profile…" />;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      {failure ? <Banner tone="danger">{failure}</Banner> : null}

      <View style={styles.who}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {me?.avatarInitials || (session?.fullName ?? '?').slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <Title>{me?.fullName ?? session?.fullName}</Title>
        <Text style={styles.code}>{me?.userCode ?? session?.userCode}</Text>
        {me ? <Text style={styles.role}>{me.roleName || me.role}</Text> : null}
      </View>

      {me ? (
        <Card style={styles.card}>
          <Text style={styles.section}>Your details</Text>
          <DetailRow label="User ID" value={me.userCode} />
          <DetailRow label="Email" value={me.email || '—'} />
          <DetailRow label="Mobile" value={me.mobile || '—'} />
          <DetailRow label="Role" value={me.roleName || me.role} />
        </Card>
      ) : null}

      {me ? (
        <Card style={styles.card}>
          <Text style={styles.section}>What this role lets you do</Text>
          <Text style={styles.lead}>
            Granted by the Super Admin against your role. Ask your implementing agency if
            something you need is not here.
          </Text>

          {me.permissions.length === 0 ? (
            <Text style={styles.none}>Nothing is granted on this role yet.</Text>
          ) : (
            me.permissions.map((key) => (
              <View key={key} style={styles.grant}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success700} />
                <View style={styles.grantText}>
                  <Text style={styles.grantWords}>{PERMISSION_WORDS[key] ?? key}</Text>
                  <Text style={styles.grantKey}>{key}</Text>
                </View>
              </View>
            ))
          )}
        </Card>
      ) : null}

      {/* The one thing on this screen that changes something. The rest is
          the account as the office set it up, and is changed there. */}
      <Text
        style={styles.link}
        onPress={() => router.push('/change-password')}
        accessibilityRole="button"
      >
        Change password
      </Text>

      <Text style={styles.footnote}>
        Your name, email and mobile are held by the office that issued this account.
        Ask your implementing agency to correct them.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, gap: spacing.lg },

  who: { alignItems: 'center', gap: 4 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.brand700,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  avatarText: { color: colors.white, fontSize: font.lg, fontWeight: '700', letterSpacing: 1 },
  code: { fontSize: font.sm, color: colors.brand700, fontWeight: '700', letterSpacing: 0.5 },
  role: { fontSize: font.sm, color: colors.ink600 },

  card: { gap: spacing.sm },
  section: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  lead: { fontSize: font.sm, color: colors.ink600, lineHeight: 18 },
  none: { fontSize: font.sm, color: colors.ink500 },

  grant: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 5 },
  grantText: { flex: 1, gap: 1 },
  grantWords: { fontSize: font.sm, color: colors.ink900, lineHeight: 18 },
  grantKey: { fontSize: font.xs, color: colors.ink400, letterSpacing: 0.3 },

  link: {
    fontSize: font.base,
    fontWeight: '700',
    color: colors.brand700,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  footnote: { fontSize: font.xs, color: colors.ink500, textAlign: 'center', lineHeight: 16 },
});
