// 数据库初始化 + 种子数据
'use strict'
const db = uniCloud.database()

exports.main = async (event, context) => {
    // 初始化表（uniCloud 自动建表，这里只创建索引和种子数据）
    console.log('开始初始化数据库...')

    // 创建超级管理员（检查是否已存在）
    const existAdmin = await db.collection('admin_users').where({ username: 'admin' }).get()
    if (existAdmin.data.length === 0) {
        const bcrypt = require('bcryptjs')
        const hash = bcrypt.hashSync('admin123456', 10)
        await db.collection('admin_users').add({
            username: 'admin',
            password_hash: hash,
            role: 'super_admin',
            nickname: '超级管理员',
            avatar: '',
            status: 1,
            created_at: new Date()
        })
        console.log('[OK] 超级管理员已创建 (admin / admin123456)')
    } else {
        console.log('[SKIP] 超级管理员已存在')
    }

    // 创建默认版本
    const defaultVersions = [
        { name: '30秒', sort: 1 },
        { name: '60秒', sort: 2 },
        { name: '90秒', sort: 3 }
    ]
    for (const v of defaultVersions) {
        const exist = await db.collection('versions').where({ name: v.name }).get()
        if (exist.data.length === 0) {
            await db.collection('versions').add({
                name: v.name, sort: v.sort, created_at: new Date()
            })
            console.log('[OK] 默认版本已创建: ' + v.name)
        }
    }

    console.log('[DONE] 数据库初始化完成')
    return { code: 0, message: '数据库初始化完成' }
}
