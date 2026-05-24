// 订单管理
'use strict'
const { db } = require('../common/db')
const { verifyAdminToken } = require('../common/auth')
const { success, parsePagination } = require('../common/utils')

exports.main = async (event, context) => {
    await verifyAdminToken(event.adminToken)
    const { page, limit, skip } = parsePagination(event)
    let where = {}
    if (event.status) where.status = event.status
    if (event.user_id) where.user_id = event.user_id

    const [res, count] = await Promise.all([
        db.collection('orders').where(where)
            .orderBy('created_at', 'desc').skip(skip).limit(limit).get(),
        db.collection('orders').where(where).count()
    ])
    return success({ list: res.data, total: count.total, page, limit })
}
