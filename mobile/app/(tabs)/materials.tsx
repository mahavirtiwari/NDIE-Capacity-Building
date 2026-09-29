import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../src/api/client';
import { me } from '../../src/api/endpoints';
import type { TrainingMaterial } from '../../src/api/types';
import { useResource } from '../../src/api/useResource';
import { Banner, Card, Chip, EmptyState, Loading, shortDate } from '../../src/components/ui';
import { colors, font, radius, spacing } from '../../src/theme';

/**
 * Role-based training material. The API only returns what this applicant's
 * programmes entitle them to, so no filtering by permission is needed here.
 */
export default function Materials() {
  const materials = useResource<TrainingMaterial[]>(() => me.materials(), []);
  const [kind, setKind] = useState<string>('All');

  const kinds = useMemo(() => {
    const unique = new Set((materials.data ?? []).map((item) => item.kind));
    return ['All', ...[...unique].sort()];
  }, [materials.data]);

  const list = useMemo(() => {
    const all = materials.data ?? [];
    return kind === 'All' ? all : all.filter((item) => item.kind === kind);
  }, [materials.data, kind]);

  const open = async (material: TrainingMaterial) => {
    if (!material.url) {
      Alert.alert(
        material.title,
        'Nothing has been attached to this item yet. Ask your coordinator.',
      );
      return;
    }

    /* Two kinds of address. A published link is somewhere else on the web
       and is followed as typed; anything uploaded is fetched through a
       one-shot ticket, because the viewer that opens it cannot carry this
       applicant's token. */
    let target = material.url;

    if (!material.url.includes('://')) {
      try {
        target = (await me.materialTicket(material.id)).url;
      } catch (caught) {
        Alert.alert(
          'Cannot open',
          caught instanceof ApiError ? caught.message : 'That file could not be opened.',
        );
        return;
      }
    }

    const supported = await Linking.canOpenURL(target);
    if (!supported) {
      Alert.alert('Cannot open', 'No app on this device can open that.');
      return;
    }
    await Linking.openURL(target);
  };

  if (materials.loading) return <Loading label="Loading material…" />;

  return (
    <FlatList
      data={list}
      keyExtractor={(material) => String(material.id)}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={materials.refreshing} onRefresh={materials.refresh} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          {materials.error ? <Banner tone="danger">{materials.error}</Banner> : null}
          {kinds.length > 2 ? (
            <View style={styles.filters}>
              {kinds.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => setKind(name)}
                  style={[styles.filter, kind === name && styles.filterActive]}
                >
                  <Text style={[styles.filterLabel, kind === name && styles.filterLabelActive]}>
                    {name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon="book-outline"
          title="No material yet"
          message="Reading material and videos appear here once your programme publishes them."
        />
      }
      renderItem={({ item }) => <MaterialCard material={item} onOpen={() => open(item)} />}
    />
  );
}

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Video: 'play-circle',
  Document: 'document-text',
  Presentation: 'easel',
  Link: 'link',
};

function MaterialCard({
  material,
  onOpen,
}: {
  material: TrainingMaterial;
  onOpen: () => void;
}) {
  return (
    <Pressable onPress={onOpen} accessibilityRole="button">
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.icon}>
            <Ionicons
              name={ICONS[material.kind] ?? 'document-outline'}
              size={20}
              color={colors.brand700}
            />
          </View>

          <View style={styles.body}>
            <Text style={styles.title}>{material.title}</Text>
            {material.description ? (
              <Text style={styles.description} numberOfLines={2}>
                {material.description}
              </Text>
            ) : null}

            <View style={styles.chips}>
              <Chip>{material.kind}</Chip>
              {material.programTypeName ? <Chip>{material.programTypeName}</Chip> : null}
              {material.durationMinutes ? <Chip>{`${material.durationMinutes} min`}</Chip> : null}
              {material.fileSizeKb ? (
                <Chip>{`${Math.round(material.fileSizeKb / 1024) || 1} MB`}</Chip>
              ) : null}
              <Chip>{material.language}</Chip>
            </View>

            <Text style={styles.foot}>
              {`v${material.version} · published ${shortDate(material.publishedOn)}`}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={17} color={colors.ink500} />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { gap: spacing.sm },

  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  filterActive: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  filterLabel: { fontSize: font.xs, fontWeight: '600', color: colors.ink600 },
  filterLabelActive: { color: colors.white },

  card: { paddingVertical: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 4 },
  title: { fontSize: font.base, fontWeight: '700', color: colors.ink900, lineHeight: 20 },
  description: { fontSize: font.xs, color: colors.ink600, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 },
  foot: { fontSize: font.xs, color: colors.ink500, marginTop: 2 },
});
