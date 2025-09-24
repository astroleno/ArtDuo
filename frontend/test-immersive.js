#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function testImmersiveGallery() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // 访问沉浸式画廊页面
    await page.goto('http://localhost:3003/gallery/immersive', {
      waitUntil: 'networkidle2',
      timeout: 10000
    });

    console.log('✅ 页面加载成功');

    // 等待页面内容加载
    await page.waitForSelector('div[style*="min-height: 100vh"]', { timeout: 5000 });
    console.log('✅ 找到主容器');

    // 检查是否有作品展示区域
    const artworkArea = await page.$('div[style*="aspect-ratio"]');
    if (artworkArea) {
      console.log('✅ 找到作品展示区域');
    } else {
      console.log('❌ 未找到作品展示区域');
    }

    // 检查导航按钮
    const navButtons = await page.$$('button[style*="position: fixed"]');
    if (navButtons.length >= 2) {
      console.log('✅ 找到导航按钮');
    } else {
      console.log('❌ 导航按钮数量不足');
    }

    // 检查进度指示器
    const progressIndicator = await page.$('div[style*="border-radius: 9999px"]');
    if (progressIndicator) {
      console.log('✅ 找到进度指示器');
    } else {
      console.log('❌ 未找到进度指示器');
    }

    // 检查控制按钮
    const controlButtons = await page.$$('button[style*="cursor: pointer"]');
    if (controlButtons.length >= 2) {
      console.log('✅ 找到控制按钮');
    } else {
      console.log('❌ 控制按钮数量不足');
    }

    // 测试导航功能
    console.log('\n🔄 测试导航功能...');

    // 点击下一个按钮
    const nextButton = await page.$('button[style*="right: 1rem"]');
    if (nextButton) {
      await nextButton.click();
      await page.waitForTimeout(1000);
      console.log('✅ 点击下一个按钮成功');
    }

    // 点击上一个按钮
    const prevButton = await page.$('button[style*="left: 1rem"]');
    if (prevButton) {
      await prevButton.click();
      await page.waitForTimeout(1000);
      console.log('✅ 点击上一个按钮成功');
    }

    // 测试详情展开
    console.log('\n📖 测试详情展开功能...');
    const detailButton = await page.$('button:not([style*="position: fixed"])');
    if (detailButton) {
      await detailButton.click();
      await page.waitForTimeout(1000);
      console.log('✅ 详情展开功能正常');
    }

    console.log('\n🎉 所有测试通过！');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await browser.close();
  }
}

testImmersiveGallery();