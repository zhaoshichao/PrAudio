<template>
  <view class="home-page">
    <!-- Hero Section -->
    <view class="hero-section">
      <view class="hero-bg"></view>
      <view class="hero-content">
        <text class="hero-title">专业音频素材 · 一站式管理</text>
        <text class="hero-subtitle">为 Premiere Pro 创作者提供高品质配乐素材</text>
        <view class="hero-buttons">
          <view class="hero-btn primary" @tap="goToAudioList">
            <text>浏览音频库</text>
          </view>
          <view class="hero-btn secondary" @tap="goToMember">
            <text>成为会员</text>
          </view>
        </view>
      </view>
    </view>

    <!-- Category Grid -->
    <view class="section">
      <text class="section-title">音频分类</text>
      <view class="category-grid">
        <view
          class="category-card"
          v-for="cat in categories"
          :key="cat.id"
          :style="{ background: cat.bg }"
          @tap="goToCategory(cat.id)"
        >
          <text class="category-icon">{{ cat.icon }}</text>
          <text class="category-name">{{ cat.name }}</text>
          <text class="category-count">{{ cat.count }}首</text>
        </view>
      </view>
    </view>

    <!-- Hot Audio -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">热门推荐</text>
        <text class="section-more" @tap="goToAudioList">查看更多</text>
      </view>
      <scroll-view scroll-x class="hot-scroll" :show-scrollbar="false">
        <view class="hot-list">
          <view class="audio-card" v-for="item in hotAudioList" :key="item.id" @tap="goToDetail(item.id)">
            <image class="audio-cover" :src="item.cover" mode="aspectFill" />
            <view class="audio-info">
              <text class="audio-name" lines="1">{{ item.name }}</text>
              <view class="audio-tags">
                <text class="audio-tag" v-for="tag in item.tags" :key="tag">{{ tag }}</text>
              </view>
              <view class="audio-actions">
                <view class="version-select" @tap.stop>
                  <picker :range="item.versions" range-key="name" @change="e => onVersionChange(item, e)">
                    <text class="version-text">{{ item.selectedVersion || item.versions[0]?.name }}</text>
                  </picker>
                </view>
                <view class="action-btns">
                  <view class="icon-btn" @tap.stop="togglePlay(item)">
                    <text>{{ playingIds.has(item.id) ? '⏸' : '▶️' }}</text>
                  </view>
                  <view class="icon-btn" @tap.stop="toggleFavorite(item)">
                    <text :style="{ color: favoritedIds.has(item.id) ? '#e74c3c' : '#888' }">♥</text>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- Member Benefits -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">会员权益</text>
        <text class="section-more" @tap="goToMember">查看详情</text>
      </view>
      <view class="member-cards">
        <view class="member-card" v-for="plan in memberPlans" :key="plan.type">
          <text class="plan-name">{{ plan.name }}</text>
          <view class="plan-price">
            <text class="price-symbol">¥</text>
            <text class="price-value">{{ plan.price }}</text>
            <text class="price-unit" v-if="plan.unit">/{{ plan.unit }}</text>
          </view>
          <view class="plan-features">
            <view class="feature-item" v-for="feat in plan.features" :key="feat">
              <text class="feature-check">✓</text>
              <text class="feature-text">{{ feat }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- Bottom Tab Bar -->
    <view class="tab-bar">
      <view class="tab-item" :class="{ active: currentTab === 0 }" @tap="switchTab(0)">
        <text class="tab-icon">🏠</text>
        <text class="tab-text">首页</text>
      </view>
      <view class="tab-item" :class="{ active: currentTab === 1 }" @tap="switchTab(1)">
        <text class="tab-icon">🎵</text>
        <text class="tab-text">音频库</text>
      </view>
      <view class="tab-item" :class="{ active: currentTab === 2 }" @tap="switchTab(2)">
        <text class="tab-icon">👑</text>
        <text class="tab-text">会员</text>
      </view>
      <view class="tab-item" :class="{ active: currentTab === 3 }" @tap="switchTab(3)">
        <text class="tab-icon">👤</text>
        <text class="tab-text">我的</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { publicApi } from '@/utils/api.js'

const currentTab = ref(0)

const playingIds = ref(new Set())
const favoritedIds = ref(new Set())

const categories = ref([
  { id: 1, name: '怀旧音乐', icon: '📻', count: 128, bg: 'linear-gradient(135deg, #6c5ce7, #a29bfe)' },
  { id: 2, name: '现代流行', icon: '🎸', count: 256, bg: 'linear-gradient(135deg, #00b894, #55efc4)' },
  { id: 3, name: '史诗管弦', icon: '🎻', count: 96, bg: 'linear-gradient(135deg, #e17055, #fab1a0)' },
  { id: 4, name: '电子氛围', icon: '🎹', count: 180, bg: 'linear-gradient(135deg, #0984e3, #74b9ff)' },
])

const hotAudioList = ref([])

const memberPlans = ref([
  {
    type: 'free',
    name: '免费用户',
    price: '0',
    unit: '',
    features: ['每日试听 3 次', '有限曲库访问', '低品质试听'],
  },
  {
    type: 'monthly',
    name: '月度会员',
    price: '29',
    unit: '月',
    features: ['不限试听次数', '全曲库访问', '全版本下载', '高品质音频'],
  },
  {
    type: 'permanent',
    name: '永久会员',
    price: '299',
    unit: '',
    features: ['永久无限访问', '全曲库+版本下载', '新曲抢先体验', '专属客服支持'],
  },
])

onMounted(() => {
  loadHotAudio()
})

function loadHotAudio() {
  publicApi.getHotAudio().then(res => {
    hotAudioList.value = (res.data || []).map(item => ({
      ...item,
      selectedVersion: item.versions?.[0]?.name || '30秒',
    }))
    const favs = new Set()
    hotAudioList.value.forEach(item => {
      if (item.favorited) favs.add(item.id)
    })
    favoritedIds.value = favs
    playingIds.value = new Set()
  }).catch(() => {
    hotAudioList.value = [
      { id: 1, cover: '', name: '精彩配乐', tags: ['影视', '广告'], versions: [{ name: '30秒' }, { name: '60秒' }] },
      { id: 2, cover: '', name: '背景音乐', tags: ['轻音乐', '治愈'], versions: [{ name: '30秒' }, { name: '90秒' }] },
    ]
    playingIds.value = new Set()
    favoritedIds.value = new Set()
  })
}

function switchTab(index) {
  currentTab.value = index
  const routes = ['/pages/index/index', '/pages/audio/list', '/pages/member/index', '/pages/user/index']
  if (index !== 0) {
    uni.switchTab({ url: routes[index] })
  }
}

function goToAudioList() { uni.navigateTo({ url: '/pages/audio/list' }) }
function goToMember() { uni.navigateTo({ url: '/pages/member/index' }) }
function goToDetail(id) { uni.navigateTo({ url: `/pages/audio/detail?id=${id}` }) }
function goToCategory(id) { uni.navigateTo({ url: `/pages/audio/list?categoryId=${id}` }) }

function onVersionChange(item, e) {
  item.selectedVersion = item.versions[e.detail.value]?.name
}

function togglePlay(item) {
  const next = new Set(playingIds.value)
  if (next.has(item.id)) next.delete(item.id)
  else next.add(item.id)
  playingIds.value = next
}

function toggleFavorite(item) {
  const next = new Set(favoritedIds.value)
  if (next.has(item.id)) next.delete(item.id)
  else next.add(item.id)
  favoritedIds.value = next
  uni.showToast({ title: next.has(item.id) ? '已收藏' : '已取消收藏', icon: 'none' })
}
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  background: #1a1a2e;
  padding-bottom: 120rpx;
}

/* Hero Section */
.hero-section {
  position: relative;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 40%, #6c5ce7 100%);
}

.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 40rpx 80rpx;
}

.hero-title {
  font-size: 44rpx;
  font-weight: bold;
  color: #fff;
  text-align: center;
  margin-bottom: 16rpx;
}

.hero-subtitle {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  margin-bottom: 48rpx;
}

.hero-buttons {
  display: flex;
  gap: 24rpx;
}

.hero-btn {
  height: 80rpx;
  border-radius: 40rpx;
  padding: 0 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: bold;
}

.hero-btn.primary {
  background: linear-gradient(135deg, #6c5ce7, #a855f7);
  color: #fff;
}

.hero-btn.secondary {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: 2rpx solid rgba(255, 255, 255, 0.3);
}

/* Sections */
.section {
  padding: 32rpx 28rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.section-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #fff;
}

.section-more {
  font-size: 24rpx;
  color: #6c5ce7;
}

/* Category Grid */
.category-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}

.category-card {
  padding: 36rpx 28rpx;
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
}

.category-icon {
  font-size: 48rpx;
  margin-bottom: 12rpx;
}

.category-name {
  font-size: 28rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 4rpx;
}

.category-count {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.7);
}

/* Hot Scroll */
.hot-scroll {
  white-space: nowrap;
}

.hot-list {
  display: inline-flex;
  gap: 20rpx;
}

.audio-card {
  width: 320rpx;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12rpx;
  overflow: hidden;
  flex-shrink: 0;
}

.audio-cover {
  width: 100%;
  height: 200rpx;
  background: rgba(108, 92, 231, 0.3);
}

.audio-info {
  padding: 16rpx;
  white-space: normal;
}

.audio-name {
  font-size: 26rpx;
  font-weight: bold;
  color: #fff;
  display: block;
  margin-bottom: 8rpx;
}

.audio-tags {
  display: flex;
  gap: 8rpx;
  flex-wrap: wrap;
  margin-bottom: 12rpx;
}

.audio-tag {
  font-size: 18rpx;
  color: #6c5ce7;
  background: rgba(108, 92, 231, 0.15);
  padding: 4rpx 10rpx;
  border-radius: 6rpx;
}

.audio-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.version-select {
  background: rgba(255, 255, 255, 0.1);
  padding: 6rpx 14rpx;
  border-radius: 8rpx;
}

.version-text {
  font-size: 20rpx;
  color: #aaa;
}

.action-btns {
  display: flex;
  gap: 12rpx;
}

.icon-btn {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
}

/* Member Cards */
.member-cards {
  display: flex;
  gap: 16rpx;
}

.member-card {
  flex: 1;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12rpx;
  padding: 28rpx 18rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.plan-name {
  font-size: 24rpx;
  color: #aaa;
  margin-bottom: 12rpx;
}

.plan-price {
  display: flex;
  align-items: baseline;
  margin-bottom: 16rpx;
}

.price-symbol {
  font-size: 24rpx;
  color: #6c5ce7;
}

.price-value {
  font-size: 48rpx;
  font-weight: bold;
  color: #fff;
}

.price-unit {
  font-size: 20rpx;
  color: #888;
}

.plan-features {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  width: 100%;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.feature-check {
  font-size: 20rpx;
  color: #00b894;
}

.feature-text {
  font-size: 20rpx;
  color: #ccc;
}

/* Tab Bar */
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 110rpx;
  background: rgba(26, 26, 46, 0.95);
  backdrop-filter: blur(20px);
  display: flex;
  border-top: 1rpx solid rgba(255, 255, 255, 0.08);
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
}

.tab-icon {
  font-size: 36rpx;
}

.tab-text {
  font-size: 20rpx;
  color: #888;
}

.tab-item.active .tab-text {
  color: #6c5ce7;
  font-weight: bold;
}
</style>
