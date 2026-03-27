/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export * from "./_core/errors";

// App-specific types for Family Shopping Manager

export type ItemCategory =
  | "vegetables"
  | "fruits"
  | "meat"
  | "seafood"
  | "dairy"
  | "bakery"
  | "beverages"
  | "snacks"
  | "cleaning"
  | "personal_care"
  | "household"
  | "other";

export type ItemPeriod = "weekly" | "monthly";

export type MemberRole = "owner" | "member";

export interface PriceTrend {
  itemName: string;
  history: {
    price: number;
    purchasedAt: Date | string;
    purchasedByName?: string | null;
  }[];
  latestPrice: number;
  previousPrice: number | null;
  trend: "up" | "down" | "same" | "new";
  changePercent: number | null;
}

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  vegetables: "ผัก",
  fruits: "ผลไม้",
  meat: "เนื้อสัตว์",
  seafood: "อาหารทะเล",
  dairy: "นม/ไข่",
  bakery: "ขนมปัง/เบเกอรี่",
  beverages: "เครื่องดื่ม",
  snacks: "ขนมขบเคี้ยว",
  cleaning: "ผลิตภัณฑ์ทำความสะอาด",
  personal_care: "ของใช้ส่วนตัว",
  household: "ของใช้ในบ้าน",
  other: "อื่นๆ",
};

export const CATEGORY_ICONS: Record<ItemCategory, string> = {
  vegetables: "🥦",
  fruits: "🍎",
  meat: "🥩",
  seafood: "🐟",
  dairy: "🥛",
  bakery: "🍞",
  beverages: "🥤",
  snacks: "🍿",
  cleaning: "🧹",
  personal_care: "🧴",
  household: "🏠",
  other: "📦",
};

export const UNIT_OPTIONS = [
  "กก.", "กรัม", "ลิตร", "มล.", "ชิ้น", "แพ็ค", "กล่อง", "ถุง", "ขวด", "โหล", "อัน", "มัด"
];
