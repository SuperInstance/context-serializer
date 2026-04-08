interface ContextData {
  [key: string]: any;
}

interface SerializedContext {
  version: string;
  format: string;
  compressed: boolean;
  data: string;
  timestamp: number;
  checksum: string;
}

interface FormatInfo {
  name: string;
  version: string;
  compression: string[];
  description: string;
}

class ContextSerializer {
  private static VERSION = "1.0.0";
  private static SUPPORTED_FORMATS = ["json", "base64"];
  private static COMPRESSION_METHODS = ["gzip", "deflate"];

  static async serialize(context: ContextData, format: string = "json", compress: boolean = false): Promise<SerializedContext> {
    if (!this.SUPPORTED_FORMATS.includes(format)) {
      throw new Error(`Unsupported format: ${format}`);
    }

    let data: string;
    if (format === "json") {
      data = JSON.stringify(context);
    } else {
      data = btoa(JSON.stringify(context));
    }

    if (compress) {
      const compressed = await this.compressData(data);
      data = btoa(String.fromCharCode(...new Uint8Array(compressed)));
    }

    const checksum = await this.generateChecksum(data);
    
    return {
      version: this.VERSION,
      format,
      compressed: compress,
      data,
      timestamp: Date.now(),
      checksum
    };
  }

  static async deserialize(serialized: SerializedContext): Promise<ContextData> {
    if (serialized.version !== this.VERSION) {
      throw new Error(`Version mismatch: expected ${this.VERSION}, got ${serialized.version}`);
    }

    const checksum = await this.generateChecksum(serialized.data);
    if (checksum !== serialized.checksum) {
      throw new Error("Checksum verification failed");
    }

    let data = serialized.data;
    
    if (serialized.compressed) {
      const compressed = Uint8Array.from(atob(data), c => c.charCodeAt(0));
      data = await this.decompressData(compressed);
    }

    if (serialized.format === "base64") {
      data = atob(data);
    }

    return JSON.parse(data);
  }

  static async compressData(data: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);
    
    const cs = new CompressionStream("gzip");
    const writer = cs.writable.getWriter();
    writer.write(encoded);
    writer.close();
    
    return new Response(cs.readable).arrayBuffer();
  }

  static async decompressData(compressed: Uint8Array): Promise<string> {
    const cs = new DecompressionStream("gzip");
    const writer = cs.writable.getWriter();
    writer.write(compressed);
    writer.close();
    
    const decompressed = await new Response(cs.readable).arrayBuffer();
    const decoder = new TextDecoder();
    return decoder.decode(decompressed);
  }

  static async generateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }

  static getFormats(): FormatInfo[] {
    return [
      {
        name: "json",
        version: this.VERSION,
        compression: this.COMPRESSION_METHODS,
        description: "JSON format with optional compression"
      },
      {
        name: "base64",
        version: this.VERSION,
        compression: this.COMPRESSION_METHODS,
        description: "Base64 encoded JSON with optional compression"
      }
    ];
  }

  static hydrateContext(context: ContextData, additionalData: ContextData): ContextData {
    return {
      ...context,
      ...additionalData,
      _hydrated: true,
      _hydrationTimestamp: Date.now()
    };
  }
}

const htmlResponse = (content: string): Response => {
  return new Response(content, {
    headers: {
      "content-type": "text/html;charset=UTF-8",
      "x-frame-options": "DENY",
      "content-security-policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'"
    }
  });
};

const jsonResponse = (data: any, status: number = 200): Response => {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json;charset=UTF-8",
      "x-frame-options": "DENY",
      "content-security-policy": "default-src 'self'"
    }
  });
};

const renderHome = (): Response => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Context Serializer | Hero Fleet</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
            background: #0a0a0f;
            color: #e5e5e5;
            line-height: 1.6;
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        header {
            text-align: center;
            margin-bottom: 3rem;
            padding-bottom: 2rem;
            border-bottom: 1px solid #1a1a2e;
        }
        h1 {
            font-size: 3rem;
            background: linear-gradient(135deg, #10b981 0%, #0ea5e9 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 1rem;
        }
        .subtitle {
            font-size: 1.2rem;
            color: #94a3b8;
            max-width: 600px;
            margin: 0 auto;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-bottom: 3rem;
        }
        .card {
            background: #1a1a2e;
            border-radius: 12px;
            padding: 2rem;
            border: 1px solid #2d2d4d;
            transition: transform 0.3s ease, border-color 0.3s ease;
        }
        .card:hover {
            transform: translateY(-4px);
            border-color: #10b981;
        }
        .card h2 {
            color: #10b981;
            margin-bottom: 1rem;
            font-size: 1.5rem;
        }
        .card p {
            color: #cbd5e1;
            margin-bottom: 1.5rem;
        }
        .endpoint {
            background: #0f172a;
            padding: 1rem;
            border-radius: 8px;
            font-family: "SF Mono", Monaco, monospace;
            font-size: 0.9rem;
            margin-bottom: 1rem;
            border-left: 4px solid #10b981;
        }
        .method {
            color: #10b981;
            font-weight: bold;
        }
        .path {
            color: #e2e8f0;
        }
        footer {
            text-align: center;
            margin-top: 4rem;
            padding-top: 2rem;
            border-top: 1px solid #1a1a2e;
            color: #64748b;
            font-size: 0.9rem;
        }
        .fleet-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: #1a1a2e;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            margin-top: 1rem;
        }
        .fleet-badge span {
            color: #10b981;
            font-weight: bold;
        }
        .health-status {
            display: inline-block;
            width: 10px;
            height: 10px;
            background: #10b981;
            border-radius: 50%;
            margin-right: 0.5rem;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
    </style>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <div class="container">
        <header>
            <h1>Context Serializer</h1>
            <p class="subtitle">Standardize, compress, and transfer context data between vessels with versioning and hydration support.</p>
        </header>
        
        <div class="grid">
            <div class="card">
                <h2>Serialize Context</h2>
                <p>Convert context data into standardized format with optional compression and versioning.</p>
                <div class="endpoint">
                    <span class="method">POST</span> <span class="path">/api/serialize</span>
                </div>
                <pre style="color: #94a3b8; font-size: 0.9rem;">{
  "context": {...},
  "format": "json",
  "compress": true
}</pre>
            </div>
            
            <div class="card">
                <h2>Deserialize Context</h2>
                <p>Restore serialized context with checksum verification and automatic decompression.</p>
                <div class="endpoint">
                    <span class="method">POST</span> <span class="path">/api/deserialize</span>
                </div>
                <pre style="color: #94a3b8; font-size: 0.9rem;">{
  "version": "1.0.0",
  "format": "json",
  "data": "...",
  "checksum": "..."
}</pre>
            </div>
            
            <div class="card">
                <h2>Available Formats</h2>
                <p>Discover supported serialization formats and compression methods.</p>
                <div class="endpoint">
                    <span class="method">GET</span> <span class="path">/api/formats</span>
                </div>
                <div class="endpoint">
                    <span class="method">GET</span> <span class="path">/health</span>
                </div>
                <p style="margin-top: 1rem;"><span class="health-status"></span> System operational</p>
            </div>
        </div>
        
        <footer>
            <p>Context Serializer v${ContextSerializer.VERSION} | Hero Fleet</p>
            <div class="fleet-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                    <path d="M2 17L12 22L22 17"/>
                    <path d="M2 12L12 17L22 12"/>
                </svg>
                <span>HERO FLEET</span>
            </div>
        </footer>
    </div>
</body>
</html>`;
  return htmlResponse(html);
};

const handleRequest = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/" || path === "/index.html") {
    return renderHome();
  }

  if (path === "/health") {
    return jsonResponse({ status: "ok", timestamp: Date.now(), version: ContextSerializer.VERSION });
  }

  if (path === "/api/formats") {
    return jsonResponse({
      formats: ContextSerializer.getFormats(),
      version: ContextSerializer.VERSION
    });
  }

  if (path === "/api/serialize" && request.method === "POST") {
    try {
      const body = await request.json();
      const { context, format = "json", compress = false } = body;
      
      if (!context || typeof context !== "object") {
        return jsonResponse({ error: "Invalid context data" }, 400);
      }

      const serialized = await ContextSerializer.serialize(context, format, compress);
      return jsonResponse(serialized);
    } catch (error: any) {
      return jsonResponse({ error: error.message }, 400);
    }
  }

  if (path === "/api/deserialize" && request.method === "POST") {
    try {
      const body = await request.json();
      const deserialized = await ContextSerializer.deserialize(body);
      return jsonResponse(deserialized);
    } catch (error: any) {
      return jsonResponse({ error: error.message }, 400);
    }
  }

  return jsonResponse({ error: "Not found" }, 404);
};

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request);
  }
};