//
// permissions.ts — one place that asks for every OS permission Spidr needs.
//
// The old flow asked lazily: the mic prompt fired the first time you joined a
// call, the camera prompt the first time you turned video on, and the
// notification prompt on the first flip of the Signal Control master switch.
// That works, but it means the first call you ever take stalls on two system
// alerts. This module front-loads them onto a single moment just after login,
// behind a primer screen that explains why (see components/PermissionPrimer).
//
// Every request checks current status first, because the OS only ever shows
// each prompt once: after a decline, requesting again is a silent no-op, and
// the only route back is the system Settings app.
//
import AsyncStorage from '@react-native-async-storage/async-storage';
import { callManager } from './callManager';
import { entities } from './apiClient';

export type PermissionOutcome = 'granted' | 'blocked' | 'unavailable';

export interface PermissionResults {
  microphone: PermissionOutcome;
  camera: PermissionOutcome;
  notifications: PermissionOutcome;
}

const primedKey = (userId: string) => `spidr_permissions_primed:${userId}`;

/** Has this account already been through the primer on this device? */
export async function hasBeenPrimed(userId?: string | null): Promise<boolean> {
  if (!userId) return true; // no user = nothing to prime yet
  try {
    return (await AsyncStorage.getItem(primedKey(userId))) === '1';
  } catch {
    return true; // storage unavailable — never nag
  }
}

export async function markPrimed(userId?: string | null): Promise<void> {
  if (!userId) return;
  try { await AsyncStorage.setItem(primedKey(userId), '1'); } catch {}
}

async function requestMicrophone(): Promise<PermissionOutcome> {
  try {
    const { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } = require('expo-audio');
    const current = await getRecordingPermissionsAsync();
    if (current?.granted) return 'granted';
    if (current?.canAskAgain === false) return 'blocked';
    const res = await requestRecordingPermissionsAsync();
    return res?.granted ? 'granted' : 'blocked';
  } catch (err: any) {
    console.warn('[permissions] microphone request threw:', err?.message);
    return 'unavailable';
  }
}

async function requestCamera(): Promise<PermissionOutcome> {
  try {
    // expo-image-picker is already a dependency and its camera request fires
    // the same NSCameraUsageDescription prompt a dedicated camera module
    // would — no reason to add expo-camera just for this.
    const ImagePicker = require('expo-image-picker');
    const current = await ImagePicker.getCameraPermissionsAsync();
    if (current?.granted) return 'granted';
    if (current?.canAskAgain === false) return 'blocked';
    const res = await ImagePicker.requestCameraPermissionsAsync();
    return res?.granted ? 'granted' : 'blocked';
  } catch (err: any) {
    console.warn('[permissions] camera request threw:', err?.message);
    return 'unavailable';
  }
}

/**
 * Granting at the OS level says nothing about the in-app master switch, which
 * starts OFF. Flip it on so the permission the user just granted actually
 * results in banners, and mirror it to the profile the way Signal Control does
 * so web and desktop agree.
 */
async function enableNotificationPref(userId?: string | null): Promise<void> {
  try {
    let prefs: Record<string, any> = {};
    const raw = await AsyncStorage.getItem('spidr_notification_prefs');
    if (raw) prefs = JSON.parse(raw);
    if (prefs.enabled === true) return;
    prefs.enabled = true;
    await AsyncStorage.setItem('spidr_notification_prefs', JSON.stringify(prefs));
    if (!userId) return;
    const profiles: any = await entities.UserProfile.filter({ user_id: userId });
    const profileId = profiles?.[0]?.id;
    if (profileId) {
      await entities.UserProfile.update(profileId, {
        notification_prefs: { ...(profiles[0].notification_prefs || {}), ...prefs },
      });
    }
  } catch (err: any) {
    console.warn('[permissions] enabling notification pref failed:', err?.message);
  }
}

/**
 * Walk every permission in turn. Sequential on purpose — iOS queues system
 * alerts, and three stacked at once get tapped through without being read.
 */
export async function requestAllPermissions(userId?: string | null): Promise<PermissionResults> {
  const microphone = await requestMicrophone();
  const camera = await requestCamera();
  const notifications = await callManager.ensurePushPermission();
  if (notifications === 'granted') await enableNotificationPref(userId);
  await markPrimed(userId);
  return { microphone, camera, notifications };
}
