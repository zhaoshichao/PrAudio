// 公开接口 — 音频查询（camelCase）
'use strict'
const { db, cmd } = require('../common/db')
const { success, parsePagination } = require('../common/utils')

exports.main = async (event, context) => {
    // Hot audio: return top audios ordered by sort
    if (event.action === 'hot') {
        const hotRes = await db.collection('audio_files').where({ status: 1 })
            .orderBy('sort', 'asc').limit(event.limit || 6).get()
        const hotAudioIds = hotRes.data.map(a => a._id)
        const hotVersionsMap = {}
        if (hotAudioIds.length > 0) {
            const allVer = await db.collection('audio_versions')
                .where({ audioId: cmd.in(hotAudioIds) }).get()
            allVer.data.forEach(v => {
                if (!hotVersionsMap[v.audioId]) hotVersionsMap[v.audioId] = []
                hotVersionsMap[v.audioId].push(v)
            })
        }
        const hotAudios = hotRes.data.map(audio => ({
            ...audio,
            versions: hotVersionsMap[audio._id] || []
        }))
        return success(hotAudios)
    }

    const { page, limit, skip } = parsePagination(event)
    let where = { status: 1 }

    if (event.categoryId) where.categoryId = event.categoryId
    if (event.tagId) where.tagIds = cmd.in([event.tagId])
    if (event.keyword) where.name = new RegExp(event.keyword, 'i')
    if (event.versionId) {
        const linked = await db.collection('audio_versions')
            .where({ versionId: event.versionId }).get()
        const audioIds = linked.data.map(v => v.audioId)
        where._id = cmd.in(audioIds.length > 0 ? audioIds : ['__none__'])
    }

    const [res, count] = await Promise.all([
        db.collection('audio_files').where(where)
            .orderBy('sort', 'asc').skip(skip).limit(limit).get(),
        db.collection('audio_files').where(where).count()
    ])

    // Batch fetch all versions in one query (avoids N+1 read exhaustion)
    const audioIds = res.data.map(a => a._id)
    const versionsMap = {}
    if (audioIds.length > 0) {
        const allVersions = await db.collection('audio_versions')
            .where({ audioId: cmd.in(audioIds) }).get()
        allVersions.data.forEach(v => {
            if (!versionsMap[v.audioId]) versionsMap[v.audioId] = []
            versionsMap[v.audioId].push(v)
        })
    }
    const audios = res.data.map(audio => ({
        ...audio,
        versions: versionsMap[audio._id] || []
    }))

    return success({ list: audios, total: count.total, page, limit })
}
