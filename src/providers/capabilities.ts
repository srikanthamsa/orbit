import type { ProviderConfig } from '@/types';

export interface ModelCapabilities {
  toolCalling: boolean;
  vision: boolean;
  structuredOutput: boolean;
  streaming: boolean;
}

export function capabilitiesFor(config: ProviderConfig): ModelCapabilities {
  if (config.visionOverride !== undefined) {
    return { toolCalling: true, vision: config.visionOverride, structuredOutput: true, streaming: false };
  }
  const model = config.model.toLowerCase();
  switch (config.provider) {
    case 'openai':
      return {
        toolCalling: true,
        vision: /gpt-4o|gpt-4\.1|gpt-5|o3|o4|gpt-4-turbo/.test(model) && !/transcribe|tts|embedding/.test(model),
        structuredOutput: true,
        streaming: false,
      };
    case 'anthropic':
      return { toolCalling: true, vision: /claude-3|claude-4|claude-sonnet|claude-opus|claude-haiku/.test(model), structuredOutput: true, streaming: false };
    case 'gemini':
      return { toolCalling: true, vision: true, structuredOutput: true, streaming: false };
    case 'deepseek':
      return {
        toolCalling: true,
        vision: /deepseek-flash|deepseek-v4-flash/.test(model) && !/v4-pro/.test(model),
        structuredOutput: false,
        streaming: false,
      };
    case 'compatible':
      return { toolCalling: true, vision: false, structuredOutput: false, streaming: false };
  }
}
