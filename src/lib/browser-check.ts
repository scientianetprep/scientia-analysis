export type BrowserSupport = 'chrome' | 'edge' | 'unsupported';

export function getBrowserSupport(): BrowserSupport {
  if (typeof navigator === 'undefined') return 'unsupported';
  const ua = navigator.userAgent;
  
  // Edge detection
  if (/Edg\//.test(ua)) return 'edge';
  
  // Chrome detection (Chrome UA includes 'Safari' and 'Chrome' but not 'Edg', 'OPR', 'Brave' etc)
  // Note: Modern Brave/Opera can be detected specifically but for now we follow the 'Chrome/Edge only' rule strictly
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua) && !/Brave\//.test(ua)) return 'chrome';
  
  return 'unsupported';
}
