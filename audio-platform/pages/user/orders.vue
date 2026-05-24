<template>
  <view class="orders-page">
    <!-- Header -->
    <view class="nav-bar">
      <view class="back-btn" @tap="goBack">
        <text class="back-arrow">‹</text>
      </view>
      <text class="nav-title">我的订单</text>
    </view>

    <!-- Tab Filter -->
    <view class="tab-bar">
      <view
        class="tab-item"
        :class="{ active: activeTab === tab.value }"
        v-for="tab in tabs"
        :key="tab.value"
        @tap="switchTab(tab.value)"
      >
        <text>{{ tab.label }}</text>
      </view>
    </view>

    <!-- Order List -->
    <scroll-view
      scroll-y
      class="order-scroll"
      @scrolltolower="loadMore"
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
    >
      <view class="order-list" v-if="list.length > 0">
        <view class="order-card" v-for="order in list" :key="order.id">
          <view class="order-header">
            <text class="order-no">订单号：{{ order.orderNo || order.id }}</text>
            <text class="order-status" :style="{ color: getStatusColor(order.status) }">
              {{ getStatusLabel(order.status) }}
            </text>
          </view>
          <view class="order-body">
            <view class="order-row">
              <text class="order-label">套餐类型</text>
              <text class="order-value">{{ getPlanLabel(order.planType) }}</text>
            </view>
            <view class="order-row">
              <text class="order-label">金额</text>
              <text class="order-value amount">¥{{ order.amount }}</text>
            </view>
            <view class="order-row">
              <text class="order-label">时间</text>
              <text class="order-value">{{ formatTime(order.createTime) }}</text>
            </view>
          </view>
          <view class="order-footer" v-if="order.status === 'pending'">
            <view class="pay-btn" @tap="payOrder(order)">
              <text>去支付</text>
            </view>
          </view>
        </view>
      </view>

      <view class="load-more" v-if="hasMore && list.length > 0">
        <text class="load-text">加载更多...</text>
      </view>

      <view class="empty-state" v-if="!loading && list.length === 0">
        <text class="empty-icon">📋</text>
        <text class="empty-text">暂无订单</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { userApi } from '@/utils/api.js'

const activeTab = ref('all')
const tabs = ref([
  { label: '全部', value: 'all' },
  { label: '待支付', value: 'pending' },
  { label: '已支付', value: 'paid' },
  { label: '已退款', value: 'refunded' },
])

const list = ref([])
const loading = ref(false)
const refreshing = ref(false)
const hasMore = ref(true)
const page = ref(1)
const pageSize = 20

onMounted(() => {
  loadList()
})

function switchTab(val) {
  activeTab.value = val
  page.value = 1
  loadList()
}

function loadList() {
  loading.value = true
  const params = {
    page: page.value,
    pageSize,
    status: activeTab.value === 'all' ? '' : activeTab.value,
  }
  userApi.getOrders(params).then(res => {
    const data = res.data?.list || []
    if (page.value === 1) {
      list.value = data
    } else {
      list.value = [...list.value, ...data]
    }
    hasMore.value = data.length >= pageSize
    refreshing.value = false
  }).catch(() => {
    refreshing.value = false
  }).finally(() => {
    loading.value = false
  })
}

function loadMore() {
  if (!hasMore.value || loading.value) return
  page.value++
  loadList()
}

function onRefresh() {
  refreshing.value = true
  page.value = 1
  loadList()
}

function payOrder(order) {
  uni.showModal({
    title: '确认支付',
    content: `支付 ¥${order.amount}`,
    success: (res) => {
      if (res.confirm) {
        userApi.payOrder({ orderId: order.id }).then(payRes => {
          const payData = payRes.data
          uni.requestPayment({
            timeStamp: payData.timeStamp,
            nonceStr: payData.nonceStr,
            package: payData.package,
            signType: payData.signType || 'MD5',
            paySign: payData.paySign,
            success: () => {
              uni.showToast({ title: '支付成功', icon: 'success' })
              loadList()
            },
            fail: (err) => {
              if (!err.errMsg.includes('cancel')) {
                uni.showToast({ title: '支付失败', icon: 'none' })
              }
            },
          })
        }).catch(err => {
          uni.showToast({ title: err.message || '操作失败', icon: 'none' })
        })
      }
    },
  })
}

function getStatusLabel(status) {
  const map = { pending: '待支付', paid: '已支付', refunded: '已退款' }
  return map[status] || status
}

function getStatusColor(status) {
  const map = { pending: '#f0a040', paid: '#00b894', refunded: '#888' }
  return map[status] || '#888'
}

function getPlanLabel(type) {
  const map = { monthly: '月付会员', quarterly: '季付会员', yearly: '年付会员', permanent: '永久会员' }
  return map[type] || type
}

function goBack() {
  uni.navigateBack()
}

function formatTime(timestamp) {
  if (!timestamp) return '--'
  const d = new Date(timestamp)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}`
}
</script>

<style scoped>
.orders-page {
  min-height: 100vh;
  background: #1a1a2e;
  display: flex;
  flex-direction: column;
}

.nav-bar {
  display: flex;
  align-items: center;
  padding: 20rpx 28rpx;
  background: rgba(26, 26, 46, 0.95);
}

.back-btn {
  width: 64rpx;
  height: 64rpx;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
}

.back-arrow {
  font-size: 44rpx;
  color: #fff;
  line-height: 1;
}

.nav-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
}

/* Tabs */
.tab-bar {
  display: flex;
  padding: 20rpx 24rpx;
  gap: 14rpx;
}

.tab-item {
  padding: 12rpx 28rpx;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 24rpx;
  font-size: 24rpx;
  color: #888;
}

.tab-item.active {
  background: rgba(108, 92, 231, 0.3);
  color: #6c5ce7;
  font-weight: bold;
}

/* Order List */
.order-scroll {
  flex: 1;
}

.order-list {
  padding: 0 24rpx 24rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.order-card {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12rpx;
  overflow: hidden;
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 24rpx;
  background: rgba(255, 255, 255, 0.03);
}

.order-no {
  font-size: 22rpx;
  color: #888;
}

.order-status {
  font-size: 24rpx;
  font-weight: bold;
}

.order-body {
  padding: 16rpx 24rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.order-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.order-label {
  font-size: 24rpx;
  color: #888;
}

.order-value {
  font-size: 26rpx;
  color: #ccc;
}

.order-value.amount {
  color: #6c5ce7;
  font-weight: bold;
}

.order-footer {
  padding: 16rpx 24rpx;
  display: flex;
  justify-content: flex-end;
  border-top: 1rpx solid rgba(255, 255, 255, 0.05);
}

.pay-btn {
  padding: 10rpx 32rpx;
  background: linear-gradient(135deg, #6c5ce7, #a855f7);
  border-radius: 24rpx;
  font-size: 24rpx;
  color: #fff;
  font-weight: bold;
}

.load-more {
  text-align: center;
  padding: 24rpx;
}

.load-text {
  font-size: 24rpx;
  color: #666;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 0;
}

.empty-icon {
  font-size: 72rpx;
  margin-bottom: 16rpx;
  opacity: 0.4;
}

.empty-text {
  font-size: 28rpx;
  color: #888;
}
</style>
