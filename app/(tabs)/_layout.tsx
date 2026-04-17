import { Redirect, Tabs } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
// import { SideMenu } from "@/components/side-menu";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { auth } from "@/firebase/firebaseConfig";
// import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  // const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [authUser, setAuthUser] = React.useState<User | null | undefined>(
    undefined,
  );
  // const [menuOpen, setMenuOpen] = useState(false);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
    });

    return unsubscribe;
  }, []);

  if (authUser === undefined) {
    return null;
  }

  if (!authUser) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "black",
          headerShown: false,
          // header: () => (
          //   <SafeAreaView
          //     edges={["top", "left", "right"]}
          //     style={styles.headerContainer}
          //   >
          //     <View style={styles.headerContent}>
          //       <Pressable
          //         onPress={() => setMenuOpen(true)}
          //         style={({ pressed }) => [
          //           styles.menuButton,
          //           { opacity: pressed ? 0.6 : 1 },
          //         ]}
          //       >
          //         <IconSymbol name="bars" size={24} color="#1B130D" />
          //       </Pressable>
          //     </View>
          //   </SafeAreaView>
          // ),
          tabBarButton: HapticTab,
          sceneStyle: {
            backgroundColor: "#F7F1E8",
            paddingTop: 0,
            marginTop: 0,
          },
          tabBarStyle: {
            backgroundColor: "#F7F1E8",
            borderTopColor: "#E2D7C7",
            marginTop: 0,
            paddingTop: 0,
            paddingBottom: insets.bottom || 16,
            height: 64 + (insets.bottom || 16),
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="square.grid.2x2.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="createTattooScreen"
          options={{
            title: "Create",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="sparkles" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="myTattoo"
          options={{
            title: "My Tattoos",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="bookmark.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="person.fill" color={color} />
            ),
          }}
        />
      </Tabs>

      {/* Side Menu - Commented out */}
      {/* <SideMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} /> */}
    </View>
  );
}

// const styles = StyleSheet.create({
//   headerContainer: {
//     backgroundColor: "#F7F1E8",
//     borderBottomWidth: 1,
//     borderBottomColor: "#E2D7C7",
//   },
//   headerContent: {
//     flexDirection: "row",
//     alignItems: "center",
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//   },
//   menuButton: {
//     padding: 8,
//     marginLeft: -8,
//   },
// });
