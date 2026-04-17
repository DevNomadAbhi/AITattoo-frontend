import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Fonts } from "@/constants/theme";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      <Image
        source={require("@/assets/images/bg.png")}
        style={StyleSheet.absoluteFillObject}
        contentFit="fill"
      />

      <View style={styles.overlay} />

      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.kickerBadge}>
            <Text style={styles.kickerText}>Tattoo Hunter</Text>
          </View>

          <Text style={styles.title}>Find the design before the needle.</Text>
          <Text style={styles.subtitle}>
            Explore tattoo ideas, preview placement, and step into the studio
            with confidence.
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.featureRow}>
            <View style={styles.featurePill}>
              <Text style={styles.featureText}>Realistic previews</Text>
            </View>
            <View style={styles.featurePill}>
              <Text style={styles.featureText}>Faster decisions</Text>
            </View>
          </View>

          <Pressable
            onPress={() => router.push("/(auth)/login")}
            style={({ pressed }) => [
              styles.button,
              { opacity: pressed ? 0.92 : 1 },
            ]}
          >
            <Text style={styles.buttonText}>Enter Studio</Text>
          </Pressable>

          <Text style={styles.helperText}>
            Crafted for bold ink, careful choices, and better first looks.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0D0907",
    fontFamily: Fonts.fredoka,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 7, 5, 0.48)",
    fontFamily: Fonts.fredoka,
  },
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    fontFamily: Fonts.fredoka,
  },
  header: {
    gap: 16,
    marginTop: 8,
    fontFamily: Fonts.fredoka,
  },
  kickerBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(212, 180, 120, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(241, 218, 175, 0.28)",
    fontFamily: Fonts.fredoka,
  },
  kickerText: {
    color: "#F6E7C8",
    fontSize: 12,
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    maxWidth: 280,
    color: "#FFF6E8",
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  subtitle: {
    maxWidth: 310,
    color: "rgba(255, 241, 221, 0.86)",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
  },
  footer: {
    gap: 16,
    fontFamily: Fonts.fredoka,
  },
  featureRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
    fontFamily: Fonts.fredoka,
  },
  featurePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(15, 11, 9, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(243, 218, 176, 0.18)",
    fontFamily: Fonts.fredoka,
  },
  featureText: {
    color: "#F8EBD4",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: Fonts.fredoka,
  },
  button: {
    minHeight: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8D1A8",
    fontFamily: Fonts.fredoka,
  },
  buttonText: {
    color: "#1B130D",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  helperText: {
    color: "rgba(255, 241, 221, 0.7)",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
  },
});
