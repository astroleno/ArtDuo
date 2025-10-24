# ArtDuo Comprehensive Workflow Test Report

Generated: 2025-10-13T01:55:46.156Z

## Executive Summary

- **Total Tests:** 2
- **Passed:** 0
- **Failed:** 2
- **Success Rate:** 0%
- **Test Duration:** 494s

## Performance Overview


- **Average Duration:** 246868ms
- **Min Duration:** 244080ms
- **Max Duration:** 249656ms


## Quality Scores

- **emotionCurveQuality:** 100%
- **artworkQuality:** 100%
- **explanationQuality:** 81%

## Test Scenario Results

### Main Scenarios

| Scenario | Status | Duration | Issues |
|----------|--------|----------|---------|
| Simple Emotion - Joy | ❌ | 249656ms | 0 issues |
| Complex Emotion with User Input | ❌ | 244080ms | 0 issues |

### Error Scenarios

| Scenario | Status | Expected Error | Received Error |
|----------|--------|----------------|----------------|


## Detailed Results

<details>
<summary>Click to expand detailed test results</summary>

```json
{
  "startTime": "2025-10-13T01:47:32.415Z",
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
      "startTime": "2025-10-13T01:47:32.417Z",
      "passed": false,
      "performance": {
        "totalDuration": 249656,
        "steps": {
          "emotionCurve": 1,
          "artworkSelection": 1,
          "introduction": 6763,
          "conclusion": 5245,
          "explanations": [
            {
              "batchIndex": 1,
              "duration": 55424,
              "count": 2
            },
            {
              "batchIndex": 2,
              "duration": 126926,
              "count": 2
            }
          ],
          "totalExplanationTime": 182350
        },
        "eventTiming": {
          "start": [
            0
          ],
          "emotion_curve": [
            67200
          ],
          "artworks_selected": [
            67200
          ],
          "introduction": [
            73963
          ],
          "conclusion": [
            79207
          ],
          "explanations_batch": [
            122624,
            249551
          ],
          "complete": [
            249552
          ]
        }
      },
      "validation": {
        "passed": true,
        "issues": [],
        "scores": {
          "emotionCurveQuality": 100,
          "artworkQuality": 100,
          "explanationQuality": 87
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
          "timestamp": 1760320052518
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
            "durationMs": 1
          },
          "timestamp": 1760320119718
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
            "durationMs": 1
          },
          "timestamp": 1760320119718
        },
        {
          "type": "introduction",
          "payload": {
            "introduction": "\n# 《喜悦之光》策展序言\n\n在这场名为\"喜悦\"的展览中，我们邀请观众沉浸在印象派艺术家捕捉的纯粹欢愉瞬间。莫奈《圣阿德resse花园》中跃动的光线与斑斓色彩，德加《舞台芭蕾排练》里舞者灵动的姿态与韵律，以及凯博特《花园中的菊花》中绽放的生命力，共同编织出一幅喜悦的视觉诗篇。这些杰作以其独特的明亮色调与动态构图，将生活中转",
            "durationMs": 6763
          },
          "timestamp": 1760320126481
        },
        {
          "type": "conclusion",
          "payload": {
            "conclusion": "\n",
            "durationMs": 5245
          },
          "timestamp": 1760320131725
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
                "emotionalConnection": "莫奈1867年创作的海滨花园，以明亮色彩捕捉夏日欢乐时光。",
                "artisticAnalysis": "这幅作品洋溢着莫奈标志性的欢乐情绪，通过鲜艳的色彩和明亮的阳光，完美捕捉了夏日花园的轻松氛围。作为印象派早期代表作，它展现了莫奈对光影变化的敏锐观察，以及如何通过色彩而非线条来表现自然景观",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "莫奈1867年创作的海滨花园，以明亮色彩捕捉夏日欢乐时光。",
                  "artisticAnalysis": "这幅作品洋溢着莫奈标志性的欢乐情绪，通过鲜艳的色彩和明亮的阳光，完美捕捉了夏日花园的轻松氛围。作为印象派早期代表作，它展现了莫奈对光影变化的敏锐观察，以及如何通过色彩而非线条来表现自然景观",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "莫奈1867年创作的海滨花园，以明亮色彩捕捉夏日欢乐时光。",
                  "detail": "这幅作品洋溢着莫奈标志性的欢乐情绪，通过鲜艳的色彩和明亮的阳光，完美捕捉了夏日花园的轻松氛围。作为印象派早期代表作，它展现了莫奈对光影变化的敏锐观察，以及如何通过色彩而非线条来表现自然景观"
                },
                "confidence": 0.8,
                "processingTime": 28755,
                "introduction": "莫奈1867年创作的海滨花园，以明亮色彩捕捉夏日欢乐时光。",
                "detail": "这幅作品洋溢着莫奈标志性的欢乐情绪，通过鲜艳的色彩和明亮的阳光，完美捕捉了夏日花园的轻松氛围。作为印象派早期代表作，它展现了莫奈对光影变化的敏锐观察，以及如何通过色彩而非线条来表现自然景观"
              },
              {
                "artworkId": "436155",
                "title": "The Rehearsal of the Ballet Onstage",
                "artist": "Edgar Degas",
                "emotionalConnection": "德加芭蕾舞彩排场景，捕捉舞者动态瞬间，印象派经典之作。",
                "artisticAnalysis": "德加的《舞台上的芭蕾彩排》展现了印象派对现代生活的关注，捕捉舞者排练时的动态与专注。作品通过松节油混合油彩、水彩",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "德加芭蕾舞彩排场景，捕捉舞者动态瞬间，印象派经典之作。",
                  "artisticAnalysis": "德加的《舞台上的芭蕾彩排》展现了印象派对现代生活的关注，捕捉舞者排练时的动态与专注。作品通过松节油混合油彩、水彩",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "德加芭蕾舞彩排场景，捕捉舞者动态瞬间，印象派经典之作。",
                  "detail": "德加的《舞台上的芭蕾彩排》展现了印象派对现代生活的关注，捕捉舞者排练时的动态与专注。作品通过松节油混合油彩、水彩"
                },
                "confidence": 0.8,
                "processingTime": 24296,
                "introduction": "德加芭蕾舞彩排场景，捕捉舞者动态瞬间，印象派经典之作。",
                "detail": "德加的《舞台上的芭蕾彩排》展现了印象派对现代生活的关注，捕捉舞者排练时的动态与专注。作品通过松节油混合油彩、水彩"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 55424,
            "isFirstBatch": true
          },
          "timestamp": 1760320175142
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
                "emotionalConnection": "卡耶博特晚期印象派杰作，花园菊花绽放，洋溢着宁静喜悦。",
                "artisticAnalysis": "卡耶博特的这幅晚期作品展现了他对自然与光影的独特",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "卡耶博特晚期印象派杰作，花园菊花绽放，洋溢着宁静喜悦。",
                  "artisticAnalysis": "卡耶博特的这幅晚期作品展现了他对自然与光影的独特",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "卡耶博特晚期印象派杰作，花园菊花绽放，洋溢着宁静喜悦。",
                  "detail": "卡耶博特的这幅晚期作品展现了他对自然与光影的独特"
                },
                "confidence": 0.8,
                "processingTime": 29674,
                "introduction": "卡耶博特晚期印象派杰作，花园菊花绽放，洋溢着宁静喜悦。",
                "detail": "卡耶博特的这幅晚期作品展现了他对自然与光影的独特"
              },
              {
                "artworkId": "436241",
                "title": "Cows Crossing a Ford",
                "artist": "Jules Dupré",
                "emotionalConnection": "杜普雷（Dupré）笔下的牛群渡河，洋溢着田园生活的喜悦与生机。",
                "artisticAnalysis": "这幅创作于1836年的油画展现了Dupré作为巴比松画派大师的独特视角。画家通过细腻的笔触和温暖的色调，捕捉了牛群涉水渡河时的动态与和谐",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "杜普雷（Dupré）笔下的牛群渡河，洋溢着田园生活的喜悦与生机。",
                  "artisticAnalysis": "这幅创作于1836年的油画展现了Dupré作为巴比松画派大师的独特视角。画家通过细腻的笔触和温暖的色调，捕捉了牛群涉水渡河时的动态与和谐",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "杜普雷（Dupré）笔下的牛群渡河，洋溢着田园生活的喜悦与生机。",
                  "detail": "这幅创作于1836年的油画展现了Dupré作为巴比松画派大师的独特视角。画家通过细腻的笔触和温暖的色调，捕捉了牛群涉水渡河时的动态与和谐"
                },
                "confidence": 0.8,
                "processingTime": 28725,
                "introduction": "杜普雷（Dupré）笔下的牛群渡河，洋溢着田园生活的喜悦与生机。",
                "detail": "这幅创作于1836年的油画展现了Dupré作为巴比松画派大师的独特视角。画家通过细腻的笔触和温暖的色调，捕捉了牛群涉水渡河时的动态与和谐"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 126926
          },
          "timestamp": 1760320302069
        },
        {
          "type": "complete",
          "payload": {
            "elapsedMs": 249559
          },
          "timestamp": 1760320302070
        }
      ],
      "error": null,
      "endTime": "2025-10-13T01:51:42.074Z",
      "totalDuration": 249657
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
      "startTime": "2025-10-13T01:51:42.074Z",
      "passed": false,
      "performance": {
        "totalDuration": 244080,
        "steps": {
          "emotionCurve": 2,
          "artworkSelection": 1,
          "introduction": 4118,
          "conclusion": 3323,
          "explanations": [
            {
              "batchIndex": 1,
              "duration": 47438,
              "count": 2
            },
            {
              "batchIndex": 2,
              "duration": 124962,
              "count": 2
            }
          ],
          "totalExplanationTime": 172400
        },
        "eventTiming": {
          "start": [
            0
          ],
          "emotion_curve": [
            71669
          ],
          "artworks_selected": [
            71669
          ],
          "introduction": [
            75784
          ],
          "conclusion": [
            79106
          ],
          "explanations_batch": [
            119103,
            244070
          ],
          "complete": [
            244070
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
          "timestamp": 1760320302084
        },
        {
          "type": "emotion_curve",
          "payload": {
            "curve": [
              0.5929201533343692,
              0.6332824614897491,
              0.7127263905529575,
              0.6939108853089432,
              0.6680960131799661,
              0.6036551176930024,
              0.5431999862682931,
              0.4858633895023004,
              0.518483696202327,
              0.5156092239509136,
              0.6088593732448141,
              0.5420231288999929,
              0.5757733387674445,
              0.5185795498554927,
              0.5940533121765218,
              0.6454966734226489,
              0.6850423775946238,
              0.6312671182602944,
              0.608184510838262,
              0.5664954434287695,
              0.5596671228214217,
              0.5634776610539537,
              0.555445412083369,
              0.6498744060054005,
              0.6130466590251826,
              0.6677790638585342,
              0.6216686545414777,
              0.6661694698242793,
              0.6207508270341139,
              0.6557817867612046,
              0.6529959351407438,
              0.7139319111967039,
              0.7192704620779239,
              0.719673048201045,
              0.6381462763746718,
              0.6150187961440238,
              0.6307520808672109,
              0.6953346527135077,
              0.6402135588981784,
              0.6588448004189079,
              0.5739878037090778,
              0.5890387606372807,
              0.5597373651884485,
              0.6461329658766357,
              0.7146156312502642,
              0.7178748038170477,
              0.6966648090281572,
              0.6849364127838061,
              0.6712707943054129,
              0.6684260555958703,
              0.6682000097172786,
              0.7028135103184686,
              0.718523174980906,
              0.6867573564580729,
              0.6794330442812546,
              0.6872870599373503,
              0.6901867519606945,
              0.6651803859660964,
              0.6649564962012274,
              0.6713709117490532,
              0.7063824276374371,
              0.720322520301937,
              0.7387957160196628,
              0.7225450787423142,
              0.7073606250751202,
              0.7195799305950814,
              0.7293887632105641,
              0.7436584297723298
            ],
            "description": "这个\"nostalgia\"情绪曲线展现了情感的动态变化：情绪强度有适度的起伏变化，从49%到74%，创造出丰富的情绪层次。",
            "durationMs": 2
          },
          "timestamp": 1760320373753
        },
        {
          "type": "artworks_selected",
          "payload": {
            "artworks": [
              {
                "id": "437422",
                "title": "Charity",
                "artist": "Guido Reni",
                "year": "ca. 1630",
                "medium": "Oil on canvas",
                "imageUrl": "https://images.metmuseum.org/CRDImages/ep/original/DT10776.jpg",
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
                "id": "437261",
                "title": "The Penitence of Saint Jerome",
                "artist": "Joachim Patinir",
                "year": "ca. 1515",
                "medium": "Oil on wood",
                "imageUrl": "https://images.metmuseum.org/CRDImages/ep/original/DT5549.jpg",
                "description": "这是一件来自大都会艺术博物馆的珍贵作品。",
                "museum": "大都会艺术博物馆"
              }
            ],
            "selectionReasoning": "基于情绪曲线选择最能体现情绪强度的作品",
            "diversityMetrics": {
              "artistCount": 4,
              "periodCount": 3,
              "mediumCount": 3,
              "avgScore": 6.012916666666667,
              "emotionFit": 5
            },
            "durationMs": 1
          },
          "timestamp": 1760320373753
        },
        {
          "type": "introduction",
          "payload": {
            "introduction": "\n**《怀旧：时光的回响》**\n\n怀旧，是人类共通的情感密码，牵引着我们回望纯真的",
            "durationMs": 4118
          },
          "timestamp": 1760320377868
        },
        {
          "type": "conclusion",
          "payload": {
            "conclusion": "\n",
            "durationMs": 3323
          },
          "timestamp": 1760320381190
        },
        {
          "type": "explanations_batch",
          "payload": {
            "batchIndex": 1,
            "batchSize": 2,
            "explanations": [
              {
                "artworkId": "437422",
                "title": "Charity",
                "artist": "Guido Reni",
                "emotionalConnection": "在1630年这个欧洲三十年战争动荡的年代，圭多·雷尼(Guido Reni)创作的《慈善》(Charity)如同一方宁静的避风港。",
                "artisticAnalysis": "巴洛克艺术盛行时期",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "在1630年这个欧洲三十年战争动荡的年代，圭多·雷尼(Guido Reni)创作的《慈善》(Charity)如同一方宁静的避风港。",
                  "artisticAnalysis": "巴洛克艺术盛行时期",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "在1630年这个欧洲三十年战争动荡的年代，圭多·雷尼(Guido Reni)创作的《慈善》(Charity)如同一方宁静的避风港。",
                  "detail": "巴洛克艺术盛行时期"
                },
                "confidence": 0.8,
                "processingTime": 16251,
                "introduction": "在1630年这个欧洲三十年战争动荡的年代，圭多·雷尼(Guido Reni)创作的《慈善》(Charity)如同一方宁静的避风港。",
                "detail": "巴洛克艺术盛行时期"
              },
              {
                "artworkId": "436241",
                "title": "Cows Crossing a Ford",
                "artist": "Jules Dupré",
                "emotionalConnection": "在\"nostalgia\"的心情下，Cows Crossing a Ford展现出特别的艺术魅力和情感深度。",
                "artisticAnalysis": "艺术家Jules Dupré，创作于1836，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "在\"nostalgia\"的心情下，Cows Crossing a Ford展现出特别的艺术魅力和情感深度。",
                  "artisticAnalysis": "艺术家Jules Dupré，创作于1836，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "在\"nostalgia\"的心情下，Cows Crossing a Ford展现出特别的艺术魅力和情感深度。",
                  "detail": "艺术家Jules Dupré，创作于1836，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
                },
                "confidence": 0.8,
                "processingTime": 25074,
                "introduction": "在\"nostalgia\"的心情下，Cows Crossing a Ford展现出特别的艺术魅力和情感深度。",
                "detail": "艺术家Jules Dupré，创作于1836，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 47438,
            "isFirstBatch": true
          },
          "timestamp": 1760320421187
        },
        {
          "type": "explanations_batch",
          "payload": {
            "batchIndex": 2,
            "batchSize": 2,
            "explanations": [
              {
                "artworkId": "436155",
                "title": "The Rehearsal of the Ballet Onstage",
                "artist": "Edgar Degas",
                "emotionalConnection": "在\"nostalgia\"的心情下，The Rehearsal of the Ballet Onstage展现出特别的艺术魅力和情感深度。",
                "artisticAnalysis": "艺术家Edgar Degas，创作于ca. 1874，采用Oil colors freely mixed with turpentine, with traces of watercolor and pastel over pen-and-ink drawing on cream-colored wove paper, laid down on bristol board and mounted on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "在\"nostalgia\"的心情下，The Rehearsal of the Ballet Onstage展现出特别的艺术魅力和情感深度。",
                  "artisticAnalysis": "艺术家Edgar Degas，创作于ca. 1874，采用Oil colors freely mixed with turpentine, with traces of watercolor and pastel over pen-and-ink drawing on cream-colored wove paper, laid down on bristol board and mounted on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "在\"nostalgia\"的心情下，The Rehearsal of the Ballet Onstage展现出特别的艺术魅力和情感深度。",
                  "detail": "艺术家Edgar Degas，创作于ca. 1874，采用Oil colors freely mixed with turpentine, with traces of watercolor and pastel over pen-and-ink drawing on cream-colored wove paper, laid down on bristol board and mounted on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
                },
                "confidence": 0.8,
                "processingTime": 27366,
                "introduction": "在\"nostalgia\"的心情下，The Rehearsal of the Ballet Onstage展现出特别的艺术魅力和情感深度。",
                "detail": "艺术家Edgar Degas，创作于ca. 1874，采用Oil colors freely mixed with turpentine, with traces of watercolor and pastel over pen-and-ink drawing on cream-colored wove paper, laid down on bristol board and mounted on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
              },
              {
                "artworkId": "437261",
                "title": "The Penitence of Saint Jerome",
                "artist": "Joachim Patinir",
                "emotionalConnection": "在\"怀旧\"的心情下",
                "artisticAnalysis": "艺术家Joachim Patinir，创作于ca. 1515，采用Oil on wood技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "在\"怀旧\"的心情下",
                  "artisticAnalysis": "艺术家Joachim Patinir，创作于ca. 1515，采用Oil on wood技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "在\"怀旧\"的心情下",
                  "detail": "艺术家Joachim Patinir，创作于ca. 1515，采用Oil on wood技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
                },
                "confidence": 0.8,
                "processingTime": 27851,
                "introduction": "在\"怀旧\"的心情下",
                "detail": "艺术家Joachim Patinir，创作于ca. 1515，采用Oil on wood技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 124962
          },
          "timestamp": 1760320546154
        },
        {
          "type": "complete",
          "payload": {
            "elapsedMs": 244066
          },
          "timestamp": 1760320546154
        }
      ],
      "error": null,
      "endTime": "2025-10-13T01:55:46.155Z",
      "totalDuration": 244081
    }
  ],
  "errorScenarios": [],
  "summary": {
    "totalTests": 2,
    "passedTests": 0,
    "failedTests": 2,
    "successRate": 0,
    "performance": {
      "averageDuration": 246868,
      "minDuration": 244080,
      "maxDuration": 249656,
      "totalSamples": 2
    },
    "quality": {
      "emotionCurveQuality": 100,
      "artworkQuality": 100,
      "explanationQuality": 81
    },
    "testDuration": 493741
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
  "generatedAt": "2025-10-13T01:55:46.156Z"
}
```

</details>

## Recommendations

- Consider optimizing workflow to reduce average duration below 2 minutes
- Investigate scenarios with unusually high duration
- Address 2 failing test scenarios
