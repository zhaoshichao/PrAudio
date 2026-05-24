<template>
  <view class="categories-page">
    <AdminSidebar :visible="sidebarVisible" @close="sidebarVisible = false" />
    <!-- Top Bar -->
    <view class="top-bar">
      <view class="top-left">
        <text class="menu-btn" @click="sidebarVisible = true">☰</text>
        <text class="page-title">分类管理</text>
      </view>
      <button class="btn-primary" @click="openAddModal(null)">+ 新增分类</button>
    </view>

    <view class="content-panels">
      <!-- Left: Tree -->
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

      <!-- Right: Detail -->
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
            <picker mode="selector" :range="parentSelectorRange" :value="parentSelectorIndex" @change="onParentChange">
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

const NO_PARENT = '不选'

// Single-column parent selector (only level-1 categories can be parents)
const parentSelectorRange = ref([NO_PARENT])
const parentSelectorIndex = ref(0)
const parentOptions = ref([])  // [{ _id, name }, ...] — only level-1 categories

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
  // Only level-1 categories (no parent) are eligible as parents
  const level1Cats = treeData.value.filter(c => c.level === 1 || !c.parentId)
  parentOptions.value = level1Cats
  parentSelectorRange.value = [NO_PARENT, ...level1Cats.map(c => c.name)]
}

const onParentChange = (e) => {
  const vals = e.detail.value
  const index = vals[0] || vals  // selector mode returns single value or array
  // index 0 = "不选", index > 0 = level-1 category
  if (index > 0 && parentOptions.value[index]) {
    formData.parentId = parentOptions.value[index]._id
    formData.parentPathText = parentOptions.value[index].name
  } else {
    formData.parentId = ''
    formData.parentPathText = ''
  }
}

const openAddModal = (parentNode) => {
  isEdit.value = false
  formData.name = ''
  formData.sort = 0
  formData.parentId = parentNode ? parentNode._id : ''
  formData.parentPathText = parentNode ? parentNode.name : ''
  parentSelectorIndex.value = 0
  if (parentNode) {
    const idx = parentOptions.value.findIndex(c => c._id === parentNode._id)
    if (idx >= 0) parentSelectorIndex.value = idx + 1  // +1 for NO_PARENT offset
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
  parentSelectorIndex.value = 0
  if (node.parentId) {
    const idx = parentOptions.value.findIndex(c => c._id === node.parentId)
    if (idx >= 0) parentSelectorIndex.value = idx + 1
  }
  showModal.value = true
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
