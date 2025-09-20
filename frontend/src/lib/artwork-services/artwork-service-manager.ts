// 艺术作品服务管理器 - 多级制度统一接口
import { ArtworkService, ArtworkServiceResponse } from './types';
import { MetMuseumMCPService } from './metmuseum-mcp';
import { MetMuseumAPIService } from './metmuseum-api';
import { FallbackService } from './fallback-service';

export class ArtworkServiceManager {
  private services: ArtworkService[];
  private currentServiceIndex: number = 0;

  constructor() {
    // 按优先级顺序初始化服务
    this.services = [
      new MetMuseumMCPService(),    // 首选：MCP服务
      new MetMuseumAPIService(),    // 降级：API服务
      new FallbackService()         // 最后：本地数据
    ];
  }

  async searchArtworks(emotion: string, userInput?: string, llmAnalysis?: any): Promise<ArtworkServiceResponse> {
    console.log('🎨 艺术作品服务管理器 - 开始搜索:', emotion, userInput);
    
    // 尝试每个服务，直到成功
    for (let i = 0; i < this.services.length; i++) {
      const service = this.services[i];
      const serviceName = this.getServiceName(service);
      
      try {
        console.log(`🔍 尝试服务 ${i + 1}/${this.services.length}: ${serviceName}`);
        
        // 检查服务是否可用
        const isAvailable = await service.isAvailable();
        if (!isAvailable) {
          console.log(`⚠️ 服务不可用: ${serviceName}`);
          continue;
        }
        
        console.log(`✅ 服务可用: ${serviceName}`);
        
        // 调用服务
        const result = await service.searchArtworks(emotion, userInput, llmAnalysis);
        
        if (result.success && result.artworks.length > 0) {
          console.log(`🎉 服务调用成功: ${serviceName}, 作品数量: ${result.artworks.length}`);
          this.currentServiceIndex = i; // 记录当前使用的服务
          return result;
        } else {
          console.log(`⚠️ 服务返回空结果: ${serviceName}`);
        }
      } catch (error) {
        console.error(`❌ 服务调用失败: ${serviceName}`, error);
        // 继续尝试下一个服务
      }
    }
    
    // 所有服务都失败了
    console.error('❌ 所有服务都失败了');
    throw new Error('所有艺术作品服务都不可用');
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

  private getServiceName(service: ArtworkService): string {
    // 通过构造函数名称获取服务名称
    const constructorName = service.constructor.name;
    
    switch (constructorName) {
      case 'MetMuseumMCPService':
        return 'Met Museum MCP';
      case 'MetMuseumAPIService':
        return 'Met Museum API';
      case 'FallbackService':
        return '本地数据';
      default:
        return constructorName;
    }
  }
}
