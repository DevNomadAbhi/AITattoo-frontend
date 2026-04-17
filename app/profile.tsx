import { Fonts } from "@/constants/theme";
import { auth } from "@/firebase/firebaseConfig";
import { authStorage } from "@/lib/auth-storage";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { deleteUser, signOut, updateProfile } from "firebase/auth";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setEmail(user.email || "");
      setName(user.displayName || "");
    }
  }, []);

  const handleSaveName = async () => {
    if (!name.trim()) {
      Alert.alert("Validation Error", "Name cannot be empty");
      return;
    }

    try {
      setLoading(true);
      const user = auth.currentUser;
      if (user) {
        await updateProfile(user, { displayName: name });
        // Persist updated name
        await authStorage.setUserName(name);
        setIsEditing(false);
        Alert.alert("Success", "Profile updated successfully");
      }
    } catch (error: any) {
      Alert.alert("Update Error", error.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        onPress: () => {},
        style: "cancel",
      },
      {
        text: "Logout",
        onPress: async () => {
          try {
            setLoading(true);
            await signOut(auth);
            // Clear persisted auth data
            await authStorage.clearAuthData();
            router.replace("/(auth)/welcome");
          } catch (error: any) {
            Alert.alert("Logout Error", error.message || "Failed to logout");
            setLoading(false);
          }
        },
        style: "destructive",
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This action cannot be undone. All your data will be permanently deleted.",
      [
        {
          text: "Cancel",
          onPress: () => {},
          style: "cancel",
        },
        {
          text: "Delete",
          onPress: async () => {
            try {
              setLoading(true);
              const user = auth.currentUser;
              if (user) {
                await deleteUser(user);
                // Clear persisted auth data
                await authStorage.clearAuthData();
                router.replace("/(auth)/welcome");
              }
            } catch (error: any) {
              Alert.alert(
                "Delete Error",
                error.message || "Failed to delete account",
              );
              setLoading(false);
            }
          },
          style: "destructive",
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <View style={styles.content}>
          {/* Name Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Name</Text>
              {!isEditing && (
                <Pressable onPress={() => setIsEditing(true)}>
                  <Text style={styles.editButton}>Edit</Text>
                </Pressable>
              )}
            </View>

            {isEditing ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your name"
                  value={name}
                  onChangeText={setName}
                  editable={!loading}
                />
                <View style={styles.buttonRow}>
                  <Pressable
                    style={[styles.secondaryButton, { flex: 1 }]}
                    onPress={() => setIsEditing(false)}
                    disabled={loading}
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.primaryButton, { flex: 1, marginLeft: 12 }]}
                    onPress={handleSaveName}
                    disabled={loading}
                  >
                    <Text style={styles.primaryButtonText}>
                      {loading ? "Saving..." : "Save"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Text style={styles.fieldValue}>{name || "Not set"}</Text>
            )}
          </View>

          {/* Email Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Email</Text>
            <Text style={styles.fieldValue}>{email || "Not available"}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsSection}>
            <Pressable
              style={({ pressed }) => [
                styles.logoutButton,
                { opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={handleLogout}
              disabled={loading}
            >
              <Text style={styles.logoutButtonText}>Logout</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.deleteButton,
                { opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={handleDeleteAccount}
              disabled={loading}
            >
              <Text style={styles.deleteButtonText}>Delete Account</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F1E8",
    fontFamily: Fonts.fredoka,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    fontFamily: Fonts.fredoka,
  },
  header: {
    marginBottom: 24,
    fontFamily: Fonts.fredoka,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1B130D",
    fontFamily: Fonts.fredoka,
  },
  content: {
    gap: 20,
    paddingBottom: 30,
    fontFamily: Fonts.fredoka,
  },
  section: {
    gap: 12,
    fontFamily: Fonts.fredoka,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    fontFamily: Fonts.fredoka,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B5B52",
    fontFamily: Fonts.fredoka,
    textTransform: "uppercase",
  },
  editButton: {
    fontSize: 13,
    fontWeight: "600",
    color: "#D4B480",
    fontFamily: Fonts.fredoka,
  },
  fieldValue: {
    fontSize: 16,
    color: "#2D2420",
    fontFamily: Fonts.fredoka,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(212, 180, 120, 0.15)",
  },
  editContainer: {
    gap: 12,
    fontFamily: Fonts.fredoka,
  },
  input: {
    fontSize: 16,
    color: "#2D2420",
    fontFamily: Fonts.fredoka,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(212, 180, 120, 0.3)",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    fontFamily: Fonts.fredoka,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D4B480",
    fontFamily: Fonts.fredoka,
  },
  primaryButtonText: {
    color: "#1B130D",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(212, 180, 120, 0.2)",
    fontFamily: Fonts.fredoka,
  },
  secondaryButtonText: {
    color: "#2D2420",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: Fonts.fredoka,
  },
  actionsSection: {
    marginTop: 24,
    gap: 12,
    fontFamily: Fonts.fredoka,
  },
  logoutButton: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D4B480",
    fontFamily: Fonts.fredoka,
  },
  logoutButtonText: {
    color: "#1B130D",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  deleteButton: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E74C3C",
    backgroundColor: "rgba(231, 76, 60, 0.08)",
    fontFamily: Fonts.fredoka,
  },
  deleteButtonText: {
    color: "#E74C3C",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
});
