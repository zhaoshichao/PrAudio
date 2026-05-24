// 版本管理 CRUD (camelCase)
'use strict'
const { db } = require('../common/db')
const { verifyAdminToken } = require('../common/auth')
const { success, fail } = require('../common/utils')

exports.main = async (event, context) => {
    await verifyAdminToken(event.adminToken)
    const { action, data } = event

    switch (action) {
        case 'list': {
            const res = await db.collection('versions').orderBy('sort', 'asc').get()
            return success(res.data)
        }
        case 'create': {
            if (!data || !data.name) return fail('名称不能为空')
            await db.collection('versions').add({
                name: data.name, sort: data.sort || 0, status: 1, createdAt: new Date()
            })
            return success(null, '创建成功')
        }
        case 'update': {
            if (!data || !data._id) return fail('缺少参数')
            await db.collection('versions').doc(data._id).update({ name: data.name, sort: data.sort })
            return success(null, '更新成功')
        }
        case 'delete': {
            if (!data || !data._id) return fail('缺少参数')
            const linked = await db.collection('audio_versions').where({ versionId: data._id }).count()
            if (linked.total > 0) return fail('该版本已被音频绑定，请先解除绑定')
            await db.collection('versions').doc(data._id).remove()
            return success(null, '已删除')
        }
        default: return fail('未知操作')
    }
}
