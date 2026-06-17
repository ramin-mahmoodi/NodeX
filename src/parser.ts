export interface ParsedConfig {
  protocol: string;
  name: string;
  host: string;
  port: number;
  raw_uri: string;
}

export function decodeBase64Utf8(str: string): string {
  try {
    // Remove all whitespace characters (spaces, tabs, newlines)
    let b64 = str.replace(/\s+/g, '');
    b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) { b64 += '='; }
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    return str;
  }
}

export function encodeBase64Utf8(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch (e) {
    return btoa(str); // Fallback
  }
}

export function parseSubscription(base64Data: string): string[] {
  try {
    let decoded = base64Data;
    // Check if it looks like base64
    if (!base64Data.includes('://')) {
      decoded = decodeBase64Utf8(base64Data);
    }

    return decoded.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  } catch (e) {
    console.error('Failed to parse subscription', e);
    return [];
  }
}

export function parseURI(uri: string): ParsedConfig | null {
  try {
    if (uri.startsWith('vmess://')) {
      const base64Str = uri.replace('vmess://', '');
      const decoded = decodeBase64Utf8(base64Str);
      const config = JSON.parse(decoded);
      return {
        protocol: 'vmess',
        name: config.ps || 'Unknown Vmess',
        host: config.add || '',
        port: parseInt(config.port) || 443,
        raw_uri: uri
      };
    }

    // Generic fallback for any protocol that follows standard URI format (vless, trojan, hysteria2, tuic, ss, etc.)
    if (uri.includes('://')) {
      const url = new URL(uri);
      const protocol = url.protocol.replace(':', '');
      
      if (url.hostname) {
        let port = parseInt(url.port);
        if (!port) {
          port = (protocol === 'trojan' || protocol === 'vless' || protocol === 'hysteria2') ? 443 : 80;
        }

        let name = url.hash ? decodeURIComponent(url.hash.replace('#', '')) : `Unknown ${protocol}`;

        return {
          protocol,
          name: name.trim(),
          host: url.hostname,
          port: port,
          raw_uri: uri
        };
      }
    }

    return null;
  } catch (e) {
    console.error(`Failed to parse URI: ${uri}`, e);
    return null;
  }
}
