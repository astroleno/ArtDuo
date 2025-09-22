Console Error


请更具体地描述你的情绪或场景，以便生成策展分析。

src/lib/frontend-agent.ts (238:15) @ FrontendAgent.generateAnalysis


  236 |       
  237 |       if (!analysisText || analysisText.trim() === '{}' || analysisText.trim().length < 10) {
> 238 |         throw new AgentError(
      |               ^
  239 |           'ANALYSIS_EMPTY',
  240 |           '请更具体地描述你的情绪或场景，以便生成策展分析。',
  241 |           { reason: 'LLM_EMPTY_RESPONSE' }
Call Stack
3

FrontendAgent.generateAnalysis
src/lib/frontend-agent.ts (238:15)
async FrontendAgent.execute
src/lib/frontend-agent.ts (125:24)
async handleSubmit
src/components/EmotionInput.tsx (43:22)