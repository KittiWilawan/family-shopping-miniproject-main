import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/hooks/use-auth";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";

type Mode = "choose" | "create" | "join";

export default function FamilySetupScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const contentWidth = Math.min(width - 24, isLargeScreen ? 680 : 520);
  const [mode, setMode] = useState<Mode>("choose");
  const [familyName, setFamilyName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const getDbUser = async () => {
    if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
    const { data: dbUser, error } = await supabase
      .from("users")
      .select("id")
      .eq("openId", user.id)
      .single();
    if (error || !dbUser) throw new Error("ไม่พบข้อมูลผู้ใช้");
    return dbUser;
  };

  const createMutation = useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const dbUser = await getDbUser();

      // Generate random 6-digit code
      let code = "";
      let exists = true;
      while (exists) {
        code = Math.floor(100000 + Math.random() * 900000).toString();
        const { count } = await supabase
          .from("families")
          .select("id", { count: "exact", head: true })
          .eq("code", code);
        exists = (count ?? 0) > 0;
      }

      // Create Family
      const { data: newFamily, error: familyError } = await supabase
        .from("families")
        .insert({ name, code, createdById: dbUser.id })
        .select("id")
        .single();

      if (familyError || !newFamily) throw new Error(familyError?.message || "สร้างครอบครัวไม่สำเร็จ");

      // Add to members
      const { error: memberError } = await supabase
        .from("familyMembers")
        .insert({
          familyId: newFamily.id,
          userId: dbUser.id,
          memberRole: "owner",
        });

      if (memberError) throw new Error(memberError.message);

      return { code };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCreatedCode(data.code);
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("เกิดข้อผิดพลาด", error.message);
    },
  });

  const joinMutation = useMutation({
    mutationFn: async ({ code }: { code: string }) => {
      const dbUser = await getDbUser();

      // Find family by code
      const { data: family, error: findError } = await supabase
        .from("families")
        .select("id, name, code")
        .eq("code", code)
        .maybeSingle();

      if (findError || !family) throw new Error("ไม่พบรหัสครอบครัวนี้");

      // Join family
      const { error: joinError } = await supabase
        .from("familyMembers")
        .insert({
          familyId: family.id,
          userId: dbUser.id,
          memberRole: "member",
        });

      if (joinError) {
        if (joinError.code === "23505") throw new Error("คุณเป็นสมาชิกครอบครัวนี้อยู่แล้ว");
        throw new Error(joinError.message);
      }

      return family;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Wait a tiny bit and let layout handle the redirect when it refetches logic, 
      // or redirect explicitly to avoid looping
      router.replace("/(tabs)");
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("เกิดข้อผิดพลาด", error.message);
    },
  });

  const handleCreate = () => {
    if (!familyName.trim()) {
      Alert.alert("กรุณากรอกชื่อครอบครัว");
      return;
    }
    createMutation.mutate({ name: familyName.trim() });
  };

  const handleJoin = () => {
    if (joinCode.length !== 6) {
      Alert.alert("กรุณากรอกรหัส 6 หลัก");
      return;
    }
    joinMutation.mutate({ code: joinCode });
  };

  const handleCodeInput = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 6);
    setJoinCode(digits);
  };

  if (createdCode) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={["#E8F5EE", "#F8FAF9"]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[styles.successContainer, { width: "100%", maxWidth: contentWidth, alignSelf: "center" }]}>
          <View style={styles.successIcon}>
            <IconSymbol name="checkmark.circle.fill" size={64} color="#4CAF82" />
          </View>
          <Text style={styles.successTitle}>สร้างครอบครัวสำเร็จ!</Text>
          <Text style={styles.successSubtitle}>ชื่อครอบครัว: {familyName}</Text>

          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>รหัสครอบครัวของคุณ</Text>
            <Text style={styles.codeDisplay}>{createdCode}</Text>
            <Text style={styles.codeHint}>
              แชร์รหัสนี้ให้สมาชิกในครอบครัวเพื่อเข้าร่วม
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
            onPress={() => router.replace("/(tabs)")}
          >
            <Text style={styles.primaryButtonText}>เริ่มใช้งาน</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient
        colors={["#E8F5EE", "#F8FAF9"]}
        style={StyleSheet.absoluteFillObject}
      />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { width: "100%", maxWidth: contentWidth, alignSelf: "center" }]}
        keyboardShouldPersistTaps="handled"
      >

        {/* Header */}
        <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.header}>
          <View style={styles.headerIcon}>
            <IconSymbol name="person.2.fill" size={32} color="#4CAF82" />
          </View>
          <Text style={styles.headerTitle}>ตั้งค่าครอบครัว</Text>
          <Text style={styles.headerSubtitle}>
            สร้างครอบครัวใหม่หรือเข้าร่วมครอบครัวที่มีอยู่
          </Text>
        </Animated.View>

        {mode === "choose" && (
          <View style={styles.chooseContainer}>
            <Animated.View entering={FadeInDown.delay(100).duration(600).springify()}>
              <Pressable
                style={({ pressed }) => [
                  styles.choiceCard,
                  { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
                ]}
                onPress={() => setMode("create")}
              >
                <View style={[styles.choiceIconBg, { backgroundColor: "#4CAF8220" }]}>
                  <IconSymbol name="plus.circle.fill" size={32} color="#4CAF82" />
                </View>
                <View style={styles.choiceText}>
                  <Text style={styles.choiceTitle}>สร้างครอบครัวใหม่</Text>
                  <Text style={styles.choiceDesc}>เริ่มต้นสร้างครอบครัวและรับรหัส 6 หลัก</Text>
                </View>
                <IconSymbol name="chevron.right" size={20} color="#6B8C78" />
              </Pressable>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(600).springify()}>
              <Pressable
                style={({ pressed }) => [
                  styles.choiceCard,
                  { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
                ]}
                onPress={() => setMode("join")}
              >
                <View style={[styles.choiceIconBg, { backgroundColor: "#4285F420" }]}>
                  <IconSymbol name="key.fill" size={32} color="#4285F4" />
                </View>
                <View style={styles.choiceText}>
                  <Text style={styles.choiceTitle}>เข้าร่วมครอบครัว</Text>
                  <Text style={styles.choiceDesc}>กรอกรหัส 6 หลักที่ได้รับ</Text>
                </View>
                <IconSymbol name="chevron.right" size={20} color="#6B8C78" />
              </Pressable>
            </Animated.View>
          </View>
        )}

        {mode === "create" && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.formContainer}>
            <Pressable
              style={styles.backButton}
              onPress={() => setMode("choose")}
            >
              <IconSymbol name="chevron.left" size={20} color="#4CAF82" />
              <Text style={styles.backText}>กลับ</Text>
            </Pressable>

            <Text style={styles.formTitle}>สร้างครอบครัวใหม่</Text>
            <Text style={styles.formLabel}>ชื่อครอบครัว</Text>
            <TextInput
              style={styles.input}
              placeholder="เช่น ครอบครัวสมิธ"
              value={familyName}
              onChangeText={setFamilyName}
              returnKeyType="done"
              onSubmitEditing={handleCreate}
              autoFocus
            />

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                { opacity: pressed || createMutation.isPending ? 0.85 : 1 },
              ]}
              onPress={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>สร้างครอบครัว</Text>
              )}
            </Pressable>
          </Animated.View>
        )}

        {mode === "join" && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.formContainer}>
            <Pressable
              style={styles.backButton}
              onPress={() => setMode("choose")}
            >
              <IconSymbol name="chevron.left" size={20} color="#4CAF82" />
              <Text style={styles.backText}>กลับ</Text>
            </Pressable>

            <Text style={styles.formTitle}>เข้าร่วมครอบครัว</Text>
            <Text style={styles.formLabel}>รหัสครอบครัว 6 หลัก</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="000000"
              value={joinCode}
              onChangeText={handleCodeInput}
              keyboardType="numeric"
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={handleJoin}
              autoFocus
            />

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                { opacity: pressed || joinMutation.isPending ? 0.85 : 1 },
              ]}
              onPress={handleJoin}
              disabled={joinMutation.isPending}
            >
              {joinMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>เข้าร่วมครอบครัว</Text>
              )}
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAF9",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  logoutTopBtn: {
    position: "absolute",
    top: 40,
    right: 24,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#EF444415",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EF444430",
  },
  logoutTopBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#EF4444",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
    marginTop: 20,
    gap: 12,
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#4CAF8220",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A2B21",
  },
  headerSubtitle: {
    fontSize: 15,
    color: "#6B8C78",
    textAlign: "center",
    lineHeight: 22,
  },
  chooseContainer: {
    gap: 16,
  },
  choiceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  choiceIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceText: {
    flex: 1,
    gap: 4,
  },
  choiceTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A2B21",
  },
  choiceDesc: {
    fontSize: 13,
    color: "#6B8C78",
    lineHeight: 18,
  },
  formContainer: {
    gap: 16,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  backText: {
    fontSize: 16,
    color: "#4CAF82",
    fontWeight: "600",
  },
  formTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1A2B21",
    marginBottom: 8,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B8C78",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: "#1A2B21",
    borderWidth: 1.5,
    borderColor: "#D9EDE3",
  },
  codeInput: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 8,
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: "#4CAF82",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#4CAF82",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  successContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: "center",
    gap: 24,
  },
  successIcon: {
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A2B21",
  },
  successSubtitle: {
    fontSize: 16,
    color: "#6B8C78",
  },
  codeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  codeLabel: {
    fontSize: 14,
    color: "#6B8C78",
    fontWeight: "600",
  },
  codeDisplay: {
    fontSize: 48,
    fontWeight: "800",
    color: "#4CAF82",
    letterSpacing: 8,
  },
  codeHint: {
    fontSize: 13,
    color: "#6B8C78",
    textAlign: "center",
    lineHeight: 18,
  },
});
