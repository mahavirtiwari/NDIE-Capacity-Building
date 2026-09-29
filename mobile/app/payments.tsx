import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { me } from '../src/api/endpoints';
import type { Application } from '../src/api/types';
import { useResource } from '../src/api/useResource';
import { Banner, Card, EmptyState, Loading, inr, shortDate } from '../src/components/ui';
import { colors, font, radius, spacing } from '../src/theme';

/**
 * Every fee this applicant owes or has paid, in one place.
 *
 * Fees belong to applications, so the list is assembled from them rather than
 * from a ledger of its own — an applicant thinking "what do I owe?" should not
 * have to open each application to find out.
 */
export default function Payments() {
  const router = useRouter();
  const applications = useResource<Application[]>(() => me.applications(), []);

  const { due, settled, outstanding } = useMemo(() => {
    const rows = (applications.data ?? []).filter(
      (row) => row.paymentStatus !== 'NotApplicable' && row.feeAmount > 0,
    );
    const pending = rows.filter((row) => row.paymentStatus === 'Pending' || row.paymentStatus === 'Failed');
    return {
      due: pending,
      settled: rows.filter((row) => row.paymentStatus === 'Paid' || row.paymentStatus === 'Refunded'),
      outstanding: pending.reduce((sum, row) => sum + row.feeAmount, 0),
    };
  }, [applications.data]);

  if (applications.loading && !applications.data) return <Loading />;

  const nothing = due.length === 0 && settled.length === 0;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={applications.loading} onRefresh={applications.refresh} />
      }
    >
      {applications.error ? <Banner tone="danger">{applications.error}</Banner> : null}

      {nothing ? (
        <EmptyState
          icon="card"
          title="Nothing to pay"
          message="Fees appear here once you apply for a programme that charges one."
        />
      ) : (
        <>
          {outstanding > 0 ? (
            <View style={styles.summary}>
              <Text style={styles.summaryLabel}>OUTSTANDING</Text>
              <Text style={styles.summaryValue}>{inr(outstanding)}</Text>
              <Text style={styles.summaryNote}>
                Across {due.length} application{due.length === 1 ? '' : 's'}
              </Text>
            </View>
          ) : null}

          {due.length > 0 ? (
            <View style={styles.group}>
              <Text style={styles.groupTitle}>Due</Text>
              {due.map((row) => (
                <FeeRow key={row.id} row={row} onPress={() => router.push(`/application/${row.id}`)} />
              ))}
            </View>
          ) : null}

          {settled.length > 0 ? (
            <View style={styles.group}>
              <Text style={styles.groupTitle}>Paid</Text>
              {settled.map((row) => (
                <FeeRow key={row.id} row={row} onPress={() => router.push(`/application/${row.id}`)} />
              ))}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function FeeRow({ row, onPress }: { row: Application; onPress: () => void }) {
  const paid = row.paymentStatus === 'Paid';
  const failed = row.paymentStatus === 'Failed';

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card style={styles.row}>
        <View
          style={[
            styles.icon,
            paid && styles.iconPaid,
            failed && styles.iconFailed,
          ]}
        >
          <Ionicons
            name={paid ? 'receipt-outline' : failed ? 'alert-circle-outline' : 'time-outline'}
            size={18}
            color={paid ? colors.success700 : failed ? colors.danger700 : colors.warning700}
          />
        </View>

        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {row.programTypeName ?? 'Programme fee'}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {row.applicationNo} · {shortDate(row.submittedOn)}
          </Text>
          {failed ? (
            <Text style={styles.rowFailed}>The last attempt did not go through.</Text>
          ) : null}
        </View>

        <View style={styles.rowRight}>
          <Text style={styles.amount}>{inr(row.feeAmount)}</Text>
          <Text style={[styles.state, paid && styles.statePaid, failed && styles.stateFailed]}>
            {row.paymentStatus}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },

  summary: {
    backgroundColor: colors.brand700,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 2,
  },
  summaryLabel: { fontSize: font.xs, fontWeight: '700', color: colors.onBrandMuted, letterSpacing: 1 },
  summaryValue: { fontSize: font.xxl, fontWeight: '700', color: colors.white },
  summaryNote: { fontSize: font.sm, color: colors.onBrandMuted },

  group: { gap: spacing.sm },
  groupTitle: { fontSize: font.sm, fontWeight: '700', color: colors.ink700 },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.warning50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPaid: { backgroundColor: colors.success50 },
  iconFailed: { backgroundColor: colors.danger50 },

  rowText: { flex: 1, gap: 1 },
  rowTitle: { fontSize: font.base, fontWeight: '600', color: colors.ink900 },
  rowMeta: { fontSize: font.xs, color: colors.ink500 },
  rowFailed: { fontSize: font.xs, color: colors.danger700, marginTop: 2 },

  rowRight: { alignItems: 'flex-end', gap: 2 },
  amount: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  state: { fontSize: font.xs, fontWeight: '600', color: colors.warning700 },
  statePaid: { color: colors.success700 },
  stateFailed: { color: colors.danger700 },
});
