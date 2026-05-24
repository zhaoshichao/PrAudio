<template>
  <view class="user-page">
    <!-- Profile Card -->
    <view class="profile-card">
      <view class="avatar-wrap">
        <image class="avatar" :src="userInfo.avatar || defaultAvatar" mode="aspectFill" />
      </view>
      <view class="profile-info">
        <text class="nickname">{{ userInfo.nickname || '未登录用户' }}</text>
        <view class="member-tag" v-if="userMember.isMember">
          <text class="member-tag-text">👑 {{ memberLabel }}</text>
        </view>
        <view class="member-tag free" v-else>
          <text class="member-tag-text">普通用户</text>
        </view>
      </view>
      <view class="edit-btn" @tap="goToLogin" v-if="!isLoggedIn">
        <text>登录</text>
      </view>
    </view>

    <!-- Referral Code -->
    <view class="referral-card" v-if="isLoggedIn">
      <view class="referral-left">
        <text class="referral-label">我的推荐码</text>
        <text class="referral-code">{{ referralCode }}</text>
      </view>
      <view class="copy-btn" @tap="copyReferralCode">
        <text>复制</text>
      </view>
    </view>

    <!-- Menu List -->
    <view class="menu-section">
      <view class="menu-item" @tap="goToFavorites">
        <text class="menu-icon">♥</text>
        <text class="menu-text">我的收藏</text>
        <view class="menu-right">
          <text class="menu-badge" v-if="favoriteCount > 0">{{ favoriteCount }}</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>
      <view class="menu-item" @tap="goToOrders">
        <text class="menu-icon">📋</text>
        <text class="menu-text">我的订单</text>
        <view class="menu-right">
          <text class="menu-arrow">›</text>
        </view>
      </view>
      <view class="menu-item" @tap="goToReferrals">
        <text class="menu-icon">👥</text>
        <text class="menu-text">推广记录</text>
        <view class="menu-right">
          <text class="menu-arrow">›</text>
        </view>
      </view>
      <view class="menu-item" @tap="contactUs">
        <text class="menu-icon">💬</text>
        <text class="menu-text">联系我们</text>
        <view class="menu-right">
          <text class="menu-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- Logout -->
    <view class="logout-section" v-if="isLoggedIn">
      <view class="logout-btn" @tap="handleLogout">
        <text>退出登录</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { userApi } from '@/utils/api.js'

const userInfo = ref({})
const userMember = ref({})
const favoriteCount = ref(0)
const referralCode = ref('')
const defaultAvatar = '/static/default-avatar.png'

const isLoggedIn = computed(() => !!uni.getStorageSync('token'))

const memberLabel = computed(() => {
  const map = { monthly: '月度会员', quarterly: '季度会员', yearly: '年度会员', permanent: '永久会员' }
  return map[userMember.value.type] || '会员'
})

onMounted(() => {
  if (isLoggedIn.value) {
    loadUserData()
  }
})

function loadUserData() {
  const stored = uni.getStorageSync('userInfo')
  if (stored) {
    userInfo.value = stored
    userMember.value = stored.member || {}
    referralCode.value = stored.referralCode || '--------'
    favoriteCount.value = stored.favoriteCount || 0
  }
  // Refresh from server
  userApi.getUserProfile().then(res => {
    if (res.data) {
      userInfo.value = res.data
      userMember.value = res.data.member || {}
      referralCode.value = res.data.referralCode || referralCode.value
      favoriteCount.value = res.data.favoriteCount || 0
      uni.setStorageSync('userInfo', res.data)
    }
  }).catch(() => {})
}

function copyReferralCode() {
  uni.setClipboardData({
    data: referralCode.value,
    success: () => {
      uni.showToast({ title: '推荐码已复制', icon: 'success' })
    },
  })
}

function goToLogin() {
  uni.navigateTo({ url: '/pages/login/login' })
}

function goToFavorites() {
  if (!isLoggedIn.value) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    return
  }
  uni.navigateTo({ url: '/pages/user/favorites' })
}

function goToOrders() {
  if (!isLoggedIn.value) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    return
  }
  uni.navigateTo({ url: '/pages/user/orders' })
}

function goToReferrals() {
  if (!isLoggedIn.value) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    return
  }
  uni.navigateTo({ url: '/pages/user/referrals' })
}

function contactUs() {
  uni.showToast({ title: '客服微信: audioplatform', icon: 'none' })
}

function handleLogout() {
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        uni.removeStorageSync('token')
        uni.removeStorageSync('userInfo')
        uni.reLaunch({ url: '/pages/login/login' })
      }
    },
  })
}
</script>

<style scoped>
.user-page {
  min-height: 100vh;
  background: #1a1a2e;
  padding: 40rpx 24rpx 80rpx;
}

/* Profile Card */
.profile-card {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12rpx;
  padding: 32rpx 24rpx;
  margin-bottom: 24rpx;
}

.avatar-wrap {
  width: 108rpx;
  height: 108rpx;
  border-radius: 50%;
  overflow: hidden;
  border: 3rpx solid rgba(108, 92, 231, 0.5);
  margin-right: 24rpx;
  flex-shrink: 0;
}

.avatar {
  width: 100%;
  height: 100%;
  background: rgba(108, 92, 231, 0.2);
}

.profile-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.nickname {
  font-size: 34rpx;
  font-weight: bold;
  color: #fff;
}

.member-tag {
  align-self: flex-start;
  background: rgba(255, 215, 0, 0.15);
  padding: 4rpx 16rpx;
  border-radius: 16rpx;
}

.member-tag.free {
  background: rgba(255, 255, 255, 0.08);
}

.member-tag-text {
  font-size: 22rpx;
  color: #f0c040;
}

.member-tag.free .member-tag-text {
  color: #888;
}

.edit-btn {
  padding: 12rpx 28rpx;
  background: linear-gradient(135deg, #6c5ce7, #a855f7);
  border-radius: 28rpx;
  font-size: 26rpx;
  color: #fff;
}

/* Referral */
.referral-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12rpx;
  padding: 28rpx 24rpx;
  margin-bottom: 24rpx;
}

.referral-left {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.referral-label {
  font-size: 22rpx;
  color: #888;
}

.referral-code {
  font-size: 36rpx;
  font-weight: bold;
  color: #6c5ce7;
  letter-spacing: 4rpx;
}

.copy-btn {
  padding: 12rpx 32rpx;
  background: rgba(108, 92, 231, 0.2);
  border-radius: 24rpx;
  font-size: 24rpx;
  color: #6c5ce7;
}

/* Menu */
.menu-section {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 28rpx 24rpx;
  gap: 16rpx;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.05);
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-icon {
  font-size: 36rpx;
}

.menu-text {
  flex: 1;
  font-size: 28rpx;
  color: #ccc;
}

.menu-right {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.menu-badge {
  background: #e74c3c;
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 16rpx;
  min-width: 36rpx;
  text-align: center;
}

.menu-arrow {
  font-size: 32rpx;
  color: #666;
}

/* Logout */
.logout-section {
  padding: 0 40rpx;
}

.logout-btn {
  height: 88rpx;
  background: rgba(231, 76, 60, 0.1);
  border: 2rpx solid rgba(231, 76, 60, 0.3);
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #e74c3c;
}
</style>
