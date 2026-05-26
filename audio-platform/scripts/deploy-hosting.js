#!/usr/bin/env node
/**
 * 部署 H5 前端到 uniCloud 前端托管
 *
 * 前置条件:
 *   1. 执行 npm run build:h5 构建项目
 *   2. 在 uniCloud 控制台 → 前端托管 → 获取 Space ID 和 API Key
 *
 * 使用:
 *   SPACE_ID=xxx CLIENT_SECRET=xxx node scripts/deploy-hosting.js
 *
 * 或先设置环境变量:
 *   export UNICLOUD_SPACE_ID=xxx
 *   export UNICLOUD_CLIENT_SECRET=xxx
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const DIST_DIR = path.resolve(__dirname, '../dist/build/h5')
const SPACE_ID = process.env.SPACE_ID || process.env.UNICLOUD_SPACE_ID || ''
const CLIENT_SECRET = process.env.CLIENT_SECRET || process.env.UNICLOUD_CLIENT_SECRET || ''

if (!fs.existsSync(DIST_DIR)) {
  console.error('构建目录不存在，请先执行: npm run build:h5')
  process.exit(1)
}

if (!SPACE_ID || !CLIENT_SECRET) {
  console.log('══════════════════════════════════════════')
  console.log('  未配置凭证，无法自动上传')
  console.log('══════════════════════════════════════════')
  console.log('')
  console.log('手动上传方式:')
  console.log('')
  console.log('方法 1: uniCloud Web 控制台')
  console.log('  1. 访问 uniCloud 控制台 → 前端网页托管')
  console.log('  2. 上传目录: dist/build/h5/')
  console.log('')
  console.log('方法 2: 使用 CLI 凭证上传')
  console.log('  在 uniCloud 控制台 → 服务空间 → 空间设置')
  console.log('  获取 Space ID 和 Client Secret，然后:')
  console.log('')
  console.log('  SPACE_ID=xxx CLIENT_SECRET=xxx node scripts/deploy-hosting.js')
  console.log('')
  console.log('方法 3: 使用阿里云 OSS CLI')
  console.log('  前端托管底层是 OSS，可以用 ossutil 上传')
  console.log('')
  process.exit(0)
}

// Upload to uniCloud hosting
const BASE_URL = `https://api.bspapp.com/client`

async function main() {
  const files = walkDir(DIST_DIR)
  console.log(`找到 ${files.length} 个文件，开始上传...\n`)

  let uploaded = 0
  let failed = 0

  for (const file of files) {
    const relPath = path.relative(DIST_DIR, file)
    const content = fs.readFileSync(file)
    const key = `/__UNI__7821210/${relPath.replace(/\\/g, '/')}`

    const timestamp = Date.now()
    const signature = sign(key, CLIENT_SECRET, timestamp)

    try {
      const resp = await fetch(`${BASE_URL}/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Base-Space-Id': SPACE_ID,
          'X-Base-Timestamp': String(timestamp),
          'X-Base-Signature': signature
        },
        body: JSON.stringify({
          key,
          content: content.toString('base64')
        })
      })

      if (resp.ok) {
        uploaded++
        if (uploaded % 10 === 0) {
          console.log(`  已上传 ${uploaded}/${files.length} ...`)
        }
      } else {
        failed++
        console.error(`  ❌ ${relPath}: ${resp.status} ${await resp.text()}`)
      }
    } catch (e) {
      failed++
      console.error(`  ❌ ${relPath}: ${e.message}`)
    }
  }

  console.log(`\n上传完成: ${uploaded} 成功, ${failed} 失败`)
}

function sign(key, secret, timestamp) {
  const str = `${key}\n${timestamp}`
  return crypto.createHmac('sha256', secret).update(str).digest('hex')
}

function walkDir(dir) {
  const results = []
  const list = fs.readdirSync(dir, { withFileTypes: true })
  list.forEach(entry => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath))
    } else {
      results.push(fullPath)
    }
  })
  return results
}

if (SPACE_ID && CLIENT_SECRET) {
  main().catch(err => {
    console.error('部署失败:', err.message)
    process.exit(1)
  })
}
