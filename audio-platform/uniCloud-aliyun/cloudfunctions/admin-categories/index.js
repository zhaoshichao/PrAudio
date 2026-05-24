// 分类管理 CRUD（2级树形，camelCase）
'use strict'
const { db } = require('../common/db')
const { verifyAdminToken } = require('../common/auth')
const { success, fail } = require('../common/utils')

exports.main = async (event, context) => {
    await verifyAdminToken(event.adminToken)
    const { action, data } = event

    switch (action) {
        case 'tree':
        case undefined:
        case '': {
            const all = await db.collection('categories')
                .orderBy('sort', 'asc')
                .orderBy('createdAt', 'asc')
                .get()
            if (action === 'tree') return success(buildTree(all.data))
            return success(all.data)
        }
        case 'create': {
            if (!data || !data.name) return fail('名称不能为空')
            const parentId = data.parentId || null
            let parentName = null
            let level = 1
            if (parentId) {
                const parent = await db.collection('categories').doc(parentId).get()
                if (parent.data && parent.data.length > 0) {
                    parentName = parent.data[0].name
                    level = (parent.data[0].level || 0) + 1
                    if (level > 2) return fail('分类最多两级')
                }
            }
            await db.collection('categories').add({
                name: data.name,
                level,
                parentId,
                parentName,
                sort: data.sort || 0,
                status: 1,
                createdAt: new Date(),
                updatedAt: new Date()
            })
            return success(null, '创建成功')
        }
        case 'update': {
            if (!data || !data._id) return fail('缺少参数')
            const updateData = {
                name: data.name,
                sort: data.sort,
                parentId: data.parentId || null,
                parentName: data.parentName || null,
                updatedAt: new Date()
            }
            await db.collection('categories').doc(data._id).update(updateData)
            return success(null, '更新成功')
        }
        case 'delete': {
            if (!data || !data._id) return fail('缺少参数')
            const children = await db.collection('categories').where({ parentId: data._id }).count()
            if (children.total > 0) return fail('请先删除子分类')
            const audioCount = await db.collection('audio_files').where({ categoryId: data._id }).count()
            if (audioCount.total > 0) return fail('该分类下有音频文件，请先迁移或删除音频')
            await db.collection('categories').doc(data._id).remove()
            return success(null, '已删除')
        }
        case 'move': {
            if (!data || !data._id || !data.direction) return fail('缺少参数')
            const { _id, direction } = data
            const current = await db.collection('categories').doc(_id).get()
            if (current.data.length === 0) return fail('分类不存在')
            const cat = current.data[0]
            const siblings = await db.collection('categories')
                .where({ parentId: cat.parentId || null })
                .orderBy('sort', 'asc')
                .get()
            const idx = siblings.data.findIndex(c => c._id === _id)
            if (idx === -1) return fail('排序异常')
            const targetIdx = direction === 'up' ? idx - 1 : idx + 1
            if (targetIdx < 0 || targetIdx >= siblings.data.length) {
                return success(null, '已在边界')
            }
            const swap = siblings.data[targetIdx]
            await db.collection('categories').doc(_id).update({ sort: swap.sort, updatedAt: new Date() })
            await db.collection('categories').doc(swap._id).update({ sort: cat.sort, updatedAt: new Date() })
            return success(null, '移动成功')
        }
        default:
            return fail('未知操作')
    }
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
