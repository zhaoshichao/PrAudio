// 用户个人信息
'use strict'
const { db } = require('../common/db')
const { verifyUserToken } = require('../common/auth')
const { success } = require('../common/utils')

exports.main = async (event, context) => {
    const auth = await verifyUserToken(context)

    if (event.action === 'get') {
        const user = await db.collection('uni-id-users').doc(auth.uid)
            .field({ password: 0, token: 0 }).get()
        const [favCount, orderCount, referralCount] = await Promise.all([
            db.collection('favorites').where({ user_id: auth.uid }).count(),
            db.collection('orders').where({ user_id: auth.uid }).count(),
            db.collection('uni-id-users').where({ referrer_id: auth.uid }).count()
        ])
        return success({
            ...user.data[0],
            favCount: favCount.total,
            orderCount: orderCount.total,
            referralCount: referralCount.total
        })
    }

    if (event.action === 'update') {
        await db.collection('uni-id-users').doc(auth.uid).update({
            nickname: event.nickname, avatar: event.avatar
        })
        return success(null, '更新成功')
    }

    return { code: -1, message: '未知操作' }
}
