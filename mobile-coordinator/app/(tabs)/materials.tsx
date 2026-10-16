import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError } from '../../src/api/client';
import { materials as materialsApi } from '../../src/api/endpoints';
import type { TrainingMaterial } from '../../src/api/types';
import { Banner, EmptyState, Loading, shortDate } from '../../src/components/ui';
import { colors, font, radius, spacing } from '../../src/theme';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Document: 'document-text-outline',
  Video: 'videocam-outline',
  Presentation: 'easel-outline',
  Link: 'link-outline',
};

/**
 * The material published to this coordinator's role.
 *
 * The server decides what that is - the call returns only what the
 * caller's own role may open - so nothing is filtered by permission here.
 */
export default function Materials() {
  const [rows, setRows] = useState<TrainingMaterial[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [kind, setKind] = useState('All');

  const load = useCallback(async () => {
    setFailure(null);
    try {
      setRows(await materialsApi.mine());
    } catch (caught) {
      setFailure(
        caught instanceof ApiError ? caught.message : 'Could not load the training material.',
      );
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kinds = useMemo(() => {
    const unique = new Set((rows ?? []).map((item) => item.kind));
    return ['All', ...[...unique].sort()];
  }, [rows]);

  const shown = useMemo(
    () => (rows ?? []).filter((item) => kind === 'All' || item.kind === kind),
    [rows, kind],
  );

  /**
   * Opens one item.
   *
   * Two kinds of address. A published link is somewhere else on the web
   * and is followed as typed; anything uploaded is fetched through a
   * one-shot ticket, because the viewer that opens it cannot carry this
   * coordinator's token.
   */
  const open = async (material: TrainingMaterial) => {
    if (!material.url) {
      Alert.alert(material.title, 'Nothing has been attached to this item yet.');
      return;
    }

    let target = material.url;
    if (!material.url.includes('://')) {
      try {
        target = (await materialsApi.ticket(material.id)).url;
      } catch (caught) {
        Alert.alert(
          'Cannot open',
          caught instanceof ApiError ? caught.message : 'That file could not be opened.',
        );
        return;
      }
    }

    if (!(await Linking.canOpenURL(target))) {
      Alert.alert('Cannot open', 'No app on this device can open that.');
      return;
    }
    await Linking.openURL(target);
  };

  if (rows === null) return <Loading label="Loading training material…" />;

  return (
    <FlatList
      style={styles.flex}
      data={shown}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
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
      ListHeaderComponent={
        <View style={styles.header}>
          {failure ? <Banner tone="danger">{failure}</Banner> : null}

          {kinds.length > 2 ? (
            <View style={styles.chips}>
              {kinds.map((one) => (
                <Pressable
                  key={one}
                  onPress={() => setKind(one)}
                  style={[styles.chip, one === kind && styles.chipOn]}
                >
                  <Text style={[styles.chipText, one === kind && styles.chipTextOn]}>{one}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title="Nothing published yet"
          message="Handbooks, slides and videos published for coordinators appear here."
        />
      }
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => void open(item)}>
          <View style={styles.rowIcon}>
            <Ionicons
              name={ICONS[item.kind] ?? 'document-outline'}
              size={18}
              color={colors.brand700}
            />
          </View>

          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            {item.description ? (
              <Text style={styles.rowDesc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            <Text style={styles.rowMeta}>
              {[
                item.programTypeName,
                item.language,
                item.fileSizeKb ? `${Math.round(item.fileSizeKb / 1024)} MB` : null,
                item.durationMinutes ? `${item.durationMinutes} min` : null,
                shortDate(item.publishedOn),
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>

          <Ionicons name="open-outline" size={16} color={colors.ink400} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  header: { gap: spacing.md },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipOn: { backgroundColor: colors.brand50, borderColor: colors.brand100 },
  chipText: { fontSize: font.sm, fontWeight: '600', color: colors.ink600 },
  chipTextOn: { color: colors.brand700 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: font.base, fontWeight: '700', color: colors.ink900, lineHeight: 20 },
  rowDesc: { fontSize: font.sm, color: colors.ink600, lineHeight: 18 },
  rowMeta: { fontSize: font.xs, color: colors.ink500 },
});
