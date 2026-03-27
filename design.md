# Family Shopping Manager — Design Document

## App Overview
แอปบริหารจัดการการซื้อของสำหรับครอบครัว ใช้งานร่วมกันได้ผ่านรหัสครอบครัว 6 หลัก รองรับ Google Login และ sync ข้อมูลผ่าน backend

---

## Color Palette
| Token | Light | Dark | Purpose |
|-------|-------|------|---------|
| primary | #4CAF82 | #4CAF82 | สีเขียวสด — ธีมหลักของแอป (ความสดชื่น, ของสด) |
| background | #F8FAF9 | #0F1A14 | พื้นหลังหน้าจอ |
| surface | #FFFFFF | #1A2B21 | การ์ด, ช่องกรอก |
| foreground | #1A2B21 | #EDF5EF | ข้อความหลัก |
| muted | #6B8C78 | #8FAF9A | ข้อความรอง |
| border | #D9EDE3 | #2A4035 | เส้นขอบ |
| success | #22C55E | #4ADE80 | ซื้อแล้ว / สำเร็จ |
| warning | #F59E0B | #FBBF24 | ราคาเพิ่มขึ้น |
| error | #EF4444 | #F87171 | ลบ / ราคาลดลงมาก |
| accent | #FF8C42 | #FF8C42 | ไฮไลต์พิเศษ |

---

## Screen List

### Auth Flow
1. **SplashScreen** — โลโก้ + ตรวจสอบ session
2. **LoginScreen** — Google Login button + ปุ่มเข้าร่วมครอบครัว
3. **FamilyJoinScreen** — กรอกรหัส 6 หลักเพื่อเข้าร่วมครอบครัว
4. **FamilyCreateScreen** — สร้างครอบครัวใหม่ + แสดงรหัส 6 หลัก

### Main App (Tab Navigation)
5. **HomeScreen (Tab 1)** — รายการซื้อของประจำสัปดาห์/เดือน
6. **HistoryScreen (Tab 2)** — ประวัติการซื้อและเปรียบเทียบราคา
7. **ProfileScreen (Tab 3)** — ข้อมูลครอบครัว, รหัสครอบครัว, ออกจากระบบ

### Modal/Sheet Screens
8. **AddItemSheet** — Bottom sheet เพิ่มรายการซื้อของ
9. **EditItemSheet** — Bottom sheet แก้ไขรายการ
10. **ItemDetailScreen** — รายละเอียดสินค้า + ประวัติราคา
11. **PriceCompareScreen** — กราฟเปรียบเทียบราคาสินค้า

---

## Primary Content & Functionality

### HomeScreen
- Header: ชื่อครอบครัว + ไอคอนเพิ่มรายการ
- Filter tabs: "ทั้งหมด" | "ยังไม่ซื้อ" | "ซื้อแล้ว"
- Period selector: "สัปดาห์นี้" | "เดือนนี้"
- FlatList รายการสินค้า: ชื่อ, หมวดหมู่, ราคาล่าสุด, สถานะ checkbox
- Swipe left to delete, Swipe right to mark as bought
- FAB (+) เพิ่มรายการใหม่
- Summary bar: จำนวนรายการ / ซื้อแล้ว / ยอดรวมโดยประมาณ

### HistoryScreen
- รายการประวัติการซื้อ จัดกลุ่มตามวันที่
- แต่ละรายการแสดง: ชื่อสินค้า, ราคา, วันที่ซื้อ, ผู้ซื้อ
- ปุ่มดูกราฟเปรียบเทียบราคา
- Price trend indicator: ↑ ราคาขึ้น (สีส้ม) | ↓ ราคาลง (สีเขียว) | = ราคาเท่าเดิม

### ProfileScreen
- รูปโปรไฟล์ + ชื่อผู้ใช้ (จาก Google)
- ชื่อครอบครัว + รหัสครอบครัว 6 หลัก (กดคัดลอกได้)
- สมาชิกในครอบครัว
- ปุ่มออกจากระบบ

---

## Key User Flows

### Flow 1: เข้าสู่ระบบครั้งแรก
1. เปิดแอป → SplashScreen
2. กด "เข้าสู่ระบบด้วย Google"
3. Google OAuth → กลับมาแอป
4. ถามว่า "สร้างครอบครัวใหม่" หรือ "เข้าร่วมครอบครัว"
5. กรอกรหัส 6 หลัก หรือสร้างใหม่
6. เข้า HomeScreen

### Flow 2: เพิ่มรายการซื้อของ
1. กด FAB (+) บน HomeScreen
2. AddItemSheet เปิดขึ้น
3. กรอก: ชื่อสินค้า, หมวดหมู่, ราคาโดยประมาณ, จำนวน, หมายเหตุ
4. กด "บันทึก" → รายการปรากฏใน list

### Flow 3: อัปเดตสถานะซื้อแล้ว
1. กด checkbox ข้างรายการ หรือ Swipe right
2. รายการเปลี่ยนเป็น "ซื้อแล้ว" พร้อม animation
3. กรอกราคาจริงที่ซื้อ (optional prompt)
4. บันทึกลงประวัติ

### Flow 4: เปรียบเทียบราคา
1. กดที่รายการสินค้าใน HistoryScreen
2. ItemDetailScreen แสดงกราฟราคาย้อนหลัง
3. เห็นแนวโน้มราคาขึ้น/ลง

---

## Navigation Structure
```
Stack Navigator (Root)
├── LoginScreen (ถ้ายังไม่ login)
├── FamilyJoinScreen
├── FamilyCreateScreen
└── Tab Navigator (หลัง login + มีครอบครัว)
    ├── Tab 1: HomeScreen
    │   └── Modal: AddItemSheet / EditItemSheet
    ├── Tab 2: HistoryScreen
    │   └── Stack: ItemDetailScreen / PriceCompareScreen
    └── Tab 3: ProfileScreen
```

---

## Component Design Principles
- ใช้ **rounded-2xl** สำหรับการ์ดทุกใบ
- Shadow เบาๆ บนการ์ด (elevation 2-4)
- Checkbox แบบ custom สีเขียว
- Swipe actions ด้วย react-native-gesture-handler
- Bottom sheet ด้วย @gorhom/bottom-sheet หรือ Modal
- Price trend badge: สีส้มสำหรับขึ้น, สีเขียวสำหรับลง
- Haptic feedback บน checkbox toggle และ delete
