<template>
  <view class="orders-page">
    <AdminSidebar :visible="sidebarVisible" @close="sidebarVisible = false" />
    <!-- Top Bar -->
    <view class="top-bar">
      <view class="top-left">
        <text class="menu-btn" @click="sidebarVisible = true">☰</text>
        <text class="page-title">订单管理</text>
      </view>
    </view>

    <!-- Tab Filters -->
    <view class="tab-bar">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-item"
        :class="{ active: activeTab === tab.value }"
        @click="switchTab(tab.value)"
      >
        <text>{{ tab.label }}</text>
        <text class="tab-count" v-if="tabCounts[tab.value] !== undefined">({{ tabCounts[tab.value] }})</text>
      </view>
    </view>

    <!-- Table -->
    <view class="table-card">
      <view class="table-row table-head">
        <text class="table-cell col-id">订单ID</text>
        <text class="table-cell col-user">用户</text>
        <text class="table-cell col-plan">套餐</text>
        <text class="table-cell col-amount">金额</text>
        <text class="table-cell col-status">状态</text>
        <text class="table-cell col-time">时间</text>
      </view>
      <view v-for="order in orderList" :key="order._id">
        <view class="table-row" @click="toggleExpand(order._id)">
          <text class="table-cell col-id">{{ truncateId(order._id) }}</text>
          <text class="table-cell col-user">{{ order.user?.nickname || order.user?.mobile || '-' }}</text>
          <text class="table-cell col-plan">{{ order.planName || order.planType || '-' }}</text>
          <text class="table-cell col-amount">¥{{ order.amount || 0 }}</text>
          <text class="table-cell col-status">
            <text class="status-tag" :class="'status-' + order.status">
              {{ statusLabel(order.status) }}
            </text>
          </text>
          <text class="table-cell col-time">{{ formatTime(order.createdAt) }}</text>
        </view>
        <!-- Expanded Detail -->
        <view class="expand-detail" v-if="expandedId === order._id">
          <view class="detail-row">
            <text class="dl">订单号</text>
            <text class="dv">{{ order._id }}</text>
          </view>
          <view class="detail-row" v-if="order.tradeNo">
            <text class="dl">交易号</text>
            <text class="dv">{{ order.tradeNo }}</text>
          </view>
          <view class="detail-row">
            <text class="dl">用户手机</text>
            <text class="dv">{{ order.user?.mobile || '-' }}</text>
          </view>
          <view class="detail-row">
            <text class="dl">用户昵称</text>
            <text class="dv">{{ order.user?.nickname || '-' }}</text>
          </view>
          <view class="detail-row">
            <text class="dl">套餐类型</text>
            <text class="dv">{{ order.planName || order.planType || '-' }}</text>
          </view>
          <view class="detail-row" v-if="order.planDuration">
            <text class="dl">套餐时长</text>
            <text class="dv">{{ order.planDuration }} 天</text>
          </view>
          <view class="detail-row">
            <text class="dl">支付金额</text>
            <text class="dv" style="color:#d32f2f;font-weight:bold;">¥{{ order.amount || 0 }}</text>
          </view>
          <view class="detail-row">
            <text class="dl">支付方式</text>
            <text class="dv">{{ order.payMethod || '-' }}</text>
          </view>
          <view class="detail-row">
            <text class="dl">支付时间</text>
            <text class="dv">{{ order.paidAt ? formatTime(order.paidAt) : '-' }}</text>
          </view>
          <view class="detail-row" v-if="order.refundAt">
            <text class="dl">退款时间</text>
            <text class="dv">{{ formatTime(order.refundAt) }}</text>
          </view>
          <view class="detail-row" v-if="order.refundReason">
            <text class="dl">退款原因</text>
            <text class="dv">{{ order.refundReason }}</text>
          </view>
          <view class="detail-row">
            <text class="dl">创建时间</text>
            <text class="dv">{{ formatTime(order.createdAt) }}</text>
          </view>
        </view>
      </view>
      <view class="empty-row" v-if="orderList.length === 0">
        <text class="empty-text">暂无订单数据</text>
      </view>
    </view>

    <!-- Pagination -->
    <view class="pagination" v-if="total > pageSize">
      <text class="page-btn" :class="{ disabled: page === 1 }" @click="changePage(page - 1)">上一页</text>
      <text class="page-info">{{ page }} / {{ Math.ceil(total / pageSize) }}</text>
      <text class="page-btn" :class="{ disabled: page * pageSize >= total }" @click="changePage(page + 1)">下一页</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '@/utils/api.js'
import AdminSidebar from '@/components/AdminSidebar.vue'

const sidebarVisible = ref(false)

const tabs = [
  { label: '全部', value: '' },
  { label: '待支付', value: 'pending' },
  { label: '已支付', value: 'paid' },
  { label: '已退款', value: 'refunded' }
]

const activeTab = ref('')
const tabCounts = ref({})
const orderList = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const expandedId = ref(null)

const truncateId = (id) => {
  if (!id) return '-'
  return id.length > 12 ? id.slice(0, 6) + '...' + id.slice(-6) : id
}

const statusLabel = (status) => {
  const map = {
    pending: '待支付',
    paid: '已支付',
    refunded: '已退款',
    cancelled: '已取消'
  }
  return map[status] || status || '-'
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

const loadOrders = async () => {
  try {
    const res = await adminApi.getOrders({
      page: page.value,
      pageSize: pageSize.value,
      status: activeTab.value || undefined
    })
    if (res.code === 0) {
      orderList.value = res.data.list || []
      total.value = res.data.total || 0
      if (res.data.counts) {
        tabCounts.value = res.data.counts
      }
    }
  } catch (err) {
    console.error('loadOrders error:', err)
  }
}

const switchTab = (val) => {
  activeTab.value = val
  page.value = 1
  loadOrders()
}

const toggleExpand = (id) => {
  expandedId.value = expandedId.value === id ? null : id
}

const changePage = (p) => {
  if (p < 1 || p * pageSize.value > total.value + pageSize.value) return
  page.value = p
  loadOrders()
}

onMounted(() => {
  if (!checkLogin()) return
  loadOrders()
})
</script>

<style scoped>
.orders-page {
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

/* Tabs */
.tab-bar {
  display: flex;
  gap: 0;
  background: #fff;
  border-radius: 12rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
  overflow: hidden;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  font-size: 26rpx;
  color: #666;
  border-bottom: 4rpx solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-item.active {
  color: #6c5ce7;
  border-bottom-color: #6c5ce7;
  background: #f9f7ff;
}

.tab-count {
  font-size: 22rpx;
  color: #aaa;
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
  cursor: pointer;
}

.table-row:last-child { border-bottom: none; }

.table-head {
  background: #f9f9fb;
  margin: 0 -30rpx;
  padding: 16rpx 30rpx;
  border-radius: 8rpx;
  cursor: default;
}

.table-head .table-cell {
  font-weight: bold;
  color: #555;
  font-size: 24rpx;
}

.table-cell { font-size: 26rpx; color: #333; }
.col-id { flex: 1.5; }
.col-user { flex: 1.5; }
.col-plan { flex: 1.2; }
.col-amount { flex: 1; }
.col-status { flex: 1; }
.col-time { flex: 1.8; }

.status-tag {
  padding: 4rpx 16rpx;
  border-radius: 6rpx;
  font-size: 22rpx;
}

.status-pending { background: #fff3cd; color: #856404; }
.status-paid { background: #d4edda; color: #155724; }
.status-refunded { background: #f8d7da; color: #721c24; }
.status-cancelled { background: #e2e3e5; color: #383d41; }

/* Expand Detail */
.expand-detail {
  background: #f9f9fb;
  padding: 20rpx 40rpx;
  border-bottom: 1rpx solid #f0f0f0;
  border-left: 4rpx solid #6c5ce7;
  margin: 0 -30rpx;
}

.detail-row {
  display: flex;
  padding: 10rpx 0;
  font-size: 24rpx;
}

.dl {
  width: 140rpx;
  color: #888;
}

.dv {
  flex: 1;
  color: #333;
}

.empty-row {
  padding: 60rpx;
  text-align: center;
}

.empty-text { color: #bbb; font-size: 26rpx; }

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 24rpx;
  margin-top: 30rpx;
  padding: 24rpx;
  background: #fff;
  border-radius: 12rpx;
}

.page-btn {
  font-size: 26rpx;
  color: #6c5ce7;
  padding: 10rpx 28rpx;
  border: 2rpx solid #6c5ce7;
  border-radius: 6rpx;
}

.page-btn.disabled { color: #ccc; border-color: #ddd; }
.page-info { font-size: 26rpx; color: #555; }
</style>
