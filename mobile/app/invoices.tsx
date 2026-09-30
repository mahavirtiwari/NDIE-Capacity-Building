import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../src/api/client';
import { me } from '../src/api/endpoints';
import type { PaymentTransaction } from '../src/api/types';
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
import { colors, font, spacing } from '../src/theme';

/**
 * The applicant's invoices.
 *
 * The invoice itself is raised in the ERP and sent to them from there —
 * nothing here numbers one or decides what it says. This is where they can
 * fetch their copy without going looking through their e-mail, one per fee
 * they have paid.
 */
export default function Invoices() {
  const payments = useResource<PaymentTransaction[]>(() => me.payments(), []);

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      payments.refresh();
    }, [payments.refresh]),
  );

  /** Only money that actually arrived: nothing else is invoiced. */
  const paid = useMemo(
    () => (payments.data ?? []).filter((row) => row.status === 'Paid'),
    [payments.data],
  );

  /* Whether invoicing is switched on at all is the same answer for every
     row, so it is read off the first one rather than asked per card. */
  const offered = paid.some((row) => row.invoiceOffered);

  /** Which order is being fetched, so only its own button shows the wait. */
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetch = async (row: PaymentTransaction) => {
    setBusy(row.orderId);
    setError(null);
    try {
      const file = await me.invoice(row.orderId);
      await saveAndShare(file, 'Invoice');
    } catch (caught) {
      setError(
        caught instanceof ApiError || caught instanceof Error
          ? caught.message
          : 'The invoice could not be fetched.',
      );
    } finally {
      setBusy(null);
    }
  };

  if (payments.loading) return <Loading label="Loading your invoices…" />;

  if (paid.length === 0) {
    return (
      <EmptyState
        icon="document-attach-outline"
        title="No invoices yet"
        message="An invoice appears here once a fee has been paid."
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={payments.refreshing} onRefresh={payments.refresh} />
      }
    >
      {!offered ? (
        <Banner tone="info">
          Invoicing has not been switched on yet. Your payments are listed below, and their
          invoices will appear here once it is.
        </Banner>
      ) : null}

      {error ? <Banner tone="danger">{error}</Banner> : null}

      {paid.map((row) => (
        <Card key={row.orderId} style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title} numberOfLines={2}>
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
              onPress={() => fetch(row)}
            />
          ) : null}
        </Card>
      ))}

      <Text style={styles.note}>
        Invoices are raised by the accounts system and emailed to you. This is a copy of the
        same document.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  card: { gap: spacing.sm, backgroundColor: colors.brand50, borderColor: colors.brand100 },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand100,
    paddingBottom: spacing.sm,
  },
  title: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  amount: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },

  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lineText: { flex: 1, fontSize: font.sm, color: colors.ink600 },

  note: { fontSize: font.xs, color: colors.ink500, lineHeight: 17, textAlign: 'center' },
});
