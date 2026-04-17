import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import * as Font from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { Fonts } from "@/constants/theme";
import { auth } from "@/firebase/firebaseConfig";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { iapService } from "@/lib/in-app-purchase";
import { onAuthStateChanged } from "firebase/auth";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await Font.loadAsync({
          Fredoka_400Regular: require("../assets/fonts/Fredoka-Regular.ttf"),
          Fredoka_500Medium: require("../assets/fonts/Fredoka-Medium.ttf"),
          Fredoka_600SemiBold: require("../assets/fonts/Fredoka-SemiBold.ttf"),
          Fredoka_700Bold: require("../assets/fonts/Fredoka-Bold.ttf"),
        });

        const nativeText = Text as unknown as {
          defaultProps?: { style?: any };
        };
        nativeText.defaultProps = nativeText.defaultProps || {};
        nativeText.defaultProps.style = [
          { fontFamily: Fonts.fredoka },
          nativeText.defaultProps.style,
        ];

        setFontsLoaded(true);
      } catch (error) {
        console.error("Failed to load fonts:", error);
        setFontsLoaded(true); // Still continue to avoid infinite loading
      }
    })();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        await iapService.syncUserIdentity(user?.uid ?? null);
      } catch (error) {
        console.error("RevenueCat identity sync failed:", error);
      }
    });

    return unsubscribe;
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0D0907" }}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#0D0907", paddingTop: 0 },
          }}
        >
          <Stack.Screen name="(auth)/splash" />
          <Stack.Screen
            name="(auth)/welcome"
            options={{ contentStyle: { backgroundColor: "#0D0907" } }}
          />
          <Stack.Screen
            name="(auth)/login"
            options={{ contentStyle: { backgroundColor: "#0D0907" } }}
          />
          <Stack.Screen name="(tabs)" />
          {/* <Stack.Screen
            name="profile"
            options={{ contentStyle: { backgroundColor: "#F7F1E8" } }}
          /> */}
          <Stack.Screen
            name="camera-preview"
            options={{ contentStyle: { backgroundColor: "#050505" } }}
          />
          <Stack.Screen
            name="saved-preview"
            options={{ contentStyle: { backgroundColor: "#0D0907" } }}
          />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Modal" }}
          />
        </Stack>
        <StatusBar
          style="light"
          backgroundColor="#0D0907"
          translucent={false}
        />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
