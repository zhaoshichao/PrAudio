// 插件专用 — 收藏操作
'use strict'
const { db } = require('../common/db')
const { verifyUserToken } = require('../common/auth')
const { success } = require('../common/utils')

exports.main = async (event, context) => {
    const auth = await verifyUserToken(context)

    if (event.action === 'list') {
        const favs = await db.collection('favorites').where({ user_id: auth.uid }).get()
        return success(favs.data.map(f => f.audio_id))
    }

    if (event.action === 'toggle') {
        const exist = await db.collection('favorites')
            .where({ user_id: auth.uid, audio_id: event.audio_id }).get()
        if (exist.data.length > 0) {
            await db.collection('favorites').doc(exist.data[0]._id).remove()
            return success({ favorited: false })
        } else {
            await db.collection('favorites').add({
                user_id: auth.uid, audio_id: event.audio_id, created_at: new Date()
            })
            return success({ favorited: true })
        }
    }

    return { code: -1, message: '未知操作' }
}
