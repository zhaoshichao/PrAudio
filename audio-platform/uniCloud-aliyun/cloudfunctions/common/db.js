// 公共模块 — 数据库连接
'use strict'
const db = uniCloud.database()
const cmd = db.command
const _ = db.command.aggregate

module.exports = { db, cmd, _ }
