// API 请求封装

const BASE_URL = '' // uniCloud 云函数 URL 化后填写

// 获取用户 token
function getToken() {
    return uni.getStorageSync('token') || ''
}

// 获取管理员 token
function getAdminToken() {
    return uni.getStorageSync('admin_token') || ''
}

// 通用请求
async function request(url, options = {}) {
    const method = options.method || 'GET'
    const headers = options.headers || {}
    if (options.auth === 'admin') {
        headers['Content-Type'] = 'application/json'
    }
    const body = options.body

    return new Promise((resolve, reject) => {
        uni.request({
            url: BASE_URL + url,
            method,
            header: headers,
            data: body,
            success(res) {
                const data = res.data
                if (data.code === 0) {
                    resolve(data.data)
                } else if (data.code === 401) {
                    uni.removeStorageSync(options.auth === 'admin' ? 'admin_token' : 'token')
                    uni.reLaunch({ url: options.auth === 'admin' ? '/pages-admin/login/login' : '/pages/login/login' })
                    reject(new Error(data.message || '未登录'))
                } else {
                    reject(new Error(data.message || '请求失败'))
                }
            },
            fail(err) {
                reject(new Error('网络错误: ' + (err.errMsg || '')))
            }
        })
    })
}

// 调用云函数（直接方式）
async function callFunction(name, data = {}) {
    try {
        const res = await uniCloud.callFunction({ name, data })
        return res.result
    } catch (e) {
        throw new Error('云函数调用失败: ' + e.message)
    }
}

// ── 用户 API ──
export const userApi = {
    login: (data) => callFunction('api-login', data),
    register: (data) => callFunction('api-register', data),
    getProfile: () => callFunction('user-profile', { action: 'get' }),
    updateProfile: (data) => callFunction('user-profile', { action: 'update', ...data }),
    getFavorites: (page = 1, limit = 20) =>
        callFunction('user-favorites', { action: 'list', page, limit }),
    toggleFavorite: (audio_id) =>
        callFunction('user-favorites', { action: 'toggle', audio_id }),
    createOrder: (data) => callFunction('user-orders', { action: 'create', ...data }),
    getOrders: (params = {}) => callFunction('user-orders', { action: 'list', ...params }),
    getReferrals: () => callFunction('user-profile', { action: 'get' }),
    getMemberInfo: () => callFunction('user-profile', { action: 'get' }),
}

// ── 公开 API ──
export const publicApi = {
    getCategories: (keyword) => callFunction('api-categories', { keyword }),
    getCategoryTree: () => callFunction('api-categories', { action: 'tree' }),
    getAudioFiles: (params) => callFunction('api-audio-files', params),
    getAudioList: (params) => callFunction('api-audio-files', params),
    getHotAudio: (limit) => callFunction('api-audio-files', { action: 'hot', limit: limit || 6 }),
    getTags: () => callFunction('api-tags'),
    getVersions: () => callFunction('api-versions'),
}

// ── 管理后台 API ──
// 自动注入 adminToken
function adminCall(name, data = {}) {
    const token = uni.getStorageSync('admin_token') || ''
    return callFunction(name, { ...data, adminToken: token })
}

export const adminApi = {
    login: (data) => callFunction('admin-login', data), // login doesn't need token
    getDashboard: () => adminCall('admin-dashboard'),
    getCategories: () => adminCall('admin-categories'),
    getCategoryTree: () => adminCall('admin-categories', { action: 'tree' }),
    createCategory: (data) => adminCall('admin-categories', { action: 'create', data }),
    updateCategory: (data) => adminCall('admin-categories', { action: 'update', data }),
    deleteCategory: (_id) => adminCall('admin-categories', { action: 'delete', data: { _id } }),
    moveCategory: (_id, direction) => adminCall('admin-categories', { action: 'move', data: { _id, direction } }),
    getTags: () => adminCall('admin-tags', { action: 'list' }),
    createTag: (data) => adminCall('admin-tags', { action: 'create', data }),
    updateTag: (data) => adminCall('admin-tags', { action: 'update', data }),
    deleteTag: (_id) => adminCall('admin-tags', { action: 'delete', data: { _id } }),
    getVersions: () => adminCall('admin-versions', { action: 'list' }),
    createVersion: (data) => adminCall('admin-versions', { action: 'create', data }),
    updateVersion: (data) => adminCall('admin-versions', { action: 'update', data }),
    deleteVersion: (_id) => adminCall('admin-versions', { action: 'delete', data: { _id } }),
    getAudioFiles: (params) => adminCall('admin-audio-files', { action: 'list', ...params }),
    getAudioList: (params) => adminCall('admin-audio-files', { action: 'list', ...params }),
    getAudioDetail: (_id) => adminCall('admin-audio-files', { action: 'detail', data: { _id } }),
    createAudio: (data) => adminCall('admin-audio-files', { action: 'create', data }),
    updateAudio: (_id, data) => adminCall('admin-audio-files', { action: 'update', data: { _id, ...data } }),
    updateAudioStatus: (_id, data) => adminCall('admin-audio-files', { action: 'updateStatus', data: { _id, ...data } }),
    deleteAudio: (_id) => adminCall('admin-audio-files', { action: 'delete', data: { _id } }),
    getUsers: (params) => adminCall('admin-users', { action: 'list', ...params }),
    getUserDetail: (user_id) => adminCall('admin-users', { action: 'detail', user_id }),
    getOrders: (params) => adminCall('admin-orders', params),
    getAdmins: () => adminCall('admin-admins', { action: 'list' }),
    createAdmin: (data) => adminCall('admin-admins', { action: 'create', data }),
    updateAdmin: (data) => adminCall('admin-admins', { action: 'update', data }),
    deleteAdmin: (_id) => adminCall('admin-admins', { action: 'delete', data: { _id } }),
}
