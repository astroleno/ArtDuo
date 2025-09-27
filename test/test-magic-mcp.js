#!/usr/bin/env node

/**
 * Magic MCP 连接测试脚本
 * 用于验证21st.dev Magic MCP服务器是否正常工作
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 开始测试Magic MCP连接...\n');

// 测试MCP服务器启动
function testMCPServer() {
    return new Promise((resolve, reject) => {
        console.log('📡 启动Magic MCP服务器...');
        
        const mcpProcess = spawn('npx', ['-y', '@21st-dev/magic@latest'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                API_KEY: process.env.MAGIC_API_KEY || 'test-key'
            }
        });

        let output = '';
        let errorOutput = '';

        mcpProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        mcpProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        // 发送初始化请求
        setTimeout(() => {
            const initRequest = {
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: {
                        name: 'test-client',
                        version: '1.0.0'
                    }
                }
            };

            mcpProcess.stdin.write(JSON.stringify(initRequest) + '\n');
        }, 1000);

        // 等待响应
        setTimeout(() => {
            mcpProcess.kill();
            
            if (output.includes('jsonrpc') || output.includes('result')) {
                console.log('✅ MCP服务器响应正常');
                console.log('📤 服务器输出:', output.substring(0, 200) + '...');
                resolve(true);
            } else {
                console.log('❌ MCP服务器响应异常');
                console.log('📤 错误输出:', errorOutput);
                reject(new Error('MCP服务器启动失败'));
            }
        }, 3000);
    });
}

// 测试配置文件
function testConfigFile() {
    const configPath = path.join(process.env.HOME, '.claude', 'mcp_config.json');
    const fs = require('fs');
    
    console.log('📁 检查配置文件...');
    
    if (!fs.existsSync(configPath)) {
        console.log('❌ MCP配置文件不存在:', configPath);
        return false;
    }
    
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        if (!config.mcpServers || !config.mcpServers['@21st-dev/magic']) {
            console.log('❌ 配置文件中缺少Magic MCP服务器配置');
            return false;
        }
        
        console.log('✅ MCP配置文件格式正确');
        return true;
    } catch (error) {
        console.log('❌ MCP配置文件格式错误:', error.message);
        return false;
    }
}

// 主测试函数
async function runTests() {
    try {
        console.log('🔍 运行Magic MCP测试...\n');
        
        // 测试配置文件
        const configOk = testConfigFile();
        if (!configOk) {
            console.log('\n❌ 配置文件测试失败，请检查安装');
            process.exit(1);
        }
        
        // 测试MCP服务器
        await testMCPServer();
        
        console.log('\n🎉 所有测试通过！Magic MCP已正确安装');
        console.log('\n📖 使用方法：');
        console.log('1. 在Claude Code中输入 "/ui"');
        console.log('2. 描述你想要的UI组件');
        console.log('3. Magic会自动生成对应的React组件');
        
    } catch (error) {
        console.log('\n❌ 测试失败:', error.message);
        console.log('\n🔧 故障排除：');
        console.log('1. 确保已获取21st.dev Magic API密钥');
        console.log('2. 检查网络连接');
        console.log('3. 确保Node.js版本 >= 18');
        console.log('4. 重新运行安装脚本');
        process.exit(1);
    }
}

// 运行测试
runTests();
