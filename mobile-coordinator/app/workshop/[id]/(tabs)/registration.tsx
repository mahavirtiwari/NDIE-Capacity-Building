import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Banner, Loading } from '../../../../src/components/ui';
import { MenuRow } from '../../../../src/components/MenuRow';
import { colors, spacing } from '../../../../src/theme';
import { useWorkshop } from '../../../../src/workshop/WorkshopContext';
import { useState } from 'react';

/** Tab 1 of the manual: register the venue and the trainers. */
export default function Registration() {
  const router = useRouter();
  const { id, detail, loading, failure, refresh, locked } = useWorkshop();
  const [refreshing, setRefreshing] = useState(false);

  if (loading && !detail) return <Loading label="Loading workshop…" />;

  const progress = detail?.progress;
  const venue = detail?.venue2;

  const venueStatus = !progress?.venueRegistered
    ? 'Not registered yet'
    : [
        venue?.name,
        progress.venueGeoTagged ? 'geo-tagged' : 'not geo-tagged',
        `${[progress.venueExteriorPhoto, progress.venueInteriorPhoto].filter(Boolean).length}/2 photos`,
      ]
        .filter(Boolean)
        .join(' · ');

  const venueDone =
    !!progress?.venueRegistered &&
    progress.venueGeoTagged &&
    progress.venueExteriorPhoto &&
    progress.venueInteriorPhoto;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await refresh();
            setRefreshing(false);
          }}
        />
      }
    >
      <View style={styles.head}>
        <Text style={styles.name}>{detail?.programmeName}</Text>
        <Text style={styles.code}>{detail?.programmeId}</Text>
      </View>

      {failure ? <Banner tone="danger">{failure}</Banner> : null}

      {locked ? (
        <Banner tone="info">
          This workshop was finally submitted. Everything below is read only.
        </Banner>
      ) : null}

      <MenuRow
        icon="location-outline"
        title="Register venue"
        status={venueStatus}
        done={venueDone}
        onPress={() => router.push(`/workshop/${id}/venue`)}
      />

      <MenuRow
        icon="person-add-outline"
        title="Register trainer"
        status={
          progress?.trainerCount
            ? `${progress.trainerCount} registered`
            : 'No trainer registered yet'
        }
        done={(progress?.trainerCount ?? 0) > 0}
        onPress={() => router.push(`/workshop/${id}/trainer`)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  head: { gap: 2, marginBottom: spacing.xs },
  name: { fontSize: 17, fontWeight: '700', color: colors.ink900 },
  code: { fontSize: 12, fontWeight: '600', color: colors.brand700 },
});
