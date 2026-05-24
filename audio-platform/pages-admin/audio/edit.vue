<template>
  <view class="audio-edit-page">
    <AdminSidebar :visible="sidebarVisible" @close="sidebarVisible = false" />
    <!-- Top Bar -->
    <view class="top-bar">
      <view class="top-left">
        <text class="back-btn" @click="goBack">← 返回</text>
        <text class="menu-btn" @click="sidebarVisible = true">☰</text>
        <text class="page-title">{{ isEdit ? '编辑音频' : '新增音频' }}</text>
      </view>
      <button class="btn-primary" :loading="saving" @click="handleSave">保存</button>
    </view>

    <!-- Step Indicator -->
    <view class="step-bar">
      <view class="step-item" :class="{ active: currentStep >= 1, done: currentStep > 1 }" @click="currentStep = 1">
        <view class="step-num">1</view>
        <text class="step-label">基本信息</text>
      </view>
      <view class="step-line" :class="{ active: currentStep >= 2 }"></view>
      <view class="step-item" :class="{ active: currentStep >= 2, done: currentStep > 2 }" @click="currentStep = 2">
        <view class="step-num">2</view>
        <text class="step-label">标签</text>
      </view>
      <view class="step-line" :class="{ active: currentStep >= 3 }"></view>
      <view class="step-item" :class="{ active: currentStep >= 3, done: currentStep > 3 }" @click="currentStep = 3">
        <view class="step-num">3</view>
        <text class="step-label">封面</text>
      </view>
      <view class="step-line" :class="{ active: currentStep >= 4 }"></view>
      <view class="step-item" :class="{ active: currentStep >= 4 }" @click="currentStep = 4">
        <view class="step-num">4</view>
        <text class="step-label">版本文件</text>
      </view>
    </view>

    <scroll-view class="form-scroll" scroll-y>
      <!-- Step 1: Basic Info -->
      <view class="form-card" v-show="currentStep === 1">
        <text class="form-section-title">基本信息</text>
        <view class="form-item">
          <text class="form-label">音频名称 <text class="required">*</text></text>
          <input class="form-input" v-model="formData.name" placeholder="请输入音频名称" placeholder-style="color:#bbb" />
        </view>
        <view class="form-item">
          <text class="form-label">描述</text>
          <textarea class="form-textarea" v-model="formData.description" placeholder="请输入音频描述" placeholder-style="color:#bbb" />
        </view>
        <view class="form-item">
          <text class="form-label">分类 <text class="required">*</text></text>
          <picker mode="multiSelector" :range="categoryRange" :value="categoryValue" @change="onCategoryChange" @columnchange="onCategoryColumnChange">
            <view class="picker-box">
              <text :class="{ placeholder: !categoryText }">
                {{ categoryText || '请选择分类' }}
              </text>
            </view>
          </picker>
        </view>
        <view class="form-item">
          <text class="form-label">排序</text>
          <input class="form-input" v-model.number="formData.sort" type="number" placeholder="数字越小越靠前" placeholder-style="color:#bbb" />
        </view>
      </view>

      <!-- Step 2: Tags -->
      <view class="form-card" v-show="currentStep === 2">
        <text class="form-section-title">选择标签</text>
        <text class="form-hint">点击标签进行多选，已选中的标签会高亮显示</text>
        <view class="tag-cloud">
          <view
            v-for="tag in allTags"
            :key="tag._id"
            class="tag-cloud-item"
            :class="{ selected: selectedTagIds.includes(tag._id) }"
            @click="toggleTag(tag._id)"
          >
            <view class="tag-dot" :style="{ backgroundColor: tag.color }"></view>
            <text>{{ tag.name }}</text>
          </view>
        </view>
        <view class="empty-hint" v-if="allTags.length === 0">
          <text>暂无标签，请先去标签管理添加</text>
        </view>
      </view>

      <!-- Step 3: Cover -->
      <view class="form-card" v-show="currentStep === 3">
        <text class="form-section-title">封面图片</text>
        <view class="cover-upload">
          <view class="cover-preview" v-if="formData.cover">
            <image :src="formData.cover" class="cover-img" mode="aspectFill" />
            <text class="cover-remove" @click="formData.cover = ''">✕</text>
          </view>
          <view class="upload-area" @click="uploadCover" v-else>
            <text class="upload-icon">+</text>
            <text class="upload-text">点击上传封面</text>
          </view>
        </view>
      </view>

      <!-- Step 4: Versions -->
      <view class="form-card" v-show="currentStep === 4">
        <text class="form-section-title">版本文件</text>
        <text class="form-hint">勾选版本，然后上传对应的音频文件。支持 .mp3 / .wav 格式</text>

        <view class="empty-hint" v-if="versionPool.length === 0">
          <text>暂无版本可选，请先去 "版本管理" 页面创建版本（如 30秒 / 60秒 / 90秒）</text>
        </view>
        <view class="version-list" v-else>
          <view class="version-item" v-for="ver in versionPool" :key="ver._id">
            <view class="version-check-row">
              <label class="checkbox-label">
                <checkbox :value="ver._id" :checked="isVersionChecked(ver._id)" @click.stop="toggleVersion(ver._id)" color="#6c5ce7" />
                <text class="version-name">{{ ver.name }}</text>
              </label>
              <input
                v-if="isVersionChecked(ver._id)"
                class="duration-input"
                v-model="getVersionBinding(ver._id).duration"
                type="number"
                placeholder="时长(秒)"
                placeholder-style="color:#bbb"
              />
            </view>
            <view class="version-file-area" v-if="isVersionChecked(ver._id)">
              <view class="file-upload-box" @click="uploadVersionFile(ver._id)" v-if="!getVersionBinding(ver._id).fileUrl">
                <text class="upload-icon-small">📁</text>
                <text class="upload-text-small">点击选择音频文件</text>
              </view>
              <view class="file-info" v-else>
                <text class="file-name">{{ getVersionBinding(ver._id).fileName || '已上传' }}</text>
                <text class="file-size" v-if="getVersionBinding(ver._id).fileSize">{{ formatFileSize(getVersionBinding(ver._id).fileSize) }}</text>
                <text class="file-remove" @click="removeVersionFile(ver._id)">删除</text>
              </view>
              <view class="upload-progress" v-if="uploadProgress[ver._id] > 0 && uploadProgress[ver._id] < 100">
                <view class="progress-bar">
                  <view class="progress-fill" :style="{ width: uploadProgress[ver._id] + '%' }"></view>
                </view>
                <text class="progress-text">{{ uploadProgress[ver._id] }}%</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- Bottom Action -->
    <view class="bottom-bar">
      <button class="btn-prev" v-if="currentStep > 1" @click="currentStep--">上一步</button>
      <button class="btn-next" v-if="currentStep < 4" @click="currentStep++">下一步</button>
      <button class="btn-primary save-btn" v-if="currentStep === 4" :loading="saving" @click="handleSave">保存音频</button>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { adminApi } from '@/utils/api.js'
import AdminSidebar from '@/components/AdminSidebar.vue'

const sidebarVisible = ref(false)

const currentStep = ref(1)
const isEdit = ref(false)
const audioId = ref('')
const saving = ref(false)
const allTags = ref([])
const selectedTagIds = ref([])
const versionPool = ref([])
const uploadProgress = reactive({})

// Form data
const formData = reactive({
  name: '',
  description: '',
  categoryId: '',
  sort: 0,
  cover: ''
})

// Version bindings: { versionId: { fileUrl, fileName, fileSize, duration } }
// Use ref({}) + reference replacement for reliable uni-app reactivity (same pattern as playingIds/favoritedIds)
const versionBindings = ref({})

// Category cascading
const categoryFlatList = ref([])
const categoryRange = ref([[], []])
const categoryValue = ref([0, 0])
const categoryText = ref('')

const formatFileSize = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
}

const checkLogin = () => {
  if (!uni.getStorageSync('admin_token')) {
    uni.redirectTo({ url: '/pages-admin/login/login' })
    return false
  }
  return true
}

const goBack = () => {
  uni.navigateBack()
}

// Load categories for cascading picker
const loadCategories = async () => {
  try {
    const res = await adminApi.getCategories()
    if (res.code === 0) {
      categoryFlatList.value = res.data || []
      categoryRange.value[0] = categoryFlatList.value.filter(c => c.level === 1).map(c => c.name)
    }
  } catch (err) { /* ignore */ }
}

const onCategoryColumnChange = (e) => {
  const { column, value } = e.detail
  if (column === 0) {
    const l1 = categoryFlatList.value.filter(c => c.level === 1)
    const sel = l1[value]
    const l2 = categoryFlatList.value.filter(c => c.parentId === (sel ? sel._id : ''))
    categoryRange.value[1] = l2.map(c => c.name)
    categoryValue.value[1] = 0
  }
}

const onCategoryChange = (e) => {
  const vals = e.detail.value
  categoryValue.value = vals
  const l1 = categoryFlatList.value.filter(c => c.level === 1)
  const l2 = categoryFlatList.value.filter(c => c.parentId === (l1[vals[0]] ? l1[vals[0]]._id : ''))
  const names = []
  if (l1[vals[0]]) names.push(l1[vals[0]].name)
  if (l2[vals[1]]) names.push(l2[vals[1]].name)
  categoryText.value = names.join(' > ')
  // Bind to deepest selected category
  formData.categoryId = (l2[vals[1]] || l1[vals[0]] || {})._id || ''
}

// Tags
const loadTags = async () => {
  try {
    const res = await adminApi.getTags()
    if (res.code === 0) {
      allTags.value = res.data || []
    }
  } catch (err) { /* ignore */ }
}

const toggleTag = (tagId) => {
  const idx = selectedTagIds.value.indexOf(tagId)
  if (idx > -1) {
    selectedTagIds.value.splice(idx, 1)
  } else {
    selectedTagIds.value.push(tagId)
  }
}

// Versions pool
const loadVersions = async () => {
  try {
    const res = await adminApi.getVersions()
    if (res.code === 0) {
      versionPool.value = res.data || []
    }
  } catch (err) { /* ignore */ }
}

const isVersionChecked = (versionId) => {
  return !!versionBindings.value[versionId]
}

const toggleVersion = (versionId) => {
  // Use reference replacement for reliable uni-app reactivity
  const next = { ...versionBindings.value }
  if (next[versionId]) {
    delete next[versionId]
  } else {
    next[versionId] = { fileUrl: '', fileName: '', fileSize: 0, duration: '' }
  }
  versionBindings.value = next
}

const getVersionBinding = (versionId) => {
  // Read-only access, no mutation needed
  if (!versionBindings.value[versionId]) {
    // Need to add this key — use replacement
    const next = { ...versionBindings.value }
    next[versionId] = { fileUrl: '', fileName: '', fileSize: 0, duration: '' }
    versionBindings.value = next
  }
  return versionBindings.value[versionId]
}

const removeVersionFile = (versionId) => {
  const next = { ...versionBindings.value }
  if (next[versionId]) {
    next[versionId] = { ...next[versionId], fileUrl: '', fileName: '', fileSize: 0 }
    versionBindings.value = next
  }
}

// Cover upload
const uploadCover = () => {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (chooseRes) => {
      const tempFilePath = chooseRes.tempFilePaths[0]
      uni.showLoading({ title: '上传中...' })
      uniCloud.uploadFile({
        filePath: tempFilePath,
        cloudPath: `covers/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`,
        success: (uploadRes) => {
          uni.hideLoading()
          formData.cover = uploadRes.fileID
          uni.showToast({ title: '封面上传成功', icon: 'success' })
        },
        fail: () => {
          uni.hideLoading()
          uni.showToast({ title: '上传失败', icon: 'none' })
        }
      })
    }
  })
}

// Version file upload (cross-platform)
const uploadVersionFile = (versionId) => {
  uni.chooseFile({
    count: 1,
    type: 'all',
    extension: ['.mp3', '.wav'],
    success: (chooseRes) => {
      const tempPath = chooseRes.tempFilePaths[0]
      const tempFile = chooseRes.tempFiles && chooseRes.tempFiles[0]
      const fileName = (tempFile && tempFile.name) || tempPath.split('/').pop() || 'audio.mp3'
      const fileSize = (tempFile && tempFile.size) || 0

      // Update binding with file info
      const vb = { ...versionBindings.value }
      vb[versionId] = { ...vb[versionId], fileName, fileSize }
      versionBindings.value = vb
      uploadProgress[versionId] = 0

      const uploadTask = uniCloud.uploadFile({
        filePath: tempPath,
        cloudPath: `audio/${Date.now()}_${fileName}`,
        success: (uploadRes) => {
          const next = { ...versionBindings.value }
          next[versionId] = { ...next[versionId], fileUrl: uploadRes.fileID }
          versionBindings.value = next
          uploadProgress[versionId] = 100
          uni.showToast({ title: '文件上传成功', icon: 'success' })
          setTimeout(() => {
            uploadProgress[versionId] = 0
          }, 2000)
        },
        fail: () => {
          uploadProgress[versionId] = 0
          const next = { ...versionBindings.value }
          next[versionId] = { ...next[versionId], fileUrl: '', fileName: '', fileSize: 0 }
          versionBindings.value = next
          uni.showToast({ title: '上传失败', icon: 'none' })
        }
      })

      if (uploadTask && uploadTask.onProgressUpdate) {
        uploadTask.onProgressUpdate((res) => {
          uploadProgress[versionId] = res.progress
        })
      }
    },
    fail: (err) => {
      console.error('chooseFile fail:', err)
      uni.showToast({ title: '选择文件失败', icon: 'none' })
    }
  })
}

// Load audio detail for edit
const loadDetail = async (id) => {
  try {
    const res = await adminApi.getAudioDetail(id)
    if (res.code === 0) {
      const detail = res.data
      formData.name = detail.name || ''
      formData.description = detail.description || ''
      formData.sort = detail.sort || 0
      formData.cover = detail.cover || ''
      formData.categoryId = detail.categoryId || ''
      selectedTagIds.value = (detail.tags || []).map(t => t._id || t)

      // Pre-fill category path
      if (detail.categoryPath) {
        categoryText.value = detail.categoryPath
      }
      // Pre-fill category picker
      if (detail.categoryId) {
        findAndSetCategoryValue(detail.categoryId)
      }

      // Pre-fill versions
      if (detail.versions && detail.versions.length > 0) {
        const vb = { ...versionBindings.value }
        detail.versions.forEach(v => {
          vb[v.versionId || v._id] = {
            fileUrl: v.fileUrl || '',
            fileName: v.fileName || '',
            fileSize: v.fileSize || 0,
            duration: v.duration || ''
          }
        })
        versionBindings.value = vb
      }
    }
  } catch (err) {
    console.error('loadDetail error:', err)
  }
}

const findAndSetCategoryValue = (catId) => {
  const findNode = (id) => categoryFlatList.value.find(c => c._id === id)
  const node = findNode(catId)
  if (!node) return
  const path = []
  let current = node
  while (current) {
    path.unshift(current)
    current = findNode(current.parentId)
  }
  // Set picker values
  path.forEach((n, i) => {
    if (i >= 2) return
    const list = categoryFlatList.value.filter(c => c.level === n.level)
    const idx = list.findIndex(c => c._id === n._id)
    if (idx >= 0) categoryValue.value[i] = idx
  })
}

// Save
const handleSave = async () => {
  if (!formData.name.trim()) {
    uni.showToast({ title: '请输入音频名称', icon: 'none' })
    currentStep.value = 1
    return
  }
  if (!formData.categoryId) {
    uni.showToast({ title: '请选择分类', icon: 'none' })
    currentStep.value = 1
    return
  }
  saving.value = true
  try {
    const versions = Object.keys(versionBindings.value).map(vid => ({
      versionId: vid,
      fileUrl: versionBindings.value[vid].fileUrl || '',
      fileName: versionBindings.value[vid].fileName || '',
      fileSize: versionBindings.value[vid].fileSize || 0,
      duration: versionBindings.value[vid].duration || ''
    }))

    const hasValidVersion = versions.some(v => v.fileUrl)
    if (!hasValidVersion) {
      uni.showToast({ title: '至少绑定一个版本并上传文件', icon: 'none' })
      currentStep.value = 4
      saving.value = false
      return
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description || '',
      categoryId: formData.categoryId,
      sort: formData.sort || 0,
      cover: formData.cover || '',
      tagIds: selectedTagIds.value,
      versions: versions
    }

    let res
    if (isEdit.value) {
      res = await adminApi.updateAudio(audioId.value, payload)
    } else {
      res = await adminApi.createAudio(payload)
    }

    if (res.code === 0) {
      uni.showToast({ title: isEdit.value ? '更新成功' : '创建成功', icon: 'success' })
      setTimeout(() => {
        uni.navigateBack()
      }, 800)
    } else {
      uni.showToast({ title: res.msg || '操作失败', icon: 'none' })
    }
  } catch (err) {
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (!checkLogin()) return
  // Check for id param
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const options = currentPage.$page?.options || currentPage.options || {}
  if (options.id) {
    isEdit.value = true
    audioId.value = options.id
    loadDetail(options.id)
  }
  loadCategories()
  loadTags()
  loadVersions()
})
</script>

<style scoped>
.audio-edit-page {
  min-height: 100vh;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  padding: 24rpx 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}

.top-left {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.menu-btn {
  font-size: 40rpx;
  color: #1a1a2e;
  padding: 0 8rpx;
  cursor: pointer;
}

.back-btn {
  font-size: 26rpx;
  color: #6c5ce7;
  cursor: pointer;
}

.page-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #1a1a2e;
}

.btn-primary {
  background: #6c5ce7;
  color: #fff;
  font-size: 26rpx;
  padding: 14rpx 36rpx;
  border-radius: 8rpx;
  border: none;
}

/* Step Bar */
.step-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  padding: 24rpx 40rpx;
  margin: 20rpx 30rpx;
  border-radius: 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  cursor: pointer;
}

.step-num {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: #ddd;
  color: #999;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: bold;
  transition: all 0.3s;
}

.step-item.active .step-num {
  background: #6c5ce7;
  color: #fff;
}

.step-item.done .step-num {
  background: #2ecc71;
  color: #fff;
}

.step-label {
  font-size: 22rpx;
  color: #999;
}

.step-item.active .step-label { color: #6c5ce7; }
.step-item.done .step-label { color: #2ecc71; }

.step-line {
  width: 80rpx;
  height: 3rpx;
  background: #ddd;
  margin: 0 12rpx;
  margin-bottom: 28rpx;
}

.step-line.active { background: #6c5ce7; }

/* Form Scroll */
.form-scroll {
  flex: 1;
  padding: 0 30rpx 120rpx;
}

.form-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 30rpx;
  margin-top: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}

.form-section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #1a1a2e;
  display: block;
  margin-bottom: 6rpx;
}

.form-hint {
  font-size: 24rpx;
  color: #aaa;
  display: block;
  margin-bottom: 20rpx;
}

.form-item {
  margin-bottom: 24rpx;
}

.form-label {
  display: block;
  font-size: 26rpx;
  color: #555;
  margin-bottom: 10rpx;
}

.required { color: #d32f2f; }

.form-input {
  width: 100%;
  height: 72rpx;
  border: 2rpx solid #ddd;
  border-radius: 8rpx;
  padding: 0 20rpx;
  font-size: 26rpx;
  box-sizing: border-box;
}

.form-textarea {
  width: 100%;
  min-height: 160rpx;
  border: 2rpx solid #ddd;
  border-radius: 8rpx;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
  box-sizing: border-box;
}

.picker-box {
  width: 100%;
  height: 72rpx;
  border: 2rpx solid #ddd;
  border-radius: 8rpx;
  padding: 0 20rpx;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  font-size: 26rpx;
  color: #333;
}

.picker-box .placeholder { color: #bbb; }

/* Tags */
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.tag-cloud-item {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 12rpx 24rpx;
  border: 2rpx solid #ddd;
  border-radius: 24rpx;
  font-size: 24rpx;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.tag-cloud-item.selected {
  background: #f0edff;
  border-color: #6c5ce7;
  color: #6c5ce7;
}

.tag-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
}

/* Cover */
.cover-upload {
  display: flex;
  justify-content: center;
  padding: 30rpx 0;
}

.cover-preview {
  position: relative;
  width: 240rpx;
  height: 240rpx;
}

.cover-img {
  width: 100%;
  height: 100%;
  border-radius: 12rpx;
}

.cover-remove {
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  width: 44rpx;
  height: 44rpx;
  background: #d32f2f;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
}

.upload-area {
  width: 240rpx;
  height: 240rpx;
  border: 4rpx dashed #ccc;
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  cursor: pointer;
}

.upload-icon {
  font-size: 60rpx;
  color: #ccc;
}

.upload-text {
  font-size: 24rpx;
  color: #aaa;
}

/* Versions */
.version-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.version-item {
  border: 2rpx solid #eee;
  border-radius: 10rpx;
  padding: 20rpx;
}

.version-check-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.version-name {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.duration-input {
  width: 160rpx;
  height: 56rpx;
  border: 2rpx solid #ddd;
  border-radius: 6rpx;
  padding: 0 12rpx;
  font-size: 24rpx;
  text-align: right;
}

.version-file-area {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #f0f0f0;
}

.file-upload-box {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 20rpx;
  background: #f9f9fb;
  border: 2rpx dashed #ccc;
  border-radius: 8rpx;
  cursor: pointer;
}

.upload-icon-small { font-size: 32rpx; }
.upload-text-small { font-size: 24rpx; color: #999; }

.file-info {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 16rpx 20rpx;
  background: #e8f5e9;
  border-radius: 8rpx;
}

.file-name { flex: 1; font-size: 24rpx; color: #333; }
.file-size { font-size: 22rpx; color: #888; }
.file-remove { font-size: 22rpx; color: #d32f2f; cursor: pointer; }

.upload-progress {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 12rpx;
}

.progress-bar {
  flex: 1;
  height: 12rpx;
  background: #e0e0e0;
  border-radius: 6rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #6c5ce7;
  border-radius: 6rpx;
  transition: width 0.3s;
}

.progress-text {
  font-size: 22rpx;
  color: #6c5ce7;
}

.empty-hint {
  padding: 40rpx;
  text-align: center;
  color: #bbb;
  font-size: 24rpx;
}

/* Bottom Bar */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  padding: 24rpx 30rpx;
  box-shadow: 0 -2rpx 12rpx rgba(0,0,0,0.06);
  display: flex;
  justify-content: center;
  gap: 24rpx;
}

.btn-prev {
  background: #eee;
  color: #666;
  border: none;
  font-size: 26rpx;
  padding: 16rpx 48rpx;
  border-radius: 8rpx;
}

.btn-next {
  background: #6c5ce7;
  color: #fff;
  border: none;
  font-size: 26rpx;
  padding: 16rpx 48rpx;
  border-radius: 8rpx;
}

.save-btn {
  padding: 16rpx 80rpx;
}
</style>
