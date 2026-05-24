// 公共模块 — 工具函数
'use strict'

// 生成唯一推广码（6位字母数字）
function generateReferralCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

// 分页参数处理
function parsePagination(event) {
    const page = parseInt(event.page) || 1
    const limit = Math.min(parseInt(event.limit) || 20, 100)
    const skip = (page - 1) * limit
    return { page, limit, skip }
}

// 响应格式化
function success(data, message = 'ok') {
    return { code: 0, message, data }
}

function fail(message, code = -1) {
    return { code, message }
}

module.exports = { generateReferralCode, parsePagination, success, fail }
