import * as FileSystem from 'expo-file-system/legacy';
import { ApiError, API_BASE_URL, api, readAuthToken, readUserCode } from './client';
import { enqueue, keepPhoto, newLocalId } from '../offline/outbox';
import { appendFacts, deviceFacts, factsQuery, type DeviceFacts } from './captureFacts';
import type {
  Branding,
  LoginResponse,
  Marksheet,
  MarksheetRowSave,
  MonitoringPhoto,
  MyNotifications,
  MonitoringSession,
  Participant,
  PhotoKind,
  SessionTopic,
  Submission,
  Trainer,
  TrainerUpsert,
  Venue,
  Workshop,
  WorkshopDetail,
} from './types';

export const siteText = {
  /* Anonymous like the branding, and cached like every other read: the wording
     has to be there on a phone that has not reached the server today. */
  map: () => api.get<Record<string, string>>('site-text/map', undefined, true),
};

export const branding = {
  /* Anonymous, so the sign-in screen is branded before anyone has signed in -
     which is the screen where it matters most. */
  get: () => api.get<Branding>('branding', undefined, true),
};

export const auth = {
  /** Portal credentials: the system generated user ID, never an email. */
  login: (username: string, password: string) =>
    api.post<LoginResponse>('auth/login', { username, password }, true),
};

/* ------------------------------------------------------- writing offline */

/**
 * Sends a write, and keeps it for later if the server cannot be reached.
 *
 * The caller says what the record will look like once it exists, and that is
 * what the screen gets straight away. Offline, the coordinator sees the
 * participant they just registered in the list, exactly as they would with a
 * signal — the difference is a provisional id and a line in the banner, not a
 * different way of working.
 *
 * Only a failure to reach the server is queued. A refusal is a refusal: the
 * server has seen the request and said no, and pretending otherwise would show
 * the coordinator a record that is never going to exist.
 */
async function writeOrQueue<T>(spec: {
  label: string;
  method: 'POST' | 'PUT';
  path: string;
  body?: unknown;
  localId?: number;
  provisional: T;
}): Promise<T> {
  try {
    return spec.method === 'POST'
      ? await api.post<T>(spec.path, spec.body)
      : await api.put<T>(spec.path, spec.body);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 0) throw error;

    await enqueue({
      owner: readUserCode() ?? 'unknown',
      label: spec.label,
      method: spec.method,
      path: spec.path,
      body: spec.body,
      localId: spec.localId,
    });

    return spec.provisional;
  }
}

const NOW = () => new Date().toISOString();

export const workshops = {
  mine: () => api.get<Workshop[]>('coordinator/programmes'),
  get: (id: number) => api.get<WorkshopDetail>(`coordinator/programmes/${id}`),
  curriculum: (id: number) => api.get<SessionTopic[]>(`coordinator/programmes/${id}/curriculum`),
  /*
   * Deliberately not queued. Submitting seals the workshop, and the server
   * decides whether everything required is there — telling a coordinator it is
   * submitted when nothing has left the phone, and having it refused hours
   * later, is worse than telling them to find a signal for this one step.
   */
  submit: (id: number, remarks?: string) =>
    api.post<Submission>(`coordinator/programmes/${id}/submit`, { remarks }),
};

export const marksheet = {
  /*
   * Cached like every other read, so a coordinator who loaded the sheet with a
   * signal can still mark on it in a hall without one.
   */
  get: (id: number) => api.get<Marksheet>(`coordinator/programmes/${id}/marksheet`),

  /**
   * A pass of the sheet.
   *
   * Queued when there is no signal, like the register: marking happens
   * candidate by candidate in a room, and losing an afternoon of it to a dead
   * network would be the app failing at its job. The provisional answer is the
   * sheet as it was, because the screen already shows what was typed - the
   * server's recomputed results arrive when the queue drains.
   */
  save: (id: number, rows: MarksheetRowSave[], current: Marksheet) =>
    writeOrQueue<Marksheet>({
      label: 'Marks',
      method: 'PUT',
      path: `coordinator/programmes/${id}/marksheet`,
      body: { rows },
      provisional: current,
    }),
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
  ) =>
    writeOrQueue<Venue>({
      label: 'Venue',
      method: 'PUT',
      path: `coordinator/programmes/${id}/venue`,
      body,
      provisional: {
        id: newLocalId(),
        name: body.name,
        address: body.address,
        landmark: body.landmark ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        accuracyMetres: body.accuracyMetres ?? null,
        geoTaggedOn: body.latitude != null ? NOW() : null,
      },
    }),
};

export const trainers = {
  add: (id: number, body: TrainerUpsert) => {
    const localId = newLocalId();
    return writeOrQueue<Trainer>({
      label: 'Trainer',
      method: 'POST',
      path: `coordinator/programmes/${id}/trainers`,
      body,
      localId,
      /* The row shown while the write is queued. Aadhaar is dropped and
         only its last four kept, so a trainer registered offline looks
         on screen exactly as it will once the server answers — and the
         whole number does not sit in the outbox longer than it must. */
      provisional: { ...provisional(body), id: localId },
    });
  },
  update: (trainerId: number, body: TrainerUpsert) =>
    writeOrQueue<Trainer>({
      label: 'Trainer',
      method: 'PUT',
      path: `coordinator/trainers/${trainerId}`,
      body,
      provisional: { ...provisional(body), id: trainerId },
    }),

  /** The qualifications a trainer may be recorded against. */
  qualifications: () => api.get<string[]>('coordinator/qualifications'),
};

/** A trainer row as it will read once the server has it. */
function provisional(body: TrainerUpsert): Omit<Trainer, 'id'> {
  const { aadhaar, ...rest } = body;
  return {
    ...rest,
    aadhaarLast4: aadhaar && aadhaar.length >= 4 ? aadhaar.slice(-4) : null,
  };
}

export const sessions = {
  add: (
    id: number,
    body: {
      trainerId: number;
      curriculumSessionId: number;
      curriculumTopicId: number;
      comments?: string;
    },
  ) => {
    const localId = newLocalId();
    return writeOrQueue<MonitoringSession>({
      label: 'Session',
      method: 'POST',
      path: `coordinator/programmes/${id}/sessions`,
      body,
      localId,
      provisional: {
        id: localId,
        trainerId: body.trainerId,
        curriculumSessionId: body.curriculumSessionId,
        curriculumTopicId: body.curriculumTopicId,
        conductedOn: NOW(),
        comments: body.comments ?? null,
      },
    });
  },
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
  ) => {
    const localId = newLocalId();
    return writeOrQueue<Participant>({
      label: 'Participant',
      method: 'POST',
      path: `coordinator/programmes/${id}/participants`,
      body,
      localId,
      provisional: { id: localId, ...body },
    });
  },

  /** The whole register in one call, so a pass of the room lands together. */
  /* A mark belongs to a day: a five-day programme keeps five
     registers, and one without a day could only land in one of them
     by guessing. */
  attendance: (
    id: number,
    marks: { participantId: number; day: string; isPresent: boolean }[],
  ) =>
    writeOrQueue<number>({
      label: 'Attendance',
      method: 'PUT',
      path: `coordinator/programmes/${id}/attendance`,
      body: marks,
      provisional: marks.length,
    }),

  feedback: (participantId: number, rating: number, comments?: string) =>
    writeOrQueue<Participant>({
      label: 'Feedback',
      method: 'PUT',
      path: `coordinator/participants/${participantId}/feedback`,
      body: { rating, comments },
      /* The screen only reads the feedback back off this, so the rest of the
         participant is filled in from the list it already has. */
      provisional: {
        id: participantId,
        fullName: '',
        mobile: '',
        email: '',
        enterpriseName: '',
        udyamNumber: '',
        feedbackRating: rating,
        feedbackComments: comments ?? null,
      },
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
  /* Read once, here, so the online attempt and the queued retry below
     describe the same moment. Generated inside send() they would be the
     time of whichever attempt happened to succeed, which on a field visit
     can be hours after the photograph was taken. */
  const facts = deviceFacts();

  try {
    return await send(path, image, fix, facts);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 0) throw error;

    /*
     * The photograph outlives the attempt. expo-image-picker returns a path in
     * a cache the system may empty, so a copy is taken before the entry is
     * queued - otherwise the upload that runs hours later has nothing to send.
     */
    const name = image.fileName ?? `photo-${Date.now()}.jpg`;
    const kept = await keepPhoto(image.uri, name, image.mimeType ?? 'image/jpeg');

    const geo = fix ? `latitude=${fix.latitude}&longitude=${fix.longitude}&` : '';
    const tail = `${geo}${factsQuery(facts)}`;
    const withFix = path.includes('?') ? `${path}&${tail}` : `${path}?${tail}`;

    await enqueue({
      owner: readUserCode() ?? 'unknown',
      label: 'Photo',
      method: 'POST',
      path: withFix,
      photo: { ...kept, latitude: fix?.latitude ?? null, longitude: fix?.longitude ?? null },
    });

    return {
      id: newLocalId(),
      kind: 'Venue' as MonitoringPhoto['kind'],
      fileName: name,
      contentType: image.mimeType ?? 'image/jpeg',
      sizeBytes: 0,
      latitude: fix?.latitude ?? null,
      longitude: fix?.longitude ?? null,
      capturedOn: facts.capturedOn,
      /* The local copy, so the screen shows the photo that was just taken
         rather than a gap where the server's copy will eventually be. */
      url: kept.uri,
    };
  }
}

async function send(
  path: string,
  image: CapturedImage,
  fix?: Fix | null,
  facts: DeviceFacts = deviceFacts(),
): Promise<MonitoringPhoto> {
  const url = new URL(`${API_BASE_URL}/${path}`);
  if (fix) {
    url.searchParams.set('latitude', String(fix.latitude));
    url.searchParams.set('longitude', String(fix.longitude));
  }
  appendFacts(url, facts);

  const token = readAuthToken();

  /* Not fetch with a FormData part: React Native's own multipart encoder
     refuses a file part under the new architecture -- "Unsupported
     FormDataPart implementation" -- so the photograph never leaves the
     handset. The file system module encodes it natively from the path the
     picture is already at. */
  let result: FileSystem.FileSystemUploadResult;
  try {
    result = await FileSystem.uploadAsync(url.toString(), image.uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: image.mimeType ?? 'image/jpeg',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    /* Status 0 is how the rest of the client says "could not reach the
       server", and the caller queues on exactly that. */
    throw new ApiError('Cannot reach the server.', 0);
  }

  let envelope: { success: boolean; data: MonitoringPhoto; message?: string } | null = null;
  try {
    envelope = JSON.parse(result.body);
  } catch {
    /* Nothing readable came back; the status decides. */
  }

  if (result.status >= 400 || envelope?.success === false) {
    throw new Error(envelope?.message ?? `Upload failed (${result.status}).`);
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


/** What the scheme has said to this coordinator, and where to reach them. */
export const notices = {
  list: (take = 50) => api.get<MyNotifications>('my-notifications', { take }),
  markRead: (id: number) => api.post<boolean>(`my-notifications/${id}/read`, {}),
  registerDevice: (device: { token: string; platform: string; app: string }) =>
    api.post<boolean>('my-notifications/devices', device),
  retireDevice: (token: string) =>
    api.delete<boolean>(`my-notifications/devices/${encodeURIComponent(token)}`),
};
