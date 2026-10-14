import { File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { Image, Platform, View, type ImageStyle, type StyleProp } from 'react-native';
import { downloadBytes } from '../api/client';

/**
 * Shows a photograph the server keeps behind the sign-in.
 *
 * These used to be handed to <Image> as a plain url. The route needs a
 * bearer token and the image loader sends none, so every stored
 * photograph on this app drew an empty box: the attendance sheets, the
 * participants' faces, the venue inside and out. Nothing said so, which
 * is why it stood - a coordinator who had just taken the picture knew it
 * was there, and read the blank frame as the app being slow.
 *
 * Giving the loader the token is not the answer either: it caches by url
 * and drops custom headers on the way back, so that works once and then
 * stops. The bytes are fetched like any other call instead, written to
 * the cache, and the picture is shown from the file.
 */
async function toLocalUri(path: string): Promise<string> {
  const file = await downloadBytes(path);

  if (Platform.OS === 'web') {
    return URL.createObjectURL(new Blob([file.bytes], { type: file.contentType }));
  }

  /* Named after the path it came from, so the same photograph fetched
     twice lands on the same file rather than filling the cache. */
  const name = `stored-${path.replace(/[^A-Za-z0-9]+/g, '-')}.jpg`;
  const target = new File(Paths.cache, name);
  if (target.exists) target.delete();
  target.create();
  target.write(new Uint8Array(file.bytes));

  return target.uri;
}

function release(uri: string | null): void {
  if (Platform.OS === 'web' && uri?.startsWith('blob:')) URL.revokeObjectURL(uri);
}

/**
 * A stored photograph as something the image loader can read, or null
 * while it is on its way or if it could not be had.
 *
 * `path` is the server-relative path the record carries, not a url: the
 * point of this is that the url on its own is not enough.
 */
export function useStoredImage(path: string | null | undefined): string | null {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUri(null);
      return;
    }

    let cancelled = false;
    let made: string | null = null;

    void toLocalUri(path)
      .then((local) => {
        if (cancelled) {
          release(local);
          return;
        }
        made = local;
        setUri(local);
      })
      .catch(() => {
        /* Offline, or the photograph is gone. The screen shows the empty
           state it would show without one, which is the truth. */
      });

    return () => {
      cancelled = true;
      release(made);
    };
  }, [path]);

  return uri;
}

/**
 * One stored photograph, drawn once it is here.
 *
 * A component rather than a bare hook, because these are listed - a
 * sheet per upload, a face per participant - and a hook cannot be called
 * from inside a map.
 */
export function StoredImage({
  path,
  style,
  placeholder,
}: {
  path: string | null | undefined;
  style?: StyleProp<ImageStyle>;
  /** Drawn while the bytes are on their way, and if they never come. */
  placeholder?: React.ReactNode;
}) {
  const uri = useStoredImage(path);

  if (!uri) return <View style={style}>{placeholder}</View>;

  return <Image source={{ uri }} style={style} resizeMode="cover" />;
}
