import { Fonts } from "@/constants/theme";
import { auth } from "@/firebase/firebaseConfig";
import { authStorage } from "@/lib/auth-storage";
import {
    GoogleSignin,
    isErrorWithCode,
    isSuccessResponse,
    statusCodes,
} from "@react-native-google-signin/google-signin";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithCredential,
    signInWithEmailAndPassword,
} from "firebase/auth";
import { useEffect, useState } from "react";
import {
    Alert,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const GOOGLE_WEB_CLIENT_ID =
  "914863598868-2nu5em7ne375u8ue97eu0peud8cvt3bp.apps.googleusercontent.com";
const GOOGLE_IOS_CLIENT_ID =
  "914863598868-9c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c.apps.googleusercontent.com";

export default function LoginScreen() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID,
      offlineAccess: false,
    });
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      if (Platform.OS === "web") {
        Alert.alert(
          "Unsupported",
          "Google native sign-in is only available on Android/iOS.",
        );
        return;
      }

      setLoading(true);
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      const signInResult = await GoogleSignin.signIn();
      if (!isSuccessResponse(signInResult)) {
        return;
      }

      const idToken =
        signInResult.data.idToken || (await GoogleSignin.getTokens()).idToken;
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);

      if (userCredential.user) {
        await authStorage.setUserUID(userCredential.user.uid);
        await authStorage.setUserEmail(userCredential.user.email || "");
        await authStorage.setUserName(userCredential.user.displayName || "");
        await authStorage.setUserLoggedIn(true);
        router.replace("/(tabs)");
      }
    } catch (error: any) {
      console.error("Google Sign-In failure", {
        code: error?.code,
        message: error?.message,
        stack: error?.stack,
      });
      if (isErrorWithCode(error)) {
        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
          return;
        }
        if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          Alert.alert(
            "Google Play Services",
            "Google Play Services is not available.",
          );
          return;
        }
        Alert.alert(
          "Google Sign In Error",
          `${error.code}: ${error.message || "Failed to sign in"}`,
        );
        return;
      }
      Alert.alert(
        "Google Sign In Error",
        error?.message || "Failed to sign in",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      Alert.alert("Validation Error", "Please enter email and password");
      return;
    }

    try {
      setLoading(true);

      let userCredential;
      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
      } else {
        userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password,
        );
      }

      // Persist user data
      await authStorage.setUserUID(userCredential.user.uid);
      await authStorage.setUserEmail(userCredential.user.email || "");
      await authStorage.setUserName(userCredential.user.displayName || "");
      await authStorage.setUserLoggedIn(true);

      router.replace("/(tabs)");
    } catch (error: any) {
      let errorMessage = error.message;

      if (error.code === "auth/email-already-in-use") {
        errorMessage = "Email is already in use";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password should be at least 6 characters";
      } else if (error.code === "auth/user-not-found") {
        errorMessage = "User not found. Please sign up first";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Incorrect password";
      }

      Alert.alert(isSignUp ? "Sign Up Error" : "Sign In Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

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
          <Text style={styles.title}>
            {isSignUp ? "Join Tattoo Hunter" : "Welcome Back"}
          </Text>
          <Text style={styles.subtitle}>
            {isSignUp
              ? "Create an account to start exploring tattoos"
              : "Sign in to access your tattoo gallery"}
          </Text>
        </View>

        <View style={styles.content}>
          {/* Google Sign In Button */}
          <Pressable
            onPress={handleGoogleSignIn}
            disabled={loading}
            style={({ pressed }) => [
              styles.googleButton,
              { opacity: pressed && !loading ? 0.8 : 1 },
            ]}
          >
            <Text style={styles.googleButtonText}>🔵 Sign in with Google</Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email Input */}
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="rgba(255, 241, 221, 0.4)"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Password Input */}
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="rgba(255, 241, 221, 0.4)"
            value={password}
            onChangeText={setPassword}
            editable={!loading}
            secureTextEntry
            autoCapitalize="none"
          />

          {/* Sign In / Sign Up Button */}
          <Pressable
            onPress={handleEmailSignIn}
            disabled={loading}
            style={({ pressed }) => [
              styles.submitButton,
              { opacity: pressed && !loading ? 0.92 : 1 },
            ]}
          >
            <Text style={styles.submitButtonText}>
              {loading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
            </Text>
          </Pressable>

          {/* Toggle Sign Up / Sign In */}
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleText}>
              {isSignUp
                ? "Already have an account? "
                : "Don't have an account? "}
            </Text>
            <Pressable
              onPress={() => {
                setIsSignUp(!isSignUp);
                setEmail("");
                setPassword("");
              }}
              disabled={loading}
            >
              <Text style={styles.toggleLink}>
                {isSignUp ? "Sign In" : "Sign Up"}
              </Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.helperText}>
          Your data is secure and encrypted.
        </Text>
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
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    justifyContent: "space-between",
    fontFamily: Fonts.fredoka,
  },
  header: {
    gap: 12,
    marginTop: 8,
    fontFamily: Fonts.fredoka,
  },
  title: {
    maxWidth: 280,
    color: "#FFF6E8",
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  subtitle: {
    maxWidth: 310,
    color: "rgba(255, 241, 221, 0.86)",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
  },
  content: {
    gap: 16,
    fontFamily: Fonts.fredoka,
  },
  googleButton: {
    minHeight: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255, 241, 221, 0.3)",
    fontFamily: Fonts.fredoka,
  },
  googleButtonText: {
    color: "#1B130D",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 8,
    fontFamily: Fonts.fredoka,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 241, 221, 0.2)",
    fontFamily: Fonts.fredoka,
  },
  dividerText: {
    color: "rgba(255, 241, 221, 0.5)",
    fontSize: 13,
    fontFamily: Fonts.fredoka,
  },
  label: {
    color: "#F8EBD4",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
    fontFamily: Fonts.fredoka,
  },
  input: {
    minHeight: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(15, 11, 9, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(243, 218, 176, 0.2)",
    color: "#FFF6E8",
    fontSize: 14,
    fontFamily: Fonts.fredoka,
  },
  submitButton: {
    minHeight: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8D1A8",
    marginTop: 8,
    fontFamily: Fonts.fredoka,
  },
  submitButtonText: {
    color: "#1B130D",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
    fontFamily: Fonts.fredoka,
  },
  toggleText: {
    color: "rgba(255, 241, 221, 0.7)",
    fontSize: 13,
    fontFamily: Fonts.fredoka,
  },
  toggleLink: {
    color: "#E8D1A8",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
    textDecorationLine: "underline",
  },
  helperText: {
    color: "rgba(255, 241, 221, 0.5)",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
  },
});
