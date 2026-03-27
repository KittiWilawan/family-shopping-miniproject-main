import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { CATEGORY_LABELS, CATEGORY_ICONS, UNIT_OPTIONS, type ItemCategory, type ItemPeriod } from "@/shared/types";
import * as Haptics from "expo-haptics";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type FilterStatus = "all" | "pending" | "bought";

const CATEGORIES: ItemCategory[] = [
  "vegetables", "fruits", "meat", "seafood", "dairy",
  "bakery", "beverages", "snacks", "cleaning", "personal_care", "household", "other"
];

interface AddItemForm {
  name: string;
  category: ItemCategory;
  quantity: string;
  unit: string;
  estimatedPrice: string;
  notes: string;
  period: ItemPeriod;
}

const defaultForm: AddItemForm = {
  name: "",
  category: "other",
  quantity: "1",
  unit: "ชิ้น",
  estimatedPrice: "",
  notes: "",
  period: "weekly",
};

export default function HomeScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const pageMaxWidth = isLargeScreen ? 920 : 680;
  const pageStyle = { width: "100%" as const, maxWidth: pageMaxWidth, alignSelf: "center" as const };
  const horizontalPadding = isLargeScreen ? 24 : 16;
  const modalWidth = Math.min(width - 24, 560);
  
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterPeriod, setFilterPeriod] = useState<ItemPeriod | undefined>(undefined);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [markingItem, setMarkingItem] = useState<any>(null);
  const [actualPriceInput, setActualPriceInput] = useState("");
  const [form, setForm] = useState<AddItemForm>(defaultForm);
  const [editForm, setEditForm] = useState<AddItemForm>(defaultForm);

  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch membership
  const membershipQuery = useQuery({
    queryKey: ["familyMembership", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data: dbUser } = await supabase.from("users").select("id").eq("openId", user.id).single();
      if (!dbUser) return null;

      const { data: member } = await supabase
        .from("familyMembers")
        .select("*, families(*)")
        .eq("userId", dbUser.id)
        .maybeSingle();

      if (!member) return null;
      return { member, family: member.families, dbUser };
    },
    enabled: !!user,
  });

  const familyId = membershipQuery.data?.family?.id;
  const dbUserId = membershipQuery.data?.dbUser?.id;

  // Fetch Items
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["shoppingItems", familyId, filterPeriod],
    queryFn: async () => {
      if (!familyId) return [];
      let query = supabase
        .from("shoppingItems")
        .select("*")
        .eq("familyId", familyId)
        .order("isBought", { ascending: true })
        .order("createdAt", { ascending: false });

      if (filterPeriod) {
        query = query.eq("period", filterPeriod);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!familyId,
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: async (newItem: any) => {
      if (!familyId || !dbUserId) throw new Error("ไม่พบข้อมูลครอบครัว");
      const { error } = await supabase.from("shoppingItems").insert({
        ...newItem,
        familyId,
        createdById: dbUserId,
        isBought: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["shoppingItems"] });
      setShowAddModal(false);
      setForm(defaultForm);
    },
    onError: (e) => Alert.alert("เกิดข้อผิดพลาด", e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (updatedItem: any) => {
      const { id, ...updates } = updatedItem;
      const { error } = await supabase.from("shoppingItems").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["shoppingItems"] });
      setShowEditModal(false);
      setEditingItem(null);
    },
    onError: (e) => Alert.alert("เกิดข้อผิดพลาด", e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const { error } = await supabase.from("shoppingItems").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["shoppingItems"] });
    },
    onError: (e) => Alert.alert("เกิดข้อผิดพลาด", e.message),
  });

  const markBoughtMutation = useMutation({
    mutationFn: async ({ id, actualPrice }: { id: number; actualPrice?: number }) => {
      if (!familyId || !dbUserId) throw new Error("ไม่พบข้อมูลครอบครัว");
      
      const itemToUpdate = items.find(i => i.id === id);
      if (!itemToUpdate) throw new Error("ไม่พบสินค้านี้");

      const priceToRecord = actualPrice ?? itemToUpdate.estimatedPrice ?? 0;

      const { error: updateError } = await supabase.from("shoppingItems").update({
        isBought: true,
        boughtAt: new Date().toISOString(),
        boughtById: dbUserId,
        actualPrice: actualPrice,
      }).eq("id", id);
      if (updateError) throw updateError;

      const { error: historyError } = await supabase.from("purchaseHistory").insert({
        familyId,
        itemName: itemToUpdate.name,
        category: itemToUpdate.category,
        quantity: itemToUpdate.quantity,
        unit: itemToUpdate.unit,
        price: priceToRecord,
        purchasedById: dbUserId,
        shoppingItemId: id,
      });
      if (historyError) throw historyError;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["shoppingItems"] });
      queryClient.invalidateQueries({ queryKey: ["purchaseHistory"] });
      setShowPriceModal(false);
      setMarkingItem(null);
      setActualPriceInput("");
    },
    onError: (e) => Alert.alert("เกิดข้อผิดพลาด", e.message),
  });

  const markUnboughtMutation = useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const { error } = await supabase.from("shoppingItems").update({
        isBought: false,
        boughtAt: null,
        boughtById: null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      queryClient.invalidateQueries({ queryKey: ["shoppingItems"] });
    },
    onError: (e) => Alert.alert("เกิดข้อผิดพลาด", e.message),
  });

  const filteredItems = items.filter((item) => {
    if (filterStatus === "pending") return !item.isBought;
    if (filterStatus === "bought") return item.isBought;
    return true;
  });

  const boughtCount = items.filter((i) => i.isBought).length;
  const totalCount = items.length;
  const estimatedTotal = items
    .filter((i) => !i.isBought && i.estimatedPrice)
    .reduce((sum, i) => sum + parseFloat(i.estimatedPrice ?? "0"), 0);

  const handleToggleBought = useCallback((item: any) => {
    if (item.isBought) {
      markUnboughtMutation.mutate({ id: item.id });
    } else {
      setMarkingItem(item);
      setActualPriceInput(item.estimatedPrice ? parseFloat(item.estimatedPrice).toString() : "");
      setShowPriceModal(true);
    }
  }, []);

  const handleDelete = useCallback((item: any) => {
    Alert.alert(
      "ลบรายการ",
      `ต้องการลบ "${item.name}" ออกจากรายการ?`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ลบ",
          style: "destructive",
          onPress: () => deleteMutation.mutate({ id: item.id }),
        },
      ]
    );
  }, []);

  const handleEdit = useCallback((item: any) => {
    setEditingItem(item);
    setEditForm({
      name: item.name,
      category: item.category,
      quantity: parseFloat(item.quantity).toString(),
      unit: item.unit,
      estimatedPrice: item.estimatedPrice ? parseFloat(item.estimatedPrice).toString() : "",
      notes: item.notes ?? "",
      period: item.period,
    });
    setShowEditModal(true);
  }, []);

  const handleAddSubmit = () => {
    if (!form.name.trim()) { Alert.alert("กรุณากรอกชื่อสินค้า"); return; }
    createMutation.mutate({
      name: form.name.trim(),
      category: form.category,
      quantity: parseFloat(form.quantity) || 1,
      unit: form.unit,
      estimatedPrice: form.estimatedPrice ? parseFloat(form.estimatedPrice) : null,
      notes: form.notes || null,
      period: form.period,
    });
  };

  const handleEditSubmit = () => {
    if (!editingItem) return;
    if (!editForm.name.trim()) { Alert.alert("กรุณากรอกชื่อสินค้า"); return; }
    updateMutation.mutate({
      id: editingItem.id,
      name: editForm.name.trim(),
      category: editForm.category,
      quantity: parseFloat(editForm.quantity) || 1,
      unit: editForm.unit,
      estimatedPrice: editForm.estimatedPrice ? parseFloat(editForm.estimatedPrice) : null,
      notes: editForm.notes || null,
      period: editForm.period,
    });
  };

  const handleMarkBought = () => {
    if (!markingItem) return;
    markBoughtMutation.mutate({
      id: markingItem.id,
      actualPrice: actualPriceInput ? parseFloat(actualPriceInput) : undefined,
    });
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable
        style={({ pressed }) => [styles.checkbox, { opacity: pressed ? 0.7 : 1 }]}
        onPress={() => handleToggleBought(item)}
      >
        <View style={[
          styles.checkboxInner,
          item.isBought
            ? { backgroundColor: "#4CAF82", borderColor: "#4CAF82" }
            : { backgroundColor: "transparent", borderColor: colors.border }
        ]}>
          {item.isBought && <IconSymbol name="checkmark" size={14} color="#FFFFFF" />}
        </View>
      </Pressable>

      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <Text style={[styles.itemEmoji]}>{CATEGORY_ICONS[item.category as ItemCategory]}</Text>
          <Text
            style={[
              styles.itemName,
              { color: colors.foreground },
              item.isBought && styles.itemNameBought,
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          {item.period === "monthly" && (
            <View style={[styles.periodBadge, { backgroundColor: "#4285F420" }]}>
              <Text style={styles.periodBadgeText}>เดือน</Text>
            </View>
          )}
        </View>

        <View style={styles.itemMeta}>
          <Text style={[styles.itemCategory, { color: colors.muted }]}>
            {CATEGORY_LABELS[item.category as ItemCategory]}
          </Text>
          <Text style={[styles.itemQty, { color: colors.muted }]}>
            {parseFloat(item.quantity)} {item.unit}
          </Text>
          {item.estimatedPrice && !item.isBought && (
            <Text style={[styles.itemPrice, { color: "#4CAF82" }]}>
              ~฿{parseFloat(item.estimatedPrice).toLocaleString()}
            </Text>
          )}
          {item.actualPrice && item.isBought && (
            <Text style={[styles.itemPrice, { color: "#4CAF82" }]}>
              ฿{parseFloat(item.actualPrice).toLocaleString()}
            </Text>
          )}
        </View>
        {item.notes ? (
          <Text style={[styles.itemNotes, { color: colors.muted }]} numberOfLines={1}>
            {item.notes}
          </Text>
        ) : null}
      </View>

      <View style={styles.itemActions}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
          onPress={() => handleEdit(item)}
        >
          <IconSymbol name="pencil" size={18} color={colors.muted} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
          onPress={() => handleDelete(item)}
        >
          <IconSymbol name="trash.fill" size={18} color="#EF4444" />
        </Pressable>
      </View>
    </View>
  );

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={pageStyle}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {membershipQuery.data?.family.name ?? "รายการซื้อของ"}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
            {boughtCount}/{totalCount} รายการ
            {estimatedTotal > 0 ? ` · ~฿${estimatedTotal.toLocaleString()}` : ""}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: "#4CAF82", opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] },
          ]}
          onPress={() => setShowAddModal(true)}
        >
          <IconSymbol name="plus" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterRow, { backgroundColor: colors.background }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {/* Status filters */}
          {(["all", "pending", "bought"] as FilterStatus[]).map((status) => (
            <Pressable
              key={status}
              style={[
                styles.filterChip,
                filterStatus === status
                  ? { backgroundColor: "#4CAF82" }
                  : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
              ]}
              onPress={() => setFilterStatus(status)}
            >
              <Text style={[
                styles.filterChipText,
                { color: filterStatus === status ? "#FFFFFF" : colors.muted },
              ]}>
                {status === "all" ? "ทั้งหมด" : status === "pending" ? "ยังไม่ซื้อ" : "ซื้อแล้ว"}
              </Text>
            </Pressable>
          ))}

          <View style={styles.filterDivider} />

          {/* Period filters */}
          {([undefined, "weekly", "monthly"] as (ItemPeriod | undefined)[]).map((period) => (
            <Pressable
              key={period ?? "all-period"}
              style={[
                styles.filterChip,
                filterPeriod === period
                  ? { backgroundColor: "#4285F4" }
                  : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
              ]}
              onPress={() => setFilterPeriod(period)}
            >
              <Text style={[
                styles.filterChipText,
                { color: filterPeriod === period ? "#FFFFFF" : colors.muted },
              ]}>
                {period === undefined ? "ทุกช่วง" : period === "weekly" ? "สัปดาห์" : "เดือน"}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      {isLoading || membershipQuery.isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#4CAF82" />
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>ยังไม่มีรายการ</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            กดปุ่ม + เพื่อเพิ่มรายการซื้อของ
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingHorizontal: horizontalPadding }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
      </View>

      {/* Add Item Modal */}
      <ItemFormModal
        visible={showAddModal}
        title="เพิ่มรายการ"
        form={form}
        setForm={setForm}
        onSubmit={handleAddSubmit}
        onClose={() => { setShowAddModal(false); setForm(defaultForm); }}
        loading={createMutation.isPending}
        colors={colors}
        maxModalWidth={Math.min(width - 16, 680)}
      />

      {/* Edit Item Modal */}
      <ItemFormModal
        visible={showEditModal}
        title="แก้ไขรายการ"
        form={editForm}
        setForm={setEditForm}
        onSubmit={handleEditSubmit}
        onClose={() => { setShowEditModal(false); setEditingItem(null); }}
        loading={updateMutation.isPending}
        colors={colors}
        maxModalWidth={Math.min(width - 16, 680)}
      />

      {/* Price Input Modal */}
      <Modal visible={showPriceModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.priceModal, { backgroundColor: colors.surface, width: modalWidth, alignSelf: "center" }]}>
            <Text style={[styles.priceModalTitle, { color: colors.foreground }]}>
              บันทึกราคาที่ซื้อ
            </Text>
            <Text style={[styles.priceModalSubtitle, { color: colors.muted }]}>
              {markingItem?.name}
            </Text>
            <TextInput
              style={[styles.priceInput, { color: colors.foreground, borderColor: colors.border }]}
              placeholder="ราคา (บาท)"
              value={actualPriceInput}
              onChangeText={setActualPriceInput}
              keyboardType="decimal-pad"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleMarkBought}
            />
            <Text style={[styles.priceHint, { color: colors.muted }]}>
              ข้ามได้ถ้าไม่ต้องการบันทึกราคา
            </Text>
            <View style={styles.priceModalButtons}>
              <Pressable
                style={[styles.priceModalBtn, { backgroundColor: colors.border }]}
                onPress={() => { setShowPriceModal(false); setMarkingItem(null); setActualPriceInput(""); }}
              >
                <Text style={{ color: colors.muted, fontWeight: "600" }}>ยกเลิก</Text>
              </Pressable>
              <Pressable
                style={[styles.priceModalBtn, { backgroundColor: "#4CAF82" }]}
                onPress={handleMarkBought}
                disabled={markBoughtMutation.isPending}
              >
                {markBoughtMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>ซื้อแล้ว ✓</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ===== Item Form Modal =====
function ItemFormModal({
  visible, title, form, setForm, onSubmit, onClose, loading, colors, maxModalWidth
}: {
  visible: boolean;
  title: string;
  form: AddItemForm;
  setForm: (f: AddItemForm) => void;
  onSubmit: () => void;
  onClose: () => void;
  loading: boolean;
  colors: any;
  maxModalWidth: number;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.formModal, { backgroundColor: colors.background, width: "100%", maxWidth: maxModalWidth, alignSelf: "center" }]}>
          {/* Modal Header */}
          <View style={styles.formModalHeader}>
            <Text style={[styles.formModalTitle, { color: colors.foreground }]}>{title}</Text>
            <Pressable onPress={onClose}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Name */}
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>ชื่อสินค้า *</Text>
            <TextInput
              style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
              placeholder="เช่น ข้าวสาร, นม, ผักกาด"
              value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })}
              returnKeyType="next"
            />

            {/* Category */}
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>หมวดหมู่</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  style={[
                    styles.categoryChip,
                    form.category === cat
                      ? { backgroundColor: "#4CAF82" }
                      : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                  ]}
                  onPress={() => setForm({ ...form, category: cat })}
                >
                  <Text style={styles.categoryChipEmoji}>{CATEGORY_ICONS[cat]}</Text>
                  <Text style={[styles.categoryChipText, { color: form.category === cat ? "#FFFFFF" : colors.muted }]}>
                    {CATEGORY_LABELS[cat]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Quantity & Unit */}
            <View style={styles.rowFields}>
              <View style={styles.halfField}>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>จำนวน</Text>
                <TextInput
                  style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                  placeholder="1"
                  value={form.quantity}
                  onChangeText={(v) => setForm({ ...form, quantity: v })}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.halfField}>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>หน่วย</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.unitRow}>
                    {UNIT_OPTIONS.slice(0, 6).map((unit) => (
                      <Pressable
                        key={unit}
                        style={[
                          styles.unitChip,
                          form.unit === unit
                            ? { backgroundColor: "#4CAF82" }
                            : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                        ]}
                        onPress={() => setForm({ ...form, unit })}
                      >
                        <Text style={[styles.unitChipText, { color: form.unit === unit ? "#FFFFFF" : colors.muted }]}>
                          {unit}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>

            {/* Estimated Price */}
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>ราคาโดยประมาณ (บาท)</Text>
            <TextInput
              style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
              placeholder="เช่น 45.50"
              value={form.estimatedPrice}
              onChangeText={(v) => setForm({ ...form, estimatedPrice: v })}
              keyboardType="decimal-pad"
            />

            {/* Period */}
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>ช่วงเวลา</Text>
            <View style={styles.periodRow}>
              {(["weekly", "monthly"] as ItemPeriod[]).map((period) => (
                <Pressable
                  key={period}
                  style={[
                    styles.periodChip,
                    form.period === period
                      ? { backgroundColor: "#4285F4" }
                      : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                  ]}
                  onPress={() => setForm({ ...form, period })}
                >
                  <Text style={[styles.periodChipText, { color: form.period === period ? "#FFFFFF" : colors.muted }]}>
                    {period === "weekly" ? "🗓 รายสัปดาห์" : "📅 รายเดือน"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Notes */}
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>หมายเหตุ</Text>
            <TextInput
              style={[styles.fieldInput, styles.notesInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
              placeholder="เพิ่มเติม..."
              value={form.notes}
              onChangeText={(v) => setForm({ ...form, notes: v })}
              multiline
              numberOfLines={2}
            />

            {/* Submit */}
            <Pressable
              style={[styles.submitButton, { opacity: loading ? 0.8 : 1 }]}
              onPress={onSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>{title}</Text>
              )}
            </Pressable>
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4CAF82",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  filterRow: {
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#D9EDE3",
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#D9EDE3",
    marginHorizontal: 4,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  checkbox: {
    marginRight: 12,
  },
  checkboxInner: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  itemContent: {
    flex: 1,
    gap: 4,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  itemEmoji: {
    fontSize: 16,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  itemNameBought: {
    textDecorationLine: "line-through",
    opacity: 0.5,
  },
  periodBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  periodBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#4285F4",
  },
  itemMeta: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  itemCategory: {
    fontSize: 12,
  },
  itemQty: {
    fontSize: 12,
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: "600",
  },
  itemNotes: {
    fontSize: 12,
    fontStyle: "italic",
  },
  itemActions: {
    flexDirection: "row",
    gap: 4,
    marginLeft: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 56,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  formModal: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: "90%",
  },
  formModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  formModalTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 12,
  },
  fieldInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1.5,
  },
  notesInput: {
    height: 72,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  categoryScroll: {
    marginBottom: 4,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    gap: 4,
  },
  categoryChipEmoji: {
    fontSize: 14,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  rowFields: {
    flexDirection: "row",
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  unitRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  unitChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  unitChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  periodRow: {
    flexDirection: "row",
    gap: 12,
  },
  periodChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  periodChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  submitButton: {
    backgroundColor: "#4CAF82",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
    shadowColor: "#4CAF82",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  // Price modal
  priceModal: {
    margin: 24,
    borderRadius: 24,
    padding: 28,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  priceModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  priceModalSubtitle: {
    fontSize: 15,
    textAlign: "center",
  },
  priceInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: "700",
    borderWidth: 1.5,
    textAlign: "center",
  },
  priceHint: {
    fontSize: 12,
    textAlign: "center",
  },
  priceModalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  priceModalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
