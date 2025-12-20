import { Context, Schema, Service } from 'koishi';
declare module 'koishi' {
    interface Context {
        test: TestService;
    }
    interface User {
        'test/migrate-onebot': number;
    }
}
export declare class TestService extends Service {
    static inject: string[];
    _findPlugin(name: string, parent: Context): [string, Context, Context];
    _findPluginC(plugin: Context, parent: Context): [string, Context, Context];
    findPlugin(plugin: string | Context): [string, Context, Context];
    constructor(ctx: Context, config: TestService.Config);
}
export declare namespace TestService {
    interface ForwardTarget {
        platform: string;
        channelId: string;
    }
    interface Config {
        sids: string[];
        forwardTargets?: ForwardTarget[];
        blockForwardUsers?: string[];
        selfSendPrefix?: string;
        infoAllSessions: 'off' | 'message' | 'middleware';
        infoPlatforms: string[];
        testMode: 'all' | 'undefined-userid';
        blockChannels: string[];
        whiteChannels: string[];
        blockCommands: string[];
        secondBot?: string;
    }
    const Config: Schema<Config>;
}
export default TestService;
