import * as Haptics from "expo-haptics";
import { Alert, Platform, ToastAndroid } from "react-native";

async function runNotification(
  type: Haptics.NotificationFeedbackType,
) {
  try {
    await Haptics.notificationAsync(type);
  } catch {
    // Ignore haptic failures on unsupported devices.
  }
}

function showToast(message: string, title?: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }

  if (title) {
    Alert.alert(title, message);
  }
}

export async function notifySuccess(message: string, title?: string) {
  await runNotification(Haptics.NotificationFeedbackType.Success);
  showToast(message, title);
}

export async function notifyError(message: string, title?: string) {
  await runNotification(Haptics.NotificationFeedbackType.Error);
  showToast(message, title);
}

export async function notifyInfo(message: string, title?: string) {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Ignore haptic failures on unsupported devices.
  }

  showToast(message, title);
}
