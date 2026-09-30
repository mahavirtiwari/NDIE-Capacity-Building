import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { me } from '../src/api/endpoints';
import type { Application, PaymentTransaction } from '../src/api/types';
import { useResource } from '../src/api/useResource';
import { Banner, Card, EmptyState, Loading, inr, shortDate } from '../src/components/ui';
import { colors, font, radius, spacing } from '../src/theme';

/**
 * Fees owed and fees paid, in one place.
 *
 * Two lists rather than one, because they answer different questions. What
 * is owed comes from the applications that carry a fee; what was paid comes
 * from the attempts, which is where the reference a bank will ask for lives.
 */
export default function Payments() {
  const router = useRouter();
  const applications = useResource<Application[]>(() => me.applications(), []);
  const history = useResource<PaymentTransaction[]>(() => me.payments(), []);

  /* Coming back from the gateway should show the receipt straight away. */
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      applications.refresh();
      history.refresh();
      /* Not the resources themselves: those are new objects on every
         render, which turned this into a refetch loop. */
    }, [applications.refresh, history.refresh]),
  );

  const { due, outstanding } = useMemo(() => {
    const rows = (applications.data ?? []).filter(
      (row) =>
        row.feeAmount > 0 &&
        (row.paymentStatus === 'Pending' || row.paymentStatus === 'Failed'),
    );
    return { due: rows, outstanding: rows.reduce((sum, row) => sum + row.feeAmount, 0) };
  }, [applications.data]);

  const receipts = history.data ?? [];

  if (applications.loading && !applications.data) return <Loading />;

  const refreshing = applications.refreshing || history.refreshing;
  const refresh = () => {
    applications.refresh();
    history.refresh();
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      {applications.error ? <Banner tone="danger">{applications.error}</Banner> : null}

      {due.length === 0 && receipts.length === 0 ? (
        <EmptyState
          icon="card"
          title="Nothing to pay"
          message="Fees appear here once you apply for a program that charges one."
        />
      ) : null}

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
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => router.push(`/payment/${row.id}`)}
            >
              <Card style={styles.row}>
                <View
                  style={[styles.icon, row.paymentStatus === 'Failed' && styles.iconFailed]}
                >
                  <Ionicons
                    name={row.paymentStatus === 'Failed' ? 'alert-circle-outline' : 'time-outline'}
                    size={18}
                    color={
                      row.paymentStatus === 'Failed' ? colors.danger700 : colors.warning700
                    }
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {row.programTypeName ?? 'Program fee'}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {row.applicationNo} · {shortDate(row.submittedOn)}
                  </Text>
                  {row.paymentStatus === 'Failed' ? (
                    <Text style={styles.rowFailed}>The last attempt did not go through.</Text>
                  ) : null}
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.amount}>{inr(row.feeAmount)}</Text>
                  <Text style={styles.pay}>Pay</Text>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      ) : null}

      {receipts.length > 0 ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Receipts</Text>
          {receipts.map((row) => {
            const paid = row.status === 'Paid';
            return (
              <Pressable
                key={row.orderId}
                accessibilityRole="button"
                onPress={() => router.push(`/payment/status/${row.orderId}`)}
              >
                <Card style={styles.row}>
                  <View style={[styles.icon, paid ? styles.iconPaid : styles.iconMuted]}>
                    <Ionicons
                      name={paid ? 'receipt-outline' : 'close-circle-outline'}
                      size={18}
                      color={paid ? colors.success700 : colors.ink500}
                    />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {row.programTypeName ?? row.applicationNo}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {row.trackingId ?? row.orderId} ·{' '}
                      {shortDate(row.completedOn ?? row.initiatedOn)}
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.amount}>{inr(row.amount)}</Text>
                    <Text style={[styles.state, paid && styles.statePaid]}>{row.status}</Text>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
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
  summaryLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.onBrandMuted,
    letterSpacing: 1,
  },
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
  iconMuted: { backgroundColor: colors.ink100 },

  rowText: { flex: 1, gap: 1 },
  rowTitle: { fontSize: font.base, fontWeight: '600', color: colors.ink900 },
  rowMeta: { fontSize: font.xs, color: colors.ink500 },
  rowFailed: { fontSize: font.xs, color: colors.danger700, marginTop: 2 },

  rowRight: { alignItems: 'flex-end', gap: 2 },
  amount: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  pay: { fontSize: font.xs, fontWeight: '700', color: colors.brand700 },
  state: { fontSize: font.xs, fontWeight: '600', color: colors.ink500 },
  statePaid: { color: colors.success700 },
});
