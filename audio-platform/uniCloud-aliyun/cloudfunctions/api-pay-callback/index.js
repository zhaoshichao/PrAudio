// 支付回调 — 开通会员
'use strict'
const { db } = require('../common/db')
const { success } = require('../common/utils')

exports.main = async (event, context) => {
    // uniCloud 支付回调处理
    const { orderId, transactionId, status } = event
    if (status !== 'SUCCESS') return { code: -1, message: '支付失败' }

    const order = await db.collection('orders').doc(orderId).get()
    if (!order.data[0]) return { code: -1, message: '订单不存在' }

    const { user_id, type } = order.data[0]

    await db.collection('orders').doc(orderId).update({
        status: 'paid', transaction_id: transactionId, paid_at: new Date()
    })

    let memberExpireAt = null
    const now = new Date()
    if (type === 'monthly') {
        memberExpireAt = new Date(new Date().setMonth(now.getMonth() + 1))
    } else if (type === 'quarterly') {
        memberExpireAt = new Date(new Date().setMonth(now.getMonth() + 3))
    } else if (type === 'yearly') {
        memberExpireAt = new Date(new Date().setFullYear(now.getFullYear() + 1))
    }

    await db.collection('uni-id-users').doc(user_id).update({
        is_member: true, member_type: type, member_expire_at: memberExpireAt
    })

    return success(null, '开通成功')
}
