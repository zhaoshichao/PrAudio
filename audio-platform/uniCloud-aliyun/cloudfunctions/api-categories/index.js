// 公开接口 — 分类查询（2层树形，camelCase，含音频数量）
'use strict'
const { db } = require('../common/db')
const { success } = require('../common/utils')

exports.main = async (event, context) => {
    if (event.action === 'tree') {
        const all = await db.collection('categories')
            .where({ status: 1 }).orderBy('sort', 'asc').get()

        // Count audio files per category
        const audioCounts = {}
        const audioRes = await db.collection('audio_files')
            .where({ status: 1 }).get()
        audioRes.data.forEach(a => {
            const cid = a.categoryId
            if (cid) audioCounts[cid] = (audioCounts[cid] || 0) + 1
        })

        const tree = buildTree(all.data, audioCounts)
        return success(tree)
    }

    let where = { status: 1 }
    if (event.keyword) {
        where.name = new RegExp(event.keyword, 'i')
    }
    const res = await db.collection('categories')
        .where(where).orderBy('sort', 'asc').get()
    return success(res.data)
}

function buildTree(list, counts) {
    const map = {}, tree = []
    list.forEach(item => { map[item._id] = { ...item, children: [] } })
    list.forEach(item => {
        if (item.parentId && map[item.parentId]) {
            map[item.parentId].children.push(map[item._id])
        } else if (!item.parentId) {
            tree.push(map[item._id])
        }
    })
    // Set counts after tree is built: leaf = own, parent = own + children sum
    function setCount(node) {
        let total = counts[node._id] || 0
        if (node.children) {
            node.children.forEach(c => { total += setCount(c) })
        }
        node.count = total
        return total
    }
    tree.forEach(setCount)
    return tree
}
