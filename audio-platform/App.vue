<script>
export default {
    onLaunch() {
        console.log('音频素材平台 App Launch')
        // Check login status
        const token = uni.getStorageSync('token')
        if (!token) {
            console.log('未登录')
        }
    },
    onShow() {
        console.log('App Show')
    },
    onHide() {
        console.log('App Hide')
    }
}
</script>

<style lang="scss">
/* 全局公共样式 */
@import '@/uni.scss';

page {
    background-color: #f5f5f5;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    font-size: 28rpx;
    color: #333;
}

/* 通用按钮 */
.btn-primary {
    background: linear-gradient(135deg, #6c5ce7, #a855f7);
    color: #fff;
    border: none;
    border-radius: 8rpx;
    padding: 20rpx 40rpx;
    font-size: 28rpx;
    font-weight: 500;
}

.btn-outline {
    background: transparent;
    color: #6c5ce7;
    border: 2rpx solid #6c5ce7;
    border-radius: 8rpx;
    padding: 20rpx 40rpx;
    font-size: 28rpx;
}

/* 卡片 */
.card {
    background: #fff;
    border-radius: 24rpx;
    padding: 24rpx;
    margin: 16rpx 24rpx;
    box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

/* 标签 */
.tag {
    display: inline-block;
    padding: 4rpx 16rpx;
    border-radius: 20rpx;
    font-size: 22rpx;
    color: #fff;
    margin-right: 8rpx;
    margin-bottom: 8rpx;
}

/* 状态标签 */
.status-tag {
    display: inline-block;
    padding: 6rpx 16rpx;
    border-radius: 20rpx;
    font-size: 22rpx;
}

.status-pending { background: #fff3e0; color: #ff9800; }
.status-paid { background: #e8f5e9; color: #4caf50; }
.status-refunded { background: #f5f5f5; color: #999; }
.status-expired { background: #f5f5f5; color: #999; }

/* 空状态 */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 120rpx 0;
    color: #999;
    font-size: 28rpx;
}

.empty-state .icon {
    font-size: 80rpx;
    margin-bottom: 24rpx;
}

/* 加载中 */
.loading-center {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 80rpx 0;
}
</style>
