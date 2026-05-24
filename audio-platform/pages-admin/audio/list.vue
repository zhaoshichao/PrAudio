<template>
  <view class="audio-list-page">
    <AdminSidebar :visible="sidebarVisible" @close="sidebarVisible = false" />
    <!-- Top Bar -->
    <view class="top-bar">
      <view class="top-left">
        <text class="menu-btn" @click="sidebarVisible = true">☰</text>
        <text class="page-title">音频管理</text>
      </view>
      <button class="btn-primary" @click="goAdd">+ 新增音频</button>
    </view>

    <!-- Filter Bar -->
    <view class="filter-bar">
      <view class="filter-item">
        <text class="filter-label">分类筛选</text>
        <picker mode="multiSelector" :range="categorySelectorRange" :value="categorySelectorValue" @change="onCategoryChange" @columnchange="onCategoryColumnChange">
          <view class="picker-box">
            <text :class="{ placeholder: !filterCategoryText }">
              {{ filterCategoryText || '全部分类' }}
            </text>
          </view>
        </picker>
      </view>
      <view class="filter-item">
        <text class="filter-label">标签筛选</text>
        <view class="tag-selector">
          <view
            v-for="tag in allTags"
            :key="tag._id"
            class="tag-chip"
            :class="{ selected: selectedTagIds.includes(tag._id) }"
            @click="toggleTag(tag._id)"
          >
            {{ tag.name }}
          </view>
        </view>
      </view>
      <view class="filter-item filter-search">
        <text class="filter-label">关键词</text>
        <input class="search-input" v-model="keyword" placeholder="搜索音频名称" placeholder-style="color:#bbb" @confirm="doSearch" />
        <button class="btn-search" @click="doSearch">搜索</button>
      </view>
    </view>

    <!-- Table -->
    <view class="table-card">
      <view class="table-row table-head">
        <text class="table-cell col-thumb">封面</text>
        <text class="table-cell col-name">名称</text>
        <text class="table-cell col-cat">分类路径</text>
        <text class="table-cell col-tags">标签</text>
        <text class="table-cell col-versions">版本数</text>
        <text class="table-cell col-status">状态</text>
        <text class="table-cell col-action">操作</text>
      </view>
      <view class="table-row" v-for="audio in audioList" :key="audio._id" @click="goEdit(audio._id)">
        <text class="table-cell col-thumb">
          <image v-if="audio.cover" :src="audio.cover" class="thumb-img" mode="aspectFill" />
          <view v-else class="thumb-placeholder">🎵</view>
        </text>
        <text class="table-cell col-name">{{ audio.name }}</text>
        <text class="table-cell col-cat">{{ audio.categoryPath || '-' }}</text>
        <text class="table-cell col-tags">
          <text v-for="tag in (audio.tags || [])" :key="tag._id" class="mini-tag">{{ tag.name }}</text>
        </text>
        <text class="table-cell col-versions">{{ (audio.versions || []).length }}</text>
        <text class="table-cell col-status">
          <switch :checked="audio.status === 1" @change="toggleStatus(audio, $event)" color="#6c5ce7" />
          <text class="status-text">{{ audio.status === 1 ? '启用' : '禁用' }}</text>
        </text>
        <text class="table-cell col-action" @click.stop>
          <text class="action-btn edit-btn" @click="goEdit(audio._id)">编辑</text>
          <text class="action-btn delete-btn" @click="handleDelete(audio)">删除</text>
        </text>
      </view>
      <view class="empty-row" v-if="audioList.length === 0">
        <text class="empty-text">暂无音频数据</text>
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

const audioList = ref([])
const allTags = ref([])
const selectedTagIds = ref([])
const keyword = ref('')
const filterCategoryText = ref('')
const filterCategoryId = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

// Cascading category picker
const categoryFlatList = ref([])
const categorySelectorRange = ref([[], [], []])
const categorySelectorValue = ref([0, 0, 0])

const checkLogin = () => {
  if (!uni.getStorageSync('admin_token')) {
    uni.redirectTo({ url: '/pages-admin/login/login' })
    return false
  }
  return true
}

const loadCategories = async () => {
  try {
    const res = await adminApi.getCategories()
    if (res.code === 0) {
      const raw = res.data || []
      categoryFlatList.value = raw
      categorySelectorRange.value[0] = raw.filter(c => c.level === 1).map(c => c.name)
    }
  } catch (err) { /* ignore */ }
}

const onCategoryColumnChange = (e) => {
  const { column, value } = e.detail
  if (column === 0) {
    const l1 = categoryFlatList.value.filter(c => c.level === 1)
    const sel = l1[value]
    const l2 = categoryFlatList.value.filter(c => c.parentId === (sel ? sel._id : ''))
    categorySelectorRange.value[1] = l2.map(c => c.name)
    categorySelectorRange.value[2] = []
    categorySelectorValue.value[1] = 0
    categorySelectorValue.value[2] = 0
  } else if (column === 1) {
    const l1 = categoryFlatList.value.filter(c => c.level === 1)
    const sel1 = l1[categorySelectorValue.value[0]]
    const l2 = categoryFlatList.value.filter(c => c.parentId === (sel1 ? sel1._id : ''))
    const sel2 = l2[value]
    const l3 = categoryFlatList.value.filter(c => c.parentId === (sel2 ? sel2._id : ''))
    categorySelectorRange.value[2] = l3.map(c => c.name)
    categorySelectorValue.value[2] = 0
  }
}

const onCategoryChange = (e) => {
  const vals = e.detail.value
  categorySelectorValue.value = vals
  const l1 = categoryFlatList.value.filter(c => c.level === 1)
  const l2 = categoryFlatList.value.filter(c => c.parentId === (l1[vals[0]] ? l1[vals[0]]._id : ''))
  const l3 = categoryFlatList.value.filter(c => c.parentId === (l2[vals[1]] ? l2[vals[1]]._id : ''))
  const names = []
  if (l1[vals[0]]) names.push(l1[vals[0]].name)
  if (l2[vals[1]]) names.push(l2[vals[1]].name)
  if (l3[vals[2]]) names.push(l3[vals[2]].name)
  filterCategoryText.value = names.join(' > ')
  filterCategoryId.value = (l3[vals[2]] || l2[vals[1]] || l1[vals[0]] || {})._id || ''
  page.value = 1
  loadAudio()
}

const loadTags = async () => {
  try {
    const res = await adminApi.getTags()
    if (res.code === 0) {
      allTags.value = res.data || []
    }
  } catch (err) { /* ignore */ }
}

const toggleTag = (tagId) => {
  const idx = selectedTagIds.value.indexOf(tagId)
  if (idx > -1) {
    selectedTagIds.value.splice(idx, 1)
  } else {
    selectedTagIds.value.push(tagId)
  }
  page.value = 1
  loadAudio()
}

const doSearch = () => {
  page.value = 1
  loadAudio()
}

const loadAudio = async () => {
  try {
    const res = await adminApi.getAudioList({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value,
      categoryId: filterCategoryId.value,
      tagIds: selectedTagIds.value
    })
    if (res.code === 0) {
      audioList.value = res.data.list || []
      total.value = res.data.total || 0
    }
  } catch (err) {
    console.error('loadAudio error:', err)
  }
}

const goAdd = () => {
  uni.navigateTo({ url: '/pages-admin/audio/edit' })
}

const goEdit = (id) => {
  uni.navigateTo({ url: `/pages-admin/audio/edit?id=${id}` })
}

const toggleStatus = async (audio, e) => {
  const newStatus = e.detail.value ? 1 : 0
  try {
    const res = await adminApi.updateAudioStatus(audio._id, { status: newStatus })
    if (res.code === 0) {
      audio.status = newStatus
      uni.showToast({ title: newStatus === 1 ? '已启用' : '已禁用', icon: 'success' })
    } else {
      uni.showToast({ title: res.msg || '操作失败', icon: 'none' })
    }
  } catch (err) {
    uni.showToast({ title: '网络错误', icon: 'none' })
  }
}

const handleDelete = (audio) => {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除音频 "${audio.name}" 吗？此操作将禁用该音频。`,
    success: async (res) => {
      if (res.confirm) {
        try {
          const result = await adminApi.updateAudioStatus(audio._id, { status: 0 })
          if (result.code === 0) {
            audio.status = 0
            uni.showToast({ title: '已删除', icon: 'success' })
          } else {
            uni.showToast({ title: result.msg || '操作失败', icon: 'none' })
          }
        } catch (err) {
          uni.showToast({ title: '网络错误', icon: 'none' })
        }
      }
    }
  })
}

const changePage = (p) => {
  if (p < 1 || p * pageSize.value > total.value + pageSize.value) return
  page.value = p
  loadAudio()
}

onMounted(() => {
  if (!checkLogin()) return
  loadCategories()
  loadTags()
  loadAudio()
})
</script>

<style scoped>
.audio-list-page {
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

.btn-primary {
  background: #6c5ce7;
  color: #fff;
  font-size: 26rpx;
  padding: 14rpx 32rpx;
  border-radius: 8rpx;
  border: none;
}

/* Filter Bar */
.filter-bar {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx 30rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.filter-label {
  font-size: 26rpx;
  color: #555;
  white-space: nowrap;
}

.picker-box {
  min-width: 260rpx;
  height: 60rpx;
  border: 2rpx solid #ddd;
  border-radius: 8rpx;
  padding: 0 20rpx;
  display: flex;
  align-items: center;
  font-size: 24rpx;
  color: #333;
}

.picker-box .placeholder { color: #bbb; }

.tag-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.tag-chip {
  font-size: 22rpx;
  padding: 6rpx 20rpx;
  border-radius: 20rpx;
  border: 2rpx solid #ddd;
  color: #666;
  cursor: pointer;
}

.tag-chip.selected {
  background: #6c5ce7;
  color: #fff;
  border-color: #6c5ce7;
}

.filter-search {
  flex: 1;
  min-width: 300rpx;
}

.search-input {
  flex: 1;
  height: 60rpx;
  border: 2rpx solid #ddd;
  border-radius: 8rpx;
  padding: 0 20rpx;
  font-size: 24rpx;
}

.btn-search {
  background: #6c5ce7;
  color: #fff;
  font-size: 24rpx;
  padding: 10rpx 24rpx;
  border-radius: 8rpx;
  border: none;
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
  padding: 18rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.table-row:last-child { border-bottom: none; }

.table-head {
  background: #f9f9fb;
  margin: 0 -30rpx;
  padding: 16rpx 30rpx;
  border-radius: 8rpx;
}

.table-head .table-cell {
  font-weight: bold;
  color: #555;
  font-size: 24rpx;
}

.table-cell { font-size: 24rpx; color: #333; }

.col-thumb { width: 80rpx; }
.col-name { flex: 1.5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.col-cat { flex: 1.5; }
.col-tags { flex: 1.2; }
.col-versions { width: 90rpx; text-align: center; }
.col-status { width: 130rpx; display: flex; align-items: center; gap: 6rpx; }
.col-action { width: 150rpx; display: flex; gap: 10rpx; }

.thumb-img {
  width: 56rpx;
  height: 56rpx;
  border-radius: 6rpx;
}

.thumb-placeholder {
  width: 56rpx;
  height: 56rpx;
  background: #f0edff;
  border-radius: 6rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
}

.mini-tag {
  font-size: 18rpx;
  background: #f0edff;
  color: #6c5ce7;
  padding: 2rpx 10rpx;
  border-radius: 4rpx;
  margin-right: 6rpx;
}

.status-text {
  font-size: 20rpx;
  color: #888;
}

.action-btn {
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  border-radius: 4rpx;
}

.edit-btn { color: #6c5ce7; background: #f0edff; }
.delete-btn { color: #d32f2f; background: #fff0f0; }

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

.page-btn.disabled {
  color: #ccc;
  border-color: #ddd;
}

.page-info {
  font-size: 26rpx;
  color: #555;
}
</style>
