// 用户登录
'use strict'
const { success, fail } = require('../common/utils')

exports.main = async (event, context) => {
    const { mobile, code, wx_code, source } = event

    const uniIdCommon = require('uni-id-common')
    const uniIdIns = uniIdCommon.createInstance({ context })

    let loginRes
    if (wx_code) {
        loginRes = await uniIdIns.loginByWeixin({ code: wx_code })
    } else if (mobile && code) {
        loginRes = await uniIdIns.loginBySms({ mobile, code })
    } else {
        return fail('请使用手机号验证码或微信登录')
    }

    if (loginRes.errCode) return fail(loginRes.errMsg || '登录失败')

    // 新用户自动注册
    if (loginRes.type === 'register') {
        const { generateReferralCode } = require('../common/utils')
        const { db } = require('../common/db')
        let myCode = generateReferralCode()
        const check = await db.collection('uni-id-users').where({ referral_code: myCode }).count()
        if (check.total === 0) {
            await db.collection('uni-id-users').doc(loginRes.uid).update({ referral_code: myCode })
        }
    }

    return success({
        token: loginRes.token,
        tokenExpired: loginRes.tokenExpired,
        uid: loginRes.uid
    })
}
