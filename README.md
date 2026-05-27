# Wedding Vietnam Landing

App nhỏ cho landing page đám cưới Việt Nam và trang admin upload ảnh theo từng khối.

## Chạy local

```bash
npm start
```

- Landing: `http://localhost:4173`
- Admin: `http://localhost:4173/admin`

## Lưu dữ liệu

- Cấu hình theme, nội dung và bố cục được lưu tại `data/config.json`.
- Lời chúc khách gửi được lưu tại `data/wishes.json`.
- Ảnh upload từ admin được lưu tại `data/uploads/`.
- Mỗi khối ảnh gồm: `hero`, `story`, `ceremony`, `gallery`.
- Google Map dùng link nhúng theo địa chỉ nhà gái và nhà trai trong admin, không cần API key.
