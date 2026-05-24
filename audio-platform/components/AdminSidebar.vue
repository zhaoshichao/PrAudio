<template>
  <view class="sidebar-mask" :class="{ open: visible }" @click="$emit('close')">
    <view class="sidebar" @click.stop>
      <view class="sidebar-header">
        <text class="sidebar-title">管理后台</text>
        <text class="sidebar-close" @click="$emit('close')">✕</text>
      </view>

      <scroll-view scroll-y class="sidebar-menu">
        <view class="menu-group-title">主菜单</view>
        <view
          v-for="item in menuItems"
          :key="item.path"
          class="menu-item"
          :class="{ active: currentPath === item.path }"
          @click="navigate(item.path)"
        >
          <text class="menu-icon">{{ item.icon }}</text>
          <text class="menu-text">{{ item.label }}</text>
        </view>

        <view class="menu-group-title" style="margin-top: 24rpx;">账号</view>
        <view class="menu-item" @click="handleLogout">
          <text class="menu-icon">🚪</text>
          <text class="menu-text">退出登录</text>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: Boolean,
})

const emit = defineEmits(['close'])

const menuItems = [
  { icon: '📊', label: '仪表盘', path: '/pages-admin/dashboard/dashboard' },
  { icon: '📁', label: '分类管理', path: '/pages-admin/categories/categories' },
  { icon: '🏷️', label: '标签管理', path: '/pages-admin/tags/tags' },
  { icon: '⏱️', label: '版本管理', path: '/pages-admin/versions/versions' },
  { icon: '🎵', label: '音频管理', path: '/pages-admin/audio/list' },
  { icon: '👥', label: '用户管理', path: '/pages-admin/users/users' },
  { icon: '📦', label: '订单管理', path: '/pages-admin/orders/orders' },
  { icon: '🔑', label: '管理员', path: '/pages-admin/admins/admins' },
]

const currentPath = computed(() => {
  const pages = getCurrentPages()
  return pages.length > 0 ? '/' + pages[pages.length - 1].route : ''
})

function navigate(path) {
  emit('close')
  if (currentPath.value !== path) {
    uni.redirectTo({ url: path })
  }
}

function handleLogout() {
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        uni.removeStorageSync('admin_token')
        uni.removeStorageSync('admin_info')
        uni.redirectTo({ url: '/pages-admin/login/login' })
      }
    }
  })
}
</script>

<style scoped>
.sidebar-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0);
  pointer-events: none;
  z-index: 998;
  transition: background 0.3s;
}

.sidebar-mask.open {
  background: rgba(0,0,0,0.5);
  pointer-events: auto;
}

.sidebar {
  position: absolute;
  top: 0; left: 0; bottom: 0;
  width: 480rpx;
  background: #1a1a2e;
  transform: translateX(-100%);
  transition: transform 0.3s;
  display: flex;
  flex-direction: column;
}

.sidebar-mask.open .sidebar {
  transform: translateX(0);
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 48rpx 30rpx 30rpx;
  border-bottom: 1rpx solid rgba(255,255,255,0.08);
}

.sidebar-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #fff;
}

.sidebar-close {
  font-size: 36rpx;
  color: #888;
  padding: 8rpx 16rpx;
}

.sidebar-menu {
  flex: 1;
  padding: 16rpx 0;
}

.menu-group-title {
  font-size: 22rpx;
  color: #666;
  padding: 12rpx 30rpx;
  text-transform: uppercase;
  letter-spacing: 2rpx;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 22rpx 30rpx;
  gap: 16rpx;
  transition: background 0.2s;
}

.menu-item:active {
  background: rgba(108,92,231,0.1);
}

.menu-item.active {
  background: rgba(108,92,231,0.2);
  border-right: 4rpx solid #6c5ce7;
}

.menu-icon {
  font-size: 32rpx;
}

.menu-text {
  font-size: 28rpx;
  color: #ccc;
}

.menu-item.active .menu-text {
  color: #6c5ce7;
  font-weight: bold;
}
</style>
