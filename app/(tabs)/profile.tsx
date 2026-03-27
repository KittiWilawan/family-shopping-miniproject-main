import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  Share,
  Platform,
  useWindowDimensions,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/services/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

export default function ProfileScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const horizontalPadding = isLargeScreen ? 24 : 16;
  const pageStyle = {
    width: "100%" as const,
    maxWidth: isLargeScreen ? 920 : 680,
    alignSelf: "center" as const,
  };
  const { user, logout } = useAuth();
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  // Fetch membership
  const membershipQuery = useQuery({
    queryKey: ["familyMembership", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data: dbUser } = await supabase
        .from("users")
        .select("id")
        .eq("openId", user.id)
        .single();
      if (!dbUser) return null;

      const { data: member } = await supabase
        .from("familyMembers")
        .select("*, families(*)")
        .eq("userId", dbUser.id)
        .maybeSingle();

      if (!member) return null;
      return { member, family: member.families };
    },
    enabled: !!user,
  });

  // Fetch members
  const membersQuery = useQuery({
    queryKey: ["familyMembers", membershipQuery.data?.family?.id],
    queryFn: async () => {
      const familyId = membershipQuery.data?.family?.id;
      if (!familyId) return [];
      const { data, error } = await supabase
        .from("familyMembers")
        .select("*, users(id, name, email, openId)")
        .eq("familyId", familyId);
        
      if (error) throw error;
      return (data || []).map((m: any) => ({
        ...m,
        userName: m.users?.name,
        userEmail: m.users?.email,
        openId: m.users?.openId,
      }));
    },
    enabled: !!membershipQuery.data?.family?.id,
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("ไม่ได้ล็อกอิน");
      const { data: dbUser } = await supabase.from("users").select("id").eq("openId", user.id).single();
      if (!dbUser) throw new Error("ไม่พบข้อมูล");
      
      const familyId = membershipQuery.data?.family?.id;
      if (!familyId) throw new Error("ไม่มีข้อมูลครอบครัว");

      const { error } = await supabase
        .from("familyMembers")
        .delete()
        .eq("userId", dbUser.id)
        .eq("familyId", familyId);

      if (error) throw error;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["familyMembership"] });
      queryClient.invalidateQueries({ queryKey: ["familyMembers"] });
      queryClient.invalidateQueries(); // invalidate all other cached queries as well
    },
    onError: (e) => Alert.alert("เกิดข้อผิดพลาด", e.message),
  });

  const familyCode = membershipQuery.data?.family?.code;
  const familyName = membershipQuery.data?.family?.name;
  const isOwner = membershipQuery.data?.member?.memberRole === "owner";

  const handleCopyCode = async () => {
    if (!familyCode) return;
    await Clipboard.setStringAsync(familyCode);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareCode = async () => {
    if (!familyCode) return;
    try {
      await Share.share({
        message: `เข้าร่วมครอบครัว "${familyName}" ในแอป Family Shopping ด้วยรหัส: ${familyCode}`,
        title: "รหัสครอบครัว Family Shopping",
      });
    } catch (e) {
      // User cancelled
    }
  };

  const handleLeave = () => {
    const msg = isOwner
      ? "คุณเป็นเจ้าของครอบครัว การออกจะทำให้ครอบครัวถูกลบ ต้องการดำเนินการต่อ?"
      : `ต้องการออกจากครอบครัว "${familyName}"?`;

    if (Platform.OS === "web") {
      if (window.confirm(msg)) leaveMutation.mutate();
    } else {
      Alert.alert("ออกจากครอบครัว", msg, [
        { text: "ยกเลิก", style: "cancel" },
        { text: "ออก", style: "destructive", onPress: () => leaveMutation.mutate() },
      ]);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      if (window.confirm("ต้องการออกจากระบบ?")) logout();
    } else {
      Alert.alert("ออกจากระบบ", "ต้องการออกจากระบบ?", [
        { text: "ยกเลิก", style: "cancel" },
        { text: "ออก", style: "destructive", onPress: () => logout() },
      ]);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (name: string | null) => {
    const colors = ["#4CAF82", "#4285F4", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];
    if (!name) return colors[0];
    const idx = name.charCodeAt(0) % colors.length;
    return colors[idx];
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: horizontalPadding }]}
      >
        <View style={pageStyle}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>โปรไฟล์</Text>
        </View>

        {/* User Card */}
        <View style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: getAvatarColor(user?.user_metadata?.name || user?.email || null) }]}>
            <Text style={styles.avatarText}>{getInitials(user?.user_metadata?.name || user?.email || null)}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.foreground }]}>
              {user?.user_metadata?.name || "ผู้ใช้"}
            </Text>
            <Text style={[styles.userEmail, { color: colors.muted }]}>
              {user?.email ?? ""}
            </Text>
            <View style={[styles.loginBadge, { backgroundColor: "#4285F420" }]}>
              <Text style={styles.loginBadgeText}>Google Account</Text>
            </View>
          </View>
        </View>

        {/* Family Section */}
        {membershipQuery.isLoading ? (
          <ActivityIndicator color="#4CAF82" style={{ marginTop: 20 }} />
        ) : membershipQuery.data ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.muted }]}>ครอบครัว</Text>
            <View style={[styles.familyCard, { backgroundColor: "#4CAF8215", borderColor: "#4CAF8230" }]}>
              <View style={styles.familyHeader}>
                <View style={[styles.familyIcon, { backgroundColor: "#4CAF8230" }]}>
                  <IconSymbol name="house.fill" size={24} color="#4CAF82" />
                </View>
                <View style={styles.familyInfo}>
                  <Text style={[styles.familyName, { color: "#1A2B21" }]}>{familyName}</Text>
                  <Text style={[styles.familyRole, { color: "#4CAF82" }]}>
                    {isOwner ? "👑 เจ้าของ" : "👤 สมาชิก"}
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.codeButton, { opacity: pressed ? 0.8 : 1 }]}
                  onPress={() => setShowCodeModal(true)}
                >
                  <IconSymbol name="key.fill" size={16} color="#4CAF82" />
                  <Text style={styles.codeButtonText}>รหัส</Text>
                </Pressable>
              </View>
            </View>

            {/* Members */}
            <Text style={[styles.sectionTitle, { color: colors.muted }]}>สมาชิก ({membersQuery.data?.length ?? 0})</Text>
            <View style={[styles.membersCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {membersQuery.isLoading ? (
                <ActivityIndicator color="#4CAF82" />
              ) : (
                membersQuery.data?.map((member, index) => (
                  <View
                    key={member.userId}
                    style={[
                      styles.memberRow,
                      index < (membersQuery.data?.length ?? 0) - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.border },
                    ]}
                  >
                    <View style={[styles.memberAvatar, { backgroundColor: getAvatarColor(member.userName ?? null) }]}>
                      <Text style={styles.memberAvatarText}>
                        {getInitials(member.userName ?? null)}
                      </Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={[styles.memberName, { color: colors.foreground }]}>
                        {member.userName ?? "ผู้ใช้"}
                        {member.openId === user?.id ? " (คุณ)" : ""}
                      </Text>
                      <Text style={[styles.memberEmail, { color: colors.muted }]}>
                        {member.userEmail ?? ""}
                      </Text>
                    </View>
                    {member.memberRole === "owner" && (
                      <View style={[styles.ownerBadge, { backgroundColor: "#F59E0B20" }]}>
                        <Text style={styles.ownerBadgeText}>👑 เจ้าของ</Text>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>

            {/* Leave Family */}
            <Pressable
              style={({ pressed }) => [
                styles.dangerButton,
                { borderColor: "#EF4444", opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={handleLeave}
              disabled={leaveMutation.isPending}
            >
              {leaveMutation.isPending ? (
                <ActivityIndicator color="#EF4444" size="small" />
              ) : (
                <>
                  <IconSymbol name="person.fill.xmark" size={18} color="#EF4444" />
                  <Text style={styles.dangerButtonText}>ออกจากครอบครัว</Text>
                </>
              )}
            </Pressable>
          </>
        ) : (
          <View style={[styles.noFamilyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.noFamilyEmoji}>👨‍👩‍👧‍👦</Text>
            <Text style={[styles.noFamilyTitle, { color: colors.foreground }]}>ยังไม่ได้เข้าร่วมครอบครัว</Text>
            <Text style={[styles.noFamilySubtitle, { color: colors.muted }]}>
              ไปที่หน้าตั้งค่าครอบครัวเพื่อสร้างหรือเข้าร่วม
            </Text>
          </View>
        )}

        {/* Logout */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>บัญชี</Text>
        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handleLogout}
        >
          <IconSymbol name="arrow.right.square.fill" size={20} color="#EF4444" />
          <Text style={[styles.logoutText, { color: "#EF4444" }]}>ออกจากระบบ</Text>
        </Pressable>

        <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Family Code Modal */}
      <Modal visible={showCodeModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.codeModal, { backgroundColor: colors.background, maxWidth: Math.min(width - 16, 560) }]}>
            <View style={styles.codeModalHeader}>
              <Text style={[styles.codeModalTitle, { color: colors.foreground }]}>รหัสครอบครัว</Text>
              <Pressable onPress={() => setShowCodeModal(false)}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
              </Pressable>
            </View>

            <Text style={[styles.codeModalSubtitle, { color: colors.muted }]}>
              {familyName}
            </Text>

            <View style={[styles.codeDisplay, { backgroundColor: "#4CAF8215", borderColor: "#4CAF8230" }]}>
              <Text style={styles.codeDisplayText}>{familyCode}</Text>
            </View>

            <Text style={[styles.codeHint, { color: colors.muted }]}>
              แชร์รหัสนี้ให้สมาชิกในครอบครัวเพื่อเข้าร่วม
            </Text>

            <View style={styles.codeActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.codeActionBtn,
                  { backgroundColor: copied ? "#4CAF82" : colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={handleCopyCode}
              >
                <IconSymbol name={copied ? "checkmark" : "doc.on.doc.fill"} size={18} color={copied ? "#FFFFFF" : colors.muted} />
                <Text style={[styles.codeActionText, { color: copied ? "#FFFFFF" : colors.muted }]}>
                  {copied ? "คัดลอกแล้ว!" : "คัดลอก"}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.codeActionBtn,
                  { backgroundColor: "#4CAF82", opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={handleShareCode}
              >
                <IconSymbol name="square.and.arrow.up" size={18} color="#FFFFFF" />
                <Text style={[styles.codeActionText, { color: "#FFFFFF" }]}>แชร์</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
  },
  userEmail: {
    fontSize: 13,
  },
  loginBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  loginBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4285F4",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  familyCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  familyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  familyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  familyInfo: {
    flex: 1,
    gap: 2,
  },
  familyName: {
    fontSize: 17,
    fontWeight: "700",
  },
  familyRole: {
    fontSize: 13,
    fontWeight: "600",
  },
  codeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#4CAF8230",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  codeButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4CAF82",
  },
  membersCard: {
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: "700",
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
  },
  memberEmail: {
    fontSize: 12,
  },
  ownerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ownerBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#F59E0B",
  },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 24,
  },
  dangerButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#EF4444",
  },
  noFamilyCard: {
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  noFamilyEmoji: {
    fontSize: 48,
  },
  noFamilyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  noFamilySubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600",
  },
  // Code Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  codeModal: {
    width: "100%",
    borderRadius: 28,
    padding: 28,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  codeModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  codeModalTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  codeModalSubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  codeDisplay: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
  },
  codeDisplayText: {
    fontSize: 48,
    fontWeight: "800",
    color: "#4CAF82",
    letterSpacing: 10,
  },
  codeHint: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  codeActions: {
    flexDirection: "row",
    gap: 12,
  },
  codeActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  codeActionText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
