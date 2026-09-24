import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { CapturedImage } from '../api/endpoints';
import { colors, radius, spacing } from '../theme';

/**
 * Takes or chooses one photograph.
 *
 * The camera is offered first because these are meant to be taken at the venue,
 * on the day; the library is kept as a fallback for a device whose camera is
 * refused or unavailable, not as the primary route.
 *
 * Images are compressed to roughly 0.6 quality on the way out. The evidence is
 * a room, a banner and a group of people — legible at that quality, and small
 * enough to upload from a district town on a weak signal.
 */
export function PhotoPicker({
  label,
  hint,
  value,
  existingUrl,
  onPick,
  disabled,
}: {
  label: string;
  hint?: string;
  value?: CapturedImage | null;
  /** A photo already stored on the server, shown until a new one is taken. */
  existingUrl?: string | null;
  onPick: (image: CapturedImage) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const preview = value?.uri ?? existingUrl ?? null;

  const run = async (source: 'camera' | 'library') => {
    setBusy(true);
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission needed',
          source === 'camera'
            ? 'Allow camera access to take the photo.'
            : 'Allow photo access to choose an image.',
        );
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.6, exif: false })
          : await ImagePicker.launchImageLibraryAsync({
              quality: 0.6,
              mediaTypes: ['images'],
            });

      if (result.canceled || result.assets.length === 0) return;

      const asset = result.assets[0];
      onPick({
        uri: asset.uri,
        mimeType: asset.mimeType ?? 'image/jpeg',
        fileName: asset.fileName ?? `photo-${Date.now()}.jpg`,
      });
    } catch {
      Alert.alert('Could not open the camera', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      {preview ? (
        <Image source={{ uri: preview }} style={styles.preview} resizeMode="cover" />
      ) : (
        <View style={[styles.preview, styles.empty]}>
          <Text style={styles.emptyText}>No photo yet</Text>
        </View>
      )}

      <View style={styles.row}>
        <Pressable
          style={[styles.action, (disabled || busy) && styles.actionOff]}
          disabled={disabled || busy}
          onPress={() => run('camera')}
        >
          <Text style={styles.actionText}>{preview ? 'Retake' : 'Take photo'}</Text>
        </Pressable>
        <Pressable
          style={[styles.action, styles.actionGhost, (disabled || busy) && styles.actionOff]}
          disabled={disabled || busy}
          onPress={() => run('library')}
        >
          <Text style={[styles.actionText, styles.actionGhostText]}>Choose</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink800 },
  hint: { fontSize: 12, color: colors.ink500 },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.ink100,
  },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.ink500, fontSize: 13 },
  row: { flexDirection: 'row', gap: spacing.sm },
  action: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.brand600,
    alignItems: 'center',
  },
  actionGhost: { backgroundColor: colors.ink100 },
  actionOff: { opacity: 0.5 },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  actionGhostText: { color: colors.ink700 },
});
