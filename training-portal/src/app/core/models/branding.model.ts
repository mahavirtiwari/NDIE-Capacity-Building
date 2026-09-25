/**
 * Portal identity, maintained by Super Admin under Administration → Branding.
 * Held on the server so the portal, the mobile app and outgoing email all read
 * one source of truth instead of a checked-in asset.
 */
export interface Branding {
  organisationName: string;
  shortName: string;
  portalTitle: string;
  tagline?: string | null;
  supportEmail?: string | null;
  hasLogo: boolean;
  logoFileName?: string | null;
  /** Relative to the API base, already carrying a cache-busting version. */
  logoUrl?: string | null;
  logoVersion: number;
  /**
   * Where the mark takes you when clicked. Null means it is an image and not a
   * link, which is right for a mark that already sits beside the home nav.
   */
  logoLinkUrl?: string | null;

  /** The accrediting or partner body shown beside the main mark, e.g. QCI. */
  partnerName?: string | null;
  hasPartnerLogo: boolean;
  partnerLogoFileName?: string | null;
  partnerLogoUrl?: string | null;
  partnerLogoVersion: number;
  partnerLogoLinkUrl?: string | null;

  updatedOn: string;
}

export type BrandingUpdate = Pick<
  Branding,
  | 'organisationName'
  | 'shortName'
  | 'portalTitle'
  | 'tagline'
  | 'supportEmail'
  | 'partnerName'
  | 'logoLinkUrl'
  | 'partnerLogoLinkUrl'
>;

/** Which mark an upload or removal targets. */
export type LogoSlot = 'primary' | 'partner';
