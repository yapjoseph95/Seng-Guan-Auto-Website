# 车辆后台使用说明

后台地址：https://sengguanauto.com.my/admin

## 登录

输入已获授权的邮箱，再输入 Resend 发来的 6 位验证码。登录页使用 Seng Guan Auto 的设计。

新增管理员时，在 Supabase Authentication 的 Users 中建立并确认该邮箱账户，再将邮箱加入 Cloudflare Pages 正式环境的 `ADMIN_EMAILS` 名单（多个邮箱以逗号分隔）并重新部署。移除授权时，从名单移除该邮箱并重新部署。审核站保持独立。

### 认证项目配置

- Supabase 项目为 `seng-guan-auto-auth`，仅启用所需的邮箱登录并关闭公开注册。
- 将 Site URL 设为 `https://sengguanauto.com.my`，邮箱验证码设为 6 位、10 分钟有效。
- 在 Authentication 的邮件模板中选择 Magic Link，使用主题 `Seng Guan Auto 登录验证码` 和 [验证码邮件模板](vehicle-admin-otp.html)。模板使用 `{{ .Token }}` 显示验证码。
- 使用 Resend 官方集成配置自定义 SMTP 和已验证的发信域名 `sengguanauto.com.my`。发送密钥只保存在 SMTP 设置中。
- `wrangler.jsonc` 配置生产环境的 `SUPABASE_URL` 和公开的 `SUPABASE_ANON_KEY`。管理员名单 `ADMIN_EMAILS` 保存在 Cloudflare Pages 正式环境的密钥设置中。

## 新增车辆

1. 点击「新增车辆」。
2. 填写车型、品牌、年份、售价、里程、介绍等；保存草稿。
3. 上传照片（每辆最多 20 张，支持 JPEG、PNG、WebP；浏览器会压缩至最长边 2000px）。
4. 用照片下方箭头调整顺序，第一张为封面；保存排序。
5. 选择「在售」，按需勾选首页推荐，然后「保存并发布」。

新车始终先创建为草稿，缺少照片时不能发布。草稿与草稿照片无法通过公开接口读取。

## 更新与删除

- 文字、价格、状态与照片排序：点击保存后生效。
- 照片上传、删除：即时保存。操作在售车辆的照片会同步更新官网。
- 已售车辆：选择「已售」并保存，保留车辆详情，但不再用于首页推荐。
- 暂时不展示：改为「草稿」。
- 永久删除：车辆列表点击垃圾桶并确认，车辆资料与照片会删除。一般售出建议标为已售，避免丢失资料。
- 前台重新打开/刷新会读取最新资料；已打开的页面重新获得焦点时也会刷新车辆列表。

## 前台详情

点击车辆卡片会打开站内详情，展示所有照片、价格、里程与文字介绍。可通过 /cars?vehicle=车辆ID 分享车辆。WhatsApp 询问会自动带上该车型名称。

## 存储与恢复

- Pages 正式项目：seng-guan-auto-website，发布分支 production-2026-11-05。
- D1：seng-guan-auto-inventory，ID 1e179b61-81a9-45dd-a012-ea3d1e5249a4。
- 私有 R2：seng-guan-auto-vehicle-photos，仅通过服务端检查发布状态后提供照片。
- 数据库结构：prototype/migrations/0001_vehicles.sql 与 prototype/migrations/0002_auth_limits.sql。
- 现有网站 8 辆展示车辆及原封面已迁入，未填的价格、里程保留空白，未虚构库存资料。请实际使用前核对在售状态。
- 升级前代码备份分支：backup/pre-vehicle-admin-2026-11-06。
- 本地代码历史备份：/Users/josephyap/Documents/ChatGPT/Backups/Seng-Guan-Auto/2026-11-06-before-admin/website.bundle。
- 恢复网站代码不会自动恢复 D1/R2 数据。误改数据库可使用 D1 Time Travel；照片删除后需要独立对象备份恢复。

## 开发检查

在 prototype 目录运行：pnpm build、pnpm check:server、pnpm test:api、pnpm exec wrangler pages functions build。测试使用隔离 SQLite、内存照片存储和模拟 Supabase Auth，不接触生产车辆数据。审核界面用的临时本地测试服务器位于被 Git 忽略的 .wrangler 目录，不会发布。
