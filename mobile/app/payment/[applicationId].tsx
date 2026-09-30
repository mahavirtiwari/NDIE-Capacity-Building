import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../src/api/client';
import { me } from '../../src/api/endpoints';
import type { PaymentSummary } from '../../src/api/types';
import { useResource } from '../../src/api/useResource';
import { Banner, Button, Card, Loading, inr } from '../../src/components/ui';
import { colors, font, radius, spacing } from '../../src/theme';

/**
 * What the fee comes to, before anybody is sent anywhere.
 *
 * The breakdown is shown because the payer should be able to check the
 * arithmetic — particularly the TDS they themselves declared, which is
 * deducted on the value of the service and not on the tax charged on it.
 */
export default function PaymentScreen() {
  const router = useRouter();
  const { applicationId } = useLocalSearchParams<{ applicationId?: string }>();
  const id = Number(applicationId);

  const summary = useResource<PaymentSummary>(() => me.paymentSummary(id), [id]);
  const [starting, setStarting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const pay = async () => {
    setStarting(true);
    setFailure(null);
    try {
      const started = await me.startPayment(id);

      /* Out to the phone's own browser rather than a view inside the app:
         the payer gets a real address bar and a padlock to check, and
         nothing of this app is anywhere near the page they type a card on. */
      const opened = await Linking.canOpenURL(started.redirectUrl);
      if (!opened) throw new Error('no browser');
      await Linking.openURL(started.redirectUrl);

      router.replace(`/payment/status/${started.orderId}`);
    } catch (caught) {
      setFailure(
        caught instanceof ApiError
          ? caught.message
          : 'Could not open the payment page. Check your connection and try again.',
      );
    } finally {
      setStarting(false);
    }
  };

  if (summary.loading && !summary.data) return <Loading />;

  const data = summary.data;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={summary.refreshing} onRefresh={summary.refresh} />
      }
    >
      {summary.error ? <Banner tone="danger">{summary.error}</Banner> : null}

      {data ? (
        <>
          <View style={styles.head}>
            <Text style={styles.programme}>{data.programTypeName ?? 'Program fee'}</Text>
            <Text style={styles.applicationNo}>{data.applicationNo}</Text>
          </View>

          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Summary</Text>

            {data.lines.map((line, index) => (
              <View
                key={`${line.label}-${index}`}
                style={[styles.line, line.isTotal && styles.lineTotal]}
              >
                <Text style={[styles.lineLabel, line.isTotal && styles.lineLabelTotal]}>
                  {line.label}
                </Text>
                <Text
                  style={[
                    styles.lineAmount,
                    line.isDeduction && styles.lineDeduction,
                    line.isTotal && styles.lineAmountTotal,
                  ]}
                >
                  {line.isDeduction ? '- ' : ''}
                  {inr(line.amount)}
                </Text>
              </View>
            ))}
          </Card>

          {data.fromCurrentFee ? (
            <Banner tone="warning">
              This application was made before the fee breakdown was recorded with it, so the
              figures above come from the fee in force today.
            </Banner>
          ) : null}

          {data.testMode && data.canPay ? (
            <Banner tone="info">
              The gateway is in test mode. No real money will move.
            </Banner>
          ) : null}

          {failure ? <Banner tone="danger">{failure}</Banner> : null}

          {data.canPay ? (
            <>
              <Button
                label={`Proceed to pay ${inr(data.payable)}`}
                onPress={pay}
                loading={starting}
              />
              <View style={styles.assurance}>
                <Ionicons name="lock-closed-outline" size={14} color={colors.ink500} />
                <Text style={styles.assuranceText}>
                  You will be taken to {data.gateway ?? 'the payment gateway'} in your browser.
                  Card and UPI details are typed there, never in this app.
                </Text>
              </View>
            </>
          ) : (
            <Banner tone={data.paymentStatus === 'Paid' ? 'success' : 'warning'}>
              {data.blocked ?? 'This fee cannot be paid here.'}
            </Banner>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },

  head: { gap: 2 },
  programme: { fontSize: font.lg, fontWeight: '700', color: colors.ink900 },
  applicationNo: { fontSize: font.sm, color: colors.ink500 },

  card: { gap: spacing.sm },
  cardTitle: { fontSize: font.sm, fontWeight: '700', color: colors.ink700 },

  line: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  lineTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: 2,
  },
  lineLabel: { flex: 1, fontSize: font.sm, color: colors.ink600 },
  lineLabelTotal: { fontSize: font.base, fontWeight: '700', color: colors.ink900 },
  lineAmount: { fontSize: font.sm, fontWeight: '600', color: colors.ink900 },
  lineDeduction: { color: colors.success700 },
  lineAmountTotal: { fontSize: font.lg, fontWeight: '700', color: colors.brand700 },

  assurance: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  assuranceText: { flex: 1, fontSize: font.xs, color: colors.ink500, lineHeight: 16 },
});
