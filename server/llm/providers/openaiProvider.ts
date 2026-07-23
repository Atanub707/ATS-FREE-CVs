export interface OpenAiOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  temperature: number;
  responseFormat?: 'json' | 'text';
  extraBody?: Record<string, any>;
}

export async function askOpenAi(options: OpenAiOptions): Promise<string> {
  const url = options.baseUrl.replace(/\/+$/, '') + '/chat/completions';

  const body: Record<string, any> = {
    model: options.model,
    messages: [{ role: 'user', content: options.prompt }],
    temperature: options.temperature,
  };

  if (options.responseFormat !== 'text') {
    body.response_format = { type: 'json_object' };
  }

  if (options.extraBody) {
    Object.assign(body, options.extraBody);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`OpenAI-compatible API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();

  if (!data.choices?.[0]?.message?.content) {
    throw new Error('No response content from OpenAI-compatible API');
  }

  return data.choices[0].message.content;
}
