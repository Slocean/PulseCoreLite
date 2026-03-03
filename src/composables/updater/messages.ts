export type UpdaterErrorCode = 'network' | 'unknown';

export function resolveUpdaterErrorCode(message: string): UpdaterErrorCode {
  const lower = message.toLowerCase();
  if (
    lower.includes('error sending request for url') ||
    lower.includes('failed to send request') ||
    lower.includes('dns') ||
    lower.includes('timeout') ||
    lower.includes('connection')
  ) {
    return 'network';
  }
  return 'unknown';
}

export function buildUpdaterErrorMessage(code: UpdaterErrorCode, originalMessage: string, releasesUrl: string): string {
  switch (code) {
    case 'network':
      return `Update server connection failed. Please check your network and retry. Manual download: ${releasesUrl}`;
    case 'unknown':
    default:
      return originalMessage;
  }
}

export function toUpdaterMessage(error: unknown, releasesUrl: string): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
  const code = resolveUpdaterErrorCode(message);
  return buildUpdaterErrorMessage(code, message, releasesUrl);
}
