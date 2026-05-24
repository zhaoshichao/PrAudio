// 音频管理 CRUD（camelCase，强版本绑定，diff 更新）
'use strict'
const { db, cmd } = require('../common/db')
const { verifyAdminToken } = require('../common/auth')
const { success, fail, parsePagination } = require('../common/utils')

exports.main = async (event, context) => {
    await verifyAdminToken(event.adminToken)
    const { action, data } = event

    switch (action) {
        case 'list': {
            const { page, limit, skip } = parsePagination(event)
            let where = {}
            if (event.categoryId) where.categoryId = event.categoryId
            if (event.tagIds && event.tagIds.length > 0) where.tagIds = cmd.in(event.tagIds)
            if (event.keyword) where.name = new RegExp(event.keyword, 'i')

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
        case 'detail': {
            if (!data || !data._id) return fail('缺少参数')
            const audio = await db.collection('audio_files').doc(data._id).get()
            if (!audio.data[0]) return fail('音频不存在')
            const versions = await db.collection('audio_versions').where({ audioId: data._id }).get()
            return success({ ...audio.data[0], versions: versions.data })
        }
        case 'create': {
            if (!data || !data.name || !data.categoryId) return fail('名称和分类不能为空')
            if (!data.versions || data.versions.length === 0) return fail('至少需要绑定一个版本文件')
            for (const v of data.versions) {
                if (!v.fileUrl) return fail('每个版本必须上传音频文件')
            }

            const audioRes = await db.collection('audio_files').add({
                categoryId: data.categoryId,
                name: data.name,
                description: data.description || '',
                cover: data.cover || '',
                tagIds: data.tagIds || [],
                status: 1,
                sort: data.sort || 0,
                createdAt: new Date(),
                updatedAt: new Date()
            })

            for (const v of data.versions) {
                let versionName = ''
                try {
                    const ver = await db.collection('versions').doc(v.versionId).get()
                    if (ver.data && ver.data[0]) versionName = ver.data[0].name
                } catch (e) { /* ignore */ }

                await db.collection('audio_versions').add({
                    audioId: audioRes.id,
                    versionId: v.versionId,
                    versionName,
                    fileUrl: v.fileUrl,
                    fileName: v.fileName || '',
                    fileSize: v.fileSize || 0,
                    duration: v.duration || 0,
                    createdAt: new Date()
                })
            }
            return success({ _id: audioRes.id }, '创建成功')
        }
        case 'update': {
            if (!data || !data._id) return fail('缺少参数')
            await db.collection('audio_files').doc(data._id).update({
                name: data.name,
                description: data.description,
                cover: data.cover,
                categoryId: data.categoryId,
                tagIds: data.tagIds,
                sort: data.sort,
                updatedAt: new Date()
            })

            if (data.versions) {
                // Diff-based update: compare incoming vs existing
                const existing = await db.collection('audio_versions').where({ audioId: data._id }).get()
                const existingMap = {}
                existing.data.forEach(v => { existingMap[v.versionId] = v })

                const incomingMap = {}
                data.versions.forEach(v => { incomingMap[v.versionId] = v })

                // Delete removed versions
                for (const v of existing.data) {
                    if (!incomingMap[v.versionId]) {
                        if (v.fileUrl) {
                            try { await uniCloud.deleteFile({ fileList: [v.fileUrl] }) } catch (e) { /* ignore */ }
                        }
                        await db.collection('audio_versions').doc(v._id).remove()
                    }
                }

                // Add new or update changed versions
                for (const v of data.versions) {
                    if (!v.fileUrl) continue
                    const exist = existingMap[v.versionId]
                    if (!exist) {
                        // New version
                        let versionName = ''
                        try {
                            const ver = await db.collection('versions').doc(v.versionId).get()
                            if (ver.data && ver.data[0]) versionName = ver.data[0].name
                        } catch (e) { /* ignore */ }

                        await db.collection('audio_versions').add({
                            audioId: data._id,
                            versionId: v.versionId,
                            versionName,
                            fileUrl: v.fileUrl,
                            fileName: v.fileName || '',
                            fileSize: v.fileSize || 0,
                            duration: v.duration || 0,
                            createdAt: new Date()
                        })
                    } else if (exist.fileUrl !== v.fileUrl || exist.fileName !== v.fileName || exist.fileSize !== v.fileSize) {
                        // Changed
                        await db.collection('audio_versions').doc(exist._id).update({
                            fileUrl: v.fileUrl,
                            fileName: v.fileName || '',
                            fileSize: v.fileSize || 0,
                            duration: v.duration || 0
                        })
                    }
                }
            }
            return success(null, '更新成功')
        }
        case 'updateStatus': {
            if (!data || !data._id) return fail('缺少参数')
            await db.collection('audio_files').doc(data._id).update({
                status: data.status,
                updatedAt: new Date()
            })
            return success(null, data.status === 1 ? '已启用' : '已禁用')
        }
        case 'delete': {
            if (!data || !data._id) return fail('缺少参数')
            await db.collection('audio_files').doc(data._id).update({
                status: 0,
                updatedAt: new Date()
            })
            return success(null, '已下架')
        }
        default: return fail('未知操作')
    }
}
