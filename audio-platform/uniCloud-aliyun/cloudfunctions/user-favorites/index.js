// 用户收藏
'use strict'
const { db } = require('../common/db')
const { verifyUserToken } = require('../common/auth')
const { success, parsePagination } = require('../common/utils')

exports.main = async (event, context) => {
    const auth = await verifyUserToken(context)

    switch (event.action) {
        case 'toggle': {
            const exist = await db.collection('favorites')
                .where({ user_id: auth.uid, audio_id: event.audio_id }).get()
            if (exist.data.length > 0) {
                await db.collection('favorites').doc(exist.data[0]._id).remove()
                return success({ favorited: false }, '已取消收藏')
            } else {
                await db.collection('favorites').add({
                    user_id: auth.uid, audio_id: event.audio_id, created_at: new Date()
                })
                return success({ favorited: true }, '已收藏')
            }
        }
        case 'list': {
            const { page, limit, skip } = parsePagination(event)
            const [res, count] = await Promise.all([
                db.collection('favorites').where({ user_id: auth.uid })
                    .orderBy('created_at', 'desc').skip(skip).limit(limit).get(),
                db.collection('favorites').where({ user_id: auth.uid }).count()
            ])
            const list = []
            for (const fav of res.data) {
                const audio = await db.collection('audio_files').doc(fav.audio_id).get()
                if (audio.data[0]) {
                    const versions = await db.collection('audio_versions')
                        .where({ audio_id: fav.audio_id }).get()
                    list.push({ ...audio.data[0], versions: versions.data, favorited_at: fav.created_at })
                }
            }
            return success({ list, total: count.total, page, limit })
        }
        case 'check': {
            const ids = event.audio_ids || []
            const res = await db.collection('favorites')
                .where({ user_id: auth.uid, audio_id: db.command.in(ids) }).get()
            return success(res.data.map(f => f.audio_id))
        }
        default: return { code: -1, message: '未知操作' }
    }
}
