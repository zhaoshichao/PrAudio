<template>
  <view class="member-page">
    <view class="page-title-row">
      <text class="page-title">选择适合你的方案</text>
    </view>

    <!-- Already a member -->
    <view class="current-member" v-if="userMemberInfo.isMember">
      <view class="member-badge">
        <text class="badge-icon">👑</text>
        <text class="badge-text">{{ memberTypeLabel }}</text>
      </view>
      <view class="expire-info" v-if="userMemberInfo.expireAt && userMemberInfo.type !== 'permanent'">
        <text class="expire-label">到期时间：</text>
        <text class="expire-value">{{ formatDate(userMemberInfo.expireAt) }}</text>
      </view>
      <view class="expire-info permanent-badge" v-if="userMemberInfo.type === 'permanent'">
        <text class="expire-value permanent-text">永久有效</text>
      </view>
      <view class="renew-btn" v-if="userMemberInfo.type !== 'permanent'" @tap="goToPlans">
        <text>续费</text>
      </view>
    </view>

    <!-- Plan Cards -->
    <view class="plans-container">
      <view
        class="plan-card"
        v-for="plan in plans"
        :key="plan.type"
        :class="{ popular: plan.popular }"
      >
        <view class="popular-badge" v-if="plan.popular">
          <text>最受欢迎</text>
        </view>
        <text class="plan-name">{{ plan.name }}</text>
        <view class="plan-line"></view>
        <view class="plan-price-block">
          <text class="plan-currency">¥</text>
          <text class="plan-price">{{ plan.price }}</text>
          <text class="plan-unit" v-if="plan.unit">{{ plan.unit }}</text>
        </view>
        <view class="plan-features">
          <view class="plan-feature" v-for="feat in plan.features" :key="feat">
            <text class="feature-icon">✓</text>
            <text class="feature-text">{{ feat }}</text>
          </view>
        </view>
        <view class="buy-btn" @tap="handleBuy(plan)">
          <text>立即购买</text>
        </view>
      </view>
    </view>

    <!-- Confirm Modal -->
    <view class="modal-overlay" v-if="showConfirm" @tap="showConfirm = false">
      <view class="modal-card" @tap.stop>
        <text class="modal-title">确认支付</text>
        <view class="modal-info">
          <text class="modal-plan">{{ selectedPlan?.name }}</text>
          <text class="modal-amount">¥{{ selectedPlan?.price }}</text>
        </view>
        <view class="modal-actions">
          <view class="modal-btn cancel" @tap="showConfirm = false">
            <text>取消</text>
          </view>
          <view class="modal-btn confirm" @tap="confirmPayment">
            <text>确认支付</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { userApi } from '@/utils/api.js'

const userMemberInfo = ref({
  isMember: false,
  type: '',
  expireAt: '',
})

const plans = ref([
  {
    type: 'monthly',
    name: '月付',
    price: '29',
    unit: '/月',
    popular: false,
    features: ['全曲库访问', '所有版本下载', '高品质音频', '专属客服'],
  },
  {
    type: 'quarterly',
    name: '季付',
    price: '79',
    unit: '/季',
    popular: false,
    features: ['全曲库访问', '所有版本下载', '高品质音频', '专属客服'],
  },
  {
    type: 'yearly',
    name: '年付',
    price: '199',
    unit: '/年',
    popular: true,
    features: ['全曲库访问', '所有版本下载', '高品质音频', '专属客服', '新曲抢先体验'],
  },
  {
    type: 'permanent',
    name: '永久',
    price: '299',
    unit: '',
    popular: false,
    features: ['永久无限访问', '所有版本下载', '高品质音频', '专属客服', '新曲抢先体验'],
  },
])

const showConfirm = ref(false)
const selectedPlan = ref(null)

const memberTypeLabel = computed(() => {
  const map = { monthly: '月度会员', quarterly: '季度会员', yearly: '年度会员', permanent: '永久会员' }
  return map[userMemberInfo.value.type] || '会员'
})

onMounted(() => {
  loadMemberInfo()
})

function loadMemberInfo() {
  const userInfo = uni.getStorageSync('userInfo')
  if (userInfo?.member) {
    userMemberInfo.value = userInfo.member
  }
  // Optionally refresh from server
  userApi.getMemberInfo().then(res => {
    if (res.data) {
      userMemberInfo.value = res.data
      const stored = uni.getStorageSync('userInfo') || {}
      stored.member = res.data
      uni.setStorageSync('userInfo', stored)
    }
  }).catch(() => {})
}

function handleBuy(plan) {
  selectedPlan.value = plan
  showConfirm.value = true
}

function confirmPayment() {
  if (!selectedPlan.value) return

  const plan = selectedPlan.value
  showConfirm.value = false

  userApi.createOrder({ planType: plan.type }).then(res => {
    const orderData = res.data
    // WeChat mini-program payment
    uni.requestPayment({
      timeStamp: orderData.timeStamp,
      nonceStr: orderData.nonceStr,
      package: orderData.package,
      signType: orderData.signType || 'MD5',
      paySign: orderData.paySign,
      success: () => {
        uni.showToast({ title: '支付成功', icon: 'success' })
        loadMemberInfo()
      },
      fail: (err) => {
        if (err.errMsg.includes('cancel')) {
          uni.showToast({ title: '已取消支付', icon: 'none' })
        } else {
          uni.showToast({ title: '支付失败', icon: 'none' })
        }
      },
    })
  }).catch(err => {
    uni.showToast({ title: err.message || '创建订单失败', icon: 'none' })
  })
}

function goToPlans() {
  // Scroll to plans
}

function formatDate(timestamp) {
  if (!timestamp) return '--'
  const d = new Date(timestamp)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
</script>

<style scoped>
.member-page {
  min-height: 100vh;
  background: #1a1a2e;
  padding: 40rpx 24rpx 80rpx;
}

.page-title-row {
  text-align: center;
  margin-bottom: 36rpx;
}

.page-title {
  font-size: 38rpx;
  font-weight: bold;
  color: #fff;
}

/* Current Member Status */
.current-member {
  background: rgba(255, 215, 0, 0.1);
  border: 2rpx solid rgba(255, 215, 0, 0.3);
  border-radius: 12rpx;
  padding: 28rpx;
  margin-bottom: 36rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}

.member-badge {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.badge-icon {
  font-size: 36rpx;
}

.badge-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #f0c040;
}

.expire-info {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.expire-label {
  font-size: 24rpx;
  color: #aaa;
}

.expire-value {
  font-size: 26rpx;
  color: #ccc;
}

.permanent-text {
  color: #f0c040;
  font-weight: bold;
  font-size: 28rpx;
}

.renew-btn {
  margin-top: 8rpx;
  padding: 12rpx 48rpx;
  background: linear-gradient(135deg, #f0c040, #e0a800);
  border-radius: 32rpx;
  font-size: 26rpx;
  color: #1a1a2e;
  font-weight: bold;
}

/* Plans Container */
.plans-container {
  display: flex;
  gap: 16rpx;
}

.plan-card {
  flex: 1;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12rpx;
  padding: 28rpx 14rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  overflow: hidden;
}

.plan-card.popular {
  background: rgba(108, 92, 231, 0.15);
  border: 2rpx solid rgba(108, 92, 231, 0.5);
}

.popular-badge {
  position: absolute;
  top: 0;
  right: 0;
  background: linear-gradient(135deg, #6c5ce7, #a855f7);
  padding: 6rpx 18rpx;
  border-bottom-left-radius: 12rpx;
}

.popular-badge text {
  font-size: 18rpx;
  color: #fff;
}

.plan-name {
  font-size: 28rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 16rpx;
}

.plan-line {
  width: 48rpx;
  height: 3rpx;
  background: rgba(108, 92, 231, 0.4);
  border-radius: 2rpx;
  margin-bottom: 16rpx;
}

.plan-price-block {
  display: flex;
  align-items: baseline;
  margin-bottom: 20rpx;
}

.plan-currency {
  font-size: 24rpx;
  color: #6c5ce7;
}

.plan-price {
  font-size: 44rpx;
  font-weight: bold;
  color: #fff;
}

.plan-unit {
  font-size: 18rpx;
  color: #888;
}

.plan-features {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  width: 100%;
  margin-bottom: 24rpx;
}

.plan-feature {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.feature-icon {
  font-size: 18rpx;
  color: #00b894;
  flex-shrink: 0;
}

.feature-text {
  font-size: 19rpx;
  color: #bbb;
  line-height: 1.3;
}

.buy-btn {
  width: 100%;
  height: 64rpx;
  background: linear-gradient(135deg, #6c5ce7, #a855f7);
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #fff;
  font-weight: bold;
}

.plan-card.popular .buy-btn {
  background: linear-gradient(135deg, #a855f7, #6c5ce7);
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
  width: 580rpx;
  background: #1e1e36;
  border-radius: 20rpx;
  padding: 48rpx 36rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.modal-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 28rpx;
}

.modal-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 40rpx;
}

.modal-plan {
  font-size: 28rpx;
  color: #aaa;
}

.modal-amount {
  font-size: 56rpx;
  font-weight: bold;
  color: #6c5ce7;
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
  background: linear-gradient(135deg, #6c5ce7, #a855f7);
  color: #fff;
  font-weight: bold;
}
</style>
