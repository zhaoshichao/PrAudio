<template>
  <view class="detail-page">
    <!-- Back Navigation -->
    <view class="nav-bar">
      <view class="back-btn" @tap="goBack">
        <text class="back-arrow">‹</text>
      </view>
      <text class="nav-title">详情</text>
    </view>

    <scroll-view scroll-y class="detail-scroll" v-if="audio">
      <!-- Large Cover -->
      <view class="cover-section">
        <image class="detail-cover" :src="audio.cover" mode="aspectFill" />
      </view>

      <!-- Basic Info -->
      <view class="info-section">
        <text class="audio-name">{{ audio.name }}</text>
        <view class="breadcrumb">
          <text
            class="breadcrumb-item"
            v-for="(cat, idx) in breadcrumbs"
            :key="idx"
          >
            {{ cat }}
            <text v-if="idx < breadcrumbs.length - 1" class="breadcrumb-sep"> / </text>
          </text>
        </view>

        <!-- Full Description -->
        <view class="desc-card">
          <text class="desc-title">简介</text>
          <text class="desc-text">{{ audio.description || '暂无简介' }}</text>
        </view>

        <!-- Tags -->
        <view class="tags-row" v-if="audio.tags && audio.tags.length">
          <text class="tags-label">标签：</text>
          <text class="detail-tag" v-for="tag in audio.tags" :key="tag">{{ tag }}</text>
        </view>

        <!-- Favorite Button -->
        <view class="favorite-btn" :class="{ favorited: audio.favorited }" @tap="handleFavorite">
          <text class="favorite-icon">{{ audio.favorited ? '♥' : '♡' }}</text>
          <text class="favorite-text">{{ audio.favorited ? '已收藏' : '收藏' }}</text>
        </view>
      </view>

      <!-- Version List -->
      <view class="version-section">
        <text class="section-title">可用版本</text>
        <view class="version-list" v-if="audio.versions && audio.versions.length">
          <view class="version-item" v-for="ver in audio.versions" :key="ver.id || ver.name">
            <view class="version-info">
              <text class="version-name">{{ ver.name }}</text>
              <view class="version-meta">
                <text class="version-duration">{{ ver.duration || '--' }}</text>
                <text class="version-size">{{ ver.fileSize || '--' }}</text>
              </view>
            </view>
            <view class="version-actions">
              <view class="ver-btn play-btn" @tap="playVersion(ver)">
                <text>▶️</text>
              </view>
              <view
                class="ver-btn download-btn"
                :class="{ disabled: !isMember }"
                @tap="handleDownload(ver)"
              >
                <text>⬇</text>
              </view>
            </view>
          </view>
        </view>
        <view class="empty-versions" v-else>
          <text class="empty-text">暂无版本信息</text>
        </view>
      </view>
    </scroll-view>

    <!-- Loading -->
    <view class="loading-state" v-if="!audio">
      <text class="loading-text">加载中...</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { publicApi, userApi } from '@/utils/api.js'

const audio = ref(null)
const breadcrumbs = ref([])
const isMember = ref(false)

onMounted(() => {
  const options = getCurrentPages()
  const page = options[options.length - 1]
  const id = page?.options?.id || page?.$route?.query?.id
  if (id) {
    loadDetail(id)
  }
  checkMember()
})

function checkMember() {
  const userInfo = uni.getStorageSync('userInfo')
  isMember.value = userInfo?.member?.isMember || false
}

function loadDetail(id) {
  publicApi.getAudioDetail({ id }).then(res => {
    const data = res.data
    audio.value = {
      ...data,
      favorited: data.favorited || false,
    }
    // Build breadcrumbs from category path
    if (data.categoryPath) {
      breadcrumbs.value = data.categoryPath.split('/').filter(Boolean)
    }
  }).catch(err => {
    uni.showToast({ title: err.message || '加载失败', icon: 'none' })
  })
}

function goBack() {
  uni.navigateBack()
}

function handleFavorite() {
  if (!isMember.value) {
    uni.showToast({ title: '请先开通会员', icon: 'none' })
    return
  }
  userApi.toggleFavorite({ audioId: audio.value.id }).then(() => {
    audio.value.favorited = !audio.value.favorited
    uni.showToast({ title: audio.value.favorited ? '已收藏' : '已取消收藏', icon: 'none' })
  }).catch(err => {
    uni.showToast({ title: err.message || '操作失败', icon: 'none' })
  })
}

function playVersion(ver) {
  if (!isMember.value) {
    uni.showToast({ title: '请先开通会员', icon: 'none' })
    return
  }
  uni.showToast({ title: `正在播放: ${ver.name}`, icon: 'none' })
}

function handleDownload(ver) {
  if (!isMember.value) {
    uni.showToast({ title: '请先开通会员后下载', icon: 'none' })
    return
  }
  uni.showToast({ title: '开始下载', icon: 'success' })
}
</script>

<style scoped>
.detail-page {
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

.detail-scroll {
  flex: 1;
}

/* Cover */
.cover-section {
  width: 100%;
}

.detail-cover {
  width: 100%;
  height: 480rpx;
  background: rgba(108, 92, 231, 0.25);
}

/* Info */
.info-section {
  padding: 32rpx 28rpx;
}

.audio-name {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
  display: block;
  margin-bottom: 12rpx;
}

.breadcrumb {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 24rpx;
}

.breadcrumb-item {
  font-size: 24rpx;
  color: #888;
}

.breadcrumb-sep {
  color: #555;
  margin: 0 6rpx;
}

.desc-card {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.desc-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #ccc;
  display: block;
  margin-bottom: 12rpx;
}

.desc-text {
  font-size: 26rpx;
  color: #999;
  line-height: 1.8;
}

.tags-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-bottom: 28rpx;
}

.tags-label {
  font-size: 24rpx;
  color: #888;
}

.detail-tag {
  font-size: 22rpx;
  color: #6c5ce7;
  background: rgba(108, 92, 231, 0.15);
  padding: 6rpx 16rpx;
  border-radius: 16rpx;
}

/* Favorite Button */
.favorite-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  height: 80rpx;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 40rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.1);
}

.favorite-icon {
  font-size: 36rpx;
  color: #888;
}

.favorite-text {
  font-size: 28rpx;
  color: #aaa;
}

.favorite-btn.favorited {
  border-color: rgba(231, 76, 60, 0.4);
  background: rgba(231, 76, 60, 0.1);
}

.favorite-btn.favorited .favorite-icon {
  color: #e74c3c;
}

.favorite-btn.favorited .favorite-text {
  color: #e74c3c;
}

/* Version Section */
.version-section {
  padding: 0 28rpx 60rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
  display: block;
  margin-bottom: 20rpx;
}

.version-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.version-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12rpx;
  padding: 24rpx;
}

.version-info {
  flex: 1;
}

.version-name {
  font-size: 28rpx;
  font-weight: bold;
  color: #fff;
  display: block;
  margin-bottom: 6rpx;
}

.version-meta {
  display: flex;
  gap: 24rpx;
}

.version-duration {
  font-size: 22rpx;
  color: #888;
}

.version-size {
  font-size: 22rpx;
  color: #666;
}

.version-actions {
  display: flex;
  gap: 16rpx;
}

.ver-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
}

.play-btn {
  background: rgba(108, 92, 231, 0.25);
}

.download-btn {
  background: rgba(0, 184, 148, 0.2);
}

.download-btn.disabled {
  opacity: 0.3;
}

.empty-versions {
  text-align: center;
  padding: 40rpx 0;
}

.empty-text {
  font-size: 24rpx;
  color: #666;
}

/* Loading */
.loading-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-text {
  font-size: 28rpx;
  color: #666;
}
</style>
