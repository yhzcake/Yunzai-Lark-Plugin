logger.info(logger.yellow("- 正在加载飞书适配器插件"))

import makeConfig from "../../lib/plugins/config.js"
import * as lark from "@larksuiteoapi/node-sdk"

const { config, configSave } = await makeConfig("Lark", {
  tips: "",
  permission: "master",
  app_id: "",
  app_secret: "",
  encrypt_key: "",
  verification_token: "",
  webhook_path: "/lark/webhook",
  proxy: "",
}, {
  tips: [
    "欢迎使用 TRSS-Yunzai Lark Plugin !",
    "飞书官方机器人适配器",
  ],
})

const adapter = new class LarkAdapter {
  id = "Lark"
  name = "LarkBot"
  version = "v1.0.0"

  async makeMsg(msg, client) {
    if (!Array.isArray(msg))
      msg = [msg]
    
    const content = { msg_type: "text", content: { text: "" } }
    const files = []
    
    for (let i of msg) {
      if (typeof i !== "object")
        i = { type: "text", text: i }
      
      switch (i.type) {
        case "text":
          content.content.text += i.text
          break
        case "image":
          content.msg_type = "image"
          content.content.image_key = await this.uploadImage(i.file, client)
          break
        case "at":
          if (i.qq === "all") {
            content.content.text += `<at user_id="all">@all</at>`
          } else {
            content.content.text += `<at user_id="${i.qq.replace(/^lark_/, "")}"></at>`
          }
          break
        case "reply":
          content.content.text += `[回复：${i.id}]`
          break
        case "video":
          content.msg_type = "video"
          content.content.video_key = await this.uploadVideo(i.file, client)
          break
        case "file":
          content.msg_type = "file"
          content.content.file_key = await this.uploadFile(i.file, client)
          break
        default:
          content.content.text += JSON.stringify(i)
      }
    }
    
    return { content, files }
  }

  async uploadImage(file, client) {
    const fileData = await Bot.fileType({ file })
    const ret = await client.im.file.create({
      data: {
        file_type: "image",
        file_name: fileData.name,
        file: fileData.buffer,
      }
    })
    return ret.data?.file_key
  }

  async uploadVideo(file, client) {
    const fileData = await Bot.fileType({ file })
    const ret = await client.im.file.create({
      data: {
        file_type: "video",
        file_name: fileData.name,
        file: fileData.buffer,
      }
    })
    return ret.data?.file_key
  }

  async uploadFile(file, client) {
    const fileData = await Bot.fileType({ file })
    const ret = await client.im.file.create({
      data: {
        file_type: "file",
        file_name: fileData.name,
        file: fileData.buffer,
      }
    })
    return ret.data?.file_key
  }

  async sendMsg(data, msg) {
    const { content } = await this.makeMsg(msg, data.bot)
    Bot.makeLog("info", `发送消息：[${data.id}] ${JSON.stringify(content)}`, data.self_id)
    
    const ret = await data.bot.im.message.create({
      params: {
        receive_id_type: data.message_type === 'private' ? 'user_id' : 'chat_id',
      },
      data: {
        receive_id: data.id,
        msg_type: content.msg_type,
        content: JSON.stringify(content.content),
      }
    })
    
    return { data: ret, message_id: ret.data?.message_id }
  }

  async sendFriendMsg(data, msg) {
    const friendInfo = await this.getFriendInfo(data)
    data.id = friendInfo.user_id.replace(/^lark_/, "")
    data.message_type = 'private'
    return this.sendMsg(data, msg)
  }

  async getMsg(data, message_id) {
    const ret = await data.bot.im.message.get({
      path: {
        message_id: message_id,
      }
    })
    return this.makeMessageArray(ret)
  }

  async getFriendMsg(data, message_id) {
    data.id = (await this.getFriendInfo(data)).user_id.replace(/^lark_/, "")
    return this.getMsg(data, message_id)
  }

  recallMsg(data, message_id) {
    Bot.makeLog("info", `撤回消息：[${data.id}] ${message_id}`, data.self_id)
    return data.bot.im.message.delete({
      path: {
        message_id: message_id,
      }
    })
  }

  async recallFriendMsg(data, message_id) {
    data.id = (await this.getFriendInfo(data)).user_id.replace(/^lark_/, "")
    return this.recallMsg(data, message_id)
  }

  async getFriendInfo(data) {
    const ret = await data.bot.contact.user.get({
      path: {
        user_id: data.user_id.replace(/^lark_/, "")
      }
    })
    return {
      user_id: `lark_${ret.data?.user?.user_id}`,
      nickname: ret.data?.user?.name,
      avatar: ret.data?.user?.avatar_url,
    }
  }

  getFriendArray(id) {
    const array = []
    if (Bot[id].userCache) {
      for (const [user_id, user] of Bot[id].userCache)
        array.push({
          user_id: `lark_${user_id}`,
          nickname: user.name,
          avatar: user.avatar_url,
        })
    }
    return array
  }

  getFriendList(id) {
    const array = []
    for (const { user_id } of this.getFriendArray(id))
      array.push(user_id)
    return array
  }

  getFriendMap(id) {
    const map = new Map
    for (const i of this.getFriendArray(id))
      map.set(i.user_id, i)
    return map
  }

  getGroupArray(id) {
    const array = []
    if (Bot[id].chatCache) {
      for (const [chat_id, chat] of Bot[id].chatCache)
        array.push({
          group_id: `lark_${chat_id}`,
          group_name: chat.name,
        })
    }
    return array
  }

  getGroupList(id) {
    const array = []
    for (const { group_id } of this.getGroupArray(id))
      array.push(group_id)
    return array
  }

  getGroupMap(id) {
    const map = new Map
    for (const i of this.getGroupArray(id))
      map.set(i.group_id, i)
    return map
  }

  getGroupMemberMap(id) {
    const map = new Map
    for (const i of this.getGroupList(id))
      map.set(i, new Map)
    return map
  }

  pickFriend(id, user_id) {
    if (typeof user_id !== "string")
      user_id = String(user_id)
    const i = {
      ...Bot[id].fl.get(user_id),
      self_id: id,
      bot: Bot[id],
      user_id: user_id.replace(/^lark_/, ""),
    }
    return {
      ...i,
      sendMsg: msg => this.sendFriendMsg(i, msg),
      getMsg: message_id => this.getFriendMsg(i, message_id),
      recallMsg: message_id => this.recallFriendMsg(i, message_id),
      getInfo: () => this.getFriendInfo(i),
      getAvatarUrl: async () => (await this.getFriendInfo(i)).avatar,
    }
  }

  pickMember(id, group_id, user_id) {
    if (typeof group_id !== "string")
      group_id = String(group_id)
    if (typeof user_id !== "string")
      user_id = String(user_id)
    const i = {
      ...Bot[id].fl.get(user_id),
      self_id: id,
      bot: Bot[id],
      group_id: group_id.replace(/^lark_/, ""),
      user_id: user_id.replace(/^lark_/, ""),
    }
    return {
      ...this.pickFriend(id, user_id),
      ...i,
    }
  }

  pickGroup(id, group_id) {
    if (typeof group_id !== "string")
      group_id = String(group_id)
    const i = {
      ...Bot[id].gl.get(group_id),
      self_id: id,
      bot: Bot[id],
      id: group_id.replace(/^lark_/, ""),
    }
    return {
      ...i,
      sendMsg: msg => this.sendMsg(i, msg),
      getMsg: message_id => this.getMsg(i, message_id),
      recallMsg: message_id => this.recallMsg(i, message_id),
      getAvatarUrl: () => i.avatar,
      pickMember: user_id => this.pickMember(id, i.id, user_id),
    }
  }

  makeMessageArray(data) {
    const messageData = data.data || data
    messageData.user_id = `lark_${messageData.sender?.id || messageData.sender_id}`
    messageData.sender = {
      user_id: messageData.user_id,
      nickname: messageData.sender?.name || messageData.sender?.name,
      avatar: messageData.sender?.avatar_url || messageData.sender?.avatar_url,
    }
    messageData.message_id = messageData.message_id || messageData.msg_id

    messageData.message = []
    messageData.raw_message = ""

    const content = typeof messageData.content === 'string' ? JSON.parse(messageData.content) : messageData.content

    if (content?.text) {
      messageData.message.push({ type: "text", text: content.text })
      messageData.raw_message += content.text
    }

    if (content?.mentions) {
      for (const mention of content.mentions) {
        messageData.message.push({ 
          type: "at", 
          qq: `lark_${mention.id}` 
        })
        messageData.raw_message += `[提及：lark_${mention.id}]`
      }
    }

    if (content?.image_key) {
      messageData.message.push({
        type: "image",
        file: content.image_key,
      })
      messageData.raw_message += `[图片：${content.image_key}]`
    }

    if (content?.video_key) {
      messageData.message.push({
        type: "video",
        file: content.video_key,
      })
      messageData.raw_message += `[视频：${content.video_key}]`
    }

    if (content?.file_key) {
      messageData.message.push({
        type: "file",
        file: content.file_key,
      })
      messageData.raw_message += `[文件：${content.file_key}]`
    }

    return messageData
  }

  makeMessage(data) {
    data.post_type = "message"
    data = this.makeMessageArray(data)
    if (data.user_id === data.self_id) return

    const eventData = data.data || data
    if (eventData.chat_type === "group") {
      data.message_type = "group"
      data.group_id = `lark_${eventData.chat_id}`
      data.group_name = eventData.chat_name || data.group_id
      Bot.makeLog("info", `群消息：[${data.group_name}(${data.group_id}), ${data.sender.nickname}(${data.user_id})] ${data.raw_message}`, data.self_id)
    } else {
      data.message_type = "private"
      Bot.makeLog("info", `私聊消息：[${data.sender.nickname}(${data.user_id})] ${data.raw_message}`, data.self_id)
    }

    Bot.em(`${data.post_type}.${data.message_type}`, data)
  }

    async connect(app_id, app_secret) {
    const client = new lark.Client({
      appId: app_id,
      appSecret: app_secret,
      appType: lark.AppType.SelfBuild,
      domain: config.proxy ? config.proxy : lark.Domain.Feishu,
    })

    try {
      // 使用正确的 SDK 方法获取 tenant_access_token 来验证连接
      const result = await client.auth.tenantAccessToken.internal({
        data: {
          app_id: app_id,
          app_secret: app_secret
        }
      })
      Bot.makeLog("info", `飞书API返回: ${JSON.stringify(result)}`, app_id)
      // 飞书 API 返回 code 为 0 表示成功，token 直接在 result 中而不是 result.data
      if (result.code === 0 && result.tenant_access_token) {
        Bot.makeLog("mark", `飞书机器人连接成功`, app_id)
      } else {
        Bot.makeLog("error", `飞书机器人连接失败: ${result.msg || JSON.stringify(result)}`, app_id)
        return false
      }
    } catch (error) {
      Bot.makeLog("error", `飞书机器人连接失败: ${error.message}`, app_id)
      return false
    }

    const id = `lark_${app_id}`
    Bot[id] = client
    Bot[id].adapter = this
    Bot[id].info = { app_id }
    Bot[id].uin = id
    Bot[id].nickname = "LarkBot"
    Bot[id].avatar = ""
    Bot[id].version = {
      id: this.id,
      name: this.name,
      version: this.version,
    }
    Bot[id].stat = { start_time: Date.now() / 1000 }
    Bot[id].userCache = new Map()
    Bot[id].chatCache = new Map()

    Bot[id].pickFriend = user_id => this.pickFriend(id, user_id)
    Bot[id].pickUser = Bot[id].pickFriend

    Bot[id].getFriendArray = () => this.getFriendArray(id)
    Bot[id].getFriendList = () => this.getFriendList(id)
    Bot[id].getFriendMap = () => this.getFriendMap(id)

    Bot[id].pickMember = (group_id, user_id) => this.pickMember(id, group_id, user_id)
    Bot[id].pickGroup = group_id => this.pickGroup(id, group_id)

    Bot[id].getGroupArray = () => this.getGroupArray(id)
    Bot[id].getGroupList = () => this.getGroupList(id)
    Bot[id].getGroupMap = () => this.getGroupMap(id)
    Bot[id].getGroupMemberMap = () => this.getGroupMemberMap(id)

    Object.defineProperty(Bot[id], "fl", { get() { return this.getFriendMap() }})
    Object.defineProperty(Bot[id], "gl", { get() { return this.getGroupMap() }})
    Object.defineProperty(Bot[id], "gml", { get() { return this.getGroupMemberMap() }})

    // 创建事件分发器处理消息事件
    const eventDispatcher = new lark.EventDispatcher({
      verificationToken: config.verification_token,
      encryptKey: config.encrypt_key,
    })

    // 注册消息接收事件
    eventDispatcher.register({
      "im.message.receive_v1": async (data) => {
        Bot.makeLog("info", `收到飞书消息事件: ${JSON.stringify(data)}`, id)
        await this.handleMessage(id, data)
      },
    })

    Bot[id].eventDispatcher = eventDispatcher

    // 启动 webhook 服务器
    this.startWebhookServer(id, eventDispatcher)

    Bot.makeLog("mark", `${this.name}(${this.id}) ${this.version} 已连接`, id)
    Bot.em(`connect.${id}`, { self_id: id })
    return true
  }

  async handleMessage(id, eventData) {
    const { message, sender } = eventData
    if (!message) return

    const data = {
      self_id: id,
      bot: Bot[id],
      post_type: "message",
      message_id: message.message_id,
      user_id: `lark_${sender.sender_id.user_id}`,
      sender: {
        user_id: `lark_${sender.sender_id.user_id}`,
        nickname: sender.sender_id.user_id,
      },
      raw_message: "",
      message: [],
    }

    // 判断是私聊还是群聊
    if (message.chat_type === "group") {
      data.message_type = "group"
      data.group_id = `lark_${message.chat_id}`
    } else {
      data.message_type = "private"
      data.group_id = undefined
    }

    // 解析消息内容
    const content = JSON.parse(message.content)
    if (content.text) {
      data.message.push({ type: "text", text: content.text })
      data.raw_message += content.text
    }

    Bot.makeLog("info", `飞书${data.message_type === "group" ? "群" : "私聊"}消息：[${data.user_id}] ${data.raw_message}`, id)
    Bot.em(`message.${data.message_type}`, data)
  }

  startWebhookServer(id, eventDispatcher) {
    const webhookPath = config.webhook_path || "/lark/webhook"

    // 使用 Yunzai 的 express 服务器
    Bot.express.use(webhookPath, async (req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 405
        res.end("Method Not Allowed")
        return
      }

      try {
        const data = req.body
        Bot.makeLog("debug", `收到飞书 webhook: ${JSON.stringify(data)}`, id)
        
        // 处理 challenge 请求（配置 webhook 时飞书会发送验证请求）
        // 使用 SDK 的 generateChallenge 处理加密数据
        const { isChallenge, challenge } = lark.generateChallenge(data, {
          encryptKey: config.encrypt_key || ""
        })
        
        if (isChallenge) {
          Bot.makeLog("mark", `飞书 webhook 验证成功`, id)
          res.json(challenge)
          return
        }

        // 处理事件
        const result = await eventDispatcher.invoke(data)
        res.json(result || { code: 0 })
      } catch (error) {
        Bot.makeLog("error", `处理飞书 webhook 失败: ${error.message}`, id)
        res.status(500).json({ code: -1, msg: error.message })
      }
    })

    Bot.makeLog("mark", `飞书 webhook 已注册: ${webhookPath}`, id)
  }

  async load() {
    if (config.app_id && config.app_secret) {
      await Bot.sleep(1000, this.connect(config.app_id, config.app_secret))
    }
  }
}

Bot.adapter.push(adapter)

export class LarkPlugin extends plugin {
  constructor() {
    super({
      name: "LarkAdapter",
      dsc: "飞书适配器设置",
      event: "message",
      rule: [
        {
          reg: "^#[Ll][Aa][Rr][Kk]账号$",
          fnc: "List",
          permission: config.permission,
        },
        {
          reg: "^#[Ll][Aa][Rr][Kk]设置.+$",
          fnc: "Config",
          permission: config.permission,
        },
        {
          reg: "^#[Ll][Aa][Rr][Kk](代理|Webhook)",
          fnc: "Proxy",
          permission: config.permission,
        }
      ]
    })
  }

  List() {
    this.reply(`App ID: ${config.app_id}\nWebhook: ${config.webhook_path}`, true)
  }

  async Config() {
    const msg = this.e.msg.replace(/^#[Ll][Aa][Rr][Kk]设置/, "").trim()
    const [key, value] = msg.split(/\s+/)
    
    if (key === "appid") {
      config.app_id = value
      this.reply(`App ID 已设置，重启后生效`, true)
    } else if (key === "secret") {
      config.app_secret = value
      this.reply(`App Secret 已设置，重启后生效`, true)
    } else if (key === "encrypt") {
      config.encrypt_key = value
      this.reply(`Encrypt Key 已设置，重启后生效`, true)
    } else if (key === "verify") {
      config.verification_token = value
      this.reply(`Verification Token 已设置，重启后生效`, true)
    } else {
      this.reply(`未知配置项: ${key}`, true)
      return false
    }
    
    await configSave()
  }

  async Proxy() {
    const msg = this.e.msg.replace(/^#[Ll][Aa][Rr][Kk](代理|Webhook)/, "").trim()
    
    if (this.e.msg.match("代理")) {
      config.proxy = msg
      this.reply(`代理已${msg ? "设置" : "删除"}，重启后生效`, true)
    } else {
      config.webhook_url = msg
      this.reply(`Webhook 已${msg ? "设置" : "删除"}，重启后生效`, true)
    }
    
    await configSave()
  }
}

logger.info(logger.green("- 飞书适配器插件 加载完成"))
