#!/usr/bin/env node

/**
 * GitHub Release 同步到 Gitee Release
 * 
 * 功能：
 * - 同步最新的 10 个 Release 版本
 * - 包含版本号、标题、简介等信息
 * - 同步附件文件
 * - 检测同版本号是否需要更新（对比简介和文件）
 * 
 * 使用方法：
 * 1. 设置环境变量或在 .env 文件中配置：
 *    GITHUB_TOKEN=your_github_token
 *    GITEE_TOKEN=your_gitee_token
 *    GITHUB_REPO=owner/repo
 *    GITEE_REPO=owner/repo
 * 
 * 2. 运行脚本：node github2gitee.js
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== 配置区域 ====================
const CONFIG = {
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  GITEE_TOKEN: process.env.GITEE_TOKEN || '',
  GITHUB_REPO: process.env.GITHUB_REPO || 'SXFreell/linglong-store',
  GITEE_REPO: process.env.GITEE_REPO || 'SXFreell/linglong-store',
  MAX_RELEASES: 10, // 同步最新的版本数量
  TEMP_DIR: path.join(__dirname, '.sync-temp'),
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 300MB 限制
};

// 验证配置
if (!CONFIG.GITHUB_TOKEN || !CONFIG.GITEE_TOKEN) {
  console.error('❌ 错误：缺少必要的 token 配置');
  console.error('请设置环境变量：GITHUB_TOKEN 和 GITEE_TOKEN');
  process.exit(1);
}

// ==================== 工具函数 ====================

/**
 * 发送 HTTP/HTTPS 请求
 */
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.request(url, options, (res) => {
      let data = '';
      let chunks = [];
      
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return request(res.headers.location, options).then(resolve).catch(reject);
      }
      
      res.on('data', chunk => {
        chunks.push(chunk);
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: options.returnBuffer ? Buffer.concat(chunks) : data,
            });
          } catch (error) {
            resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
          }
        } else {
          reject(new Error(`请求失败: ${res.statusCode} - ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      if (Buffer.isBuffer(options.body)) {
        req.write(options.body);
      } else if (typeof options.body === 'string') {
        req.write(options.body);
      } else {
        req.write(JSON.stringify(options.body));
      }
    }
    
    req.end();
  });
}

/**
 * GitHub API 请求
 */
async function githubRequest(endpoint, options = {}) {
  const url = `https://api.github.com${endpoint}`;
  const headers = {
    'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'GitHub-to-Gitee-Sync',
    ...options.headers,
  };
  
  const response = await request(url, { ...options, headers });
  return JSON.parse(response.body);
}

/**
 * Gitee API 请求
 */
async function giteeRequest(endpoint, options = {}) {
  const url = `https://gitee.com/api/v5${endpoint}`;
  const headers = {
    'Content-Type': 'application/json;charset=UTF-8',
    ...options.headers,
  };
  
  // Gitee 使用 access_token 作为参数
  const separator = endpoint.includes('?') ? '&' : '?';
  const fullUrl = `${url}${separator}access_token=${CONFIG.GITEE_TOKEN}`;
  
  const response = await request(fullUrl, { ...options, headers });
  return response.body ? JSON.parse(response.body) : null;
}

/**
 * 下载文件
 */
async function downloadFile(url, filepath) {
  console.log(`      正在下载...`);
  
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);
    
    const options = {
      headers: {
        'User-Agent': 'GitHub-to-Gitee-Sync',
        'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
        'Accept': 'application/octet-stream',
      }
    };
    
    protocol.get(url, options, (response) => {
      // 处理重定向
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(filepath);
        return downloadFile(response.headers.location, filepath).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(filepath);
        return reject(new Error(`下载失败: ${response.statusCode}`));
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
      
      file.on('error', (err) => {
        file.close();
        fs.unlink(filepath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      file.close();
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

/**
 * 上传文件到 Gitee Release
 * Gitee 使用标准的 multipart/form-data 格式
 */
async function uploadAssetToGiteeRelease(releaseId, filepath) {
  const filename = path.basename(filepath);
  const stats = fs.statSync(filepath);
  
  console.log(`      正在上传: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  
  return new Promise((resolve, reject) => {
    // 读取文件
    const fileStream = fs.createReadStream(filepath);
    const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}${Date.now()}`;
    
    // 构建 multipart/form-data
    const headerParts = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"`,
      'Content-Type: application/octet-stream',
      '',
      '',
    ].join('\r\n');
    
    const footerParts = `\r\n--${boundary}--\r\n`;
    
    const header = Buffer.from(headerParts);
    const footer = Buffer.from(footerParts);
    
    const contentLength = header.length + stats.size + footer.length;
    
    // 准备请求
    const url = `https://gitee.com/api/v5/repos/${CONFIG.GITEE_REPO}/releases/${releaseId}/attach_files?access_token=${CONFIG.GITEE_TOKEN}`;
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': contentLength,
      },
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (e) {
            resolve({ name: filename, size: stats.size });
          }
        } else {
          reject(new Error(`上传失败 (${res.statusCode}): ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    
    // 写入数据
    req.write(header);
    
    fileStream.on('data', chunk => {
      req.write(chunk);
    });
    
    fileStream.on('end', () => {
      req.write(footer);
      req.end();
    });
    
    fileStream.on('error', (err) => {
      req.destroy();
      reject(err);
    });
  });
}

/**
 * 确保临时目录存在
 */
function ensureTempDir() {
  if (!fs.existsSync(CONFIG.TEMP_DIR)) {
    fs.mkdirSync(CONFIG.TEMP_DIR, { recursive: true });
  }
}

/**
 * 清理临时目录
 */
function cleanupTempDir() {
  if (fs.existsSync(CONFIG.TEMP_DIR)) {
    fs.rmSync(CONFIG.TEMP_DIR, { recursive: true, force: true });
  }
}

// ==================== 核心功能 ====================

/**
 * 获取 GitHub Releases
 */
async function getGitHubReleases() {
  console.log(`📥 正在获取 GitHub 仓库 ${CONFIG.GITHUB_REPO} 的 Release...`);
  
  const releases = await githubRequest(`/repos/${CONFIG.GITHUB_REPO}/releases?per_page=${CONFIG.MAX_RELEASES}`);
  
  console.log(`✅ 获取到 ${releases.length} 个 Release`);
  return releases;
}

/**
 * 获取 Gitee Releases
 */
async function getGiteeReleases() {
  console.log(`📥 正在获取 Gitee 仓库 ${CONFIG.GITEE_REPO} 的 Release...`);
  
  try {
    const releases = await giteeRequest(`/repos/${CONFIG.GITEE_REPO}/releases?page=1&per_page=100`);
    console.log(`✅ 获取到 ${releases.length} 个 Release`);
    return releases;
  } catch (error) {
    console.log('⚠️  获取 Gitee Release 失败，可能是首次同步');
    return [];
  }
}

/**
 * 检查 Release 是否需要更新
 */
function needsUpdate(githubRelease, giteeRelease) {
  if (!giteeRelease) return true;
  
  // 对比 body（简介）
  const githubBody = (githubRelease.body || '').trim();
  const giteeBody = (giteeRelease.body || '').trim();
  
  if (githubBody !== giteeBody) {
    console.log(`  📝 简介不同，需要更新`);
    return true;
  }
  
  // 对比附件数量
  const githubAssets = githubRelease.assets || [];
  const giteeAssets = giteeRelease.assets || [];
  
  if (githubAssets.length !== giteeAssets.length) {
    console.log(`  📦 附件数量不同（GitHub: ${githubAssets.length}, Gitee: ${giteeAssets.length}），需要更新`);
    return true;
  }
  
  // 对比附件名称和大小
  const githubAssetMap = new Map(githubAssets.map(a => [a.name, a.size]));
  const giteeAssetMap = new Map(giteeAssets.map(a => [a.name, a.size]));
  
  for (const [name, size] of githubAssetMap) {
    if (!giteeAssetMap.has(name) || giteeAssetMap.get(name) !== size) {
      console.log(`  📦 附件 "${name}" 不同，需要更新`);
      return true;
    }
  }
  
  console.log(`  ✅ 版本 ${githubRelease.tag_name} 无需更新`);
  return false;
}

/**
 * 创建或更新 Gitee Release
 */
async function createOrUpdateGiteeRelease(githubRelease, giteeRelease) {
  const tagName = githubRelease.tag_name;
  
  console.log(`\n📦 处理 Release: ${tagName}`);
  
  // 检查是否需要更新
  if (giteeRelease && !needsUpdate(githubRelease, giteeRelease)) {
    return;
  }
  
  // 如果存在旧版本，先删除
  if (giteeRelease) {
    console.log(`  🗑️  删除旧版本 ${tagName}...`);
    try {
      await giteeRequest(`/repos/${CONFIG.GITEE_REPO}/releases/${giteeRelease.id}`, {
        method: 'DELETE',
      });
      console.log(`  ✅ 已删除旧版本`);
    } catch (error) {
      console.error(`  ❌ 删除失败: ${error.message}`);
    }
  }
  
  // 先创建 Release
  console.log(`  🚀 创建 Release...`);
  
  const releaseData = {
    tag_name: tagName,
    name: githubRelease.name || tagName,
    body: githubRelease.body || '',
    prerelease: githubRelease.prerelease || false,
    target_commitish: githubRelease.target_commitish || 'master',
  };
  
  let createdRelease;
  try {
    createdRelease = await giteeRequest(`/repos/${CONFIG.GITEE_REPO}/releases`, {
      method: 'POST',
      body: JSON.stringify(releaseData),
    });
    
    console.log(`  ✅ Release 创建成功 (ID: ${createdRelease.id})`);
    
  } catch (error) {
    console.error(`  ❌ 创建失败: ${error.message}`);
    
    // 如果是因为 tag 不存在导致失败，给出提示
    if (error.message.includes('tag') || error.message.includes('不存在')) {
      console.error(`  💡 提示: 请确保 Git Tag "${tagName}" 已经存在于 Gitee 仓库中`);
      console.error(`  💡 可以运行: git push gitee ${tagName}`);
    }
    
    throw error;
  }
  
  // 下载并上传附件
  const assets = githubRelease.assets || [];
  const uploadedAssets = [];
  
  if (assets.length > 0 && createdRelease && createdRelease.id) {
    console.log(`  📦 开始处理 ${assets.length} 个附件...`);
    ensureTempDir();
    
    for (const asset of assets) {
      try {
        console.log(`\n    📄 处理: ${asset.name} (${(asset.size / 1024 / 1024).toFixed(2)} MB)`);
        
        // 检查文件大小
        if (asset.size > CONFIG.MAX_FILE_SIZE) {
          console.warn(`      ⚠️  文件超过 ${CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB，跳过`);
          continue;
        }
        
        const tempFile = path.join(CONFIG.TEMP_DIR, asset.name);
        
        // 下载文件
        await downloadFile(asset.browser_download_url, tempFile);
        console.log(`      ✓ 下载完成`);
        
        // 上传到 Gitee Release，添加重试机制
        let uploaded = false;
        let retries = 3;
        let lastError = null;
        
        while (retries > 0 && !uploaded) {
          try {
            await uploadAssetToGiteeRelease(createdRelease.id, tempFile);
            uploadedAssets.push(asset.name);
            uploaded = true;
            console.log(`      ✓ 上传成功`);
          } catch (error) {
            lastError = error;
            retries--;
            if (retries > 0) {
              console.log(`      ⚠️  上传失败，${retries > 0 ? '重试中...' : '已放弃'} (剩余 ${retries} 次)`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
        
        if (!uploaded) {
          console.error(`      ✗ 上传失败: ${lastError?.message || '未知错误'}`);
        }
        
        // 删除临时文件
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
      } catch (error) {
        console.error(`      ✗ 处理失败: ${error.message}`);
      }
    }
    
    console.log(`\n  ✅ 附件处理完成: ${uploadedAssets.length}/${assets.length} 个成功上传`);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始同步 GitHub Release 到 Gitee\n');
  console.log(`GitHub 仓库: ${CONFIG.GITHUB_REPO}`);
  console.log(`Gitee 仓库: ${CONFIG.GITEE_REPO}`);
  console.log(`同步数量: 最新 ${CONFIG.MAX_RELEASES} 个版本\n`);
  
  try {
    // 获取 GitHub 和 Gitee 的 Releases
    const githubReleases = await getGitHubReleases();
    const giteeReleases = await getGiteeReleases();
    
    // 创建 Gitee Release 映射表
    const giteeReleaseMap = new Map(
      giteeReleases.map(r => [r.tag_name, r])
    );
    
    // 处理每个 GitHub Release
    for (const githubRelease of githubReleases) {
      const giteeRelease = giteeReleaseMap.get(githubRelease.tag_name);
      
      try {
        await createOrUpdateGiteeRelease(githubRelease, giteeRelease);
      } catch (error) {
        console.error(`❌ 处理 ${githubRelease.tag_name} 时出错: ${error.message}`);
        // 继续处理下一个
      }
    }
    
    console.log('\n✨ 同步完成！');
    
  } catch (error) {
    console.error('\n❌ 同步失败:', error.message);
    process.exit(1);
  } finally {
    // 清理临时文件
    cleanupTempDir();
  }
}

// 运行主函数
main().catch(console.error);
