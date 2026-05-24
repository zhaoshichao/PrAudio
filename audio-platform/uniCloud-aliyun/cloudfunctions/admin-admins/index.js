// 管理员管理（仅 super_admin）
'use strict'
const { db } = require('../common/db')
const { verifyAdminToken, requireRole } = require('../common/auth')
const { success, fail } = require('../common/utils')
const bcrypt = require('bcryptjs')

exports.main = async (event, context) => {
    const admin = await verifyAdminToken(event.adminToken)
    requireRole(admin, 'super_admin')

    const { action, data } = event

    switch (action) {
        case 'list': {
            const res = await db.collection('admin_users')
                .field({ password_hash: 0, token: 0 })
                .orderBy('created_at', 'desc').get()
            return success(res.data)
        }
        case 'create': {
            if (!data || !data.username || !data.password) return fail('用户名和密码不能为空')
            const exist = await db.collection('admin_users').where({ username: data.username }).get()
            if (exist.data.length > 0) return fail('用户名已存在')
            const hash = bcrypt.hashSync(data.password, 10)
            await db.collection('admin_users').add({
                username: data.username,
                password_hash: hash,
                role: data.role || 'admin',
                nickname: data.nickname || data.username,
                avatar: '',
                status: 1,
                created_at: new Date()
            })
            return success(null, '创建成功')
        }
        case 'update': {
            if (!data || !data._id) return fail('缺少参数')
            const updateData = { nickname: data.nickname, role: data.role, status: data.status }
            if (data.password) updateData.password_hash = bcrypt.hashSync(data.password, 10)
            await db.collection('admin_users').doc(data._id).update(updateData)
            return success(null, '更新成功')
        }
        case 'delete': {
            if (!data || !data._id) return fail('缺少参数')
            await db.collection('admin_users').doc(data._id).update({ status: 0 })
            return success(null, '已禁用')
        }
        default:
            return fail('未知操作')
    }
}
