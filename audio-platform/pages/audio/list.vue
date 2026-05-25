<template>
  <view class="list-page">
    <!-- Top Search & Filter Bar -->
    <view class="filter-bar">
      <view class="search-box">
        <text class="search-icon">🔍</text>
        <input
          class="search-input"
          v-model="keyword"
          placeholder="搜索音频名称..."
          placeholder-style="color: #666"
          @confirm="onSearch"
        />
      </view>
      <view class="category-toggle" @tap="showCategory = !showCategory">
        <text>☰</text>
      </view>
    </view>

    <view class="main-content">
      <!-- Left Category Tree -->
      <view class="category-panel" :class="{ visible: showCategory }">
        <view class="category-overlay" @tap="showCategory = false"></view>
        <view class="category-tree">
          <view class="tree-header">
            <text class="tree-title">分类</text>
            <text class="tree-close" @tap="showCategory = false">✕</text>
          </view>
          <scroll-view scroll-y class="tree-scroll">
            <view class="tree-item" v-for="cat in categoryTree" :key="cat._id">
              <view class="tree-parent" @tap="toggleCategory(cat)">
                <text class="tree-arrow">{{ expandedIds.has(cat._id) ? '▼' : '▶' }}</text>
                <text class="tree-name">{{ cat.name }}</text>
                <text class="tree-count">{{ cat.count || 0 }}</text>
              </view>
              <view class="tree-children" v-if="expandedIds.has(cat._id) && cat.children && cat.children.length">
                <view
                  class="tree-child"
                  v-for="child in cat.children"
                  :key="child._id"
                  @tap="selectCategory(child)"
                >
                  <text class="tree-name" :class="{ active: activeCategoryId === child._id }">{{ child.name }}</text>
                  <text class="tree-count">{{ child.count || 0 }}</text>
                </view>
              </view>
            </view>
          </scroll-view>
        </view>
      </view>

      <!-- Audio List -->
      <view class="audio-list-panel">
        <!-- Current Category Indicator -->
        <view class="current-category" v-if="currentCategoryName">
          <text class="category-label">当前分类：{{ currentCategoryName }}</text>
          <text class="category-clear" v-if="activeCategoryId" @tap="clearCategory">清除</text>
        </view>

        <scroll-view
          scroll-y
          class="audio-scroll"
          @scrolltolower="loadMore"
          :refresher-enabled="true"
          :refresher-triggered="refreshing"
          @refresherrefresh="onRefresh"
        >
          <view class="audio-list">
            <view class="audio-item" v-for="item in audioList" :key="item.id">
              <view class="audio-header">
                <view class="audio-info">
                  <text class="audio-name">{{ item.name }}</text>
                  <text class="audio-desc" v-if="item.description">{{ item.description }}</text>
                </view>
                <view class="audio-meta">
                  <text class="audio-duration" v-if="item.versions && item.versions.length">{{ item.versions.length }}个版本</text>
                </view>
              </view>
              <!-- Version file list -->
              <view class="version-list" v-if="item.versions && item.versions.length">
                <view
                  class="version-item"
                  v-for="ver in item.versions"
                  :key="ver._id"
                  @tap="playVersion(item, ver)"
                >
                  <view class="version-left">
                    <text class="version-play-icon">{{ playingVerKey(item, ver) ? '⏸' : '▶️' }}</text>
                    <view class="version-detail">
                      <text class="version-name">{{ ver.versionName || ver.fileName || '音频文件' }}</text>
                      <text class="version-file" v-if="ver.fileName">{{ ver.fileName }}</text>
                    </view>
                  </view>
                  <view class="version-right">
                    <text class="version-size" v-if="ver.fileSize">{{ formatSize(ver.fileSize) }}</text>
                    <text class="version-dur" v-if="ver.duration">{{ formatDuration(ver.duration) }}</text>
                  </view>
                </view>
              </view>
              <view class="no-version" v-else>
                <text>暂无版本文件</text>
              </view>
            </view>
          </view>
          <view class="load-more" v-if="hasMore && audioList.length > 0">
            <text class="load-text">加载更多...</text>
          </view>
          <view class="empty-state" v-if="!loading && audioList.length === 0">
            <text class="empty-text">该分类下暂无音频</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { publicApi } from '@/utils/api.js'

const keyword = ref('')
const showCategory = ref(false)
const activeCategoryId = ref(null)
const currentCategoryName = ref('')
const audioList = ref([])
const loading = ref(false)
const refreshing = ref(false)
const hasMore = ref(true)
const page = ref(1)
const pageSize = 20

const categoryTree = ref([])
const expandedIds = ref(new Set())

// Audio player
let audioCtx = null
const playingKey = ref('') // "audioId_versionId"

onMounted(() => {
  loadCategories()
  // Read URL params on page load
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const options = currentPage?.$page?.options || currentPage?.options || {}
  if (options.categoryId) {
    activeCategoryId.value = options.categoryId
  }
  loadList()
})

onUnmounted(() => {
  if (audioCtx) {
    audioCtx.destroy()
    audioCtx = null
  }
})

function loadCategories() {
  publicApi.getCategoryTree().then(res => {
    categoryTree.value = res.data || []
    const nextIds = new Set()
    function collect(nodes) {
      nodes.forEach(n => {
        nextIds.add(n._id)
        if (n.children && n.children.length) collect(n.children)
      })
    }
    collect(categoryTree.value)
    expandedIds.value = nextIds
    // Set current category name from URL param
    updateCurrentCategoryName()
  }).catch(() => {})
}

function updateCurrentCategoryName() {
  if (!activeCategoryId.value) return
  for (const cat of categoryTree.value) {
    if (cat._id === activeCategoryId.value) {
      currentCategoryName.value = cat.name
      return
    }
    if (cat.children) {
      for (const child of cat.children) {
        if (child._id === activeCategoryId.value) {
          currentCategoryName.value = child.name
          return
        }
      }
    }
  }
}

function toggleCategory(cat) {
  const next = new Set(expandedIds.value)
  if (next.has(cat._id)) next.delete(cat._id)
  else next.add(cat._id)
  expandedIds.value = next
}

function selectCategory(cat) {
  activeCategoryId.value = cat._id
  currentCategoryName.value = cat.name
  showCategory.value = false
  page.value = 1
  loadList()
}

function clearCategory() {
  activeCategoryId.value = null
  currentCategoryName.value = ''
  page.value = 1
  loadList()
}

function onSearch() {
  page.value = 1
  loadList()
}

function loadList() {
  loading.value = true
  const params = {
    page: page.value,
    pageSize,
    keyword: keyword.value,
    categoryId: activeCategoryId.value,
  }
  publicApi.getAudioList(params).then(res => {
    const list = (res.data?.list || []).map(item => ({
      ...item,
      id: item._id,
    }))
    if (page.value === 1) {
      audioList.value = list
    } else {
      audioList.value = [...audioList.value, ...list]
    }
    hasMore.value = list.length >= pageSize
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

function playingVerKey(item, ver) {
  return item.id + '_' + ver._id
}

function playVersion(item, ver) {
  const key = playingVerKey(item, ver)
  if (playingKey.value === key) {
    // Stop current
    if (audioCtx) audioCtx.stop()
    playingKey.value = ''
    return
  }
  // Play new
  if (!ver.fileUrl) {
    uni.showToast({ title: '该版本无音频文件', icon: 'none' })
    return
  }
  if (audioCtx) {
    audioCtx.destroy()
  }
  audioCtx = uni.createInnerAudioContext()
  audioCtx.src = ver.fileUrl
  audioCtx.autoplay = true
  audioCtx.onPlay(() => {
    playingKey.value = key
  })
  audioCtx.onStop(() => {
    playingKey.value = ''
  })
  audioCtx.onEnded(() => {
    playingKey.value = ''
  })
  audioCtx.onError((err) => {
    console.error('audio play error:', err)
    playingKey.value = ''
    uni.showToast({ title: '播放失败' + (err.errMsg ? ': ' + err.errMsg : ''), icon: 'none' })
  })
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
}

function formatDuration(seconds) {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return m + ':' + String(s).padStart(2, '0')
}
</script>

<style scoped>
.list-page {
  min-height: 100vh;
  background: #1a1a2e;
  display: flex;
  flex-direction: column;
}

.filter-bar {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  gap: 16rpx;
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 24rpx;
  padding: 0 24rpx;
  height: 68rpx;
}

.search-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  font-size: 26rpx;
  color: #fff;
  height: 100%;
}

.category-toggle {
  width: 68rpx;
  height: 68rpx;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: #fff;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Category Tree Panel */
.category-panel {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  pointer-events: none;
}

.category-panel.visible {
  pointer-events: auto;
}

.category-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0;
  transition: opacity 0.3s;
}

.category-panel.visible .category-overlay {
  opacity: 1;
}

.category-tree {
  position: relative;
  width: 460rpx;
  max-width: 80vw;
  background: #1e1e36;
  transform: translateX(-100%);
  transition: transform 0.3s;
  display: flex;
  flex-direction: column;
  z-index: 1;
}

.category-panel.visible .category-tree {
  transform: translateX(0);
}

.tree-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32rpx 24rpx;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.08);
}

.tree-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
}

.tree-close {
  font-size: 36rpx;
  color: #888;
  padding: 8rpx;
}

.tree-scroll {
  flex: 1;
  padding: 16rpx 0;
}

.tree-item {
  margin-bottom: 4rpx;
}

.tree-parent {
  display: flex;
  align-items: center;
  padding: 18rpx 24rpx;
  gap: 10rpx;
}

.tree-child {
  display: flex;
  align-items: center;
  padding: 14rpx 24rpx 14rpx 52rpx;
  gap: 10rpx;
}

.tree-arrow {
  font-size: 20rpx;
  color: #888;
  width: 28rpx;
  text-align: center;
}

.tree-name {
  flex: 1;
  font-size: 26rpx;
  color: #ccc;
}

.tree-name.active {
  color: #6c5ce7;
  font-weight: bold;
}

.tree-count {
  font-size: 22rpx;
  color: #666;
}

/* Audio List Panel */
.audio-list-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.current-category {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 24rpx;
  background: rgba(108, 92, 231, 0.1);
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
}

.category-label {
  font-size: 26rpx;
  color: #6c5ce7;
  font-weight: bold;
}

.category-clear {
  font-size: 24rpx;
  color: #888;
  padding: 4rpx 16rpx;
}

.audio-scroll {
  flex: 1;
}

.audio-list {
  padding: 16rpx 24rpx;
}

.audio-item {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12rpx;
  margin-bottom: 20rpx;
  overflow: hidden;
}

.audio-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20rpx 24rpx 12rpx;
}

.audio-info {
  flex: 1;
}

.audio-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #fff;
  display: block;
  margin-bottom: 6rpx;
}

.audio-desc {
  font-size: 24rpx;
  color: #888;
  display: block;
  line-height: 1.5;
}

.audio-meta {
  flex-shrink: 0;
  margin-left: 16rpx;
}

.audio-duration {
  font-size: 22rpx;
  color: #666;
  background: rgba(255, 255, 255, 0.06);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

/* Version List */
.version-list {
  border-top: 1rpx solid rgba(255, 255, 255, 0.06);
}

.version-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 24rpx;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.04);
  transition: background 0.15s;
}

.version-item:active {
  background: rgba(108, 92, 231, 0.15);
}

.version-item:last-child {
  border-bottom: none;
}

.version-left {
  display: flex;
  align-items: center;
  gap: 14rpx;
  flex: 1;
  overflow: hidden;
}

.version-play-icon {
  font-size: 32rpx;
  width: 44rpx;
  text-align: center;
}

.version-detail {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.version-name {
  font-size: 26rpx;
  color: #ddd;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version-file {
  font-size: 20rpx;
  color: #666;
  margin-top: 2rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version-right {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex-shrink: 0;
  margin-left: 16rpx;
}

.version-size {
  font-size: 22rpx;
  color: #888;
}

.version-dur {
  font-size: 22rpx;
  color: #6c5ce7;
  font-weight: bold;
}

.no-version {
  padding: 24rpx;
  text-align: center;
  font-size: 24rpx;
  color: #666;
  border-top: 1rpx solid rgba(255, 255, 255, 0.06);
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
  text-align: center;
  padding: 120rpx 0;
}

.empty-text {
  font-size: 28rpx;
  color: #666;
}
</style>
