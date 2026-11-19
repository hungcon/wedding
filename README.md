# Wedding Vietnam Landing

App nhỏ cho landing page đám cưới Việt Nam và trang admin upload ảnh theo từng khối.

## Chạy local

```bash
npm start
```

- Landing: `http://localhost:4173`
- Admin: `http://localhost:4173/admin`

## Deploy lên Cloudflare Workers từ GitHub

1. Mở **Storage & databases → R2 → Overview** và kiểm tra bucket `wedding-wedding-uploads`. Nếu bucket chưa có, tạo bucket đúng tên này. Wrangler dùng `bucket_name` trong `wrangler.jsonc` để gắn trực tiếp bucket vào binding `WEDDING_UPLOADS`. [Tài liệu R2](https://developers.cloudflare.com/r2/get-started/workers-api/)
2. Mở Worker `wedding` → **Settings → Build**. Chọn nhánh production đang dùng, để **Root directory** trống nếu `wrangler.jsonc` nằm ở gốc repo GitHub, và để **Build command** trống. Đặt **Deploy command** thành `npm run deploy`. [Tài liệu Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
3. Trong **Settings → Build → Variables and secrets**, thêm `ADMIN_PASSWORD` kiểu **Secret**. Lệnh deploy chuyển giá trị này thành secret của Worker. Bạn cũng có thể đặt secret trực tiếp tại **Settings → Variables and Secrets** của Worker. Để dùng cách này, bỏ `ADMIN_PASSWORD` trong phần Build để lệnh deploy giữ secret của Worker. [Tài liệu Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
4. Push các thay đổi lên nhánh production để chạy build. Kiểm tra `/api/config` và `/api/wishes` đều trả `200` cùng JSON. Mở `/admin` và đăng nhập với tài khoản `admin` cùng mật khẩu vừa đặt.

Lệnh sau dùng Node.js 22 trở lên để chạy Worker cục bộ tại `http://localhost:8787`.

```bash
npx --yes wrangler@4.165.0 dev --var ADMIN_PASSWORD:local-test-only
```

## Lưu dữ liệu

- Khi chạy bằng `npm start`, cấu hình được lưu tại `data/config.json`, lời chúc tại `data/wishes.json` và ảnh tải lên tại `data/uploads/`.
- Trên Cloudflare, Durable Object lưu cấu hình và lời chúc, khởi tạo từ hai tệp JSON trong repo. Ảnh tải từ trang quản trị được lưu trong R2. Nếu cấu hình cũ trỏ tới ảnh trong `data/uploads/`, chép các ảnh đó lên bucket với tên tệp gốc hoặc tải lại từ trang quản trị.
- Mỗi khối ảnh gồm: `hero`, `story`, `ceremony`, `gallery`.
- Google Map dùng link nhúng theo địa chỉ nhà gái và nhà trai trong admin, không cần API key.
