/**
 * 策展意图JSON Schema定义 - 精简版
 * 只保留实际使用的字段，优化性能
 */

export const curationIntentSchema = {
  type: "object",
  required: [
    "curatorialTheme",
    "emotionalArc", 
    "emotionalStages"
  ],
  properties: {
    curatorialTheme: {
      type: "string",
      minLength: 5,
      maxLength: 100,
      description: "策展主题"
    },
    emotionalArc: {
      type: "string", 
      minLength: 5,
      maxLength: 50,
      description: "情绪弧线描述"
    },
    emotionalStages: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        required: ["stage", "emotion", "intensity", "artworkCount", "keywords"],
        properties: {
          stage: {
            type: "integer",
            minimum: 1,
            maximum: 5,
            description: "阶段序号"
          },
          emotion: {
            type: "string",
            minLength: 2,
            maxLength: 20,
            description: "情绪名称"
          },
          intensity: {
            type: "number",
            minimum: 0.1,
            maximum: 1.0,
            description: "情绪强度"
          },
          artworkCount: {
            type: "integer",
            minimum: 1,
            maximum: 12,
            description: "作品数量"
          },
          keywords: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: {
              type: "string",
              minLength: 2,
              maxLength: 20
            },
            description: "阶段关键词"
          }
        }
      },
      description: "情绪阶段数组"
    },
    visualFeatures: {
      type: "object",
      required: ["colorPalette", "mood"],
      properties: {
        colorPalette: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "string",
            minLength: 2,
            maxLength: 20
          },
          description: "色彩调色板"
        },
        mood: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "string",
            minLength: 2,
            maxLength: 20
          },
          description: "情绪氛围"
        }
      },
      description: "视觉特征"
    },
    aestheticPreferences: {
      type: "object",
      required: ["mediaTypes", "artStyles"],
      properties: {
        mediaTypes: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "string",
            minLength: 2,
            maxLength: 20
          },
          description: "媒介类型"
        },
        artStyles: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "string",
            minLength: 2,
            maxLength: 20
          },
          description: "艺术风格"
        }
      },
      description: "审美偏好"
    },
    narrativeTone: {
      type: "object",
      required: ["voice", "approach", "intimacy", "pacing", "perspective"],
      properties: {
        voice: {
          type: "string",
          minLength: 2,
          maxLength: 20,
          description: "声音语调"
        },
        approach: {
          type: "string",
          minLength: 2,
          maxLength: 20,
          description: "策展方法"
        },
        intimacy: {
          type: "string",
          minLength: 2,
          maxLength: 20,
          description: "亲密程度"
        },
        pacing: {
          type: "string",
          minLength: 2,
          maxLength: 20,
          description: "节奏控制"
        },
        perspective: {
          type: "string",
          minLength: 2,
          maxLength: 20,
          description: "视角选择"
        }
      },
      description: "叙事语气"
    }
  },
  additionalProperties: false
};

/**
 * 验证策展意图JSON格式
 */
export function validateCurationIntent(data: any): { valid: boolean; errors?: string[] } {
  try {
    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['数据不是有效对象'] };
    }
    
    const required = ['curatorialTheme', 'emotionalArc', 'emotionalStages'];
    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
      return { valid: false, errors: [`缺少必需字段: ${missing.join(', ')}`] };
    }
    
    if (!Array.isArray(data.emotionalStages) || data.emotionalStages.length === 0) {
      return { valid: false, errors: ['emotionalStages必须是非空数组'] };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, errors: [`验证错误: ${error}`] };
  }
}
