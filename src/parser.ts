export interface ParsedConfig {
  protocol: string;
  name: string;
  host: string;
  port: number;
  raw_uri: string;
}

export function decodeBase64Utf8(str: string): string {
  try {
    let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
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

    if (uri.startsWith('vless://') || uri.startsWith('trojan://')) {
      const protocol = uri.startsWith('vless://') ? 'vless' : 'trojan';
      const url = new URL(uri);
      
      // hostname:port
      let host = url.hostname;
      let port = parseInt(url.port);

      if (!port) {
        port = protocol === 'trojan' ? 443 : 80;
      }

      // Sometimes host is obscured in SNI/host param, but for basic TCP ping we try the direct IP/host
      const sni = url.searchParams.get('sni');
      if (sni && !host.match(/^[0-9.]+$/)) {
        // If host is an IP, we connect to IP. If not, maybe use SNI.
        // Actually, for TCP ping we need the real routable address.
      }

      return {
        protocol,
        name: decodeURIComponent(url.hash.replace('#', '')) || `Unknown ${protocol}`,
        host: host,
        port: port,
        raw_uri: uri
      };
    }

    return null;
  } catch (e) {
    console.error(`Failed to parse URI: ${uri}`, e);
    return null;
  }
}
