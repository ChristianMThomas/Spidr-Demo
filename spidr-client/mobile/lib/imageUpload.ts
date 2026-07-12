import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { integrations } from './apiClient';

/**
 * pickAndUpload — opens the image picker, uploads the pick to /upload, returns
 * the CDN URL (or null if the user cancelled / picking failed).
 *
 *  - `crop=true` opens the built-in editor (square by default; pass `aspect`
 *    for banners: [16, 9]).
 *  - Video is opt-in via `videos=true` — chat attachments accept video,
 *    banners/avatars don't.
 *  - Permissions are requested lazily and surfaced through Alert on denial.
 */
export async function pickAndUpload({
  crop = false,
  aspect,
  videos = false,
  quality = 0.85,
}: {
  crop?: boolean;
  aspect?: [number, number];
  videos?: boolean;
  quality?: number;
} = {}): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permission needed', 'Grant photo library access in Settings to pick an image.');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: videos ? ['images', 'videos'] : ['images'],
    allowsEditing: crop,
    aspect,
    quality,
    exif: false,
  });

  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];

  // RN FormData accepts { uri, name, type } as a file part directly — no
  // memory read. apiClient.integrations.Core.UploadFile does the
  // fd.append('file', ...) → multer/multipart round-trip.
  const uri = asset.uri;
  const name = asset.fileName || uri.split('/').pop() || `upload-${Date.now()}`;
  const ext = (name.match(/\.(\w+)$/) || ['', ''])[1].toLowerCase();
  const type =
    asset.mimeType ||
    (asset.type === 'video'
      ? 'video/mp4'
      : ext === 'gif' ? 'image/gif'
      : ext === 'png' ? 'image/png'
      : ext === 'webp' ? 'image/webp'
      : 'image/jpeg');

  try {
    const res: any = await integrations.Core.UploadFile({ file: { uri, name, type } as any });
    return res?.url || null;
  } catch (err: any) {
    Alert.alert('Upload failed', err?.message || 'Try again.');
    return null;
  }
}
