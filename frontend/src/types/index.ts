// The API contract has one definition: the backend's. These are type-only re-exports, so nothing from
// the backend ends up in the bundle. Folio's Swift models still have to be kept in step by hand.
export type {
  MediaItem,
  ProjectPreview,
  ProjectDetail,
  ProjectNav,
  PostPreview,
  PostDetail,
  PostNav,
  AppPrivacyPolicy,
  AppSupport,
} from '../../../backend/src/lib/types';
