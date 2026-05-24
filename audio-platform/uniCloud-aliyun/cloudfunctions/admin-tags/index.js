// 标签管理 CRUD
'use strict'
const { db } = require('../common/db')
const { verifyAdminToken } = require('../common/auth')
const { success, fail } = require('../common/utils')

exports.main = async (event, context) => {
    await verifyAdminToken(event.adminToken)
    const { action, data } = event

    switch (action) {
        case 'list': {
            const res = await db.collection('tags').orderBy('created_at', 'desc').get()
            return success(res.data)
        }
        case 'create': {
            if (!data || !data.name) return fail('名称不能为空')
            await db.collection('tags').add({
                name: data.name,
                color: data.color || '#6c5ce7',
                created_at: new Date()
            })
            return success(null, '创建成功')
        }
        case 'update': {
            if (!data || !data._id) return fail('缺少参数')
            await db.collection('tags').doc(data._id).update({ name: data.name, color: data.color })
            return success(null, '更新成功')
        }
        case 'delete': {
            if (!data || !data._id) return fail('缺少参数')
            await db.collection('tags').doc(data._id).remove()
            return success(null, '已删除')
        }
        default:
            return fail('未知操作')
    }
}
