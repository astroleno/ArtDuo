// 调试API返回数量 - 检查各个服务返回的作品数量
const API_BASE = 'http://localhost:3002';

async function debugAPICounts() {
  console.log('🔍 调试API返回数量 - 检查各个服务返回的作品数量');
  console.log('=' * 60);
  
  try {
    const response = await fetch(`${API_BASE}/api/curate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emotion: 'joy',
        userInput: '快乐的色彩'
      })
    });
    
    if (!response.ok) {
      console.log(`❌ API调用失败: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    
    console.log(`✅ API调用成功`);
    
    // 详细分析各个服务的返回情况
    console.log(`\n📊 服务返回分析:`);
    
    // 1. 检查服务信息
    if (data.serviceInfo) {
      console.log(`\n1️⃣ 服务信息:`);
      console.log(`  - 当前服务: ${data.serviceInfo.current}`);
      console.log(`  - 数据来源: ${data.serviceInfo.source}`);
      console.log(`  - 所有服务状态:`);
      if (data.serviceInfo.allServices) {
        data.serviceInfo.allServices.forEach(service => {
          console.log(`    - ${service.name}: ${service.available ? '✅ 可用' : '❌ 不可用'}`);
        });
      }
    }
    
    // 2. 检查评分结果
    if (data.diagnostics?.scoringResult) {
      const scoring = data.diagnostics.scoringResult;
      console.log(`\n2️⃣ 评分结果:`);
      console.log(`  - 总处理数量: ${scoring.totalProcessed}`);
      console.log(`  - 成功数量: ${scoring.successCount}`);
      console.log(`  - 失败数量: ${scoring.failureCount}`);
      console.log(`  - 评分耗时: ${scoring.scoringTime}ms`);
    }
    
    // 3. 检查最终结果
    console.log(`\n3️⃣ 最终结果:`);
    console.log(`  - 最终作品数量: ${data.artworks?.length || 0}`);
    console.log(`  - 策展主题: ${data.curation?.theme}`);
    console.log(`  - 总作品数: ${data.curation?.totalWorks}`);
    
    // 4. 分析问题
    console.log(`\n🔍 问题分析:`);
    
    const totalProcessed = data.diagnostics?.scoringResult?.totalProcessed || 0;
    const finalCount = data.artworks?.length || 0;
    
    console.log(`  - 总处理数量: ${totalProcessed}`);
    console.log(`  - 最终作品数量: ${finalCount}`);
    
    if (totalProcessed < 30) {
      console.log(`  ⚠️ 问题: 总处理数量偏少 (${totalProcessed} < 30)`);
      console.log(`    可能原因:`);
      console.log(`    1. API服务本身返回的作品数量有限`);
      console.log(`    2. 某个API服务调用失败`);
      console.log(`    3. 搜索关键词匹配的作品数量有限`);
    }
    
    // 5. 检查作品示例
    if (data.artworks && data.artworks.length > 0) {
      console.log(`\n4️⃣ 作品示例:`);
      data.artworks.slice(0, 3).forEach((artwork, index) => {
        console.log(`  ${index + 1}. "${artwork.title}" by ${artwork.artist} (${artwork.year})`);
        console.log(`     - 博物馆: ${artwork.museum}`);
        console.log(`     - 材质: ${artwork.medium}`);
        console.log(`     - 数据源: ${artwork.source || '未知'}`);
      });
    }
    
    // 6. 建议
    console.log(`\n💡 优化建议:`);
    
    if (totalProcessed < 30) {
      console.log(`  🔧 增加API服务返回的作品数量:`);
      console.log(`    1. 检查Met Museum API的maxResults设置`);
      console.log(`    2. 检查Rijks Museum API的slice限制`);
      console.log(`    3. 检查MCP服务的getArtworksWithLimit设置`);
      console.log(`    4. 考虑使用更宽泛的搜索关键词`);
    }
    
    if (finalCount < 9) {
      console.log(`  🔧 增加最终作品数量:`);
      console.log(`    1. 降低精选算法的最低评分要求`);
      console.log(`    2. 放宽多样性限制`);
      console.log(`    3. 增加目标作品数量`);
    }
    
  } catch (error) {
    console.error(`❌ 调试失败: ${error.message}`);
  }
}

// 运行调试
debugAPICounts();
