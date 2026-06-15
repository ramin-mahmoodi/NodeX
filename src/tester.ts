import { connect } from 'cloudflare:sockets';

export async function tcpPing(host: string, port: number, timeoutMs: number = 3000): Promise<number> {
  const start = Date.now();
  
  try {
    const socket = connect({ hostname: host, port: port });
    
    // We race the socket connection against a timeout
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        // Just writing some dummy data to ensure the connection is actually established and open
        const writer = socket.writable.getWriter();
        writer.write(new Uint8Array([0x00])).then(() => {
          resolve();
        }).catch(reject);
      }),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
    ]);

    // Cleanup
    socket.close();
    
    return Date.now() - start;
  } catch (error) {
    return -1; // -1 indicates failure
  }
}
