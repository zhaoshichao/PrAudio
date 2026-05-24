// 用户注册
'use strict'
const { db } = require('../common/db')
const { success, fail, generateReferralCode } = require('../common/utils')

exports.main = async (event, context) => {
    const { mobile, code, password, referral_code } = event
    if (!mobile) return fail('手机号不能为空')

    // uni-id 注册用户
    const uniIdCommon = require('uni-id-common')
    const uniIdIns = uniIdCommon.createInstance({ context })

    const registerRes = await uniIdIns.registerUser({
        username: mobile,
        password: password || mobile,
        mobile: mobile,
        code: code
    })

    if (registerRes.errCode) return fail(registerRes.errMsg || '注册失败')

    const uid = registerRes.uid

    // 生成推广码
    let myCode = generateReferralCode()
    // 确保唯一
    let codeExists = true
    while (codeExists) {
        const check = await db.collection('uni-id-users')
            .where({ referral_code: myCode }).count()
        if (check.total === 0) codeExists = false
        else myCode = generateReferralCode()
    }

    const updateData = { referral_code: myCode }
    if (referral_code) {
        const referrer = await db.collection('uni-id-users')
            .where({ referral_code }).count()
        if (referrer.total > 0) {
            const refUser = await db.collection('uni-id-users')
                .where({ referral_code }).get()
            updateData.referrer_id = refUser.data[0]._id
        }
    }

    await db.collection('uni-id-users').doc(uid).update(updateData)

    return success({ uid, referral_code: myCode })
}
