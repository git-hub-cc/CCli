import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import fastGlob from 'fast-glob';
import { sysLogger, LogLevel } from './logger.js';
import { AIMLParser } from '../parser/aiml-parser.js';
import { LLMProviderFactory } from '../llm/factory.js';
import { MockTestProvider } from '../llm/mock-test.js';
import { SystemInterceptor } from '../parser/interceptor.js';

export class TestEngine {
    private testDir: string;

    constructor() {
        this.testDir = path.resolve(process.cwd(), 'test/00cases');
        if (!fs.existsSync(this.testDir)) {
            fs.mkdirSync(this.testDir, { recursive: true });
        }
    }

    private parseFrontmatter(text: string) {
        const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
        if (!match) return { meta: {}, body: text };
        
        const metaRaw = match[1];
        const body = match[2];
        const meta: Record<string, any> = {};
        
        metaRaw.split('\n').forEach(line => {
            const parts = line.split(':');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join(':').trim();
                if (val.startsWith('[') && val.endsWith(']')) {
                    meta[key] = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
                } else {
                    meta[key] = val.replace(/^["']|["']$/g, '');
                }
            }
        });
        return { meta, body };
    }

    async run(targetCase?: string, tags?: string) {
        sysLogger.enableTestMode();
        sysLogger.initSession();

        const pattern = targetCase ? `**/${targetCase}*` : '**/*.md';
        const files = await fastGlob(pattern, { cwd: this.testDir });

        if (files.length === 0) {
            console.log(chalk.yellow(`未在 ${this.testDir} 找到匹配的测试用例。`));
            return;
        }

        const targetTags = tags ? tags.split(',').map(t => t.trim()) : [];
        let passCount = 0;
        let failCount = 0;

        for (const file of files) {
            const filePath = path.join(this.testDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const { meta, body } = this.parseFrontmatter(content);

            if (targetTags.length > 0) {
                const caseTags = meta.tags || [];
                const hasTag = targetTags.some((t: string) => caseTags.includes(t));
                if (!hasTag) continue;
            }

            console.log(chalk.cyan(`\n▶ 开始执行测试: ${file} - ${meta.name || '未命名用例'}`));
            
            const provider = LLMProviderFactory.create('mock') as MockTestProvider;
            provider.setPayload(body);

            try {
                const parsedNodes = AIMLParser.parse(body);
                const feedbacks = await AIMLParser.executeNodes(parsedNodes, provider);
                
                const interceptResult = SystemInterceptor.intercept(feedbacks, 1);
                
                if (interceptResult.cleanFeedbacks.length > 0) {
                    const rawFeedbackStr = interceptResult.cleanFeedbacks.join('\n\n');
                    sysLogger.appendChat('Tool_Feedback', rawFeedbackStr);
                }
                
                const expectStatus = meta.expect_status || 'success';
                const expectKeywords = meta.expect_keywords || [];
                
                const allFeedbackText = feedbacks.map(f => f.content || '').join('\n');
                const hasError = feedbacks.some(f => f.type === 'error' || (f.content && f.content.includes('异常')));

                let isPass = true;
                let failReason = '';

                if (expectStatus === 'success' && hasError) {
                    isPass = false;
                    failReason = '预期成功，但执行过程产生异常';
                } else if (expectStatus === 'error' && !hasError) {
                    isPass = false;
                    failReason = '预期异常，但执行过程未产生异常';
                }

                for (const keyword of expectKeywords) {
                    if (!allFeedbackText.includes(keyword)) {
                        isPass = false;
                        failReason = `反馈结果中缺失预期关键字: ${keyword}`;
                        break;
                    }
                }

                if (isPass) {
                    console.log(chalk.green(`✔ 测试通过: ${file}`));
                    passCount++;
                } else {
                    console.log(chalk.red(`✖ 测试失败: ${file}`));
                    console.log(chalk.red(`  原因: ${failReason}`));
                    failCount++;
                }

            } catch (err: any) {
                console.log(chalk.red(`✖ 测试抛出未捕获异常: ${file}`));
                console.log(chalk.red(err.message));
                failCount++;
            } finally {
                sysLogger.flushActionTrace(file);
            }
        }

        console.log(chalk.blue(`\n=== 测试报告 ===`));
        console.log(chalk.green(`通过: ${passCount}`) + ` | ` + chalk.red(`失败: ${failCount}`) + ` | 总计: ${passCount + failCount}\n`);
    }
}