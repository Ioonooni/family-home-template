# งานบ้านของเรา

เว็บแอปมือถือสำหรับจัดการงานบ้านและการเงินของครอบครัว โดยแยกขอบเขตข้อมูลของแต่ละโมดูลอย่างชัดเจน

**Created by IOON**

## Try / Use This / Source

- **Try** — ยังไม่เผยแพร่ public demo โดยตั้งใจ เพราะ deployment ใช้งานจริงของเจ้าของเป็น private instance และไม่ควรถูกใช้เป็น demo สาธารณะ
- **Use This** — ใช้ปุ่ม **Use this template** ของ repository นี้ หรือเปิด `https://github.com/Ioonooni/family-home-template/generate` แล้วเชื่อมต่อ Supabase และ Google ของผู้ใช้เอง
- **Source** — `https://github.com/Ioonooni/family-home-template`

> สำเนาของผู้ใช้ต้องใช้ Supabase, Google Drive, Google Sheets และ deployment environment ของตนเอง ห้ามชี้กลับไปยัง resource ของเจ้าของโปรเจกต์

## โมดูล

- **Task**
  - Supabase Email/Password Auth
  - Row Level Security ผูกข้อมูลกับ `auth.uid()`
  - private attachment bucket
  - signed URL ชั่วคราวสำหรับเปิดไฟล์แนบ
  - push subscription แยกตามผู้ใช้
- **Finance**
  - Transactions + receipt metadata → Google Sheets
  - Receipt files → Google Drive
  - OAuth scope → `drive.file`
  - Google access token อยู่ใน memory เท่านั้น ไม่เก็บใน localStorage/sessionStorage/cookie

Finance ไม่อ่านหรือเขียน Supabase ของ Task module

## 1) สร้างสำเนา

กด **Use this template** แล้วสร้าง repository ใหม่ในบัญชีของคุณ

จากนั้น clone repository และติดตั้ง dependency:

```bash
npm install
```

## 2) ตั้งค่า Supabase สำหรับ Task

1. สร้าง Supabase project ของคุณเอง
2. เปิด Email/Password authentication
3. เปิด SQL Editor แล้วรันไฟล์ `supabase/setup.sql`
4. นำ Project URL และ publishable key ไปใช้ใน environment

`supabase/setup.sql` จะสร้าง:
- `tasks` พร้อม `owner_id` และ RLS
- `push_subscriptions` พร้อม RLS
- private bucket `attachments`
- storage policies ที่จำกัดสิทธิ์ตาม `auth.uid()`
- realtime สำหรับตาราง `tasks`

Task UI จะไม่โหลดหรือ subscribe ข้อมูลจนกว่าจะมี authenticated session

## 3) ตั้งค่า Google OAuth สำหรับ Finance

สร้าง Google OAuth Web Client ของคุณเอง และเพิ่ม origin ที่ใช้จริงใน **Authorized JavaScript origins**

Finance ใช้ Google authorization ของผู้ใช้เพื่อสร้าง/ใช้งาน Finance Sheet และ receipt files ใน Google Drive ของผู้ใช้นั้นเอง

## 4) ตั้งค่า environment

คัดลอก `.env.example` เป็น `.env` สำหรับ local development หรือกำหนดค่าเดียวกันใน deployment environment:

```text
VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
VITE_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_OAUTH_WEB_CLIENT_ID
```

`VITE_VAPID_PUBLIC_KEY` เป็น optional ถ้ายังไม่ตั้งค่า ปุ่ม push notification จะไม่แสดง

ค่า `VITE_*` เป็น browser-visible configuration เท่านั้น ห้ามใส่ `service_role`, OAuth client secret, VAPID private key, access token, refresh token, private key หรือ credential อื่น

## 5) ตรวจและรัน

```bash
npm run dev
npm run check
```

`npm run check` ต้องผ่าน lint, tests และ production build

## 6) Deploy

โปรเจกต์ใช้ Vite

- Build command: `npm run build`
- Output directory: `dist`
- กำหนด environment variables ของคุณเองก่อน deploy
- หลัง deploy ให้เพิ่ม production origin ใน Google OAuth Web Client

## โครงสร้างหลัก

- `src/domain`, `src/application`, `src/adapters` — Task module
- `src/finance/domain` — Finance domain rules
- `src/finance/application` — Finance use cases
- `src/finance/ports` — Finance persistence/storage contracts
- `src/finance/adapters` — Google Sheets, Google Drive และ browser adapters
- `src/ui` — shared UI utilities
- `supabase/setup.sql` — Task database, RLS, storage และ realtime bootstrap
- `public/sw.js` — service worker สำหรับ push notification

## Security baseline

ก่อนนำสำเนาไปใช้งานจริง:
- ใช้ service/data ของผู้ deploy เอง
- ห้าม commit `.env` หรือ credentials
- ห้ามใช้ `service_role` หรือ secret ใด ๆ ใน browser
- Task ต้องเปิด RLS ตาม `supabase/setup.sql`
- public deployment ต้องไม่ชี้ไปยังข้อมูลจริงของเจ้าของโปรเจกต์

CI ใน `.github/workflows/ci.yml` จะตรวจ lint, tests และ build อัตโนมัติทุก push/PR

## License

MIT License — Copyright © 2026 IOON.
