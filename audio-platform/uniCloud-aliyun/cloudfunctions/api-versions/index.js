// 公开接口 — 版本池列表
'use strict'
const { db } = require('../common/db')
const { success } = require('../common/utils')

exports.main = async (event, context) => {
    const res = await db.collection('versions').orderBy('sort', 'asc').get()
    return success(res.data)
}
