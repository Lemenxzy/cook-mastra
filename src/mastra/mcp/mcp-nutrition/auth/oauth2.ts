// FatSecret OAuth2 Client Credentials Flow
// 符合 https://platform.fatsecret.com/docs/guides/authentication/oauth2 规范

export interface FatSecretOAuth2Config {
  clientId: string;
  clientSecret: string;
  scope?: string; // basic, premier, barcode, localization, nlp, image-recognition
}

export class FatSecretOAuth2 {
  private clientId: string;
  private clientSecret: string;
  private scope: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private readonly tokenUrl = 'https://oauth.fatsecret.com/connect/token';

  constructor(config: FatSecretOAuth2Config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.scope = config.scope || 'premier'; // 默认使用premier scope以支持autocomplete API
  }

  // 获取访问令牌
  private async getAccessToken(): Promise<string> {
    // 检查现有token是否仍然有效
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    try {
      // 按照FatSecret规范构建请求
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`
        },
        body: new URLSearchParams({
          'grant_type': 'client_credentials',
          'scope': this.scope
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OAuth2 token request failed: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const tokenData = await response.json() as { access_token?: string; expires_in?: number };
      
      if (!tokenData.access_token) {
        throw new Error('No access token received from FatSecret');
      }
      
      this.accessToken = tokenData.access_token;
      
      // FatSecret tokens有效期为24小时(86400秒)，提前5分钟过期确保安全
      const expiresIn = tokenData.expires_in || 86400;
      this.tokenExpiry = new Date(Date.now() + (expiresIn - 300) * 1000);

      console.log(`FatSecret OAuth2 token obtained successfully (scope: ${this.scope}, expires in: ${expiresIn}s)`);
      return this.accessToken;
    } catch (error) {
      console.error('Failed to obtain OAuth2 token:', error);
      this.accessToken = null;
      this.tokenExpiry = null;
      throw error;
    }
  }

  // 获取API请求的认证头
  async getAuthHeaders(): Promise<Record<string, string>> {
    const accessToken = await this.getAccessToken();
    
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  // 获取当前token状态
  getTokenInfo(): { hasToken: boolean; expiresAt: Date | null; scope: string } {
    return {
      hasToken: this.accessToken !== null,
      expiresAt: this.tokenExpiry,
      scope: this.scope
    };
  }

  // 检查认证状态
  isAuthenticated(): boolean {
    return this.accessToken !== null && this.tokenExpiry !== null && this.tokenExpiry > new Date();
  }

  // 清除认证信息
  clearAuth(): void {
    this.accessToken = null;
    this.tokenExpiry = null;
  }
}

// 全局OAuth2客户端实例
let oauth2Client: FatSecretOAuth2 | null = null;

export function initializeFatSecretOAuth2(scope?: string): FatSecretOAuth2 {
  if (!oauth2Client) {
    const clientId = process.env.FATSECRET_CLIENT_ID;
    const clientSecret = process.env.FATSECRET_CLIENT_SECRET;
    const envScope = process.env.FATSECRET_SCOPE;

    if (!clientId || !clientSecret) {
      throw new Error(
        'FatSecret OAuth2 credentials not found. Please set:\n' +
        '- FATSECRET_CLIENT_ID\n' +
        '- FATSECRET_CLIENT_SECRET\n' +
        '- FATSECRET_SCOPE (optional: basic, premier, barcode, etc.)'
      );
    }

    // 优先级：参数 > 环境变量 > 默认值
    const finalScope = scope || envScope || 'premier';

    oauth2Client = new FatSecretOAuth2({
      clientId,
      clientSecret,
      scope: finalScope
    });

    console.log(`FatSecret OAuth2 client initialized with scope: ${finalScope}`);
  }

  return oauth2Client;
}

export function getFatSecretOAuth2Client(): FatSecretOAuth2 {
  if (!oauth2Client) {
    throw new Error('OAuth2 client not initialized. Call initializeFatSecretOAuth2() first.');
  }
  return oauth2Client;
}

// 重置客户端（用于测试）
export function resetOAuth2Client(): void {
  if (oauth2Client) {
    oauth2Client.clearAuth();
  }
  oauth2Client = null;
}