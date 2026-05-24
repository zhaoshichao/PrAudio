// 插件专用 — 合并返回分类树+音频数据+收藏
'use strict'
const { db } = require('../common/db')
const { verifyUserToken } = require('../common/auth')
const { success } = require('../common/utils')

exports.main = async (event, context) => {
    const auth = await verifyUserToken(context)

    const allCats = await db.collection('categories')
        .where({ status: 1 }).orderBy('sort', 'asc').get()
    const allAudios = await db.collection('audio_files')
        .where({ status: 1 }).orderBy('sort', 'asc').get()

    const audios = []
    for (const audio of allAudios.data) {
        const versions = await db.collection('audio_versions')
            .where({ audio_id: audio._id }).get()
        audios.push({ ...audio, versions: versions.data })
    }

    const favs = await db.collection('favorites')
        .where({ user_id: auth.uid }).get()
    const favIds = favs.data.map(f => f.audio_id)

    return success({
        categories: buildTree(allCats.data, audios),
        audios,
        favoriteIds: favIds
    })
}

function buildTree(list, audios) {
    const map = {}, tree = []
    list.forEach(item => { map[item._id] = { ...item, children: [], audios: [] } })
    audios.forEach(audio => {
        if (map[audio.category_id]) {
            map[audio.category_id].audios.push(audio)
        }
    })
    list.forEach(item => {
        if (item.parent_id && map[item.parent_id]) {
            map[item.parent_id].children.push(map[item._id])
        } else if (!item.parent_id) {
            tree.push(map[item._id])
        }
    })
    return tree
}
