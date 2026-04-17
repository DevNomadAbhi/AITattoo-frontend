import AsyncStorage from "@react-native-async-storage/async-storage";

export const authStorage = {
  // User Data
  setUserEmail: async (email: string) => {
    await AsyncStorage.setItem("user_email", email);
  },
  getUserEmail: async () => {
    return await AsyncStorage.getItem("user_email");
  },

  setUserName: async (name: string) => {
    await AsyncStorage.setItem("user_name", name);
  },
  getUserName: async () => {
    return await AsyncStorage.getItem("user_name");
  },

  setUserUID: async (uid: string) => {
    await AsyncStorage.setItem("user_uid", uid);
  },
  getUserUID: async () => {
    return await AsyncStorage.getItem("user_uid");
  },

  setUserLoggedIn: async (isLoggedIn: boolean) => {
    await AsyncStorage.setItem("user_logged_in", isLoggedIn ? "true" : "false");
  },
  isUserLoggedIn: async () => {
    const value = await AsyncStorage.getItem("user_logged_in");
    return value === "true";
  },

  setUserProfileImage: async (imageUri: string) => {
    await AsyncStorage.setItem("user_profile_image", imageUri);
  },
  getUserProfileImage: async () => {
    return await AsyncStorage.getItem("user_profile_image");
  },

  // Clear all auth data
  clearAuthData: async () => {
    await AsyncStorage.multiRemove([
      "user_email",
      "user_name",
      "user_uid",
      "user_logged_in",
      "user_profile_image",
      "user_credit_status", // Clear credits on logout
    ]);
  },
};
