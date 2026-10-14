import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import type { DownloadedFile } from '../api/client';

/**
 * Puts a downloaded picture somewhere the image loader can read it.
 *
 * The loader will not carry a bearer token - it caches by url and drops
 * custom headers on the way back, which is why an authenticated
 * thumbnail came out as an empty box. So the bytes are fetched like any
 * other call and written to the cache, and the picture is shown from the
 * file. The web build has no file system and takes a blob url instead,
 * which is the same idea by the means that platform has.
 *
 * The name is the caller's and is reused, so a picture replaced on the
 * server replaces its copy here rather than piling up beside it.
 */
export async function cacheImage(name: string, file: DownloadedFile): Promise<string> {
  if (Platform.OS === 'web') {
    return URL.createObjectURL(new Blob([file.bytes], { type: file.contentType }));
  }

  const target = new File(Paths.cache, name);
  if (target.exists) target.delete();
  target.create();
  target.write(new Uint8Array(file.bytes));

  return target.uri;
}

/** Lets go of a blob url the web build made. A file on disk needs nothing. */
export function releaseImage(uri: string | null | undefined): void {
  if (Platform.OS === 'web' && uri?.startsWith('blob:')) URL.revokeObjectURL(uri);
}
