var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.tsx
var src_exports = {};
__export(src_exports, {
  TestService: () => TestService,
  default: () => src_default
});
module.exports = __toCommonJS(src_exports);
var import_koishi = require("koishi");
var import_jsx_runtime = require("@satorijs/element/jsx-runtime");
var logger = new import_koishi.Logger("test");
var TestService = class extends import_koishi.Service {
  static {
    __name(this, "TestService");
  }
  static inject = ["database", "sendMessage"];
  _findPlugin(name, parent) {
    if (!parent) return;
    const reg = parent.scope[import_koishi.Loader.kRecord];
    if (!reg) return;
    for (const key of Object.getOwnPropertyNames(reg)) {
      const i1 = key.indexOf("/"), i2 = key.indexOf(":");
      const mkey = key.slice(0, i2 === i1 ? key.length : i2);
      if (mkey === name) return [key, parent, reg[key]?.ctx];
      const res = this._findPlugin(name, reg[key]?.ctx);
      if (res) return res;
    }
  }
  _findPluginC(plugin, parent) {
    if (!parent) return;
    const reg = parent.scope[import_koishi.Loader.kRecord];
    if (!reg) return;
    for (const key of Object.getOwnPropertyNames(reg)) {
      if (reg[key]?.ctx === plugin) return [key, parent, reg[key]?.ctx];
      const res = this._findPluginC(plugin, reg[key]?.ctx);
      if (res) return res;
    }
  }
  findPlugin(plugin) {
    if (typeof plugin === "string") {
      return this._findPlugin(plugin, this.ctx.loader.entry);
    } else {
      return this._findPluginC(plugin, this.ctx.loader.entry);
    }
  }
  constructor(ctx, config) {
    super(ctx, "test", true);
    const selfSendPrefixLength = config.selfSendPrefix?.length;
    ctx.logger.info("Test plugin initializing.");
    ctx.model.extend("user", {
      "test/migrate-onebot": "unsigned"
    });
    ctx.command("ccb").action(({ session }) => {
      return `> ${session.resolve(config.testBool)}`;
    });
    ctx.inject(["mahjong", "mahjong.majsoul"], (ctx2) => {
      ctx2.logger.info("Test plugin initializing mahjong commands.");
      ctx2.platform("lark").command("zhulu").option("cid", "-c <cid:string>", { fallback: 23369782 }).option("teamMaxGame", "-T <teamMaxGame:number>", { fallback: 100 }).option("teamMinGame", "-t <teamMinGame:number>", { fallback: 8 }).option("playerMaxGame", "-P <playerMaxGame:number>", { fallback: 6 }).option("playerMinGame", "-i <playerMinGame:number>", { fallback: 1 }).action(async ({ session, options }) => {
        const teamRank = await ctx2.mahjong.majsoul.execute("fetchContestTeamRank", { unique_id: options.cid }).then((x) => x.rank);
        const playerRank = await ctx2.mahjong.majsoul.execute("fetchContestTeamPlayerRank", { unique_id: options.cid }).then((x) => x.rank);
        if (!teamRank || !playerRank) return "No rank data.";
        teamRank.forEach((team) => {
          team.err = [];
          if (team.data.total_game_count < options.teamMinGame) team.err.push(`总局数不足 ${options.teamMinGame} 局`);
          if (team.data.total_game_count > options.teamMaxGame) team.err.push(`总局数超过 ${options.teamMaxGame} 局`);
          const members = playerRank.filter((p) => p.team_name === team.name);
          if (members.length < team.data.member_count) team.err.push(`参赛选手不足`);
          members.forEach((p) => {
            if (p.data.total_game_count < options.playerMinGame) team.err.push(`选手 ${p.nickname} 总局数不足 ${options.playerMinGame} 局`);
            if (p.data.total_game_count > options.playerMaxGame) team.err.push(`选手 ${p.nickname} 总局数超过 ${options.playerMaxGame} 局`);
          });
        });
        const valids = teamRank.filter((team) => team.err.length === 0);
        valids.sort((a, b) => a.rank - b.rank);
        const linesValid = valids.map((team, i) => `| ${i + 1} | ${team.name} | ${team.data.total_point} | ${team.data.total_game_count} | |`);
        const linesInvalid = teamRank.filter((team) => team.err.length > 0).map((team) => `| - | ${team.name} | ${team.data.total_point} | ${team.data.total_game_count} | ${team.err.join("，")} |`);
        return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("lark:card", { title: "Zhulu scoreboard", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
          "|Rank|Team|Point|GameCount|ErrMsg|",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
          "|-|-|-|-|-|",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
          linesValid.concat(linesInvalid).join("\n")
        ] }) }) });
      });
    });
    ctx.on("before-attach-user", (_, fields) => {
      fields.add("test/migrate-onebot");
    });
    ctx.middleware(async (session, next) => {
      if (session.platform === "chronocat" && session.user && !session.user["test/migrate-onebot"]) {
        const [account] = await ctx.database.get("binding", { platform: "onebot", pid: session.userId });
        if (account) {
          await ctx.database.set("binding", { platform: "chronocat", pid: session.userId }, { aid: account.aid });
          session.user["test/migrate-onebot"] = 1;
        } else {
          session.user["test/migrate-onebot"] = 2;
        }
        await session.user.$update();
      }
      return next();
    });
    ctx.before("command/execute", ({ session, command }) => {
      if (session.elements?.[0]?.type === "at" && session.elements?.[0]?.attrs?.id !== session.selfId) return "";
      if (config.blockChannels.includes(session.cid)) return "";
      if (config.blockCommands.includes(command.name) && session.user?.authority < 4) return "";
    });
    ctx.guild().on("message", (session) => {
      if (config.sids.length && !config.sids.includes(session.sid)) return;
      if (session.userId === session.bot.selfId && selfSendPrefixLength && session.content.slice(0, selfSendPrefixLength) === config.selfSendPrefix) {
        const newSession = session.bot.session(session.event);
        newSession.userId = "@self";
        newSession.content = newSession.content.slice(selfSendPrefixLength);
        session.bot.dispatch(newSession);
      }
    });
    ctx.before("send", (session) => {
      if (config.blockChannels.includes(session.cid)) return true;
      if (config.sids.length && !config.sids.includes(session.sid)) return;
      if (selfSendPrefixLength && session.content.slice(0, selfSendPrefixLength) === config.selfSendPrefix) {
        const newSession = session.bot.session(session.event);
        newSession.userId = "@self";
        newSession.content = newSession.content.slice(selfSendPrefixLength);
        session.bot.dispatch(newSession);
      }
    });
    const forwardToMe = /* @__PURE__ */ __name((session, content) => {
      if (config.sids.length && !config.sids.includes(session.sid)) return;
      for (const { platform, channelId } of config.forwardTargets) {
        if (session.platform === platform && session.channelId === channelId) continue;
        this.ctx.sendMessage({ platform, channelId }, content).catch((e) => logger.error(`Failed to forward message: ${content} but ${e}: ${e?.message}`));
      }
    }, "forwardToMe");
    ctx.private().middleware((session, next) => {
      if (session.userId === session.selfId || config.blockForwardUsers?.includes(session.uid)) return next();
      return next((next2) => {
        forwardToMe(session, (0, import_koishi.h)("", `From ${session.username}(${session.userId})
`, ...session.elements));
      });
    });
    ctx.guild().middleware((session, next) => {
      if (session.userId === session.selfId || config.blockForwardUsers?.includes(session.uid)) return next();
      let flag = false;
      if (session.quote && session.quote.user?.id === session.selfId) flag = true;
      else {
        for (const ele of session.elements) {
          if (ele.type === "at" && ele.attrs.id === session.selfId) {
            flag = true;
            break;
          }
        }
      }
      if (flag) {
        return next((next2) => {
          forwardToMe(session, (0, import_koishi.h)(
            "",
            `From ${session.username}(${session.userId}) from ${session.event.channel?.name || session.event.guild?.name}(${session.channelId || session.guildId}):`,
            ...session.elements
          ));
        });
      } else return next();
    });
    if (config.infoAllSessions === "middleware") {
      ctx.middleware((session, next) => {
        if (config.infoPlatforms.length && !config.infoPlatforms.includes(session.platform)) return next();
        if (config.testMode === "all" || !session.userId) {
          logger.info(session.toJSON());
        }
        return next();
      }, true);
    }
    if (config.infoAllSessions === "message") {
      ctx.on("message", (session) => {
        if (config.infoPlatforms.length && !config.infoPlatforms.includes(session.platform)) return;
        if (config.testMode === "all" || !session.userId) {
          logger.info(session.toJSON());
        }
      }, true);
    }
    ctx.before("send", (session, options) => {
      if (options.session?.messageId) session.elements.unshift((0, import_koishi.h)("passive", { messageId: options.session.messageId }));
    });
    ctx.command("test", { authority: 5 }).action(import_koishi.noop);
    ctx.command("test.image").option("url", "-u <url:string>", { fallback: "https://koishi.chat/logo.png" }).option("mime", "-m <mime:string>", { fallback: "image/png" }).action(async ({ session, options, args }) => {
      return await ctx.http.axios(options.url, { method: "GET", responseType: "arraybuffer" }).then((resp) => Buffer.from(resp.data, "binary")).then((b) => import_koishi.h.image(b, options.mime));
    });
    ctx.command("test.real <arg:number>", { checkUnknown: true, checkArgCount: true }).option("-w", "www").action(({ session, options, args }) => {
      return JSON.stringify({ options, args });
    });
    ctx.command("test.rel").userFields(["locales"]).action(async (argv) => {
      console.log(argv.session.text("general.name"), argv.session.user.locales);
      return import_koishi.h.text("aaaa <Sss>");
    });
    ctx.command("test.reload <plugin:string>").action(async (argv, name) => {
      const [key, , ctx2] = this.findPlugin(name) ?? [];
      if (!key) return "Not found";
      ctx2.scope.update(ctx2.scope.config, true);
      return "Success " + key;
    });
    ctx.command("test.logger <label:string> <level:number>").action(async (argv, label, level) => {
      new import_koishi.Logger(label).level = level;
    });
  }
};
((TestService2) => {
  TestService2.Config = import_koishi.Schema.object({
    sids: import_koishi.Schema.array(String).default([]),
    forwardTargets: import_koishi.Schema.array(import_koishi.Schema.object({
      platform: import_koishi.Schema.string(),
      channelId: import_koishi.Schema.string()
    })).role("table"),
    blockForwardUsers: import_koishi.Schema.array(String).default([]).role("table"),
    selfSendPrefix: import_koishi.Schema.string().default("//"),
    infoAllSessions: import_koishi.Schema.union(["off", "message", "middleware"]).default("off"),
    infoPlatforms: import_koishi.Schema.array(String).default([]).role("table"),
    testMode: import_koishi.Schema.union(["all", "undefined-userid"]).default("all"),
    blockChannels: import_koishi.Schema.array(String).default([]).role("table"),
    whiteChannels: import_koishi.Schema.array(String).default([]).role("table"),
    blockCommands: import_koishi.Schema.array(String).default([]).role("table"),
    secondBot: import_koishi.Schema.string(),
    testBool: import_koishi.Schema.computed(import_koishi.Schema.boolean().default(true)).default(true)
  });
})(TestService || (TestService = {}));
var src_default = TestService;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  TestService
});
