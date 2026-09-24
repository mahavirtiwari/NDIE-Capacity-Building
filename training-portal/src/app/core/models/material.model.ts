import { AppRole } from './auth.model';
import { AuditInfo, Id, RecordStatus } from './common.model';

export type MaterialKind = 'Document' | 'Video' | 'Presentation' | 'Link';
export const MATERIAL_KINDS: MaterialKind[] = ['Document', 'Video', 'Presentation', 'Link'];

/**
 * Training material is role scoped: Super Admin decides which roles may open a
 * given file or video.
 */
export interface TrainingMaterial extends AuditInfo {
  id: Id;
  title: string;
  description?: string;
  kind: MaterialKind;
  categoryId: Id;
  categoryName?: string;
  subCategoryId: Id;
  subCategoryName?: string;
  programTypeId: Id;
  programTypeName?: string;
  curriculumModuleId?: Id | null;
  fileName?: string;
  fileSizeKb?: number;
  mimeType?: string;
  url?: string;
  durationMinutes?: number | null;
  language: string;
  visibleToRoles: AppRole[];
  version: string;
  publishedOn: string;
  downloadAllowed: boolean;
  status: RecordStatus;
}
