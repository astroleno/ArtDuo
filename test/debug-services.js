// 调试各个服务 - 检查为什么只有20件作品
const API_BASE = 'http://localhost:3002';

async function debugServices() {
  console.log('🔍 调试各个服务 - 检查为什么只有20件作品');
  console.log('=' * 60);
  
  try {
    // 直接测试各个API服务
    console.log('🧪 测试各个API服务...');
    
    // 测试Met Museum API
    console.log('\n1️⃣ 测试Met Museum API:');
    try {
      const metResponse = await fetch(`${API_BASE}/api/curate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emotion: 'joy',
          userInput: '快乐的色彩',
          debug: 'met_only'
        })
      });
      
      if (metResponse.ok) {
        const metData = await metResponse.json();
        console.log(`  ✅ Met Museum API: ${metData.artworks?.length || 0} 件作品`);
        if (metData.artworks && metData.artworks.length > 0) {
          console.log(`  📊 示例作品: "${metData.artworks[0].title}" by ${metData.artworks[0].artist}`);
        }
      } else {
        console.log(`  ❌ Met Museum API: ${metResponse.status} ${metResponse.statusText}`);
      }
    } catch (error) {
      console.log(`  ❌ Met Museum API 错误: ${error.message}`);
    }
    
    // 测试Rijks Museum API
    console.log('\n2️⃣ 测试Rijks Museum API:');
    try {
      const rijksResponse = await fetch(`${API_BASE}/api/curate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emotion: 'joy',
          userInput: '快乐的色彩',
          debug: 'rijks_only'
        })
      });
      
      if (rijksResponse.ok) {
        const rijksData = await rijksResponse.json();
        console.log(`  ✅ Rijks Museum API: ${rijksData.artworks?.length || 0} 件作品`);
        if (rijksData.artworks && rijksData.artworks.length > 0) {
          console.log(`  📊 示例作品: "${rijksData.artworks[0].title}" by ${rijksData.artworks[0].artist}`);
        }
      } else {
        console.log(`  ❌ Rijks Museum API: ${rijksResponse.status} ${rijksResponse.statusText}`);
      }
    } catch (error) {
      console.log(`  ❌ Rijks Museum API 错误: ${error.message}`);
    }
    
    // 测试完整流程
    console.log('\n3️⃣ 测试完整流程:');
    try {
      const fullResponse = await fetch(`${API_BASE}/api/curate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emotion: 'joy',
          userInput: '快乐的色彩'
        })
      });
      
      if (fullResponse.ok) {
        const fullData = await fullResponse.json();
        console.log(`  ✅ 完整流程: ${fullData.artworks?.length || 0} 件最终作品`);
        console.log(`  📊 总处理数量: ${fullData.diagnostics?.scoringResult?.totalProcessed || 0}`);
        console.log(`  📊 服务信息: ${fullData.serviceInfo?.current}`);
        console.log(`  📊 所有服务状态:`);
        if (fullData.serviceInfo?.allServices) {
          fullData.serviceInfo.allServices.forEach(service => {
            console.log(`    - ${service.name}: ${service.available ? '✅ 可用' : '❌ 不可用'}`);
          });
        }
      } else {
        console.log(`  ❌ 完整流程: ${fullResponse.status} ${fullResponse.statusText}`);
      }
    } catch (error) {
      console.log(`  ❌ 完整流程错误: ${error.message}`);
    }
    
    // 分析问题
    console.log('\n🔍 问题分析:');
    console.log('  可能的原因:');
    console.log('  1. Rijks Museum API可能没有返回作品');
    console.log('  2. 服务管理器可能只使用了第一个成功的服务');
    console.log('  3. 搜索关键词可能匹配的作品数量有限');
    console.log('  4. API服务的作品数量限制可能太小');
    
    console.log('\n💡 优化建议:');
    console.log('  1. 检查Rijks Museum API的配置和可用性');
    console.log('  2. 增加各个API服务的作品数量限制');
    console.log('  3. 优化搜索关键词以获取更多作品');
    console.log('  4. 确保服务管理器正确合并所有服务的结果');
    
  } catch (error) {
    console.error(`❌ 调试失败: ${error.message}`);
  }
}

// 运行调试
debugServices();
