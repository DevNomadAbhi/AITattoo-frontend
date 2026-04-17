import { IconSymbol } from "@/components/ui/icon-symbol";
import { Fonts } from "@/constants/theme";
import { auth } from "@/firebase/firebaseConfig";
import { authStorage } from "@/lib/auth-storage";
import { DrawerNavigationProp } from "@react-navigation/drawer";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import React from "react";
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type DrawerNavigationProps = DrawerNavigationProp<any>;

interface MenuItem {
  label: string;
  route: string;
  icon: string;
}

const menuItems: MenuItem[] = [
  { label: "Home", route: "index", icon: "square.grid.2x2.fill" },
  { label: "Create Tattoo", route: "createTattooScreen", icon: "sparkles" },
  { label: "My Tattoos", route: "myTattoo", icon: "bookmark.fill" },
  { label: "Profile", route: "profile", icon: "person.fill" },
];

export function DrawerContent() {
  const navigation = useNavigation<DrawerNavigationProps>();
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const handleNavigate = (route: string) => {
    navigation.navigate(route);
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
            authStorage.clearAuthData();
            navigation.closeDrawer();
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

  return (
    <SafeAreaView style={styles.container} edges={["top", "left"]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tattoo Hunter</Text>
          <Text style={styles.headerSubtitle}>Your Design Companion</Text>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <Pressable
              key={item.route}
              onPress={() => handleNavigate(item.route)}
              style={({ pressed }) => [
                styles.menuItem,
                { backgroundColor: pressed ? "#F0E5D8" : "transparent" },
              ]}
            >
              <IconSymbol
                name={item.icon as any}
                size={24}
                color="#6B5B52"
                style={styles.menuIcon}
              />
              <Text style={styles.menuLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Logout Button */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleLogout}
          disabled={loading}
          style={({ pressed }) => [
            styles.logoutButton,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={styles.logoutButtonText}>
            {loading ? "Logging out..." : "Logout"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F1E8",
    fontFamily: Fonts.fredoka,
  },
  scrollView: {
    flex: 1,
    fontFamily: Fonts.fredoka,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#E2D7C7",
    fontFamily: Fonts.fredoka,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1B130D",
    fontFamily: Fonts.fredoka,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#6B5B52",
    fontFamily: Fonts.fredoka,
  },
  menuSection: {
    paddingVertical: 8,
    fontFamily: Fonts.fredoka,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    fontFamily: Fonts.fredoka,
  },
  menuIcon: {
    width: 24,
    height: 24,
    fontFamily: Fonts.fredoka,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#2D2420",
    fontFamily: Fonts.fredoka,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2D7C7",
    fontFamily: Fonts.fredoka,
  },
  logoutButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "rgba(231, 76, 60, 0.1)",
    borderWidth: 1.5,
    borderColor: "#E74C3C",
    fontFamily: Fonts.fredoka,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#E74C3C",
    fontFamily: Fonts.fredoka,
  },
});

