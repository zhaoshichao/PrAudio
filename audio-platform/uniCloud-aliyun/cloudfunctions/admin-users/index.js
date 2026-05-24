// 用户管理
'use strict'
const { db, cmd } = require('../common/db')
const { verifyAdminToken } = require('../common/auth')
const { success, parsePagination } = require('../common/utils')

exports.main = async (event, context) => {
    await verifyAdminToken(event.adminToken)
    const { action } = event

    switch (action) {
        case 'list': {
            const { page, limit, skip } = parsePagination(event)
            let where = {}
            if (event.keyword) {
                where = cmd.or([
                    { mobile: new RegExp(event.keyword) },
                    { nickname: new RegExp(event.keyword) }
                ])
            }
            const [res, count] = await Promise.all([
                db.collection('uni-id-users').where(where)
                    .field({ password: 0, token: 0 })
                    .orderBy('register_date', 'desc').skip(skip).limit(limit).get(),
                db.collection('uni-id-users').where(where).count()
            ])
            return success({ list: res.data, total: count.total, page, limit })
        }
        case 'detail': {
            if (!event.user_id) return { code: -1, message: '缺少user_id' }
            const user = await db.collection('uni-id-users').doc(event.user_id)
                .field({ password: 0, token: 0 }).get()
            if (!user.data[0]) return { code: -1, message: '用户不存在' }

            const [favorites, orders, referrals] = await Promise.all([
                db.collection('favorites').where({ user_id: event.user_id }).count(),
                db.collection('orders').where({ user_id: event.user_id }).get(),
                db.collection('uni-id-users')
                    .where({ referrer_id: event.user_id })
                    .field({ nickname: 1, mobile: 1, register_date: 1 }).get()
            ])
            return success({
                ...user.data[0],
                favoriteCount: favorites.total,
                orders: orders.data,
                referrals: referrals.data
            })
        }
        default: return { code: -1, message: '未知操作' }
    }
}
