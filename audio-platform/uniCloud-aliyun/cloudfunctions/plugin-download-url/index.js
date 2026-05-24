// 插件专用 — 获取音频临时下载链接
'use strict'
const { verifyUserToken } = require('../common/auth')
const { success, fail } = require('../common/utils')

exports.main = async (event, context) => {
    await verifyUserToken(context)
    const { fileID } = event
    if (!fileID) return fail('缺少 fileID')

    const result = await uniCloud.getTempFileURL({ fileList: [fileID] })
    if (result.fileList && result.fileList[0]) {
        return success({ url: result.fileList[0].tempFileURL })
    }
    return fail('获取下载链接失败')
}
