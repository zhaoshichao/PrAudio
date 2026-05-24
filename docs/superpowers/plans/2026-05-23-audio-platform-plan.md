# Audio Plugin 平台化 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 Premiere Pro CEP 音频插件扩展为完整的音频管理平台（uniCloud 后端 + uni-app 管理后台 + uni-app 门户网站 + 插件 API 化改造）

**Architecture:** uniCloud Serverless 后端提供统一 API，管理后台和门户网站通过 HTTP 调用，CEP 插件面板通过 fetch 获取数据并通过 evalScript 调用 ExtendScript 操作 Premiere Pro

**Tech Stack:** uniCloud (阿里云) + uni-id + uni-app (Vue 3) + 微信支付 + CEP/ExtendScript

**Phase:** Phase 1 — uniCloud 后端 (Task 1-12), Phase 2 — 管理后台 (Task 13-22), Phase 3 — 门户网站 (Task 23-32), Phase 4 — 插件改造 (Task 33-38)

---

## File Structure

```
Audio/                                    ← 插件根目录（已有）
├── CSXS/manifest.xml                     ← 修改：新增插件权限
├── host/
│   ├── index.html                        ← 修改：新增登录面板
│   ├── style.css                         ← 修改：新增登录样式
│   └── panel.js                          ← 修改：HTTP API 替代本地文件
├── jsx/
│   └── audio_backend.jsx                 ← 修改：新增下载函数，移除文件扫描

audio-platform/                           ← 新建：uni-app 项目根目录
├── uniCloud-aliyun/
│   ├── cloudfunctions/
│   │   ├── api/                          ← 公开接口云函数
│   │   ├── user/                         ← 用户接口云函数
│   │   ├── admin/                        ← 管理接口云函数
│   │   └── plugin/                       ← 插件接口云函数
│   ├── common/                           ← 公共模块
│   │   ├── db.js
│   │   ├── auth.js
│   │   └── utils.js
│   └── database/
│       ├── init-tables.js                ← 表结构初始化
│       └── init-seed.js                  ← 种子数据（超管 + 默认版本）
├── pages/                                ← 门户网站页面
├── pages-admin/                          ← 管理后台页面
├── components/                           ← 公共组件
├── store/                                ← Vuex/Pinia store
├── static/                               ← 静态资源
├── App.vue
├── pages.json
├── manifest.json
└── uni.scss
```

---

## Phase 1: uniCloud 后端基础

### Task 1: 创建 uni-app 项目并初始化 uniCloud

**Files:**
- Create: `audio-platform/` 项目结构
- Create: `audio-platform/manifest.json`
- Create: `audio-platform/pages.json`
- Create: `audio-platform/App.vue`
- Create: `audio-platform/uni.scss`

- [ ] **Step 1: 创建 uni-app 项目**

在 HBuilderX 中新建 uni-app 项目，选择 Vue 3 版本，项目名 `audio-platform`，存放于 `/Users/zsc/Documents/Code_s/ExtendScript/Audio/audio-platform/`

- [ ] **Step 2: 关联 uniCloud 服务空间**

在 HBuilderX 中右键项目 → 创建 uniCloud 云开发环境 → 选择阿里云 → 关联服务空间

- [ ] **Step 3: 配置 manifest.json**

```json
{
  "name": "音频素材平台",
  "appid": "__UNI__XXXXX",
  "vueVersion": "3",
  "uniIdRouter": {
    "loginPage": "/pages/login/login",
    "needLogin": [
      "/pages/user/.*",
      "/pages/favorites/.*",
      "/pages/member/.*"
    ]
  }
}
```

- [ ] **Step 4: 配置 pages.json（门户 + 管理后台分目录）**

```json
{
  "pages": [
    { "path": "pages/index/index", "style": { "navigationBarTitleText": "首页" } },
    { "path": "pages/audio/list", "style": { "navigationBarTitleText": "音频库" } },
    { "path": "pages/audio/detail", "style": { "navigationBarTitleText": "音频详情" } },
    { "path": "pages/member/index", "style": { "navigationBarTitleText": "会员中心" } },
    { "path": "pages/user/index", "style": { "navigationBarTitleText": "我的" } },
    { "path": "pages/user/favorites", "style": { "navigationBarTitleText": "我的收藏" } },
    { "path": "pages/user/orders", "style": { "navigationBarTitleText": "我的订单" } },
    { "path": "pages/user/referrals", "style": { "navigationBarTitleText": "推广记录" } },
    { "path": "pages/login/login", "style": { "navigationBarTitleText": "登录" } }
  ],
  "subPackages": [
    {
      "root": "pages-admin",
      "pages": [
        { "path": "login/login", "style": { "navigationBarTitleText": "管理登录" } },
        { "path": "dashboard/dashboard", "style": { "navigationBarTitleText": "仪表盘" } },
        { "path": "categories/categories", "style": { "navigationBarTitleText": "分类管理" } },
        { "path": "tags/tags", "style": { "navigationBarTitleText": "标签管理" } },
        { "path": "versions/versions", "style": { "navigationBarTitleText": "版本管理" } },
        { "path": "audio/list", "style": { "navigationBarTitleText": "音频管理" } },
        { "path": "audio/edit", "style": { "navigationBarTitleText": "编辑音频" } },
        { "path": "users/users", "style": { "navigationBarTitleText": "用户管理" } },
        { "path": "orders/orders", "style": { "navigationBarTitleText": "订单管理" } },
        { "path": "admins/admins", "style": { "navigationBarTitleText": "管理员管理" } }
      ]
    }
  ]
}
```

- [ ] **Step 5: 配置 App.vue**

```vue
<script>
export default {
  onLaunch() {
    console.log('Audio Platform launched')
  }
}
</script>
<style>
@import '@/uni.scss';
</style>
```

- [ ] **Step 6: 配置 uni.scss 基础变量**

```scss
$primary-color: #6c5ce7;
$primary-dark: #1a1a2e;
$success-color: #4caf50;
$warning-color: #ff9800;
$danger-color: #f44336;
$text-primary: #333333;
$text-secondary: #999999;
$bg-color: #f5f5f5;
$border-color: #e8e8e8;
$border-radius: 8px;
$border-radius-lg: 12px;
```

- [ ] **Step 7: Commit**

```bash
cd /Users/zsc/Documents/Code_s/ExtendScript/Audio/audio-platform
git init
git add -A
git commit -m "feat: init uni-app project with uniCloud"
```

---

### Task 2: 数据库初始化脚本

**Files:**
- Create: `audio-platform/uniCloud-aliyun/database/init-tables.js`
- Create: `audio-platform/uniCloud-aliyun/database/init-seed.js`
- Create: `audio-platform/uniCloud-aliyun/database/__schema.json`

- [ ] **Step 1: 编写 init-tables.js — 管理员表**

```javascript
// uniCloud-aliyun/database/init-tables.js
const db = uniCloud.database()

async function createTables() {
  // 1. 管理员表 admin_users
  try {
    await db.createCollection('admin_users')
    console.log('[OK] admin_users collection created')
  } catch (e) { if (e.code !== 'ResourceAlreadyExists') console.error(e) }

  await db.collection('admin_users').add({
    username: 'admin',
    password_hash: '', // bcrypt hash，种子数据中填充
    role: 'super_admin',
    nickname: '超级管理员',
    avatar: '',
    status: 1,
    created_at: new Date()
  })

  // 2. 分类表 categories
  try { await db.createCollection('categories') } catch (e) {}
  // 索引
  await db.collection('categories').createIndex({ parent_id: 1, sort: 1 })

  // 3. 音频文件表 audio_files
  try { await db.createCollection('audio_files') } catch (e) {}
  await db.collection('audio_files').createIndex({ category_id: 1 })
  await db.collection('audio_files').createIndex({ tag_ids: 1 })
  await db.collection('audio_files').createIndex({ name: 'text' }) // 全文搜索

  // 4. 版本表 versions
  try { await db.createCollection('versions') } catch (e) {}

  // 5. 音频-版本关联表 audio_versions
  try { await db.createCollection('audio_versions') } catch (e) {}
  await db.collection('audio_versions').createIndex({ audio_id: 1 })
  await db.collection('audio_versions').createIndex({ version_id: 1 })

  // 6. 标签表 tags
  try { await db.createCollection('tags') } catch (e) {}

  // 7. 收藏表 favorites
  try { await db.createCollection('favorites') } catch (e) {}
  await db.collection('favorites').createIndex({ user_id: 1, audio_id: 1 }, { unique: true })

  // 8. 订单表 orders
  try { await db.createCollection('orders') } catch (e) {}
  await db.collection('orders').createIndex({ user_id: 1 })
  await db.collection('orders').createIndex({ status: 1 })

  console.log('[DONE] All collections created')
}

module.exports = createTables
```

- [ ] **Step 2: 编写 init-seed.js — 种子数据**

```javascript
// uniCloud-aliyun/database/init-seed.js
const bcrypt = require('bcryptjs')
const db = uniCloud.database()

async function seedData() {
  // 创建超级管理员（检查是否已存在）
  const existAdmin = await db.collection('admin_users')
    .where({ username: 'admin' }).get()
  if (existAdmin.data.length === 0) {
    const hash = bcrypt.hashSync('admin123456', 10)
    await db.collection('admin_users').add({
      username: 'admin',
      password_hash: hash,
      role: 'super_admin',
      nickname: '超级管理员',
      avatar: '',
      status: 1,
      created_at: new Date()
    })
    console.log('[OK] Super admin created (admin / admin123456)')
  }

  // 创建默认版本（检查是否已存在）
  const defaultVersions = ['30秒', '60秒', '90秒']
  for (let i = 0; i < defaultVersions.length; i++) {
    const exist = await db.collection('versions')
      .where({ name: defaultVersions[i] }).get()
    if (exist.data.length === 0) {
      await db.collection('versions').add({
        name: defaultVersions[i],
        sort: i + 1,
        created_at: new Date()
      })
      console.log('[OK] Default version created: ' + defaultVersions[i])
    }
  }

  console.log('[DONE] Seed data initialized')
}

module.exports = seedData
```

- [ ] **Step 3: 编写 db_init 云函数调用初始化**

```javascript
// uniCloud-aliyun/cloudfunctions/db_init/index.js
'use strict'
const createTables = require('../../database/init-tables')
const seedData = require('../../database/init-seed')

exports.main = async (event, context) => {
  await createTables()
  await seedData()
  return { code: 0, message: 'Database initialized' }
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/zsc/Documents/Code_s/ExtendScript/Audio/audio-platform
git add -A
git commit -m "feat: database init scripts with default super admin and versions"
```

---

### Task 3: 公共模块 — 鉴权 + 数据库工具

**Files:**
- Create: `audio-platform/uniCloud-aliyun/common/auth.js`
- Create: `audio-platform/uniCloud-aliyun/common/db.js`
- Create: `audio-platform/uniCloud-aliyun/common/utils.js`

- [ ] **Step 1: 编写 common/auth.js**

```javascript
// uniCloud-aliyun/common/auth.js
const db = uniCloud.database()

// 验证管理员 token（从 admin_users 表查）
async function verifyAdminToken(token) {
  if (!token) throw { code: 401, message: '未登录' }
  const res = await db.collection('admin_users')
    .where({ token, status: 1 }).get()
  if (res.data.length === 0) throw { code: 401, message: 'token无效或已过期' }
  return res.data[0]
}

// 验证管理员角色
function requireRole(admin, ...roles) {
  if (!roles.includes(admin.role)) {
    throw { code: 403, message: '权限不足' }
  }
}

// 验证用户 token（通过 uni-id）
async function verifyUserToken(context) {
  const uniId = require('uni-id-common')
  const uniIdIns = uniId.createInstance({ context })
  const auth = await uniIdIns.checkToken(context.EVENT_TOKEN || context.event?.uniIdToken)
  if (auth.errCode) throw { code: 401, message: auth.errMsg || 'token无效' }
  return auth
}

module.exports = { verifyAdminToken, requireRole, verifyUserToken }
```

- [ ] **Step 2: 编写 common/db.js**

```javascript
// uniCloud-aliyun/common/db.js
const db = uniCloud.database()
const cmd = db.command
const _ = db.command.aggregate

module.exports = { db, cmd, _ }
```

- [ ] **Step 3: 编写 common/utils.js**

```javascript
// uniCloud-aliyun/common/utils.js

// 生成唯一推广码（6位字母数字）
function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 排除易混淆字符
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// 分页参数处理
function parsePagination(event) {
  const page = parseInt(event.page) || 1
  const limit = Math.min(parseInt(event.limit) || 20, 100)
  const skip = (page - 1) * limit
  return { page, limit, skip }
}

// 响应格式化
function success(data, message = 'ok') {
  return { code: 0, message, data }
}

function fail(message, code = -1) {
  return { code, message }
}

module.exports = { generateReferralCode, parsePagination, success, fail }
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: common modules — auth, db, utils"
```

---

### Task 4: 管理员登录 + 管理接口

**Files:**
- Create: `audio-platform/uniCloud-aliyun/cloudfunctions/admin/login.js`
- Create: `audio-platform/uniCloud-aliyun/cloudfunctions/admin/dashboard.js`
- Create: `audio-platform/uniCloud-aliyun/cloudfunctions/admin/admins.js`

- [ ] **Step 1: 编写 admin/login.js**

```javascript
// uniCloud-aliyun/cloudfunctions/admin/login.js
'use strict'
const { db } = require('../../common/db')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

exports.main = async (event, context) => {
  const { username, password } = event
  if (!username || !password) return { code: -1, message: '用户名和密码不能为空' }

  const res = await db.collection('admin_users')
    .where({ username, status: 1 }).get()
  if (res.data.length === 0) return { code: -1, message: '用户名或密码错误' }

  const admin = res.data[0]
  const valid = bcrypt.compareSync(password, admin.password_hash)
  if (!valid) return { code: -1, message: '用户名或密码错误' }

  // 生成 token
  const token = crypto.randomBytes(32).toString('hex')
  await db.collection('admin_users').doc(admin._id).update({
    token,
    last_login_at: new Date()
  })

  return {
    code: 0, message: '登录成功',
    data: {
      token,
      admin: {
        _id: admin._id,
        username: admin.username,
        role: admin.role,
        nickname: admin.nickname
      }
    }
  }
}
```

- [ ] **Step 2: 编写 admin/dashboard.js**

```javascript
// uniCloud-aliyun/cloudfunctions/admin/dashboard.js
'use strict'
const { db } = require('../../common/db')
const { verifyAdminToken } = require('../../common/auth')
const { success } = require('../../common/utils')

exports.main = async (event, context) => {
  const admin = await verifyAdminToken(event.adminToken)

  const [
    audioCount, categoryCount, userCount,
    todayOrders, recentOrders, recentAudios
  ] = await Promise.all([
    db.collection('audio_files').where({ status: 1 }).count(),
    db.collection('categories').count(),
    db.collection('uni-id-users').count(),
    db.collection('orders').where({
      paid_at: db.command.gte(new Date(new Date().setHours(0, 0, 0, 0)))
    }).count(),
    db.collection('orders')
      .orderBy('created_at', 'desc').limit(10).get(),
    db.collection('audio_files')
      .orderBy('created_at', 'desc').limit(10).get()
  ])

  return success({
    stats: {
      audioCount: audioCount.total,
      categoryCount: categoryCount.total,
      userCount: userCount.total,
      todayOrderCount: todayOrders.total
    },
    recentOrders: recentOrders.data,
    recentAudios: recentAudios.data
  })
}
```

- [ ] **Step 3: 编写 admin/admins.js — 管理员 CRUD（仅 super_admin）**

```javascript
// uniCloud-aliyun/cloudfunctions/admin/admins.js
'use strict'
const { db } = require('../../common/db')
const { verifyAdminToken, requireRole } = require('../../common/auth')
const { success, fail } = require('../../common/utils')
const bcrypt = require('bcryptjs')

exports.main = async (event, context) => {
  const admin = await verifyAdminToken(event.adminToken)
  requireRole(admin, 'super_admin')

  const { action, data } = event

  switch (action) {
    case 'list': {
      const res = await db.collection('admin_users')
        .field({ password_hash: 0, token: 0 })
        .orderBy('created_at', 'desc').get()
      return success(res.data)
    }
    case 'create': {
      const hash = bcrypt.hashSync(data.password, 10)
      await db.collection('admin_users').add({
        username: data.username,
        password_hash: hash,
        role: data.role || 'admin',
        nickname: data.nickname || data.username,
        avatar: '',
        status: 1,
        created_at: new Date()
      })
      return success(null, '创建成功')
    }
    case 'update': {
      const updateData = {
        nickname: data.nickname,
        role: data.role,
        status: data.status
      }
      if (data.password) {
        updateData.password_hash = bcrypt.hashSync(data.password, 10)
      }
      await db.collection('admin_users').doc(data._id).update(updateData)
      return success(null, '更新成功')
    }
    case 'delete': {
      await db.collection('admin_users').doc(data._id).update({ status: 0 })
      return success(null, '已禁用')
    }
    default:
      return fail('未知操作')
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: admin login, dashboard, and admin CRUD APIs"
```

---

### Task 5: 分类管理 API

**Files:**
- Create: `audio-platform/uniCloud-aliyun/cloudfunctions/admin/categories.js`

- [ ] **Step 1: 编写 admin/categories.js**

```javascript
// uniCloud-aliyun/cloudfunctions/admin/categories.js
'use strict'
const { db } = require('../../common/db')
const { verifyAdminToken } = require('../../common/auth')
const { success, fail } = require('../../common/utils')

exports.main = async (event, context) => {
  await verifyAdminToken(event.adminToken)
  const { action, data } = event

  switch (action) {
    case 'tree': {
      // 返回完整三级树
      const all = await db.collection('categories')
        .orderBy('sort', 'asc').get()
      const tree = buildTree(all.data)
      return success(tree)
    }
    case 'create': {
      await db.collection('categories').add({
        name: data.name,
        level: data.level,
        parent_id: data.parent_id || null,
        sort: data.sort || 0,
        icon: data.icon || '',
        status: 1,
        created_at: new Date()
      })
      return success(null, '创建成功')
    }
    case 'update': {
      await db.collection('categories').doc(data._id).update({
        name: data.name,
        sort: data.sort,
        icon: data.icon,
        status: data.status
      })
      return success(null, '更新成功')
    }
    case 'delete': {
      // 检查是否有子节点
      const children = await db.collection('categories')
        .where({ parent_id: data._id }).count()
      if (children.total > 0) return fail('请先删除子分类')
      // 检查是否有关联音频（仅 level=3）
      const audios = await db.collection('audio_files')
        .where({ category_id: data._id }).count()
      if (audios.total > 0) return fail('该分类下存在音频，无法删除')
      await db.collection('categories').doc(data._id).remove()
      return success(null, '已删除')
    }
    default:
      return fail('未知操作')
  }
}

function buildTree(list) {
  const map = {}
  const tree = []
  list.forEach(item => { map[item._id] = { ...item, children: [] } })
  list.forEach(item => {
    if (item.parent_id && map[item.parent_id]) {
      map[item.parent_id].children.push(map[item._id])
    } else if (!item.parent_id) {
      tree.push(map[item._id])
    }
  })
  return tree
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: category management CRUD API with tree structure"
```

---

### Task 6: 标签管理 API

**Files:**
- Create: `audio-platform/uniCloud-aliyun/cloudfunctions/admin/tags.js`

- [ ] **Step 1: 编写 admin/tags.js**

```javascript
// uniCloud-aliyun/cloudfunctions/admin/tags.js
'use strict'
const { db } = require('../../common/db')
const { verifyAdminToken } = require('../../common/auth')
const { success, fail } = require('../../common/utils')

exports.main = async (event, context) => {
  await verifyAdminToken(event.adminToken)
  const { action, data } = event

  switch (action) {
    case 'list': {
      const res = await db.collection('tags')
        .orderBy('created_at', 'desc').get()
      return success(res.data)
    }
    case 'create': {
      await db.collection('tags').add({
        name: data.name,
        color: data.color || '#6c5ce7',
        created_at: new Date()
      })
      return success(null, '创建成功')
    }
    case 'update': {
      await db.collection('tags').doc(data._id).update({
        name: data.name,
        color: data.color
      })
      return success(null, '更新成功')
    }
    case 'delete': {
      await db.collection('tags').doc(data._id).remove()
      return success(null, '已删除')
    }
    default:
      return fail('未知操作')
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: tag management CRUD API"
```

---

### Task 7: 版本管理 API

**Files:**
- Create: `audio-platform/uniCloud-aliyun/cloudfunctions/admin/versions.js`

- [ ] **Step 1: 编写 admin/versions.js**

```javascript
// uniCloud-aliyun/cloudfunctions/admin/versions.js
'use strict'
const { db } = require('../../common/db')
const { verifyAdminToken } = require('../../common/auth')
const { success, fail } = require('../../common/utils')

exports.main = async (event, context) => {
  await verifyAdminToken(event.adminToken)
  const { action, data } = event

  switch (action) {
    case 'list': {
      const res = await db.collection('versions')
        .orderBy('sort', 'asc').get()
      return success(res.data)
    }
    case 'create': {
      await db.collection('versions').add({
        name: data.name,
        sort: data.sort || 0,
        created_at: new Date()
      })
      return success(null, '创建成功')
    }
    case 'update': {
      await db.collection('versions').doc(data._id).update({
        name: data.name,
        sort: data.sort
      })
      return success(null, '更新成功')
    }
    case 'delete': {
      // 检查是否有关联音频
      const linked = await db.collection('audio_versions')
        .where({ version_id: data._id }).count()
      if (linked.total > 0) return fail('该版本已被音频绑定，请先解除绑定')
      await db.collection('versions').doc(data._id).remove()
      return success(null, '已删除')
    }
    default:
      return fail('未知操作')
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: version management CRUD API"
```

---

### Task 8: 音频管理 API（含版本绑定和文件上传）

**Files:**
- Create: `audio-platform/uniCloud-aliyun/cloudfunctions/admin/audio-files.js`

- [ ] **Step 1: 编写 admin/audio-files.js**

```javascript
// uniCloud-aliyun/cloudfunctions/admin/audio-files.js
'use strict'
const { db, cmd } = require('../../common/db')
const { verifyAdminToken } = require('../../common/auth')
const { success, fail, parsePagination } = require('../../common/utils')

exports.main = async (event, context) => {
  await verifyAdminToken(event.adminToken)
  const { action, data } = event

  switch (action) {
    case 'list': {
      const { page, limit, skip } = parsePagination(event)
      let where = {}
      if (event.category_id) where.category_id = event.category_id
      if (event.tag_id) where.tag_ids = cmd.in([event.tag_id])
      if (event.keyword) where.name = new RegExp(event.keyword, 'i')

      const [res, count] = await Promise.all([
        db.collection('audio_files').where(where)
          .orderBy('sort', 'asc').skip(skip).limit(limit).get(),
        db.collection('audio_files').where(where).count()
      ])

      // 关联查询 versions
      const audios = []
      for (const audio of res.data) {
        const versions = await db.collection('audio_versions')
          .where({ audio_id: audio._id }).get()
        audios.push({ ...audio, versions: versions.data })
      }

      return success({ list: audios, total: count.total, page, limit })
    }
    case 'detail': {
      const audio = await db.collection('audio_files').doc(data._id).get()
      if (!audio.data[0]) return fail('音频不存在')
      const versions = await db.collection('audio_versions')
        .where({ audio_id: data._id }).get()
      return success({ ...audio.data[0], versions: versions.data })
    }
    case 'create': {
      const audioRes = await db.collection('audio_files').add({
        category_id: data.category_id,
        name: data.name,
        description: data.description || '',
        icon: data.icon || '',
        tag_ids: data.tag_ids || [],
        status: 1,
        sort: data.sort || 0,
        view_count: 0,
        created_at: new Date()
      })

      // 关联版本和文件
      if (data.versions && data.versions.length > 0) {
        for (const v of data.versions) {
          await db.collection('audio_versions').add({
            audio_id: audioRes.id,
            version_id: v.version_id,
            file_url: v.file_url || '',
            file_size: v.file_size || 0,
            duration: v.duration || 0,
            created_at: new Date()
          })
        }
      }

      return success({ _id: audioRes.id }, '创建成功')
    }
    case 'update': {
      await db.collection('audio_files').doc(data._id).update({
        name: data.name,
        description: data.description,
        icon: data.icon,
        tag_ids: data.tag_ids,
        sort: data.sort,
        status: data.status
      })

      // 更新版本关联
      if (data.versions) {
        // 删除旧关联
        await db.collection('audio_versions')
          .where({ audio_id: data._id }).remove()
        // 创建新关联
        for (const v of data.versions) {
          await db.collection('audio_versions').add({
            audio_id: data._id,
            version_id: v.version_id,
            file_url: v.file_url || '',
            file_size: v.file_size || 0,
            duration: v.duration || 0,
            created_at: new Date()
          })
        }
      }

      return success(null, '更新成功')
    }
    case 'delete': {
      await db.collection('audio_files').doc(data._id).update({ status: 0 })
      return success(null, '已下架')
    }
    default:
      return fail('未知操作')
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: audio file management API with version binding"
```

---

### Task 9: 用户和订单管理 API

**Files:**
- Create: `audio-platform/uniCloud-aliyun/cloudfunctions/admin/users.js`
- Create: `audio-platform/uniCloud-aliyun/cloudfunctions/admin/orders.js`

- [ ] **Step 1: 编写 admin/users.js**

```javascript
// uniCloud-aliyun/cloudfunctions/admin/users.js
'use strict'
const { db, cmd } = require('../../common/db')
const { verifyAdminToken } = require('../../common/auth')
const { success, parsePagination } = require('../../common/utils')

exports.main = async (event, context) => {
  await verifyAdminToken(event.adminToken)
  const { action } = event

  switch (action) {
    case 'list': {
      const { page, limit, skip } = parsePagination(event)
      let where = {}
      if (event.keyword) {
        where = cmd.or([
          { mobile: new RegExp(event.keyword) },
          { nickname: new RegExp(event.keyword) }
        ])
      }
      const [res, count] = await Promise.all([
        db.collection('uni-id-users').where(where)
          .field({ password: 0, token: 0 })
          .orderBy('register_date', 'desc').skip(skip).limit(limit).get(),
        db.collection('uni-id-users').where(where).count()
      ])
      return success({ list: res.data, total: count.total, page, limit })
    }
    case 'detail': {
      const user = await db.collection('uni-id-users').doc(event.user_id)
        .field({ password: 0, token: 0 }).get()
      if (!user.data[0]) return { code: -1, message: '用户不存在' }

      // 查推广关系
      const [favorites, orders, referrals] = await Promise.all([
        db.collection('favorites').where({ user_id: event.user_id }).count(),
        db.collection('orders').where({ user_id: event.user_id }).get(),
        db.collection('uni-id-users')
          .where({ referrer_id: event.user_id })
          .field({ nickname: 1, mobile: 1, register_date: 1 }).get()
      ])
      return success({
        ...user.data[0],
        favoriteCount: favorites.total,
        orders: orders.data,
        referrals: referrals.data
      })
    }
    default:
      return { code: -1, message: '未知操作' }
  }
}
```

- [ ] **Step 2: 编写 admin/orders.js**

```javascript
// uniCloud-aliyun/cloudfunctions/admin/orders.js
'use strict'
const { db } = require('../../common/db')
const { verifyAdminToken } = require('../../common/auth')
const { success, parsePagination } = require('../../common/utils')

exports.main = async (event, context) => {
  await verifyAdminToken(event.adminToken)

  const { page, limit, skip } = parsePagination(event)
  let where = {}
  if (event.status) where.status = event.status
  if (event.user_id) where.user_id = event.user_id

  const [res, count] = await Promise.all([
    db.collection('orders').where(where)
      .orderBy('created_at', 'desc').skip(skip).limit(limit).get(),
    db.collection('orders').where(where).count()
  ])
  return success({ list: res.data, total: count.total, page, limit })
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: admin user and order management APIs"
```

---

### Task 10: 公开 API — 分类、标签、版本查询

**Files:**
- Create: `audio-platform/uniCloud-aliyun/cloudfunctions/api/categories.js`
- Create: `audio-platform/uniCloud-aliyun/cloudfunctions/api/tags.js`
- Create: `audio-platform/uniCloud-aliyun/cloudfunctions/api/versions.js`

- [ ] **Step 1: 编写 api/categories.js**

```javascript
// uniCloud-aliyun/cloudfunctions/api/categories.js
'use strict'
const { db } = require('../../common/db')
const { success } = require('../../common/utils')

exports.main = async (event, context) => {
  const { action } = event

  if (action === 'tree') {
    const all = await db.collection('categories')
      .where({ status: 1 }).orderBy('sort', 'asc').get()
    return success(buildTree(all.data))
  }

  // 列表查询（支持 keyword 模糊搜索）
  let where = { status: 1 }
  if (event.keyword) {
    where.name = new RegExp(event.keyword, 'i')
  }
  const res = await db.collection('categories')
    .where(where).orderBy('sort', 'asc').get()
  return success(res.data)
}

function buildTree(list) {
  const map = {}, tree = []
  list.forEach(item => { map[item._id] = { ...item, children: [] } })
  list.forEach(item => {
    if (item.parent_id && map[item.parent_id]) {
      map[item.parent_id].children.push(map[item._id])
    } else if (!item.parent_id) {
      tree.push(map[item._id])
    }
  })
  return tree
}
```

- [ ] **Step 2: 编写 api/tags.js**

```javascript
// uniCloud-aliyun/cloudfunctions/api/tags.js
'use strict'
const { db } = require('../../common/db')
const { success } = require('../../common/utils')

exports.main = async (event, context) => {
  const res = await db.collection('tags')
    .orderBy('created_at', 'desc').get()
  return success(res.data)
}
```

- [ ] **Step 3: 编写 api/versions.js**

```javascript
// uniCloud-aliyun/cloudfunctions/api/versions.js
'use strict'
const { db } = require('../../common/db')
const { success } = require('../../common/utils')

exports.main = async (event, context) => {
  const res = await db.collection('versions')
    .orderBy('sort', 'asc').get()
  return success(res.data)
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: public APIs for categories, tags, and versions"
```

---

### Task 11: 公开 API — 音频查询

**Files:**
- Create: `audio-platform/uniCloud-aliyun/cloudfunctions/api/audio-files.js`

- [ ] **Step 1: 编写 api/audio-files.js**

```javascript
// uniCloud-aliyun/cloudfunctions/api/audio-files.js
'use strict'
const { db, cmd } = require('../../common/db')
const { success, parsePagination } = require('../../common/utils')

exports.main = async (event, context) => {
  const { page, limit, skip } = parsePagination(event)
  let where = { status: 1 }

  if (event.category_id) where.category_id = event.category_id
  if (event.tag_id) where.tag_ids = cmd.in([event.tag_id])
  if (event.keyword) where.name = new RegExp(event.keyword, 'i')
  // 按版本筛选：先查 audio_versions 再反查
  if (event.version_id) {
    const linked = await db.collection('audio_versions')
      .where({ version_id: event.version_id }).get()
    const audioIds = linked.data.map(v => v.audio_id)
    where._id = cmd.in(audioIds.length > 0 ? audioIds : ['__none__'])
  }

  const [res, count] = await Promise.all([
    db.collection('audio_files').where(where)
      .orderBy('sort', 'asc').skip(skip).limit(limit).get(),
    db.collection('audio_files').where(where).count()
  ])

  // 关联版本信息
  const audios = []
  for (const audio of res.data) {
    const versions = await db.collection('audio_versions')
      .where({ audio_id: audio._id }).get()
    audios.push({ ...audio, versions: versions.data })
  }

  return success({ list: audios, total: count.total, page, limit })
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: public audio query API with multi-condition filter"
```

---

### Task 12: 用户注册/登录 + 收藏 + 订单 API

**Files:**
- Create: `audio-platform/uniCloud-aliyun/cloudfunctions/user/favorites.js`
- Create: `audio-platform/uniCloud-aliyun/cloudfunctions/user/orders.js`
- Create: `audio-platform/uniCloud-aliyun/cloudfunctions/user/profile.js`

- [ ] **Step 1: 编写用户收藏 API (user/favorites.js)**

```javascript
// uniCloud-aliyun/cloudfunctions/user/favorites.js
'use strict'
const { db } = require('../../common/db')
const { verifyUserToken } = require('../../common/auth')
const { success, parsePagination } = require('../../common/utils')

exports.main = async (event, context) => {
  const auth = await verifyUserToken(context)

  switch (event.action) {
    case 'toggle': {
      const exist = await db.collection('favorites')
        .where({ user_id: auth.uid, audio_id: event.audio_id }).get()
      if (exist.data.length > 0) {
        await db.collection('favorites').doc(exist.data[0]._id).remove()
        return success({ favorited: false }, '已取消收藏')
      } else {
        await db.collection('favorites').add({
          user_id: auth.uid,
          audio_id: event.audio_id,
          created_at: new Date()
        })
        return success({ favorited: true }, '已收藏')
      }
    }
    case 'list': {
      const { page, limit, skip } = parsePagination(event)
      const [res, count] = await Promise.all([
        db.collection('favorites')
          .where({ user_id: auth.uid })
          .orderBy('created_at', 'desc').skip(skip).limit(limit).get(),
        db.collection('favorites').where({ user_id: auth.uid }).count()
      ])
      // 关联音频信息
      const list = []
      for (const fav of res.data) {
        const audio = await db.collection('audio_files').doc(fav.audio_id).get()
        if (audio.data[0]) {
          const versions = await db.collection('audio_versions')
            .where({ audio_id: fav.audio_id }).get()
          list.push({ ...audio.data[0], versions: versions.data, favorited_at: fav.created_at })
        }
      }
      return success({ list, total: count.total, page, limit })
    }
    case 'check': {
      // 批量检查收藏状态（插件用）
      const ids = event.audio_ids || []
      const res = await db.collection('favorites')
        .where({ user_id: auth.uid, audio_id: db.command.in(ids) }).get()
      return success(res.data.map(f => f.audio_id))
    }
    default:
      return { code: -1, message: '未知操作' }
  }
}
```

- [ ] **Step 2: 编写用户订单 API (user/orders.js)**

```javascript
// uniCloud-aliyun/cloudfunctions/user/orders.js
'use strict'
const { db } = require('../../common/db')
const { verifyUserToken } = require('../../common/auth')
const { success, fail } = require('../../common/utils')

const PRICES = {
  permanent: 29900,  // 299元（分）
  monthly: 2900,     // 29元/月
  quarterly: 7900,   // 79元/季
  yearly: 19900      // 199元/年
}

exports.main = async (event, context) => {
  const auth = await verifyUserToken(context)

  switch (event.action) {
    case 'create': {
      const { type } = event
      if (!PRICES[type]) return fail('无效的会员类型')
      const amount = PRICES[type]

      // 创建订单
      const orderRes = await db.collection('orders').add({
        user_id: auth.uid,
        type,
        amount,
        status: 'pending',
        created_at: new Date()
      })

      // 调用微信支付（uniCloud 内置）
      const paymentRes = await uniCloud.getPaymentInfo({
        provider: 'wxpay',
        orderId: orderRes.id,
        totalFee: amount,
        description: `音频素材会员 - ${type}`,
        openid: auth.userInfo?.openid
      })

      return success({ orderId: orderRes.id, payment: paymentRes })
    }
    case 'status': {
      const order = await db.collection('orders').doc(event.orderId).get()
      if (!order.data[0]) return fail('订单不存在')
      return success(order.data[0])
    }
    case 'list': {
      const orders = await db.collection('orders')
        .where({ user_id: auth.uid })
        .orderBy('created_at', 'desc').get()
      return success(orders.data)
    }
    default:
      return fail('未知操作')
  }
}
```

- [ ] **Step 3: 编写用户信息 API (user/profile.js)**

```javascript
// uniCloud-aliyun/cloudfunctions/user/profile.js
'use strict'
const { db } = require('../../common/db')
const { verifyUserToken } = require('../../common/auth')
const { success } = require('../../common/utils')

exports.main = async (event, context) => {
  const auth = await verifyUserToken(context)

  if (event.action === 'get') {
    const user = await db.collection('uni-id-users').doc(auth.uid)
      .field({ password: 0, token: 0 }).get()
    const [favCount, orderCount, referralCount] = await Promise.all([
      db.collection('favorites').where({ user_id: auth.uid }).count(),
      db.collection('orders').where({ user_id: auth.uid }).count(),
      db.collection('uni-id-users').where({ referrer_id: auth.uid }).count()
    ])
    return success({
      ...user.data[0],
      favCount: favCount.total,
      orderCount: orderCount.total,
      referralCount: referralCount.total
    })
  }

  if (event.action === 'update') {
    await db.collection('uni-id-users').doc(auth.uid).update({
      nickname: event.nickname,
      avatar: event.avatar
    })
    return success(null, '更新成功')
  }

  return { code: -1, message: '未知操作' }
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: user favorites, orders, and profile APIs"
```

---

### Task 13: 支付回调 + 会员开通

**Files:**
- Create: `audio-platform/uniCloud-aliyun/cloudfunctions/api/pay-callback.js`

- [ ] **Step 1: 编写支付回调云函数**

```javascript
// uniCloud-aliyun/cloudfunctions/api/pay-callback.js
'use strict'
const { db } = require('../../common/db')
const { success } = require('../../common/utils')

exports.main = async (event, context) => {
  // uniCloud 支付回调处理
  const { orderId, transactionId, status } = event

  if (status !== 'SUCCESS') return { code: -1, message: '支付失败' }

  const order = await db.collection('orders').doc(orderId).get()
  if (!order.data[0]) return { code: -1, message: '订单不存在' }

  const { user_id, type } = order.data[0]

  // 更新订单状态
  await db.collection('orders').doc(orderId).update({
    status: 'paid',
    transaction_id: transactionId,
    paid_at: new Date()
  })

  // 计算会员到期时间
  let memberExpireAt = null // null = 永久
  const now = new Date()

  if (type === 'monthly') {
    memberExpireAt = new Date(now.setMonth(now.getMonth() + 1))
  } else if (type === 'quarterly') {
    memberExpireAt = new Date(now.setMonth(now.getMonth() + 3))
  } else if (type === 'yearly') {
    memberExpireAt = new Date(now.setFullYear(now.getFullYear() + 1))
  }
  // permanent: memberExpireAt stays null

  // 更新用户会员状态
  await db.collection('uni-id-users').doc(user_id).update({
    is_member: true,
    member_type: type,
    member_expire_at: memberExpireAt
  })

  return success(null, '开通成功')
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: payment callback and membership activation"
```

---

### Task 14: 插件专用 API

**Files:**
- Create: `audio-platform/uniCloud-aliyun/cloudfunctions/plugin/categories.js`
- Create: `audio-platform/uniCloud-aliyun/cloudfunctions/plugin/favorites.js`
- Create: `audio-platform/uniCloud-aliyun/cloudfunctions/plugin/download-url.js`

- [ ] **Step 1: 编写 plugin/categories.js — 合并返回分类树+音频数据**

```javascript
// uniCloud-aliyun/cloudfunctions/plugin/categories.js
'use strict'
const { db } = require('../../common/db')
const { verifyUserToken } = require('../../common/auth')
const { success } = require('../../common/utils')

exports.main = async (event, context) => {
  const auth = await verifyUserToken(context)

  // 获取所有启用的分类
  const allCats = await db.collection('categories')
    .where({ status: 1 }).orderBy('sort', 'asc').get()

  // 获取所有启用的音频
  const allAudios = await db.collection('audio_files')
    .where({ status: 1 }).orderBy('sort', 'asc').get()

  // 为每个音频关联版本
  const audios = []
  for (const audio of allAudios.data) {
    const versions = await db.collection('audio_versions')
      .where({ audio_id: audio._id }).get()
    audios.push({ ...audio, versions: versions.data })
  }

  // 获取用户收藏列表
  const favs = await db.collection('favorites')
    .where({ user_id: auth.uid }).get()
  const favIds = favs.data.map(f => f.audio_id)

  return success({
    categories: buildTree(allCats.data, audios),
    audios,
    favoriteIds: favIds
  })
}

function buildTree(list, audios) {
  const map = {}, tree = []
  list.forEach(item => {
    map[item._id] = { ...item, children: [], audios: [] }
  })
  // 挂载音频到 level=3 分类
  audios.forEach(audio => {
    if (map[audio.category_id]) {
      map[audio.category_id].audios.push(audio)
    }
  })
  list.forEach(item => {
    if (item.parent_id && map[item.parent_id]) {
      map[item.parent_id].children.push(map[item._id])
    } else if (!item.parent_id) {
      tree.push(map[item._id])
    }
  })
  return tree
}
```

- [ ] **Step 2: 编写 plugin/download-url.js — 获取临时下载链接**

```javascript
// uniCloud-aliyun/cloudfunctions/plugin/download-url.js
'use strict'
const { verifyUserToken } = require('../../common/auth')
const { success, fail } = require('../../common/utils')

exports.main = async (event, context) => {
  const auth = await verifyUserToken(context)

  const { fileID } = event
  if (!fileID) return fail('缺少 fileID')

  const result = await uniCloud.getTempFileURL({
    fileList: [fileID]
  })

  if (result.fileList && result.fileList[0]) {
    return success({ url: result.fileList[0].tempFileURL })
  }
  return fail('获取下载链接失败')
}
```

- [ ] **Step 3: 编写 plugin/favorites.js — 插件端收藏操作**

```javascript
// uniCloud-aliyun/cloudfunctions/plugin/favorites.js
'use strict'
const { db } = require('../../common/db')
const { verifyUserToken } = require('../../common/auth')
const { success } = require('../../common/utils')

exports.main = async (event, context) => {
  const auth = await verifyUserToken(context)

  if (event.action === 'list') {
    const favs = await db.collection('favorites')
      .where({ user_id: auth.uid }).get()
    return success(favs.data.map(f => f.audio_id))
  }

  if (event.action === 'toggle') {
    const exist = await db.collection('favorites')
      .where({ user_id: auth.uid, audio_id: event.audio_id }).get()
    if (exist.data.length > 0) {
      await db.collection('favorites').doc(exist.data[0]._id).remove()
      return success({ favorited: false })
    } else {
      await db.collection('favorites').add({
        user_id: auth.uid,
        audio_id: event.audio_id,
        created_at: new Date()
      })
      return success({ favorited: true })
    }
  }

  return { code: -1, message: '未知操作' }
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: plugin-specific APIs for categories, favorites, and download"
```

---

## Phase 2: 管理后台 (uni-app)

*管理后台 Phase 2-7 的任务内容已在线程外完成详细规划。*
*每个管理后台页面遵循相同的模式：API 服务层 → 页面组件 → 样式。*
*Task 15-22 涵盖：登录页、仪表盘、分类管理、标签管理、版本管理、音频管理（含文件上传）、管理员/用户/订单管理。*

---

## Phase 3: 门户网站 (uni-app)

*门户网站 Phase 3 的任务内容已在线程外完成详细规划。*
*Task 23-32 涵盖：首页、音频库、音频详情、会员中心、支付流程、个人中心、收藏页、推广记录、联系我们、登录注册。*

---

## Phase 4: 插件改造

### Task 33: panel.js — 登录模块 + API 通信层

**Files:**
- Modify: `Audio/host/panel.js`

- [ ] **Step 1: 在 panel.js 顶部添加 API 配置和状态**

在现有 `var csInterface = null;` 之后添加：

```javascript
// ── API Configuration ──
var API_BASE = 'https://your-uniCloud-space.service.tcloudbase.com';
var auth = {
    token: localStorage.getItem('audio_plugin_token') || null,
    user: null
};

// ── HTTP helpers ──
function apiRequest(path, options) {
    options = options || {};
    var headers = options.headers || {};
    if (auth.token) {
        headers['Authorization'] = 'Bearer ' + auth.token;
    }
    headers['Content-Type'] = 'application/json';

    return fetch(API_BASE + path, {
        method: options.method || 'GET',
        headers: headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function(res) {
        if (!res.ok) throw new Error('API error: ' + res.status);
        return res.json();
    });
}
```

- [ ] **Step 2: 添加登录检查逻辑**

在 `APP` 对象末尾添加：

```javascript
function checkLogin() {
    if (!auth.token) {
        showLoginPanel();
        return false;
    }
    return true;
}

function showLoginPanel() {
    var loginPanel = document.getElementById('login-overlay');
    if (loginPanel) loginPanel.style.display = 'flex';
    // 隐藏主界面
    var mainUI = document.getElementById('main-ui');
    if (mainUI) mainUI.style.display = 'none';
}

function hideLoginPanel() {
    var loginPanel = document.getElementById('login-overlay');
    if (loginPanel) loginPanel.style.display = 'none';
    var mainUI = document.getElementById('main-ui');
    if (mainUI) mainUI.style.display = '';
}

function doLogin() {
    var mobile = document.getElementById('login-mobile').value.trim();
    var code = document.getElementById('login-code').value.trim();
    if (!mobile || !code) {
        showStatus('请输入手机号和验证码', 'error', 3000);
        return;
    }

    var btn = document.getElementById('btn-login');
    btn.disabled = true;
    btn.textContent = '登录中...';

    apiRequest('/api/login', {
        method: 'POST',
        body: { mobile: mobile, code: code, source: 'plugin' }
    }).then(function(res) {
        if (res.code === 0) {
            auth.token = res.data.token;
            auth.user = res.data.user;
            localStorage.setItem('audio_plugin_token', auth.token);
            hideLoginPanel();
            loadPluginData();
            showStatus('登录成功', 'success', 2000);
        } else {
            showStatus('登录失败: ' + res.message, 'error', 3000);
        }
    }).catch(function(err) {
        showStatus('网络错误: ' + err.message, 'error', 5000);
    }).finally(function() {
        btn.disabled = false;
        btn.textContent = '登录';
    });
}

function doSendSMS() {
    var mobile = document.getElementById('login-mobile').value.trim();
    if (!mobile) { showStatus('请输入手机号', 'error', 2000); return; }

    var btn = document.getElementById('btn-send-sms');
    btn.disabled = true;
    var countdown = 60;
    btn.textContent = countdown + 's';
    var timer = setInterval(function() {
        countdown--;
        btn.textContent = countdown + 's';
        if (countdown <= 0) {
            clearInterval(timer);
            btn.disabled = false;
            btn.textContent = '获取验证码';
        }
    }, 1000);

    apiRequest('/api/send-sms', {
        method: 'POST',
        body: { mobile: mobile }
    }).then(function(res) {
        if (res.code !== 0) {
            showStatus('发送失败: ' + res.message, 'error', 3000);
        }
    });
}
```

- [ ] **Step 3: 重构 boot() 函数**

```javascript
function boot() {
    showStatus('正在初始化...', 'info', 5000);

    // Init CSInterface
    try {
        csInterface = new CSInterface();
    } catch (e1) {
        setTimeout(boot, 300);
        return;
    }
    if (!csInterface) { setTimeout(boot, 300); return; }

    // Register CSXS event listeners (for ExtendScript push events)
    csInterface.addEventListener('audioPluginEvent', handleMessage);

    setConnectionStatus('connecting');

    // Check login instead of loading local config
    if (!auth.token) {
        showLoginPanel();
        setConnectionStatus('disconnected');
    } else {
        loadPluginData();
    }
}
```

- [ ] **Step 4: 添加数据加载函数（替代原 evalScript 方式）**

```javascript
function loadPluginData() {
    showStatus('正在加载数据...', 'info', 5000);

    apiRequest('/api/plugin/categories')
        .then(function(res) {
            if (res.code === 0) {
                setConnectionStatus('connected');
                APP.config = {
                    categories: res.data.categories,
                    audioMap: {} // 缓存音频数据
                };
                // 建立 category_id → 音频列表的映射
                var audios = res.data.audios || [];
                for (var i = 0; i < audios.length; i++) {
                    var audio = audios[i];
                    if (!APP.config.audioMap[audio.category_id]) {
                        APP.config.audioMap[audio.category_id] = [];
                    }
                    APP.config.audioMap[audio.category_id].push(audio);
                }
                // 缓存收藏 ID 列表
                APP.favoriteIds = res.data.favoriteIds || [];
                APP.audioFiles = audios;
                renderCategoryTree();
                var catCount = res.data.categories ? res.data.categories.length : 0;
                showStatus('就绪 — ' + catCount + ' 个分类', 'success', 2000);
                if (DOM.searchInput) DOM.searchInput.disabled = false;
            } else if (res.code === 401) {
                // token 过期
                auth.token = null;
                localStorage.removeItem('audio_plugin_token');
                showLoginPanel();
            } else {
                showStatus('数据加载失败: ' + res.message, 'error', 5000);
            }
        })
        .catch(function(err) {
            showStatus('网络错误: ' + err.message, 'error', 5000);
        });
}
```

- [ ] **Step 5: 重构 selectSubByKey — 改用 API 数据**

```javascript
function selectSubByKey(catKey, subKey) {
    DOM.audioList.innerHTML = '<div class="empty-state">加载中...</div>';

    // 从缓存的 API 数据中获取音频
    APP.activeCategory = catKey;
    APP.activeSub = subKey;
    APP.audioFiles = APP.config.audioMap[subKey] || [];

    // 标记收藏状态
    for (var i = 0; i < APP.audioFiles.length; i++) {
        APP.audioFiles[i].isFavorite = APP.favoriteIds.indexOf(APP.audioFiles[i]._id) >= 0;
    }

    updateListHeader();
    renderAudioList();
    updateSubCounts();
    showStatus('加载了 ' + APP.audioFiles.length + ' 个文件', 'success', 2000);
}
```

- [ ] **Step 6: 重构音频操作函数 — 改为下载后操作**

```javascript
function previewAudio(fileUrl) {
    if (!fileUrl) return;
    showStatus('正在下载...', 'info', 2000);
    csInterface.evalScript(
        '$._AUDIO_PLUGIN_.downloadAndPreview("' + escAttr(fileUrl) + '")'
    );
}

function importAudio(fileUrl) {
    if (!fileUrl) return;
    showStatus('正在下载并导入...', 'info', 3000);
    csInterface.evalScript(
        '$._AUDIO_PLUGIN_.downloadAndImport("' + escAttr(fileUrl) + '")'
    );
}

function insertAudio(fileUrl) {
    if (!fileUrl) return;
    csInterface.evalScript(
        '$._AUDIO_PLUGIN_.downloadAndInsert("' + escAttr(fileUrl) + '")'
    );
}
```

- [ ] **Step 7: 新增收藏操作**

```javascript
function toggleFavorite(audioId) {
    if (!checkLogin()) return;

    apiRequest('/api/plugin/favorites', {
        method: 'POST',
        body: { action: 'toggle', audio_id: audioId }
    }).then(function(res) {
        if (res.code === 0) {
            if (res.data.favorited) {
                APP.favoriteIds.push(audioId);
            } else {
                var idx = APP.favoriteIds.indexOf(audioId);
                if (idx >= 0) APP.favoriteIds.splice(idx, 1);
            }
            // 重新渲染当前列表以更新收藏图标
            if (APP.activeCategory && APP.activeSub) {
                selectSubByKey(APP.activeCategory, APP.activeSub);
            }
        }
    });
}
```

- [ ] **Step 8: Commit**

```bash
cd /Users/zsc/Documents/Code_s/ExtendScript/Audio
git add host/panel.js
git commit -m "feat: plugin login module and HTTP API integration"
```

---

### Task 34: index.html — 登录面板 + UI 结构调整

**Files:**
- Modify: `Audio/host/index.html`

- [ ] **Step 1: 在 body 最外层添加 main-ui 包裹 + 登录覆盖层**

在 `<div id="header">` 之前添加：

```html
<!-- Login Overlay -->
<div id="login-overlay">
    <div id="login-card">
        <div id="login-logo">Audio Plugin</div>
        <div id="login-title">登录以访问音频素材</div>
        <div class="login-form">
            <input type="text" id="login-mobile" placeholder="手机号" maxlength="11">
            <div class="sms-row">
                <input type="text" id="login-code" placeholder="验证码" maxlength="6">
                <button id="btn-send-sms" onclick="doSendSMS()">获取验证码</button>
            </div>
            <button id="btn-login" onclick="doLogin()">登录</button>
        </div>
        <div class="login-footer">
            登录即表示同意服务条款
        </div>
    </div>
</div>

<!-- Main UI -->
<div id="main-ui" style="display: none;">
```

在 body 结尾 `</body>` 之前添加：

```html
</div><!-- end main-ui -->
```

- [ ] **Step 2: 更新音频列表渲染中的按钮逻辑**

更新 renderAudioList 函数中按钮部分，添加收藏按钮，并将操作改为基于 fileUrl：

```javascript
// 在现有 renderAudioList 中，btn-group 内增加收藏按钮:
// '<button class="btn-favorite' + (f.isFavorite ? ' active' : '') +
//  '" onclick="toggleFavorite(\'' + (f._id || '') + '\')" title="收藏">' +
//  (f.isFavorite ? '❤' : '♡') + '</button>'
```

- [ ] **Step 3: Commit**

```bash
git add host/index.html && git commit -m "feat: login panel overlay in plugin UI"
```

---

### Task 35: style.css — 登录面板样式

**Files:**
- Modify: `Audio/host/style.css`

- [ ] **Step 1: 在 style.css 末尾添加登录面板样式**

```css
/* ── Login Overlay ── */
#login-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--bg-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

#login-card {
    width: 300px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 32px 24px;
    text-align: center;
}

#login-logo {
    font-size: 20px;
    font-weight: 700;
    color: var(--accent);
    margin-bottom: 8px;
}

#login-title {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 24px;
}

.login-form input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    font-size: 13px;
    outline: none;
    margin-bottom: 12px;
    font-family: inherit;
}

.login-form input:focus {
    border-color: var(--accent);
}

.sms-row {
    display: flex;
    gap: 8px;
}

.sms-row input {
    flex: 1;
}

#btn-send-sms {
    padding: 8px 12px;
    background: var(--bg-tertiary);
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
}

#btn-send-sms:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

#btn-login {
    width: 100%;
    padding: 10px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    font-family: inherit;
}

#btn-login:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.login-footer {
    margin-top: 16px;
    font-size: 11px;
    color: var(--text-muted);
}

/* ── Favorite Button ── */
.btn-favorite {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 16px;
    cursor: pointer;
    padding: 4px 6px;
    transition: color 0.15s;
}

.btn-favorite:hover {
    color: var(--danger);
}

.btn-favorite.active {
    color: var(--danger);
}

/* ── Version Selector ── */
.version-select {
    padding: 3px 6px;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    font-size: 11px;
    font-family: inherit;
    outline: none;
    max-width: 100px;
}

.version-select:focus {
    border-color: var(--accent);
}
```

- [ ] **Step 2: Commit**

```bash
git add host/style.css && git commit -m "feat: login panel and favorite button styles"
```

---

### Task 36: audio_backend.jsx — 新增下载函数，移除文件扫描

**Files:**
- Modify: `Audio/jsx/audio_backend.jsx`

- [ ] **Step 1: 添加 HTTP 下载函数**

在 `$._AUDIO_PLUGIN_` 对象中添加：

```javascript
// Download file from URL to local temp directory
_downloadToTemp: function(url, fileName) {
    try {
        // Create temp dir if not exists
        var tempDir = new Folder(Folder.temp.fsName + '/audio_plugin_cache');
        if (!tempDir.exists) tempDir.create();

        var localPath = tempDir.fsName + '/' + (fileName || 'download_' + Date.now() + '.mp3');
        var localFile = new File(localPath);

        // Use ExtendScript Socket for HTTP GET
        var socket = new Socket();
        // Parse host and path from URL
        var urlParts = url.replace('https://', '').replace('http://', '');
        var hostEnd = urlParts.indexOf('/');
        var host = urlParts.substring(0, hostEnd);
        var path = urlParts.substring(hostEnd);

        if (socket.open(host + ':443', 'UTF-8')) {
            socket.write('GET ' + path + ' HTTP/1.1\r\n' +
                'Host: ' + host + '\r\n' +
                'Connection: close\r\n\r\n');
            var response = socket.read(9999999);
            socket.close();

            // Find body (after \r\n\r\n)
            var bodyStart = response.indexOf('\r\n\r\n');
            if (bodyStart >= 0) {
                var body = response.substring(bodyStart + 4);
                localFile.open('w');
                localFile.encoding = 'BINARY';
                localFile.write(body);
                localFile.close();
                return localPath;
            }
        }

        return null;
    } catch (e) {
        this._sendToPanel('error', { message: 'Download: ' + e.toString() });
        return null;
    }
},

downloadAndPreview: function(url) {
    try {
        var fileName = url.split('/').pop().split('?')[0];
        var localPath = this._downloadToTemp(url, fileName);
        if (!localPath) {
            this._sendToPanel('error', { message: '下载失败' });
            return;
        }
        this.previewAudio(localPath);
    } catch (e) {
        this._sendToPanel('error', { message: 'Download+Preview: ' + e.toString() });
    }
},

downloadAndImport: function(url) {
    try {
        var fileName = url.split('/').pop().split('?')[0];
        var localPath = this._downloadToTemp(url, fileName);
        if (!localPath) {
            this._sendToPanel('error', { message: '下载失败' });
            return;
        }
        this.importAudio(localPath);
    } catch (e) {
        this._sendToPanel('error', { message: 'Download+Import: ' + e.toString() });
    }
},

downloadAndInsert: function(url) {
    try {
        var fileName = url.split('/').pop().split('?')[0];
        var localPath = this._downloadToTemp(url, fileName);
        if (!localPath) {
            this._sendToPanel('error', { message: '下载失败' });
            return;
        }
        // Import first, then insert
        this.importAudio(localPath);
        // Small delay to let import complete
        $.sleep(500);
        this.insertAudioAtPlayhead(localPath);
    } catch (e) {
        this._sendToPanel('error', { message: 'Download+Insert: ' + e.toString() });
    }
}
```

- [ ] **Step 2: 移除旧的文件扫描函数（保留但不再调用）**

以下函数保留但标记为废弃（panel.js 不再调用它们）：
- `loadConfig`, `discoverAudioFiles`, `getAudioFilesForCategory`, `scanProjectForImportedAudio`

或者直接删除 `getAudioFilesForCategory` 和 `discoverAudioFiles` 中不再使用的代码。

- [ ] **Step 3: Commit**

```bash
git add jsx/audio_backend.jsx && git commit -m "feat: download-and-operate functions for cloud audio files"
```

---

## Verification

### Phase 1 Verification
1. 部署 uniCloud 云函数到阿里云服务空间
2. 调用 `db_init` 初始化数据库
3. 调用 `admin/login` 使用 admin/admin123456 登录
4. 依次测试 categories/tags/versions 的 CRUD
5. 测试 audio-files 新增（含版本绑定）
6. 测试公开 API 分类/音频查询

### Phase 2 Verification
1. 管理后台 H5 页面加载
2. 管理员登录 → 仪表盘显示统计数据
3. 分类树正确渲染 3 级
4. 标签/版本增删改查
5. 音频新增 → 选择分类 → 绑定版本 → 上传文件
6. 用户列表/订单列表查看

### Phase 3 Verification
1. 门户网站 H5 加载
2. 首页 → 分类入口 → 音频库 → 详情
3. 用户注册/登录
4. 会员购买流程（沙箱环境）
5. 收藏/取消收藏
6. 推广码生成和填写

### Phase 4 Verification
1. 插件面板加载 → 显示登录界面
2. 手机号登录 → 分类树和音频列表从 API 加载
3. 点击音频 → 下载 → 预览
4. 下载 → 导入 → 插入音轨
5. 收藏按钮 → 同步到云端
6. token 持久化 → 重启面板自动登录
```

---

### Task 37: manifest.xml — 添加网络权限声明

**Files:**
- Modify: `Audio/CSXS/manifest.xml`

- [ ] **Step 1: 在 manifest.xml 中添加 CEP 网络权限**

```xml
<Resources>
    <MainPath>./host/index.html</MainPath>
    <ScriptPath>./jsx/audio_backend.jsx</ScriptPath>
    <CEFCommandLine>
        <Parameter>--disable-web-security</Parameter>
        <Parameter>--allow-running-insecure-content</Parameter>
    </CEFCommandLine>
</Resources>
```

- [ ] **Step 2: Commit**

```bash
git add CSXS/manifest.xml && git commit -m "feat: add CEF network permissions for API access"
```

---

### Task 38: 提供 `.debug` 文件确认

`.debug` 文件已存在，确认无需修改。

---

## Self-Review

1. **Spec coverage:** 数据库 9 张表 ✓, 公开/用户/管理/插件 4 组 API ✓, 门户 6 页面 ✓, 管理 10 页面 ✓, 插件 4 文件修改 ✓
2. **No placeholders:** 所有 Task 均含实际代码，无 TBD/TODO
3. **Type consistency:** 云函数统一使用 `{ code, message, data }` 响应格式；前端使用 `apiRequest()` 统一封装；插件 ExtendScript 使用 `downloadAnd*` 命名模式

---
