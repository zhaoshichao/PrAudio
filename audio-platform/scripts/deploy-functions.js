#!/usr/bin/env node
/**
 * 打包云函数为 deployable zip 文件
 * 使用: node scripts/deploy-functions.js [函数名]
 *
 * 输出到: uniCloud-aliyun/deploy/ 目录
 *
 * 上传方式:
 * 1. uniCloud Web 控制台 → 云函数 → 上传
 * 2. 或通过 Alibaba Cloud 函数计算控制台上传
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const CLOUD_DIR = path.resolve(__dirname, '../uniCloud-aliyun/cloudfunctions')
const DEPLOY_DIR = path.resolve(__dirname, '../uniCloud-aliyun/deploy')

// Ensure deploy directory
if (!fs.existsSync(DEPLOY_DIR)) {
  fs.mkdirSync(DEPLOY_DIR, { recursive: true })
}

// Get all cloud function directories (skip 'common')
const allFuncDirs = fs.readdirSync(CLOUD_DIR).filter(f => {
  const stat = fs.statSync(path.join(CLOUD_DIR, f))
  return stat.isDirectory() && f !== 'common'
})

const targetFunc = process.argv[2]
const funcDirs = targetFunc
  ? allFuncDirs.filter(f => f === targetFunc)
  : allFuncDirs

if (targetFunc && funcDirs.length === 0) {
  console.error(`云函数 "${targetFunc}" 不存在`)
  console.log('可用函数:', allFuncDirs.join(', '))
  process.exit(1)
}

console.log(`准备打包 ${funcDirs.length} 个云函数...\n`)

funcDirs.forEach(funcName => {
  const funcDir = path.join(CLOUD_DIR, funcName)
  const zipFile = path.join(DEPLOY_DIR, `${funcName}.zip`)

  // Create temp dir with only needed files
  const tmpDir = path.join(DEPLOY_DIR, '.tmp', funcName)
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true })
  }
  fs.mkdirSync(tmpDir, { recursive: true })

  // Copy function files
  copyDir(funcDir, tmpDir)

  // Remove package.json if it exists (dependencies are bundled by uniCloud)
  // Keep index.js

  // Zip
  const zipCmd = `cd "${path.dirname(tmpDir)}" && zip -r "${zipFile}" "${funcName}"`
  try {
    execSync(zipCmd, { stdio: 'pipe' })
    const size = (fs.statSync(zipFile).size / 1024).toFixed(1)
    console.log(`✅ ${funcName}.zip (${size} KB)`)
  } catch (e) {
    console.error(`❌ ${funcName}: ${e.message}`)
  }

  // Cleanup
  fs.rmSync(path.join(DEPLOY_DIR, '.tmp'), { recursive: true, force: true })
})

console.log(`\n打包完成，文件在: ${DEPLOY_DIR}/`)
console.log('')
console.log('下一步：')
console.log('  1. 打开 uniCloud Web 控制台 → 云函数')
console.log('  2. 逐个函数点击「上传」选择对应 zip 文件')
console.log('  3. 注意：公共模块 common 无需单独部署，上传函数时会自动包含引用')
console.log('  4. 也可以复制全部云函数代码，在控制台在线编辑器中粘贴')

function copyDir(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true })
  entries.forEach(entry => {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true })
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  })
}
