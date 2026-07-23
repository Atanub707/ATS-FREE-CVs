export async function askAnthropic(
  apiKey: string,
  model: string,
  prompt: string,
  temperature: number
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
      temperature,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  const data = await response.json();

  if (!data.content?.[0]?.text) {
    throw new Error('No response content from Anthropic');
  }

  return data.content[0].text;
}
