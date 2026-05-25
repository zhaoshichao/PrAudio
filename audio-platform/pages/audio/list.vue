<template>
  <view class="list-page">
    <!-- Top Search & Filter Bar -->
    <view class="filter-bar">
      <view class="search-box">
        <text class="search-icon">🔍</text>
        <input
          class="search-input"
          v-model="keyword"
          placeholder="搜索音频名称、标签..."
          placeholder-style="color: #666"
          @confirm="onSearch"
        />
      </view>
      <!-- Category Toggle Button for Mobile -->
      <view class="category-toggle" @tap="showCategory = !showCategory">
        <text>☰</text>
      </view>
    </view>

    <!-- Tag Filter Chips -->
    <scroll-view scroll-x class="tag-scroll" :show-scrollbar="false">
      <view class="tag-chips">
        <view
          class="tag-chip"
          :class="{ active: activeTag === tag }"
          v-for="tag in filterTags"
          :key="tag"
          @tap="onTagFilter(tag)"
        >
          <text>{{ tag }}</text>
        </view>
      </view>
    </scroll-view>

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
            <view
              class="tree-item"
              v-for="cat in categoryTree"
              :key="cat._id"
            >
              <view class="tree-parent" @tap="toggleCategory(cat)">
                <text class="tree-arrow">{{ expandedIds.has(cat._id) ? '▼' : '▶' }}</text>
                <text class="tree-name">{{ cat.name }}</text>
                <text class="tree-count">{{ cat.count || 0 }}</text>
              </view>
              <view class="tree-children" v-if="expandedIds.has(cat._id) && cat.children">
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

      <!-- Audio Grid -->
      <view class="audio-grid-panel">
        <!-- Version Filter -->
        <view class="version-bar">
          <picker :range="versionOptions" range-key="label" @change="onVersionFilter">
            <view class="version-picker">
              <text>{{ versionOptions[selectedVersionIndex]?.label || '选择版本' }}</text>
              <text class="picker-arrow">▼</text>
            </view>
          </picker>
        </view>

        <scroll-view
          scroll-y
          class="audio-scroll"
          @scrolltolower="loadMore"
          :refresher-enabled="true"
          :refresher-triggered="refreshing"
          @refresherrefresh="onRefresh"
        >
          <view class="audio-grid">
            <view class="audio-card" v-for="item in audioList" :key="item.id" @tap="goToDetail(item.id)">
              <image class="card-cover" :src="item.cover" mode="aspectFill" />
              <view class="card-body">
                <text class="card-name" lines="1">{{ item.name }}</text>
                <text class="card-desc" lines="2">{{ item.description }}</text>
                <view class="card-tags">
                  <text class="card-tag" v-for="tag in item.tags" :key="tag" :style="{ background: getTagColor(tag) }">{{ tag }}</text>
                </view>
                <view class="card-footer">
                  <view class="version-select" @tap.stop>
                    <picker :range="item.versions" range-key="name" @change="e => onItemVersionChange(item, e)">
                      <text class="version-label">{{ item.selectedVersion || item.versions[0]?.name }}</text>
                      <text class="picker-arrow">▼</text>
                    </picker>
                  </view>
                  <view class="card-actions">
                    <view class="action-icon" @tap.stop="togglePlay(item)">
                      <text>{{ playingIds.has(item.id) ? '⏸' : '▶️' }}</text>
                    </view>
                    <view class="action-icon" @tap.stop="handleFavorite(item)">
                      <text :style="{ color: favoritedIds.has(item.id) ? '#e74c3c' : '#888' }">♥</text>
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </view>
          <view class="load-more" v-if="hasMore">
            <text class="load-text">加载更多...</text>
          </view>
          <view class="empty-state" v-if="!loading && audioList.length === 0">
            <text class="empty-text">暂无音频素材</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { publicApi, userApi } from '@/utils/api.js'

const keyword = ref('')
const showCategory = ref(false)
const activeTag = ref('全部')
const activeCategoryId = ref(null)
const selectedVersionIndex = ref(0)
const audioList = ref([])
const loading = ref(false)
const refreshing = ref(false)
const hasMore = ref(true)
const page = ref(1)
const pageSize = 20

const filterTags = ref(['全部', '影视配乐', '广告音乐', '短视频', '游戏音效', '治愈系', '史诗级'])

const versionOptions = ref([
  { label: '全部版本', value: '' },
  { label: '30秒', value: '30s' },
  { label: '60秒', value: '60s' },
  { label: '90秒', value: '90s' },
])

const categoryTree = ref([])

const isMember = ref(false)

// expandedIds: Set of currently-expanded category node IDs
const expandedIds = ref(new Set())

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
  }).catch(() => {})
}

// playingIds: Set of currently-playing audio IDs
const playingIds = ref(new Set())
// favoritedIds: Set of favorited audio IDs
const favoritedIds = ref(new Set())

onMounted(() => {
  checkMember()
  loadCategories()
  loadList()
})

function checkMember() {
  const userInfo = uni.getStorageSync('userInfo')
  isMember.value = userInfo?.member?.isMember || false
}

function toggleCategory(cat) {
  const next = new Set(expandedIds.value)
  if (next.has(cat._id)) next.delete(cat._id)
  else next.add(cat._id)
  expandedIds.value = next
}

function selectCategory(cat) {
  activeCategoryId.value = cat._id
  showCategory.value = false
  page.value = 1
  loadList()
}

function onSearch() {
  page.value = 1
  loadList()
}

function onTagFilter(tag) {
  activeTag.value = tag === activeTag.value ? '全部' : tag
  page.value = 1
  loadList()
}

function onVersionFilter(e) {
  selectedVersionIndex.value = e.detail.value
  page.value = 1
  loadList()
}

function onItemVersionChange(item, e) {
  item.selectedVersion = item.versions[e.detail.value]?.name
}

function loadList() {
  loading.value = true
  const params = {
    page: page.value,
    pageSize,
    keyword: keyword.value,
    tag: activeTag.value === '全部' ? '' : activeTag.value,
    version: versionOptions.value[selectedVersionIndex.value]?.value,
    categoryId: activeCategoryId.value,
  }
  publicApi.getAudioList(params).then(res => {
    const list = (res.data?.list || []).map(item => ({
      ...item,
      id: item._id,
      selectedVersion: item.versions?.[0]?.name || '30秒',
    }))
    // Sync favorited set from API data
    const favSet = new Set()
    list.forEach(item => {
      if (item.favorited) favSet.add(item.id)
    })
    favoritedIds.value = favSet
    // Reset playing state on fresh load
    if (page.value === 1) playingIds.value = new Set()
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

function handleFavorite(item) {
  if (!isMember.value) {
    uni.showToast({ title: '请先开通会员', icon: 'none' })
    return
  }
  userApi.toggleFavorite({ audioId: item.id }).then(() => {
    const next = new Set(favoritedIds.value)
    if (next.has(item.id)) next.delete(item.id)
    else next.add(item.id)
    favoritedIds.value = next
    uni.showToast({ title: next.has(item.id) ? '已收藏' : '已取消收藏', icon: 'none' })
  }).catch(err => {
    uni.showToast({ title: err.message || '操作失败', icon: 'none' })
  })
}

function togglePlay(item) {
  if (!isMember.value) {
    uni.showToast({ title: '请先开通会员', icon: 'none' })
    return
  }
  const next = new Set(playingIds.value)
  if (next.has(item.id)) next.delete(item.id)
  else next.add(item.id)
  playingIds.value = next
}

function goToDetail(id) {
  uni.navigateTo({ url: `/pages/audio/detail?id=${id}` })
}

function getTagColor(tag) {
  const colors = {
    '影视': 'rgba(108, 92, 231, 0.2)',
    '广告': 'rgba(0, 184, 148, 0.2)',
    '游戏': 'rgba(225, 112, 85, 0.2)',
    '短视频': 'rgba(9, 132, 227, 0.2)',
    '治愈': 'rgba(253, 203, 110, 0.2)',
  }
  for (const key in colors) {
    if (tag.includes(key)) return colors[key]
  }
  return 'rgba(108, 92, 231, 0.15)'
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

.tag-scroll {
  white-space: nowrap;
  padding: 0 24rpx;
}

.tag-chips {
  display: inline-flex;
  gap: 14rpx;
  padding-bottom: 8rpx;
}

.tag-chip {
  padding: 10rpx 24rpx;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 24rpx;
  font-size: 24rpx;
  color: #aaa;
  flex-shrink: 0;
}

.tag-chip.active {
  background: rgba(108, 92, 231, 0.3);
  color: #6c5ce7;
  font-weight: bold;
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

.tree-grandchild {
  display: flex;
  align-items: center;
  padding: 12rpx 24rpx 12rpx 80rpx;
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

.tree-leaf {
  font-size: 16rpx;
  color: #666;
}

/* Audio Grid */
.audio-grid-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.version-bar {
  padding: 12rpx 24rpx;
}

.version-picker {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  background: rgba(255, 255, 255, 0.08);
  padding: 10rpx 20rpx;
  border-radius: 20rpx;
  font-size: 24rpx;
  color: #aaa;
}

.picker-arrow {
  font-size: 18rpx;
}

.audio-scroll {
  flex: 1;
}

.audio-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
  padding: 0 24rpx 20rpx;
}

.audio-card {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12rpx;
  overflow: hidden;
}

.card-cover {
  width: 100%;
  height: 220rpx;
  background: rgba(108, 92, 231, 0.3);
}

.card-body {
  padding: 16rpx;
}

.card-name {
  font-size: 26rpx;
  font-weight: bold;
  color: #fff;
  display: block;
  margin-bottom: 6rpx;
}

.card-desc {
  font-size: 22rpx;
  color: #888;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  margin-bottom: 10rpx;
  line-height: 1.5;
}

.card-tags {
  display: flex;
  gap: 8rpx;
  flex-wrap: wrap;
  margin-bottom: 12rpx;
}

.card-tag {
  font-size: 18rpx;
  color: #aaa;
  padding: 4rpx 10rpx;
  border-radius: 6rpx;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.version-select {
  display: flex;
  align-items: center;
  gap: 4rpx;
  background: rgba(255, 255, 255, 0.08);
  padding: 6rpx 12rpx;
  border-radius: 8rpx;
}

.version-label {
  font-size: 20rpx;
  color: #aaa;
}

.card-actions {
  display: flex;
  gap: 12rpx;
}

.action-icon {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
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
