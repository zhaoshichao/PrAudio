// 管理员登录
'use strict'
const { db } = require('../common/db')
const crypto = require('crypto')

exports.main = async (event, context) => {
    const { username, password } = event
    if (!username || !password) return { code: -1, message: '用户名和密码不能为空' }

    // 使用 uni-cloud-client 提供的密码验证
    // 初始管理员密码在 db_init 中通过 bcrypt 哈希存储
    const res = await db.collection('admin_users')
        .where({ username, status: 1 }).get()
    if (res.data.length === 0) return { code: -1, message: '用户名或密码错误' }

    const admin = res.data[0]

    // 使用 bcryptjs 验证密码
    const bcrypt = require('bcryptjs')
    const valid = bcrypt.compareSync(password, admin.password_hash)
    if (!valid) return { code: -1, message: '用户名或密码错误' }

    // 生成 token
    const token = crypto.randomBytes(32).toString('hex')
    await db.collection('admin_users').doc(admin._id).update({
        token,
        last_login_at: new Date()
    })

    const { password_hash, ...safeAdmin } = admin
    return {
        code: 0, message: '登录成功',
        data: { token, admin: safeAdmin }
    }
}
