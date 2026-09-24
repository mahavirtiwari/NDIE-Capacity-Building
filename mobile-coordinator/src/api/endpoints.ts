import { API_BASE_URL, api, readAuthToken } from './client';
import type {
  LoginResponse,
  MonitoringPhoto,
  MonitoringSession,
  Participant,
  PhotoKind,
  SessionTopic,
  Submission,
  Trainer,
  Venue,
  Workshop,
  WorkshopDetail,
} from './types';

export const auth = {
  /** Portal credentials: the system generated user ID, never an email. */
  login: (username: string, password: string) =>
    api.post<LoginResponse>('auth/login', { username, password }, true),
};

export const workshops = {
  mine: () => api.get<Workshop[]>('coordinator/programmes'),
  get: (id: number) => api.get<WorkshopDetail>(`coordinator/programmes/${id}`),
  curriculum: (id: number) => api.get<SessionTopic[]>(`coordinator/programmes/${id}/curriculum`),
  submit: (id: number, remarks?: string) =>
    api.post<Submission>(`coordinator/programmes/${id}/submit`, { remarks }),
};

export const venue = {
  save: (
    id: number,
    body: {
      name: string;
      address: string;
      landmark?: string;
      latitude?: number | null;
      longitude?: number | null;
      accuracyMetres?: number | null;
    },
  ) => api.put<Venue>(`coordinator/programmes/${id}/venue`, body),
};

export const trainers = {
  add: (id: number, body: Omit<Trainer, 'id'>) =>
    api.post<Trainer>(`coordinator/programmes/${id}/trainers`, body),
  update: (trainerId: number, body: Omit<Trainer, 'id'>) =>
    api.put<Trainer>(`coordinator/trainers/${trainerId}`, body),
};

export const sessions = {
  add: (
    id: number,
    body: {
      trainerId: number;
      curriculumSessionId: number;
      curriculumTopicId: number;
      comments?: string;
    },
  ) => api.post<MonitoringSession>(`coordinator/programmes/${id}/sessions`, body),
};

export const participants = {
  add: (
    id: number,
    body: {
      fullName: string;
      mobile: string;
      email: string;
      enterpriseName: string;
      designation?: string;
      udyamNumber: string;
      gender: string;
      socialCategory: string;
    },
  ) => api.post<Participant>(`coordinator/programmes/${id}/participants`, body),

  /** The whole register in one call, so a pass of the room lands together. */
  attendance: (id: number, marks: { participantId: number; isPresent: boolean }[]) =>
    api.put<number>(`coordinator/programmes/${id}/attendance`, marks),

  feedback: (participantId: number, rating: number, comments?: string) =>
    api.put<Participant>(`coordinator/participants/${participantId}/feedback`, {
      rating,
      comments,
    }),
};

/* ----------------------------------------------------------------- photos */

export interface CapturedImage {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}

export interface Fix {
  latitude: number;
  longitude: number;
}

/**
 * Uploads one photograph.
 *
 * Multipart, so it goes up as bytes rather than as base64 inflated by a third —
 * on a workshop's worth of photos over a field connection that difference is
 * the difference between finishing and not. `fetch` sets its own boundary, so
 * the Content-Type header is deliberately left unset.
 */
async function upload(path: string, image: CapturedImage, fix?: Fix | null): Promise<MonitoringPhoto> {
  const url = new URL(`${API_BASE_URL}/${path}`);
  if (fix) {
    url.searchParams.set('latitude', String(fix.latitude));
    url.searchParams.set('longitude', String(fix.longitude));
  }

  const form = new FormData();
  form.append('file', {
    uri: image.uri,
    name: image.fileName ?? `photo-${Date.now()}.jpg`,
    type: image.mimeType ?? 'image/jpeg',
  } as unknown as Blob);

  const token = readAuthToken();

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });

  const envelope = (await response.json().catch(() => null)) as
    | { success: boolean; data: MonitoringPhoto; message?: string }
    | null;

  if (!response.ok || envelope?.success === false) {
    throw new Error(envelope?.message ?? `Upload failed (${response.status}).`);
  }

  return envelope!.data;
}

export const photos = {
  venue: (id: number, slot: 'exterior' | 'interior', image: CapturedImage, fix?: Fix | null) =>
    upload(`coordinator/programmes/${id}/venue/photo?slot=${slot}`, image, fix),

  session: (id: number, sessionId: number, image: CapturedImage, fix?: Fix | null) =>
    upload(`coordinator/programmes/${id}/sessions/${sessionId}/photo`, image, fix),

  participant: (id: number, participantId: number, image: CapturedImage, fix?: Fix | null) =>
    upload(`coordinator/programmes/${id}/participants/${participantId}/photo`, image, fix),

  attendanceSheet: (id: number, image: CapturedImage, fix?: Fix | null) =>
    upload(`coordinator/programmes/${id}/attendance/photo`, image, fix),

  /** Absolute URL for showing a stored photo back. */
  src: (kind: PhotoKind | undefined, relative: string) => `${API_BASE_URL}/${relative}`,
};
