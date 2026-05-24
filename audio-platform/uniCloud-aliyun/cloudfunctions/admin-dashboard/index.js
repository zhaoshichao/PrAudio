// 仪表盘统计数据
'use strict'
const { db } = require('../common/db')
const { verifyAdminToken } = require('../common/auth')
const { success } = require('../common/utils')

exports.main = async (event, context) => {
    await verifyAdminToken(event.adminToken)

    const todayStart = new Date(new Date().setHours(0, 0, 0, 0))
    const [
        audioCount, categoryCount, userCount,
        todayOrders, recentOrders, recentAudios
    ] = await Promise.all([
        db.collection('audio_files').where({ status: 1 }).count(),
        db.collection('categories').count(),
        db.collection('uni-id-users').count(),
        db.collection('orders').where({ paid_at: db.command.gte(todayStart) }).count(),
        db.collection('orders').orderBy('created_at', 'desc').limit(10).get(),
        db.collection('audio_files').orderBy('created_at', 'desc').limit(10).get()
    ])

    return success({
        stats: {
            audioCount: audioCount.total,
            categoryCount: categoryCount.total,
            userCount: userCount.total,
            todayOrderCount: todayOrders.total
        },
        recentOrders: recentOrders.data,
        recentAudios: recentAudios.data
    })
}
