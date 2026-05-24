# Audio Plugin 平台化 — 技术设计方案

## 概述

将现有的 Premiere Pro CEP 音频面板插件扩展为完整的音频管理平台，包含三个子系统：

1. **管理后台**（uni-app H5）— 管理员管理分类、标签、版本、音频文件、用户和订单
2. **门户网站**（uni-app H5 + 小程序）— 用户注册、浏览音频、付费会员、收藏
3. **Premiere Pro 插件改造** — 接入 API，用户登录鉴权，数据从云端获取

三个子系统共用一套 **uniCloud Serverless 后端**，通过 uni-id 统一鉴权。

---

## 技术选型

| 层面 | 技术 | 说明 |
|------|------|------|
| 后端 | uniCloud（阿里云） | Serverless，云函数 + 云数据库 + 云存储 |
| 门户前端 | uni-app | H5 + 微信小程序 |
| 管理后台 | uni-app | H5 独立部署 |
| 用户认证 | uni-id | 手机号+验证码 / 微信登录 |
| 支付 | 微信支付 | uniCloud 内置支付能力 |
| 插件端 | 纯 HTML/JS/CSS | CEP 面板，通过 fetch 调用 API |

---

## 数据库表设计

### 1. 管理员表 `admin_users`

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 主键 |
| username | string | 用户名 |
| password_hash | string | 密码哈希（bcrypt） |
| role | enum | `super_admin` / `admin` / `support` |
| nickname | string | 昵称 |
| avatar | string | 头像 URL |
| status | int | 1=正常 0=禁用 |
| created_at | datetime | 创建时间 |

初始化脚本自动创建一个 `super_admin` 账号。super_admin 可创建/管理 admin 和 support 账号。

### 2. 用户表 `users`（基于 uni-id 扩展）

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 主键 |
| mobile | string | 手机号 |
| wx_unionid | string | 微信 unionid |
| nickname | string | 昵称 |
| avatar | string | 头像 |
| referral_code | string | 我的推广码（注册时自动生成，唯一） |
| referrer_id | string | 推广人用户 ID（可为 null） |
| is_member | bool | 是否会员 |
| member_type | enum | `permanent` / `monthly` / `quarterly` / `yearly` / null |
| member_expire_at | datetime | 会员到期时间（永久会员为 null） |
| created_at | datetime | 注册时间 |

### 3. 分类表 `categories`

固定 3 级树形结构，通过 parent_id 关联。

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 主键 |
| name | string | 分类名称 |
| level | int | 1 / 2 / 3 |
| parent_id | string | 父级 ID（level=1 时为 null） |
| sort | int | 同级排序 |
| icon | string | 图标 URL（level=3 由 audio_files.icon 提供） |
| status | int | 1=启用 0=禁用 |
| created_at | datetime | 创建时间 |

数据示例：
```
流行音乐          (level=1, parent=null)
├── 激昂          (level=2, parent=流行音乐)
│   ├── 明快动感   (level=3, parent=激昂)
│   └── 澎湃力量   (level=3, parent=激昂)
└── 舒缓          (level=2, parent=流行音乐)
    ├── 温柔抒情   (level=3, parent=舒缓)
    └── 宁静致远   (level=3, parent=舒缓)
```

### 4. 音频文件表 `audio_files`

level=3 的分类节点即为音频条目，此表存储音频的额外元数据。

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 主键 |
| category_id | string | 关联 level=3 分类 ID（唯一） |
| name | string | 音频名称（冗余自分类名，方便查询） |
| description | text | 介绍描述 |
| icon | string | 封面图标 URL |
| tag_ids | array[string] | 绑定的标签 ID 列表 |
| status | int | 1=上架 0=下架 |
| sort | int | 排序 |
| view_count | int | 浏览次数 |
| created_at | datetime | 创建时间 |

### 5. 版本表 `versions`

独立版本池，类似标签，一个版本名可被多个音频绑定。

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 主键 |
| name | string | 版本名（如"30秒""60秒""90秒""120秒"） |
| sort | int | 排序 |
| created_at | datetime | 创建时间 |

### 6. 音频-版本关联表 `audio_versions`

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 主键 |
| audio_id | string | 音频 ID |
| version_id | string | 版本 ID |
| file_url | string | 该版本对应的云存储文件 URL |
| file_size | int | 文件大小（字节） |
| duration | int | 时长（秒） |
| created_at | datetime | 创建时间 |

### 7. 标签表 `tags`

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 主键 |
| name | string | 标签名 |
| color | string | 标签颜色（hex，如 #e91e63） |
| created_at | datetime | 创建时间 |

### 8. 用户收藏表 `favorites`

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 主键 |
| user_id | string | 用户 ID |
| audio_id | string | 音频 ID |
| created_at | datetime | 收藏时间 |

唯一索引：(user_id, audio_id)

### 9. 订单表 `orders`

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 主键 |
| user_id | string | 用户 ID |
| type | enum | `permanent` / `monthly` / `quarterly` / `yearly` |
| amount | int | 支付金额（分） |
| status | enum | `pending` / `paid` / `refunded` / `expired` |
| transaction_id | string | 微信支付交易号 |
| paid_at | datetime | 支付时间 |
| created_at | datetime | 创建时间 |

---

## API 接口设计

所有接口通过 uniCloud 云函数 URL 化暴露。公开接口走 `/api/`，管理接口走 `/api/admin/`。

鉴权方式：公开接口无需登录（注册/登录除外）；用户接口使用 uni-id token（Header: `Authorization: Bearer <token>`）；管理接口使用 admin token。

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/categories` | 分类列表查询，`?keyword=` 模糊搜索分类名 |
| GET | `/api/categories/tree` | 完整 3 级分类树 |
| GET | `/api/audio-files` | 音频查询，支持 `?category_id=&tag_id=&keyword=&version_id=&page=&limit=` |
| GET | `/api/audio-files/:id` | 音频详情（含版本列表、标签、分类信息） |
| GET | `/api/tags` | 标签列表 |
| GET | `/api/versions` | 版本池列表 |
| POST | `/api/register` | 用户注册 `{mobile, code, password?, referral_code?}` |
| POST | `/api/login` | 登录 `{mobile, code}` 或 `{wx_code}` |
| GET | `/api/config/contact` | 联系我们信息 |

### 用户接口（需登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/orders/create` | 创建订单 `{type}` |
| GET | `/api/orders/status/:id` | 查询订单状态 |
| POST | `/api/favorites/toggle` | 收藏/取消 `{audio_id}` |
| GET | `/api/favorites` | 我的收藏列表 `?page=&limit=` |
| GET | `/api/user/profile` | 个人信息（含推广码、会员状态） |
| PUT | `/api/user/profile` | 更新个人信息 |
| GET | `/api/user/referrals` | 我的推广记录 |

### 管理后台接口（需 admin 登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/login` | 管理员登录 `{username, password}` |
| GET | `/api/admin/dashboard` | 仪表盘统计数据 |
| CRUD | `/api/admin/categories` | 分类管理 |
| CRUD | `/api/admin/tags` | 标签管理 |
| CRUD | `/api/admin/versions` | 版本管理 |
| CRUD | `/api/admin/audio-files` | 音频管理（含版本绑定、文件上传） |
| GET | `/api/admin/users` | 用户列表/搜索 |
| GET | `/api/admin/orders` | 订单列表/筛选 |
| CRUD | `/api/admin/admins` | 管理员管理（仅 super_admin） |

### 插件专用接口（需用户登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/plugin/login` | 插件端登录，返回 token |
| GET | `/api/plugin/categories` | 分类树 + 音频数据（合并返回，减少请求） |
| GET | `/api/plugin/favorites` | 用户收藏的音频 ID 列表 |
| POST | `/api/plugin/download-url` | 获取音频文件临时下载链接（用于预览/导入） |

---

## 门户网站页面结构

### 1. 首页
- Hero 大图轮播 + 核心功能介绍
- 分类快速入口（一级分类卡片）
- 热门音频推荐
- 会员权益展示 + CTA 购买按钮
- 底部导航：首页 / 音频库 / 会员 / 我的

### 2. 音频库（音频浏览页）
- 顶部搜索栏：关键词 + 分类筛选 + 标签筛选
- 左侧分类树（3 级折叠菜单）
- 右侧音频卡片网格
  - 每张卡片：封面图标、名称、标签、版本选择器（下拉）、试听按钮、收藏按钮
- 点击卡片进入详情

### 3. 音频详情页
- 封面大图 + 名称 + 介绍
- 标签展示 + 分类路径
- 版本列表（每个版本：名称、时长、文件大小、试听按钮）
- 收藏按钮
- 会员专属内容标记（非会员只能试听部分）

### 4. 会员中心
- 会员权益对比表（非会员 vs 会员）
- 价格方案卡片：永久 ¥X / 月付 ¥X / 季付 ¥X / 年付 ¥X
- 支付流程：选择方案 → 确认 → 微信支付 → 支付成功
- 已购会员显示：会员类型、到期时间

### 5. 个人中心
- 头像/昵称编辑
- 我的收藏列表
- 我的推广码（可复制分享）
- 推广记录（被推广人列表）
- 我的订单
- 联系我们

### 6. 登录/注册
- 手机号 + 验证码登录（默认）
- 微信一键授权登录
- 注册时显示"推广码（选填）"输入框
- 注册成功自动生成唯一推广码

---

## 管理后台页面结构

### 1. 登录页
- 管理员用户名 + 密码登录

### 2. 仪表盘
- 统计卡片：音频总数、分类数、用户数、今日订单
- 近期订单列表

### 3. 分类管理
- 树形展示（可折叠 3 级）
- 新增分类：选择父级 → 填写名称 → 确定
- 编辑/删除（删除需确认无子节点和关联音频）
- 同级拖拽排序

### 4. 标签管理
- 标签列表（展示名称 + 颜色圆点）
- 新增/编辑弹窗：名称 + 颜色选择器
- 删除（检查是否有关联音频）

### 5. 版本管理
- 版本池列表（名称 + 排序）
- 新增/编辑/删除

### 6. 音频管理（核心）
- 列表：支持按分类、标签筛选，关键词搜索
- 新增音频：
  - 选择 level=3 分类节点（级联选择器）
  - 填写名称、描述
  - 上传封面图标（图片裁剪）
  - 选择/取消标签（多选标签）
  - 版本管理区：
    - 从版本池勾选版本
    - 每个选中版本 → 上传对应音频文件
    - 显示上传进度
- 编辑音频：修改元数据 + 替换/新增版本文件
- 删除音频（软删除：下架）
- 上架/下架切换

### 7. 管理员管理（仅 super_admin）
- 管理员列表（角色标签）
- 新增：用户名 + 密码 + 角色选择
- 编辑/禁用

### 8. 用户管理
- 用户列表：手机号、昵称、会员状态、注册时间
- 搜索筛选
- 点击查看详情：推广关系树、收藏列表、订单记录

### 9. 订单管理
- 订单列表：用户、类型、金额、状态、时间
- 按状态筛选

---

## Premiere Pro 插件改造方案

### 改造目标

将插件从「本地文件读取」改为「云端 API 获取」，并增加用户登录和鉴权。

### 架构变化

```
改造前：
panel.js ← evalScript → audio_backend.jsx → 本地文件系统 + Premiere Pro API

改造后：
panel.js ← fetch HTTP → uniCloud API（分类/音频数据）
panel.js ← evalScript → audio_backend.jsx → 下载文件 + Premiere Pro API
```

### 改造内容

#### 1. panel.js 改造

**新增登录模块：**
- 启动时检查 localStorage 中的 token
- 无 token → 显示登录面板（手机号 + 验证码输入，发送验证码按钮）
- 登录成功后存储 token，拉取数据
- token 过期 → 自动刷新或重新登录

**数据获取改为 HTTP：**
```javascript
// 改造前：通过 evalScript 调 ExtendScript 读本地文件
csInterface.evalScript('$._AUDIO_PLUGIN_.getAudioFilesForCategory(...)', callback)

// 改造后：直接 fetch API
const res = await fetch(API_BASE + '/api/plugin/categories', {
  headers: { 'Authorization': 'Bearer ' + token }
})
const data = await res.json()
// 渲染分类树和音频列表
```

**缓存策略：**
- 首次加载后缓存分类树和音频列表到内存
- 进入页面时检查缓存有效期（如 5 分钟），过期则重新拉取

**ExtendScript 保留操作（通过 evalScript）：**
- `downloadAndPreview(fileUrl)` — 下载音频到临时目录，Source Monitor 预览
- `downloadAndImport(fileUrl)` — 下载音频，导入项目 Bin
- `downloadAndInsert(fileUrl)` — 下载音频，导入并插入播放头位置
- `stopPreview()` — 停止预览

#### 2. audio_backend.jsx 改造

新增函数：
```javascript
// 下载文件到本地临时目录
downloadFile: function(url, fileName) { ... }

// 下载并预览
downloadAndPreview: function(url) {
  var localPath = this.downloadFile(url, ...);
  // 复用现有 previewAudio 逻辑
}

// 下载并导入
downloadAndImport: function(url) { ... }

// 下载并插入
downloadAndInsert: function(url) { ... }
```

保留现有函数：`previewAudio`, `importAudio`, `insertAudioAtPlayhead`, `stopPreview`

移除：`loadConfig`, `discoverAudioFiles`, `getAudioFilesForCategory` 等本地文件扫描逻辑（这些由 API 替代）。

#### 3. index.html 改造

新增登录面板 HTML：
```html
<div id="login-panel" class="login-overlay">
  <div class="login-card">
    <h3>登录 Audio Plugin</h3>
    <input type="text" id="login-mobile" placeholder="手机号">
    <div class="sms-row">
      <input type="text" id="login-code" placeholder="验证码">
      <button id="btn-send-sms">获取验证码</button>
    </div>
    <button id="btn-login">登录</button>
  </div>
</div>
```

#### 4. style.css 改造

新增登录面板样式（暗色主题，与现有风格一致）。

---

## 技术实现要点

### uniCloud 云函数组织

```
uniCloud-aliyun/
├── cloudfunctions/
│   ├── api/                    # 公开接口
│   │   ├── categories.js
│   │   ├── audio-files.js
│   │   ├── tags.js
│   │   ├── versions.js
│   │   ├── register.js
│   │   └── login.js
│   ├── user/                   # 用户接口
│   │   ├── orders.js
│   │   ├── favorites.js
│   │   └── profile.js
│   ├── admin/                  # 管理接口
│   │   ├── login.js
│   │   ├── dashboard.js
│   │   ├── categories.js
│   │   ├── tags.js
│   │   ├── versions.js
│   │   ├── audio-files.js
│   │   ├── admins.js
│   │   ├── users.js
│   │   └── orders.js
│   └── plugin/                 # 插件接口
│       ├── login.js
│       ├── categories.js
│       ├── favorites.js
│       └── download-url.js
├── common/                     # 公共模块
│   ├── db.js                   # 数据库连接
│   ├── auth.js                 # 鉴权中间件
│   └── utils.js                # 工具函数
└── database/                   # 数据库初始化脚本
    └── init.js
```

### 文件上传流程

1. 管理后台上传音频文件 → uniCloud 云存储
2. 返回 fileID → 写入 audio_versions.file_url
3. 前端/插件请求下载 → 云函数生成临时下载链接（有效期 10 分钟）
4. 插件通过临时链接下载文件到本地临时目录

### 安全要点

- 管理员密码 bcrypt 哈希存储
- 插件接口验证 uni-id token
- 云存储文件使用临时签名 URL（防盗链）
- 短信验证码频率限制（60 秒间隔）
- 管理接口校验 admin role

---

## Stitch 界面生成提示词

见附录 A。

## 附录 A — Stitch 界面交互生成提示词

> 以下提示词用于 stitch 生成门户网站 + 管理后台的 UI 界面和交互。可直接复制使用。

---

请为一个音频素材平台生成完整的 UI 界面和交互原型。平台包含门户网站和管理后台两套界面。

## 整体设计规范

- 设计风格：现代简约，音乐/音频主题
- 主色调：深蓝 #1a1a2e 背景 + 渐变紫蓝 #6c5ce7 强调色
- 字体：中文使用 PingFang SC，数字使用 Inter
- 图标：使用线性风格图标
- 圆角：卡片 12px，按钮 8px
- 移动端优先，适配 H5 和小程序

---

## 一、门户网站

### 1. 首页

**顶部导航栏**（固定，半透明毛玻璃效果）：
- 左侧 Logo + 平台名称"音频素材库"
- 右侧：音频库 | 会员 | 登录/注册按钮（头像下拉菜单）

**Hero 区域**：
- 全屏渐变背景（深蓝→紫）+ 动态音波粒子动画
- 主标题："专业音频素材 · 一站式管理"
- 副标题："为 Premiere Pro 创作者提供高品质配乐素材"
- 两个 CTA 按钮："浏览音频库"（主按钮，白色填充）和"成为会员"（次按钮，边框）

**分类入口区**：
- 标题："探索分类"
- 4 列网格（移动端 2 列），每项：大圆角卡片，渐变背景色不同，图标 + 分类名 + 音频数量

**热门推荐区**：
- 标题："热门推荐"
- 横向滚动卡片（每张 280px 宽）：封面图、名称、标签组、版本下拉、试听/收藏按钮

**会员权益区**：
- 标题："开通会员"
- 3 列对比卡片：免费版 / 月度会员 / 永久会员
- 每列列出权益勾选，底部价格和 CTA 按钮
- 永久会员卡片高亮（边框发光）

**底部 Footer**：
- 版权信息 + 联系方式 + 公众号二维码

### 2. 音频库页面

**顶部筛选栏**：
- 搜索输入框（带搜索图标，placeholder "搜索音频名称..."）
- 标签筛选（横向滚动的 tag 按钮，多选）
- 版本筛选下拉

**左侧分类树**（移动端改为顶部 Tab）：
- 3 级折叠菜单
- 每级缩进 20px
- 选中项高亮（左侧 3px 紫色竖条）

**音频卡片网格**（3 列，移动端 2 列）：
- 每张卡片：
  - 封面图（16:9，圆角上方）
  - 名称（粗体）
  - 描述（2 行截断，灰色小字）
  - 标签行（小圆角标签，不同颜色）
  - 版本选择器（select 下拉，显示如"30秒 · 1.2MB"）
  - 底部操作栏：试听按钮（播放图标）+ 收藏按钮（心形图标）
  - 非会员时点击试听/下载提示"请先开通会员"

**音频详情弹窗/页面**：
- 封面大图（居中）
- 名称 + 分类路径（面包屑）
- 描述全文
- 标签列表
- 版本列表（垂直排列）：
  - 每项：版本名、时长、文件大小、试听按钮、下载按钮
- 收藏按钮（大号心形）

### 3. 会员中心

**会员方案展示**：
- 页面标题："选择适合你的方案"
- 方案卡片（横向排列，3-4 张）：
  - 月付 ¥XX / 季付 ¥XX / 年付 ¥XX / 永久 ¥XXX
  - 每张卡片列出权益（勾号图标）
  - 推荐方案带"最受欢迎"标签
  - 底部"立即购买"按钮

**支付流程**：
- 点击购买 → 弹出支付确认弹窗
  - 方案名称 + 金额
  - 支付方式：微信支付（选中）
  - "确认支付"按钮
- 支付中 loading 动画
- 支付成功：绿色勾号 + "开通成功" + "开始使用"按钮

**我的会员**（已开通时显示）：
- 会员类型标签（金色）
- 到期倒计时（非永久会员）
- "续费"按钮

### 4. 个人中心

**顶部个人信息卡**：
- 头像（可点击编辑）+ 昵称
- 会员状态标签
- 推广码（显示 + 一键复制按钮）

**功能列表**（卡片菜单）：
- 我的收藏（带收藏数量角标）
- 我的订单
- 推广记录
- 联系我们
- 设置
- 退出登录

**我的收藏页**：
- 与音频库卡片布局一致
- 每张卡片额外显示收藏时间
- 支持取消收藏（长按或滑动删除）

**联系我们页**：
- 客服微信二维码
- 客服邮箱
- 在线留言表单（姓名、手机号、留言内容、提交按钮）

### 5. 登录/注册

**登录页**：
- 居中白色卡片（在渐变背景上）
- Tab 切换：手机号登录 | 微信登录
- 手机号登录表单：
  - 手机号输入框（+86 前缀）
  - 验证码输入框 + "获取验证码"按钮（60s 倒计时）
  - "登录/注册"按钮
- 微信登录：绿色"微信一键登录"按钮
- 底部隐私协议勾选框 + 协议链接

**注册时**：
- 登录后如果是新用户 → 弹出补全信息弹窗
- 推广码输入框（选填，"输入推广码可享新用户福利"）

---

## 二、管理后台

### 1. 登录页
- 居中暗色卡片
- Logo + "管理后台"
- 用户名输入框 + 密码输入框
- "登录"按钮

### 2. 整体布局
- 左侧深色侧边栏（可折叠）：
  - 仪表盘 | 分类管理 | 标签管理 | 版本管理 | 音频管理 | 用户管理 | 订单管理 | 管理员管理(super_admin)
  - 当前选中项高亮 + 左侧紫色竖条
- 顶部栏：面包屑导航 + 当前管理员头像/名称 + 退出按钮
- 内容区：白色背景

### 3. 仪表盘
- 4 个统计卡片（带图标 + 数字 + 标签）：音频总数、分类数、用户数、今日订单
- 近期订单表格（用户、方案、金额、状态、时间）
- 最近添加的音频列表（前 10 条）

### 4. 分类管理
- 左侧树形结构（可拖拽排序）
- 右侧操作面板：
  - 新增分类按钮
  - 选中节点后显示编辑/删除按钮
  - 弹窗表单：名称 + 父级选择（级联下拉）
- 删除需要二次确认（检查子节点）

### 5. 标签管理
- 表格列表：标签名 + 颜色圆点 + 操作按钮
- 顶部"新增标签"按钮
- 弹窗表单：名称 + 颜色选择器（预设色板 12 色）

### 6. 版本管理
- 表格列表：版本名 + 排序 + 操作按钮
- 新增/编辑/删除弹窗

### 7. 音频管理（核心页面）
- 顶部筛选：分类级联选择 + 标签多选 + 关键词搜索 + "新增音频"按钮
- 表格/卡片列表：
  - 封面缩略图、名称、分类路径、标签、版本数、状态、操作
- **新增/编辑音频弹窗**（较大，可分步）：
  - Step 1 基本信息：名称 + 描述（textarea）+ 分类选择（级联，只能选 level=3）
  - Step 2 标签绑定：多选标签（标签云形式，点击切换选中）
  - Step 3 封面：拖拽上传 + 裁剪
  - Step 4 版本管理（核心）：
    - 从版本池多选版本（checkbox 列表）
    - 每个选中版本展开文件上传区（拖拽上传 + 进度条）
    - 已上传的显示文件名 + 文件大小 + 删除按钮
  - 底部"保存"按钮

### 8. 管理员管理（super_admin 可见）
- 表格：用户名 + 角色标签 + 状态 + 创建时间 + 操作
- 新增弹窗：用户名 + 密码 + 角色下拉选择

### 9. 用户管理
- 表格：手机号 + 昵称 + 会员标签 + 注册时间 + 操作
- 搜索：手机号/昵称搜索
- 点击查看详情弹窗：
  - 基本信息
  - 推广关系（推广人 + 被推广人列表）
  - 收藏列表
  - 订单记录

### 10. 订单管理
- 表格：订单号 + 用户 + 方案类型 + 金额 + 状态标签 + 时间
- 状态筛选 Tab：全部 / 待支付 / 已支付 / 已退款
- 点击查看详情

---

## 通用交互组件

### Toast 提示
- 成功：绿色 + 勾号图标
- 错误：红色 + 叉号图标
- 从顶部滑入，2 秒自动消失

### 确认弹窗
- 居中模态框 + 半透明遮罩
- 标题 + 描述文字 + 取消/确认按钮
- 危险操作确认按钮为红色

### 加载状态
- 列表：骨架屏（卡片占位灰色块 + 闪光动画）
- 按钮：loading spinner + "处理中..."
- 全页：居中 spinner + 半透明遮罩

### 空状态
- 居中插画 + 灰色文字提示

### 文件上传
- 拖拽区域（虚线边框）或点击选择
- 支持图片（jpg/png）和音频（mp3/wav）
- 上传进度条（百分比 + 蓝色进度条）
- 上传完成显示文件信息

### 级联选择器（分类选择用）
- 点击展开第一级选项
- hover 展开下一级
- 最多 3 级
- 选中后显示完整路径

---
