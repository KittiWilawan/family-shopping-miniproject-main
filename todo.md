# Family Shopping Manager — TODO

## Branding & Theme
- [x] สร้างโลโก้แอป (icon.png, splash-icon.png, favicon.png, android-icon-foreground.png)
- [x] ตั้งค่า theme สีเขียว (primary #4CAF82) ใน theme.config.js และ tailwind.config.js
- [x] อัปเดต app.config.ts (appName, logoUrl)

## Navigation & Structure
- [x] สร้างโครงสร้าง Tab Navigator (Home, History, Profile)
- [x] สร้าง Auth Stack (Login, FamilySetup)
- [x] ตั้งค่า icon-symbol.tsx สำหรับ tab icons

## Database Schema
- [x] สร้าง schema: families, familyMembers, shoppingItems, purchaseHistory
- [x] รัน db:push เพื่อ migrate

## Authentication
- [x] LoginScreen — Google OAuth Login
- [x] FamilySetupScreen — สร้างครอบครัวใหม่ + เข้าร่วมด้วยรหัส 6 หลัก
- [x] Server: family endpoints (create, join, getMembers, leave)
- [x] Root layout auth guard (redirect ถ้ายังไม่ login / ยังไม่มีครอบครัว)

## Home Screen — Shopping List
- [x] HomeScreen UI — header, filter tabs, period selector (weekly/monthly)
- [x] FlatList รายการสินค้า พร้อม checkbox สถานะ
- [x] Summary bar (จำนวนรายการ / ซื้อแล้ว / ยอดรวม)
- [x] FAB (+) เพิ่มรายการ
- [x] AddItemModal — เพิ่มสินค้า (ชื่อ, หมวดหมู่, ราคา, จำนวน, หมายเหตุ)
- [x] EditItemModal — แก้ไขสินค้า
- [x] Toggle สถานะ "ซื้อแล้ว" พร้อม haptic feedback + บันทึกราคาจริง
- [x] ลบสินค้า (swipe หรือ long press)
- [x] Server: shopping item endpoints (CRUD, toggleStatus, markBought)

## History & Price Comparison
- [x] HistoryScreen — รายการประวัติการซื้อ
- [x] Price trend view — เปรียบเทียบราคาล่าสุดกับครั้งก่อน (↑↓=)
- [x] Summary card (ราคาขึ้น/ลด/เท่าเดิม/ใหม่)
- [x] Price detail modal — กราฟ bar chart ราคาย้อนหลัง
- [x] Server: purchase history endpoints (list, trends, priceHistory)

## Profile Screen
- [x] ProfileScreen — ข้อมูลผู้ใช้, ครอบครัว, รหัส 6 หลัก
- [x] แสดงสมาชิกในครอบครัว
- [x] ปุ่มคัดลอก/แชร์รหัสครอบครัว
- [x] ปุ่มออกจากระบบ
- [x] ปุ่มออกจากครอบครัว

## Polish & Testing
- [x] Haptic feedback บน key actions
- [x] Loading states และ error handling
- [x] Empty states สำหรับทุกหน้า
- [x] Dark mode support (NativeWind tokens)
- [x] Unit tests: shared types, price trend logic, family code validation
