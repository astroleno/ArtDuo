/**
 * 作品评价JSON Schema定义
 * 用于验证LLM输出的作品讲解格式
 */

export const artworkExplanationSchema = {
  type: "object",
  required: ["intro", "details"],
  properties: {
    intro: {
      type: "string",
      minLength: 10,
      maxLength: 50,
      description: "作品简介(10-50字)"
    },
    details: {
      type: "string", 
      minLength: 50,
      maxLength: 200,
      description: "详细讲解(50-200字)"
    }
  },
  additionalProperties: false
};

/**
 * 验证作品讲解JSON格式
 */
export function validateArtworkExplanation(data: any): { valid: boolean; errors?: string[] } {
  try {
    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['数据不是有效对象'] };
    }
    
    const required = ['intro', 'details'];
    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
      return { valid: false, errors: [`缺少必需字段: ${missing.join(', ')}`] };
    }
    
    if (typeof data.intro !== 'string' || data.intro.length < 10 || data.intro.length > 50) {
      return { valid: false, errors: ['intro必须是10-50字的字符串'] };
    }
    
    if (typeof data.details !== 'string' || data.details.length < 50 || data.details.length > 200) {
      return { valid: false, errors: ['details必须是50-200字的字符串'] };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, errors: [`验证错误: ${error}`] };
  }
}
