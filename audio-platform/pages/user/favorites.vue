<template>
  <view class="favorites-page">
    <!-- Header -->
    <view class="nav-bar">
      <view class="back-btn" @tap="goBack">
        <text class="back-arrow">‹</text>
      </view>
      <text class="nav-title">我的收藏</text>
    </view>

    <!-- List -->
    <scroll-view
      scroll-y
      class="fav-scroll"
      @scrolltolower="loadMore"
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
    >
      <view class="fav-grid" v-if="list.length > 0">
        <view
          class="fav-card"
          v-for="item in list"
          :key="item.id"
          @tap="goToDetail(item.audioId || item.id)"
          @longpress="showDeleteConfirm(item)"
        >
          <image class="card-cover" :src="item.cover" mode="aspectFill" />
          <view class="card-body">
            <text class="card-name" lines="1">{{ item.name }}</text>
            <text class="card-time">收藏于 {{ formatTime(item.favoritedAt || item.createTime) }}</text>
            <view class="card-footer">
              <view class="card-tags">
                <text class="card-tag" v-for="tag in (item.tags || [])" :key="tag">{{ tag }}</text>
              </view>
              <view class="unfav-btn" @tap.stop="handleUnfavorite(item)">
                <text class="unfav-icon" :class="{ confirm: item.showDelete }">🗑</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="load-more" v-if="hasMore && list.length > 0">
        <text class="load-text">加载更多...</text>
      </view>

      <view class="empty-state" v-if="!loading && list.length === 0">
        <text class="empty-icon">♡</text>
        <text class="empty-text">暂无收藏</text>
        <text class="empty-hint">去音频库发现喜欢的音乐吧</text>
      </view>
    </scroll-view>

    <!-- Delete Confirm Modal -->
    <view class="modal-overlay" v-if="deleteTarget" @tap="deleteTarget = null">
      <view class="modal-card" @tap.stop>
        <text class="modal-title">取消收藏</text>
        <text class="modal-content">确定要取消收藏「{{ deleteTarget.name }}」吗？</text>
        <view class="modal-actions">
          <view class="modal-btn cancel" @tap="deleteTarget = null">
            <text>取消</text>
          </view>
          <view class="modal-btn confirm" @tap="confirmDelete">
            <text>确定</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { userApi } from '@/utils/api.js'

const list = ref([])
const loading = ref(false)
const refreshing = ref(false)
const hasMore = ref(true)
const page = ref(1)
const pageSize = 20
const deleteTarget = ref(null)

onMounted(() => {
  loadList()
})

function loadList() {
  loading.value = true
  userApi.getFavorites({ page: page.value, pageSize }).then(res => {
    const data = (res.data?.list || []).map(item => ({
      ...item,
      showDelete: false,
    }))
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

function handleUnfavorite(item) {
  deleteTarget.value = item
}

function confirmDelete() {
  if (!deleteTarget.value) return
  userApi.removeFavorite({ id: deleteTarget.value.id }).then(() => {
    list.value = list.value.filter(i => i.id !== deleteTarget.value.id)
    uni.showToast({ title: '已取消收藏', icon: 'success' })
  }).catch(err => {
    uni.showToast({ title: err.message || '操作失败', icon: 'none' })
  }).finally(() => {
    deleteTarget.value = null
  })
}

function showDeleteConfirm(item) {
  deleteTarget.value = item
}

function goToDetail(id) {
  uni.navigateTo({ url: `/pages/audio/detail?id=${id}` })
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
  return `${y}-${m}-${day}`
}
</script>

<style scoped>
.favorites-page {
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

.fav-scroll {
  flex: 1;
}

.fav-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
  padding: 24rpx;
}

.fav-card {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12rpx;
  overflow: hidden;
}

.card-cover {
  width: 100%;
  height: 200rpx;
  background: rgba(108, 92, 231, 0.25);
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

.card-time {
  font-size: 20rpx;
  color: #666;
  display: block;
  margin-bottom: 10rpx;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-tags {
  display: flex;
  gap: 6rpx;
  flex-wrap: wrap;
}

.card-tag {
  font-size: 18rpx;
  color: #6c5ce7;
  background: rgba(108, 92, 231, 0.12);
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
}

.unfav-btn {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: rgba(231, 76, 60, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.unfav-icon {
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
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
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
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal-card {
  width: 540rpx;
  background: #1e1e36;
  border-radius: 20rpx;
  padding: 40rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.modal-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 16rpx;
}

.modal-content {
  font-size: 26rpx;
  color: #aaa;
  text-align: center;
  margin-bottom: 32rpx;
  line-height: 1.6;
}

.modal-actions {
  display: flex;
  gap: 24rpx;
  width: 100%;
}

.modal-btn {
  flex: 1;
  height: 76rpx;
  border-radius: 38rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
}

.modal-btn.cancel {
  background: rgba(255, 255, 255, 0.1);
  color: #aaa;
}

.modal-btn.confirm {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  color: #fff;
  font-weight: bold;
}
</style>
