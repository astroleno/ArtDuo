# ArtDuo Comprehensive Workflow Test Report

Generated: 2025-10-12T15:12:56.279Z

## Executive Summary

- **Total Tests:** 2
- **Passed:** 1
- **Failed:** 1
- **Success Rate:** 50%
- **Test Duration:** 353s

## Performance Overview


- **Average Duration:** 176693ms
- **Min Duration:** 86821ms
- **Max Duration:** 266564ms


## Quality Scores

- **emotionCurveQuality:** 100%
- **artworkQuality:** 100%
- **explanationQuality:** 81%

## Test Scenario Results

### Main Scenarios

| Scenario | Status | Duration | Issues |
|----------|--------|----------|---------|
| Simple Emotion - Joy | ❌ | 266564ms | 0 issues |
| Complex Emotion with User Input | ✅ | 86821ms | 0 issues |

### Error Scenarios

| Scenario | Status | Expected Error | Received Error |
|----------|--------|----------------|----------------|


## Detailed Results

<details>
<summary>Click to expand detailed test results</summary>

```json
{
  "startTime": "2025-10-12T15:07:02.885Z",
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
      "startTime": "2025-10-12T15:07:02.892Z",
      "passed": false,
      "performance": {
        "totalDuration": 266564,
        "steps": {
          "emotionCurve": 2,
          "introduction": 5071,
          "conclusion": 3826,
          "explanations": [
            {
              "batchIndex": 1,
              "duration": 116098,
              "count": 2
            },
            {
              "batchIndex": 2,
              "duration": 93201,
              "count": 2
            }
          ],
          "totalExplanationTime": 209299
        },
        "eventTiming": {
          "start": [
            0
          ],
          "emotion_curve": [
            57192
          ],
          "artworks_selected": [
            57193
          ],
          "introduction": [
            62256
          ],
          "conclusion": [
            66082
          ],
          "explanations_batch": [
            173283,
            266488
          ],
          "complete": [
            266488
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
            "emotion": "joy",
            "userInput": ""
          },
          "timestamp": 1760281622965
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
          "timestamp": 1760281680157
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
            "durationMs": 0
          },
          "timestamp": 1760281680158
        },
        {
          "type": "introduction",
          "payload": {
            "introduction": "\n# \"Joy\" 展览序言\n\n在生活的喧嚣与沉寂之间，喜悦如一缕阳光，穿透心灵的阴霾。本次\"Joy\"展览，我们精选四件杰作，通过印象派大师们独特的明亮色彩与动态构图，捕捉生活中转瞬即逝的欢愉瞬间。\n\n莫奈的《圣阿德resse花园》中，湛蓝的海水与缤纷的花朵交织成视觉的盛宴；德加的《舞台上的芭蕾排练》以",
            "durationMs": 5071
          },
          "timestamp": 1760281685221
        },
        {
          "type": "conclusion",
          "payload": {
            "conclusion": "\n",
            "durationMs": 3826
          },
          "timestamp": 1760281689047
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
                "emotionalConnection": "莫奈笔下充满阳光与活力的海滨花园，捕捉了夏日午后的欢愉时光。",
                "artisticAnalysis": "这幅创作于1867年的作品展现了莫奈对光影的精湛捕捉，画面中明亮的色彩与轻松的氛围完美传达",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "莫奈笔下充满阳光与活力的海滨花园，捕捉了夏日午后的欢愉时光。",
                  "artisticAnalysis": "这幅创作于1867年的作品展现了莫奈对光影的精湛捕捉，画面中明亮的色彩与轻松的氛围完美传达",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "莫奈笔下充满阳光与活力的海滨花园，捕捉了夏日午后的欢愉时光。",
                  "detail": "这幅创作于1867年的作品展现了莫奈对光影的精湛捕捉，画面中明亮的色彩与轻松的氛围完美传达"
                },
                "confidence": 0.8,
                "processingTime": 18805,
                "introduction": "莫奈笔下充满阳光与活力的海滨花园，捕捉了夏日午后的欢愉时光。",
                "detail": "这幅创作于1867年的作品展现了莫奈对光影的精湛捕捉，画面中明亮的色彩与轻松的氛围完美传达"
              },
              {
                "artworkId": "436155",
                "title": "The Rehearsal of the Ballet Onstage",
                "artist": "Edgar Degas",
                "emotionalConnection": "德加捕捉芭蕾舞者排练的喜悦瞬间，展现印象派对动态美的追求。",
                "artisticAnalysis": "德加通过这幅作品将芭蕾舞者排练的日常场景转化为充满活力的视觉诗篇。画",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "德加捕捉芭蕾舞者排练的喜悦瞬间，展现印象派对动态美的追求。",
                  "artisticAnalysis": "德加通过这幅作品将芭蕾舞者排练的日常场景转化为充满活力的视觉诗篇。画",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "德加捕捉芭蕾舞者排练的喜悦瞬间，展现印象派对动态美的追求。",
                  "detail": "德加通过这幅作品将芭蕾舞者排练的日常场景转化为充满活力的视觉诗篇。画"
                },
                "confidence": 0.8,
                "processingTime": 29694,
                "introduction": "德加捕捉芭蕾舞者排练的喜悦瞬间，展现印象派对动态美的追求。",
                "detail": "德加通过这幅作品将芭蕾舞者排练的日常场景转化为充满活力的视觉诗篇。画"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 116098,
            "isFirstBatch": true
          },
          "timestamp": 1760281796248
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
                "emotionalConnection": "在\"joy\"的心情下，Chrysanthemums in the Garden at Petit-Gennevilliers展现出特别的艺术魅力和情感深度。",
                "artisticAnalysis": "艺术家Gustave Caillebotte，创作于1893，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "在\"joy\"的心情下，Chrysanthemums in the Garden at Petit-Gennevilliers展现出特别的艺术魅力和情感深度。",
                  "artisticAnalysis": "艺术家Gustave Caillebotte，创作于1893，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "在\"joy\"的心情下，Chrysanthemums in the Garden at Petit-Gennevilliers展现出特别的艺术魅力和情感深度。",
                  "detail": "艺术家Gustave Caillebotte，创作于1893，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
                },
                "confidence": 0.8,
                "processingTime": 29980,
                "introduction": "在\"joy\"的心情下，Chrysanthemums in the Garden at Petit-Gennevilliers展现出特别的艺术魅力和情感深度。",
                "detail": "艺术家Gustave Caillebotte，创作于1893，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
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
                "processingTime": 29732,
                "introduction": "在\"joy\"的心情下，Cows Crossing a Ford展现出特别的艺术魅力和情感深度。",
                "detail": "艺术家Jules Dupré，创作于1836，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 93201
          },
          "timestamp": 1760281889453
        },
        {
          "type": "complete",
          "payload": {
            "elapsedMs": 266490
          },
          "timestamp": 1760281889453
        }
      ],
      "error": null,
      "endTime": "2025-10-12T15:11:29.457Z",
      "totalDuration": 266565
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
      "startTime": "2025-10-12T15:11:29.457Z",
      "passed": true,
      "performance": {
        "totalDuration": 86821,
        "steps": {
          "emotionCurve": 1,
          "introduction": 6697,
          "conclusion": 3837,
          "explanations": [
            {
              "batchIndex": 1,
              "duration": 17338,
              "count": 2
            },
            {
              "batchIndex": 2,
              "duration": 28969,
              "count": 2
            }
          ],
          "totalExplanationTime": 46307
        },
        "eventTiming": {
          "start": [
            0
          ],
          "emotion_curve": [
            40501
          ],
          "artworks_selected": [
            40501
          ],
          "introduction": [
            47221
          ],
          "conclusion": [
            51044
          ],
          "explanations_batch": [
            57837,
            86808
          ],
          "complete": [
            86808
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
            "emotion": "nostalgia",
            "userInput": "我想要寻找一些关于童年回忆和温暖家庭时光的艺术作品，希望能感受到那种纯真和怀旧的情感"
          },
          "timestamp": 1760281889469
        },
        {
          "type": "emotion_curve",
          "payload": {
            "curve": [
              0.5692878675959395,
              0.602417013961385,
              0.6640895066385734,
              0.6527533080409555,
              0.644001302881584,
              0.5852634263330838,
              0.5508573672996996,
              0.5036534463352623,
              0.5839469600817427,
              0.541647278256565,
              0.6006199236458402,
              0.5545058495525517,
              0.6000095170693367,
              0.5459288600216408,
              0.5767676120831319,
              0.6172533636252667,
              0.6719329720801884,
              0.6468184353743852,
              0.630023967950703,
              0.5676839103305833,
              0.532680196500433,
              0.5335317165410314,
              0.5365523623792706,
              0.5959379138111675,
              0.5568491606955028,
              0.6351696987117702,
              0.6376829910104987,
              0.6777774809012255,
              0.5765053526398529,
              0.614882402472575,
              0.6538037787152183,
              0.7601515334036467,
              0.7352786616801962,
              0.7378962964645831,
              0.6710828855784073,
              0.6541546768243398,
              0.6404480712822087,
              0.7100310085917475,
              0.6484153061697139,
              0.6141910841039794,
              0.5099044558087732,
              0.5248727197827738,
              0.5631016115834481,
              0.6635573009848312,
              0.7489246531733841,
              0.7547068779686418,
              0.7629292217177793,
              0.7554866988515111,
              0.7590208598230572,
              0.7406506731415304,
              0.7220712712445104,
              0.698227529751875,
              0.7053815416218697,
              0.7209368985879715,
              0.7325273143952185,
              0.6973975361414214,
              0.6917924532746823,
              0.686785790185457,
              0.7289942929540731,
              0.7431132704401181,
              0.7532047943692944,
              0.7377742891041329,
              0.7110533686256711,
              0.6888142843029968,
              0.7014322916295658,
              0.7196480733717378,
              0.7099631325822965,
              0.6887519359610468
            ],
            "description": "这个\"nostalgia\"情绪曲线展现了情感的动态变化：情绪强度有适度的起伏变化，从50%到76%，创造出丰富的情绪层次。",
            "durationMs": 1
          },
          "timestamp": 1760281929970
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
                "id": "435848",
                "title": "The Birth of the Virgin",
                "artist": "Fra Carnevale (Bartolomeo di Giovanni Corradini)",
                "year": "1467",
                "medium": "Tempera and oil on wood",
                "imageUrl": "https://images.metmuseum.org/CRDImages/ep/original/DP109484.jpg",
                "description": "这是一件来自大都会艺术博物馆的珍贵作品。",
                "museum": "大都会艺术博物馆"
              },
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
              "periodCount": 2,
              "mediumCount": 3,
              "avgScore": 6.105,
              "emotionFit": 5
            },
            "durationMs": 0
          },
          "timestamp": 1760281929970
        },
        {
          "type": "introduction",
          "payload": {
            "introduction": "\n",
            "durationMs": 6697
          },
          "timestamp": 1760281936690
        },
        {
          "type": "conclusion",
          "payload": {
            "conclusion": "\n",
            "durationMs": 3837
          },
          "timestamp": 1760281940513
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
                "emotionalConnection": "德加捕捉芭蕾舞者排练瞬间，展现纯真与怀旧交织的艺术之美。",
                "artisticAnalysis": "德加通过细腻笔触将芭蕾舞者的排练场景定格，唤起观者对纯真时光的温暖回忆。这幅作品创作于印象派鼎盛时期，",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "德加捕捉芭蕾舞者排练瞬间，展现纯真与怀旧交织的艺术之美。",
                  "artisticAnalysis": "德加通过细腻笔触将芭蕾舞者的排练场景定格，唤起观者对纯真时光的温暖回忆。这幅作品创作于印象派鼎盛时期，",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "德加捕捉芭蕾舞者排练瞬间，展现纯真与怀旧交织的艺术之美。",
                  "detail": "德加通过细腻笔触将芭蕾舞者的排练场景定格，唤起观者对纯真时光的温暖回忆。这幅作品创作于印象派鼎盛时期，"
                },
                "confidence": 0.8,
                "processingTime": 17284,
                "introduction": "德加捕捉芭蕾舞者排练瞬间，展现纯真与怀旧交织的艺术之美。",
                "detail": "德加通过细腻笔触将芭蕾舞者的排练场景定格，唤起观者对纯真时光的温暖回忆。这幅作品创作于印象派鼎盛时期，"
              },
              {
                "artworkId": "435848",
                "title": "The Birth of the Virgin",
                "artist": "Fra Carnevale (Bartolomeo di Giovanni Corradini)",
                "emotionalConnection": "这幅文艺复兴杰作以细腻笔触描绘圣母诞生场景，传递温馨家庭氛围与纯真情感。",
                "artisticAnalysis": "作为文艺复兴时期的代表作，这幅作品通过柔和光影和细腻人物刻画，营造出宁静温馨的家庭氛围，唤起观者对纯",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "这幅文艺复兴杰作以细腻笔触描绘圣母诞生场景，传递温馨家庭氛围与纯真情感。",
                  "artisticAnalysis": "作为文艺复兴时期的代表作，这幅作品通过柔和光影和细腻人物刻画，营造出宁静温馨的家庭氛围，唤起观者对纯",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "这幅文艺复兴杰作以细腻笔触描绘圣母诞生场景，传递温馨家庭氛围与纯真情感。",
                  "detail": "作为文艺复兴时期的代表作，这幅作品通过柔和光影和细腻人物刻画，营造出宁静温馨的家庭氛围，唤起观者对纯"
                },
                "confidence": 0.8,
                "processingTime": 16265,
                "introduction": "这幅文艺复兴杰作以细腻笔触描绘圣母诞生场景，传递温馨家庭氛围与纯真情感。",
                "detail": "作为文艺复兴时期的代表作，这幅作品通过柔和光影和细腻人物刻画，营造出宁静温馨的家庭氛围，唤起观者对纯"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 17338,
            "isFirstBatch": true
          },
          "timestamp": 1760281947306
        },
        {
          "type": "explanations_batch",
          "payload": {
            "batchIndex": 2,
            "batchSize": 2,
            "explanations": [
              {
                "artworkId": "437133",
                "title": "Garden at Sainte-Adresse",
                "artist": "Claude Monet",
                "emotionalConnection": "在\"nostalgia\"的心情下，Garden at Sainte-Adresse展现出特别的艺术魅力和情感深度。",
                "artisticAnalysis": "艺术家Claude Monet，创作于1867，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "在\"nostalgia\"的心情下，Garden at Sainte-Adresse展现出特别的艺术魅力和情感深度。",
                  "artisticAnalysis": "艺术家Claude Monet，创作于1867，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "在\"nostalgia\"的心情下，Garden at Sainte-Adresse展现出特别的艺术魅力和情感深度。",
                  "detail": "艺术家Claude Monet，创作于1867，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
                },
                "confidence": 0.8,
                "processingTime": 28917,
                "introduction": "在\"nostalgia\"的心情下，Garden at Sainte-Adresse展现出特别的艺术魅力和情感深度。",
                "detail": "艺术家Claude Monet，创作于1867，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
              },
              {
                "artworkId": "436241",
                "title": "Cows Crossing a Ford",
                "artist": "Jules Dupré",
                "emotionalConnection": "牛群涉水过河的宁静场景，唤起对乡村纯真时光的怀旧情感。",
                "artisticAnalysis": "作为巴比松画派的代表作品，Dupré通过细腻笔触和自然光影处理，将平凡乡村场景转化为情感丰盈的艺术表达。画中牛群涉水的悠闲姿态，象征着人与自然的和谐共生，唤起观者对简单生活的向往与童年记忆的共鸣。这幅创作于1836年的作品，见证了19世纪法国乡村生活的真实面貌，体现了浪漫主义艺术对自然与情感的重视。在当代策展语境中，它被解读为对工业化前纯真时代的怀念，与您内心对温暖家庭时光和纯真童年的情感诉求形成深刻共鸣，成为连接过去与现在的情感桥梁",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "牛群涉水过河的宁静场景，唤起对乡村纯真时光的怀旧情感。",
                  "artisticAnalysis": "作为巴比松画派的代表作品，Dupré通过细腻笔触和自然光影处理，将平凡乡村场景转化为情感丰盈的艺术表达。画中牛群涉水的悠闲姿态，象征着人与自然的和谐共生，唤起观者对简单生活的向往与童年记忆的共鸣。这幅创作于1836年的作品，见证了19世纪法国乡村生活的真实面貌，体现了浪漫主义艺术对自然与情感的重视。在当代策展语境中，它被解读为对工业化前纯真时代的怀念，与您内心对温暖家庭时光和纯真童年的情感诉求形成深刻共鸣，成为连接过去与现在的情感桥梁",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "牛群涉水过河的宁静场景，唤起对乡村纯真时光的怀旧情感。",
                  "detail": "作为巴比松画派的代表作品，Dupré通过细腻笔触和自然光影处理，将平凡乡村场景转化为情感丰盈的艺术表达。画中牛群涉水的悠闲姿态，象征着人与自然的和谐共生，唤起观者对简单生活的向往与童年记忆的共鸣。这幅创作于1836年的作品，见证了19世纪法国乡村生活的真实面貌，体现了浪漫主义艺术对自然与情感的重视。在当代策展语境中，它被解读为对工业化前纯真时代的怀念，与您内心对温暖家庭时光和纯真童年的情感诉求形成深刻共鸣，成为连接过去与现在的情感桥梁"
                },
                "confidence": 0.8,
                "processingTime": 26630,
                "introduction": "牛群涉水过河的宁静场景，唤起对乡村纯真时光的怀旧情感。",
                "detail": "作为巴比松画派的代表作品，Dupré通过细腻笔触和自然光影处理，将平凡乡村场景转化为情感丰盈的艺术表达。画中牛群涉水的悠闲姿态，象征着人与自然的和谐共生，唤起观者对简单生活的向往与童年记忆的共鸣。这幅创作于1836年的作品，见证了19世纪法国乡村生活的真实面貌，体现了浪漫主义艺术对自然与情感的重视。在当代策展语境中，它被解读为对工业化前纯真时代的怀念，与您内心对温暖家庭时光和纯真童年的情感诉求形成深刻共鸣，成为连接过去与现在的情感桥梁"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 28969
          },
          "timestamp": 1760281976277
        },
        {
          "type": "complete",
          "payload": {
            "elapsedMs": 86807
          },
          "timestamp": 1760281976277
        }
      ],
      "error": null,
      "endTime": "2025-10-12T15:12:56.279Z",
      "totalDuration": 86822
    }
  ],
  "errorScenarios": [],
  "summary": {
    "totalTests": 2,
    "passedTests": 1,
    "failedTests": 1,
    "successRate": 50,
    "performance": {
      "averageDuration": 176693,
      "minDuration": 86821,
      "maxDuration": 266564,
      "totalSamples": 2
    },
    "quality": {
      "emotionCurveQuality": 100,
      "artworkQuality": 100,
      "explanationQuality": 81
    },
    "testDuration": 353394
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
  "generatedAt": "2025-10-12T15:12:56.279Z"
}
```

</details>

## Recommendations

- Consider optimizing workflow to reduce average duration below 2 minutes
- Investigate scenarios with unusually high duration
- Address 1 failing test scenarios
