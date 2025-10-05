#!/usr/bin/env node

/**
 * 简化的测试运行脚本
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎨 准备运行作品讲解系统测试...');

// 检查测试文件是否存在
const testFile = path.join(__dirname, 'test-artwork-explanation.ts');
if (!fs.existsSync(testFile)) {
  console.error('❌ 测试文件不存在:', testFile);
  process.exit(1);
}

console.log('✅ 测试文件存在');

// 尝试不同的运行方式
function runTest() {
  try {
    // 首先尝试使用 tsx
    console.log('🔄 尝试使用 tsx 运行测试...');
    execSync('npx tsx test-artwork-explanation.ts', {
      stdio: 'inherit',
      cwd: __dirname
    });
  } catch (error) {
    console.log('⚠️ tsx 运行失败，尝试使用 ts-node...');
    try {
      execSync('npx ts-node test-artwork-explanation.ts', {
        stdio: 'inherit',
        cwd: __dirname
      });
    } catch (error2) {
      console.log('⚠️ ts-node 运行失败，尝试使用 tsc + node...');
      try {
        // 先编译
        execSync('npx tsc test-artwork-explanation.ts --target es2020 --module commonjs --esModuleInterop --skipLibCheck', {
          stdio: 'inherit',
          cwd: __dirname
        });
        // 再运行
        execSync('node test-artwork-explanation.js', {
          stdio: 'inherit',
          cwd: __dirname
        });
      } catch (error3) {
        console.error('❌ 所有运行方式都失败了');
        console.error('\n请确保安装了以下依赖之一:');
        console.error('- tsx (推荐): npm install -g tsx');
        console.error('- ts-node: npm install -g ts-node');
        console.error('- typescript: npm install -g typescript');
        console.error('\n或者直接使用 Node.js 运行编译后的 JavaScript 文件');
        process.exit(1);
      }
    }
  }
}

runTest();