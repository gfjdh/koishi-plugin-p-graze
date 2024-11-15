import { h, Time, Schema, Context } from 'koishi'

export const name = 'graze'

export const usage = `
- **指令：p-graze [tag]**\n
    别名：擦弹\n
    负收益游戏，赌狗不得house（doge）
- **指令：p-list**\n
    别名：p点排行\n
    查看本群成员p点排行\n`;

export const inject = {
  required: ['database'],
  optional: [],
}
export interface Config {
  adminUsers: string[]
  deadline: number
  pageSize: number
  bonus: number
  Offset: number
  outputLogs: boolean
}

export const Config: Schema<Config> = Schema.object({
  adminUsers: Schema.array(Schema.string()),
  deadline: Schema.number().default(1600),
  pageSize: Schema.number().default(10),
  bonus: Schema.number().default(5000),
  Offset: Schema.number().default(0),
  outputLogs: Schema.boolean().default(true)
}).i18n({
  'zh-CN': require('./locales/zh-CN'),
})

function mathRandomInt(a: number, b: number) {
  if (a > b) {      // Swap a and b to ensure a is smaller.
    var c = a; a = b; b = c;
  } return Math.floor(Math.random() * (b - a + 1) + a);
}
async function isTargetIdExists(ctx: Context, USERID: string) {
  //检查数据表中是否有指定id者
  const targetInfo = await ctx.database.get('p_system', { userid: USERID });
  return targetInfo.length == 0;
}
declare module 'koishi' {
  interface Tables { p_system: p_system }
  interface Tables { p_graze: p_graze }
}
export interface p_system {
  id: number
  userid: string
  usersname: string
  p: number
  time: Date
  deadTime: Date
  favorability: number
  ban: string
}
export interface p_graze {
  id: number
  channelid: string
  bullet: number
  p: number
  users: string
}

export async function apply(ctx: Context, cfg: Config) {
  ctx.model.extend('p_system', {
    id: 'unsigned',
    userid: 'string',
    time: 'timestamp',
    usersname: 'string',
    p: 'integer',
    deadTime: 'timestamp',
    favorability: 'integer',
    ban: 'string'
  }, { autoInc: true })

  ctx.model.extend('p_graze', {
    id: 'unsigned',
    channelid: 'string',
    bullet: 'integer',
    p: 'integer',
    users: 'string'
  }, { autoInc: true })

  const logger = ctx.logger("p-graze")
  ctx.i18n.define('zh-CN', require('./locales/zh-CN'))

  ctx.middleware(async (session, next) => {
    const channeldata = await ctx.database.get('p_graze', { channelid:session.channelId });
    const channelUsers = channeldata[0]?.users;
    const notExists = await isTargetIdExists(ctx, session.userId);
    if (String(channelUsers).indexOf(String(session.userId)) == -1 && !notExists)
      await ctx.database.set('p_graze', { channelid:session.channelId },{ users:channelUsers + '-' + session.userId })
    if (channeldata.length == 0 && !notExists)
      await ctx.database.create('p_graze', { channelid:session.channelId , users:session.userId })
    return next();
  })

  ctx.command('p/p-graze').alias('擦弹').action(async ({ session }) => {
    const matchResult = session.channelId.match(new RegExp("private", "g"));
    if (matchResult && matchResult.includes("private"))
      return session.text('.not-group');

    const USERID = session.userId; // 发送者的用户id
    const CHANNELID = session.channelId;

    // 检查该群中的该用户是否签到过
    const notExists = await isTargetIdExists(ctx, USERID);
    if (notExists)
      return session.text('.account-notExists');

    // 获取用户数据
    const usersdata = await ctx.database.get('p_system', { userid: USERID });

    // 检查用户是否被封禁
    if (usersdata[0]?.ban == 'banded') {
      if (cfg.outputLogs) logger.success(USERID + '已封号');
      return session.text('.banded');
    }

    const saving = usersdata[0].p;

    // 检查用户积分是否足够
    if (saving < 1500) return session.text('.no-enough-p');

    let oldDate: string;
    if (usersdata[0]?.deadTime) oldDate = Time.template('yyyy-MM-dd', usersdata[0].deadTime);
    const newDate = Time.template('yyyy-MM-dd', new Date(Date.now() + cfg.Offset * 60 * 1000));

    // 获取群组擦弹数据
    const targetInfo = await ctx.database.get('p_graze', { channelid: CHANNELID });

    // 初始化群组擦弹数据
    if (targetInfo.length == 0 || targetInfo[0]?.p == 0) {
      if (targetInfo[0]?.p == 0)
        await ctx.database.set('p_graze', { channelid: CHANNELID }, { p: 9961 });
      else
        await ctx.database.create('p_graze', { channelid: CHANNELID, p: 9961, bullet: 0 });
      await session.sendQueued(session.text('.init-ok'));
    }

    // 检查用户是否已经擦弹过
    if (!cfg.adminUsers.includes(USERID) && oldDate == newDate) return session.text('.already-dead', [USERID]);

    // 根据用户积分进行封禁处理
    if (usersdata[0]?.ban == 'status2') {
      if (saving <= cfg.deadline)
        await ctx.database.set('p_system', { userid: USERID }, { ban: 'banded' });
      else
        await ctx.database.set('p_system', { userid: USERID }, { ban: 'status1' });
    } else if (usersdata[0]?.ban == 'status1' && saving <= cfg.deadline) {
      await ctx.database.set('p_system', { userid: USERID }, { ban: 'status2' });
    } else if (saving <= cfg.deadline) {
      await ctx.database.set('p_system', { userid: USERID }, { ban: 'status1' });
    }

    // 检查子弹数量并重置
    if (((await ctx.database.get('p_graze', { channelid: CHANNELID }))[0]?.bullet) <= 0) {
      await ctx.database.set('p_graze', { channelid: CHANNELID }, { bullet: 6 });
      await session.sendQueued(session.text('.new-turn'));
    }
    let channelIdData = await ctx.database.get('p_graze', { channelid: CHANNELID });
    const boom = Math.round(1.0 / channelIdData[0]?.bullet * saving)
    const bonus = Math.round((7 - channelIdData[0]?.bullet) / 12.0 * channelIdData[0]?.p)
    if (mathRandomInt(1, channelIdData[0]?.bullet) == 1) {
      await session.sendQueued(session.text('.boom',[USERID, boom]));
      await ctx.database.set('p_graze', { channelid: CHANNELID }, { p: channelIdData[0]?.p + Math.round(boom / 2) })
      await ctx.database.set('p_system', { userid: USERID }, { p: saving - boom })
      await ctx.database.set('p_system', { userid: USERID }, { deadTime: new Date(Date.now() + cfg.Offset * 60 * 1000) })
      await ctx.database.set('p_graze', { channelid: CHANNELID }, { bullet: 0 })
      if (cfg.outputLogs) logger.success(USERID + '擦弹爆炸');
    } else {
      await ctx.database.set('p_graze', { channelid: CHANNELID }, { bullet: channelIdData[0]?.bullet - 1 })
      await session.sendQueued(session.text('.succeed',[USERID, bonus, channelIdData[0]?.bullet - 1]));
      await ctx.database.set('p_graze', { channelid: CHANNELID }, { p: channelIdData[0]?.p - bonus })
      await ctx.database.set('p_system', { userid: USERID }, { p: saving + bonus })
      if (cfg.outputLogs) logger.success(USERID + '擦弹成功');
    }

    channelIdData = await ctx.database.get('p_graze', { channelid: CHANNELID });
    if (1 == channelIdData[0]?.bullet) {
      await ctx.database.set('p_graze', { channelid: CHANNELID }, { p: channelIdData[0]?.p + cfg.bonus })
      await ctx.database.set('p_graze', { channelid: CHANNELID }, { bullet: 0 })
      return session.text('.all-alive',[cfg.bonus]);
    }
  });

  ctx.command('p/p-list [pagesize:number]').alias('p点排行')
  .option('full', '-f')
  .action(async ({ session, options }, pagesize) => {
    let idList = ((await ctx.database.get('p_graze', { channelid: session.channelId }))[0]?.users).split('-');
    let pList = [];
    let rank = [];
    const length = idList.length;
    await session.send(session.text('.please-wait'));

    for (let i = 0; i < length; i++) {
      pList.push((await ctx.database.get('p_system', { userid: idList[i] }))[0]?.p);
    }
    const sortedPList = pList.slice().sort((a, b) => b - a);

    for (let i = 0; i < length; i++) {
      for (let j = 0; j < length; j++){
        const userRecord = await ctx.database.get('p_system', { userid: idList[j] });
        if (userRecord[0].p == sortedPList[i] && !rank.includes(userRecord[0]?.usersname)) {
          if(userRecord[0]?.usersname)
            rank.push(userRecord[0]?.usersname);
          else
            rank.push(userRecord[0]?.userid);
        }
      }
    }

    const rankMessages = rank.map((id, index) => `${index + 1}. ${id}：${sortedPList[index]} P点`);
    const limit = pagesize == null ? cfg.pageSize : Math.min(pagesize, length);
    if(options.full)
      return `本群p点排行：\n${rankMessages.slice(0, length).join('\n')}`;
    return `本群p点排行：\n${rankMessages.slice(0, limit).join('\n')}`;
  });


  ctx.command('p/favorability-list [pagesize:number]').alias('好感排行')
  .option('full', '-f')
  .action(async ({ session, options }, pagesize) => {
    let idList = ((await ctx.database.get('p_graze', { channelid: session.channelId }))[0]?.users).split('-');
    let favorabilityList = [];
    let rank = [];
    const length = idList.length;
    await session.send(session.text('.please-wait'));

    for (let i = 0; i < length; i++) {
      favorabilityList.push((await ctx.database.get('p_system', { userid: idList[i] }))[0]?.favorability);
    }
    const sortedPList = favorabilityList.slice().sort((a, b) => b - a);

    for (let i = 0; i < length; i++) {
      for (let j = 0; j < length; j++){
        const userRecord = await ctx.database.get('p_system', { userid: idList[j] });
        if (userRecord[0]?.favorability == sortedPList[i] && !rank.includes(userRecord[0]?.usersname)) {
          if(userRecord[0]?.usersname)
            rank.push(userRecord[0]?.usersname);
          else
            rank.push(userRecord[0]?.userid);
        }
      }
    }

    const rankMessages = rank.map((id, index) => `${index + 1}. ${id}`);
    const limit = pagesize == null ? cfg.pageSize : Math.min(pagesize, length);
    if(options.full)
      return `本群好感排行：\n${rankMessages.slice(0, length).join('\n')}`;
    return `本群好感排行：\n${rankMessages.slice(0, limit).join('\n')}`;
  });
}
