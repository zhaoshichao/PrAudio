<template>
  <view class="users-page">
    <AdminSidebar :visible="sidebarVisible" @close="sidebarVisible = false" />
    <!-- Top Bar -->
    <view class="top-bar">
      <view class="top-left">
        <text class="menu-btn" @click="sidebarVisible = true">☰</text>
        <text class="page-title">用户管理</text>
      </view>
    </view>

    <!-- Search Bar -->
    <view class="search-bar">
      <input class="search-input" v-model="keyword" placeholder="搜索手机号/昵称" placeholder-style="color:#aaa" @confirm="doSearch" />
      <button class="btn-search" @click="doSearch">搜索</button>
    </view>

    <!-- Table -->
    <view class="table-card">
      <view class="table-row table-head">
        <text class="table-cell col-mobile">手机号</text>
        <text class="table-cell col-nickname">昵称</text>
        <text class="table-cell col-member">会员</text>
        <text class="table-cell col-register">注册时间</text>
        <text class="table-cell col-action">操作</text>
      </view>
      <view class="table-row" v-for="user in userList" :key="user._id">
        <text class="table-cell col-mobile">{{ maskMobile(user.mobile) }}</text>
        <text class="table-cell col-nickname">{{ user.nickname || '-' }}</text>
        <text class="table-cell col-member">
          <text class="member-badge" :class="user.isMember ? 'is-member' : 'not-member'">
            {{ user.isMember ? (user.memberType || '会员') : '非会员' }}
          </text>
        </text>
        <text class="table-cell col-register">{{ formatDate(user.createdAt) }}</text>
        <text class="table-cell col-action">
          <text class="action-btn detail-btn" @click="openDetail(user)">详情</text>
        </text>
      </view>
      <view class="empty-row" v-if="userList.length === 0">
        <text class="empty-text">暂无用户数据</text>
      </view>
    </view>

    <!-- Pagination -->
    <view class="pagination" v-if="total > pageSize">
      <text class="page-btn" :class="{ disabled: page === 1 }" @click="changePage(page - 1)">上一页</text>
      <text class="page-info">{{ page }} / {{ Math.ceil(total / pageSize) }}</text>
      <text class="page-btn" :class="{ disabled: page * pageSize >= total }" @click="changePage(page + 1)">下一页</text>
    </view>

    <!-- User Detail Modal -->
    <view class="modal-mask" v-if="showDetail" @click="showDetail = false">
      <view class="modal-card modal-wide" @click.stop>
        <text class="modal-title">用户详情</text>
        <view class="detail-grid" v-if="detailUser">
          <view class="detail-section">
            <text class="detail-section-title">基本信息</text>
            <view class="detail-row"><text class="dl">手机号</text><text class="dv">{{ detailUser.mobile || '-' }}</text></view>
            <view class="detail-row"><text class="dl">昵称</text><text class="dv">{{ detailUser.nickname || '-' }}</text></view>
            <view class="detail-row"><text class="dl">头像</text><image v-if="detailUser.avatar" :src="detailUser.avatar" class="avatar-img" mode="aspectFill" /></view>
            <view class="detail-row"><text class="dl">会员</text><text class="dv">{{ detailUser.isMember ? (detailUser.memberType || '是') : '否' }}</text></view>
            <view class="detail-row" v-if="detailUser.memberExpire"><text class="dl">到期时间</text><text class="dv">{{ formatDate(detailUser.memberExpire) }}</text></view>
            <view class="detail-row"><text class="dl">注册时间</text><text class="dv">{{ formatDate(detailUser.createdAt) }}</text></view>
          </view>

          <!-- Referral Tree -->
          <view class="detail-section">
            <text class="detail-section-title">推荐关系</text>
            <view class="detail-row" v-if="detailUser.referrer">
              <text class="dl">推荐人</text>
              <text class="dv">{{ detailUser.referrer.nickname || detailUser.referrer.mobile || '-' }}</text>
            </view>
            <view class="detail-row" v-else>
              <text class="dl">推荐人</text>
              <text class="dv" style="color:#bbb;">无</text>
            </view>
            <view class="detail-row">
              <text class="dl">推荐用户</text>
              <text class="dv">{{ (detailUser.referrals || []).length }} 人</text>
            </view>
            <view class="referral-list" v-if="detailUser.referrals && detailUser.referrals.length">
              <view class="referral-item" v-for="ref in detailUser.referrals" :key="ref._id">
                <text>{{ ref.nickname || ref.mobile || '-' }}</text>
                <text class="ref-time">{{ formatDate(ref.createdAt) }}</text>
              </view>
            </view>
          </view>

          <!-- Favorites -->
          <view class="detail-section">
            <text class="detail-section-title">收藏</text>
            <text class="dv">{{ detailUser.favoriteCount || 0 }} 个音频</text>
          </view>

          <!-- Orders -->
          <view class="detail-section">
            <text class="detail-section-title">订单列表</text>
            <view class="mini-order" v-for="order in (detailUser.orders || [])" :key="order._id">
              <text class="mo-plan">{{ order.planName || order.planType }}</text>
              <text class="mo-amount">¥{{ order.amount }}</text>
              <text class="mo-status"> {{ order.status }}</text>
              <text class="mo-time">{{ formatDate(order.createdAt) }}</text>
            </view>
            <text class="dv" v-if="!detailUser.orders || detailUser.orders.length === 0" style="color:#bbb;">暂无订单</text>
          </view>
        </view>
        <view class="modal-footer">
          <button class="btn-cancel" @click="showDetail = false">关闭</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '@/utils/api.js'
import AdminSidebar from '@/components/AdminSidebar.vue'

const sidebarVisible = ref(false)

const userList = ref([])
const keyword = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const showDetail = ref(false)
const detailUser = ref(null)

const maskMobile = (mobile) => {
  if (!mobile) return '-'
  return mobile.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

const formatDate = (t) => {
  if (!t) return '-'
  const d = new Date(t)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const checkLogin = () => {
  if (!uni.getStorageSync('admin_token')) {
    uni.redirectTo({ url: '/pages-admin/login/login' })
    return false
  }
  return true
}

const loadUsers = async () => {
  try {
    const res = await adminApi.getUsers({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value
    })
    if (res.code === 0) {
      userList.value = res.data.list || []
      total.value = res.data.total || 0
    }
  } catch (err) {
    console.error('loadUsers error:', err)
  }
}

const doSearch = () => {
  page.value = 1
  loadUsers()
}

const changePage = (p) => {
  if (p < 1 || p * pageSize.value > total.value + pageSize.value) return
  page.value = p
  loadUsers()
}

const openDetail = async (user) => {
  showDetail.value = true
  detailUser.value = user
  // Load full detail
  try {
    const res = await adminApi.getUserDetail(user._id)
    if (res.code === 0) {
      detailUser.value = { ...user, ...res.data }
    }
  } catch (err) {
    console.error('getUserDetail error:', err)
  }
}

onMounted(() => {
  if (!checkLogin()) return
  loadUsers()
})
</script>

<style scoped>
.users-page {
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

/* Search */
.search-bar {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.search-input {
  flex: 1;
  height: 72rpx;
  background: #fff;
  border-radius: 10rpx;
  padding: 0 24rpx;
  font-size: 26rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
}

.btn-search {
  background: #6c5ce7;
  color: #fff;
  font-size: 26rpx;
  padding: 0 36rpx;
  border-radius: 10rpx;
  border: none;
  height: 72rpx;
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
  padding: 22rpx 0;
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

.table-cell { font-size: 26rpx; color: #333; }
.col-mobile { flex: 1.5; }
.col-nickname { flex: 1.5; }
.col-member { flex: 1; }
.col-register { flex: 1.5; }
.col-action { flex: 1; }

.member-badge {
  font-size: 22rpx;
  padding: 4rpx 14rpx;
  border-radius: 4rpx;
}

.is-member { background: #d4edda; color: #155724; }
.not-member { background: #f0f0f0; color: #888; }

.action-btn {
  font-size: 24rpx;
  padding: 6rpx 20rpx;
  border-radius: 4rpx;
}

.detail-btn { color: #6c5ce7; background: #f0edff; }

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

.page-btn.disabled { color: #ccc; border-color: #ddd; }
.page-info { font-size: 26rpx; color: #555; }

/* Modal */
.modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-card {
  width: 660rpx;
  max-height: 80vh;
  background: #fff;
  border-radius: 16rpx;
  padding: 40rpx;
  overflow-y: auto;
}

.modal-wide {
  width: 700rpx;
}

.modal-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #1a1a2e;
  display: block;
  margin-bottom: 24rpx;
}

.detail-grid {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.detail-section {
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.detail-section:last-child { border-bottom: none; }

.detail-section-title {
  font-size: 26rpx;
  font-weight: bold;
  color: #6c5ce7;
  margin-bottom: 14rpx;
  display: block;
}

.detail-row {
  display: flex;
  align-items: center;
  margin-bottom: 10rpx;
}

.dl {
  width: 140rpx;
  font-size: 24rpx;
  color: #999;
}

.dv {
  flex: 1;
  font-size: 24rpx;
  color: #333;
}

.avatar-img {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
}

.referral-list {
  margin-top: 10rpx;
}

.referral-item {
  display: flex;
  justify-content: space-between;
  padding: 10rpx 0;
  font-size: 24rpx;
  color: #555;
  border-bottom: 1rpx dotted #eee;
}

.ref-time { color: #aaa; font-size: 22rpx; }

.mini-order {
  display: flex;
  gap: 16rpx;
  padding: 12rpx 0;
  font-size: 22rpx;
  border-bottom: 1rpx dotted #eee;
}

.mo-plan { flex: 2; color: #333; }
.mo-amount { flex: 1; color: #d32f2f; }
.mo-status { flex: 1; color: #888; }
.mo-time { flex: 1.5; color: #aaa; }

.modal-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 28rpx;
}

.btn-cancel {
  background: #eee;
  color: #666;
  border: none;
  font-size: 26rpx;
  padding: 14rpx 36rpx;
  border-radius: 8rpx;
}
</style>
