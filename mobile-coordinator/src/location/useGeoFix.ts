import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

export interface GeoFix {
  latitude: number;
  longitude: number;
  accuracyMetres?: number | null;
  takenAt: Date;
}

type Status = 'idle' | 'asking' | 'locating' | 'ready' | 'denied' | 'failed';

/**
 * A GPS reading, taken on demand.
 *
 * Deliberately not a live watch. The venue is geo-tagged once, standing at the
 * door, and a subscription that kept updating would let the recorded point
 * drift to wherever the phone happened to be when the form was saved — which is
 * the one thing a geo-tag must not do.
 *
 * Permission is requested at the moment it is needed rather than at start-up,
 * so the prompt arrives with the reason for it on screen.
 */
export function useGeoFix() {
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [problem, setProblem] = useState<string | null>(null);

  const capture = useCallback(async (): Promise<GeoFix | null> => {
    setProblem(null);
    setStatus('asking');

    try {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (permission !== 'granted') {
        setStatus('denied');
        setProblem('Location permission is needed to geo-tag the venue. Enable it in Settings.');
        return null;
      }

      const services = await Location.hasServicesEnabledAsync();
      if (!services) {
        setStatus('failed');
        setProblem('Location is switched off on this device. Turn it on and try again.');
        return null;
      }

      setStatus('locating');
      const reading = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const next: GeoFix = {
        latitude: reading.coords.latitude,
        longitude: reading.coords.longitude,
        accuracyMetres: reading.coords.accuracy,
        takenAt: new Date(reading.timestamp),
      };

      setFix(next);
      setStatus('ready');
      return next;
    } catch {
      setStatus('failed');
      setProblem('Could not get a location fix. Move into the open and try again.');
      return null;
    }
  }, []);

  return { fix, status, problem, capture, clear: () => setFix(null) };
}
