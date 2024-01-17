import { DEEPINFRA } from "../../globals";
import {
  ChatCompletionResponse,
  ErrorResponse,
  ProviderConfig,
} from "../types";

export const DeepInfraChatCompleteConfig: ProviderConfig = {
  model: {
    param: "model",
    required: true,
    default: "meta-llama/Llama-2-70b-chat-hf",
  },
  messages: {
    param: "messages",
    default: [],
  },
  temperature: {
    param: "temperature",
    default: 0.7,
    min: 0,
    max: 1,
  },
  top_p: {
    param: "top_p",
    default: 1,
    min: 0,
    max: 1,
  },
  max_tokens: {
    param: "max_tokens",
    default: null,
    min: 1,
  },
  stream: {
    param: "stream",
    default: false,
  },
};

interface DeepInfraChatCompleteResponse extends ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface DeepInfraErrorResponse {
    message:string 
}

interface DeepInfraStreamChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: {
        delta: {
            role?: string | null;
            content?: string;
        };
        index: number;
        finish_reason: string | null;
    }[];
}

export const DeepInfraChatCompleteResponseTransform: (
  response: DeepInfraChatCompleteResponse | DeepInfraErrorResponse,
  responseStatus: number
) => ChatCompletionResponse | ErrorResponse = (response, responseStatus) => {
    if ("message" in response && responseStatus !== 200) {
        return {
            error: {
                message: response.message,
                type: null,
                param: null,
                code: null,
            },
            provider: DEEPINFRA,
        } as ErrorResponse;
    }

    if ("choices" in response) {
        return {
            id: response.id,
            object: response.object,
            created: response.created,
            model: response.model,
            provider: DEEPINFRA,
            choices: response.choices.map((c) => ({
                index: c.index,
                message: {
                    role: c.message.role,
                    content: c.message.content,
                },
                finish_reason: c.finish_reason,
            })),
            usage: {
                prompt_tokens: response.usage?.prompt_tokens,
                completion_tokens: response.usage?.completion_tokens,
                total_tokens: response.usage?.total_tokens,
            },
        };
    }

    return {
        error: {
            message: `Invalid response recieved from ${DEEPINFRA}: ${JSON.stringify(
                response
            )}`,
            type: null,
            param: null,
            code: null,
        },
        provider: DEEPINFRA,
    } as ErrorResponse;
};


export const DeepInfraChatCompleteStreamChunkTransform: (
    response: string
) => string = (responseChunk) => {
    let chunk = responseChunk.trim();
    chunk = chunk.replace(/^data: /, "");
    chunk = chunk.trim();
    if (chunk === "[DONE]") {
        return `data: ${chunk}\n\n`;
    }
    const parsedChunk: DeepInfraStreamChunk = JSON.parse(chunk);
    return (
        `data: ${JSON.stringify({
            id: parsedChunk.id,
            object: parsedChunk.object,
            created: parsedChunk.created,
            model: parsedChunk.model,
            provider: DEEPINFRA,
            choices: [
                {
                    index: parsedChunk.choices[0].index,
                    delta: parsedChunk.choices[0].delta,
                    finish_reason: parsedChunk.choices[0].finish_reason,
                },
            ],
        })}` + "\n\n"
    );
};