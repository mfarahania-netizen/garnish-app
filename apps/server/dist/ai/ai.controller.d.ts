import { AiService } from './ai.service';
export declare class AiController {
    private readonly aiService;
    constructor(aiService: AiService);
    chat(req: any, body: {
        prompt: string;
    }): Promise<{
        reply: string;
    }>;
}
