import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import type { DownloadedFile } from '../api/client';

/**
 * Hands a downloaded document to the device, so the applicant can keep it,
 * print it or send it on.
 *
 * Written to the cache rather than to documents: the copy of record is the
 * server's, this is the one being passed to whatever the applicant picks
 * from the share sheet, and nothing is gained by it outliving that.
 */
export async function saveAndShare(file: DownloadedFile, dialogTitle: string): Promise<void> {
  /* The web build has no file system and no share sheet; a browser download
     is the same gesture by other means, and it keeps this screen testable
     outside a device. */
  if (Platform.OS === 'web') {
    const blob = new Blob([file.bytes], { type: file.contentType });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.fileName;
      anchor.click();
    } finally {
      URL.revokeObjectURL(url);
    }
    return;
  }

  const target = new File(Paths.cache, file.fileName);
  if (target.exists) target.delete();
  target.create();
  target.write(new Uint8Array(file.bytes));

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(`Saved to ${target.uri}, but this device cannot open it from here.`);
  }

  await Sharing.shareAsync(target.uri, {
    mimeType: file.contentType,
    dialogTitle,
    /* iOS wants the uniform type; a PDF is the only thing sent this way. */
    UTI: file.contentType === 'application/pdf' ? 'com.adobe.pdf' : undefined,
  });
}
