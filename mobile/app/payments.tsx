import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../src/api/client';
import { me } from '../src/api/endpoints';
import type { Application, PaymentTransaction } from '../src/api/types';
import { useResource } from '../src/api/useResource';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Loading,
  inr,
  shortDate,
} from '../src/components/ui';
import { saveAndShare } from '../src/files/saveAndShare';
import { colors, font, radius, spacing } from '../src/theme';

type Tab = 'payments' | 'invoices';

/**
 * Money, in one screen.
 *
 * Fees owed, fees paid and the invoice for each were three places built on
 * the same two lists, and an applicant looking for "what did I pay and
 * where is the bill" had to find two of them. They are one screen with two
 * tabs now, over a single fetch.
 */
export default function Payments() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('payments');

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

  /** Only money that actually arrived: nothing else is invoiced. */
  const paid = useMemo(() => receipts.filter((row) => row.status === 'Paid'), [receipts]);

  /* Whether invoicing is switched on at all is the same answer for every
     row, so it is read off the rows rather than asked per card. */
  const invoicingOn = paid.some((row) => row.invoiceOffered);

  /** Which order is being fetched, so only its own button shows the wait. */
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const fetchInvoice = async (row: PaymentTransaction) => {
    setBusy(row.orderId);
    setFailure(null);
    try {
      const file = await me.invoice(row.orderId);
      await saveAndShare(file, 'Invoice');
    } catch (caught) {
      setFailure(
        caught instanceof ApiError || caught instanceof Error
          ? caught.message
          : 'The invoice could not be fetched.',
      );
    } finally {
      setBusy(null);
    }
  };

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
      <Stack.Screen options={{ title: 'Payments & invoices' }} />

      <View style={styles.tabs}>
        <TabButton
          label="Payments"
          active={tab === 'payments'}
          onPress={() => setTab('payments')}
        />
        <TabButton
          label={`Invoices${paid.length ? ` (${paid.length})` : ''}`}
          active={tab === 'invoices'}
          onPress={() => setTab('invoices')}
        />
      </View>

      {applications.error ? <Banner tone="danger">{applications.error}</Banner> : null}
      {failure ? <Banner tone="danger">{failure}</Banner> : null}

      {tab === 'payments' ? (
        <>
          {/* Only when the load succeeded. Showing "nothing to pay" beneath
              an error banner told the reader two different things at once. */}
          {!applications.error && due.length === 0 && receipts.length === 0 ? (
            <EmptyState
              icon="card"
              title="Nothing to pay"
              message="Fees appear here once you register for a program that charges one."
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
                    <View style={[styles.icon, row.paymentStatus === 'Failed' && styles.iconFailed]}>
                      <Ionicons
                        name={
                          row.paymentStatus === 'Failed' ? 'alert-circle-outline' : 'time-outline'
                        }
                        size={18}
                        color={row.paymentStatus === 'Failed' ? colors.danger700 : colors.warning700}
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
                const settled = row.status === 'Paid';
                return (
                  <Pressable
                    key={row.orderId}
                    accessibilityRole="button"
                    onPress={() => router.push(`/payment/status/${row.orderId}`)}
                  >
                    <Card style={styles.row}>
                      <View style={[styles.icon, settled ? styles.iconPaid : styles.iconMuted]}>
                        <Ionicons
                          name={settled ? 'receipt-outline' : 'close-circle-outline'}
                          size={18}
                          color={settled ? colors.success700 : colors.ink500}
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
                        <Text style={[styles.state, settled && styles.statePaid]}>{row.status}</Text>
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </>
      ) : (
        <>
          {paid.length === 0 ? (
            <EmptyState
              icon="document-attach-outline"
              title="No invoices yet"
              message="An invoice appears here once a fee has been paid."
            />
          ) : null}

          {paid.length > 0 && !invoicingOn ? (
            <Banner tone="info">
              Invoicing has not been switched on yet. Your payments are listed below, and their
              invoices will appear here once it is.
            </Banner>
          ) : null}

          {paid.map((row) => (
            <Card key={row.orderId} style={styles.invoice}>
              <View style={styles.invoiceHead}>
                <Text style={styles.invoiceTitle} numberOfLines={2}>
                  {row.programTypeName ?? row.applicationNo}
                </Text>
                <Text style={styles.amount}>{inr(row.amount)}</Text>
              </View>

              <View style={styles.line}>
                <Ionicons name="calendar-outline" size={14} color={colors.ink500} />
                <Text style={styles.lineText}>{shortDate(row.completedOn ?? row.initiatedOn)}</Text>
              </View>

              <View style={styles.line}>
                <Ionicons name="pricetag-outline" size={14} color={colors.ink500} />
                <Text style={styles.lineText} numberOfLines={1}>
                  {row.applicationNo}
                  {row.trackingId ? ` · ${row.trackingId}` : ''}
                </Text>
              </View>

              {row.invoiceOffered ? (
                <Button
                  label={busy === row.orderId ? 'Fetching…' : 'Download invoice'}
                  icon="download-outline"
                  loading={busy === row.orderId}
                  onPress={() => fetchInvoice(row)}
                />
              ) : null}
            </Card>
          ))}

          {paid.length > 0 ? (
            <Text style={styles.note}>
              Invoices are raised by the accounts system and emailed to you. This is a copy of
              the same document.
            </Text>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.ink100,
    borderRadius: radius.md,
    padding: 3,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.white },
  tabLabel: { fontSize: font.sm, fontWeight: '600', color: colors.ink500 },
  tabLabelActive: { color: colors.brand700 },

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

  invoice: { gap: spacing.sm, backgroundColor: colors.brand50, borderColor: colors.brand100 },
  invoiceHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand100,
    paddingBottom: spacing.sm,
  },
  invoiceTitle: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.ink900 },

  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lineText: { flex: 1, fontSize: font.sm, color: colors.ink600 },

  note: { fontSize: font.xs, color: colors.ink500, lineHeight: 17, textAlign: 'center' },
});
