import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.info}>
        This app is based on the 60:1 Formulas from AIS/202v3. (CAO:02 May 2025)
      </Text>

      <Link href="/ais-tools" asChild>
        <Pressable style={styles.linkButton}>
          <Text style={styles.linkText}>Go to AIS Tools</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#808080",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  info: {
    fontSize: 14,
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
  },
  linkButton: {
    backgroundColor: "#314785",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  linkText: {
    color: "white",
    fontWeight: "700",
  },
});
