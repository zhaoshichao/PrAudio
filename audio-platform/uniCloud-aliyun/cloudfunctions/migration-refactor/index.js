// 数据模型重构迁移：3级分类→2级，snake_case→camelCase，补充冗余字段
'use strict'
const { db } = require('../common/db')

exports.main = async (event) => {
    const dryRun =  false  // 默认 dryRun=true，传 { dryRun: false } 才真正执行
    const results = []

    // ===== Step 1: 合并 3 级分类为 2 级 =====
    const allCats = await db.collection('categories').get()
    const level3Cats = allCats.data.filter(c => c.level === 3)

    if (!dryRun) {
        for (const cat of level3Cats) {
            await db.collection('categories').doc(cat._id).update({ status: 0, updatedAt: new Date() })
        }
        // 将 audio_files 的 categoryId 从 level-3 改为其 parent (level-2)
        for (const cat of level3Cats) {
            if (cat.parent_id) {
                await db.collection('audio_files')
                    .where({ category_id: cat._id })
                    .update({ category_id: cat.parent_id, updatedAt: new Date() })
            }
        }
    }
    results.push({ step: 'flatten-level3', level3Count: level3Cats.length })

    // ===== Step 2: 重命名字段 =====
    // categories: parent_id → parentId
    const catsWithParentId = allCats.data.filter(c => c.parent_id)
    if (!dryRun) {
        for (const cat of catsWithParentId) {
            await db.collection('categories').doc(cat._id).update({
                parentId: cat.parent_id,
                updatedAt: new Date()
            })
        }
    }
    results.push({ step: 'rename-categories-parentId', count: catsWithParentId.length })

    // audio_files: category_id → categoryId, tag_ids → tagIds
    const allAudio = await db.collection('audio_files').get()
    if (!dryRun) {
        for (const audio of allAudio.data) {
            const update = { updatedAt: new Date() }
            if (audio.category_id !== undefined) update.categoryId = audio.category_id
            if (audio.tag_ids !== undefined) update.tagIds = audio.tag_ids || []
            await db.collection('audio_files').doc(audio._id).update(update)
        }
    }
    results.push({ step: 'rename-audio-files', count: allAudio.data.length })

    // audio_versions: audio_id→audioId, version_id→versionId, file_url→fileUrl, file_name→fileName, file_size→fileSize
    const allAV = await db.collection('audio_versions').get()
    if (!dryRun) {
        for (const av of allAV.data) {
            const update = { updatedAt: new Date() }
            if (av.audio_id !== undefined) update.audioId = av.audio_id
            if (av.version_id !== undefined) update.versionId = av.version_id
            if (av.file_url !== undefined) update.fileUrl = av.file_url || ''
            if (av.file_name !== undefined) update.fileName = av.file_name || ''
            if (av.file_size !== undefined) update.fileSize = av.file_size || 0
            if (Object.keys(update).length > 0) {
                await db.collection('audio_versions').doc(av._id).update(update)
            }
        }
    }
    results.push({ step: 'rename-audio-versions', count: allAV.data.length })

    // Remove old snake_case fields
    if (!dryRun) {
        for (const cat of catsWithParentId) {
            await db.collection('categories').doc(cat._id).update({
                parent_id: db.command.remove()
            })
        }
        for (const audio of allAudio.data) {
            const removeUp = {}
            if (audio.category_id !== undefined) removeUp.category_id = db.command.remove()
            if (audio.tag_ids !== undefined) removeUp.tag_ids = db.command.remove()
            if (Object.keys(removeUp).length > 0) {
                await db.collection('audio_files').doc(audio._id).update(removeUp)
            }
        }
        for (const av of allAV.data) {
            const removeUp = {}
            if (av.audio_id !== undefined) removeUp.audio_id = db.command.remove()
            if (av.version_id !== undefined) removeUp.version_id = db.command.remove()
            if (av.file_url !== undefined) removeUp.file_url = db.command.remove()
            if (av.file_name !== undefined) removeUp.file_name = db.command.remove()
            if (av.file_size !== undefined) removeUp.file_size = db.command.remove()
            if (Object.keys(removeUp).length > 0) {
                await db.collection('audio_versions').doc(av._id).update(removeUp)
            }
        }
    }
    results.push({ step: 'remove-old-snake-case-fields' })

    // ===== Step 3: 补充冗余数据 =====
    // audio_versions: 补充 versionName
    const versionsAll = await db.collection('versions').get()
    const versionMap = {}
    versionsAll.data.forEach(v => { versionMap[v._id] = v.name })

    if (!dryRun) {
        for (const av of allAV.data) {
            const vName = versionMap[av.version_id || av.versionId] || ''
            if (vName) {
                await db.collection('audio_versions').doc(av._id).update({ versionName: vName, updatedAt: new Date() })
            }
        }
    }
    results.push({ step: 'backfill-versionName' })

    // categories: 补充 parentName
    const catMap = {}
    allCats.data.forEach(c => { catMap[c._id] = c.name })
    const catsWithParent = allCats.data.filter(c => c.parent_id || c.parentId)
    if (!dryRun) {
        for (const cat of catsWithParent) {
            const pid = cat.parentId || cat.parent_id
            const pname = catMap[pid] || ''
            if (pname) {
                await db.collection('categories').doc(cat._id).update({ parentName: pname, updatedAt: new Date() })
            }
        }
    }
    results.push({ step: 'backfill-parentName' })

    return { code: 0, message: dryRun ? 'DRY RUN — 传 { dryRun: false } 执行' : '迁移完成', data: results }
}
