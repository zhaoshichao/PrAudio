<template>
  <view class="admins-page">
    <AdminSidebar :visible="sidebarVisible" @close="sidebarVisible = false" />
    <!-- Top Bar -->
    <view class="top-bar">
      <view class="top-left">
        <text class="menu-btn" @click="sidebarVisible = true">☰</text>
        <text class="page-title">管理员管理</text>
      </view>
      <button class="btn-primary" @click="openAddModal">+ 新增管理员</button>
    </view>

    <!-- Table -->
    <view class="table-card">
      <view class="table-row table-head">
        <text class="table-cell col-username">用户名</text>
        <text class="table-cell col-role">角色</text>
        <text class="table-cell col-status">状态</text>
        <text class="table-cell col-created">创建时间</text>
        <text class="table-cell col-action">操作</text>
      </view>
      <view class="table-row" v-for="admin in adminList" :key="admin._id">
        <text class="table-cell col-username">{{ admin.username }}</text>
        <text class="table-cell col-role">
          <text class="role-badge" :class="admin.role === 'super_admin' ? 'role-super' : 'role-normal'">
            {{ admin.role === 'super_admin' ? '超级管理员' : '普通管理员' }}
          </text>
        </text>
        <text class="table-cell col-status">
          <text class="status-text" :class="admin.status === 1 ? 'active' : 'inactive'">
            {{ admin.status === 1 ? '启用' : '禁用' }}
          </text>
        </text>
        <text class="table-cell col-created">{{ formatTime(admin.createdAt) }}</text>
        <text class="table-cell col-action">
          <text class="action-btn edit-btn" @click="openEditModal(admin)">编辑</text>
          <text class="action-btn delete-btn" v-if="admin.role !== 'super_admin'" @click="handleDelete(admin)">删除</text>
        </text>
      </view>
      <view class="empty-row" v-if="adminList.length === 0">
        <text class="empty-text">暂无管理员数据</text>
      </view>
    </view>

    <!-- Add/Edit Modal -->
    <view class="modal-mask" v-if="showModal" @click="closeModal">
      <view class="modal-card" @click.stop>
        <text class="modal-title">{{ isEdit ? '编辑管理员' : '新增管理员' }}</text>
        <view class="modal-form">
          <view class="form-item">
            <text class="form-label">用户名</text>
            <input class="form-input" v-model="formData.username" placeholder="请输入用户名" placeholder-style="color:#999" />
          </view>
          <view class="form-item">
            <text class="form-label">密码 <text class="form-hint-text">{{ isEdit ? '(留空则不修改)' : '' }}</text></text>
            <input class="form-input" v-model="formData.password" type="password" placeholder="请输入密码" placeholder-style="color:#999" />
          </view>
          <view class="form-item">
            <text class="form-label">角色</text>
            <picker :range="roleOptions" :value="formData.roleIndex" @change="onRoleChange">
              <view class="picker-box">
                <text>{{ roleOptions[formData.roleIndex] }}</text>
              </view>
            </picker>
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
import { ref, reactive, onMounted } from 'vue'
import { adminApi } from '@/utils/api.js'
import AdminSidebar from '@/components/AdminSidebar.vue'

const sidebarVisible = ref(false)

const adminList = ref([])
const showModal = ref(false)
const isEdit = ref(false)
const saving = ref(false)

const roleOptions = ['普通管理员', '超级管理员']

const formData = reactive({
  _id: '',
  username: '',
  password: '',
  role: 'admin',
  roleIndex: 0,
})

const formatTime = (t) => {
  if (!t) return '-'
  const d = new Date(t)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const checkLogin = () => {
  const token = uni.getStorageSync('admin_token')
  if (!token) {
    uni.redirectTo({ url: '/pages-admin/login/login' })
    return false
  }
  return true
}

const checkSuperAdmin = () => {
  try {
    const info = JSON.parse(uni.getStorageSync('admin_info') || '{}')
    if (info.role !== 'super_admin') {
      uni.showToast({ title: '仅超级管理员可访问', icon: 'none' })
      setTimeout(() => uni.navigateBack(), 1500)
      return false
    }
    return true
  } catch (e) {
    return false
  }
}

const loadAdmins = async () => {
  try {
    const res = await adminApi.getAdmins()
    if (res.code === 0) {
      adminList.value = res.data || []
    }
  } catch (err) {
    console.error('loadAdmins error:', err)
  }
}

const openAddModal = () => {
  isEdit.value = false
  formData._id = ''
  formData.username = ''
  formData.password = ''
  formData.role = 'admin'
  formData.roleIndex = 0
  showModal.value = true
}

const openEditModal = (admin) => {
  isEdit.value = true
  formData._id = admin._id
  formData.username = admin.username
  formData.password = ''
  formData.role = admin.role || 'admin'
  formData.roleIndex = admin.role === 'super_admin' ? 1 : 0
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const onRoleChange = (e) => {
  formData.roleIndex = e.detail.value
  formData.role = e.detail.value === 1 ? 'super_admin' : 'admin'
}

const handleSave = async () => {
  if (!formData.username.trim()) {
    uni.showToast({ title: '请输入用户名', icon: 'none' })
    return
  }
  if (!isEdit.value && !formData.password.trim()) {
    uni.showToast({ title: '请输入密码', icon: 'none' })
    return
  }
  saving.value = true
  try {
    const payload = {
      username: formData.username.trim(),
      role: formData.role,
    }
    if (formData.password.trim()) {
      payload.password = formData.password.trim()
    }
    let res
    if (isEdit.value) {
      res = await adminApi.updateAdmin({ _id: formData._id, ...payload })
    } else {
      res = await adminApi.createAdmin(payload)
    }
    if (res.code === 0) {
      uni.showToast({ title: isEdit.value ? '更新成功' : '创建成功', icon: 'success' })
      closeModal()
      loadAdmins()
    } else {
      uni.showToast({ title: res.msg || '操作失败', icon: 'none' })
    }
  } catch (err) {
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    saving.value = false
  }
}

const handleDelete = (admin) => {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除管理员 "${admin.username}" 吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          const result = await adminApi.deleteAdmin(admin._id)
          if (result.code === 0) {
            uni.showToast({ title: '删除成功', icon: 'success' })
            loadAdmins()
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
  if (!checkSuperAdmin()) return
  loadAdmins()
})
</script>

<style scoped>
.admins-page {
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
  margin-bottom: 24rpx;
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

/* Table */
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

.table-row:last-child { border-bottom: none; }

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

.table-cell { font-size: 26rpx; color: #333; }
.col-username { flex: 2; }
.col-role { flex: 1.5; }
.col-status { flex: 1; }
.col-created { flex: 2; }
.col-action { flex: 1.5; display: flex; gap: 10rpx; }

.role-badge {
  font-size: 22rpx;
  padding: 4rpx 14rpx;
  border-radius: 4rpx;
}

.role-super { background: #d4edda; color: #155724; }
.role-normal { background: #e8f4fd; color: #1976d2; }

.status-text { font-size: 24rpx; }
.status-text.active { color: #4caf50; }
.status-text.inactive { color: #999; }

.action-btn {
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  border-radius: 4rpx;
}

.edit-btn { color: #6c5ce7; background: #f0edff; }
.delete-btn { color: #d32f2f; background: #fff0f0; }

.empty-row {
  padding: 60rpx;
  text-align: center;
}

.empty-text { color: #bbb; font-size: 26rpx; }

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
  width: 580rpx;
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

.form-hint-text {
  font-size: 22rpx;
  color: #aaa;
  font-weight: normal;
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
