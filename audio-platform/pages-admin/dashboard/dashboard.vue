<template>
  <view class="dashboard-page">
    <!-- Sidebar -->
    <AdminSidebar :visible="sidebarVisible" @close="sidebarVisible = false" />

    <!-- Top Bar -->
    <view class="top-bar">
      <view class="top-left">
        <text class="menu-btn" @click="sidebarVisible = true">☰</text>
        <text class="page-title">仪表盘</text>
      </view>
      <view class="top-right">
        <text class="admin-name">{{ adminInfo?.nickname || adminInfo?.username || '管理员' }}</text>
      </view>
    </view>

    <!-- Stat Cards -->
    <view class="stat-grid">
      <view class="stat-card">
        <view class="stat-left">
          <text class="stat-icon">🎵</text>
        </view>
        <view class="stat-right">
          <text class="stat-value">{{ stats.audioCount }}</text>
          <text class="stat-label">音频总数</text>
        </view>
      </view>
      <view class="stat-card">
        <view class="stat-left">
          <text class="stat-icon">📁</text>
        </view>
        <view class="stat-right">
          <text class="stat-value">{{ stats.categoryCount }}</text>
          <text class="stat-label">分类数</text>
        </view>
      </view>
      <view class="stat-card">
        <view class="stat-left">
          <text class="stat-icon">👤</text>
        </view>
        <view class="stat-right">
          <text class="stat-value">{{ stats.userCount }}</text>
          <text class="stat-label">用户数</text>
        </view>
      </view>
      <view class="stat-card">
        <view class="stat-left">
          <text class="stat-icon">📦</text>
        </view>
        <view class="stat-right">
          <text class="stat-value">{{ stats.todayOrderCount }}</text>
          <text class="stat-label">今日订单</text>
        </view>
      </view>
    </view>

    <!-- Recent Orders -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">最近订单</text>
      </view>
      <view class="table-wrapper">
        <view class="table-row table-head">
          <text class="table-cell col-user">用户</text>
          <text class="table-cell col-plan">套餐类型</text>
          <text class="table-cell col-amount">金额</text>
          <text class="table-cell col-status">状态</text>
          <text class="table-cell col-time">时间</text>
        </view>
        <view class="table-row" v-for="order in recentOrders" :key="order._id">
          <text class="table-cell col-user">{{ order.user?.nickname || order.user?.mobile || '-' }}</text>
          <text class="table-cell col-plan">{{ order.planName || '-' }}</text>
          <text class="table-cell col-amount">¥{{ order.amount || 0 }}</text>
          <text class="table-cell col-status">
            <text class="status-tag" :class="'status-' + order.status">
              {{ statusMap[order.status] || order.status }}
            </text>
          </text>
          <text class="table-cell col-time">{{ formatTime(order.createdAt) }}</text>
        </view>
        <view class="empty-row" v-if="recentOrders.length === 0">
          <text class="empty-text">暂无订单</text>
        </view>
      </view>
    </view>

    <!-- Recent Audio -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">最近音频</text>
      </view>
      <view class="table-wrapper">
        <view class="table-row table-head">
          <text class="table-cell col-audio-name">名称</text>
          <text class="table-cell col-category">分类</text>
          <text class="table-cell col-audio-time">创建时间</text>
        </view>
        <view class="table-row" v-for="audio in recentAudio" :key="audio._id">
          <text class="table-cell col-audio-name">{{ audio.name || '-' }}</text>
          <text class="table-cell col-category">{{ audio.categoryName || '-' }}</text>
          <text class="table-cell col-audio-time">{{ formatTime(audio.createdAt) }}</text>
        </view>
        <view class="empty-row" v-if="recentAudio.length === 0">
          <text class="empty-text">暂无音频</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '@/utils/api.js'
import AdminSidebar from '@/components/AdminSidebar.vue'

const sidebarVisible = ref(false)

const adminInfo = ref(null)
const stats = ref({
  audioCount: 0,
  categoryCount: 0,
  userCount: 0,
  todayOrderCount: 0
})
const recentOrders = ref([])
const recentAudio = ref([])

const statusMap = {
  pending: '待支付',
  paid: '已支付',
  refunded: '已退款',
  cancelled: '已取消'
}

const formatTime = (timeStr) => {
  if (!timeStr) return '-'
  const d = new Date(timeStr)
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

const loadDashboard = async () => {
  try {
    const res = await adminApi.getDashboard()
    if (res.code === 0) {
      stats.value = res.data.stats || stats.value
      recentOrders.value = res.data.recentOrders || []
      recentAudio.value = res.data.recentAudio || []
    }
  } catch (err) {
    console.error('loadDashboard error:', err)
  }
}

const handleLogout = () => {
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        uni.removeStorageSync('admin_token')
        uni.removeStorageSync('admin_info')
        uni.redirectTo({ url: '/pages-admin/login/login' })
      }
    }
  })
}

onMounted(() => {
  if (!checkLogin()) return
  try {
    const infoStr = uni.getStorageSync('admin_info')
    if (infoStr) {
      adminInfo.value = JSON.parse(infoStr)
    }
  } catch (e) { /* ignore */ }
  loadDashboard()
})
</script>

<style scoped>
.dashboard-page {
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
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
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

.top-right {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.admin-name {
  font-size: 26rpx;
  color: #555;
}

.logout-btn {
  font-size: 26rpx;
  color: #6c5ce7;
  cursor: pointer;
}

/* Stat Cards */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24rpx;
  margin-bottom: 30rpx;
}

.stat-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 30rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
  border-left: 6rpx solid #6c5ce7;
}

.stat-icon {
  font-size: 48rpx;
}

.stat-right {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 40rpx;
  font-weight: bold;
  color: #1a1a2e;
}

.stat-label {
  font-size: 24rpx;
  color: #999;
  margin-top: 4rpx;
}

/* Section */
.section {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.section-header {
  margin-bottom: 20rpx;
  padding-bottom: 16rpx;
  border-bottom: 2rpx solid #eee;
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #1a1a2e;
}

/* Table */
.table-wrapper {
  width: 100%;
}

.table-row {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.table-row:last-child {
  border-bottom: none;
}

.table-head {
  background: #f9f9fb;
  padding: 16rpx 0;
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

.col-user { flex: 2; }
.col-plan { flex: 1.5; }
.col-amount { flex: 1; }
.col-status { flex: 1.5; }
.col-time { flex: 2; }

.col-audio-name { flex: 3; }
.col-category { flex: 2; }
.col-audio-time { flex: 2; }

.status-tag {
  padding: 4rpx 16rpx;
  border-radius: 6rpx;
  font-size: 22rpx;
}

.status-pending { background: #fff3cd; color: #856404; }
.status-paid { background: #d4edda; color: #155724; }
.status-refunded { background: #f8d7da; color: #721c24; }
.status-cancelled { background: #e2e3e5; color: #383d41; }

.empty-row {
  padding: 40rpx;
  text-align: center;
}

.empty-text {
  color: #bbb;
  font-size: 26rpx;
}
</style>
