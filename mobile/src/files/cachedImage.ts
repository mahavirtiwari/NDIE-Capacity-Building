import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { fileRequest } from '../api/client';

/**
 * A photograph the server keeps behind the sign-in, as something the
 * image loader can read.
 *
 * The loader cannot fetch these itself: the route needs a bearer token,
 * and handing the loader custom headers works once and then stops,
 * because it caches by url and drops them.
 *
 * On a handset the bytes are downloaded straight to a file in the cache
 * with the header on the request. They used to come back through
 * fetch().arrayBuffer() - which React Native cannot do, there being no
 * readAsArrayBuffer behind its FileReader - so the call rejected on a
 * real phone and every stored picture fell back to its empty state. The
 * web build, where this was looked at, does support it, which is how
 * that survived.
 *
 * `name` is what the file is called in the cache: the same picture asked
 * for twice lands on the same file rather than filling the disk.
 */
export async function cacheRemoteImage(name: string, path: string): Promise<string> {
  const { url, headers } = fileRequest(path);

  if (Platform.OS === 'web') {
    const answer = await fetch(url, { headers });
    if (!answer.ok) throw new Error(`That picture could not be fetched (${answer.status}).`);

    const type = answer.headers.get('Content-Type') ?? 'image/jpeg';
    return URL.createObjectURL(new Blob([await answer.arrayBuffer()], { type }));
  }

  const target = new File(Paths.cache, name);
  await File.downloadFileAsync(url, target, { headers, idempotent: true });

  return target.uri;
}

/** Lets go of a blob url the web build made. A file on disk needs nothing. */
export function releaseImage(uri: string | null | undefined): void {
  if (Platform.OS === 'web' && uri?.startsWith('blob:')) URL.revokeObjectURL(uri);
}
