import Ionicons from "@expo/vector-icons/Ionicons";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  Image as RNImage,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { notifyError } from "@/lib/feedback";
import { setSelectedTattoo } from "@/lib/selected-tattoo";

type TattooStyle = {
  id: number;
  src: string | number;
  name: string;
};

type TattooSection = {
  title: string;
  subtitle: string;
  data: TattooStyle[][];
};

const remoteData: TattooStyle[] = [
  {
    id: 1,
    src: "https://cdn.tattoo.ai/assets/egyptian_mythological_ac4d37214d/egyptian_mythological_ac4d37214d.png",
    name: "Egyptian Mythological",
  },
  {
    id: 2,
    src: "https://cdn.tattoo.ai/assets/Paganic_style_423f0e12d8/Paganic_style_423f0e12d8.png",
    name: "Paganic Style",
  },
  {
    id: 3,
    src: "https://cdn.tattoo.ai/assets/glitch_style_2c30a8d7f5/glitch_style_2c30a8d7f5.png",
    name: "Glitch Style",
  },
  {
    id: 4,
    src: "https://cdn.tattoo.ai/assets/egyptian_mythological_ac4d37214d/egyptian_mythological_ac4d37214d.png",
    name: "Egyptian Mythological",
  },
];

const localData: TattooStyle[] = [
  {
    id: 14,
    src: require("@/assets/images/myTattoos/basmala.png"),
    name: "Basmala",
  },
  {
    id: 15,
    src: require("@/assets/images/myTattoos/beautynbeast.png"),
    name: "Beauty N Beast",
  },
  {
    id: 16,
    src: require("@/assets/images/myTattoos/dancingskull.png"),
    name: "Dancing Skull",
  },
  {
    id: 17,
    src: require("@/assets/images/myTattoos/dragon.png"),
    name: "Dragon",
  },
  {
    id: 18,
    src: require("@/assets/images/myTattoos/dragon1.png"),
    name: "Dragon Alt",
  },
  {
    id: 19,
    src: require("@/assets/images/myTattoos/dragonhead.png"),
    name: "Dragon Head",
  },
  {
    id: 20,
    src: require("@/assets/images/myTattoos/flower.png"),
    name: "Flower",
  },
  {
    id: 21,
    src: require("@/assets/images/myTattoos/ganesha.png"),
    name: "Ganesha",
  },
  {
    id: 22,
    src: require("@/assets/images/myTattoos/heart.png"),
    name: "Heart",
  },
  {
    id: 23,
    src: require("@/assets/images/myTattoos/islamCaligraphy.png"),
    name: "Islam Calligraphy",
  },
  {
    id: 24,
    src: require("@/assets/images/myTattoos/mickey.png"),
    name: "Mickey",
  },
  {
    id: 25,
    src: require("@/assets/images/myTattoos/newskull.png"),
    name: "New Skull",
  },
  {
    id: 26,
    src: require("@/assets/images/myTattoos/om.png"),
    name: "Om",
  },
  {
    id: 27,
    src: require("@/assets/images/myTattoos/om1.png"),
    name: "Om Alt",
  },
  {
    id: 28,
    src: require("@/assets/images/myTattoos/owl.png"),
    name: "Owl",
  },
  {
    id: 29,
    src: require("@/assets/images/myTattoos/peacock.png"),
    name: "Peacock",
  },
  {
    id: 30,
    src: require("@/assets/images/myTattoos/samurai.png"),
    name: "Samurai",
  },
  {
    id: 31,
    src: require("@/assets/images/myTattoos/shiv.png"),
    name: "Shiv",
  },
  {
    id: 32,
    src: require("@/assets/images/myTattoos/skull.png"),
    name: "Skull",
  },
  {
    id: 33,
    src: require("@/assets/images/myTattoos/skull1.png"),
    name: "Skull Alt",
  },
  {
    id: 34,
    src: require("@/assets/images/myTattoos/skullgroup.png"),
    name: "Skull Group",
  },
  {
    id: 35,
    src: require("@/assets/images/myTattoos/skullsnake.png"),
    name: "Skull Snake",
  },
  {
    id: 36,
    src: require("@/assets/images/myTattoos/trident.png"),
    name: "Trident",
  },
  {
    id: 37,
    src: require("@/assets/images/myTattoos/trishul.png"),
    name: "Trishul",
  },
];

function getTattoo(names: string[]) {
  return localData.filter((item) => names.includes(item.name));
}

function chunkRows(items: TattooStyle[], size = 2) {
  const rows: TattooStyle[][] = [];

  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }

  return rows;
}

const sections: TattooSection[] = [
  {
    title: "Featured",
    subtitle: "Your original remote presets and quick try-on styles.",
    data: chunkRows(remoteData),
  },
  {
    title: "Sacred",
    subtitle: "Spiritual symbols, calligraphy, and devotional designs.",
    data: chunkRows(
      getTattoo([
        "Basmala",
        "Ganesha",
        "Islam Calligraphy",
        "Om",
        "Om Alt",
        "Shiv",
        "Trident",
        "Trishul",
      ]),
    ),
  },
  {
    title: "Creatures",
    subtitle: "Dragons, owls, peacocks, and nature-led tattoo art.",
    data: chunkRows(
      getTattoo([
        "Dragon",
        "Dragon Alt",
        "Dragon Head",
        "Flower",
        "Owl",
        "Peacock",
      ]),
    ),
  },
  {
    title: "Skulls",
    subtitle: "Dark art presets, grouped skulls, and sharper statement pieces.",
    data: chunkRows(
      getTattoo([
        "Dancing Skull",
        "New Skull",
        "Skull",
        "Skull Alt",
        "Skull Group",
        "Skull Snake",
      ]),
    ),
  },
  {
    title: "Characters",
    subtitle: "Story-driven and illustrative tattoos with more personality.",
    data: chunkRows(getTattoo(["Beauty N Beast", "Heart", "Mickey", "Samurai"])),
  },
];

function TattooCard({
  item,
  onPress,
}: {
  item: TattooStyle;
  onPress: (item: TattooStyle) => void;
}) {
  const [hasError, setHasError] = useState(false);
  const isRemote = typeof item.src === "string";

  const handlePress = async () => {
    if (hasError && isRemote) {
      await notifyError("This remote tattoo image is unavailable.", "Image unavailable");
      return;
    }

    onPress(item);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        { opacity: pressed || (hasError && isRemote) ? 0.8 : 1 },
      ]}>
      <View style={styles.imageFrame}>
        {hasError ? (
          <View style={styles.imageFallback}>
            <Ionicons name="cloud-offline-outline" size={22} color="#8D7258" />
            <Text style={styles.imageFallbackText}>Image unavailable</Text>
          </View>
        ) : isRemote ? (
          <ExpoImage
            source={{ uri: item.src }}
            style={styles.image}
            contentFit="contain"
            cachePolicy="memory-disk"
            recyclingKey={`${item.id}`}
            transition={100}
            onError={() => setHasError(true)}
          />
        ) : (
          <RNImage
            source={item.src}
            style={styles.image}
            resizeMode="contain"
            fadeDuration={0}
            onError={() => setHasError(true)}
          />
        )}
      </View>
      <Text style={styles.label}>{item.name}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();

  const openTattooPreview = (item: TattooStyle) => {
    const tattooUri =
      typeof item.src === "string"
        ? item.src
        : RNImage.resolveAssetSource(item.src).uri;

    setSelectedTattoo(tattooUri, item.name);
    router.push({
      pathname: "/camera-preview",
      params: {
        tattooName: item.name,
      },
    });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(item, index) =>
          item.map((tattoo) => tattoo.id).join("-") + `-${index}`
        }
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.hero}>
            <Text style={styles.kicker}>Tattoo Library</Text>
            <Text style={styles.title}>Pick a preset tattoo to try on live.</Text>
            <Text style={styles.subtitle}>
              Browse curated sections, tap any design, and preview it directly on
              the camera.
            </Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
          </View>
        )}
        renderItem={({ item: row }) => (
          <View style={styles.row}>
            {row.map((item) => (
              <TattooCard key={item.id} item={item} onPress={openTattooPreview} />
            ))}
            {row.length === 1 ? <View style={styles.cardSpacer} /> : null}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F1E8",
  },
  hero: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 6,
  },
  kicker: {
    color: "#7D5731",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    color: "#22160D",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700",
  },
  subtitle: {
    color: "#5E5348",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 24,
  },
  sectionHeader: {
    marginTop: 22,
    marginBottom: 12,
    gap: 3,
  },
  sectionTitle: {
    color: "#23170F",
    fontSize: 21,
    fontWeight: "700",
  },
  sectionSubtitle: {
    color: "#6B5D50",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  row: {
    justifyContent: "space-between",
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#20160D",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  cardSpacer: {
    flex: 1,
  },
  imageFrame: {
    width: "100%",
    height: 210,
    padding: 10,
    backgroundColor: "#F2E7D9",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageFallback: {
    flex: 1,
    width: "100%",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#E8D6C4",
    paddingHorizontal: 16,
  },
  imageFallbackText: {
    color: "#7D634B",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    fontWeight: "500",
  },
  label: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#24180F",
    fontSize: 14,
    fontWeight: "600",
  },
});
