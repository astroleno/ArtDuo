/**
 * 策展意图JSON Schema定义
 * 用于验证LLM输出的策展意图格式
 */

export const curationIntentSchema = {
  type: "object",
  required: [
    "curatorialTheme",
    "emotionalArc", 
    "emotionalStages",
    "visualFeatures",
    "aestheticPreferences",
    "narrativeTone",
    "targetAudience",
    "keyMessages",
    "visualProgression",
    "emotionCurve"
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
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        required: ["stage", "emotion", "intensity", "description", "visualCharacteristics", "artworkCount", "keywords"],
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
          description: {
            type: "string",
            minLength: 5,
            maxLength: 100,
            description: "阶段描述"
          },
          visualCharacteristics: {
            type: "array",
            minItems: 1,
            maxItems: 5,
            items: {
              type: "string",
              minLength: 2,
              maxLength: 30
            },
            description: "视觉特征"
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
      required: ["colorPalette", "composition", "lighting", "mood", "texture"],
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
        composition: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "string",
            minLength: 2,
            maxLength: 20
          },
          description: "构图偏好"
        },
        lighting: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "string",
            minLength: 2,
            maxLength: 20
          },
          description: "光线设计"
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
        },
        texture: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "string",
            minLength: 2,
            maxLength: 20
          },
          description: "质感偏好"
        }
      },
      description: "视觉特征"
    },
    aestheticPreferences: {
      type: "object",
      required: ["mediaTypes", "artStyles", "timePeriods", "culturalContexts", "avoidElements"],
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
        },
        timePeriods: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "string",
            minLength: 2,
            maxLength: 20
          },
          description: "时代范围"
        },
        culturalContexts: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "string",
            minLength: 2,
            maxLength: 20
          },
          description: "文化背景"
        },
        avoidElements: {
          type: "array",
          minItems: 0,
          maxItems: 5,
          items: {
            type: "string",
            minLength: 2,
            maxLength: 20
          },
          description: "避免元素"
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
    },
    targetAudience: {
      type: "string",
      minLength: 5,
      maxLength: 100,
      description: "目标受众"
    },
    keyMessages: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "string",
        minLength: 5,
        maxLength: 100
      },
      description: "核心信息"
    },
    visualProgression: {
      type: "string",
      minLength: 10,
      maxLength: 200,
      description: "视觉进程"
    },
    emotionCurve: {
      type: "object",
      required: ["curveType", "totalDuration", "peakPoints", "transitionPoints"],
      properties: {
        curveType: {
          type: "string",
          enum: ["linear", "wave", "peak", "valley", "spiral", "custom"],
          description: "曲线类型"
        },
        totalDuration: {
          type: "integer",
          minimum: 20,
          maximum: 45,
          description: "总时长(分钟)"
        },
        peakPoints: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: {
            type: "object",
            required: ["time", "intensity", "description"],
            properties: {
              time: {
                type: "number",
                minimum: 0,
                maximum: 1,
                description: "时间点(0-1)"
              },
              intensity: {
                type: "number",
                minimum: 0.5,
                maximum: 1.0,
                description: "强度"
              },
              description: {
                type: "string",
                minLength: 5,
                maxLength: 50,
                description: "描述"
              }
            }
          },
          description: "峰值点"
        },
        transitionPoints: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: {
            type: "object",
            required: ["time", "description"],
            properties: {
              time: {
                type: "number",
                minimum: 0,
                maximum: 1,
                description: "时间点(0-1)"
              },
              description: {
                type: "string",
                minLength: 5,
                maxLength: 50,
                description: "描述"
              }
            }
          },
          description: "转换点"
        }
      },
      description: "情绪曲线"
    }
  },
  additionalProperties: false
};

/**
 * 验证策展意图JSON格式
 */
export function validateCurationIntent(data: any): { valid: boolean; errors?: string[] } {
  // 这里可以集成ajv进行验证
  // 暂时返回基本验证
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
