// 公共模块 — 鉴权
'use strict'
const { db } = require('./db')

// 验证管理员 token
async function verifyAdminToken(token) {
    if (!token) throw { code: 401, message: '未登录' }
    const res = await db.collection('admin_users')
        .where({ token, status: 1 }).get()
    if (res.data.length === 0) throw { code: 401, message: 'token无效或已过期' }
    return res.data[0]
}

// 验证管理员角色
function requireRole(admin, ...roles) {
    if (!roles.includes(admin.role)) {
        throw { code: 403, message: '权限不足' }
    }
}

// 验证用户 token（通过 uni-id）
async function verifyUserToken(context) {
    const uniIdCommon = require('uni-id-common')
    const uniIdIns = uniIdCommon.createInstance({ context })
    const token = context.EVENT_TOKEN || (context.event && context.event.uniIdToken)
    const auth = await uniIdIns.checkToken(token)
    if (auth.errCode) throw { code: 401, message: auth.errMsg || 'token无效' }
    return auth
}

module.exports = { verifyAdminToken, requireRole, verifyUserToken }
