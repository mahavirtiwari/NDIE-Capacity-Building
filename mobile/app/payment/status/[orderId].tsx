import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../../src/api/client';
import { me } from '../../../src/api/endpoints';
import type { PaymentTransaction } from '../../../src/api/types';
import { Banner, Button, Card, inr, shortDateTime } from '../../../src/components/ui';
import { colors, font, radius, spacing } from '../../../src/theme';

/** How long to keep asking before saying so plainly. */
const GIVE_UP_AFTER_MS = 3 * 60 * 1000;

/**
 * What happened to one payment.
 *
 * The gateway answers to the browser, not to the app, so this has no way of
 * being told: it asks. It asks harder the moment the app comes back to the
 * foreground, which is exactly when the payer has finished at the gateway
 * and switched back.
 */
export default function PaymentStatus() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();

  const [payment, setPayment] = useState<PaymentTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tired, setTired] = useState(false);
  const since = useRef(Date.now());

  const look = useCallback(async () => {
    if (!orderId) return;
    try {
      const next = await me.payment(orderId);
      setPayment(next);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not check the payment.');
    }
  }, [orderId]);

  const settled =
    payment?.status === 'Paid' ||
    payment?.status === 'Failed' ||
    payment?.status === 'Cancelled';

  useEffect(() => {
    void look();
  }, [look]);

  /* While it is still in flight, ask every few seconds, and at once whenever
     the app is brought back — which is the moment the answer usually exists. */
  useEffect(() => {
    if (settled) return;

    const timer = setInterval(() => {
      if (Date.now() - since.current > GIVE_UP_AFTER_MS) {
        setTired(true);
        return;
      }
      void look();
    }, 4000);

    const watch = AppState.addEventListener('change', (state) => {
      if (state === 'active') void look();
    });

    return () => {
      clearInterval(timer);
      watch.remove();
    };
  }, [settled, look]);

  const done = () => router.replace('/payments');

  if (!settled) {
    return (
      <ScrollView contentContainerStyle={styles.centre}>
        <ActivityIndicator size="large" color={colors.brand600} />
        <Text style={styles.waitTitle}>Waiting for the gateway</Text>
        <Text style={styles.waitNote}>
          Finish the payment in your browser, then come back here. Do not pay twice — this
          screen updates on its own.
        </Text>

        {payment ? <Text style={styles.waitAmount}>{inr(payment.amount)}</Text> : null}

        {tired ? (
          <View style={styles.tired}>
            <Banner tone="warning">
              The gateway has not answered yet. If money has left your account it will either
              be confirmed here or reversed by your bank. Do not start a second payment.
            </Banner>
            <Button label="Go to Payments" variant="secondary" onPress={done} />
          </View>
        ) : null}

        {error ? (
          <View style={styles.tired}>
            <Banner tone="danger">{error}</Banner>
          </View>
        ) : null}
      </ScrollView>
    );
  }

  const paid = payment.status === 'Paid';
  const cancelled = payment.status === 'Cancelled';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View
        style={[
          styles.badge,
          paid && styles.badgePaid,
          cancelled && styles.badgeCancelled,
          !paid && !cancelled && styles.badgeFailed,
        ]}
      >
        <Ionicons
          name={paid ? 'checkmark' : cancelled ? 'remove' : 'close'}
          size={34}
          color={colors.white}
        />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>
          {paid ? 'Payment successful' : cancelled ? 'Payment cancelled' : 'Payment failed'}
        </Text>
        <Text style={styles.amount}>{inr(payment.amount)}</Text>
        {!paid ? (
          <Text style={styles.subtitle}>
            {cancelled
              ? 'No money has been taken. The fee can be paid whenever you are ready.'
              : 'No money has been taken. If your account was debited, banks reverse an incomplete payment within a few working days.'}
          </Text>
        ) : null}
      </View>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>{paid ? 'Receipt' : 'What happened'}</Text>

        {!paid && payment.failureReason ? (
          <Row label="Reason" value={payment.failureReason} />
        ) : null}
        <Row label="Application" value={payment.applicationNo} />
        {payment.programTypeName ? <Row label="Program" value={payment.programTypeName} /> : null}
        <Row label="Reference" value={payment.trackingId ?? payment.orderId} />
        {payment.method ? <Row label="Method" value={payment.method} /> : null}
        {payment.bankReference ? <Row label="Bank reference" value={payment.bankReference} /> : null}
        <Row label="Fee" value={inr(payment.feeGross)} />
        {payment.tdsAmount > 0 ? (
          <Row label="TDS deducted" value={`- ${inr(payment.tdsAmount)}`} />
        ) : null}
        <Row
          label={paid ? 'Paid on' : 'Attempted'}
          value={shortDateTime(payment.completedOn ?? payment.initiatedOn)}
        />
      </Card>

      {payment.testMode ? (
        <Banner tone="info">This was a test payment. No real money moved.</Banner>
      ) : null}

      {paid ? null : (
        <Button
          label="Try again"
          onPress={() => router.replace(`/payment/${payment.applicationId}`)}
        />
      )}

      <Button
        label={paid ? 'Go to Payments' : 'Back to Payments'}
        variant={paid ? 'primary' : 'secondary'}
        onPress={done}
      />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  waitTitle: { fontSize: font.lg, fontWeight: '700', color: colors.ink900, marginTop: spacing.md },
  waitNote: { fontSize: font.sm, color: colors.ink600, textAlign: 'center', lineHeight: 19 },
  waitAmount: { fontSize: font.xl, fontWeight: '700', color: colors.brand700 },
  tired: { alignSelf: 'stretch', gap: spacing.md, marginTop: spacing.md },

  content: { padding: spacing.lg, paddingTop: spacing.xxl, gap: spacing.lg },
  badge: {
    alignSelf: 'center',
    width: 62,
    height: 62,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePaid: { backgroundColor: colors.success500 },
  badgeFailed: { backgroundColor: colors.danger500 },
  badgeCancelled: { backgroundColor: colors.ink400 },

  header: { alignItems: 'center', gap: 4 },
  title: { fontSize: font.xl, fontWeight: '700', color: colors.ink900 },
  amount: { fontSize: font.xxl, fontWeight: '700', color: colors.ink900 },
  subtitle: {
    fontSize: font.sm,
    color: colors.ink600,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: spacing.md,
  },

  card: { gap: spacing.sm },
  cardTitle: { fontSize: font.sm, fontWeight: '700', color: colors.ink700 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg },
  rowLabel: { fontSize: font.sm, color: colors.ink500 },
  rowValue: { flex: 1, fontSize: font.sm, fontWeight: '600', color: colors.ink900, textAlign: 'right' },
});
