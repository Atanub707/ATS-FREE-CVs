export type LlmErrorCode = 'no_api_key' | 'invalid_key' | 'llm_error';

export function llmErrorMessage(code: string | undefined, raw: string): string {
  switch (code) {
    case 'no_api_key':
      return 'No API token configured — add your API key in Settings. This process will not run.';
    case 'invalid_key':
      return 'Your API key appears to be expired or invalid — update it in Settings.';
    case 'llm_error':
      return raw || 'LLM service error — try again later.';
    default:
      return raw || 'Something went wrong.';
  }
}
