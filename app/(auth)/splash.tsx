import { Fonts } from "@/constants/theme";
import { auth } from "@/firebase/firebaseConfig";
import { authStorage } from "@/lib/auth-storage";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    let hasNavigated = false;

    const minimumSplashDelay = setTimeout(() => {
      // no-op: this keeps the splash visible briefly for UX polish
    }, 900);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (hasNavigated) return;
      hasNavigated = true;

      if (user) {
        await authStorage.setUserLoggedIn(true);
        await authStorage.setUserUID(user.uid);
        await authStorage.setUserEmail(user.email || "");
        await authStorage.setUserName(user.displayName || "");
        router.replace("/(tabs)");
        return;
      }

      await authStorage.clearAuthData();
      router.replace("/(auth)/welcome");
    });

    return () => {
      clearTimeout(minimumSplashDelay);
      unsubscribe();
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <Image
        source={require("@/assets/images/tattoo_hunter_crop.png")}
        style={StyleSheet.absoluteFillObject}
        contentFit="fill"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0907",
    fontFamily: Fonts.fredoka,
  },
});
