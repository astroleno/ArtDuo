// 艺术作品服务管理器 - 多级制度统一接口
import { ArtworkService, ArtworkServiceResponse } from './types';
import { MetMuseumAPIService } from './metmuseum-api';
import { RijksMuseumAPIService } from './rijksmuseum-api';
import { FallbackService } from './fallback-service';
import { MetMuseumMCPService } from './metmuseum-mcp';

export class ArtworkServiceManager {
  private services: ArtworkService[];
  private currentServiceIndex: number = 0;

  constructor() {
    const enableMCP = process.env.ENABLE_MCP_SERVICE === 'true' || process.env.NEXT_PUBLIC_ENABLE_MCP === 'true';

    this.services = [];

    if (enableMCP) {
      this.services.push(new MetMuseumMCPService()); // 可选：MCP 服务
    }

    // 官方 API 服务（按优先级排序）
    this.services.push(new MetMuseumAPIService());    // Met Museum 官方 API
    this.services.push(new RijksMuseumAPIService());  // Rijks Museum 官方 API
    // 移除本地数据服务，只使用真实API

    console.log('[ArtworkServiceManager] 服务初始化顺序:', this.services.map(service => service.constructor.name));
  }

  async searchArtworks(emotion: string, userInput?: string, llmAnalysis?: any): Promise<ArtworkServiceResponse> {
    console.log('🎨 艺术作品服务管理器 - 开始并发搜索:', emotion, userInput);
    
    // 过滤出可用的服务
    const availableServices: { service: ArtworkService; name: string }[] = [];
    for (const service of this.services) {
      const serviceName = this.getServiceName(service);
      try {
        const isAvailable = await service.isAvailable();
        if (isAvailable) {
          console.log(`✅ 服务可用: ${serviceName}`);
          availableServices.push({ service, name: serviceName });
        } else {
          console.log(`⚠️ 服务不可用: ${serviceName}`);
        }
      } catch (error) {
        console.error(`❌ 服务检查失败: ${serviceName}`, error);
      }
    }

    if (availableServices.length === 0) {
      console.error('❌ 没有可用的服务');
      throw new Error('所有艺术作品服务都不可用');
    }

    // 并发调用所有可用服务
    console.log(`🚀 并发调用 ${availableServices.length} 个服务`);
    const servicePromises = availableServices.map(async ({ service, name }) => {
      try {
        console.log(`🔍 调用服务: ${name}`);
        const result = await service.searchArtworks(emotion, userInput, llmAnalysis);
        console.log(`📊 ${name} 返回结果: ${result.success ? result.artworks.length : 0} 件作品`);
        return { success: true, result, serviceName: name };
      } catch (error) {
        console.error(`❌ ${name} 调用失败:`, error);
        return { success: false, error, serviceName: name };
      }
    });

    const results = await Promise.allSettled(servicePromises);
    
    // 合并所有成功的结果
    const allArtworks = [];
    const successfulServices = [];
    const failedServices = [];

    results.forEach((result, index) => {
      const serviceName = availableServices[index].name;
      console.log(`🔍 处理服务结果: ${serviceName}`);
      console.log(`🔍 结果状态: ${result.status}`);
      
      if (result.status === 'fulfilled') {
        console.log(`🔍 ${serviceName} 调用成功，结果:`, result.value);
        if (result.value.success) {
          const { result: serviceResult } = result.value;
          console.log(`🔍 ${serviceName} 服务结果:`, serviceResult);
          if (serviceResult.success) {
            console.log(`🔍 ${serviceName} 作品数组长度:`, serviceResult.artworks.length);
            console.log(`🔍 ${serviceName} 前3个作品:`, serviceResult.artworks.slice(0, 3));
            allArtworks.push(...serviceResult.artworks);
            successfulServices.push(serviceName);
            console.log(`✅ ${serviceName}: 贡献了 ${serviceResult.artworks.length} 件作品`);
          } else {
            failedServices.push(serviceName);
            console.log(`❌ ${serviceName}: 服务返回失败`);
          }
        } else {
          failedServices.push(serviceName);
          console.log(`❌ ${serviceName}: 调用失败，错误:`, result.value.error);
        }
      } else {
        failedServices.push(serviceName);
        console.log(`❌ ${serviceName}: 调用失败，错误:`, result.reason);
      }
    });

    if (allArtworks.length === 0) {
      console.warn('⚠️ 所有服务都返回空结果，使用降级服务');
      // 不抛出错误，而是返回空结果让降级服务处理
    }

    console.log(`🎉 并发调用完成: 总共获得 ${allArtworks.length} 件作品`);
    console.log(`✅ 成功服务: ${successfulServices.join(', ')}`);
    if (failedServices.length > 0) {
      console.log(`❌ 失败服务: ${failedServices.join(', ')}`);
    }

    // 记录当前使用的服务（使用第一个成功的服务）
    this.currentServiceIndex = this.services.findIndex(service => 
      this.getServiceName(service) === successfulServices[0]
    );

    // 生成合并后的策展信息
    const mergedCuration = this.generateMergedCuration(emotion, allArtworks, successfulServices);

    return {
      success: allArtworks.length > 0, // 只有当有作品时才标记为成功
      artworks: allArtworks,
      curation: mergedCuration,
      source: 'api' // 标记为API来源
    };
  }

  async getCurrentServiceInfo(): Promise<{ name: string; index: number; total: number }> {
    const serviceName = this.getServiceName(this.services[this.currentServiceIndex]);
    return {
      name: serviceName,
      index: this.currentServiceIndex,
      total: this.services.length
    };
  }

  async getAllServicesStatus(): Promise<Array<{ name: string; available: boolean }>> {
    const statuses = [];
    
    for (const service of this.services) {
      const name = this.getServiceName(service);
      const available = await service.isAvailable();
      statuses.push({ name, available });
    }
    
    return statuses;
  }

  private generateMergedCuration(emotion: string, artworks: any[], successfulServices: string[]): CurationInfo {
    // 生成合并后的策展信息
    const totalWorks = artworks.length;
    const sources = successfulServices.join(' + ');
    
    // 生成情绪曲线（基于作品数量）
    const emotionCurve = this.generateEmotionCurve(emotion, artworks);
    
    return {
      theme: emotion,
      description: `这是一个精心策划的艺术展览，展现了"${emotion}"这一主题的艺术表达。本次展览汇集了来自${sources}的${totalWorks}件精选作品，通过不同风格和时代的艺术作品，深入探索这一情感主题的丰富内涵。`,
      emotionCurve,
      totalWorks
    };
  }

  private generateEmotionCurve(emotion: string, artworks: any[]): number[] {
    const baseCurves = {
      '孤独': [0.2, 0.1, 0.3, 0.4, 0.2, 0.1, 0.3, 0.5, 0.4],
      '平静': [0.5, 0.6, 0.5, 0.4, 0.5, 0.6, 0.5, 0.4, 0.5],
      '激动': [0.9, 0.7, 0.8, 0.9, 0.6, 0.8, 0.9, 0.7, 0.8],
      '忧郁': [0.2, 0.1, 0.3, 0.4, 0.2, 0.1, 0.3, 0.5, 0.4],
      '喜悦': [0.8, 0.9, 0.7, 0.8, 0.9, 0.8, 0.7, 0.8, 0.9],
      '沉思': [0.3, 0.4, 0.2, 0.3, 0.5, 0.4, 0.3, 0.2, 0.4],
      'lonely': [0.2, 0.1, 0.3, 0.4, 0.2, 0.1, 0.3, 0.5, 0.4],
      'calm': [0.5, 0.6, 0.5, 0.4, 0.5, 0.6, 0.5, 0.4, 0.5],
      'excited': [0.9, 0.7, 0.8, 0.9, 0.6, 0.8, 0.9, 0.7, 0.8],
      'melancholy': [0.2, 0.1, 0.3, 0.4, 0.2, 0.1, 0.3, 0.5, 0.4],
      'joy': [0.8, 0.9, 0.7, 0.8, 0.9, 0.8, 0.7, 0.8, 0.9],
      'contemplative': [0.3, 0.4, 0.2, 0.3, 0.5, 0.4, 0.3, 0.2, 0.4]
    };

    let curve = baseCurves[emotion as keyof typeof baseCurves] || [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    
    // 根据实际作品数量调整曲线长度
    if (artworks.length < 9) {
      curve = curve.slice(0, artworks.length);
    } else if (artworks.length > 9) {
      const extendedCurve = [];
      for (let i = 0; i < artworks.length; i++) {
        extendedCurve.push(curve[i % curve.length]);
      }
      curve = extendedCurve;
    }
    
    return curve;
  }

  private getServiceName(service: ArtworkService): string {
    // 通过构造函数名称获取服务名称
    const constructorName = service.constructor.name;
    
    switch (constructorName) {
      case 'MetMuseumMCPService':
        return 'Met Museum MCP';
      case 'MetMuseumAPIService':
        return 'Met Museum API';
      case 'RijksMuseumAPIService':
        return 'Rijks Museum API';
      case 'FallbackService':
        return '本地数据';
      default:
        return constructorName;
    }
  }
}
