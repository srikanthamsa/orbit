export function redactSecret(secret?: string): string {
  if (!secret) return '';
  if (secret.length <= 8) return '••••';
  return `${secret.slice(0, 3)}…${secret.slice(-4)}`;
}

export function redactText(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret && secret.length > 4) out = out.split(secret).join(redactSecret(secret));
  }
  return out;
}

export function friendlyHttpError(status: number, provider: string): string {
  if (status === 401 || status === 403) return `The ${provider} API key was rejected. Check it in Settings.`;
  if (status === 404) return `That model was not found on ${provider}. Check the model name in Settings.`;
  if (status === 429) return `${provider} is rate limiting requests. Wait a moment and retry.`;
  if (status >= 500) return `${provider} is having trouble right now (${status}). Try again shortly.`;
  return `${provider} returned an error (${status}).`;
}
