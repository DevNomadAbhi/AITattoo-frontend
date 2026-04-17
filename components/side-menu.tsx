import { IconSymbol } from "@/components/ui/icon-symbol";
import { Fonts } from "@/constants/theme";
import { auth } from "@/firebase/firebaseConfig";
import { authStorage } from "@/lib/auth-storage";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import React, { useRef, useState } from "react";
import {
    Alert,
    Animated,
    Dimensions,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: screenWidth } = Dimensions.get("window");

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  label: string;
  route: string;
  icon: string;
  isTab?: boolean;
}

const menuItems: MenuItem[] = [
  { label: "Home", route: "index", icon: "square.grid.2x2.fill", isTab: true },
  {
    label: "Create Tattoo",
    route: "createTattooScreen",
    icon: "sparkles",
    isTab: true,
  },
  {
    label: "My Tattoos",
    route: "myTattoo",
    icon: "bookmark.fill",
    isTab: true,
  },
  { label: "Profile", route: "profile", icon: "person.fill", isTab: false },
];

export function SideMenu({ isOpen, onClose }: SideMenuProps) {
  const navigation = useNavigation<any>();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(
    new Animated.Value(isOpen ? 0 : -screenWidth * 0.75),
  ).current;

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOpen ? 0 : -screenWidth * 0.75,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isOpen]);

  const handleNavigate = (route: string, isTab: boolean) => {
    onClose();
    if (route === "profile") {
      router.push("/profile");
    } else if (isTab) {
      navigation.navigate(route);
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
            await authStorage.clearAuthData();
            onClose();
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

  if (!isOpen) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Overlay */}
      <Pressable
        style={styles.overlay}
        onPress={onClose}
        pointerEvents={isOpen ? "auto" : "none"}
      />

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          {
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <SafeAreaView style={styles.drawerContent} edges={["top", "left"]}>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <IconSymbol name="xmark" size={24} color="#2D2420" />
              </Pressable>
              <Text style={styles.headerTitle}>Tattoo Hunter</Text>
            </View>

            {/* Menu Items */}
            <View style={styles.menuSection}>
              {menuItems.map((item) => (
                <Pressable
                  key={item.route}
                  onPress={() =>
                    handleNavigate(item.route, item.isTab || false)
                  }
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
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    fontFamily: Fonts.fredoka,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    fontFamily: Fonts.fredoka,
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: screenWidth * 0.75,
    backgroundColor: "#F7F1E8",
    zIndex: 1001,
    fontFamily: Fonts.fredoka,
  },
  drawerContent: {
    flex: 1,
    fontFamily: Fonts.fredoka,
  },
  scrollView: {
    flex: 1,
    fontFamily: Fonts.fredoka,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2D7C7",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    fontFamily: Fonts.fredoka,
  },
  closeButton: {
    padding: 8,
    marginLeft: -8,
    fontFamily: Fonts.fredoka,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1B130D",
    fontFamily: Fonts.fredoka,
    flex: 1,
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

