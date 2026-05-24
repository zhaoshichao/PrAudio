<template>
  <view class="tags-page">
    <AdminSidebar :visible="sidebarVisible" @close="sidebarVisible = false" />
    <view class="top-bar">
      <view class="top-left">
        <text class="menu-btn" @click="sidebarVisible = true">☰</text>
        <text class="page-title">标签管理</text>
      </view>
      <button class="btn-primary" @click="openAddModal">+ 新增标签</button>
    </view>

    <view class="table-card">
      <view class="table-row table-head">
        <text class="table-cell col-color">颜色</text>
        <text class="table-cell col-name">标签名</text>
        <text class="table-cell col-time">创建时间</text>
        <text class="table-cell col-action">操作</text>
      </view>
      <view class="table-row" v-for="tag in tagList" :key="tag._id">
        <text class="table-cell col-color">
          <view class="color-dot" :style="{ backgroundColor: tag.color }"></view>
        </text>
        <text class="table-cell col-name">{{ tag.name }}</text>
        <text class="table-cell col-time">{{ formatTime(tag.createdAt) }}</text>
        <text class="table-cell col-action">
          <text class="action-btn edit-btn" @click="openEditModal(tag)">编辑</text>
          <text class="action-btn delete-btn" @click="handleDelete(tag)">删除</text>
        </text>
      </view>
      <view class="empty-row" v-if="tagList.length === 0">
        <text class="empty-text">暂无标签，请新增</text>
      </view>
    </view>

    <!-- Add/Edit Modal -->
    <view class="modal-mask" v-if="showModal" @click="closeModal">
      <view class="modal-card" @click.stop>
        <text class="modal-title">{{ isEdit ? '编辑标签' : '新增标签' }}</text>
        <view class="modal-form">
          <view class="form-item">
            <text class="form-label">标签名称</text>
            <input class="form-input" v-model="formData.name" placeholder="请输入标签名称" placeholder-style="color:#999" />
          </view>
          <view class="form-item">
            <text class="form-label">选择颜色</text>
            <view class="color-grid">
              <view
                v-for="color in presetColors"
                :key="color"
                class="color-item"
                :class="{ selected: formData.color === color }"
                :style="{ backgroundColor: color }"
                @click="formData.color = color"
              >
                <text v-if="formData.color === color" class="check-mark">✓</text>
              </view>
            </view>
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

const tagList = ref([])
const showModal = ref(false)
const isEdit = ref(false)
const saving = ref(false)

const presetColors = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
  '#1abc9c', '#3498db', '#9b59b6', '#e91e63',
  '#00bcd4', '#8bc34a', '#ff5722', '#607d8b'
]

const formData = reactive({
  name: '',
  color: '#3498db'
})

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

const loadTags = async () => {
  try {
    const res = await adminApi.getTags()
    if (res.code === 0) {
      tagList.value = res.data || []
    }
  } catch (err) {
    console.error('loadTags error:', err)
  }
}

const openAddModal = () => {
  isEdit.value = false
  formData.name = ''
  formData.color = '#3498db'
  showModal.value = true
}

const openEditModal = (tag) => {
  isEdit.value = true
  formData.name = tag.name
  formData.color = tag.color || '#3498db'
  formData._id = tag._id
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const handleSave = async () => {
  if (!formData.name.trim()) {
    uni.showToast({ title: '请输入标签名称', icon: 'none' })
    return
  }
  if (!formData.color) {
    uni.showToast({ title: '请选择颜色', icon: 'none' })
    return
  }
  saving.value = true
  try {
    const payload = {
      name: formData.name.trim(),
      color: formData.color
    }
    let res
    if (isEdit.value) {
      res = await adminApi.updateTag(formData._id, payload)
    } else {
      res = await adminApi.createTag(payload)
    }
    if (res.code === 0) {
      uni.showToast({ title: isEdit.value ? '更新成功' : '创建成功', icon: 'success' })
      closeModal()
      loadTags()
    } else {
      uni.showToast({ title: res.msg || '操作失败', icon: 'none' })
    }
  } catch (err) {
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    saving.value = false
  }
}

const handleDelete = (tag) => {
  uni.showModal({
    title: '确认删除',
    content: `确定删除标签 "${tag.name}"？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          const result = await adminApi.deleteTag(tag._id)
          if (result.code === 0) {
            uni.showToast({ title: '删除成功', icon: 'success' })
            loadTags()
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

onMounted(() => {
  if (!checkLogin()) return
  loadTags()
})
</script>

<style scoped>
.tags-page {
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

.table-card {
  background: #fff;
  border-radius: 12rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
  padding: 0 30rpx;
}

.table-row {
  display: flex;
  align-items: center;
  padding: 22rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.table-row:last-child {
  border-bottom: none;
}

.table-head {
  background: #f9f9fb;
  margin: 0 -30rpx;
  padding: 16rpx 30rpx;
  border-radius: 8rpx;
}

.table-head .table-cell {
  font-weight: bold;
  color: #555;
  font-size: 24rpx;
}

.table-cell {
  font-size: 26rpx;
  color: #333;
}

.col-color { width: 100rpx; }
.col-name { flex: 2; }
.col-time { flex: 2; }
.col-action { flex: 1.5; display: flex; gap: 16rpx; }

.color-dot {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  border: 2rpx solid #ddd;
}

.action-btn {
  font-size: 24rpx;
  padding: 6rpx 20rpx;
  border-radius: 4rpx;
  cursor: pointer;
}

.edit-btn { color: #6c5ce7; background: #f0edff; }
.delete-btn { color: #d32f2f; background: #fff0f0; }

.empty-row {
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
  top: 0; left: 0; right: 0; bottom: 0;
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

.form-item { margin-bottom: 24rpx; }

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

.color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.color-item {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 4rpx solid transparent;
  transition: border-color 0.2s;
}

.color-item.selected {
  border-color: #333;
}

.check-mark {
  color: #fff;
  font-size: 28rpx;
  font-weight: bold;
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
