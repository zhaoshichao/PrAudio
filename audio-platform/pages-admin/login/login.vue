<template>
  <view class="login-page">
    <view class="login-card">
      <view class="logo-section">
        <text class="logo-icon">🔐</text>
        <text class="logo-text">管理后台</text>
      </view>
      <view class="form-section">
        <view class="input-group">
          <text class="input-label">用户名</text>
          <input
            class="input-field"
            v-model="username"
            placeholder="请输入管理员用户名"
            placeholder-style="color: #888;"
          />
        </view>
        <view class="input-group">
          <text class="input-label">密码</text>
          <input
            class="input-field"
            v-model="password"
            type="password"
            placeholder="请输入密码"
            placeholder-style="color: #888;"
          />
        </view>
        <button class="login-btn" :loading="loading" @click="handleLogin">
          登 录
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { adminApi } from '@/utils/api.js'

const username = ref('')
const password = ref('')
const loading = ref(false)

const handleLogin = async () => {
  if (!username.value.trim()) {
    uni.showToast({ title: '请输入用户名', icon: 'none' })
    return
  }
  if (!password.value.trim()) {
    uni.showToast({ title: '请输入密码', icon: 'none' })
    return
  }
  loading.value = true
  try {
    const res = await adminApi.login({
      username: username.value.trim(),
      password: password.value.trim()
    })
    if (res.code === 0) {
      uni.setStorageSync('admin_token', res.data.token)
      uni.setStorageSync('admin_info', JSON.stringify(res.data.admin))
      uni.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        uni.redirectTo({ url: '/pages-admin/dashboard/dashboard' })
      }, 500)
    } else {
      uni.showToast({ title: res.msg || '登录失败', icon: 'none' })
    }
  } catch (err) {
    uni.showToast({ title: '网络错误，请重试', icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}

.login-card {
  width: 100%;
  max-width: 480rpx;
  background: #1e1e36;
  border-radius: 24rpx;
  padding: 60rpx 50rpx;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.5);
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 60rpx;
}

.logo-icon {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}

.logo-text {
  font-size: 40rpx;
  font-weight: bold;
  color: #ffffff;
  letter-spacing: 8rpx;
}

.form-section {
  display: flex;
  flex-direction: column;
}

.input-group {
  margin-bottom: 32rpx;
}

.input-label {
  display: block;
  font-size: 26rpx;
  color: #aaa;
  margin-bottom: 12rpx;
}

.input-field {
  width: 100%;
  height: 80rpx;
  background: #2a2a45;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #fff;
  border: 2rpx solid #333;
  box-sizing: border-box;
}

.input-field:focus {
  border-color: #6c5ce7;
}

.login-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #6c5ce7, #a29bfe);
  color: #fff;
  font-size: 30rpx;
  font-weight: bold;
  border-radius: 12rpx;
  border: none;
  margin-top: 20rpx;
  letter-spacing: 8rpx;
}

.login-btn:active {
  opacity: 0.85;
}
</style>
