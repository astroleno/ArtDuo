// 快速时序测试
console.log('⚡ 快速时序测试\n');

const http = require('http');

function quickTimingTest() {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            emotion: 'exhausted',
            userInput: '简单测试'
        });

        const options = {
            hostname: 'localhost',
            port: 3002,
            path: '/api/curate/stream',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        let events = [];

        const req = http.request(options, (response) => {
            let buffer = '';

            response.on('data', (chunk) => {
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop();

                lines.forEach(line => {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            const timestamp = Date.now();

                            events.push({
                                type: data.type,
                                timestamp,
                                data: data.payload
                            });

                            if (data.type === 'emotion_curve') {
                                console.log(`📈 情绪曲线: ${data.payload.durationMs}ms`);
                            } else if (data.type === 'artworks_selected') {
                                console.log(`🎨 作品选择: ${data.payload.durationMs}ms - ${data.payload.artworks?.length || 0}件`);
                            } else if (data.type === 'explanations_batch') {
                                console.log(`📝 讲解批次: ${data.payload.durationMs}ms`);
                                resolve(events);
                                req.destroy();
                            }
                        } catch (error) {
                            // 忽略解析错误
                        }
                    }
                });
            });

            response.on('end', () => {
                resolve(events);
            });

            req.on('error', reject);
            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('超时'));
            });

            req.write(postData);
            req.end();
        });
    });
}

if (require.main === module) {
    quickTimingTest()
        .then(events => {
            console.log('\n✅ 测试完成');
            const emotionCurve = events.find(e => e.type === 'emotion_curve');
            const artworkSelection = events.find(e => e.type === 'artworks_selected');

            console.log('\n📊 结果总结:');
            console.log(`情绪曲线时间: ${emotionCurve?.data?.durationMs || '未捕获'}ms`);
            console.log(`作品选择时间: ${artworkSelection?.data?.durationMs || '未捕获'}ms`);
            console.log(`选中作品数量: ${artworkSelection?.data?.artworks?.length || '未捕获'}件`);
        })
        .catch(console.error);
}

module.exports = { quickTimingTest };