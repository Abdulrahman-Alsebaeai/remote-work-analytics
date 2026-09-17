# الأدوات والبرامج المستخدمة في Remote Work Analytics

هذا الملف يوضح متطلبات تشغيل وبناء النظام وروابط التنزيل المباشر لها. النظام مكوّن من تطبيق ويب للمدير، وواجهة REST خلفية، ووكيل Windows مستقل. **Docker غير مستخدم وغير مطلوب**.

> الروابط التالية مخصّصة لـWindows 64-bit، وتبدأ تنزيل ملف التثبيت مباشرة عند فتحها. تم التحقق منها بتاريخ 17 أغسطس 2026. يتطلب النظام Windows 10 أو Windows 11 بنواة 64-bit.

## البرامج المطلوبة

| البرنامج والإصدار | الاستخدام | هل يلزم؟ | رابط التنزيل المباشر |
|---|---|---:|---|
| Node.js 22.23.2 LTS | تشغيل وبناء الويب والـAPI وواجهة الوكيل؛ يتضمن npm | نعم | [تنزيل ملف MSI](https://nodejs.org/dist/v22.23.2/node-v22.23.2-x64.msi) |
| MariaDB 11.4.12 | قاعدة التطوير المحلية التي يشغّلها `scripts/start-local.ps1` على المنفذ 3310 | نعم للتشغيل المحلي الحالي | [تنزيل ملف MSI](https://archive.mariadb.org/mariadb-11.4.12/winx64-packages/mariadb-11.4.12-winx64.msi) |
| MySQL Community Server 8.4.11 LTS | بديل MariaDB لقاعدة الإنتاج أو التطوير بعد ضبط `.env` | أحد MariaDB أو MySQL | [تنزيل ملف MSI](https://dev.mysql.com/get/Downloads/MySQL-8.4/mysql-8.4.11-winx64.msi) |
| Rustup لـWindows x64 | تثبيت Rust؛ المشروع يثبّت Toolchain 1.88.0 تلقائيًا من ملف الإعداد | لبناء الوكيل فقط | [تنزيل rustup-init.exe](https://win.rustup.rs/x86_64) |
| Microsoft Visual Studio 2022 Build Tools | مترجم وأدوات ربط Tauri؛ اختر **Desktop development with C++** أثناء التثبيت | لبناء الوكيل فقط | [تنزيل vs_BuildTools.exe](https://aka.ms/vs/17/release/vs_BuildTools.exe) |
| Microsoft Edge WebView2 Evergreen Runtime | محرك عرض واجهة وكيل Windows | لتشغيل الوكيل إذا لم يكن مثبتًا | [تنزيل MicrosoftEdgeWebview2Setup.exe](https://go.microsoft.com/fwlink/p/?LinkId=2124703) |
| Microsoft Visual C++ Redistributable x64 | مكتبات تشغيل مطلوبة لبعض مكونات Windows وقاعدة البيانات | موصى به | [تنزيل vc_redist.x64.exe](https://aka.ms/vs/17/release/vc_redist.x64.exe) |
| Git for Windows 2.54.0 x64 | استنساخ المشروع وإدارة الإصدارات | موصى به للتطوير | [تنزيل Git-2.54.0-64-bit.exe](https://github.com/git-for-windows/git/releases/download/v2.54.0.windows.1/Git-2.54.0-64-bit.exe) |
| Visual Studio Code x64 | محرر مقترح؛ ليس اعتمادًا وقت التشغيل | اختياري | [تنزيل أحدث إصدار مستقر مباشرة](https://code.visualstudio.com/sha/download?build=stable&os=win32-x64-user) |

ميزة `VBSCRIPT` ليست برنامجًا منفصلًا للتنزيل؛ يتم تفعيلها من **Windows Optional Features** فقط عند الحاجة إلى إنشاء حزمة MSI.

> لا يحتاج المستخدم النهائي للوكيل إلى Rust أو Node.js أو Build Tools. حزمة MSI/NSIS تضم التطبيق، ويمكنها تثبيت WebView2 عند الحاجة.

## تنظيم الحزم والملفات القابلة لإعادة التوليد

- المشروع يستخدم **npm workspaces** وملف قفل واحدًا في جذر المشروع. نفّذ `npm ci` من جذر المشروع فقط، ولا تنفّذ تثبيتًا مستقلًا داخل `apps/web` أو `apps/agent`.
- مجلد `node_modules` في الجذر يحتوي الحزم المشتركة. قد يضع npm بعض الحزم الخاصة بمساحة عمل داخل `apps/web/node_modules` عند الحاجة إلى شجرة اعتماد منفصلة؛ لا تُنقل هذه المجلدات أو تُدمج يدويًا.
- يمكن حذف جميع مجلدات `node_modules` عند تجهيز نسخة أرشيفية فقط، ثم استعادتها لاحقًا بتشغيل `npm ci` من الجذر.
- لا تحذف `apps/agent/src-tauri` لأنه يحتوي كود وكيل Windows. المجلد الكبير القابل للحذف هو `apps/agent/src-tauri/target` فقط، ويمكن تنظيفه بأمان بالأمر التالي:

```powershell
cargo clean --manifest-path apps/agent/src-tauri/Cargo.toml
```

سيُعاد إنشاء `target` تلقائيًا في المرة التالية التي يتم فيها بناء تطبيق Windows.

## التقنيات الأساسية

| الجزء | التقنيات | التوثيق الرسمي |
|---|---|---|
| تطبيق المدير والموقع التسويقي | Next.js 16، React 19، TypeScript، PostCSS، Sharp | [Next.js](https://nextjs.org/docs) · [React](https://react.dev/) · [TypeScript](https://www.typescriptlang.org/docs/) · [PostCSS](https://postcss.org/) · [Sharp](https://sharp.pixelplumbing.com/) |
| Backend REST API | NestJS 11، Prisma 6، MySQL، RxJS | [NestJS](https://docs.nestjs.com/) · [Prisma](https://www.prisma.io/docs) · [MySQL](https://dev.mysql.com/doc/) · [RxJS](https://rxjs.dev/) |
| وكيل Windows | Tauri 2، Rust، React، Vite | [Tauri](https://v2.tauri.app/) · [Rust](https://doc.rust-lang.org/) · [Vite](https://vite.dev/guide/) |
| عقود الاتصال | REST APIs وJSON فقط بين المكونات | [HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110) |

## مكتبات الويب الرئيسية

- `next`: التوجيه، Server/Client Components، البناء والتشغيل — [npm](https://www.npmjs.com/package/next).
- `react` و`react-dom`: بناء الواجهات — [React](https://react.dev/).
- `typescript`: التحقق الساكن من الأنواع — [TypeScript](https://www.typescriptlang.org/).
- `postcss`: معالجة CSS أثناء البناء — [PostCSS](https://postcss.org/).
- `sharp`: تحسين الصور التي يعالجها Next.js — [Sharp](https://sharp.pixelplumbing.com/).

## مكتبات الـAPI الرئيسية

- `@nestjs/common`, `core`, `platform-express`, `config`: إطار الخادم والتهيئة وExpress — [NestJS](https://docs.nestjs.com/).
- `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`: المصادقة وتوكنات JWT — [Passport](https://www.passportjs.org/) · [NestJS Authentication](https://docs.nestjs.com/security/authentication).
- `@nestjs/throttler`: تحديد معدل الطلبات — [NestJS Rate Limiting](https://docs.nestjs.com/security/rate-limiting).
- `@prisma/client`, `prisma`: نمذجة MySQL والترحيلات والوصول للبيانات — [Prisma](https://www.prisma.io/docs).
- `argon2`: تجزئة كلمات المرور باستخدام Argon2id — [npm](https://www.npmjs.com/package/argon2).
- `class-validator`, `class-transformer`: التحقق من مدخلات REST وتحويلها — [class-validator](https://github.com/typestack/class-validator) · [class-transformer](https://github.com/typestack/class-transformer).
- `helmet`: ترويسات حماية HTTP — [Helmet](https://helmetjs.github.io/).
- `multer`: استقبال ملفات لقطات الشاشة — [npm](https://www.npmjs.com/package/multer).
- `pdfkit`: إنشاء تقارير PDF — [PDFKit](https://pdfkit.org/).
- `xlsx-populate`: إنشاء تقارير Excel — [npm](https://www.npmjs.com/package/xlsx-populate).
- `rxjs`, `reflect-metadata`: بنية NestJS غير المتزامنة والـmetadata — [RxJS](https://rxjs.dev/) · [reflect-metadata](https://www.npmjs.com/package/reflect-metadata).
- `dotenv`: تحميل متغيرات البيئة في أدوات الجذر — [npm](https://www.npmjs.com/package/dotenv).
- `@fontsource/noto-sans`, `@fontsource/noto-sans-arabic`: تضمين الخطوط محليًا دون الاعتماد على CDN — [Fontsource](https://fontsource.org/).

## مكتبات وكيل Windows

### واجهة الوكيل

- `@tauri-apps/api` و`@tauri-apps/cli`: جسر واجهة Tauri والبناء والتغليف — [Tauri](https://v2.tauri.app/).
- `react`, `react-dom`: واجهة الموظف — [React](https://react.dev/).
- `vite`: خادم التطوير وبناء الواجهة — [Vite](https://vite.dev/).
- `vitest`: اختبارات واجهة الوكيل — [Vitest](https://vitest.dev/).

### جزء Rust الأصلي

- `tauri`, `tauri-build`: نافذة التطبيق وربط واجهة الويب بـRust — [crates.io](https://crates.io/crates/tauri).
- `screenshots`: التقاط الشاشة — [crates.io](https://crates.io/crates/screenshots).
- `windows`: قراءة النافذة النشطة ومستوى إدخال لوحة المفاتيح والماوس وواجهات Windows اللازمة — [crates.io](https://crates.io/crates/windows).
- `image`: ضغط لقطات الشاشة إلى JPEG — [crates.io](https://crates.io/crates/image).
- `rusqlite` مع SQLite المضمّن: الطابور المحلي للعمل دون اتصال؛ لا يحتاج تثبيت SQLite منفصل — [crates.io](https://crates.io/crates/rusqlite).
- `aes-gcm`, `rand`, `base64`: تشفير بيانات الطابور المحلي وترميزها — [aes-gcm](https://crates.io/crates/aes-gcm) · [rand](https://crates.io/crates/rand) · [base64](https://crates.io/crates/base64).
- `keyring` مع `windows-native`: حفظ الأسرار في مخزن Windows الآمن — [crates.io](https://crates.io/crates/keyring).
- `reqwest` مع `rustls-tls`: الاتصال المشفر بالـREST API ورفع الملفات — [crates.io](https://crates.io/crates/reqwest).
- `tokio`: تنفيذ مهام المزامنة غير المتزامنة — [crates.io](https://crates.io/crates/tokio).
- `serde`, `serde_json`: تحويل البيانات من وإلى JSON — [Serde](https://serde.rs/).
- `chrono`, `uuid`: الوقت والمعرفات الفريدة للأحداث المحلية — [chrono](https://crates.io/crates/chrono) · [uuid](https://crates.io/crates/uuid).

## أدوات الجودة والاختبار

- `Jest`, `ts-jest`, `Supertest`, `@nestjs/testing`: اختبارات الوحدة وREST E2E — [Jest](https://jestjs.io/) · [Supertest](https://www.npmjs.com/package/supertest).
- `Vitest`: اختبارات واجهة وكيل Windows — [Vitest](https://vitest.dev/).
- `ESLint` و`typescript-eslint`: جودة كود TypeScript — [ESLint](https://eslint.org/) · [typescript-eslint](https://typescript-eslint.io/).
- `tsx`: تشغيل سكربتات TypeScript مثل seed — [npm](https://www.npmjs.com/package/tsx).

## الذكاء الاصطناعي الحالي

المعالجة الذكية الحالية داخل الـAPI تستخدم محولات محلية معزولة خلف واجهات `ActivityClassifier` و`InsightGenerator`. لا توجد خدمة OpenAI أو Gemini أو Anthropic مطلوبة للتشغيل الحالي. هذا العزل يسمح باستبدال النموذج مستقبلًا دون تغيير منطق الأعمال أو تطبيق الويب أو وكيل Windows.

## أوامر التشغيل والبناء

من جذر المشروع:

```powershell
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev:web
```

ولتشغيل البيئة المحلية المجهزة على هذا الجهاز، بما فيها MariaDB والـAPI والويب، يمكن استخدام:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1
```

التحقق الكامل:

```powershell
npm test
npm run lint
npm run build
```

بناء مثبت وكيل Windows:

```powershell
npm run build -w @remote-work/agent
npm run tauri -w @remote-work/agent -- build
```

تفاصيل التشغيل والنسخ الاحتياطي موجودة في [operations.md](./operations.md).
