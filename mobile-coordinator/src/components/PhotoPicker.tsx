import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { CapturedImage } from '../api/endpoints';
import { useStoredImage } from '../files/storedImage';
import { colors, radius, spacing } from '../theme';

/**
 * Takes one photograph, with this handset's camera.
 *
 * The camera and nothing else. There used to be a Choose button beside
 * it, offered as a fallback for a device whose camera was refused —
 * but what this app records is evidence that a workshop happened in a
 * particular hall on a particular day, and a picture from the gallery
 * is a picture of something, somewhere, at some time. A photograph
 * that could have come from anywhere proves nothing, and an option
 * that is there "only as a fallback" is an option that gets used.
 *
 * What is taken can always be thrown away and taken again: the preview
 * carries a delete, because the fix for a bad photograph is another
 * photograph and nobody should have to submit the first one.
 *
 * Images are compressed to roughly 0.6 quality on the way out. The
 * evidence is a room, a banner and a group of people — legible at that
 * quality, and small enough to upload from a district town on a weak
 * signal.
 */
export function PhotoPicker({
  label,
  hint,
  required,
  value,
  existingPath,
  onPick,
  onClear,
  disabled,
}: {
  label: string;
  hint?: string;
  /** Marked like a required field, because that is what it is. */
  required?: boolean;
  value?: CapturedImage | null;
  /**
   * A photo already stored on the server, shown until a new one is taken.
   *
   * The server-relative path, not a url: the route needs a bearer token
   * and the image loader sends none, so it is fetched here rather than
   * pointed at. It used to be pointed at, and drew an empty frame.
   */
  existingPath?: string | null;
  onPick: (image: CapturedImage) => void;
  /**
   * Discards what has just been taken, where the screen can accept that.
   *
   * Only ever clears this handset's unsent capture. A photograph the
   * server already holds is replaced by taking another, not deleted
   * from here - the record of a workshop is not something a phone
   * should be able to empty.
   */
  onClear?: () => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  /* The one on the server, until the coordinator takes a new one. */
  const stored = useStoredImage(value ? null : existingPath);
  const preview = value?.uri ?? stored;

  const capture = async () => {
    setBusy(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera needed', 'Allow camera access to take the photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({ quality: 0.6, exif: false });
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

  const discard = () => {
    Alert.alert('Delete this photo?', 'You can take another one straight away.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onClear },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      {preview ? (
        <View>
          <Image source={{ uri: preview }} style={styles.preview} resizeMode="cover" />
          {/* Only what this phone is still holding can be thrown away. */}
          {value && onClear && !disabled ? (
            <Pressable style={styles.delete} onPress={discard} hitSlop={8}>
              <Ionicons name="trash-outline" size={16} color={colors.white} />
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={[styles.preview, styles.empty]}>
          <Ionicons name="camera-outline" size={22} color={colors.ink400} />
          <Text style={styles.emptyText}>No photo yet</Text>
        </View>
      )}

      <Pressable
        style={[styles.action, (disabled || busy) && styles.actionOff]}
        disabled={disabled || busy}
        onPress={() => void capture()}
      >
        <Ionicons name="camera" size={16} color={colors.white} />
        <Text style={styles.actionText}>{preview ? 'Retake photo' : 'Take photo'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink800 },
  required: { color: colors.danger700 },
  hint: { fontSize: 12, color: colors.ink500 },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.ink100,
  },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  emptyText: { color: colors.ink500, fontSize: 13 },

  delete: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: 'rgb(0 0 0 / 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.brand600,
  },
  actionOff: { opacity: 0.5 },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
