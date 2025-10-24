# ArtDuo Comprehensive Workflow Test Report

Generated: 2025-10-12T15:28:34.908Z

## Executive Summary

- **Total Tests:** 8
- **Passed:** 0
- **Failed:** 8
- **Success Rate:** 0%
- **Test Duration:** 815s

## Performance Overview


- **Average Duration:** 163000ms
- **Min Duration:** 106755ms
- **Max Duration:** 237974ms


## Quality Scores

- **emotionCurveQuality:** 100%
- **artworkQuality:** 100%
- **explanationQuality:** 72%

## Test Scenario Results

### Main Scenarios

| Scenario | Status | Duration | Issues |
|----------|--------|----------|---------|
| Simple Emotion - Joy | ❌ | 237974ms | 0 issues |
| Complex Emotion with User Input | ❌ | 172242ms | 0 issues |
| Negative Emotion Processing | ❌ | 148254ms | 0 issues |
| GET Method Test | ❌ | 149775ms | 0 issues |
| Minimal Input Test | ❌ | 106755ms | 0 issues |

### Error Scenarios

| Scenario | Status | Expected Error | Received Error |
|----------|--------|----------------|----------------|
| Missing Emotion | ❌ | Missing required field: emotion | Expected error but got successful response |
| Empty Request Body | ❌ | Missing required field: emotion | Expected error but got successful response |
| GET without Emotion | ❌ | Missing required field: emotion | Expected error but got successful response |

## Detailed Results

<details>
<summary>Click to expand detailed test results</summary>

```json
{
  "startTime": "2025-10-12T15:14:59.889Z",
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
      "startTime": "2025-10-12T15:14:59.892Z",
      "passed": false,
      "performance": {
        "totalDuration": 237974,
        "steps": {
          "emotionCurve": 4,
          "artworkSelection": 1,
          "introduction": 7124,
          "conclusion": 9521,
          "explanations": [
            {
              "batchIndex": 1,
              "duration": 125911,
              "count": 2
            },
            {
              "batchIndex": 2,
              "duration": 56828,
              "count": 2
            }
          ],
          "totalExplanationTime": 182739
        },
        "eventTiming": {
          "start": [
            0
          ],
          "emotion_curve": [
            55178
          ],
          "artworks_selected": [
            55178
          ],
          "introduction": [
            62302
          ],
          "conclusion": [
            71823
          ],
          "explanations_batch": [
            181092,
            237916
          ],
          "complete": [
            237917
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
          "timestamp": 1760282099947
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
            "durationMs": 4
          },
          "timestamp": 1760282155125
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
          "timestamp": 1760282155125
        },
        {
          "type": "introduction",
          "payload": {
            "introduction": "\n**喜悦之境：印象派的光彩与韵律**\n\n本次展览以\"喜悦\"为主题，精选三位印象派大师的经典之作，探索艺术如何捕捉生活中纯粹欢愉的瞬间。莫奈《Garden at Sainte-Adresse》中明亮的海滨花园，德加《The Rehearsal of the Ballet Onstage》里舞者灵动的姿态，以及卡耶博特《Chrysanthemums in the Garden at Petit-Gennevilliers》中绚烂的花朵，共同编织出一曲视觉的欢歌。这些作品通过印象派标志性的明亮色彩与动态构图，将喜悦这一抽象情感具象化为跃动的光斑、流动的线条与饱满的色调。它们不仅是对美的礼赞，更是对生命活力的",
            "durationMs": 7124
          },
          "timestamp": 1760282162249
        },
        {
          "type": "conclusion",
          "payload": {
            "conclusion": "\n",
            "durationMs": 9521
          },
          "timestamp": 1760282171770
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
                "emotionalConnection": "莫奈1867年创作的《圣阿德雷斯的花园》，展现明亮色彩与喜悦氛围。",
                "artisticAnalysis": "这幅作品创作于莫奈艺术生涯的关键时期，展现了他对光线和色彩的独特理解。画面中明亮的天空、湛蓝的海水和鲜艳的植物共同营造出一种欢快的氛围，完美呼应了画作所传达的喜悦情绪。莫奈通过大胆的",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "莫奈1867年创作的《圣阿德雷斯的花园》，展现明亮色彩与喜悦氛围。",
                  "artisticAnalysis": "这幅作品创作于莫奈艺术生涯的关键时期，展现了他对光线和色彩的独特理解。画面中明亮的天空、湛蓝的海水和鲜艳的植物共同营造出一种欢快的氛围，完美呼应了画作所传达的喜悦情绪。莫奈通过大胆的",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "莫奈1867年创作的《圣阿德雷斯的花园》，展现明亮色彩与喜悦氛围。",
                  "detail": "这幅作品创作于莫奈艺术生涯的关键时期，展现了他对光线和色彩的独特理解。画面中明亮的天空、湛蓝的海水和鲜艳的植物共同营造出一种欢快的氛围，完美呼应了画作所传达的喜悦情绪。莫奈通过大胆的"
                },
                "confidence": 0.8,
                "processingTime": 28373,
                "introduction": "莫奈1867年创作的《圣阿德雷斯的花园》，展现明亮色彩与喜悦氛围。",
                "detail": "这幅作品创作于莫奈艺术生涯的关键时期，展现了他对光线和色彩的独特理解。画面中明亮的天空、湛蓝的海水和鲜艳的植物共同营造出一种欢快的氛围，完美呼应了画作所传达的喜悦情绪。莫奈通过大胆的"
              },
              {
                "artworkId": "436155",
                "title": "The Rehearsal of the Ballet Onstage",
                "artist": "Edgar Degas",
                "emotionalConnection": "在\"喜悦\"（joy）的心情下，《舞台上的芭蕾排练》（The Rehearsal of the Ballet Onstage）展现出特别的艺术魅力和情感深度。",
                "artisticAnalysis": "艺术家Edgar Degas，创作于ca. 1874，采用Oil colors freely mixed with turpentine, with traces of watercolor and pastel over pen-and-ink drawing on cream-colored wove paper, laid down on bristol board and mounted on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "在\"喜悦\"（joy）的心情下，《舞台上的芭蕾排练》（The Rehearsal of the Ballet Onstage）展现出特别的艺术魅力和情感深度。",
                  "artisticAnalysis": "艺术家Edgar Degas，创作于ca. 1874，采用Oil colors freely mixed with turpentine, with traces of watercolor and pastel over pen-and-ink drawing on cream-colored wove paper, laid down on bristol board and mounted on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "在\"喜悦\"（joy）的心情下，《舞台上的芭蕾排练》（The Rehearsal of the Ballet Onstage）展现出特别的艺术魅力和情感深度。",
                  "detail": "艺术家Edgar Degas，创作于ca. 1874，采用Oil colors freely mixed with turpentine, with traces of watercolor and pastel over pen-and-ink drawing on cream-colored wove paper, laid down on bristol board and mounted on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
                },
                "confidence": 0.8,
                "processingTime": 28573,
                "introduction": "在\"喜悦\"（joy）的心情下，《舞台上的芭蕾排练》（The Rehearsal of the Ballet Onstage）展现出特别的艺术魅力和情感深度。",
                "detail": "艺术家Edgar Degas，创作于ca. 1874，采用Oil colors freely mixed with turpentine, with traces of watercolor and pastel over pen-and-ink drawing on cream-colored wove paper, laid down on bristol board and mounted on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 125911,
            "isFirstBatch": true
          },
          "timestamp": 1760282281039
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
                "processingTime": 25665,
                "introduction": "在\"joy\"的心情下，Chrysanthemums in the Garden at Petit-Gennevilliers展现出特别的艺术魅力和情感深度。",
                "detail": "艺术家Gustave Caillebotte，创作于1893，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
              },
              {
                "artworkId": "436241",
                "title": "Cows Crossing a Ford",
                "artist": "Jules Dupré",
                "emotionalConnection": "在\"joy\"的心情下，Cows Crossing a Ford展现出特别的艺术魅力和情感深度。",
                "artisticAnalysis": "艺术家朱尔斯·杜普雷（Jules Dupré），创作于一八三六年，采用布面油画（Oil on canvas）技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "在\"joy\"的心情下，Cows Crossing a Ford展现出特别的艺术魅力和情感深度。",
                  "artisticAnalysis": "艺术家朱尔斯·杜普雷（Jules Dupré），创作于一八三六年，采用布面油画（Oil on canvas）技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "在\"joy\"的心情下，Cows Crossing a Ford展现出特别的艺术魅力和情感深度。",
                  "detail": "艺术家朱尔斯·杜普雷（Jules Dupré），创作于一八三六年，采用布面油画（Oil on canvas）技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
                },
                "confidence": 0.8,
                "processingTime": 27384,
                "introduction": "在\"joy\"的心情下，Cows Crossing a Ford展现出特别的艺术魅力和情感深度。",
                "detail": "艺术家朱尔斯·杜普雷（Jules Dupré），创作于一八三六年，采用布面油画（Oil on canvas）技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 56828
          },
          "timestamp": 1760282337863
        },
        {
          "type": "complete",
          "payload": {
            "elapsedMs": 237918
          },
          "timestamp": 1760282337864
        }
      ],
      "error": null,
      "endTime": "2025-10-12T15:18:57.867Z",
      "totalDuration": 237975
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
      "startTime": "2025-10-12T15:18:57.867Z",
      "passed": false,
      "performance": {
        "totalDuration": 172242,
        "steps": {
          "introduction": 11835,
          "conclusion": 10216,
          "explanations": [
            {
              "batchIndex": 1,
              "duration": 91008,
              "count": 2
            },
            {
              "batchIndex": 2,
              "duration": 25047,
              "count": 2
            }
          ],
          "totalExplanationTime": 116055
        },
        "eventTiming": {
          "start": [
            0
          ],
          "emotion_curve": [
            56183
          ],
          "artworks_selected": [
            56183
          ],
          "introduction": [
            68020
          ],
          "conclusion": [
            78234
          ],
          "explanations_batch": [
            147189,
            172238
          ],
          "complete": [
            172238
          ]
        }
      },
      "validation": {
        "passed": true,
        "issues": [],
        "scores": {
          "emotionCurveQuality": 100,
          "artworkQuality": 100,
          "explanationQuality": 62
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
          "timestamp": 1760282337870
        },
        {
          "type": "emotion_curve",
          "payload": {
            "curve": [
              0.562892900030322,
              0.6227259705661458,
              0.6946916867019226,
              0.7206205301541418,
              0.7120844228229636,
              0.6561318901747815,
              0.6080298112421705,
              0.5177597283355078,
              0.5807534479495128,
              0.5630267002375966,
              0.6631506435764206,
              0.5804506705827959,
              0.5829423483279289,
              0.5136594442664123,
              0.5911320035247404,
              0.6353774064953915,
              0.6911572787113903,
              0.6016117187994138,
              0.6098790949766891,
              0.5558611689548628,
              0.5900451821850972,
              0.6210503921146874,
              0.6099607389301785,
              0.6764958239922895,
              0.5911924060649597,
              0.6538982632678311,
              0.6599104977906912,
              0.7127094573739877,
              0.6255986512638506,
              0.5901730136257269,
              0.6179919972468408,
              0.6853979173179953,
              0.7115486195485866,
              0.7063659995838495,
              0.6606876313183511,
              0.6739389981938761,
              0.6486466479014674,
              0.7265972790388172,
              0.6159157543300177,
              0.6177703097483338,
              0.5308929661418539,
              0.5366825579016602,
              0.562826160948746,
              0.6390046100261237,
              0.6996537709035485,
              0.6599372044553339,
              0.6411560777136657,
              0.6551630203064804,
              0.6536430702076699,
              0.6728145985896332,
              0.6649853819537915,
              0.6968661113686639,
              0.7128252690912493,
              0.7493426198969647,
              0.742202117950304,
              0.7212157387645242,
              0.7145490753190481,
              0.726538557316421,
              0.7266709645841455,
              0.6977992373063585,
              0.6853007080442772,
              0.6937309565290565,
              0.7305919764237344,
              0.7377900425557476,
              0.7295258571787052,
              0.6860205157422311,
              0.6854748589369696,
              0.6826015344240632
            ],
            "description": "这个\"nostalgia\"情绪曲线展现了情感的动态变化：情绪强度有适度的起伏变化，从51%到75%，创造出丰富的情绪层次。",
            "durationMs": 0
          },
          "timestamp": 1760282394053
        },
        {
          "type": "artworks_selected",
          "payload": {
            "artworks": [
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
                "id": "459027",
                "title": "Portrait of a Woman, Possibly a Nun of San Secondo; (verso) Scene in Grisaille",
                "artist": "Jacometto (Jacometto Veneziano)",
                "year": "ca. 1485–95",
                "medium": "Oil on wood; (verso: oil and gold on wood)",
                "imageUrl": "https://images.metmuseum.org/CRDImages/rl/original/DP221483.jpg",
                "description": "这是一件来自大都会艺术博物馆的珍贵作品。",
                "museum": "大都会艺术博物馆"
              }
            ],
            "selectionReasoning": "基于情绪曲线选择最能体现情绪强度的作品",
            "diversityMetrics": {
              "artistCount": 4,
              "periodCount": 3,
              "mediumCount": 3,
              "avgScore": 6.034166666666668,
              "emotionFit": 5
            },
            "durationMs": 0
          },
          "timestamp": 1760282394053
        },
        {
          "type": "introduction",
          "payload": {
            "introduction": "\n",
            "durationMs": 11835
          },
          "timestamp": 1760282405890
        },
        {
          "type": "conclusion",
          "payload": {
            "conclusion": "\n",
            "durationMs": 10216
          },
          "timestamp": 1760282416104
        },
        {
          "type": "explanations_batch",
          "payload": {
            "batchIndex": 1,
            "batchSize": 2,
            "explanations": [
              {
                "artworkId": "671456",
                "title": "Chrysanthemums in the Garden at Petit-Gennevilliers",
                "artist": "Gustave Caillebotte",
                "emotionalConnection": "简介：花园菊花画作捕捉。",
                "artisticAnalysis": "简介：花园菊花画作捕捉",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "简介：花园菊花画作捕捉。",
                  "artisticAnalysis": "简介：花园菊花画作捕捉",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "简介：花园菊花画作捕捉。",
                  "detail": "简介：花园菊花画作捕捉"
                },
                "confidence": 0.8,
                "processingTime": 16519,
                "introduction": "简介：花园菊花画作捕捉。",
                "detail": "简介：花园菊花画作捕捉"
              },
              {
                "artworkId": "839045",
                "title": "The Net Mender (Garnbinderen)",
                "artist": "Christian Krohg",
                "emotionalConnection": "在\"nostalgia\"的心情下，The Net Mender (Garnbinderen)展现出特别的艺术魅力和情感深度。",
                "artisticAnalysis": "艺术家Christian Krohg，创作于1879，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "在\"nostalgia\"的心情下，The Net Mender (Garnbinderen)展现出特别的艺术魅力和情感深度。",
                  "artisticAnalysis": "艺术家Christian Krohg，创作于1879，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "在\"nostalgia\"的心情下，The Net Mender (Garnbinderen)展现出特别的艺术魅力和情感深度。",
                  "detail": "艺术家Christian Krohg，创作于1879，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
                },
                "confidence": 0.8,
                "processingTime": 27729,
                "introduction": "在\"nostalgia\"的心情下，The Net Mender (Garnbinderen)展现出特别的艺术魅力和情感深度。",
                "detail": "艺术家Christian Krohg，创作于1879，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 91008,
            "isFirstBatch": true
          },
          "timestamp": 1760282485059
        },
        {
          "type": "explanations_batch",
          "payload": {
            "batchIndex": 2,
            "batchSize": 2,
            "explanations": [
              {
                "artworkId": "435848",
                "title": "The Birth of the Virgin",
                "artist": "Fra Carnevale (Bartolomeo di Giovanni Corradini)",
                "emotionalConnection": "在\"nostalgia\"的心情下，The Birth of the Virgin展现出特别的艺术魅力和情感深度。",
                "artisticAnalysis": "艺术家Fra Carnevale (Bartolomeo di Giovanni Corradini)，创作于1467，采用Tempera and oil on wood技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "在\"nostalgia\"的心情下，The Birth of the Virgin展现出特别的艺术魅力和情感深度。",
                  "artisticAnalysis": "艺术家Fra Carnevale (Bartolomeo di Giovanni Corradini)，创作于1467，采用Tempera and oil on wood技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "在\"nostalgia\"的心情下，The Birth of the Virgin展现出特别的艺术魅力和情感深度。",
                  "detail": "艺术家Fra Carnevale (Bartolomeo di Giovanni Corradini)，创作于1467，采用Tempera and oil on wood技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
                },
                "confidence": 0.8,
                "processingTime": 24989,
                "introduction": "在\"nostalgia\"的心情下，The Birth of the Virgin展现出特别的艺术魅力和情感深度。",
                "detail": "艺术家Fra Carnevale (Bartolomeo di Giovanni Corradini)，创作于1467，采用Tempera and oil on wood技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
              },
              {
                "artworkId": "459027",
                "title": "Portrait of a Woman, Possibly a Nun of San Secondo; (verso) Scene in Grisaille",
                "artist": "Jacometto (Jacometto Veneziano)",
                "emotionalConnection": "一位可能来自圣塞孔多的女性肖像，背面灰暗场景，传递深沉怀旧。",
                "artisticAnalysis": "这幅文艺复兴时期的肖像画展现了雅科梅托（Jacometto）精湛的细腻",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "一位可能来自圣塞孔多的女性肖像，背面灰暗场景，传递深沉怀旧。",
                  "artisticAnalysis": "这幅文艺复兴时期的肖像画展现了雅科梅托（Jacometto）精湛的细腻",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "一位可能来自圣塞孔多的女性肖像，背面灰暗场景，传递深沉怀旧。",
                  "detail": "这幅文艺复兴时期的肖像画展现了雅科梅托（Jacometto）精湛的细腻"
                },
                "confidence": 0.8,
                "processingTime": 18198,
                "introduction": "一位可能来自圣塞孔多的女性肖像，背面灰暗场景，传递深沉怀旧。",
                "detail": "这幅文艺复兴时期的肖像画展现了雅科梅托（Jacometto）精湛的细腻"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 25047
          },
          "timestamp": 1760282510108
        },
        {
          "type": "complete",
          "payload": {
            "elapsedMs": 172236
          },
          "timestamp": 1760282510108
        }
      ],
      "error": null,
      "endTime": "2025-10-12T15:21:50.111Z",
      "totalDuration": 172244
    },
    {
      "name": "Negative Emotion Processing",
      "description": "Testing workflow with complex negative emotion",
      "emotion": "melancholy",
      "userInput": "寻找一些能够表达内心深处忧伤和思考的作品",
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
        "totalDuration": 140000,
        "planDuration": 32000,
        "searchDuration": 48000,
        "scoringDuration": 65000
      },
      "startTime": "2025-10-12T15:21:50.111Z",
      "passed": false,
      "performance": {
        "totalDuration": 148254,
        "steps": {
          "emotionCurve": 1,
          "artworkSelection": 1,
          "introduction": 8168,
          "conclusion": 7024,
          "explanations": [
            {
              "batchIndex": 1,
              "duration": 61222,
              "count": 2
            },
            {
              "batchIndex": 2,
              "duration": 49053,
              "count": 2
            }
          ],
          "totalExplanationTime": 110275
        },
        "eventTiming": {
          "start": [
            0
          ],
          "emotion_curve": [
            37970
          ],
          "artworks_selected": [
            37970
          ],
          "introduction": [
            46135
          ],
          "conclusion": [
            53157
          ],
          "explanations_batch": [
            99188,
            148242
          ],
          "complete": [
            148242
          ]
        }
      },
      "validation": {
        "passed": true,
        "issues": [],
        "scores": {
          "emotionCurveQuality": 100,
          "artworkQuality": 100,
          "explanationQuality": 62
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
            "emotion": "melancholy",
            "userInput": "寻找一些能够表达内心深处忧伤和思考的作品"
          },
          "timestamp": 1760282510122
        },
        {
          "type": "emotion_curve",
          "payload": {
            "curve": [
              0.6355223880597014,
              0.6310447761194029,
              0.6220895522388059,
              0.6131343283582089,
              0.6041791044776119,
              0.5952238805970149,
              0.5862686567164179,
              0.5773134328358208,
              0.5683582089552238,
              0.5594029850746268,
              0.5504477611940298,
              0.5414925373134328,
              0.5325373134328358,
              0.5235820895522387,
              0.5146268656716417,
              0.5056716417910447,
              0.49671641791044774,
              0.48776119402985074,
              0.47880597014925375,
              0.46985074626865675,
              0.4608955223880597,
              0.4519402985074626,
              0.4429850746268656,
              0.4340298507462686,
              0.4250746268656716,
              0.4161194029850746,
              0.40835820895522384,
              0.40656716417910443,
              0.4107462686567163,
              0.4197014925373134,
              0.4286567164179104,
              0.4376119402985074,
              0.44656716417910447,
              0.45552238805970147,
              0.46447761194029846,
              0.47343283582089546,
              0.48238805970149246,
              0.49134328358208945,
              0.5002985074626866,
              0.5092537313432834,
              0.5182089552238806,
              0.5271641791044775,
              0.5361194029850745,
              0.5450746268656717,
              0.5540298507462686,
              0.5629850746268656,
              0.5719402985074626,
              0.5808955223880596,
              0.5898507462686566,
              0.5988059701492537,
              0.6077611940298507,
              0.6167164179104477,
              0.6256716417910447,
              0.6346268656716417,
              0.6435820895522387,
              0.6525373134328358,
              0.6614925373134328,
              0.6704477611940298,
              0.6794029850746268,
              0.6883582089552238,
              0.6973134328358208,
              0.7062686567164178,
              0.7152238805970148,
              0.7241791044776119,
              0.7331343283582089,
              0.7420895522388059,
              0.7510447761194029,
              0.7555223880597014
            ],
            "description": "这个\"melancholy\"情绪曲线展现了情感的动态变化：情绪强度有适度的起伏变化，从41%到76%，创造出丰富的情绪层次。",
            "durationMs": 1
          },
          "timestamp": 1760282548092
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
          "timestamp": 1760282548092
        },
        {
          "type": "introduction",
          "payload": {
            "introduction": "\n",
            "durationMs": 8168
          },
          "timestamp": 1760282556257
        },
        {
          "type": "conclusion",
          "payload": {
            "conclusion": "\n",
            "durationMs": 7024
          },
          "timestamp": 1760282563279
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
                "emotionalConnection": "在\"melancholy\"的心情下，Garden at Sainte-Adresse展现出特别的艺术魅力和情感深度。",
                "artisticAnalysis": "艺术家克劳德·莫奈（Claude Monet），创作于一八六七年，采用布面油画（Oil on canvas）技法。\n\n这是一件来自大",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "在\"melancholy\"的心情下，Garden at Sainte-Adresse展现出特别的艺术魅力和情感深度。",
                  "artisticAnalysis": "艺术家克劳德·莫奈（Claude Monet），创作于一八六七年，采用布面油画（Oil on canvas）技法。\n\n这是一件来自大",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "在\"melancholy\"的心情下，Garden at Sainte-Adresse展现出特别的艺术魅力和情感深度。",
                  "detail": "艺术家克劳德·莫奈（Claude Monet），创作于一八六七年，采用布面油画（Oil on canvas）技法。\n\n这是一件来自大"
                },
                "confidence": 0.8,
                "processingTime": 29986,
                "introduction": "在\"melancholy\"的心情下，Garden at Sainte-Adresse展现出特别的艺术魅力和情感深度。",
                "detail": "艺术家克劳德·莫奈（Claude Monet），创作于一八六七年，采用布面油画（Oil on canvas）技法。\n\n这是一件来自大"
              },
              {
                "artworkId": "436155",
                "title": "The Rehearsal of the Ballet Onstage",
                "artist": "Edgar Degas",
                "emotionalConnection": "简介：德加笔下芭蕾舞者排练场景。",
                "artisticAnalysis": "简介：德加笔下芭蕾舞者排练场景",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "简介：德加笔下芭蕾舞者排练场景。",
                  "artisticAnalysis": "简介：德加笔下芭蕾舞者排练场景",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "简介：德加笔下芭蕾舞者排练场景。",
                  "detail": "简介：德加笔下芭蕾舞者排练场景"
                },
                "confidence": 0.8,
                "processingTime": 23385,
                "introduction": "简介：德加笔下芭蕾舞者排练场景。",
                "detail": "简介：德加笔下芭蕾舞者排练场景"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 61222,
            "isFirstBatch": true
          },
          "timestamp": 1760282609310
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
                "emotionalConnection": "在这1893年的深秋，当印象派的余晖与世纪末的忧郁交织，Caillebotte。",
                "artisticAnalysis": "在这1893年的深秋，当印象派的余晖与世纪末的忧郁交织，Caillebotte",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "在这1893年的深秋，当印象派的余晖与世纪末的忧郁交织，Caillebotte。",
                  "artisticAnalysis": "在这1893年的深秋，当印象派的余晖与世纪末的忧郁交织，Caillebotte",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "在这1893年的深秋，当印象派的余晖与世纪末的忧郁交织，Caillebotte。",
                  "detail": "在这1893年的深秋，当印象派的余晖与世纪末的忧郁交织，Caillebotte"
                },
                "confidence": 0.8,
                "processingTime": 17944,
                "introduction": "在这1893年的深秋，当印象派的余晖与世纪末的忧郁交织，Caillebotte。",
                "detail": "在这1893年的深秋，当印象派的余晖与世纪末的忧郁交织，Caillebotte"
              },
              {
                "artworkId": "436241",
                "title": "Cows Crossing a Ford",
                "artist": "Jules Dupré",
                "emotionalConnection": "杜普雷(Dupré)的牛群涉水油画，以忧郁色调",
                "artisticAnalysis": "Dupré通过这幅作品将自然景观与人类情感巧妙融合，牛群缓慢涉水的姿态象征着生命旅程中的沉思与坚韧。作为巴比松画派的代表人物，Dupré以其独特的忧郁色调和笔触，开创了19世纪法国风景画的新方向，影响了后来的印象派发展。这幅作品不仅是对乡村生活的忠实记录，更是艺术家内心忧伤情绪的外在表达，与观众寻找内心平静与思考的审美需求形成共鸣，",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "杜普雷(Dupré)的牛群涉水油画，以忧郁色调",
                  "artisticAnalysis": "Dupré通过这幅作品将自然景观与人类情感巧妙融合，牛群缓慢涉水的姿态象征着生命旅程中的沉思与坚韧。作为巴比松画派的代表人物，Dupré以其独特的忧郁色调和笔触，开创了19世纪法国风景画的新方向，影响了后来的印象派发展。这幅作品不仅是对乡村生活的忠实记录，更是艺术家内心忧伤情绪的外在表达，与观众寻找内心平静与思考的审美需求形成共鸣，",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "杜普雷(Dupré)的牛群涉水油画，以忧郁色调",
                  "detail": "Dupré通过这幅作品将自然景观与人类情感巧妙融合，牛群缓慢涉水的姿态象征着生命旅程中的沉思与坚韧。作为巴比松画派的代表人物，Dupré以其独特的忧郁色调和笔触，开创了19世纪法国风景画的新方向，影响了后来的印象派发展。这幅作品不仅是对乡村生活的忠实记录，更是艺术家内心忧伤情绪的外在表达，与观众寻找内心平静与思考的审美需求形成共鸣，"
                },
                "confidence": 0.8,
                "processingTime": 21827,
                "introduction": "杜普雷(Dupré)的牛群涉水油画，以忧郁色调",
                "detail": "Dupré通过这幅作品将自然景观与人类情感巧妙融合，牛群缓慢涉水的姿态象征着生命旅程中的沉思与坚韧。作为巴比松画派的代表人物，Dupré以其独特的忧郁色调和笔触，开创了19世纪法国风景画的新方向，影响了后来的印象派发展。这幅作品不仅是对乡村生活的忠实记录，更是艺术家内心忧伤情绪的外在表达，与观众寻找内心平静与思考的审美需求形成共鸣，"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 49053
          },
          "timestamp": 1760282658364
        },
        {
          "type": "complete",
          "payload": {
            "elapsedMs": 148242
          },
          "timestamp": 1760282658364
        }
      ],
      "error": null,
      "endTime": "2025-10-12T15:24:18.366Z",
      "totalDuration": 148255
    },
    {
      "name": "GET Method Test",
      "description": "Testing GET method with query parameters",
      "emotion": "peace",
      "userInput": "宁静祥和的作品",
      "method": "GET",
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
      "startTime": "2025-10-12T15:24:18.366Z",
      "passed": false,
      "performance": {
        "totalDuration": 149775,
        "steps": {
          "emotionCurve": 1,
          "introduction": 11430,
          "conclusion": 6924,
          "explanations": [
            {
              "batchIndex": 1,
              "duration": 60336,
              "count": 2
            },
            {
              "batchIndex": 2,
              "duration": 58487,
              "count": 2
            }
          ],
          "totalExplanationTime": 118823
        },
        "eventTiming": {
          "start": [
            0
          ],
          "emotion_curve": [
            30941
          ],
          "artworks_selected": [
            30942
          ],
          "introduction": [
            42371
          ],
          "conclusion": [
            49291
          ],
          "explanations_batch": [
            91275,
            149766
          ],
          "complete": [
            149767
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
            "emotion": "peace",
            "userInput": "宁静祥和的作品"
          },
          "timestamp": 1760282658371
        },
        {
          "type": "emotion_curve",
          "payload": {
            "curve": [
              0.604290659041398,
              0.6458598184004111,
              0.7245873679395652,
              0.714933072747003,
              0.7135178804362132,
              0.66941171971418,
              0.6082373597734732,
              0.5443483298602013,
              0.5859374580191656,
              0.5704276803831757,
              0.6369961247567316,
              0.5780300455402755,
              0.5659635226090174,
              0.4928935559274236,
              0.5518400887797995,
              0.6323732902800615,
              0.6950360174725311,
              0.6287415806855267,
              0.6496831329622658,
              0.5883112989748113,
              0.5735912633097342,
              0.5442562521709796,
              0.5428190812466521,
              0.6047458812902522,
              0.5233050217659257,
              0.5996132578544751,
              0.6224703336033297,
              0.7085806925343432,
              0.6243053756743376,
              0.6451183530451683,
              0.6595293280981246,
              0.7144046754300364,
              0.7109279868643802,
              0.6778162874703823,
              0.6348625483057199,
              0.6368414770298803,
              0.6653404306369559,
              0.7476705925655717,
              0.6441722647043308,
              0.6303715231167863,
              0.5598193476471048,
              0.5764837134356017,
              0.6041265520924135,
              0.6401880705949314,
              0.7010859626389411,
              0.6904587837857257,
              0.72093375204362,
              0.7106640112963148,
              0.721632329499934,
              0.6927249497986901,
              0.7128627893016163,
              0.6890144200209815,
              0.6981225152030319,
              0.7060308958839038,
              0.7350898297637162,
              0.7482003193389658,
              0.7232721172242743,
              0.699132621414924,
              0.7008317051447439,
              0.697508164351949,
              0.6909162607714942,
              0.6930896076945819,
              0.7057582377040802,
              0.6873618609805948,
              0.6855602335363423,
              0.666960281956022,
              0.6899330864237706,
              0.6618520811337791
            ],
            "description": "这个\"peace\"情绪曲线展现了情感的动态变化：情绪强度有适度的起伏变化，从49%到75%，创造出丰富的情绪层次。",
            "durationMs": 1
          },
          "timestamp": 1760282689312
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
                "id": "459028",
                "title": "Portrait of Alvise Contarini(?); (verso) A Tethered Roebuck",
                "artist": "Jacometto (Jacometto Veneziano)",
                "year": "ca. 1485–95",
                "medium": "Oil on wood; verso: oil and gold on wood",
                "imageUrl": "https://images.metmuseum.org/CRDImages/rl/original/DP221485.jpg",
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
              }
            ],
            "selectionReasoning": "基于情绪曲线选择最能体现情绪强度的作品",
            "diversityMetrics": {
              "artistCount": 4,
              "periodCount": 3,
              "mediumCount": 3,
              "avgScore": 6.105,
              "emotionFit": 5
            },
            "durationMs": 0
          },
          "timestamp": 1760282689313
        },
        {
          "type": "introduction",
          "payload": {
            "introduction": "\n",
            "durationMs": 11430
          },
          "timestamp": 1760282700742
        },
        {
          "type": "conclusion",
          "payload": {
            "conclusion": "\n",
            "durationMs": 6924
          },
          "timestamp": 1760282707662
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
                "emotionalConnection": "在\"peace\"的心情下，Garden at Sainte-Adresse展现出特别的艺术魅力和情感深度。",
                "artisticAnalysis": "艺术家Claude Monet，创作于1867，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "在\"peace\"的心情下，Garden at Sainte-Adresse展现出特别的艺术魅力和情感深度。",
                  "artisticAnalysis": "艺术家Claude Monet，创作于1867，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "在\"peace\"的心情下，Garden at Sainte-Adresse展现出特别的艺术魅力和情感深度。",
                  "detail": "艺术家Claude Monet，创作于1867，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
                },
                "confidence": 0.8,
                "processingTime": 26097,
                "introduction": "在\"peace\"的心情下，Garden at Sainte-Adresse展现出特别的艺术魅力和情感深度。",
                "detail": "艺术家Claude Monet，创作于1867，采用Oil on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
              },
              {
                "artworkId": "435848",
                "title": "The Birth of the Virgin",
                "artist": "Fra Carnevale (Bartolomeo di Giovanni Corradini)",
                "emotionalConnection": "在\"peace\"的心情下，The Birth of the Virgin展现出特别的艺术魅力和情感深度。",
                "artisticAnalysis": "艺术家Fra Carnevale (Bartolomeo di Giovanni Corradini)，创作于1467，采用Tempera and oil on wood技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "在\"peace\"的心情下，The Birth of the Virgin展现出特别的艺术魅力和情感深度。",
                  "artisticAnalysis": "艺术家Fra Carnevale (Bartolomeo di Giovanni Corradini)，创作于1467，采用Tempera and oil on wood技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "在\"peace\"的心情下，The Birth of the Virgin展现出特别的艺术魅力和情感深度。",
                  "detail": "艺术家Fra Carnevale (Bartolomeo di Giovanni Corradini)，创作于1467，采用Tempera and oil on wood技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
                },
                "confidence": 0.8,
                "processingTime": 29116,
                "introduction": "在\"peace\"的心情下，The Birth of the Virgin展现出特别的艺术魅力和情感深度。",
                "detail": "艺术家Fra Carnevale (Bartolomeo di Giovanni Corradini)，创作于1467，采用Tempera and oil on wood技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 60336,
            "isFirstBatch": true
          },
          "timestamp": 1760282749646
        },
        {
          "type": "explanations_batch",
          "payload": {
            "batchIndex": 2,
            "batchSize": 2,
            "explanations": [
              {
                "artworkId": "459028",
                "title": "Portrait of Alvise Contarini(?); (verso) A Tethered Roebuck",
                "artist": "Jacometto (Jacometto Veneziano)",
                "emotionalConnection": "文艺复兴双面肖像，展现人物与自然和谐共处的宁静氛围。",
                "artisticAnalysis": "作为威尼斯画派代表作品，Jacometto通过细腻笔触与柔和光线，在正面呈现Contarini内心的平和与尊严，背面狍鹿形象则象征人与",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "文艺复兴双面肖像，展现人物与自然和谐共处的宁静氛围。",
                  "artisticAnalysis": "作为威尼斯画派代表作品，Jacometto通过细腻笔触与柔和光线，在正面呈现Contarini内心的平和与尊严，背面狍鹿形象则象征人与",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "文艺复兴双面肖像，展现人物与自然和谐共处的宁静氛围。",
                  "detail": "作为威尼斯画派代表作品，Jacometto通过细腻笔触与柔和光线，在正面呈现Contarini内心的平和与尊严，背面狍鹿形象则象征人与"
                },
                "confidence": 0.8,
                "processingTime": 27309,
                "introduction": "文艺复兴双面肖像，展现人物与自然和谐共处的宁静氛围。",
                "detail": "作为威尼斯画派代表作品，Jacometto通过细腻笔触与柔和光线，在正面呈现Contarini内心的平和与尊严，背面狍鹿形象则象征人与"
              },
              {
                "artworkId": "839045",
                "title": "The Net Mender (Garnbinderen)",
                "artist": "Christian Krohg",
                "emotionalConnection": "在这份宁静的心情下，克里斯蒂安·克罗",
                "artisticAnalysis": "创作于1879年的这幅作品，正值欧洲现实主义艺术兴起之际，艺术家们开始转向描绘普通人的日常生活，寻找平凡中的诗意。 Krohg作为挪威现实主义的重要代表，他笔下的渔网修补者展现了劳动的尊严与宁静。画面中，这位专注的修补者低垂着头，双手灵巧地穿梭于渔网之间，动作缓慢而从容。画家采用了沉稳的色调，蓝灰色的渔网与暖褐色的背景形成和谐对比，营造出一种平和而专注的氛围。这种对日常劳动的",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "在这份宁静的心情下，克里斯蒂安·克罗",
                  "artisticAnalysis": "创作于1879年的这幅作品，正值欧洲现实主义艺术兴起之际，艺术家们开始转向描绘普通人的日常生活，寻找平凡中的诗意。 Krohg作为挪威现实主义的重要代表，他笔下的渔网修补者展现了劳动的尊严与宁静。画面中，这位专注的修补者低垂着头，双手灵巧地穿梭于渔网之间，动作缓慢而从容。画家采用了沉稳的色调，蓝灰色的渔网与暖褐色的背景形成和谐对比，营造出一种平和而专注的氛围。这种对日常劳动的",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "在这份宁静的心情下，克里斯蒂安·克罗",
                  "detail": "创作于1879年的这幅作品，正值欧洲现实主义艺术兴起之际，艺术家们开始转向描绘普通人的日常生活，寻找平凡中的诗意。 Krohg作为挪威现实主义的重要代表，他笔下的渔网修补者展现了劳动的尊严与宁静。画面中，这位专注的修补者低垂着头，双手灵巧地穿梭于渔网之间，动作缓慢而从容。画家采用了沉稳的色调，蓝灰色的渔网与暖褐色的背景形成和谐对比，营造出一种平和而专注的氛围。这种对日常劳动的"
                },
                "confidence": 0.8,
                "processingTime": 17336,
                "introduction": "在这份宁静的心情下，克里斯蒂安·克罗",
                "detail": "创作于1879年的这幅作品，正值欧洲现实主义艺术兴起之际，艺术家们开始转向描绘普通人的日常生活，寻找平凡中的诗意。 Krohg作为挪威现实主义的重要代表，他笔下的渔网修补者展现了劳动的尊严与宁静。画面中，这位专注的修补者低垂着头，双手灵巧地穿梭于渔网之间，动作缓慢而从容。画家采用了沉稳的色调，蓝灰色的渔网与暖褐色的背景形成和谐对比，营造出一种平和而专注的氛围。这种对日常劳动的"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 58487
          },
          "timestamp": 1760282808137
        },
        {
          "type": "complete",
          "payload": {
            "elapsedMs": 149761
          },
          "timestamp": 1760282808138
        }
      ],
      "error": null,
      "endTime": "2025-10-12T15:26:48.143Z",
      "totalDuration": 149777
    },
    {
      "name": "Minimal Input Test",
      "description": "Testing with minimal emotion input",
      "emotion": "calm",
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
        "totalDuration": 100000,
        "planDuration": 25000,
        "searchDuration": 40000,
        "scoringDuration": 50000
      },
      "startTime": "2025-10-12T15:26:48.143Z",
      "passed": false,
      "performance": {
        "totalDuration": 106755,
        "steps": {
          "introduction": 5731,
          "conclusion": 3381,
          "explanations": [
            {
              "batchIndex": 1,
              "duration": 27964,
              "count": 2
            },
            {
              "batchIndex": 2,
              "duration": 29173,
              "count": 2
            }
          ],
          "totalExplanationTime": 57137
        },
        "eventTiming": {
          "start": [
            0
          ],
          "emotion_curve": [
            49608
          ],
          "artworks_selected": [
            49608
          ],
          "introduction": [
            55339
          ],
          "conclusion": [
            58719
          ],
          "explanations_batch": [
            77571,
            106745
          ],
          "complete": [
            106745
          ]
        }
      },
      "validation": {
        "passed": true,
        "issues": [],
        "scores": {
          "emotionCurveQuality": 100,
          "artworkQuality": 100,
          "explanationQuality": 50
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
            "emotion": "calm",
            "userInput": ""
          },
          "timestamp": 1760282808153
        },
        {
          "type": "emotion_curve",
          "payload": {
            "curve": [
              0.69367371225867,
              0.7341471366306033,
              0.7138308967905939,
              0.7383580859261157,
              0.6876718997906061,
              0.6602207781532273,
              0.6541718147446351,
              0.7016916455608605,
              0.6963174821661317,
              0.7316939573227601,
              0.7398998266534091,
              0.7376231004755956,
              0.7423257759439296,
              0.6539780765617588,
              0.6465813996868657,
              0.5993846926463847,
              0.6568689119201199,
              0.6360249958441676,
              0.6571148885126544,
              0.6872793413088806,
              0.7662896590988401,
              0.8268374519093493,
              0.7613564791990175,
              0.6856820805417092,
              0.605560892264051,
              0.6676909426623426,
              0.7399478964970561,
              0.740632540092539,
              0.6603475768809367,
              0.6756269478051191,
              0.6676615087359238,
              0.6706847522565408,
              0.6072106039017151,
              0.6264178443637974,
              0.6955381540681612,
              0.7378915938457098,
              0.80131740758412,
              0.7840061418056078,
              0.789372398642486,
              0.7013112387530519,
              0.7222877637638786,
              0.735649415649136,
              0.7769902297295097,
              0.7746330486827236,
              0.7654977096823291,
              0.7470043187932521,
              0.7499701736122732,
              0.6791873245920805,
              0.7291147374872665,
              0.7299795641155663,
              0.8067776846761815,
              0.8192398316601682,
              0.750696230442616,
              0.7580048953240542,
              0.7620596952379254,
              0.8320879853776036,
              0.7574337152200692,
              0.7121449644884827,
              0.6426074993273656,
              0.6358812149447609,
              0.6398192839020495,
              0.6944258235101545,
              0.7170803425473765,
              0.7508111796909586,
              0.7762075550059319,
              0.7739316225743703,
              0.700449553436233,
              0.628221758390969
            ],
            "description": "这个\"calm\"情绪曲线展现了情感的动态变化：情绪强度有适度的起伏变化，从60%到83%，创造出丰富的情绪层次。",
            "durationMs": 0
          },
          "timestamp": 1760282857761
        },
        {
          "type": "artworks_selected",
          "payload": {
            "artworks": [
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
                "id": "459027",
                "title": "Portrait of a Woman, Possibly a Nun of San Secondo; (verso) Scene in Grisaille",
                "artist": "Jacometto (Jacometto Veneziano)",
                "year": "ca. 1485–95",
                "medium": "Oil on wood; (verso: oil and gold on wood)",
                "imageUrl": "https://images.metmuseum.org/CRDImages/rl/original/DP221483.jpg",
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
            "durationMs": 0
          },
          "timestamp": 1760282857761
        },
        {
          "type": "introduction",
          "payload": {
            "introduction": "\n**序言：宁静的回响**\n\n在这个喧嚣的时代，\"calm\"展览如同一方静谧的绿洲，邀请观众暂时放下纷扰，沉浸在艺术的宁静之中。我们精心挑选的四件杰作，虽跨越",
            "durationMs": 5731
          },
          "timestamp": 1760282863492
        },
        {
          "type": "conclusion",
          "payload": {
            "conclusion": "\n",
            "durationMs": 3381
          },
          "timestamp": 1760282866872
        },
        {
          "type": "explanations_batch",
          "payload": {
            "batchIndex": 1,
            "batchSize": 2,
            "explanations": [
              {
                "artworkId": "839045",
                "title": "The Net Mender (Garnbinderen)",
                "artist": "Christian Krohg",
                "emotionalConnection": "在\"calm\"的心情下，The Net Mender (Garnbinderen)展现出特别的艺术魅力和情感深度。",
                "artisticAnalysis": "艺术家克里斯蒂安·克罗",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "在\"calm\"的心情下，The Net Mender (Garnbinderen)展现出特别的艺术魅力和情感深度。",
                  "artisticAnalysis": "艺术家克里斯蒂安·克罗",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "在\"calm\"的心情下，The Net Mender (Garnbinderen)展现出特别的艺术魅力和情感深度。",
                  "detail": "艺术家克里斯蒂安·克罗"
                },
                "confidence": 0.8,
                "processingTime": 27927,
                "introduction": "在\"calm\"的心情下，The Net Mender (Garnbinderen)展现出特别的艺术魅力和情感深度。",
                "detail": "艺术家克里斯蒂安·克罗"
              },
              {
                "artworkId": "437422",
                "title": "Charity",
                "artist": "Guido Reni",
                "emotionalConnection": "在\"平静\"（calm）的心情下，查瑞蒂（Charity）展现出特别的艺术魅力和情感深度。",
                "artisticAnalysis": "艺术家圭多·雷尼（Guido Reni），创作于约1630年（ca. 1630），采用油画布",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "在\"平静\"（calm）的心情下，查瑞蒂（Charity）展现出特别的艺术魅力和情感深度。",
                  "artisticAnalysis": "艺术家圭多·雷尼（Guido Reni），创作于约1630年（ca. 1630），采用油画布",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "在\"平静\"（calm）的心情下，查瑞蒂（Charity）展现出特别的艺术魅力和情感深度。",
                  "detail": "艺术家圭多·雷尼（Guido Reni），创作于约1630年（ca. 1630），采用油画布"
                },
                "confidence": 0.8,
                "processingTime": 22475,
                "introduction": "在\"平静\"（calm）的心情下，查瑞蒂（Charity）展现出特别的艺术魅力和情感深度。",
                "detail": "艺术家圭多·雷尼（Guido Reni），创作于约1630年（ca. 1630），采用油画布"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 27964,
            "isFirstBatch": true
          },
          "timestamp": 1760282885724
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
                "emotionalConnection": "在\"calm\"的心情下，The Rehearsal of the Ballet Onstage展现出特别的艺术魅力和情感深度。",
                "artisticAnalysis": "艺术家Edgar Degas，创作于ca. 1874，采用Oil colors freely mixed with turpentine, with traces of watercolor and pastel over pen-and-ink drawing on cream-colored wove paper, laid down on bristol board and mounted on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "在\"calm\"的心情下，The Rehearsal of the Ballet Onstage展现出特别的艺术魅力和情感深度。",
                  "artisticAnalysis": "艺术家Edgar Degas，创作于ca. 1874，采用Oil colors freely mixed with turpentine, with traces of watercolor and pastel over pen-and-ink drawing on cream-colored wove paper, laid down on bristol board and mounted on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "在\"calm\"的心情下，The Rehearsal of the Ballet Onstage展现出特别的艺术魅力和情感深度。",
                  "detail": "艺术家Edgar Degas，创作于ca. 1874，采用Oil colors freely mixed with turpentine, with traces of watercolor and pastel over pen-and-ink drawing on cream-colored wove paper, laid down on bristol board and mounted on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
                },
                "confidence": 0.8,
                "processingTime": 25268,
                "introduction": "在\"calm\"的心情下，The Rehearsal of the Ballet Onstage展现出特别的艺术魅力和情感深度。",
                "detail": "艺术家Edgar Degas，创作于ca. 1874，采用Oil colors freely mixed with turpentine, with traces of watercolor and pastel over pen-and-ink drawing on cream-colored wove paper, laid down on bristol board and mounted on canvas技法。\n\n这是一件来自大都会艺术博物馆的珍贵作品。"
              },
              {
                "artworkId": "459027",
                "title": "Portrait of a Woman, Possibly a Nun of San Secondo; (verso) Scene in Grisaille",
                "artist": "Jacometto (Jacometto Veneziano)",
                "emotionalConnection": "文艺复兴",
                "artisticAnalysis": "这幅作品展现了雅科梅托（Jacometto）作为威尼斯画派",
                "historicalContext": "",
                "curationReason": "",
                "userRelevance": "",
                "explanation": {
                  "emotionalConnection": "文艺复兴",
                  "artisticAnalysis": "这幅作品展现了雅科梅托（Jacometto）作为威尼斯画派",
                  "historicalContext": "",
                  "curationReason": "",
                  "userRelevance": "",
                  "introduction": "文艺复兴",
                  "detail": "这幅作品展现了雅科梅托（Jacometto）作为威尼斯画派"
                },
                "confidence": 0.8,
                "processingTime": 29107,
                "introduction": "文艺复兴",
                "detail": "这幅作品展现了雅科梅托（Jacometto）作为威尼斯画派"
              }
            ],
            "successCount": 2,
            "failureCount": 0,
            "durationMs": 29173
          },
          "timestamp": 1760282914898
        },
        {
          "type": "complete",
          "payload": {
            "elapsedMs": 106744
          },
          "timestamp": 1760282914898
        }
      ],
      "error": null,
      "endTime": "2025-10-12T15:28:34.898Z",
      "totalDuration": 106755
    }
  ],
  "errorScenarios": [
    {
      "name": "Missing Emotion",
      "description": "Test error handling when emotion is missing",
      "emotion": "",
      "userInput": "Some input",
      "method": "POST",
      "expectedError": "Missing required field: emotion",
      "startTime": "2025-10-12T15:28:34.899Z",
      "passed": false,
      "error": null,
      "receivedError": "Expected error but got successful response",
      "endTime": "2025-10-12T15:28:34.903Z"
    },
    {
      "name": "Empty Request Body",
      "description": "Test error handling with empty request",
      "emotion": null,
      "userInput": null,
      "method": "POST",
      "expectedError": "Missing required field: emotion",
      "startTime": "2025-10-12T15:28:34.903Z",
      "passed": false,
      "error": null,
      "receivedError": "Expected error but got successful response",
      "endTime": "2025-10-12T15:28:34.905Z"
    },
    {
      "name": "GET without Emotion",
      "description": "Test GET method without emotion parameter",
      "emotion": "",
      "userInput": "",
      "method": "GET",
      "expectedError": "Missing required field: emotion",
      "startTime": "2025-10-12T15:28:34.905Z",
      "passed": false,
      "error": null,
      "receivedError": "Expected error but got successful response",
      "endTime": "2025-10-12T15:28:34.908Z"
    }
  ],
  "summary": {
    "totalTests": 8,
    "passedTests": 0,
    "failedTests": 8,
    "successRate": 0,
    "performance": {
      "averageDuration": 163000,
      "minDuration": 106755,
      "maxDuration": 237974,
      "totalSamples": 5
    },
    "quality": {
      "emotionCurveQuality": 100,
      "artworkQuality": 100,
      "explanationQuality": 72
    },
    "testDuration": 815019
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
  "generatedAt": "2025-10-12T15:28:34.908Z"
}
```

</details>

## Recommendations

- Consider optimizing workflow to reduce average duration below 2 minutes
- Investigate scenarios with unusually high duration
- Improve explanationQuality (current: 72%)
- Address 5 failing test scenarios
