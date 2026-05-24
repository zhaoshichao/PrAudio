<template>
  <view class="login-page">
    <view class="login-container">
      <!-- Logo / Header -->
      <view class="header-section">
        <text class="app-logo">🎵</text>
        <text class="app-title">音频素材平台</text>
        <text class="app-subtitle">专业配乐，一站管理</text>
      </view>

      <!-- Tab Switch -->
      <view class="tab-bar">
        <view
          class="tab-item"
          :class="{ active: currentTab === 'login' }"
          @tap="switchTab('login')"
        >
          <text>登录</text>
        </view>
        <view
          class="tab-item"
          :class="{ active: currentTab === 'register' }"
          @tap="switchTab('register')"
        >
          <text>注册</text>
        </view>
        <view class="tab-indicator" :class="currentTab"></view>
      </view>

      <!-- Form -->
      <view class="form-section">
        <!-- Phone Number -->
        <view class="input-group">
          <text class="input-label">手机号</text>
          <input
            class="input-field"
            type="number"
            v-model="phone"
            placeholder="请输入手机号"
            placeholder-style="color: #666"
            maxlength="11"
          />
        </view>

        <!-- SMS Code -->
        <view class="input-group">
          <text class="input-label">验证码</text>
          <view class="sms-row">
            <input
              class="input-field sms-input"
              type="number"
              v-model="smsCode"
              placeholder="请输入验证码"
              placeholder-style="color: #666"
              maxlength="6"
            />
            <view
              class="sms-btn"
              :class="{ disabled: countdown > 0 || !phoneValid }"
              @tap="sendSms"
            >
              <text v-if="countdown === 0">获取验证码</text>
              <text v-else>{{ countdown }}s</text>
            </view>
          </view>
        </view>

        <!-- Referral Code (Register only) -->
        <view class="input-group" v-if="currentTab === 'register'">
          <text class="input-label">推荐码（选填）</text>
          <input
            class="input-field"
            type="text"
            v-model="referralCode"
            placeholder="请输入推荐码"
            placeholder-style="color: #666"
          />
        </view>

        <!-- Submit Button -->
        <view class="submit-btn" @tap="handleSubmit">
          <text>{{ currentTab === 'login' ? '登录' : '注册' }}</text>
        </view>

        <!-- Agreement -->
        <view class="agreement" v-if="currentTab === 'register'">
          <text class="agreement-text">注册即表示同意</text>
          <text class="agreement-link">《用户协议》</text>
          <text class="agreement-text">和</text>
          <text class="agreement-link">《隐私政策》</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { userApi } from '@/utils/api.js'

const currentTab = ref('login')
const phone = ref('')
const smsCode = ref('')
const referralCode = ref('')
const countdown = ref(0)
let countdownTimer = null

const phoneValid = computed(() => {
  return /^1[3-9]\d{9}$/.test(phone.value)
})

function switchTab(tab) {
  currentTab.value = tab
  phone.value = ''
  smsCode.value = ''
  referralCode.value = ''
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  countdown.value = 0
}

function sendSms() {
  if (countdown.value > 0 || !phoneValid.value) return

  userApi.sendSms({ phone: phone.value }).then(() => {
    uni.showToast({ title: '验证码已发送', icon: 'success' })
    countdown.value = 60
    countdownTimer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(countdownTimer)
        countdownTimer = null
      }
    }, 1000)
  }).catch(err => {
    uni.showToast({ title: err.message || '发送失败', icon: 'none' })
  })
}

function handleSubmit() {
  if (!phoneValid.value) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return
  }
  if (!smsCode.value || smsCode.value.length < 4) {
    uni.showToast({ title: '请输入验证码', icon: 'none' })
    return
  }

  const api = currentTab.value === 'login' ? userApi.login : userApi.register
  const params = { phone: phone.value, smsCode: smsCode.value }
  if (currentTab.value === 'register' && referralCode.value) {
    params.referralCode = referralCode.value
  }

  api(params).then(res => {
    if (res.data && res.data.token) {
      uni.setStorageSync('token', res.data.token)
      uni.setStorageSync('userInfo', res.data.userInfo || {})
    }
    if (currentTab.value === 'register') {
      uni.showToast({ title: '注册成功', icon: 'success' })
      // Prompt to fill referral code on first login
      setTimeout(() => {
        uni.reLaunch({ url: '/pages/index/index' })
      }, 800)
    } else {
      uni.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        uni.reLaunch({ url: '/pages/index/index' })
      }, 800)
    }
  }).catch(err => {
    uni.showToast({ title: err.message || '操作失败', icon: 'none' })
  })
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: #1a1a2e;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}

.login-container {
  width: 100%;
  max-width: 640rpx;
  padding: 60rpx 40rpx;
}

.header-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 60rpx;
}

.app-logo {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}

.app-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #ffffff;
  margin-bottom: 8rpx;
}

.app-subtitle {
  font-size: 26rpx;
  color: #999;
}

.tab-bar {
  display: flex;
  position: relative;
  margin-bottom: 48rpx;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 16rpx;
  padding: 6rpx;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 18rpx 0;
  font-size: 30rpx;
  color: #888;
  border-radius: 12rpx;
  transition: all 0.3s;
  z-index: 1;
}

.tab-item.active {
  color: #fff;
  background: #6c5ce7;
  font-weight: bold;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.input-label {
  font-size: 26rpx;
  color: #aaa;
}

.input-field {
  width: 100%;
  height: 88rpx;
  background: rgba(255, 255, 255, 0.08);
  border: 2rpx solid rgba(255, 255, 255, 0.1);
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #fff;
  box-sizing: border-box;
}

.input-field:focus {
  border-color: #6c5ce7;
}

.sms-row {
  display: flex;
  gap: 20rpx;
}

.sms-input {
  flex: 1;
}

.sms-btn {
  width: 200rpx;
  height: 88rpx;
  background: linear-gradient(135deg, #6c5ce7, #a855f7);
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #fff;
  white-space: nowrap;
  flex-shrink: 0;
}

.sms-btn.disabled {
  background: rgba(255, 255, 255, 0.1);
  color: #666;
}

.submit-btn {
  width: 100%;
  height: 92rpx;
  background: linear-gradient(135deg, #6c5ce7, #a855f7);
  border-radius: 46rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 16rpx;
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
  letter-spacing: 4rpx;
}

.submit-btn:active {
  opacity: 0.8;
}

.agreement {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 4rpx;
}

.agreement-text {
  font-size: 22rpx;
  color: #888;
}

.agreement-link {
  font-size: 22rpx;
  color: #6c5ce7;
}
</style>
