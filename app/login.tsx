import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { startOAuthLogin } from "@/constants/oauth";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await startOAuthLogin();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <LinearGradient
        colors={["#E8F5EE", "#F8FAF9", "#FFFFFF"]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Top decorative circles */}
      <View style={[styles.circle1, { backgroundColor: "#4CAF8220" }]} />
      <View style={[styles.circle2, { backgroundColor: "#4CAF8215" }]} />

      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={{ uri: "https://d2xsxph8kpxj0f.cloudfront.net/310519663484252968/R7asQb2tUXyPUCt3vrsXwK/icon_4bcd15d0.png" }}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={[styles.appName, { color: "#1A2B21" }]}>Family Shopping</Text>
          <Text style={[styles.tagline, { color: "#6B8C78" }]}>
            จัดการการซื้อของครอบครัว{"\n"}อย่างชาญฉลาด
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          {[
            { icon: "cart.fill", text: "บันทึกรายการซื้อของ" },
            { icon: "chart.line.uptrend.xyaxis", text: "เปรียบเทียบราคา" },
            { icon: "person.2.fill", text: "ใช้งานร่วมกันในครอบครัว" },
          ].map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: "#4CAF8220" }]}>
                <IconSymbol name={feature.icon as any} size={18} color="#4CAF82" />
              </View>
              <Text style={[styles.featureText, { color: "#1A2B21" }]}>{feature.text}</Text>
            </View>
          ))}
        </View>

        {/* Login Button */}
        <View style={styles.buttonsContainer}>
          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={({ pressed }) => [
              styles.googleButton,
              { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <View style={styles.googleIconContainer}>
              <Text style={styles.googleIcon}>G</Text>
            </View>
            {loading ? (
              <ActivityIndicator color="#1A2B21" size="small" />
            ) : (
              <Text style={styles.googleButtonText}>เข้าสู่ระบบด้วย Google</Text>
            )}
          </Pressable>

          <Text style={[styles.termsText, { color: "#6B8C78" }]}>
            การเข้าสู่ระบบถือว่าคุณยอมรับเงื่อนไขการใช้งาน
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAF9",
  },
  circle1: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    top: -80,
    right: -80,
  },
  circle2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    bottom: 100,
    left: -60,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: "space-between",
  },
  logoContainer: {
    alignItems: "center",
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 24,
  },
  titleContainer: {
    alignItems: "center",
    gap: 8,
  },
  appName: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  featuresContainer: {
    gap: 16,
    paddingHorizontal: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 15,
    fontWeight: "500",
  },
  buttonsContainer: {
    gap: 16,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  googleIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#4285F4",
    alignItems: "center",
    justifyContent: "center",
  },
  googleIcon: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A2B21",
  },
  termsText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
