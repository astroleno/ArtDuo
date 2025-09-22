# 策展流式流程报告

- 基础URL: http://localhost:3000
- Emotion: joy
- UserInput: bright colors, family, celebration
- 生成时间: 2025-09-22T13:57:47.076Z

## 阶段耗时（ms）与关键信息

| 步骤 | 相对时间(ms) | 阶段耗时(ms) | 关键信息 |
| --- | ---: | ---: | --- |
| start | 225 | 225 | ```json {"emotion":"joy","userInput":"bright colors, family, celebration"} ``` |
| plan | 10834 | 10610 | ```json {"searchPlan":{"keywords":["celebration","festival","dance","music","happiness"],"filters":{"period":{"start":1500,"end":2024},"medium":["painting","sculpture","textile","ceramic"],"geo":["Europe","Asia","Americas"],"creator":["Rubens","Fragonard","Monet","Matisse"],"highlight":true,"hasImages":true},"sources":["met","rijks"]},"llmAnalysis":{"emotion_analysis":"这是一个关于\"joy\"情绪的艺术策展","art_styles":["baroque","rococo","impressionist","fauvist"],"search_keywords":["celebration","festival","dance","music","happiness"],"recommended_artists":["Rubens","Fragonard","Monet","Matisse"],"curation_strategy":"通过明亮色彩和动态构图展现喜悦情绪"},"seed":"1389008095","durationMs":10610} ``` |
| coarse | 21469 | 10627 | ```json {"total":9,"source":"fallback","durationMs":10627,"sample":[{"id":"4","title":"向日葵","artist":"文森特·梵高"},{"id":"6","title":"睡莲","artist":"克劳德·莫奈"},{"id":"2","title":"蒙娜丽莎","artist":"列奥纳多·达·芬奇"},{"id":"3","title":"呐喊","artist":"爱德华·蒙克"},{"id":"5","title":"格尔尼卡","artist":"巴勃罗·毕加索"}]} ``` |
| score | 25428 | 3965 | ```json {"totalProcessed":9,"successCount":9,"failureCount":9,"durationMs":3965} ``` |
| select | 25428 | 3 | ```json {"selectedCount":9,"selectionReasoning":"符合条件作品数量不足，返回所有作品","diversityMetrics":{"artistCount":7,"periodCount":4,"mediumCount":4,"avgScore":5,"emotionFit":5},"durationMs":3,"artworks":[{"id":"4","title":"向日葵","artist":"文森特·梵高"},{"id":"6","title":"睡莲","artist":"克劳德·莫奈"},{"id":"2","title":"蒙娜丽莎","artist":"列奥纳多·达·芬奇"},{"id":"3","title":"呐喊","artist":"爱德华·蒙克"},{"id":"5","title":"格尔尼卡","artist":"巴勃罗·毕加索"},{"id":"8","title":"创世纪","artist":"米开朗基罗"},{"id":"7","title":"最后的晚餐","artist":"列奥纳多·达·芬奇"},{"id":"9","title":"夜巡","artist":"伦勃朗"},{"id":"1","title":"星夜","artist":"文森特·梵高"}]} ``` |
| summary | 32476 | 7049 | ```json {"summary":"这是一个精心策划的艺术展览，展现了深刻的情感表达和艺术价值。","durationMs":7049} ``` |
| explanation | 88511 | 56033 | ```json {"totalProcessed":9,"successCount":7,"failureCount":2,"fromCacheCount":0,"durationMs":56033,"items":[{"artworkId":"4","title":"向日葵","artist":"文森特·梵高","confidence":0.8},{"artworkId":"6","title":"睡莲","artist":"克劳德·莫奈","confidence":0.8},{"artworkId":"2","title":"蒙娜丽莎","artist":"列奥纳多·达·芬奇","confidence":0.8},{"artworkId":"3","title":"呐喊","artist":"爱德华·蒙克","confidence":0.6},{"artworkId":"5","title":"格尔尼卡","artist":"巴勃罗·毕加索","confidence":0.6},{"artworkId":"8","title":"创世纪","artist":"米开朗基罗","confidence":0.8},{"artworkId":"7","title":"最后的晚餐","artist":"列奥纳多·达·芬奇","confidence":0.8},{"artworkId":"9","title":"夜巡","artist":"伦勃朗","confidence":0.8},{"artworkId":"1","title":"星夜","artist":"文森特·梵高","confidence":0.8}]} ``` |
| complete | 88511 | 0 | ```json {"elapsedMs":88289} ``` |

## 原始事件顺序（时间戳ms）

- 225ms: start
- 10834ms: plan
- 21469ms: coarse
- 25428ms: score
- 25428ms: select
- 32476ms: summary
- 88511ms: explanation
- 88511ms: complete
