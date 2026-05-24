// 公开接口 — 标签列表
'use strict'
const { db } = require('../common/db')
const { success } = require('../common/utils')

exports.main = async (event, context) => {
    const res = await db.collection('tags').orderBy('created_at', 'desc').get()
    return success(res.data)
}
