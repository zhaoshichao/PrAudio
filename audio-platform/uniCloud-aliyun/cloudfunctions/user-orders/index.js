// 用户订单 + 支付创建
'use strict'
const { db } = require('../common/db')
const { verifyUserToken } = require('../common/auth')
const { success, fail } = require('../common/utils')

const PRICES = {
    permanent: 29900,
    monthly: 2900,
    quarterly: 7900,
    yearly: 19900
}

exports.main = async (event, context) => {
    const auth = await verifyUserToken(context)

    switch (event.action) {
        case 'create': {
            const { type } = event
            if (!PRICES[type]) return fail('无效的会员类型')
            const amount = PRICES[type]

            const orderRes = await db.collection('orders').add({
                user_id: auth.uid, type, amount, status: 'pending', created_at: new Date()
            })

            const paymentRes = await uniCloud.getPaymentInfo({
                provider: 'wxpay',
                orderId: orderRes.id,
                totalFee: amount,
                description: `音频素材会员 - ${type}`,
                openid: auth.userInfo && auth.userInfo.openid
            })

            return success({ orderId: orderRes.id, payment: paymentRes })
        }
        case 'status': {
            if (!event.orderId) return fail('缺少orderId')
            const order = await db.collection('orders').doc(event.orderId).get()
            if (!order.data[0]) return fail('订单不存在')
            return success(order.data[0])
        }
        case 'list': {
            const orders = await db.collection('orders')
                .where({ user_id: auth.uid }).orderBy('created_at', 'desc').get()
            return success(orders.data)
        }
        default: return fail('未知操作')
    }
}
