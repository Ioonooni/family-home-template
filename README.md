# งานบ้านของเรา

เว็บแอปมือถือสำหรับจัดการงานบ้านและการเงินของครอบครัวในโปรดักต์เดียวกัน โดยแยกขอบเขตข้อมูลของแต่ละโมดูลอย่างชัดเจน

Created by IOON.

## Try / Use This / Source

- **Try** — ใช้ deployment ของเจ้าของโปรเจกต์สำหรับทดสอบเมื่อมีการเผยแพร่ลิงก์ที่ผ่าน security gate แล้ว
- **Use This** — สร้างสำเนาของ repository นี้ แล้วเชื่อมต่อ Supabase และ Google ของผู้ใช้เองก่อน deploy
- **Source** — repository นี้เป็น source ต้นฉบับของโปรดักต์ เมื่อเจ้าของโปรเจกต์อนุมัติการเผยแพร่แบบ public

> ห้ามใช้ Supabase, Google Drive, Google Sheets หรือ credential ของเจ้าของโปรเจกต์ร่วมกับสำเนาของผู้ใช้รายอื่น

## โมดูล

- **Task** — ใช้ Supabase สำหรับ task data, attachment และ push subscription
- **Finance** — รายรับ/รายจ่ายครอบครัวและธุรกิจ
  - Transactions + receipt metadata → Google Sheets
  - Receipt files → Google Drive
  - OAuth scope → `drive.file`
  - Access token อยู่ใน memory เท่านั้น ไม่เก็บใน localStorage/sessionStorage/cookie

Finance ไม่อ่านหรือเขียน Supabase ของ Task module

## ตั้งค่า instance ของคุณ

คัดลอก `.env.example` เป็น `.env` สำหรับ local development หรือกำหนดค่าเดียวกันใน deployment environment:

```text
VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
VITE_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_OAUTH_WEB_CLIENT_ID
```

`VITE_VAPID_PUBLIC_KEY` เป็น optional: ถ้ายังไม่ตั้งค่า ปุ่ม push notification จะไม่แสดง

ค่า `VITE_*` ทั้งหมดเป็น browser-visible configuration เท่านั้น ห้ามใส่ `service_role`, OAuth client secret, VAPID private key, access token, refresh token, private key หรือ credential อื่น

## Supabase ที่ต้องมี

Task module ต้องใช้ resource ต่อไปนี้ใน Supabase ของผู้ deploy:

- table `tasks`
- table `push_subscriptions` หากเปิดใช้ push notification
- storage bucket `attachments`

Schema, policy และ server-side notification infrastructure ต้องตั้งให้ตรงกับ implementation ของ instance ก่อนนำไปใช้งานจริง หาก repository ยังไม่มี migration/bootstrap สำหรับส่วนนี้ ให้ถือว่ายังไม่ใช่ zero-to-running template สำหรับ Task module

## Google OAuth

สร้าง Google OAuth Web Client ของผู้ deploy เอง และตั้ง:

```text
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_OAUTH_WEB_CLIENT_ID
```

สำหรับ production ให้เพิ่ม production origin ใน Google Cloud Authorized JavaScript origins

Finance ใช้ Google authorization จากผู้ใช้แต่ละคนเพื่อสร้าง/ใช้งาน Finance Sheet และ receipt files ใน Google Drive ของผู้ใช้นั้นเอง ระบบไม่เก็บ Google access token ใน persistent browser storage

## คำสั่งหลัก

```bash
npm install
npm run dev
npm run check
```

`npm run check` ต้องผ่าน lint, tests และ production build

## โครงสร้าง

- `src/domain`, `src/application`, `src/adapters` — Task module
- `src/finance/domain` — Finance domain rules
- `src/finance/application` — Finance use cases
- `src/finance/ports` — Finance persistence/storage contracts
- `src/finance/adapters` — Google Sheets, Google Drive และ browser adapters
- `src/ui` — shared UI utilities
- `public/sw.js` — service worker สำหรับ push notification

## Deployment

Production build ใช้ Vite และ output ที่ `dist/`.

การ deploy production ต้องมาจาก commit ที่ผ่าน `npm run check`. CI ใน `.github/workflows/ci.yml` จะตรวจ lint, tests และ build อัตโนมัติทุก push/PR

ก่อนเปิด public หรือทำ template ต้องตรวจให้ครบว่า:
- ไม่มี secrets หรือ private data ใน working tree และ history ที่เกี่ยวข้อง
- ผู้ใช้สำเนาเชื่อมต่อ service/data ของตัวเอง
- public demo ไม่เขียนข้อมูลจริงของเจ้าของโปรเจกต์
- production config ของเจ้าของไม่ถูกฝังใน reusable source

## License

MIT — Copyright © 2026 IOON.

Project Owner อนุมัติให้เผยแพร่ source ภายใต้ MIT License สำหรับ GGEZ public distribution แล้ว
