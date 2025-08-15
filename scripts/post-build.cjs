const fs = require('fs');
const path = require('path');

console.log('🔧 Post-build: Adding scheduled function...');

// 读取生成的 index.mjs 文件
const indexPath = path.join(__dirname, '../.mastra/output/index.mjs');
let content = fs.readFileSync(indexPath, 'utf8');

// 查找并替换默认导出
const scheduledFunction = `
  scheduled: async (controller, env, context) => {
    console.log("Cron job triggered - warming up MCP servers");
    try {
      const startTime = Date.now();
      // 这里需要访问我们的warmup函数，但由于构建后的代码结构复杂，
      // 我们直接在这里重新实现简化的预热逻辑
      
      // 调用warmup端点进行预热
      try {
        const response = await fetch('https://cookapi.chuzilaoxu.uk/warmup');
        if (response.ok) {
          const result = await response.json();
          console.log('Warmup successful:', result);
        } else {
          console.error('Warmup failed:', response.status);
        }
      } catch (error) {
        console.error('Warmup request failed:', error);
      }
      
      const endTime = Date.now();
      console.log(\`Cron warmup completed in \${endTime - startTime}ms\`);
    } catch (error) {
      console.error("Cron warmup failed:", error);
    }
  },`;

// 替换导出对象，添加 scheduled 函数
content = content.replace(
  /var _virtual__entry = \{\s*fetch: async \(request, env, context\) => \{[\s\S]*?\}\s*\};/,
  (match) => {
    return match.replace(
      /(\s*fetch: async \(request, env, context\) => \{[\s\S]*?\})/,
      `$1,${scheduledFunction}`
    );
  }
);

// 写回文件
fs.writeFileSync(indexPath, content);

console.log('✅ Post-build: Scheduled function added successfully');

// 同时启用 cron triggers
const wranglerPath = path.join(__dirname, '../.mastra/output/wrangler.json');
const wranglerConfig = JSON.parse(fs.readFileSync(wranglerPath, 'utf8'));

// 添加 cron triggers
wranglerConfig.triggers = {
  crons: ["*/15 * * * *"]  // 每15分钟执行一次
};

fs.writeFileSync(wranglerPath, JSON.stringify(wranglerConfig, null, 2));

console.log('✅ Post-build: Cron triggers enabled in wrangler.json');