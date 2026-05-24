# Audio Platform Data Model Refactor — Plan B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor categories 3→2 levels, unify camelCase naming, add mandatory version file binding, and implement diff-based audio_versions updates.

**Architecture:** Bottom-up: migration → schemas → cloud functions → frontend pages. Each layer depends on the previous. Schema changes are backward-incompatible so migration runs first.

**Tech Stack:** uniCloud (阿里云), uni-app Vue 3, cloud functions (Node.js)

---

### Task 1: Create Migration Cloud Function

**Files:**
- Create: `audio-platform/audio-platform/uniCloud-aliyun/cloudfunctions/migration-refactor/index.js`
- Create: `audio-platform/audio-platform/uniCloud-aliyun/cloudfunctions/migration-refactor/package.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "migration-refactor",
  "version": "1.0.0",
  "main": "index.js"
}
```

- [ ] **Step 2: Write migration function**

```js
// 数据模型重构迁移：3级分类→2级，snake_case→camelCase，补充冗余字段
'use strict'
const { db } = require('../common/db')

exports.main = async (event) => {
    const dryRun = event.dryRun !== false  // 默认 dryRun=true，传 { dryRun: false } 才真正执行
    const results = []

    // ===== Step 1: 合并 3 级分类为 2 级 =====
    const allCats = await db.collection('categories').get()
    const level3Cats = allCats.data.filter(c => c.level === 3)

    if (!dryRun) {
        for (const cat of level3Cats) {
            await db.collection('categories').doc(cat._id).update({ status: 0, updatedAt: new Date() })
        }
        // 将 audio_files 的 categoryId 从 level-3 改为其 parent (level-2)
        for (const cat of level3Cats) {
            if (cat.parent_id) {
                await db.collection('audio_files')
                    .where({ category_id: cat._id })
                    .update({ category_id: cat.parent_id, updatedAt: new Date() })
            }
        }
    }
    results.push({ step: 'flatten-level3', level3Count: level3Cats.length })

    // ===== Step 2: 重命名字段 =====
    // categories: parent_id → parentId
    const catsWithParentId = allCats.data.filter(c => c.parent_id)
    if (!dryRun) {
        for (const cat of catsWithParentId) {
            await db.collection('categories').doc(cat._id).update({
                parentId: cat.parent_id,
                updatedAt: new Date()
            })
        }
    }
    results.push({ step: 'rename-categories-parentId', count: catsWithParentId.length })

    // audio_files: category_id → categoryId, tag_ids → tagIds
    const allAudio = await db.collection('audio_files').get()
    if (!dryRun) {
        for (const audio of allAudio.data) {
            const update = { updatedAt: new Date() }
            if (audio.category_id !== undefined) update.categoryId = audio.category_id
            if (audio.tag_ids !== undefined) update.tagIds = audio.tag_ids || []
            await db.collection('audio_files').doc(audio._id).update(update)
        }
    }
    results.push({ step: 'rename-audio-files', count: allAudio.data.length })

    // audio_versions: audio_id→audioId, version_id→versionId, file_url→fileUrl, file_name→fileName, file_size→fileSize
    const allAV = await db.collection('audio_versions').get()
    if (!dryRun) {
        for (const av of allAV.data) {
            const update = {}
            if (av.audio_id !== undefined) update.audioId = av.audio_id
            if (av.version_id !== undefined) update.versionId = av.version_id
            if (av.file_url !== undefined) update.fileUrl = av.file_url || ''
            if (av.file_name !== undefined) update.fileName = av.file_name || ''
            if (av.file_size !== undefined) update.fileSize = av.file_size || 0
            if (Object.keys(update).length > 0) {
                await db.collection('audio_versions').doc(av._id).update(update)
            }
        }
    }
    results.push({ step: 'rename-audio-versions', count: allAV.data.length })

    // ===== Step 3: 补充冗余数据 =====
    // audio_versions: 补充 versionName
    const versionsAll = await db.collection('versions').get()
    const versionMap = {}
    versionsAll.data.forEach(v => { versionMap[v._id] = v.name })

    if (!dryRun) {
        for (const av of allAV.data) {
            const vName = versionMap[av.version_id || av.versionId] || ''
            if (vName) {
                await db.collection('audio_versions').doc(av._id).update({ versionName: vName })
            }
        }
    }
    results.push({ step: 'backfill-versionName' })

    // categories: 补充 parentName
    const catMap = {}
    allCats.data.forEach(c => { catMap[c._id] = c.name })
    const catsWithParent = allCats.data.filter(c => c.parent_id || c.parentId)
    if (!dryRun) {
        for (const cat of catsWithParent) {
            const pid = cat.parentId || cat.parent_id
            const pname = catMap[pid] || ''
            if (pname) {
                await db.collection('categories').doc(cat._id).update({ parentName: pname })
            }
        }
    }
    results.push({ step: 'backfill-parentName' })

    return { code: 0, message: dryRun ? 'DRY RUN — 传 { dryRun: false } 执行' : '迁移完成', data: results }
}
```

- [ ] **Step 3: Verify via uniCloud dev console**

Run with `{ dryRun: true }` first, check results, then run with `{ dryRun: false }`.

- [ ] **Step 4: Commit**

```bash
git add audio-platform/audio-platform/uniCloud-aliyun/cloudfunctions/migration-refactor/
git commit -m "feat: add migration cloud function for Plan B refactor"
```

---

### Task 2: Update Database Schemas

**Files:**
- Modify: `audio-platform/audio-platform/uniCloud-aliyun/database/categories.schema.json`
- Modify: `audio-platform/audio-platform/uniCloud-aliyun/database/audio_files.schema.json`
- Modify: `audio-platform/audio-platform/uniCloud-aliyun/database/audio_versions.schema.json`

- [ ] **Step 1: Update categories.schema.json**

Replace entire file:

```json
{
  "bsonType": "object",
  "required": ["name", "level"],
  "permission": {
    "read": true,
    "create": "'admin_token' in auth.getToken()",
    "update": "'admin_token' in auth.getToken()",
    "delete": "'admin_token' in auth.getToken()"
  },
  "properties": {
    "_id": { "bsonType": "string" },
    "name": {
      "bsonType": "string",
      "description": "分类名称",
      "label": "名称"
    },
    "level": {
      "bsonType": "int",
      "description": "层级：1=一级分类，2=二级分类",
      "label": "层级",
      "enum": [
        {"value": 1, "text": "一级分类"},
        {"value": 2, "text": "二级分类"}
      ]
    },
    "parentId": {
      "bsonType": "string",
      "description": "上级分类ID（一级分类为null）",
      "label": "上级分类"
    },
    "parentName": {
      "bsonType": "string",
      "description": "上级分类名称（冗余）",
      "label": "上级分类名"
    },
    "sort": {
      "bsonType": "int",
      "description": "排序值",
      "label": "排序",
      "defaultValue": 0
    },
    "icon": {
      "bsonType": "string",
      "description": "图标emoji或图片URL",
      "label": "图标"
    },
    "status": {
      "bsonType": "int",
      "description": "状态：1=启用，0=禁用",
      "label": "状态",
      "defaultValue": 1
    },
    "createdAt": {
      "bsonType": "timestamp",
      "label": "创建时间",
      "forceDefaultValue": { "$env": "now" }
    },
    "updatedAt": {
      "bsonType": "timestamp",
      "label": "更新时间"
    }
  }
}
```

- [ ] **Step 2: Update audio_files.schema.json**

Replace entire file:

```json
{
  "bsonType": "object",
  "required": ["name", "categoryId"],
  "permission": {
    "read": true,
    "create": "'admin_token' in auth.getToken()",
    "update": "'admin_token' in auth.getToken()",
    "delete": "'admin_token' in auth.getToken()"
  },
  "properties": {
    "_id": { "bsonType": "string" },
    "name": {
      "bsonType": "string",
      "description": "音频名称",
      "label": "名称",
      "title": "名称"
    },
    "description": {
      "bsonType": "string",
      "description": "音频描述",
      "label": "描述"
    },
    "categoryId": {
      "bsonType": "string",
      "description": "所属二级分类ID",
      "label": "分类ID"
    },
    "tagIds": {
      "bsonType": "array",
      "description": "标签ID数组",
      "label": "标签",
      "items": { "bsonType": "string" }
    },
    "cover": {
      "bsonType": "string",
      "description": "封面图 cloud fileID",
      "label": "封面"
    },
    "sort": {
      "bsonType": "int",
      "description": "排序值",
      "label": "排序",
      "defaultValue": 0
    },
    "status": {
      "bsonType": "int",
      "description": "状态：1=上架，0=下架",
      "label": "状态",
      "defaultValue": 1,
      "enum": [
        {"value": 1, "text": "上架"},
        {"value": 0, "text": "下架"}
      ]
    },
    "createdAt": {
      "bsonType": "timestamp",
      "description": "创建时间",
      "label": "创建时间",
      "forceDefaultValue": { "$env": "now" }
    },
    "updatedAt": {
      "bsonType": "timestamp",
      "description": "更新时间",
      "label": "更新时间"
    }
  }
}
```

- [ ] **Step 3: Update audio_versions.schema.json**

Replace entire file:

```json
{
  "bsonType": "object",
  "required": ["audioId", "versionId", "fileUrl"],
  "permission": {
    "read": true,
    "create": "'admin_token' in auth.getToken()",
    "update": "'admin_token' in auth.getToken()",
    "delete": "'admin_token' in auth.getToken()"
  },
  "properties": {
    "_id": { "bsonType": "string" },
    "audioId": {
      "bsonType": "string",
      "description": "音频ID",
      "label": "音频",
      "foreignKey": "audio_files._id"
    },
    "versionId": {
      "bsonType": "string",
      "description": "版本ID",
      "label": "版本",
      "foreignKey": "versions._id"
    },
    "versionName": {
      "bsonType": "string",
      "description": "版本名称冗余（如 30秒）",
      "label": "版本名称"
    },
    "fileUrl": {
      "bsonType": "string",
      "description": "音频文件 cloud fileID（必填）",
      "label": "文件"
    },
    "fileName": {
      "bsonType": "string",
      "description": "原始文件名",
      "label": "文件名"
    },
    "fileSize": {
      "bsonType": "int",
      "description": "文件大小（字节）",
      "label": "文件大小"
    },
    "duration": {
      "bsonType": "int",
      "description": "实际时长（秒）",
      "label": "时长"
    },
    "createdAt": {
      "bsonType": "timestamp",
      "label": "创建时间",
      "forceDefaultValue": { "$env": "now" }
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add audio-platform/audio-platform/uniCloud-aliyun/database/categories.schema.json audio-platform/audio-platform/uniCloud-aliyun/database/audio_files.schema.json audio-platform/audio-platform/uniCloud-aliyun/database/audio_versions.schema.json
git commit -m "feat: update schemas for 2-level categories and camelCase naming"
```

---

### Task 3: Update admin-categories Cloud Function

**Files:**
- Modify: `audio-platform/audio-platform/uniCloud-aliyun/cloudfunctions/admin-categories/index.js`

- [ ] **Step 1: Rewrite admin-categories/index.js**

Replace entire file:

```js
// 分类管理 CRUD（2级树形，camelCase）
'use strict'
const { db } = require('../common/db')
const { verifyAdminToken } = require('../common/auth')
const { success, fail } = require('../common/utils')

exports.main = async (event, context) => {
    await verifyAdminToken(event.adminToken)
    const { action, data } = event

    switch (action) {
        case 'tree':
        case undefined:
        case '': {
            const all = await db.collection('categories')
                .orderBy('sort', 'asc')
                .orderBy('createdAt', 'asc')
                .get()
            if (action === 'tree') return success(buildTree(all.data))
            return success(all.data)
        }
        case 'create': {
            if (!data || !data.name) return fail('名称不能为空')
            const parentId = data.parentId || null
            let parentName = null
            let level = 1
            if (parentId) {
                const parent = await db.collection('categories').doc(parentId).get()
                if (parent.data && parent.data.length > 0) {
                    parentName = parent.data[0].name
                    level = (parent.data[0].level || 0) + 1
                    if (level > 2) return fail('分类最多两级')
                }
            }
            await db.collection('categories').add({
                name: data.name,
                level,
                parentId,
                parentName,
                sort: data.sort || 0,
                status: 1,
                createdAt: new Date(),
                updatedAt: new Date()
            })
            return success(null, '创建成功')
        }
        case 'update': {
            if (!data || !data._id) return fail('缺少参数')
            const updateData = {
                name: data.name,
                sort: data.sort,
                parentId: data.parentId || null,
                parentName: data.parentName || null,
                updatedAt: new Date()
            }
            await db.collection('categories').doc(data._id).update(updateData)
            return success(null, '更新成功')
        }
        case 'delete': {
            if (!data || !data._id) return fail('缺少参数')
            // Check children
            const children = await db.collection('categories').where({ parentId: data._id }).count()
            if (children.total > 0) return fail('请先删除子分类')
            // Check audio_files bound to this category
            const audioCount = await db.collection('audio_files').where({ categoryId: data._id }).count()
            if (audioCount.total > 0) return fail('该分类下有音频文件，请先迁移或删除音频')
            await db.collection('categories').doc(data._id).remove()
            return success(null, '已删除')
        }
        case 'move': {
            if (!data || !data._id || !data.direction) return fail('缺少参数')
            const { _id, direction } = data
            const current = await db.collection('categories').doc(_id).get()
            if (current.data.length === 0) return fail('分类不存在')
            const cat = current.data[0]
            const siblings = await db.collection('categories')
                .where({ parentId: cat.parentId || null })
                .orderBy('sort', 'asc')
                .get()
            const idx = siblings.data.findIndex(c => c._id === _id)
            if (idx === -1) return fail('排序异常')
            const targetIdx = direction === 'up' ? idx - 1 : idx + 1
            if (targetIdx < 0 || targetIdx >= siblings.data.length) {
                return success(null, '已在边界')
            }
            const swap = siblings.data[targetIdx]
            await db.collection('categories').doc(_id).update({ sort: swap.sort, updatedAt: new Date() })
            await db.collection('categories').doc(swap._id).update({ sort: cat.sort, updatedAt: new Date() })
            return success(null, '移动成功')
        }
        default:
            return fail('未知操作')
    }
}

function buildTree(list) {
    const map = {}, tree = []
    list.forEach(item => { map[item._id] = { ...item, children: [] } })
    list.forEach(item => {
        if (item.parentId && map[item.parentId]) {
            map[item.parentId].children.push(map[item._id])
        } else if (!item.parentId) {
            tree.push(map[item._id])
        }
    })
    return tree
}
```

- [ ] **Step 2: Commit**

```bash
git add audio-platform/audio-platform/uniCloud-aliyun/cloudfunctions/admin-categories/index.js
git commit -m "refactor: admin-categories to 2-level tree with camelCase"
```

---

### Task 4: Update admin-audio-files Cloud Function

**Files:**
- Modify: `audio-platform/audio-platform/uniCloud-aliyun/cloudfunctions/admin-audio-files/index.js`

- [ ] **Step 1: Rewrite admin-audio-files/index.js**

Replace entire file:

```js
// 音频管理 CRUD（camelCase，强版本绑定，diff 更新）
'use strict'
const { db, cmd } = require('../common/db')
const { verifyAdminToken } = require('../common/auth')
const { success, fail, parsePagination } = require('../common/utils')

exports.main = async (event, context) => {
    await verifyAdminToken(event.adminToken)
    const { action, data } = event

    switch (action) {
        case 'list': {
            const { page, limit, skip } = parsePagination(event)
            let where = {}
            if (event.categoryId) where.categoryId = event.categoryId
            if (event.tagIds && event.tagIds.length > 0) where.tagIds = cmd.in(event.tagIds)
            if (event.keyword) where.name = new RegExp(event.keyword, 'i')

            const [res, count] = await Promise.all([
                db.collection('audio_files').where(where)
                    .orderBy('sort', 'asc').skip(skip).limit(limit).get(),
                db.collection('audio_files').where(where).count()
            ])

            const audios = []
            for (const audio of res.data) {
                const versions = await db.collection('audio_versions').where({ audioId: audio._id }).get()
                audios.push({ ...audio, versions: versions.data })
            }

            return success({ list: audios, total: count.total, page, limit })
        }
        case 'detail': {
            if (!data || !data._id) return fail('缺少参数')
            const audio = await db.collection('audio_files').doc(data._id).get()
            if (!audio.data[0]) return fail('音频不存在')
            const versions = await db.collection('audio_versions').where({ audioId: data._id }).get()
            return success({ ...audio.data[0], versions: versions.data })
        }
        case 'create': {
            if (!data || !data.name || !data.categoryId) return fail('名称和分类不能为空')
            if (!data.versions || data.versions.length === 0) return fail('至少需要绑定一个版本文件')
            for (const v of data.versions) {
                if (!v.fileUrl) return fail('每个版本必须上传音频文件')
            }

            const audioRes = await db.collection('audio_files').add({
                categoryId: data.categoryId,
                name: data.name,
                description: data.description || '',
                cover: data.cover || '',
                tagIds: data.tagIds || [],
                status: 1,
                sort: data.sort || 0,
                createdAt: new Date(),
                updatedAt: new Date()
            })

            for (const v of data.versions) {
                // Fetch version name for redundancy
                let versionName = ''
                try {
                    const ver = await db.collection('versions').doc(v.versionId).get()
                    if (ver.data && ver.data[0]) versionName = ver.data[0].name
                } catch (e) { /* ignore */ }

                await db.collection('audio_versions').add({
                    audioId: audioRes.id,
                    versionId: v.versionId,
                    versionName,
                    fileUrl: v.fileUrl,
                    fileName: v.fileName || '',
                    fileSize: v.fileSize || 0,
                    duration: v.duration || 0,
                    createdAt: new Date()
                })
            }
            return success({ _id: audioRes.id }, '创建成功')
        }
        case 'update': {
            if (!data || !data._id) return fail('缺少参数')
            await db.collection('audio_files').doc(data._id).update({
                name: data.name,
                description: data.description,
                cover: data.cover,
                categoryId: data.categoryId,
                tagIds: data.tagIds,
                sort: data.sort,
                updatedAt: new Date()
            })

            if (data.versions) {
                // Diff-based update: compare incoming vs existing
                const existing = await db.collection('audio_versions').where({ audioId: data._id }).get()
                const existingMap = {}
                existing.data.forEach(v => { existingMap[v.versionId] = v })

                const incomingMap = {}
                data.versions.forEach(v => { incomingMap[v.versionId] = v })

                // Delete removed versions
                for (const v of existing.data) {
                    if (!incomingMap[v.versionId]) {
                        // Optionally delete cloud file
                        if (v.fileUrl) {
                            try { await uniCloud.deleteFile({ fileList: [v.fileUrl] }) } catch (e) { /* ignore */ }
                        }
                        await db.collection('audio_versions').doc(v._id).remove()
                    }
                }

                // Add new or update changed versions
                for (const v of data.versions) {
                    if (!v.fileUrl) continue
                    const exist = existingMap[v.versionId]
                    if (!exist) {
                        // New
                        let versionName = ''
                        try {
                            const ver = await db.collection('versions').doc(v.versionId).get()
                            if (ver.data && ver.data[0]) versionName = ver.data[0].name
                        } catch (e) { /* ignore */ }

                        await db.collection('audio_versions').add({
                            audioId: data._id,
                            versionId: v.versionId,
                            versionName,
                            fileUrl: v.fileUrl,
                            fileName: v.fileName || '',
                            fileSize: v.fileSize || 0,
                            duration: v.duration || 0,
                            createdAt: new Date()
                        })
                    } else if (exist.fileUrl !== v.fileUrl || exist.fileName !== v.fileName || exist.fileSize !== v.fileSize) {
                        // Changed
                        await db.collection('audio_versions').doc(exist._id).update({
                            fileUrl: v.fileUrl,
                            fileName: v.fileName || '',
                            fileSize: v.fileSize || 0,
                            duration: v.duration || 0
                        })
                    }
                }
            }
            return success(null, '更新成功')
        }
        case 'updateStatus': {
            if (!data || !data._id) return fail('缺少参数')
            await db.collection('audio_files').doc(data._id).update({
                status: data.status,
                updatedAt: new Date()
            })
            return success(null, data.status === 1 ? '已启用' : '已禁用')
        }
        case 'delete': {
            if (!data || !data._id) return fail('缺少参数')
            await db.collection('audio_files').doc(data._id).update({
                status: 0,
                updatedAt: new Date()
            })
            return success(null, '已下架')
        }
        default: return fail('未知操作')
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add audio-platform/audio-platform/uniCloud-aliyun/cloudfunctions/admin-audio-files/index.js
git commit -m "refactor: admin-audio-files camelCase, mandatory version files, diff update"
```

---

### Task 5: Update admin-versions Cloud Function

**Files:**
- Modify: `audio-platform/audio-platform/uniCloud-aliyun/cloudfunctions/admin-versions/index.js`

- [ ] **Step 1: Fix field references in admin-versions/index.js**

Replace `created_at` → `createdAt` and `version_id` → `versionId`:

Edit the `create` case — change:
```js
await db.collection('versions').add({
    name: data.name, sort: data.sort || 0, created_at: new Date()
})
```
To:
```js
await db.collection('versions').add({
    name: data.name, sort: data.sort || 0, status: 1, createdAt: new Date()
})
```

Edit the `delete` case — change `version_id` to `versionId`:
```js
const linked = await db.collection('audio_versions').where({ versionId: data._id }).count()
```

- [ ] **Step 2: Commit**

```bash
git add audio-platform/audio-platform/uniCloud-aliyun/cloudfunctions/admin-versions/index.js
git commit -m "refactor: admin-versions camelCase field naming"
```

---

### Task 6: Update Public API Cloud Functions

**Files:**
- Modify: `audio-platform/audio-platform/uniCloud-aliyun/cloudfunctions/api-categories/index.js`
- Modify: `audio-platform/audio-platform/uniCloud-aliyun/cloudfunctions/api-audio-files/index.js`

- [ ] **Step 1: Update api-categories/index.js**

Replace entire file:

```js
// 公开接口 — 分类查询（2层树形，camelCase）
'use strict'
const { db } = require('../common/db')
const { success } = require('../common/utils')

exports.main = async (event, context) => {
    if (event.action === 'tree') {
        const all = await db.collection('categories')
            .where({ status: 1 }).orderBy('sort', 'asc').get()
        return success(buildTree(all.data))
    }

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
        if (item.parentId && map[item.parentId]) {
            map[item.parentId].children.push(map[item._id])
        } else if (!item.parentId) {
            tree.push(map[item._id])
        }
    })
    return tree
}
```

- [ ] **Step 2: Update api-audio-files/index.js**

Replace entire file:

```js
// 公开接口 — 音频查询（camelCase）
'use strict'
const { db, cmd } = require('../common/db')
const { success, parsePagination } = require('../common/utils')

exports.main = async (event, context) => {
    const { page, limit, skip } = parsePagination(event)
    let where = { status: 1 }

    if (event.categoryId) where.categoryId = event.categoryId
    if (event.tagId) where.tagIds = cmd.in([event.tagId])
    if (event.keyword) where.name = new RegExp(event.keyword, 'i')
    if (event.versionId) {
        const linked = await db.collection('audio_versions')
            .where({ versionId: event.versionId }).get()
        const audioIds = linked.data.map(v => v.audioId)
        where._id = cmd.in(audioIds.length > 0 ? audioIds : ['__none__'])
    }

    const [res, count] = await Promise.all([
        db.collection('audio_files').where(where)
            .orderBy('sort', 'asc').skip(skip).limit(limit).get(),
        db.collection('audio_files').where(where).count()
    ])

    const audios = []
    for (const audio of res.data) {
        const versions = await db.collection('audio_versions')
            .where({ audioId: audio._id }).get()
        audios.push({ ...audio, versions: versions.data })
    }

    return success({ list: audios, total: count.total, page, limit })
}
```

- [ ] **Step 3: Commit**

```bash
git add audio-platform/audio-platform/uniCloud-aliyun/cloudfunctions/api-categories/index.js audio-platform/audio-platform/uniCloud-aliyun/cloudfunctions/api-audio-files/index.js
git commit -m "refactor: public API cloud functions camelCase and 2-level tree"
```

---

### Task 7: Update Admin Categories Page (2-level tree)

**Files:**
- Modify: `audio-platform/audio-platform/pages-admin/categories/categories.vue`

- [ ] **Step 1: Replace template — remove level-3, simplify to 2 levels**

Replace the entire `<template>` block. Key changes:
- Tree: 2 levels only (remove grandchild section)
- Parent picker: 2-column multiSelector (remove level-3 column)
- Remove `parentL3`, `applyColumn2and3`, simplify `onColumnChange`, `onParentChange`, `syncPickerColumns`, `findNodePath`

The complete replacement is below — write the entire file.

- [ ] **Step 2: Write the complete categories.vue**

Replace entire file:

```vue
<template>
  <view class="categories-page">
    <AdminSidebar :visible="sidebarVisible" @close="sidebarVisible = false" />
    <view class="top-bar">
      <view class="top-left">
        <text class="menu-btn" @click="sidebarVisible = true">☰</text>
        <text class="page-title">分类管理</text>
      </view>
      <button class="btn-primary" @click="openAddModal(null)">+ 新增分类</button>
    </view>

    <view class="content-panels">
      <view class="left-panel">
        <view class="panel-header">
          <text class="panel-title">分类结构</text>
          <text class="expand-all" @click="toggleExpandAll">{{ allExpanded ? '全部折叠' : '全部展开' }}</text>
        </view>
        <scroll-view class="tree-scroll" scroll-y>
          <view class="tree-list">
            <view v-for="item in treeData" :key="item._id">
              <!-- Level 1 - always visible -->
              <view class="tree-node" :class="{ active: selectedId === item._id }"
                :style="{ paddingLeft: (item.level * 40) + 'rpx' }" @click="selectNode(item)">
                <text class="tree-arrow" v-if="item.children && item.children.length" @click.stop="toggleNode(item)">
                  {{ expandedIds.has(item._id) ? '▼' : '▶' }}
                </text>
                <text class="tree-arrow-placeholder" v-else></text>
                <text class="tree-name">{{ item.name }}</text>
                <text class="tree-sort">排序: {{ item.sort }}</text>
              </view>
              <!-- Level 2 children -->
              <view v-if="expandedIds.has(item._id) && item.children && item.children.length">
                <view v-for="child in item.children" :key="child._id"
                  class="tree-node" :class="{ active: selectedId === child._id }"
                  :style="{ paddingLeft: (child.level * 40 + 20) + 'rpx' }"
                  @click="selectNode(child)">
                  <text class="tree-arrow-placeholder"></text>
                  <text class="tree-name">{{ child.name }}</text>
                  <text class="tree-sort">排序: {{ child.sort }}</text>
                </view>
              </view>
            </view>
          </view>
          <view class="empty-tree" v-if="treeData.length === 0">
            <text class="empty-text">暂无分类，请新增</text>
          </view>
        </scroll-view>
      </view>

      <view class="right-panel">
        <view class="panel-header">
          <text class="panel-title">{{ selectedNode ? '分类详情' : '请选择分类' }}</text>
        </view>
        <view class="detail-content" v-if="selectedNode">
          <view class="detail-row">
            <text class="detail-label">名称</text>
            <text class="detail-value">{{ selectedNode.name }}</text>
          </view>
          <view class="detail-row">
            <text class="detail-label">层级</text>
            <text class="detail-value">第 {{ selectedNode.level }} 级</text>
          </view>
          <view class="detail-row">
            <text class="detail-label">排序</text>
            <text class="detail-value">{{ selectedNode.sort }}</text>
          </view>
          <view class="detail-row">
            <text class="detail-label">上级分类</text>
            <text class="detail-value">{{ selectedNode.parentName || '无 (一级分类)' }}</text>
          </view>
          <view class="detail-row">
            <text class="detail-label">创建时间</text>
            <text class="detail-value">{{ formatTime(selectedNode.createdAt) }}</text>
          </view>
          <view class="detail-actions">
            <button class="btn-edit" @click="openEditModal(selectedNode)">编辑</button>
            <button class="btn-move-up" @click="moveUp(selectedNode)">↑ 上移</button>
            <button class="btn-move-down" @click="moveDown(selectedNode)">↓ 下移</button>
            <button class="btn-delete" @click="handleDelete(selectedNode)">删除</button>
          </view>
        </view>
        <view class="detail-empty" v-else>
          <text class="empty-hint">点击左侧分类查看详情</text>
        </view>
      </view>
    </view>

    <!-- Add/Edit Modal -->
    <view class="modal-mask" v-if="showModal" @click="closeModal">
      <view class="modal-card" @click.stop>
        <text class="modal-title">{{ isEdit ? '编辑分类' : '新增分类' }}</text>
        <view class="modal-form">
          <view class="form-item">
            <text class="form-label">分类名称</text>
            <input class="form-input" v-model="formData.name" placeholder="请输入分类名称" placeholder-style="color:#999" />
          </view>
          <view class="form-item">
            <text class="form-label">上级分类</text>
            <picker mode="multiSelector" :range="parentSelectorRange" :value="parentSelectorValue" @change="onParentChange" @columnchange="onColumnChange">
              <view class="picker-box">
                <text :class="{ placeholder: !formData.parentPathText }">
                  {{ formData.parentPathText || '请选择上级分类（不选则为一级分类）' }}
                </text>
              </view>
            </picker>
          </view>
          <view class="form-item">
            <text class="form-label">排序</text>
            <input class="form-input" v-model.number="formData.sort" type="number" placeholder="数字越小越靠前" placeholder-style="color:#999" />
          </view>
        </view>
        <view class="modal-footer">
          <button class="btn-cancel" @click="closeModal">取消</button>
          <button class="btn-primary" :loading="saving" @click="handleSave">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { adminApi } from '@/utils/api.js'
import AdminSidebar from '@/components/AdminSidebar.vue'

const sidebarVisible = ref(false)

const treeData = ref([])
const expandedIds = ref(new Set())
const selectedId = ref(null)
const selectedNode = ref(null)
const showModal = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const allExpanded = ref(true)

const formData = reactive({
  name: '',
  parentId: '',
  parentPathText: '',
  sort: 0
})

// 2-column cascading picker
const parentSelectorRange = ref([[], []])
const parentSelectorValue = ref([0, 0])
const parentL1 = ref([])
const parentL2 = ref([])

const NO_PARENT = '不选'

const flattenForPicker = (nodes) => {
  return (nodes || []).map(n => ({ label: n.name, value: n._id, children: n.children || [] }))
}

const formatTime = (t) => {
  if (!t) return '-'
  const d = new Date(t)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const checkLogin = () => {
  if (!uni.getStorageSync('admin_token')) {
    uni.redirectTo({ url: '/pages-admin/login/login' })
    return false
  }
  return true
}

const loadTree = async () => {
  try {
    const res = await adminApi.getCategories()
    if (res.code === 0) {
      const raw = res.data || []
      treeData.value = buildTree(raw)
      updateParentSelector()
    }
  } catch (err) {
    console.error('loadTree error:', err)
  }
}

const buildTree = (list) => {
  const map = {}
  const roots = []
  const ids = new Set()
  list.forEach(item => {
    map[item._id] = { ...item, children: [] }
    ids.add(item._id)
  })
  expandedIds.value = ids
  list.forEach(item => {
    if (item.parentId && map[item.parentId]) {
      map[item.parentId].children.push(map[item._id])
    } else {
      roots.push(map[item._id])
    }
  })
  return roots
}

const toggleNode = (node) => {
  const next = new Set(expandedIds.value)
  if (next.has(node._id)) {
    next.delete(node._id)
  } else {
    next.add(node._id)
  }
  expandedIds.value = next
}

const toggleExpandAll = () => {
  allExpanded.value = !allExpanded.value
  const next = new Set()
  if (allExpanded.value) {
    const collect = (nodes) => {
      nodes.forEach(n => {
        next.add(n._id)
        if (n.children && n.children.length) collect(n.children)
      })
    }
    collect(treeData.value)
  }
  expandedIds.value = next
}

const selectNode = (node) => {
  selectedId.value = node._id
  selectedNode.value = node
}

const updateParentSelector = () => {
  parentL1.value = flattenForPicker(treeData.value)
  parentSelectorRange.value[0] = [NO_PARENT, ...parentL1.value.map(n => n.label)]
  if (parentL1.value.length > 0) {
    parentL2.value = flattenForPicker(parentL1.value[0].children)
    parentSelectorRange.value[1] = [NO_PARENT, ...parentL2.value.map(n => n.label)]
  } else {
    parentSelectorRange.value[1] = [NO_PARENT]
  }
}

const onColumnChange = (e) => {
  const { column, value } = e.detail
  if (column === 0) {
    parentSelectorValue.value[0] = value
    parentSelectorValue.value[1] = 0
    if (value > 0 && parentL1.value[value - 1]) {
      parentL2.value = flattenForPicker(parentL1.value[value - 1].children)
      parentSelectorRange.value[1] = [NO_PARENT, ...parentL2.value.map(n => n.label)]
    } else {
      parentSelectorRange.value[1] = [NO_PARENT]
    }
  }
}

const onParentChange = (e) => {
  const vals = e.detail.value
  parentSelectorValue.value = vals
  let parentId = ''
  let pathParts = []
  // Column 0
  if (vals[0] > 0 && parentL1.value[vals[0] - 1]) {
    const n1 = parentL1.value[vals[0] - 1]
    pathParts.push(n1.label)
    parentId = n1.value
    // Column 1
    if (vals[1] > 0) {
      const l2 = flattenForPicker(n1.children)
      if (l2[vals[1] - 1]) {
        pathParts.push(l2[vals[1] - 1].label)
        parentId = l2[vals[1] - 1].value
      }
    }
  }
  formData.parentId = parentId
  formData.parentPathText = pathParts.join(' > ')
}

const openAddModal = (parentNode) => {
  isEdit.value = false
  formData.name = ''
  formData.sort = 0
  formData.parentId = parentNode ? parentNode._id : ''
  formData.parentPathText = parentNode ? parentNode.name : ''
  parentSelectorValue.value = [0, 0]
  if (parentNode) {
    const path = findNodePath(parentNode._id)
    if (path) {
      parentSelectorValue.value[0] = path[0] + 1
      syncPickerColumns()
      if (path.length > 1) {
        parentSelectorValue.value[1] = path[1] + 1
      }
    }
  }
  showModal.value = true
}

const openEditModal = (node) => {
  isEdit.value = true
  formData.name = node.name
  formData.sort = node.sort || 0
  formData.parentId = node.parentId || ''
  formData.parentPathText = node.parentName || ''
  formData._id = node._id
  parentSelectorValue.value = [0, 0]
  if (node.parentId) {
    const path = findNodePath(node.parentId)
    if (path) {
      parentSelectorValue.value[0] = path[0] + 1
      syncPickerColumns()
      if (path.length > 1) {
        parentSelectorValue.value[1] = path[1] + 1
      }
    }
  }
  showModal.value = true
}

const findNodePath = (targetId) => {
  const search = (nodes, path) => {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i]._id === targetId) return [...path, i]
      if (nodes[i].children && nodes[i].children.length > 0) {
        const found = search(nodes[i].children, [...path, i])
        if (found) return found
      }
    }
    return null
  }
  return search(treeData.value, [])
}

const syncPickerColumns = () => {
  const col0 = parentSelectorValue.value[0]
  if (col0 > 0 && parentL1.value[col0 - 1]) {
    parentL2.value = flattenForPicker(parentL1.value[col0 - 1].children)
    parentSelectorRange.value[1] = [NO_PARENT, ...parentL2.value.map(n => n.label)]
  } else {
    parentSelectorRange.value[1] = [NO_PARENT]
  }
}

const closeModal = () => {
  showModal.value = false
}

const handleSave = async () => {
  if (!formData.name.trim()) {
    uni.showToast({ title: '请输入分类名称', icon: 'none' })
    return
  }
  saving.value = true
  try {
    const payload = {
      name: formData.name.trim(),
      sort: formData.sort || 0,
      parentId: formData.parentId || null
    }
    let res
    if (isEdit.value) {
      res = await adminApi.updateCategory(formData._id, payload)
    } else {
      res = await adminApi.createCategory(payload)
    }
    if (res.code === 0) {
      uni.showToast({ title: isEdit.value ? '更新成功' : '创建成功', icon: 'success' })
      closeModal()
      loadTree()
    } else {
      uni.showToast({ title: res.msg || '操作失败', icon: 'none' })
    }
  } catch (err) {
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    saving.value = false
  }
}

const handleDelete = (node) => {
  const hasChildren = node.children && node.children.length > 0
  let msg = hasChildren
    ? `"${node.name}" 下还有子分类，删除后将一并删除子分类，确定继续？`
    : `确定删除分类 "${node.name}"？如有音频关联，也会受到影响。`
  uni.showModal({
    title: '确认删除',
    content: msg,
    success: async (res) => {
      if (res.confirm) {
        try {
          const result = await adminApi.deleteCategory(node._id)
          if (result.code === 0) {
            uni.showToast({ title: '删除成功', icon: 'success' })
            selectedNode.value = null
            selectedId.value = null
            loadTree()
          } else {
            uni.showToast({ title: result.msg || '删除失败', icon: 'none' })
          }
        } catch (err) {
          uni.showToast({ title: '网络错误', icon: 'none' })
        }
      }
    }
  })
}

const moveUp = async (node) => {
  try {
    const res = await adminApi.moveCategory(node._id, 'up')
    if (res.code === 0) {
      uni.showToast({ title: '上移成功', icon: 'success' })
      loadTree()
    }
  } catch (err) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

const moveDown = async (node) => {
  try {
    const res = await adminApi.moveCategory(node._id, 'down')
    if (res.code === 0) {
      uni.showToast({ title: '下移成功', icon: 'success' })
      loadTree()
    }
  } catch (err) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

onMounted(() => {
  if (!checkLogin()) return
  loadTree()
})
</script>

<style scoped>
.categories-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 30rpx;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  padding: 24rpx 30rpx;
  border-radius: 12rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}

.top-left { display: flex; align-items: center; gap: 16rpx; }

.menu-btn {
  font-size: 40rpx;
  color: #1a1a2e;
  padding: 0 8rpx;
  cursor: pointer;
}

.page-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #1a1a2e;
}

.btn-primary {
  background: #6c5ce7;
  color: #fff;
  font-size: 26rpx;
  padding: 14rpx 32rpx;
  border-radius: 8rpx;
  border: none;
}

.content-panels {
  display: flex;
  gap: 24rpx;
  height: calc(100vh - 180rpx);
}

.left-panel {
  flex: 3;
  background: #fff;
  border-radius: 12rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.right-panel {
  flex: 2;
  background: #fff;
  border-radius: 12rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 30rpx;
  border-bottom: 2rpx solid #eee;
}

.panel-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #1a1a2e;
}

.expand-all {
  font-size: 24rpx;
  color: #6c5ce7;
}

.tree-scroll {
  flex: 1;
  padding: 16rpx 0;
}

.tree-node {
  display: flex;
  align-items: center;
  padding: 20rpx 30rpx;
  border-bottom: 1rpx solid #f5f5f5;
  cursor: pointer;
  transition: background 0.2s;
}

.tree-node.active {
  background: #f0edff;
  border-left: 4rpx solid #6c5ce7;
}

.tree-arrow {
  width: 40rpx;
  font-size: 20rpx;
  color: #888;
}

.tree-arrow-placeholder {
  width: 40rpx;
}

.tree-name {
  flex: 1;
  font-size: 26rpx;
  color: #333;
}

.tree-sort {
  font-size: 22rpx;
  color: #aaa;
  margin-left: 16rpx;
}

/* Detail Panel */
.detail-content {
  padding: 30rpx;
  flex: 1;
}

.detail-row {
  display: flex;
  margin-bottom: 24rpx;
}

.detail-label {
  width: 140rpx;
  font-size: 26rpx;
  color: #999;
}

.detail-value {
  flex: 1;
  font-size: 26rpx;
  color: #333;
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 40rpx;
  padding-top: 30rpx;
  border-top: 2rpx solid #f0f0f0;
}

.detail-actions button {
  font-size: 24rpx;
  padding: 12rpx 24rpx;
  border-radius: 6rpx;
  border: none;
}

.btn-edit { background: #6c5ce7; color: #fff; }
.btn-move-up { background: #e8f4fd; color: #1976d2; }
.btn-move-down { background: #e8f4fd; color: #1976d2; }
.btn-delete { background: #fff0f0; color: #d32f2f; }

.detail-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-hint {
  color: #ccc;
  font-size: 28rpx;
}

.empty-tree {
  padding: 60rpx;
  text-align: center;
}

.empty-text {
  color: #bbb;
  font-size: 26rpx;
}

/* Modal */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-card {
  width: 600rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 40rpx;
}

.modal-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #1a1a2e;
  display: block;
  margin-bottom: 30rpx;
}

.form-item {
  margin-bottom: 24rpx;
}

.form-label {
  display: block;
  font-size: 26rpx;
  color: #555;
  margin-bottom: 10rpx;
}

.form-input {
  width: 100%;
  height: 72rpx;
  border: 2rpx solid #ddd;
  border-radius: 8rpx;
  padding: 0 20rpx;
  font-size: 26rpx;
  box-sizing: border-box;
}

.picker-box {
  width: 100%;
  height: 72rpx;
  border: 2rpx solid #ddd;
  border-radius: 8rpx;
  padding: 0 20rpx;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  font-size: 26rpx;
  color: #333;
}

.picker-box .placeholder {
  color: #999;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 20rpx;
  margin-top: 30rpx;
}

.btn-cancel {
  background: #eee;
  color: #666;
  border: none;
  font-size: 26rpx;
  padding: 14rpx 36rpx;
  border-radius: 8rpx;
}
</style>
```

- [ ] **Step 3: Commit**

```bash
git add audio-platform/audio-platform/pages-admin/categories/categories.vue
git commit -m "refactor: admin categories page to 2-level tree with 2-column picker"
```

---

### Task 8: Update Admin Audio Edit Page (2-level category, validation)

**Files:**
- Modify: `audio-platform/audio-platform/pages-admin/audio/edit.vue`

- [ ] **Step 1: Replace the category picker section in template**

Change the category picker from 3-column to 2-column, update hint text, update form validation message:

1. Change categoryRange to 2 columns: `const categoryRange = ref([[], []])`
2. Change categoryValue to 2 indices: `const categoryValue = ref([0, 0])`
3. Simplify `onCategoryColumnChange` — remove level-3 column logic
4. Simplify `onCategoryChange` — only 2 levels
5. Update placeholder text from `'请选择分类（须选第三级）'` to `'请选择分类'`
6. Update validation: `'请选择分类（至少选到第二级）'` → `'请选择分类'`
7. Update `handleSave` — add versions validation: at least 1 version with fileUrl

- [ ] **Step 2: Edit the script section**

Replace the category-related variables and functions:

In `<script setup>`, change:
```js
// From:
const categoryRange = ref([[], [], []])
const categoryValue = ref([0, 0, 0])

// To:
const categoryRange = ref([[], []])
const categoryValue = ref([0, 0])
```

Replace `onCategoryColumnChange`:
```js
const onCategoryColumnChange = (e) => {
  const { column, value } = e.detail
  if (column === 0) {
    const l1 = categoryFlatList.value.filter(c => c.level === 1)
    const sel = l1[value]
    const l2 = categoryFlatList.value.filter(c => c.parentId === (sel ? sel._id : ''))
    categoryRange.value[1] = l2.map(c => c.name)
    categoryValue.value[1] = 0
  }
}
```

Replace `onCategoryChange`:
```js
const onCategoryChange = (e) => {
  const vals = e.detail.value
  categoryValue.value = vals
  const l1 = categoryFlatList.value.filter(c => c.level === 1)
  const l2 = categoryFlatList.value.filter(c => c.parentId === (l1[vals[0]] ? l1[vals[0]]._id : ''))
  const names = []
  if (l1[vals[0]]) names.push(l1[vals[0]].name)
  if (l2[vals[1]]) names.push(l2[vals[1]].name)
  categoryText.value = names.join(' > ')
  // Bind to deepest selected category (level-2 if available, otherwise level-1)
  formData.categoryId = (l2[vals[1]] || l1[vals[0]] || {})._id || ''
}
```

Update `handleSave` — change the validation message:
```js
if (!formData.categoryId) {
    uni.showToast({ title: '请选择分类', icon: 'none' })
    currentStep.value = 1
    return
}
```

Add version validation after category check in `handleSave`:
```js
const versions = Object.keys(versionBindings).map(vid => ({
    versionId: vid,
    fileUrl: versionBindings[vid].fileUrl || '',
    fileName: versionBindings[vid].fileName || '',
    fileSize: versionBindings[vid].fileSize || 0,
    duration: versionBindings[vid].duration || ''
}))

// Validate at least one version with file
const hasValidVersion = versions.some(v => v.fileUrl)
if (!hasValidVersion) {
    uni.showToast({ title: '至少绑定一个版本并上传文件', icon: 'none' })
    currentStep.value = 4
    saving.value = false
    return
}
```

- [ ] **Step 3: Update the category picker template text**

Change:
```html
<text :class="{ placeholder: !categoryText }">
  {{ categoryText || '请选择分类（须选第三级）' }}
</text>
```
To:
```html
<text :class="{ placeholder: !categoryText }">
  {{ categoryText || '请选择分类' }}
</text>
```

- [ ] **Step 4: Update loadCategories**

```js
const loadCategories = async () => {
  try {
    const res = await adminApi.getCategories()
    if (res.code === 0) {
      categoryFlatList.value = res.data || []
      categoryRange.value[0] = categoryFlatList.value.filter(c => c.level === 1).map(c => c.name)
    }
  } catch (err) { /* ignore */ }
}
```

- [ ] **Step 5: Update findAndSetCategoryValue for 2-level**

```js
const findAndSetCategoryValue = (catId) => {
  const findNode = (id) => categoryFlatList.value.find(c => c._id === id)
  const node = findNode(catId)
  if (!node) return
  const path = []
  let current = node
  while (current) {
    path.unshift(current)
    current = findNode(current.parentId)
  }
  path.forEach((n, i) => {
    if (i >= 2) return // Only 2 levels
    const list = categoryFlatList.value.filter(c => c.level === n.level)
    const idx = list.findIndex(c => c._id === n._id)
    if (idx >= 0) categoryValue.value[i] = idx
  })
}
```

- [ ] **Step 6: Commit**

```bash
git add audio-platform/audio-platform/pages-admin/audio/edit.vue
git commit -m "refactor: admin audio edit page 2-level category, version file validation"
```

---

### Task 9: Update User-Facing Pages

**Files:**
- Modify: `audio-platform/audio-platform/pages/audio/list.vue`
- Modify: `audio-platform/audio-platform/pages/audio/detail.vue`
- Modify: `audio-platform/audio-platform/pages/index/index.vue`

- [ ] **Step 1: Update list.vue — simplify category tree to 2 levels**

Replace the hardcoded `categoryTree` data to 2 levels:

```js
const categoryTree = ref([
  {
    id: 1, name: '影视配乐', count: 86,
    children: [
      { id: 11, name: '预告片', count: 32 },
      { id: 12, name: '纪录片', count: 28 },
      { id: 13, name: '广告片', count: 26 },
    ],
  },
  {
    id: 2, name: '流行音乐', count: 124,
    children: [
      { id: 21, name: '电子', count: 48 },
      { id: 22, name: '爵士', count: 36 },
      { id: 23, name: '摇滚', count: 40 },
    ],
  },
  {
    id: 3, name: '氛围音效', count: 64,
    children: [],
  },
])
```

Remove the level-3 template (grandchild section). Delete lines 68-82 from the template:

```diff
- <!-- Level 3 -->
- <view v-if="cat.children" v-for="child in cat.children" :key="'sub-' + child.id">
-   <view class="tree-grandchildren" v-if="expandedIds.has(child.id) && child.children">
-     <view class="tree-grandchild" ...>
-       ...
-     </view>
-   </view>
- </view>
```

Also remove the `toggleSubCategory` function and the `tree-child` click handler that toggles level 3 — just use `selectCategory(child)` directly on level-2 items.

Change `toggleSubCategory` call to `selectCategory`:
```html
<view class="tree-child" v-for="child in cat.children" :key="child.id"
  @tap="selectCategory(child)">
  <text class="tree-name" :class="{ active: activeCategoryId === child.id }">{{ child.name }}</text>
  <text class="tree-count">{{ child.count }}</text>
</view>
```

- [ ] **Step 2: Update detail.vue — breadcrumbs to 2-level path**

No code changes needed — breadcrumbs are built from `data.categoryPath.split('/')` which adapts automatically to the new path format. Just ensure `api.js` parameter names are consistent.

- [ ] **Step 3: Update index.vue — categories hardcoded data**

Update the `categories` array to reflect 2-level structure (these are display-only top-level cards):

No structural changes needed — the home page shows top-level categories which still exist. Just ensure the hardcoded data looks reasonable.

- [ ] **Step 4: Commit**

```bash
git add audio-platform/audio-platform/pages/audio/list.vue audio-platform/audio-platform/pages/index/index.vue
git commit -m "refactor: user-facing pages 2-level category tree"
```

---

### Task 10: Final Integration & Cleanup

**Files:**
- Modify: `audio-platform/audio-platform/utils/api.js`

- [ ] **Step 1: Update api.js hook signatures to match new cloud function param names**

The user-facing APIs use `audio_id` → need to ensure callers use the new names. Check `userApi.toggleFavorite`:

```js
// Current:
toggleFavorite: (audio_id) =>
    callFunction('user-favorites', { action: 'toggle', audio_id }),

// Keep the parameter name at API level for now — the user-favorites cloud function
// is not in scope for this refactor. Only admin-audio-files and api-audio-files changed.
```

No changes needed in api.js for the cloud functions we modified — they read parameters from `event` directly. The admin CRUD calls already pass camelCase via spread.

- [ ] **Step 2: Verify all files compile**

Run: Check that all edited `.vue` files have balanced script/template tags and all edited `.js` files have no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add audio-platform/audio-platform/utils/api.js
git commit -m "chore: final integration cleanup for Plan B refactor"
```
