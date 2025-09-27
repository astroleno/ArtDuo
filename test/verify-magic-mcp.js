#!/usr/bin/env node

/**
 * Magic MCP 验证脚本
 * 检查Magic MCP是否正确安装和配置
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 验证Magic MCP安装状态...\n');

// 检查配置文件
function checkConfigFile() {
    const configPath = path.join(process.env.HOME, '.claude', 'mcp_config.json');
    
    console.log('📁 检查配置文件:', configPath);
    
    if (!fs.existsSync(configPath)) {
        console.log('❌ MCP配置文件不存在');
        return false;
    }
    
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        if (!config.mcpServers || !config.mcpServers['@21st-dev/magic']) {
            console.log('❌ 配置文件中缺少Magic MCP服务器配置');
            return false;
        }
        
        const magicConfig = config.mcpServers['@21st-dev/magic'];
        
        // 检查配置项
        if (!magicConfig.command || magicConfig.command !== 'npx') {
            console.log('❌ 命令配置错误');
            return false;
        }
        
        if (!magicConfig.args || !magicConfig.args.includes('@21st-dev/magic@latest')) {
            console.log('❌ 参数配置错误');
            return false;
        }
        
        if (!magicConfig.env || !magicConfig.env.API_KEY) {
            console.log('❌ API密钥未配置');
            return false;
        }
        
        if (magicConfig.env.API_KEY === 'YOUR_API_KEY_HERE') {
            console.log('❌ 请设置真实的API密钥');
            return false;
        }
        
        console.log('✅ MCP配置文件正确');
        console.log('   - 命令:', magicConfig.command);
        console.log('   - 参数:', magicConfig.args.join(' '));
        console.log('   - API密钥:', magicConfig.env.API_KEY.substring(0, 8) + '...');
        
        return true;
    } catch (error) {
        console.log('❌ 配置文件格式错误:', error.message);
        return false;
    }
}

// 检查Node.js版本
function checkNodeVersion() {
    const version = process.version;
    const majorVersion = parseInt(version.substring(1).split('.')[0]);
    
    console.log('📦 检查Node.js版本:', version);
    
    if (majorVersion < 18) {
        console.log('❌ Node.js版本过低，需要 >= 18');
        return false;
    }
    
    console.log('✅ Node.js版本符合要求');
    return true;
}

// 检查npm和npx
function checkNpmNpx() {
    const { execSync } = require('child_process');
    
    try {
        const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
        console.log('📦 npm版本:', npmVersion);
        
        const npxVersion = execSync('npx --version', { encoding: 'utf8' }).trim();
        console.log('📦 npx版本:', npxVersion);
        
        console.log('✅ npm和npx可用');
        return true;
    } catch (error) {
        console.log('❌ npm或npx不可用:', error.message);
        return false;
    }
}

// 主验证函数
function main() {
    console.log('🚀 Magic MCP 安装验证\n');
    
    const checks = [
        { name: 'Node.js版本', fn: checkNodeVersion },
        { name: 'npm/npx可用性', fn: checkNpmNpx },
        { name: 'MCP配置文件', fn: checkConfigFile }
    ];
    
    let allPassed = true;
    
    for (const check of checks) {
        console.log(`\n🔍 ${check.name}:`);
        if (!check.fn()) {
            allPassed = false;
        }
    }
    
    console.log('\n' + '='.repeat(50));
    
    if (allPassed) {
        console.log('🎉 所有检查通过！Magic MCP已正确安装');
        console.log('\n📖 使用方法：');
        console.log('1. 重启Claude Code');
        console.log('2. 在聊天中输入 "/ui" 命令');
        console.log('3. 描述你想要的UI组件');
        console.log('4. Magic会自动生成对应的React组件');
        console.log('\n💡 示例：');
        console.log('/ui create a modern navigation bar with responsive design');
        console.log('/ui build a card component with image, title, and description');
    } else {
        console.log('❌ 部分检查失败，请根据上述提示修复问题');
        console.log('\n🔧 常见解决方案：');
        console.log('1. 确保已获取21st.dev Magic API密钥');
        console.log('2. 更新Node.js到最新版本');
        console.log('3. 重新运行安装脚本');
    }
}

main();
