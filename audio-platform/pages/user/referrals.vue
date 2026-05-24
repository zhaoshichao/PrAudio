<template>
  <view class="referrals-page">
    <!-- Header -->
    <view class="nav-bar">
      <view class="back-btn" @tap="goBack">
        <text class="back-arrow">‹</text>
      </view>
      <text class="nav-title">推广记录</text>
    </view>

    <!-- Referral Code Card -->
    <view class="code-card">
      <text class="code-label">我的推荐码</text>
      <text class="code-value">{{ referralCode }}</text>
      <view class="copy-btn" @tap="copyCode">
        <text>复制推荐码</text>
      </view>
    </view>

    <!-- Stats -->
    <view class="stats-row">
      <view class="stat-card">
        <text class="stat-value">{{ stats.totalReferrals }}</text>
        <text class="stat-label">累计推广</text>
      </view>
      <view class="stat-card">
        <text class="stat-value">{{ stats.activeReferrals }}</text>
        <text class="stat-label">活跃用户</text>
      </view>
      <view class="stat-card">
        <text class="stat-value">{{ stats.earnedRewards || 0 }}</text>
        <text class="stat-label">获得奖励</text>
      </view>
    </view>

    <!-- Referral List -->
    <view class="section">
      <text class="section-title">推荐用户</text>
    </view>

    <scroll-view
      scroll-y
      class="list-scroll"
      @scrolltolower="loadMore"
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
    >
      <view class="user-list" v-if="list.length > 0">
        <view class="user-card" v-for="user in list" :key="user.id">
          <view class="user-avatar">
            <text class="avatar-text">{{ getInitial(user.nickname) }}</text>
          </view>
          <view class="user-info">
            <text class="user-name">{{ user.nickname || '匿名用户' }}</text>
            <text class="user-mobile">{{ maskMobile(user.mobile) }}</text>
          </view>
          <view class="user-date">
            <text class="date-text">{{ formatDate(user.registerDate) }}</text>
          </view>
        </view>
      </view>

      <view class="load-more" v-if="hasMore && list.length > 0">
        <text class="load-text">加载更多...</text>
      </view>

      <view class="empty-state" v-if="!loading && list.length === 0">
        <text class="empty-icon">👥</text>
        <text class="empty-text">还没有推荐用户</text>
        <text class="empty-hint">分享推荐码给好友，一起使用优质音频素材</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { userApi } from '@/utils/api.js'

const referralCode = ref('')
const stats = ref({
  totalReferrals: 0,
  activeReferrals: 0,
  earnedRewards: 0,
})

const list = ref([])
const loading = ref(false)
const refreshing = ref(false)
const hasMore = ref(true)
const page = ref(1)
const pageSize = 20

onMounted(() => {
  loadReferralInfo()
  loadList()
})

function loadReferralInfo() {
  const stored = uni.getStorageSync('userInfo')
  referralCode.value = stored?.referralCode || '--------'

  userApi.getReferralStats().then(res => {
    if (res.data) {
      stats.value = {
        totalReferrals: res.data.totalReferrals || 0,
        activeReferrals: res.data.activeReferrals || 0,
        earnedRewards: res.data.earnedRewards || 0,
      }
      referralCode.value = res.data.referralCode || referralCode.value
    }
  }).catch(() => {})
}

function loadList() {
  loading.value = true
  userApi.getReferralList({ page: page.value, pageSize }).then(res => {
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

function copyCode() {
  uni.setClipboardData({
    data: referralCode.value,
    success: () => {
      uni.showToast({ title: '推荐码已复制', icon: 'success' })
    },
  })
}

function getInitial(name) {
  if (!name) return '?'
  return name.charAt(0)
}

function maskMobile(mobile) {
  if (!mobile) return '--'
  return mobile.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

function formatDate(timestamp) {
  if (!timestamp) return '--'
  const d = new Date(timestamp)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function goBack() {
  uni.navigateBack()
}
</script>

<style scoped>
.referrals-page {
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

/* Code Card */
.code-card {
  margin: 28rpx 24rpx;
  background: linear-gradient(135deg, rgba(108, 92, 231, 0.25), rgba(168, 85, 247, 0.2));
  border: 2rpx solid rgba(108, 92, 231, 0.4);
  border-radius: 12rpx;
  padding: 36rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.code-label {
  font-size: 24rpx;
  color: #aaa;
}

.code-value {
  font-size: 52rpx;
  font-weight: bold;
  color: #fff;
  letter-spacing: 8rpx;
}

.copy-btn {
  padding: 14rpx 44rpx;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 28rpx;
  font-size: 26rpx;
  color: #fff;
}

/* Stats */
.stats-row {
  display: flex;
  gap: 16rpx;
  padding: 0 24rpx;
  margin-bottom: 28rpx;
}

.stat-card {
  flex: 1;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12rpx;
  padding: 24rpx 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}

.stat-value {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
}

.stat-label {
  font-size: 22rpx;
  color: #888;
}

/* Section */
.section {
  padding: 0 24rpx 16rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #ccc;
}

/* User List */
.list-scroll {
  flex: 1;
}

.user-list {
  padding: 0 24rpx 24rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.user-card {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12rpx;
  padding: 20rpx 20rpx;
  gap: 16rpx;
}

.user-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: rgba(108, 92, 231, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-text {
  font-size: 28rpx;
  font-weight: bold;
  color: #a29bfe;
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.user-name {
  font-size: 26rpx;
  color: #ccc;
  font-weight: bold;
}

.user-mobile {
  font-size: 22rpx;
  color: #888;
}

.user-date {
  flex-shrink: 0;
}

.date-text {
  font-size: 22rpx;
  color: #666;
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
  padding: 120rpx 0;
}

.empty-icon {
  font-size: 72rpx;
  margin-bottom: 16rpx;
  opacity: 0.4;
}

.empty-text {
  font-size: 28rpx;
  color: #888;
  margin-bottom: 8rpx;
}

.empty-hint {
  font-size: 22rpx;
  color: #666;
  text-align: center;
  padding: 0 60rpx;
  line-height: 1.5;
}
</style>
