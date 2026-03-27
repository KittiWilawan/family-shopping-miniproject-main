import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { CATEGORY_LABELS, CATEGORY_ICONS, type ItemCategory } from "@/shared/types";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/services/supabase";
import { useQuery } from "@tanstack/react-query";

type ViewMode = "history" | "trends";

export default function HistoryScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const pageStyle = {
    width: "100%" as const,
    maxWidth: isLargeScreen ? 920 : 680,
    alignSelf: "center" as const,
  };
  const horizontalPadding = isLargeScreen ? 24 : 16;
  const [viewMode, setViewMode] = useState<ViewMode>("trends");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const { user } = useAuth();

  // Fetch membership to get familyId
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

  // History Query
  const historyQuery = useQuery({
    queryKey: ["purchaseHistory", familyId],
    queryFn: async () => {
      if (!familyId) return [];
      const { data, error } = await supabase
        .from("purchaseHistory")
        .select("*, users(name)")
        .eq("familyId", familyId)
        .order("purchasedAt", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        purchasedByName: item.users?.name,
      }));
    },
    enabled: !!familyId,
  });

  // Trends Query (calculated on client side from history)
  // Fetch all history for accurate trends if needed, but 500 should be enough for grouping
  const trendsQuery = useQuery({
    queryKey: ["purchaseTrends", familyId],
    queryFn: async () => {
      if (!familyId) return [];
      const { data, error } = await supabase
        .from("purchaseHistory")
        .select("*")
        .eq("familyId", familyId)
        .order("purchasedAt", { ascending: false })
        .limit(1000);

      if (error) throw error;

      // Group by itemName
      const grouped = new Map<string, any[]>();
      data.forEach(item => {
        const key = item.itemName;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(item);
      });

      const trends = Array.from(grouped.entries()).map(([itemName, items]) => {
        // Items are already sorted by purchasedAt DESC
        const latestPrice = parseFloat(items[0].price);
        const previousPrice = items.length > 1 ? parseFloat(items[1].price) : null;
        let trend = "new";
        let changePercent = null;

        if (previousPrice !== null) {
          if (latestPrice > previousPrice) {
            trend = "up";
            changePercent = ((latestPrice - previousPrice) / previousPrice) * 100;
          } else if (latestPrice < previousPrice) {
            trend = "down";
            changePercent = ((previousPrice - latestPrice) / previousPrice) * 100;
          } else {
            trend = "same";
            changePercent = 0;
          }
        }

        return {
          itemName,
          latestPrice,
          previousPrice,
          trend,
          changePercent,
          purchaseCount: items.length,
          lastPurchaseDate: items[0].purchasedAt,
        };
      });

      return trends.sort((a, b) => new Date(b.lastPurchaseDate).getTime() - new Date(a.lastPurchaseDate).getTime());
    },
    enabled: !!familyId,
  });

  // Price History specific to an item
  const priceHistoryQuery = useQuery({
    queryKey: ["priceHistory", familyId, selectedItem],
    queryFn: async () => {
      if (!familyId || !selectedItem) return [];
      const { data, error } = await supabase
        .from("purchaseHistory")
        .select("*, users(name)")
        .eq("familyId", familyId)
        .eq("itemName", selectedItem)
        .order("purchasedAt", { ascending: false });
        
      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        purchasedByName: item.users?.name,
      }));
    },
    enabled: !!familyId && !!selectedItem,
  });

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  };

  const formatPrice = (price: number) => `฿${price.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const getTrendColor = (trend: string) => {
    if (trend === "up") return "#EF4444";
    if (trend === "down") return "#4CAF82";
    if (trend === "same") return "#F59E0B";
    return "#6B8C78";
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "up") return "arrow.up.right";
    if (trend === "down") return "arrow.down.right";
    if (trend === "same") return "arrow.right";
    return "sparkle";
  };

  const getTrendLabel = (trend: string) => {
    if (trend === "up") return "ราคาขึ้น";
    if (trend === "down") return "ราคาลด";
    if (trend === "same") return "ราคาเท่าเดิม";
    return "ซื้อครั้งแรก";
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={pageStyle}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>ประวัติ & ราคา</Text>
      </View>

      {/* View Mode Toggle */}
      <View style={[styles.toggleRow, { backgroundColor: colors.surface, borderColor: colors.border, marginHorizontal: horizontalPadding }]}>
        <Pressable
          style={[
            styles.toggleBtn,
            viewMode === "trends" && { backgroundColor: "#4CAF82" },
          ]}
          onPress={() => setViewMode("trends")}
        >
          <IconSymbol name="chart.line.uptrend.xyaxis" size={16} color={viewMode === "trends" ? "#FFFFFF" : colors.muted} />
          <Text style={[styles.toggleBtnText, { color: viewMode === "trends" ? "#FFFFFF" : colors.muted }]}>
            เปรียบเทียบราคา
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.toggleBtn,
            viewMode === "history" && { backgroundColor: "#4285F4" },
          ]}
          onPress={() => setViewMode("history")}
        >
          <IconSymbol name="clock.fill" size={16} color={viewMode === "history" ? "#FFFFFF" : colors.muted} />
          <Text style={[styles.toggleBtnText, { color: viewMode === "history" ? "#FFFFFF" : colors.muted }]}>
            ประวัติการซื้อ
          </Text>
        </Pressable>
      </View>

      {/* ===== TRENDS VIEW ===== */}
      {viewMode === "trends" && (
        <>
          {trendsQuery.isLoading || membershipQuery.isLoading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color="#4CAF82" />
            </View>
          ) : !trendsQuery.data || trendsQuery.data.length === 0 ? (
            <View style={styles.centerContent}>
              <Text style={styles.emptyEmoji}>📊</Text>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>ยังไม่มีข้อมูลราคา</Text>
              <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                บันทึกราคาเมื่อซื้อของเพื่อเปรียบเทียบ
              </Text>
            </View>
          ) : (
            <FlatList
              data={trendsQuery.data}
              keyExtractor={(item) => item.itemName}
              contentContainerStyle={[styles.listContent, { paddingHorizontal: horizontalPadding }]}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              ListHeaderComponent={() => (
                <View style={[styles.summaryCard, { backgroundColor: "#4CAF8215", borderColor: "#4CAF8230" }]}>
                  <Text style={[styles.summaryTitle, { color: "#1A2B21" }]}>สรุปแนวโน้มราคา</Text>
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryNum}>
                        {trendsQuery.data.filter(t => t.trend === "up").length}
                      </Text>
                      <Text style={[styles.summaryLabel, { color: "#EF4444" }]}>ราคาขึ้น</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryNum}>
                        {trendsQuery.data.filter(t => t.trend === "down").length}
                      </Text>
                      <Text style={[styles.summaryLabel, { color: "#4CAF82" }]}>ราคาลด</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryNum}>
                        {trendsQuery.data.filter(t => t.trend === "same").length}
                      </Text>
                      <Text style={[styles.summaryLabel, { color: "#F59E0B" }]}>เท่าเดิม</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryNum}>
                        {trendsQuery.data.filter(t => t.trend === "new").length}
                      </Text>
                      <Text style={[styles.summaryLabel, { color: "#6B8C78" }]}>ใหม่</Text>
                    </View>
                  </View>
                </View>
              )}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.trendCard,
                    { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                  ]}
                  onPress={() => setSelectedItem(item.itemName)}
                >
                  <View style={styles.trendLeft}>
                    <View style={[styles.trendIconBg, { backgroundColor: getTrendColor(item.trend) + "20" }]}>
                      <IconSymbol
                        name={getTrendIcon(item.trend) as any}
                        size={20}
                        color={getTrendColor(item.trend)}
                      />
                    </View>
                    <View style={styles.trendInfo}>
                      <Text style={[styles.trendName, { color: colors.foreground }]} numberOfLines={1}>
                        {item.itemName}
                      </Text>
                      <Text style={[styles.trendMeta, { color: colors.muted }]}>
                        {getTrendLabel(item.trend)}
                        {item.purchaseCount > 1 ? ` · ${item.purchaseCount} ครั้ง` : ""}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.trendRight}>
                    <Text style={[styles.trendLatestPrice, { color: colors.foreground }]}>
                      {formatPrice(item.latestPrice)}
                    </Text>
                    {item.previousPrice !== null && item.changePercent !== null && (
                      <View style={styles.trendChangeRow}>
                        <Text style={[styles.trendChange, { color: getTrendColor(item.trend) }]}>
                          {item.trend === "up" ? "+" : item.trend === "down" ? "-" : ""}
                          {item.changePercent.toFixed(1)}%
                        </Text>
                        <Text style={[styles.trendPrev, { color: colors.muted }]}>
                          จาก {formatPrice(item.previousPrice)}
                        </Text>
                      </View>
                    )}
                    <IconSymbol name="chevron.right" size={14} color={colors.muted} />
                  </View>
                </Pressable>
              )}
            />
          )}
        </>
      )}

      {/* ===== HISTORY VIEW ===== */}
      {viewMode === "history" && (
        <>
          {historyQuery.isLoading || membershipQuery.isLoading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color="#4285F4" />
            </View>
          ) : !historyQuery.data || historyQuery.data.length === 0 ? (
            <View style={styles.centerContent}>
              <Text style={styles.emptyEmoji}>🧾</Text>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>ยังไม่มีประวัติ</Text>
              <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                ประวัติจะแสดงเมื่อคุณบันทึกราคาสินค้า
              </Text>
            </View>
          ) : (
            <FlatList
              data={historyQuery.data}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={[styles.listContent, { paddingHorizontal: horizontalPadding }]}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => (
                <View style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.historyLeft}>
                    <Text style={styles.historyEmoji}>
                      {CATEGORY_ICONS[item.category as ItemCategory] || "📦"}
                    </Text>
                    <View style={styles.historyInfo}>
                      <Text style={[styles.historyName, { color: colors.foreground }]} numberOfLines={1}>
                        {item.itemName}
                      </Text>
                      <Text style={[styles.historyMeta, { color: colors.muted }]}>
                        {CATEGORY_LABELS[item.category as ItemCategory] || "อื่นๆ"}
                        {" · "}{parseFloat(item.quantity)} {item.unit}
                      </Text>
                      <Text style={[styles.historyDate, { color: colors.muted }]}>
                        {formatDate(item.purchasedAt)}
                        {item.purchasedByName ? ` · ${item.purchasedByName}` : ""}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.historyPrice, { color: "#4CAF82" }]}>
                    {formatPrice(parseFloat(item.price))}
                  </Text>
                </View>
              )}
            />
          )}
        </>
      )}
      </View>

      {/* Price History Detail Modal */}
      <Modal
        visible={!!selectedItem}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.detailModal, { backgroundColor: colors.background, width: "100%", maxWidth: Math.min(width - 16, 720), alignSelf: "center" }]}>
            {/* Header */}
            <View style={styles.detailHeader}>
              <Text style={[styles.detailTitle, { color: colors.foreground }]} numberOfLines={1}>
                {selectedItem}
              </Text>
              <Pressable onPress={() => setSelectedItem(null)}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
              </Pressable>
            </View>

            {priceHistoryQuery.isLoading ? (
              <ActivityIndicator size="large" color="#4CAF82" style={{ marginTop: 40 }} />
            ) : !priceHistoryQuery.data || priceHistoryQuery.data.length === 0 ? (
              <View style={styles.centerContent}>
                <Text style={[styles.emptySubtitle, { color: colors.muted }]}>ไม่มีข้อมูลราคา</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Price chart visualization */}
                <View style={[styles.chartContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.chartTitle, { color: colors.muted }]}>แนวโน้มราคา</Text>
                  <PriceChart data={priceHistoryQuery.data} colors={colors} />
                </View>

                {/* History list */}
                <Text style={[styles.detailSectionTitle, { color: colors.muted }]}>ประวัติทั้งหมด</Text>
                {priceHistoryQuery.data.map((record, index) => {
                  const prevRecord = priceHistoryQuery.data[index + 1];
                  const price = parseFloat(record.price);
                  const prevPrice = prevRecord ? parseFloat(prevRecord.price) : null;
                  const diff = prevPrice !== null ? price - prevPrice : null;

                  return (
                    <View
                      key={record.id}
                      style={[styles.priceRecord, { borderColor: colors.border }]}
                    >
                      <View style={styles.priceRecordLeft}>
                        <Text style={[styles.priceRecordDate, { color: colors.foreground }]}>
                          {formatDate(record.purchasedAt)}
                        </Text>
                        <Text style={[styles.priceRecordMeta, { color: colors.muted }]}>
                          {parseFloat(record.quantity)} {record.unit}
                         {record.purchasedByName ? ` · ${record.purchasedByName}` : ""}                       </Text>
                      </View>
                      <View style={styles.priceRecordRight}>
                        <Text style={[styles.priceRecordPrice, { color: colors.foreground }]}>
                          {formatPrice(price)}
                        </Text>
                        {diff !== null && (
                          <Text style={[
                            styles.priceRecordDiff,
                            { color: diff > 0 ? "#EF4444" : diff < 0 ? "#4CAF82" : "#F59E0B" },
                          ]}>
                            {diff > 0 ? "+" : ""}{formatPrice(diff)}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// Simple bar chart for price history
function PriceChart({ data, colors }: { data: any[]; colors: any }) {
  if (data.length < 2) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={[styles.chartEmptyText, { color: colors.muted }]}>
          ต้องการข้อมูลอย่างน้อย 2 ครั้งเพื่อแสดงกราฟ
        </Text>
      </View>
    );
  }

  const prices = data.map(d => parseFloat(d.price));
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const range = maxPrice - minPrice || 1;
  const chartHeight = 100;

  // Show last 8 entries
  const displayData = [...data].reverse().slice(0, 8);

  return (
    <View style={styles.chart}>
      <View style={styles.chartBars}>
        {displayData.map((record, index) => {
          const price = parseFloat(record.price);
          const barHeight = ((price - minPrice) / range) * (chartHeight - 20) + 20;
          const isLatest = index === displayData.length - 1;
          const prevPrice = index > 0 ? parseFloat(displayData[index - 1].price) : null;
          const barColor = prevPrice === null ? "#4CAF82" :
            price > prevPrice ? "#EF4444" :
            price < prevPrice ? "#4CAF82" : "#F59E0B";

          return (
            <View key={record.id} style={styles.barWrapper}>
              <Text style={[styles.barPrice, { color: colors.muted, fontSize: 9 }]}>
                {price >= 1000 ? `${(price / 1000).toFixed(1)}k` : price.toFixed(0)}
              </Text>
              <View style={[styles.bar, { height: barHeight, backgroundColor: isLatest ? barColor : barColor + "99" }]} />
              <Text style={[styles.barDate, { color: colors.muted }]}>
                {new Date(record.purchasedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Min/Max labels */}
      <View style={styles.chartLegend}>
        <Text style={[styles.chartLegendText, { color: colors.muted }]}>
          ต่ำสุด: ฿{minPrice.toLocaleString()}
        </Text>
        <Text style={[styles.chartLegendText, { color: colors.muted }]}>
          สูงสุด: ฿{maxPrice.toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  toggleRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
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
    lineHeight: 20,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  summaryItem: {
    alignItems: "center",
    gap: 4,
  },
  summaryNum: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1A2B21",
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  trendCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  trendLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  trendIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  trendInfo: {
    flex: 1,
    gap: 2,
  },
  trendName: {
    fontSize: 15,
    fontWeight: "600",
  },
  trendMeta: {
    fontSize: 12,
  },
  trendRight: {
    alignItems: "flex-end",
    gap: 2,
    marginLeft: 8,
  },
  trendLatestPrice: {
    fontSize: 16,
    fontWeight: "700",
  },
  trendChangeRow: {
    alignItems: "flex-end",
    gap: 1,
  },
  trendChange: {
    fontSize: 12,
    fontWeight: "700",
  },
  trendPrev: {
    fontSize: 11,
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  historyLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  historyEmoji: {
    fontSize: 24,
  },
  historyInfo: {
    flex: 1,
    gap: 2,
  },
  historyName: {
    fontSize: 14,
    fontWeight: "600",
  },
  historyMeta: {
    fontSize: 12,
  },
  historyDate: {
    fontSize: 11,
  },
  historyPrice: {
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 8,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  detailModal: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: "90%",
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: "800",
    flex: 1,
    marginRight: 12,
  },
  chartContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 12,
  },
  chart: {
    gap: 8,
  },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    height: 130,
  },
  barWrapper: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    justifyContent: "flex-end",
  },
  barPrice: {
    fontSize: 9,
  },
  bar: {
    width: "100%",
    borderRadius: 4,
    minHeight: 20,
  },
  barDate: {
    fontSize: 9,
    textAlign: "center",
  },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  chartLegendText: {
    fontSize: 11,
  },
  chartEmpty: {
    paddingVertical: 20,
    alignItems: "center",
  },
  chartEmptyText: {
    fontSize: 13,
    textAlign: "center",
  },
  detailSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 12,
  },
  priceRecord: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  priceRecordLeft: {
    gap: 2,
  },
  priceRecordDate: {
    fontSize: 14,
    fontWeight: "600",
  },
  priceRecordMeta: {
    fontSize: 12,
  },
  priceRecordRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  priceRecordPrice: {
    fontSize: 16,
    fontWeight: "700",
  },
  priceRecordDiff: {
    fontSize: 12,
    fontWeight: "600",
  },
});
