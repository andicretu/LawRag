// llm-config.ts

export type LLMProvider = "openai" | "deepseek";

export interface LLMConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  type: LLMProvider;
  headers?: Record<string, string>;
}

export const llmConfigs: Record<LLMProvider, LLMConfig> = {
  openai: {
    name: "OpenAI GPT-4",
    baseUrl: "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY || "",
    model: "gpt-4",
    type: "openai",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
  },

  deepseek: {
    name: "DeepSeek-V2",
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: process.env.DEEPSEEK_API_KEY || "",
    model: "deepseek-chat",
    type: "deepseek",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
  },
};

export function getLLMConfig(provider: LLMProvider): LLMConfig {
  const config = llmConfigs[provider];
  if (!config.apiKey) throw new Error(`Missing API key for ${provider}`);
  return config;
}
