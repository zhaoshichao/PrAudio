<template>
  <view class="list-page">
    <!-- Top Search & Menu -->
    <view class="top-bar">
      <view class="back-btn" v-if="!showCategory" @tap="goBack">
        <text>←</text>
      </view>
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
      <!-- Sidebar Category Tree -->
      <view class="category-panel" :class="{ visible: showCategory }">
        <view class="category-overlay" @tap="showCategory = false"></view>
        <view class="category-tree">
          <view class="tree-header">
            <text class="tree-title">全部分类</text>
            <text class="tree-close" @tap="showCategory = false">✕</text>
          </view>
          <scroll-view scroll-y class="tree-scroll">
            <view class="tree-item" v-for="cat in categoryTree" :key="cat._id">
              <view class="tree-parent" @tap="goToLevel1(cat)">
                <text class="tree-arrow">{{ expandedIds.has(cat._id) ? '▼' : '▶' }}</text>
                <text class="tree-name">{{ cat.name }}</text>
                <text class="tree-count">{{ cat.count || 0 }}</text>
              </view>
              <view class="tree-children" v-if="expandedIds.has(cat._id) && cat.children && cat.children.length">
                <view
                  class="tree-child"
                  v-for="child in cat.children"
                  :key="child._id"
                  @tap="selectLevel2(cat, child)"
                >
                  <text class="tree-name" :class="{ active: activeLevel2Id === child._id }">{{ child.name }}</text>
                  <text class="tree-count">{{ child.count || 0 }}</text>
                </view>
              </view>
            </view>
          </scroll-view>
        </view>
      </view>

      <!-- Content Area -->
      <view class="content-panel">
        <!-- Level-1 Header -->
        <view class="level1-header" v-if="level1Cat">
          <text class="level1-name">{{ level1Cat.name }}</text>
          <text class="level1-count">{{ level1Cat.count || 0 }}首</text>
        </view>

        <!-- Level-2 Subcategory Tabs -->
        <scroll-view scroll-x class="l2-tabs-scroll" :show-scrollbar="false" v-if="level2Tabs.length > 0">
          <view class="l2-tabs">
            <view
              class="l2-tab"
              :class="{ active: activeLevel2Id === tab._id }"
              v-for="tab in level2Tabs"
              :key="tab._id"
              @tap="selectLevel2(level1Cat, tab)"
            >
              <text class="l2-tab-name">{{ tab.name }}</text>
              <text class="l2-tab-count">{{ tab.count || 0 }}</text>
            </view>
          </view>
        </scroll-view>
        <view class="l2-empty" v-else-if="level1Cat">
          <text>该分类下暂无子分类</text>
        </view>

        <!-- Audio List -->
        <scroll-view
          scroll-y
          class="audio-scroll"
          @scrolltolower="loadMore"
          :refresher-enabled="true"
          :refresher-triggered="refreshing"
          @refresherrefresh="onRefresh"
        >
          <view class="audio-list" v-if="audioList.length > 0">
            <view class="audio-item" v-for="item in audioList" :key="item.id">
              <view class="audio-header">
                <text class="audio-name">{{ item.name }}</text>
                <text class="audio-desc" v-if="item.description">{{ item.description }}</text>
              </view>
              <view class="version-list" v-if="item.versions && item.versions.length">
                <view
                  class="version-item"
                  v-for="ver in item.versions"
                  :key="ver._id"
                  @tap="playVersion(item, ver)"
                >
                  <view class="version-left">
                    <text class="version-play-icon">{{ playingKey === item.id + '_' + ver._id ? '⏸' : '▶️' }}</text>
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
            <text class="empty-text">{{ activeLevel2Id ? '该分类下暂无音频' : '请选择二级分类' }}</text>
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
const audioList = ref([])
const loading = ref(false)
const refreshing = ref(false)
const hasMore = ref(true)
const page = ref(1)
const pageSize = 20

const categoryTree = ref([])
const expandedIds = ref(new Set())

// Current selection state
const level1Cat = ref(null)        // current level-1 category
const level2Tabs = ref([])         // level-2 subcategories of current level-1
const activeLevel2Id = ref(null)   // selected level-2 _id

// Audio player
let audioCtx = null
const playingKey = ref('')

onMounted(() => {
  loadCategories().then(() => {
    // Read URL param
    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1]
    const options = currentPage?.$page?.options || currentPage?.options || {}
    if (options.categoryId) {
      resolveCategory(options.categoryId)
    }
  })
})

onUnmounted(() => {
  if (audioCtx) {
    audioCtx.destroy()
    audioCtx = null
  }
})

async function loadCategories() {
  try {
    const res = await publicApi.getCategoryTree()
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
  } catch (e) { /* ignore */ }
}

// Given a categoryId from URL, find whether it's level-1 or level-2
function resolveCategory(catId) {
  for (const cat of categoryTree.value) {
    if (cat._id === catId) {
      // It's level-1 — show its children, auto-select first if available
      goToLevel1(cat)
      return
    }
    if (cat.children) {
      for (const child of cat.children) {
        if (child._id === catId) {
          // It's level-2 — select parent as level-1, this as active
          goToLevel1(cat, child._id)
          return
        }
      }
    }
  }
  // If not found in tree, try loading by this ID directly (could be edge case)
  activeLevel2Id.value = catId
  loadList()
}

function goToLevel1(cat, autoSelectL2Id) {
  level1Cat.value = cat
  level2Tabs.value = cat.children || []
  showCategory.value = false

  if (autoSelectL2Id) {
    activeLevel2Id.value = autoSelectL2Id
  } else if (level2Tabs.value.length > 0) {
    activeLevel2Id.value = level2Tabs.value[0]._id
  } else {
    // No children — load audio directly for this level-1 (unlikely but defensive)
    activeLevel2Id.value = cat._id
  }
  page.value = 1
  loadList()
}

function selectLevel2(parentCat, childCat) {
  level1Cat.value = parentCat
  level2Tabs.value = parentCat.children || []
  activeLevel2Id.value = childCat._id
  showCategory.value = false
  page.value = 1
  loadList()
}

function goBack() {
  uni.navigateBack()
}

function onSearch() {
  page.value = 1
  loadList()
}

function loadList() {
  if (!activeLevel2Id.value) return
  loading.value = true
  const params = {
    page: page.value,
    pageSize,
    keyword: keyword.value,
    categoryId: activeLevel2Id.value,
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

function playVersion(item, ver) {
  const key = item.id + '_' + ver._id
  if (playingKey.value === key) {
    if (audioCtx) audioCtx.stop()
    playingKey.value = ''
    return
  }
  if (!ver.fileUrl) {
    uni.showToast({ title: '该版本无音频文件', icon: 'none' })
    return
  }
  if (audioCtx) audioCtx.destroy()
  audioCtx = uni.createInnerAudioContext()
  audioCtx.src = ver.fileUrl
  audioCtx.autoplay = true
  audioCtx.onPlay(() => { playingKey.value = key })
  audioCtx.onStop(() => { playingKey.value = '' })
  audioCtx.onEnded(() => { playingKey.value = '' })
  audioCtx.onError((err) => {
    console.error('audio play error:', err)
    playingKey.value = ''
    uni.showToast({ title: '播放失败', icon: 'none' })
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

.top-bar {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  gap: 16rpx;
}

.back-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  color: #fff;
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

.search-icon { font-size: 28rpx; margin-right: 12rpx; }

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

/* Sidebar Tree */
.category-panel {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 100;
  display: flex;
  pointer-events: none;
}
.category-panel.visible { pointer-events: auto; }
.category-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  opacity: 0;
  transition: opacity 0.3s;
}
.category-panel.visible .category-overlay { opacity: 1; }
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
.category-panel.visible .category-tree { transform: translateX(0); }
.tree-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32rpx 24rpx;
  border-bottom: 1rpx solid rgba(255,255,255,0.08);
}
.tree-title { font-size: 32rpx; font-weight: bold; color: #fff; }
.tree-close { font-size: 36rpx; color: #888; padding: 8rpx; }
.tree-scroll { flex: 1; padding: 16rpx 0; }
.tree-item { margin-bottom: 4rpx; }
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
.tree-arrow { font-size: 20rpx; color: #888; width: 28rpx; text-align: center; }
.tree-name { flex: 1; font-size: 26rpx; color: #ccc; }
.tree-name.active { color: #6c5ce7; font-weight: bold; }
.tree-count { font-size: 22rpx; color: #666; }

/* Content Panel */
.content-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Level-1 Header */
.level1-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 20rpx 24rpx 12rpx;
}
.level1-name {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
}
.level1-count {
  font-size: 24rpx;
  color: #888;
}

/* Level-2 Tabs */
.l2-tabs-scroll {
  white-space: nowrap;
  padding: 0 24rpx 16rpx;
}
.l2-tabs {
  display: inline-flex;
  gap: 16rpx;
}
.l2-tab {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  padding: 16rpx 28rpx;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12rpx;
  min-width: 120rpx;
  transition: background 0.2s;
}
.l2-tab.active {
  background: rgba(108, 92, 231, 0.25);
  border: 2rpx solid rgba(108, 92, 231, 0.5);
}
.l2-tab-name {
  font-size: 26rpx;
  color: #ccc;
  margin-bottom: 4rpx;
}
.l2-tab.active .l2-tab-name {
  color: #fff;
  font-weight: bold;
}
.l2-tab-count {
  font-size: 20rpx;
  color: #888;
}
.l2-empty {
  padding: 24rpx;
  text-align: center;
  font-size: 24rpx;
  color: #666;
}

/* Audio List */
.audio-scroll { flex: 1; }
.audio-list { padding: 0 24rpx 20rpx; }
.audio-item {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12rpx;
  margin-bottom: 20rpx;
  overflow: hidden;
}
.audio-header {
  padding: 20rpx 24rpx 12rpx;
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
}
.version-item:active { background: rgba(108, 92, 231, 0.15); }
.version-item:last-child { border-bottom: none; }
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
.version-size { font-size: 22rpx; color: #888; }
.version-dur { font-size: 22rpx; color: #6c5ce7; font-weight: bold; }
.no-version {
  padding: 24rpx;
  text-align: center;
  font-size: 24rpx;
  color: #666;
  border-top: 1rpx solid rgba(255, 255, 255, 0.06);
}

.load-more { text-align: center; padding: 24rpx; }
.load-text { font-size: 24rpx; color: #666; }
.empty-state { text-align: center; padding: 120rpx 0; }
.empty-text { font-size: 28rpx; color: #666; }
</style>
