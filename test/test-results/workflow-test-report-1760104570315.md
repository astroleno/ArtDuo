# ArtDuo Comprehensive Workflow Test Report

Generated: 2025-10-10T13:56:10.314Z

## Executive Summary

- **Total Tests:** 2
- **Passed:** 1
- **Failed:** 1
- **Success Rate:** 50%
- **Test Duration:** 273s

## Performance Overview


- **Average Duration:** 136658ms
- **Min Duration:** 90104ms
- **Max Duration:** 183212ms


## Quality Scores

- **emotionCurveQuality:** 100%
- **artworkQuality:** 100%
- **explanationQuality:** 88%

## Test Scenario Results

### Main Scenarios

| Scenario | Status | Duration | Issues |
|----------|--------|----------|---------|
| Simple Emotion - Joy | ❌ | 183212ms | 0 issues |
| Complex Emotion with User Input | ✅ | 90104ms | 0 issues |

### Error Scenarios

| Scenario | Status | Expected Error | Received Error |
|----------|--------|----------------|----------------|


## Detailed Results

<details>
<summary>Click to expand detailed test results</summary>

```json
{
  "startTime": "2025-10-10T13:51:36.989Z",
  "scenarios": [
    {
      "name": "Simple Emotion - Joy",
      "description": "Basic workflow with simple positive emotion",
      "emotion": "joy",
      "userInput": "",
      "method": "POST",
      "expectedEvents": [
        "start",
        "emotion_curve",
        "artworks_selected",
        "introduction",
        "conclusion",
        "explanations_batch",
        "complete"
      ],
      "performanceThresholds": {
        "totalDuration": 120000,
        "planDuration": 30000,
        "searchDuration": 45000,
        "scoringDuration": 60000
      },
      "startTime": "2025-10-10T13:51:36.994Z",
      "passed": false,
      "performance": {
        "totalDuration": 183212,
        "steps": {
          "emotionCurve": 2,
          "artworkSelection": 2,
          "introduction": 5091,
          "conclusion": 5408,
          "explanations": [
            {
              "batchIndex": 1,
              "duration": 47367,
              "count": 2
            },
            {
              "batchIndex": 2,
              "duration": 88174,
              "count": 2
            }
          ],
          "totalExplanationTime": 135541
        },
        "eventTiming": {
          "start": [
            0
          ],
          "emotion_curve": [
            47476
          ],
          "artworks_selected": [
            47476
          ],
          "introduction": [
            52566
          ],
          "conclusion": [
            57974
          ],
          "explanations_batch": [
            94843,
            183017
          ],
          "complete": [
            183017
          ]
        }
      },
      "validation": {
        "passed": true,
        "issues": [],
        "scores": {
          "emotionCurveQuality": 100,
          "artworkQuality": 100,
          "explanationQuality": 100
        },
        "details": {
          "eventCounts": {
            "start": 1,
            "emotion_curve": 1,
            "artworks_selected": 1,
            "introduction": 1,
            "conclusion": 1,
            "explanations_batch": 2,
            "complete": 1
          }
        }
      },
      "events": [
        {
          "type": "start",
          "payload": {
            "emotion": "joy",
            "userInput": ""
          },
          "timestamp": 1760104297186
        },
        {
          "type": "emotion_curve",
          "payload": {
            "curve": [
              0.7070231117150763,
              0.7140050771913016,
              0.7278870772606765,
              0.7415240046923713,
              0.7547960176777839,
              0.7675864812895874,
              0.7797829924736647,
              0.79127836785119,
              0.8019715856500153,
              0.8117686734876371,
              0.8205835342038726,
              0.8283387024857981,
              0.834966025635706,
              0.8404072624994612,
              0.844614595291859,
              0.8475510498210403,
              0.8491908204190185,
              0.8495194967228189,
              0.8485341903132658,
              0.846243560098514,
              0.8426677362192531,
              0.8378381431443072,
              0.8317972235112728,
              0.8245980651390935,
              0.8163039344903985,
              0.806987720683554,
              0.79673129494047,
              0.7856247910993589,
              0.7737658135153241,
              0.7612585793097785,
              0.7482130025066321,
              0.7347437281039011,
              0.7209691245693405,
              0.7070102436140943,
              0.6929897563859058,
              0.6790308754306595,
              0.6652562718960988,
              0.6517869974933678,
              0.6387414206902217,
              0.6262341864846758,
              0.6143752089006411,
              0.6032687050595301,
              0.5930122793164462,
              0.5836960655096014,
              0.5754019348609063,
              0.5682027764887271,
              0.5621618568556926,
              0.5573322637807469,
              0.553756439901486,
              0.5514658096867342,
              0.550480503277181,
              0.5508091795809813,
              0.5524489501789597,
              0.5553854047081408,
              0.5595927375005387,
              0.565033974364294,
              0.5716612975142018,
              0.5794164657961273,
              0.5882313265123625,
              0.5980284143499845,
              0.6087216321488098,
              0.620217007526335,
              0.6324135187104124,
              0.6452039823222159,
              0.6584759953076285,
              0.6721129227393233,
              0.6859949228086983,
              0.6929768882849237
            ],
            "description": "这个\"joy\"情绪曲线展现了情感的动态变化：情绪强度有适度的起伏变化，从55%到85%，创造出丰富的情绪层次。",
            "durationMs": 2
          },
          "timestamp": 1760104344662
        },
        {
          "type": "artworks_selected",
          "payload": {
            "artworks": [
              {
                "id": "437133",
                "title": "Garden at Sainte-Adresse",
                "artist": "Claude Monet",
                "year": "1867",
                "medium": "Oil on canvas",
                "imageUrl": "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop&auto=format&q=80",
                "description": "这是一件来自大都会艺术博物馆的珍贵作品。",
                "museum": "大都会艺术博物馆"
              },
              {
                "id": "436155",
                "title": "The Rehearsal of the Ballet Onstage",
                "artist": "Edgar Degas",
                "year": "ca. 1874",
                "medium": "Oil colors freely mixed with turpentine, with traces of watercolor and pastel over pen-and-ink drawing on cream-colored wove paper, laid down on bristol board and mounted on canvas",
                "imageUrl": "https://images.metmuseum.org/CRDImages/ep/original/DT1565.jpg",
                "description": "这是一件来自大都会艺术博物馆的珍贵作品。",
                "museum": "大都会艺术博物馆"
              },
              {
                "id": "671456",
                "title": "Chrysanthemums in the Garden at Petit-Gennevilliers",
                "artist": "Gustave Caillebotte",
                "year": "1893",
                "medium": "Oil on canvas",
                "imageUrl": "https://images.metmuseum.org/CRDImages/ep/original/DP341200.jpg",
                "description": "这是一件来自大都会艺术博物馆的珍贵作品。",
                "museum": "大都会艺术博物馆"
              },
              {
                "id": "436241",
                "title": "Cows Crossing a Ford",
                "artist": "Jules Dupré",
                "year": "1836",
                "medium": "Oil on canvas",
                "imageUrl": "https://images.metmuseum.org/CRDImages/ep/original/DP232030.jpg",
                "description": "这是一件来自大都会艺术博物馆的珍贵作品。",
                "museum": "大都会艺术博物馆"
              }
            ],
            "selectionReasoning": "基于情绪曲线选择最能体现情绪强度的作品",
            "diversityMetrics": {
              "artistCount": 4,
              "periodCount": 1,
              "mediumCount": 2,
              "avgScore": 6.126250000000001,
              "emotionFit": 5
            },
            "durationMs": 2
          },
          "timestamp": 1760104344662
        },
        {
          "type": "introduction",
          "payload": {
            "introduction": "\n**序言：喜悦的印记**\n\n\"Joy\"展览邀请观众踏上一场穿越时光的艺术之旅，探索喜悦如何通过色彩与构图被永恒捕捉。精心挑选的三幅杰作——莫奈《Garden at Sainte-Adresse》中跃动的阳光，德加",
            "durationMs": 5091
          },
          "timestamp": 1760104349752
        },
        {
          "type": "conclusion",
          "payload": {
            "conclusion": "\n本次\"joy\"展览以四件精妙作品，引领观众探索喜悦这一永恒情感的复杂光谱。作品间流动的情绪曲线，如同生命体验的微妙起伏，从0.707至0.693的细微变化，揭示喜悦并非恒定不变的狂喜，而是如同呼吸般的节奏与韵律。艺术家们",
            "durationMs": 5408
          },
          "timestamp": 1760104355160
        },
        {
          "type": "explanations_batch",
          "payload": {
            "batchIndex": 1,
            "batchSize": 2,
            "explanations": [
              {
                "artworkId": "437133",
                "title": "Garden at Sainte-Adresse",
                "artist": "Claude Monet",
                "emotionalConnection": "莫奈笔下的圣阿德resse花园，色彩明媚，洋溢着度假的喜悦氛围。",
                "artisticAnalysis": "这幅创作于1867年的作品展现了莫奈对光影变化的敏锐捕捉，明亮的色调和轻松的笔触完美传达了艺术家与家人共度假期的愉悦心情。作为印象派早期代表作，它不仅记录了19世纪中产阶级休闲生活的理想画面，也为印象派",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "莫奈笔下的圣阿德resse花园，色彩明媚，洋溢着度假的喜悦氛围。",
                  "artisticAnalysis": "这幅创作于1867年的作品展现了莫奈对光影变化的敏锐捕捉，明亮的色调和轻松的笔触完美传达了艺术家与家人共度假期的愉悦心情。作为印象派早期代表作，它不仅记录了19世纪中产阶级休闲生活的理想画面，也为印象派",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "莫奈笔下的圣阿德resse花园，色彩明媚，洋溢着度假的喜悦氛围。",
                  "detail": "这幅创作于1867年的作品展现了莫奈对光影变化的敏锐捕捉，明亮的色调和轻松的笔触完美传达了艺术家与家人共度假期的愉悦心情。作为印象派早期代表作，它不仅记录了19世纪中产阶级休闲生活的理想画面，也为印象派"
                },
                "confidence": 0.8,
                "processingTime": 21417,
                "introduction": "莫奈笔下的圣阿德resse花园，色彩明媚，洋溢着度假的喜悦氛围。",
                "detail": "这幅创作于1867年的作品展现了莫奈对光影变化的敏锐捕捉，明亮的色调和轻松的笔触完美传达了艺术家与家人共度假期的愉悦心情。作为印象派早期代表作，它不仅记录了19世纪中产阶级休闲生活的理想画面，也为印象派"
              },
              {
                "artworkId": "436155",
                "title": "The Rehearsal of the Ballet Onstage",
                "artist": "Edgar Degas",
                "emotionalConnection": "德加捕捉芭蕾舞者排练时的灵动与喜悦，展现印象派对动态美的独特诠释。",
                "artisticAnalysis": "这幅创作于1874年的作品体现了德加对芭蕾舞者世界的深入探索。艺术家巧妙运用混合媒介，以流畅的线条和明亮的色彩捕捉舞者排练时的专注与喜悦，展现了印象派对瞬间动态的敏锐捕捉。作为印象派运动的重要",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "德加捕捉芭蕾舞者排练时的灵动与喜悦，展现印象派对动态美的独特诠释。",
                  "artisticAnalysis": "这幅创作于1874年的作品体现了德加对芭蕾舞者世界的深入探索。艺术家巧妙运用混合媒介，以流畅的线条和明亮的色彩捕捉舞者排练时的专注与喜悦，展现了印象派对瞬间动态的敏锐捕捉。作为印象派运动的重要",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "德加捕捉芭蕾舞者排练时的灵动与喜悦，展现印象派对动态美的独特诠释。",
                  "detail": "这幅创作于1874年的作品体现了德加对芭蕾舞者世界的深入探索。艺术家巧妙运用混合媒介，以流畅的线条和明亮的色彩捕捉舞者排练时的专注与喜悦，展现了印象派对瞬间动态的敏锐捕捉。作为印象派运动的重要"
                },
                "confidence": 0.8,
                "processingTime": 16142,
                "introduction": "德加捕捉芭蕾舞者排练时的灵动与喜悦，展现印象派对动态美的独特诠释。",
                "detail": "这幅创作于1874年的作品体现了德加对芭蕾舞者世界的深入探索。艺术家巧妙运用混合媒介，以流畅的线条和明亮的色彩捕捉舞者排练时的专注与喜悦，展现了印象派对瞬间动态的敏锐捕捉。作为印象派运动的重要"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 47367,
            "isFirstBatch": true
          },
          "timestamp": 1760104392029
        },
        {
          "type": "explanations_batch",
          "payload": {
            "batchIndex": 2,
            "batchSize": 2,
            "explanations": [
              {
                "artworkId": "671456",
                "title": "Chrysanthemums in the Garden at Petit-Gennevilliers",
                "artist": "Gustave Caillebotte",
                "emotionalConnection": "卡耶博特以细腻笔触描绘花园菊花，传递宁静喜悦之美。",
                "artisticAnalysis": "这幅1893年作品展现了艺术家晚年对自然景观的热爱，鲜艳菊花与光影交织流露出内心愉悦。作为印象派重要成员，Caillebotte融合了现实主义与印象派风格，从工程师转型为画家的独特背景使他的视角既有精确性又有诗意。作品不仅记录了Petit-Gennevilliers小镇的田园风光，也反映了19世纪欧洲园艺文化的发展，以及东西方花卉交流的历史痕迹，成为印象派艺术中兼具个人情感与时代特色的代表作。",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "卡耶博特以细腻笔触描绘花园菊花，传递宁静喜悦之美。",
                  "artisticAnalysis": "这幅1893年作品展现了艺术家晚年对自然景观的热爱，鲜艳菊花与光影交织流露出内心愉悦。作为印象派重要成员，Caillebotte融合了现实主义与印象派风格，从工程师转型为画家的独特背景使他的视角既有精确性又有诗意。作品不仅记录了Petit-Gennevilliers小镇的田园风光，也反映了19世纪欧洲园艺文化的发展，以及东西方花卉交流的历史痕迹，成为印象派艺术中兼具个人情感与时代特色的代表作。",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "卡耶博特以细腻笔触描绘花园菊花，传递宁静喜悦之美。",
                  "detail": "这幅1893年作品展现了艺术家晚年对自然景观的热爱，鲜艳菊花与光影交织流露出内心愉悦。作为印象派重要成员，Caillebotte融合了现实主义与印象派风格，从工程师转型为画家的独特背景使他的视角既有精确性又有诗意。作品不仅记录了Petit-Gennevilliers小镇的田园风光，也反映了19世纪欧洲园艺文化的发展，以及东西方花卉交流的历史痕迹，成为印象派艺术中兼具个人情感与时代特色的代表作。"
                },
                "confidence": 0.8,
                "processingTime": 24941,
                "introduction": "卡耶博特以细腻笔触描绘花园菊花，传递宁静喜悦之美。",
                "detail": "这幅1893年作品展现了艺术家晚年对自然景观的热爱，鲜艳菊花与光影交织流露出内心愉悦。作为印象派重要成员，Caillebotte融合了现实主义与印象派风格，从工程师转型为画家的独特背景使他的视角既有精确性又有诗意。作品不仅记录了Petit-Gennevilliers小镇的田园风光，也反映了19世纪欧洲园艺文化的发展，以及东西方花卉交流的历史痕迹，成为印象派艺术中兼具个人情感与时代特色的代表作。"
              },
              {
                "artworkId": "436241",
                "title": "Cows Crossing a Ford",
                "artist": "Jules Dupré",
                "emotionalConnection": "在\"joy\"的心情下，Cows Crossing a Ford展现出特别的艺术魅力和情感深度。",
                "artisticAnalysis": "艺术家Jules Dupré，创作于1836，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "在\"joy\"的心情下，Cows Crossing a Ford展现出特别的艺术魅力和情感深度。",
                  "artisticAnalysis": "艺术家Jules Dupré，创作于1836，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "在\"joy\"的心情下，Cows Crossing a Ford展现出特别的艺术魅力和情感深度。",
                  "detail": "艺术家Jules Dupré，创作于1836，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
                },
                "confidence": 0.8,
                "processingTime": 22412,
                "introduction": "在\"joy\"的心情下，Cows Crossing a Ford展现出特别的艺术魅力和情感深度。",
                "detail": "艺术家Jules Dupré，创作于1836，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 88174
          },
          "timestamp": 1760104480203
        },
        {
          "type": "complete",
          "payload": {
            "elapsedMs": 183138
          },
          "timestamp": 1760104480203
        }
      ],
      "error": null,
      "endTime": "2025-10-10T13:54:40.207Z",
      "totalDuration": 183213
    },
    {
      "name": "Complex Emotion with User Input",
      "description": "Workflow with detailed user requirements",
      "emotion": "nostalgia",
      "userInput": "我想要寻找一些关于童年回忆和温暖家庭时光的艺术作品，希望能感受到那种纯真和怀旧的情感",
      "method": "POST",
      "expectedEvents": [
        "start",
        "emotion_curve",
        "artworks_selected",
        "introduction",
        "conclusion",
        "explanations_batch",
        "complete"
      ],
      "performanceThresholds": {
        "totalDuration": 150000,
        "planDuration": 35000,
        "searchDuration": 50000,
        "scoringDuration": 70000
      },
      "startTime": "2025-10-10T13:54:40.207Z",
      "passed": true,
      "performance": {
        "totalDuration": 90104,
        "steps": {
          "emotionCurve": 3,
          "artworkSelection": 1,
          "introduction": 7494,
          "conclusion": 4938,
          "explanations": [
            {
              "batchIndex": 1,
              "duration": 22237,
              "count": 2
            },
            {
              "batchIndex": 2,
              "duration": 27799,
              "count": 2
            }
          ],
          "totalExplanationTime": 50036
        },
        "eventTiming": {
          "start": [
            0
          ],
          "emotion_curve": [
            40047
          ],
          "artworks_selected": [
            40048
          ],
          "introduction": [
            47536
          ],
          "conclusion": [
            52468
          ],
          "explanations_batch": [
            62275,
            90080
          ],
          "complete": [
            90080
          ]
        }
      },
      "validation": {
        "passed": true,
        "issues": [],
        "scores": {
          "emotionCurveQuality": 100,
          "artworkQuality": 100,
          "explanationQuality": 75
        },
        "details": {
          "eventCounts": {
            "start": 1,
            "emotion_curve": 1,
            "artworks_selected": 1,
            "introduction": 1,
            "conclusion": 1,
            "explanations_batch": 2,
            "complete": 1
          }
        }
      },
      "events": [
        {
          "type": "start",
          "payload": {
            "emotion": "nostalgia",
            "userInput": "我想要寻找一些关于童年回忆和温暖家庭时光的艺术作品，希望能感受到那种纯真和怀旧的情感"
          },
          "timestamp": 1760104480227
        },
        {
          "type": "emotion_curve",
          "payload": {
            "curve": [
              0.5850381846688114,
              0.6244654375337043,
              0.6980839921929035,
              0.6913006075526157,
              0.6682075565349154,
              0.5831361837714114,
              0.5461113349821569,
              0.49104307122224716,
              0.5730749037142041,
              0.5400519985719928,
              0.6330480665015177,
              0.5475794652973669,
              0.5530423617376312,
              0.4559555221124965,
              0.5605773953511487,
              0.6632404775219601,
              0.7550035518931519,
              0.6516825056329119,
              0.6342536779490707,
              0.5577566466785705,
              0.5807397105943448,
              0.5514634651653928,
              0.5652001974158671,
              0.6477405792978154,
              0.5969004730588162,
              0.6524493883757018,
              0.6189148397164664,
              0.6874956863867826,
              0.6308448267823102,
              0.6377630447231626,
              0.6582518253942968,
              0.7182719141268409,
              0.718761960946478,
              0.7284836614158854,
              0.6765985430730755,
              0.7017986642213048,
              0.6544436617114967,
              0.6941545044657147,
              0.5856727796914124,
              0.6055740615143299,
              0.564706747143051,
              0.5638755683352764,
              0.5637670845203147,
              0.6147933926507431,
              0.696674830436402,
              0.7145351216088432,
              0.7275414903147084,
              0.7423813364470185,
              0.7298591556380805,
              0.7240625802180238,
              0.7094705747006188,
              0.7252598519849451,
              0.71200746427578,
              0.7351116126899829,
              0.7187002778723278,
              0.7306578567781011,
              0.7097554735261865,
              0.7010495811391607,
              0.6728630536477973,
              0.685149117845827,
              0.6898662490557229,
              0.7040868183784222,
              0.6756099390389596,
              0.6972069232068575,
              0.7215383642790659,
              0.7600355477783034,
              0.7470132027747906,
              0.7389588042113074
            ],
            "description": "这个\"nostalgia\"情绪曲线展现了情感的动态变化：情绪强度有适度的起伏变化，从46%到76%，创造出丰富的情绪层次。",
            "durationMs": 3
          },
          "timestamp": 1760104520274
        },
        {
          "type": "artworks_selected",
          "payload": {
            "artworks": [
              {
                "id": "436155",
                "title": "The Rehearsal of the Ballet Onstage",
                "artist": "Edgar Degas",
                "year": "ca. 1874",
                "medium": "Oil colors freely mixed with turpentine, with traces of watercolor and pastel over pen-and-ink drawing on cream-colored wove paper, laid down on bristol board and mounted on canvas",
                "imageUrl": "https://images.metmuseum.org/CRDImages/ep/original/DT1565.jpg",
                "description": "这是一件来自大都会艺术博物馆的珍贵作品。",
                "museum": "大都会艺术博物馆"
              },
              {
                "id": "839045",
                "title": "The Net Mender (Garnbinderen)",
                "artist": "Christian Krohg",
                "year": "1879",
                "medium": "Oil on canvas",
                "imageUrl": "https://images.metmuseum.org/CRDImages/ep/original/DP-19488-001.jpg",
                "description": "这是一件来自大都会艺术博物馆的珍贵作品。",
                "museum": "大都会艺术博物馆"
              },
              {
                "id": "438816",
                "title": "The Forest in Winter at Sunset",
                "artist": "Théodore Rousseau",
                "year": "ca. 1846–67",
                "medium": "Oil on canvas",
                "imageUrl": "https://images.metmuseum.org/CRDImages/ep/original/DP-31520-001.jpg",
                "description": "这是一件来自大都会艺术博物馆的珍贵作品。",
                "museum": "大都会艺术博物馆"
              },
              {
                "id": "437654",
                "title": "Circus Sideshow (Parade de cirque)",
                "artist": "Georges Seurat",
                "year": "1887–88",
                "medium": "Oil on canvas",
                "imageUrl": "https://images.metmuseum.org/CRDImages/ep/original/DP375450_cropped.jpg",
                "description": "这是一件来自大都会艺术博物馆的珍贵作品。",
                "museum": "大都会艺术博物馆"
              }
            ],
            "selectionReasoning": "基于情绪曲线选择最能体现情绪强度的作品",
            "diversityMetrics": {
              "artistCount": 4,
              "periodCount": 2,
              "mediumCount": 2,
              "avgScore": 6.034166666666668,
              "emotionFit": 5
            },
            "durationMs": 1
          },
          "timestamp": 1760104520275
        },
        {
          "type": "introduction",
          "payload": {
            "introduction": "\n**怀旧：时光深处的回响**\n\n欢迎来到\"怀旧\"展览，一场穿越时光的情感之旅。",
            "durationMs": 7494
          },
          "timestamp": 1760104527763
        },
        {
          "type": "conclusion",
          "payload": {
            "conclusion": "\n",
            "durationMs": 4938
          },
          "timestamp": 1760104532695
        },
        {
          "type": "explanations_batch",
          "payload": {
            "batchIndex": 1,
            "batchSize": 2,
            "explanations": [
              {
                "artworkId": "436155",
                "title": "The Rehearsal of the Ballet Onstage",
                "artist": "Edgar Degas",
                "emotionalConnection": "德加笔下芭蕾舞者的排练场景，捕捉纯真与怀旧交织的动人瞬间。",
                "artisticAnalysis": "德加以独特视角和细腻笔触，将芭蕾舞者的日常训练转化为充满诗意的艺术表达。作品不仅",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "德加笔下芭蕾舞者的排练场景，捕捉纯真与怀旧交织的动人瞬间。",
                  "artisticAnalysis": "德加以独特视角和细腻笔触，将芭蕾舞者的日常训练转化为充满诗意的艺术表达。作品不仅",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "德加笔下芭蕾舞者的排练场景，捕捉纯真与怀旧交织的动人瞬间。",
                  "detail": "德加以独特视角和细腻笔触，将芭蕾舞者的日常训练转化为充满诗意的艺术表达。作品不仅"
                },
                "confidence": 0.8,
                "processingTime": 16223,
                "introduction": "德加笔下芭蕾舞者的排练场景，捕捉纯真与怀旧交织的动人瞬间。",
                "detail": "德加以独特视角和细腻笔触，将芭蕾舞者的日常训练转化为充满诗意的艺术表达。作品不仅"
              },
              {
                "artworkId": "839045",
                "title": "The Net Mender (Garnbinderen)",
                "artist": "Christian Krohg",
                "emotionalConnection": "在\"nostalgia\"的心情下，The Net Mender (Garnbinderen)展现出特别的艺术魅力和情感深度。",
                "artisticAnalysis": "艺术家克里斯蒂安·克罗赫格（Christian Krohg），创作于一八七九年，采用油画布面（Oil on canvas）技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "在\"nostalgia\"的心情下，The Net Mender (Garnbinderen)展现出特别的艺术魅力和情感深度。",
                  "artisticAnalysis": "艺术家克里斯蒂安·克罗赫格（Christian Krohg），创作于一八七九年，采用油画布面（Oil on canvas）技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "在\"nostalgia\"的心情下，The Net Mender (Garnbinderen)展现出特别的艺术魅力和情感深度。",
                  "detail": "艺术家克里斯蒂安·克罗赫格（Christian Krohg），创作于一八七九年，采用油画布面（Oil on canvas）技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
                },
                "confidence": 0.8,
                "processingTime": 22169,
                "introduction": "在\"nostalgia\"的心情下，The Net Mender (Garnbinderen)展现出特别的艺术魅力和情感深度。",
                "detail": "艺术家克里斯蒂安·克罗赫格（Christian Krohg），创作于一八七九年，采用油画布面（Oil on canvas）技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 22237,
            "isFirstBatch": true
          },
          "timestamp": 1760104542502
        },
        {
          "type": "explanations_batch",
          "payload": {
            "batchIndex": 2,
            "batchSize": 2,
            "explanations": [
              {
                "artworkId": "438816",
                "title": "The Forest in Winter at Sunset",
                "artist": "Théodore Rousseau",
                "emotionalConnection": "冬日森林夕阳，卢梭(Rousseau)笔下温暖的怀旧景象。",
                "artisticAnalysis": "这幅",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "冬日森林夕阳，卢梭(Rousseau)笔下温暖的怀旧景象。",
                  "artisticAnalysis": "这幅",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "冬日森林夕阳，卢梭(Rousseau)笔下温暖的怀旧景象。",
                  "detail": "这幅"
                },
                "confidence": 0.8,
                "processingTime": 21182,
                "introduction": "冬日森林夕阳，卢梭(Rousseau)笔下温暖的怀旧景象。",
                "detail": "这幅"
              },
              {
                "artworkId": "437654",
                "title": "Circus Sideshow (Parade de cirque)",
                "artist": "Georges Seurat",
                "emotionalConnection": "在\"nostalgia\"的心情下，Circus Sideshow (Parade de cirque)展现出特别的艺术魅力和情感深度。",
                "artisticAnalysis": "艺术家Georges Seurat，创作于1887–88，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "在\"nostalgia\"的心情下，Circus Sideshow (Parade de cirque)展现出特别的艺术魅力和情感深度。",
                  "artisticAnalysis": "艺术家Georges Seurat，创作于1887–88，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "在\"nostalgia\"的心情下，Circus Sideshow (Parade de cirque)展现出特别的艺术魅力和情感深度。",
                  "detail": "艺术家Georges Seurat，创作于1887–88，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
                },
                "confidence": 0.8,
                "processingTime": 27764,
                "introduction": "在\"nostalgia\"的心情下，Circus Sideshow (Parade de cirque)展现出特别的艺术魅力和情感深度。",
                "detail": "艺术家Georges Seurat，创作于1887–88，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 27799
          },
          "timestamp": 1760104570307
        },
        {
          "type": "complete",
          "payload": {
            "elapsedMs": 90073
          },
          "timestamp": 1760104570307
        }
      ],
      "error": null,
      "endTime": "2025-10-10T13:56:10.313Z",
      "totalDuration": 90106
    }
  ],
  "errorScenarios": [],
  "summary": {
    "totalTests": 2,
    "passedTests": 1,
    "failedTests": 1,
    "successRate": 50,
    "performance": {
      "averageDuration": 136658,
      "minDuration": 90104,
      "maxDuration": 183212,
      "totalSamples": 2
    },
    "quality": {
      "emotionCurveQuality": 100,
      "artworkQuality": 100,
      "explanationQuality": 88
    },
    "testDuration": 273325
  },
  "config": {
    "baseUrl": "http://localhost:3000",
    "endpoint": "/api/curate/stream",
    "testResultsDir": "./test-results",
    "logLevel": "info",
    "timeout": 300000,
    "retryAttempts": 2,
    "retryDelay": 1000
  },
  "generatedAt": "2025-10-10T13:56:10.314Z"
}
```

</details>

## Recommendations

- Consider optimizing workflow to reduce average duration below 2 minutes
- Investigate scenarios with unusually high duration
- Address 1 failing test scenarios
