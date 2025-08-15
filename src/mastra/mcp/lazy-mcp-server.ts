import { MCPServer } from '@mastra/mcp';

/**
 * 懒加载MCP服务器代理类
 * 用于解决Cloudflare Workers不允许顶层await的问题
 */
export class LazyMCPServer extends MCPServer {
  private initializePromise: Promise<MCPServer> | null = null;
  private initializedServer: MCPServer | null = null;
  private readonly serverFactory: () => Promise<MCPServer>;

  constructor(serverFactory: () => Promise<MCPServer>, placeholderConfig: any) {
    // 使用占位符配置初始化父类
    super(placeholderConfig);
    this.serverFactory = serverFactory;
  }

  private async ensureInitialized(): Promise<MCPServer> {
    if (this.initializedServer) {
      return this.initializedServer;
    }

    if (!this.initializePromise) {
      this.initializePromise = this.serverFactory();
    }

    this.initializedServer = await this.initializePromise;
    return this.initializedServer;
  }

  // 代理实际存在的方法到服务器实例
  async executeTool(toolId: string, args: any, executionContext?: any): Promise<any> {
    const server = await this.ensureInitialized();
    return server.executeTool(toolId, args, executionContext);
  }

  getToolListInfo(): { tools: { name: string; description?: string; inputSchema: any; outputSchema?: any; toolType?: any }[] } {
    if (this.initializedServer) {
      return this.initializedServer.getToolListInfo();
    }
    return super.getToolListInfo();
  }

  getToolInfo(toolId: string): { name: string; description?: string; inputSchema: any; outputSchema?: any; toolType?: any } | undefined {
    if (this.initializedServer) {
      return this.initializedServer.getToolInfo(toolId);
    }
    return super.getToolInfo(toolId);
  }

  getServerInfo(): any {
    return this.initializedServer?.getServerInfo() || super.getServerInfo();
  }

  getServerDetail(): any {
    return this.initializedServer?.getServerDetail() || super.getServerDetail();
  }

  // 重写tools方法（注意这是一个方法，不是属性）
  tools(): Readonly<Record<string, any>> {
    if (this.initializedServer) {
      return this.initializedServer.tools();
    }
    return super.tools();
  }
}