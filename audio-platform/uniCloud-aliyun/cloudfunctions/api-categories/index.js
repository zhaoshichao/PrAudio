// 公开接口 — 分类查询（2层树形，camelCase）
'use strict'
const { db } = require('../common/db')
const { success } = require('../common/utils')

exports.main = async (event, context) => {
    if (event.action === 'tree') {
        const all = await db.collection('categories')
            .where({ status: 1 }).orderBy('sort', 'asc').get()
        return success(buildTree(all.data))
    }

    let where = { status: 1 }
    if (event.keyword) {
        where.name = new RegExp(event.keyword, 'i')
    }
    const res = await db.collection('categories')
        .where(where).orderBy('sort', 'asc').get()
    return success(res.data)
}

function buildTree(list) {
    const map = {}, tree = []
    list.forEach(item => { map[item._id] = { ...item, children: [] } })
    list.forEach(item => {
        if (item.parentId && map[item.parentId]) {
            map[item.parentId].children.push(map[item._id])
        } else if (!item.parentId) {
            tree.push(map[item._id])
        }
    })
    return tree
}
