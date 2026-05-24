# Audio Platform Data Model Refactor — Plan B

**Date:** 2026-05-24
**Status:** Approved
**Scope:** Full data model refactor — categories 3→2 levels, naming unification, diff-based audio_versions update, mandatory file binding

---

## 1. Data Model Changes

### 1.1 categories (3-level → 2-level)

| Field | Change | Notes |
|-------|--------|-------|
| `level` | Keep, values 1/2 only (remove 3) | Level auto-computed: no parentId → 1, has parentId → 2 |
| `parent_id` | Rename → `parentId` | camelCase unification |
| `parentName` | Add | Redundant parent name for frontend convenience |
| `sort` | Keep | |
| `icon` | Keep | |
| `status` | Keep | 1=enabled, 0=disabled |
| `createdAt` | Keep | camelCase already |
| `updatedAt` | Keep | camelCase already |

### 1.2 audio_files (bind to level-2)

| Field | Change | Notes |
|-------|--------|-------|
| `category_id` | Rename → `categoryId` | Now points to level-2 category |
| `tag_ids` | Rename → `tagIds` | |
| `cover` | Keep | Cloud fileID for cover image |
| `name` | Keep | |
| `description` | Keep | |
| `sort` | Keep | |
| `status` | Keep | 1=active, 0=inactive (soft delete) |
| `createdAt` | Keep | |
| `updatedAt` | Keep | |

### 1.3 audio_versions (strengthened binding)

| Field | Change | Notes |
|-------|--------|-------|
| `audio_id` | Rename → `audioId` | |
| `version_id` | Rename → `versionId` | |
| `file_url` | Rename → `fileUrl` | **Now required** — every version must have a file |
| `file_name` | Rename → `fileName` | |
| `file_size` | Rename → `fileSize` | |
| `duration` | Keep | Actual file duration in seconds |
| `versionName` | Add | Redundant version name (avoids join on versions table) |
| `createdAt` | Keep | |

**Constraint:** Each audio_file must have at least 1 audio_versions record with a valid fileUrl.

### 1.4 versions (unchanged)

Version templates stay as-is: `name`, `duration`, `sort`, `status`.

### 1.5 Naming Unification Summary

| Collection | snake_case → camelCase |
|------------|------------------------|
| categories | `parent_id` → `parentId` |
| audio_files | `category_id` → `categoryId`, `tag_ids` → `tagIds` |
| audio_versions | `audio_id` → `audioId`, `version_id` → `versionId`, `file_url` → `fileUrl`, `file_name` → `fileName`, `file_size` → `fileSize` |

---

## 2. Cloud Function Changes

### 2.1 admin-categories

- `buildTree`: 2 levels only (remove level-3 logic)
- `create`: level auto-computed; store `parentName` redundant field
- `update`: write `parentId` + `parentName`
- `delete`: add check — refuse if `audio_files` has records with this `categoryId`

### 2.2 admin-audio-files

- All fields use camelCase (`categoryId`, `tagIds`, `fileUrl`, `fileName`, `fileSize`, `audioId`, `versionId`)
- `create`: validate at least 1 version in `data.versions`, each with non-empty `fileUrl`
- `update`: **diff-based instead of delete-all-recreate**:
  - Compare incoming vs existing versions by `versionId`
  - New → `add`, removed → `remove`, changed → `update`, same → skip
- `detail`/`list`: include `versionName` in returned versions

### 2.3 admin-versions

Minimal changes — ensure field naming consistency.

### 2.4 Public API (api-categories, api-audio-files)

- Category tree returns 2-level structure
- All response fields use camelCase
- Remove level-3 references

---

## 3. UI Changes

### 3.1 Admin — Categories Page (`pages-admin/categories/categories.vue`)

- Tree: 2 levels only, remove all level-3 template/logic
- Parent picker: 2-column `multiSelector` instead of 3
- Expand/collapse: simplified 2-level logic

### 3.2 Admin — Audio Edit Page (`pages-admin/audio/edit.vue`)

- Category selector: 2-level cascading picker
- Version binding: each checked version requires a file upload
  - Show upload button per checked version
  - Display file name/size after upload; allow re-upload
  - Submit validation: at least 1 version with fileUrl present
- Form fields use camelCase

### 3.3 User — Audio List Page (`pages/audio/list.vue`)

- Category tree: 2 levels (update hardcoded data)
- API parameters use camelCase: `categoryId`

### 3.4 User — Home Page (`pages/index/index.vue`)

- Category grid: update hardcoded data for 2-level structure

### 3.5 User — Audio Detail Page (`pages/audio/detail.vue`)

- Breadcrumbs: 2-level path
- Version list uses `versionName` redundant field

---

## 4. Migration

### 4.1 Migration Function

Create one-shot cloud function `migration-refactor`:

1. **Flatten categories**: Set level-3 categories to `status=0`. Audio files bind to original level-2 category.
2. **Rename fields** across all 3 collections (categories, audio_files, audio_versions)
3. **Backfill data**: Add `versionName` to audio_versions, add `parentName` to categories
4. **Replace schema files** with updated versions

### 4.2 Notes

- All existing data is test data with negligible volume — no backup needed
- Migration script is idempotent (safe to re-run)
- Run in dev environment first

---

## 5. Files Modified (Complete List)

### Schemas (3 files)
- `uniCloud-aliyun/database/categories.schema.json`
- `uniCloud-aliyun/database/audio_files.schema.json`
- `uniCloud-aliyun/database/audio_versions.schema.json`

### Cloud Functions (3 existing + 1 new)
- `uniCloud-aliyun/cloudfunctions/admin-categories/index.js`
- `uniCloud-aliyun/cloudfunctions/admin-audio-files/index.js`
- `uniCloud-aliyun/cloudfunctions/admin-versions/index.js`
- `uniCloud-aliyun/cloudfunctions/migration-refactor/index.js` (new, one-shot)

### Public API Cloud Functions
- `api-categories/index.js` (if exists)
- `api-audio-files/index.js` (if exists)

### Frontend Pages (5 files)
- `pages-admin/categories/categories.vue`
- `pages-admin/audio/edit.vue`
- `pages/audio/list.vue`
- `pages/audio/detail.vue`
- `pages/index/index.vue`

### API Layer (1 file)
- `utils/api.js` (parameter name updates)
