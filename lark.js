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
    
    // 检查消息中是否包含按钮
    const hasButton = msg.some(i => i && i.type === "button")
    
    // 如果包含按钮，使用交互式卡片承载所有内容
    if (hasButton) {
      return this.makeMixedCard(msg, client)
    }
    
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
          Bot.makeLog("debug", `开始处理图片消息: ${i.file}`, "Lark")
          const imageKey = await this.uploadImage(i.file, client)
          Bot.makeLog("debug", `获取到 image_key: ${imageKey}`, "Lark")
          content.content = { image_key: imageKey }
          Bot.makeLog("debug", `设置后的 content: ${JSON.stringify(content.content)}`, "Lark")
          break
        case "at":
          if (i.qq === "all") {
            content.content.text += `<at user_id="all">@all</at>`
          } else {
            content.content.text += `<at user_id="${i.qq.replace(/^lark_/, "")}"></at>`
          }
          break
        case "reply":
          // 回复消息ID在 sendMsg 中单独处理，不添加到文本内容
          Bot.makeLog("debug", `检测到回复消息ID: ${i.id}，不在文本中显示`, "Lark")
          break
        case "video":
          content.msg_type = "video"
          content.content = { video_key: await this.uploadVideo(i.file, client) }
          break
        case "file":
          content.msg_type = "file"
          content.content = { file_key: await this.uploadFile(i.file, client) }
          break
        case "node":
          // 合并转发消息，使用 post 富文本格式
          Bot.makeLog("debug", `处理 node 消息: ${JSON.stringify(i.data).substring(0, 200)}`, "Lark")
          return this.makeForwardCard(i.data)
        case "raw":
          // 原始消息，直接返回
          return { content: i.data, files }
        default:
          content.content.text += JSON.stringify(i)
      }
    }
    
    return { content, files }
  }

  async makeMixedCard(msg, client) {
    // 创建混合内容卡片（支持文本、图片、按钮等）
    const elements = []
    let textContent = ""
    const buttonRows = []
    
    for (let i of msg) {
      if (typeof i !== "object")
        i = { type: "text", text: i }
      
      switch (i.type) {
        case "text":
          textContent += i.text
          break
        case "at":
          if (i.qq === "all") {
            textContent += `<at user_id="all">@all</at>`
          } else {
            textContent += `<at user_id="${i.qq.replace(/^lark_/, "")}"></at>`
          }
          break
        case "image":
          // 先添加累积的文本
          if (textContent) {
            elements.push({
              tag: "markdown",
              content: textContent
            })
            textContent = ""
          }
          // 上传图片并添加图片元素
          Bot.makeLog("debug", `卡片中处理图片: ${i.file}`, "Lark")
          try {
            const imageKey = await this.uploadImage(i.file, client)
            elements.push({
              tag: "img",
              img_key: imageKey,
              alt: {
                tag: "plain_text",
                content: "图片"
              }
            })
          } catch (error) {
            Bot.makeLog("error", `卡片中图片处理失败: ${error.message}`, "Lark")
            textContent += "[图片加载失败]"
          }
          break
        case "reply":
          // 回复消息ID在 sendMsg 中单独处理
          Bot.makeLog("debug", `卡片中检测到回复消息ID: ${i.id}`, "Lark")
          break
        case "button":
          // 收集按钮，保持原有的行列结构
          if (Array.isArray(i.data)) {
            for (const row of i.data) {
              if (Array.isArray(row)) {
                const buttonRow = []
                for (const btn of row) {
                  if (btn.text && btn.callback) {
                    buttonRow.push({
                      tag: "button",
                      text: {
                        tag: "plain_text",
                        content: btn.text
                      },
                      type: "primary",
                      value: {
                        callback: btn.callback
                      }
                    })
                  }
                }
                if (buttonRow.length > 0) {
                  buttonRows.push(buttonRow)
                }
              }
            }
          }
          break
        default:
          textContent += JSON.stringify(i)
      }
    }
    
    // 添加剩余的文本内容
    if (textContent) {
      elements.push({
        tag: "markdown",
        content: textContent
      })
    }
    
    // 添加按钮组（使用多列布局，每行最多3个按钮）
    if (buttonRows.length > 0) {
      for (const row of buttonRows) {
        if (row.length === 1) {
          // 单个按钮使用 action 标签
          elements.push({
            tag: "action",
            actions: row
          })
        } else {
          // 多个按钮使用 column_set 实现多列布局
          const columns = row.map(btn => ({
            tag: "column",
            width: "auto",
            elements: [{
              tag: "action",
              actions: [btn]
            }]
          }))
          
          elements.push({
            tag: "column_set",
            flex_mode: "none",
            background_style: "default",
            columns: columns
          })
        }
      }
    }
    
    // 使用通用卡片模板
    const cardContent = this.makeCardTemplate({
      title: "消息",
      template: "blue",
      elements: elements,
      showDivider: false
    })
    
    return { 
      content: {
        msg_type: "interactive",
        content: cardContent
      }, 
      files: [] 
    }
  }

  parseNodeMessage(data) {
    let text = ""
    if (Array.isArray(data)) {
      for (const node of data) {
        // node 结构: { message: "..." } 或 { message: [...] }
        if (node.message) {
          if (typeof node.message === "string") {
            text += node.message + "\n"
          } else if (Array.isArray(node.message)) {
            for (const msg of node.message) {
              if (typeof msg === "string") {
                text += msg + "\n"
              } else if (typeof msg === "object" && msg.type === "button" && msg.data) {
                // 按钮数据，添加提示
                text += "[按钮消息，请在飞书客户端查看]\n"
              } else {
                text += JSON.stringify(msg) + "\n"
              }
            }
          }
        }
      }
    }
    Bot.makeLog("debug", `parseNodeMessage 结果: ${text.substring(0, 100)}...`, "Lark")
    return text
  }

  makeForwardCard(nodeData) {
    // 使用通用卡片模板创建合并转发消息
    const elements = []
    
    if (Array.isArray(nodeData)) {
      for (const node of nodeData) {
        if (node.message) {
          let textContent = ""
          
          if (typeof node.message === "string") {
            textContent = node.message
          } else if (Array.isArray(node.message)) {
            const texts = []
            for (const msg of node.message) {
              if (typeof msg === "string") {
                texts.push(msg)
              } else if (typeof msg === "object") {
                if (msg.type === "button" && msg.data) {
                  texts.push("[按钮消息]")
                } else {
                  texts.push(JSON.stringify(msg))
                }
              }
            }
            textContent = texts.join("\n")
          }
          
          if (textContent) {
            elements.push(textContent)
          }
        }
      }
    }

    // 使用通用卡片模板
    const cardContent = this.makeCardTemplate({
      title: "更新内容",
      template: "blue",
      elements: elements
    })

    Bot.makeLog("debug", `makeForwardCard 结果: ${JSON.stringify(cardContent).substring(0, 200)}`, "Lark")
    return { 
      content: {
        msg_type: "interactive",
        content: cardContent
      }, 
      files: [] 
    }
  }

  makeCardTemplate(options) {
    // 通用卡片模板 - 使用飞书 Schema V1 格式（与 SDK 类型定义一致）
    // 参考: node-sdk-main/utils/message-card.ts 中的 defaultCard
    // options: {
    //   title: string,        // 卡片标题
    //   template: string,     // 主题颜色: blue, red, green, orange, grey
    //   elements: array,      // 内容元素数组（字符串或对象）
    //   showDivider: boolean  // 是否显示分割线（默认true）
    // }
    const { 
      title = "消息", 
      template = "blue", 
      elements = [],
      showDivider = true 
    } = options

    // Schema V1 格式（与 SDK 类型定义一致）
    const cardContent = {
      config: {
        wide_screen_mode: true
      },
      header: {
        title: {
          tag: "plain_text",
          content: title
        },
        template: template
      },
      elements: []
    }

    // 处理内容元素
    elements.forEach((element, index) => {
      if (typeof element === "string") {
        // 文本内容使用 markdown
        cardContent.elements.push({
          tag: "markdown",
          content: element
        })
      } else if (typeof element === "object") {
        // 对象类型直接添加（支持自定义元素）
        cardContent.elements.push(element)
      }

      // 添加分割线（除了最后一个元素）
      if (showDivider && index < elements.length - 1) {
        cardContent.elements.push({
          tag: "hr"
        })
      }
    })

    return cardContent
  }

  makeButtonCard(buttonData) {
    // 使用通用卡片模板创建按钮卡片 - Schema V1 格式
    // 参考 SDK 类型定义: InterfaceCardActionElement
    const elements = []

    // 处理按钮数据
    if (Array.isArray(buttonData)) {
      for (const row of buttonData) {
        if (Array.isArray(row)) {
          const actions = []
          for (const btn of row) {
            if (btn.text && btn.callback) {
              // Schema V1: 按钮放在 actions 数组中
              actions.push({
                tag: "button",
                text: {
                  tag: "plain_text",
                  content: btn.text
                },
                type: "primary",
                value: {
                  callback: btn.callback
                }
              })
            }
          }
          // Schema V1: 使用 action 标签包裹按钮
          if (actions.length > 0) {
            elements.push({
              tag: "action",
              actions: actions
            })
          }
        }
      }
    }

    // 使用通用卡片模板
    const cardContent = this.makeCardTemplate({
      title: "操作",
      template: "green",
      elements: elements,
      showDivider: false
    })

    return { 
      content: {
        msg_type: "interactive",
        content: cardContent
      }, 
      files: [] 
    }
  }

  async uploadImage(file, client) {
    const fileData = await Bot.fileType({ file })
    Bot.makeLog("debug", `上传图片: name=${fileData.name}, size=${fileData.buffer?.length}`, "Lark")
    
    // 使用 im.image.create 上传图片（不是 im.file.create）
    const ret = await client.im.image.create({
      data: {
        image_type: "message",
        image: fileData.buffer,
      }
    })
    Bot.makeLog("debug", `上传图片结果: ${JSON.stringify(ret)}`, "Lark")
    // 处理两种可能的返回格式：{image_key: "..."} 或 {data: {image_key: "..."}}
    const imageKey = ret?.image_key || ret?.data?.image_key
    Bot.makeLog("debug", `提取的 image_key: ${imageKey}`, "Lark")
    return imageKey
  }

  async uploadVideo(file, client) {
    const fileData = await Bot.fileType({ file })
    Bot.makeLog("debug", `上传视频: name=${fileData.name}, size=${fileData.buffer?.length}`, "Lark")
    
    // 视频使用 mp4 类型
    const ret = await client.im.file.create({
      data: {
        file_type: "mp4",
        file_name: fileData.name || "video.mp4",
        file: fileData.buffer,
      }
    })
    Bot.makeLog("debug", `上传视频结果: ${JSON.stringify(ret)}`, "Lark")
    // 处理两种可能的返回格式
    const fileKey = ret?.file_key || ret?.data?.file_key
    Bot.makeLog("debug", `提取的 video_key: ${fileKey}`, "Lark")
    return fileKey
  }

  async uploadFile(file, client) {
    const fileData = await Bot.fileType({ file })
    Bot.makeLog("debug", `上传文件: name=${fileData.name}, size=${fileData.buffer?.length}`, "Lark")
    
    // 根据文件扩展名判断类型
    const ext = fileData.name?.split('.').pop()?.toLowerCase()
    let file_type = "stream" // 默认使用 stream
    
    if (ext === 'pdf') file_type = "pdf"
    else if (ext === 'doc' || ext === 'docx') file_type = "doc"
    else if (ext === 'xls' || ext === 'xlsx') file_type = "xls"
    else if (ext === 'ppt' || ext === 'pptx') file_type = "ppt"
    
    const ret = await client.im.file.create({
      data: {
        file_type: file_type,
        file_name: fileData.name || "file",
        file: fileData.buffer,
      }
    })
    Bot.makeLog("debug", `上传文件结果: ${JSON.stringify(ret)}`, "Lark")
    // 处理两种可能的返回格式
    const fileKey = ret?.file_key || ret?.data?.file_key
    Bot.makeLog("debug", `提取的 file_key: ${fileKey}`, "Lark")
    return fileKey
  }

  async sendMsg(data, msg) {
    Bot.makeLog("debug", `sendMsg 开始处理消息`, data.self_id)
    const { content } = await this.makeMsg(msg, data.bot)
    Bot.makeLog("info", `发送消息：[${data.id}] msg_type=${content.msg_type}, content=${JSON.stringify(content.content)}`, data.self_id)
    
    // 检查是否有回复消息
    let replyMessageId = null
    if (Array.isArray(msg)) {
      const replyMsg = msg.find(m => m && m.type === "reply")
      if (replyMsg && replyMsg.id) {
        replyMessageId = replyMsg.id
        Bot.makeLog("debug", `检测到回复消息: ${replyMessageId}`, data.self_id)
      }
    }
    
    // 构建消息数据
    const messageData = {
      receive_id: data.id,
      msg_type: content.msg_type,
    }

    // 根据消息类型设置内容（所有类型的 content 都需要是 JSON 字符串）
    if (content.msg_type === "interactive") {
      // 交互式卡片 - content 是 card 对象
      messageData.content = JSON.stringify(content.content)
    } else if (content.msg_type === "post") {
      // 富文本消息 - content 是 post 对象
      messageData.content = JSON.stringify(content.content)
    } else {
      // 其他类型（text, image, video, file）
      messageData.content = JSON.stringify(content.content)
    }
    
    // 如果有回复消息ID，使用 message.reply 方法
    if (replyMessageId) {
      Bot.makeLog("debug", `使用 reply 方法回复消息: ${replyMessageId}`, data.self_id)
      const ret = await data.bot.im.message.reply({
        path: {
          message_id: replyMessageId
        },
        data: {
          msg_type: content.msg_type,
          content: messageData.content
        }
      })
      return { data: ret, message_id: ret.data?.message_id }
    }
    
    // 普通消息使用 message.create
    const ret = await data.bot.im.message.create({
      params: {
        receive_id_type: data.message_type === 'private' ? 'user_id' : 'chat_id',
      },
      data: messageData
    })
    
    return { data: ret, message_id: ret.data?.message_id }
  }

  async sendFriendMsg(data, msg) {
    // 直接使用 user_id，不需要调用 getFriendInfo（避免权限问题）
    data.id = data.user_id.replace(/^lark_/, "")
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
    // 直接使用 user_id，不需要调用 getFriendInfo（避免权限问题）
    data.id = data.user_id.replace(/^lark_/, "")
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
    // 直接使用 user_id，不需要调用 getFriendInfo（避免权限问题）
    data.id = data.user_id.replace(/^lark_/, "")
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
        try {
          await this.handleMessage(id, data)
        } catch (error) {
          Bot.makeLog("error", `处理飞书消息失败: ${error.message}`, id)
        }
      },
    })

    Bot[id].eventDispatcher = eventDispatcher

    Bot.makeLog("mark", `${this.name}(${this.id}) ${this.version} 已连接`, id)
    Bot.em(`connect.${id}`, { self_id: id })
    return true
  }

  async handleMessage(id, eventData) {
    Bot.makeLog("debug", `handleMessage 收到数据: ${JSON.stringify(eventData)}`, id)
    const { message, sender } = eventData
    if (!message) {
      Bot.makeLog("warn", `handleMessage 没有 message 字段`, id)
      return
    }

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
    
    // 处理回复消息格式：[回复：消息ID]消息内容
    if (content.text) {
      const replyMatch = content.text.match(/^\[回复：([^\]]+)\](.*)$/s)
      if (replyMatch) {
        // 这是回复消息
        const replyMessageId = replyMatch[1]
        const actualText = replyMatch[2].trim()
        
        data.message.push({ type: "reply", id: replyMessageId })
        data.message.push({ type: "text", text: actualText })
        data.raw_message += `[回复：${replyMessageId}]${actualText}`
      } else {
        // 普通文本消息
        data.message.push({ type: "text", text: content.text })
        data.raw_message += content.text
      }
    }

    Bot.makeLog("info", `飞书${data.message_type === "group" ? "群" : "私聊"}消息：[${data.user_id}] ${data.raw_message}`, id)
    Bot.em(`message.${data.message_type}`, data)
  }

  async handleCardAction(id, data) {
    // 处理卡片按钮点击事件
    Bot.makeLog("debug", `handleCardAction 收到数据: ${JSON.stringify(data).substring(0, 500)}`, id)
    
    // 解析 action 数据
    const action = data.action || (data.body && data.body.action)
    if (!action) {
      Bot.makeLog("warn", `卡片动作事件缺少 action 数据`, id)
      return { code: -1, msg: "Missing action data" }
    }

    Bot.makeLog("debug", `卡片动作数据: ${JSON.stringify(action)}`, id)

    // 获取 callback 值
    const callback = action.value && action.value.callback
    if (!callback) {
      Bot.makeLog("warn", `卡片动作缺少 callback 值`, id)
      return { code: -1, msg: "Missing callback value" }
    }

    Bot.makeLog("info", `卡片按钮点击: callback=${callback}`, id)

    // 获取用户信息（可能在根级别、body、event 或 event.operator 中）
    const operator = data.event && data.event.operator
    const openId = data.open_id || (data.body && data.body.open_id) || (data.event && data.event.open_id) || (operator && operator.open_id)
    const userId = data.user_id || (data.body && data.body.user_id) || (data.event && data.event.user_id) || (operator && operator.user_id)
    const chatId = data.chat_id || (data.body && data.body.chat_id) || (data.event && data.event.chat_id) || data.open_chat_id || (data.event && data.event.open_chat_id)
    const chatType = data.chat_type || (data.body && data.body.chat_type) || (data.event && data.event.chat_type) || (chatId ? "group" : "p2p")
    
    Bot.makeLog("debug", `用户信息: openId=${openId}, userId=${userId}, chatId=${chatId}, chatType=${chatType}`, id)
    
    if (!openId && !userId) {
      Bot.makeLog("error", `无法获取用户信息`, id)
      return { code: -1, msg: "Missing user info" }
    }

    // 构造消息数据，模拟用户发送指令
    const eventData = {
      self_id: id,
      user_id: `lark_${userId || openId}`,
      message_type: chatType === "p2p" ? "private" : "group",
      message: [{ type: "text", text: callback }],
      raw_message: callback,
      bot: Bot[id],
    }

    // 如果是群聊，设置群ID
    if (eventData.message_type === "group") {
      eventData.group_id = `lark_${chatId}`
      eventData.group_name = ""
    }

    Bot.makeLog("info", `触发消息事件: ${JSON.stringify(eventData)}`, id)

    // 触发消息事件，让 Yunzai 处理指令
    Bot.em("message", eventData)

    // 返回成功响应给飞书
    return {
      code: 0,
      data: {
        toast: {
          type: "success",
          content: "指令已执行"
        }
      }
    }
  }

  async load() {
    if (config.app_id && config.app_secret) {
      // 立即注册 webhook 路由（必须在 Yunzai 的 catch-all 路由之前）
      // 注意：这里不等待 connect 完成，立即注册路由
      this.registerWebhookRoute(config.app_id)
      // 延迟连接飞书客户端（获取 token 等）
      await Bot.sleep(1000, this.connect(config.app_id, config.app_secret))
    }
  }

  registerWebhookRoute(app_id) {
    const webhookPath = config.webhook_path || "/lark/webhook"
    const id = `lark_${app_id}`

    // 使用 Yunzai 的 express 服务器
    Bot.express.post(webhookPath, async (req, res) => {
      try {
        // 构造符合 SDK 要求的数据格式
        const data = {
          headers: req.headers,
          ...req.body
        }
        Bot.makeLog("info", `收到飞书 webhook: ${JSON.stringify(data)}`, id)

        // 如果没有这个 bot 的连接，返回错误
        if (!Bot[id] || !Bot[id].eventDispatcher) {
          Bot.makeLog("error", `飞书 bot 未连接: ${id}`, id)
          res.status(503).json({ code: -1, msg: "Bot not connected" })
          return
        }

        const eventDispatcher = Bot[id].eventDispatcher

        // 如果有加密，手动解密查看内容（调试用）
        if (data.encrypt && config.encrypt_key) {
          try {
            const { AESCipher } = lark
            const cipher = new AESCipher(config.encrypt_key)
            const decrypted = cipher.decrypt(data.encrypt)
            Bot.makeLog("info", `解密后数据: ${decrypted}`, id)
          } catch (e) {
            Bot.makeLog("error", `解密失败: ${e.message}`, id)
          }
        }

        // 处理 challenge 请求（配置 webhook 时飞书会发送验证请求）
        // 使用 SDK 的 generateChallenge 处理加密数据
        const { isChallenge, challenge } = lark.generateChallenge(data, {
          encryptKey: config.encrypt_key || ""
        })
        Bot.makeLog("info", `generateChallenge 结果: isChallenge=${isChallenge}, challenge=${JSON.stringify(challenge)}`, id)

        if (isChallenge) {
          Bot.makeLog("mark", `飞书 webhook 验证成功`, id)
          res.json(challenge)
          return
        }

        // 如果有加密，先解密数据
        let decryptedData = data
        if (data.encrypt && config.encrypt_key) {
          try {
            const { AESCipher } = lark
            const cipher = new AESCipher(config.encrypt_key)
            const decrypted = cipher.decrypt(data.encrypt)
            Bot.makeLog("info", `解密后数据: ${decrypted}`, id)
            decryptedData = JSON.parse(decrypted)
          } catch (e) {
            Bot.makeLog("error", `解密失败: ${e.message}`, id)
          }
        }

        // 检查是否是卡片按钮点击事件
        // 卡片事件的数据结构包含 action 字段（可能在根级别或 event 对象中）
        const action = decryptedData.action || 
                       (decryptedData.body && decryptedData.body.action) ||
                       (decryptedData.event && decryptedData.event.action)
        if (action) {
          Bot.makeLog("info", `收到飞书卡片动作事件`, id)
          try {
            // 将 action 数据放到根级别，方便 handleCardAction 处理
            const cardData = {
              ...decryptedData,
              ...(decryptedData.event || {}),
              action: action
            }
            const result = await this.handleCardAction(id, cardData)
            Bot.makeLog("info", `卡片动作处理结果: ${JSON.stringify(result)}`, id)
            res.json(result || { code: 0 })
            return
          } catch (error) {
            Bot.makeLog("error", `处理卡片动作失败: ${error.message}`, id)
            res.status(500).json({ code: -1, msg: error.message })
            return
          }
        }

        // 处理普通事件
        // 如果有 encrypt_key，SDK 会自动解密和验证
        // 使用 needCheck: false 跳过额外验证，但 SDK 仍会解密数据
        const result = await eventDispatcher.invoke(data, { needCheck: false })
        Bot.makeLog("info", `事件处理结果: ${JSON.stringify(result)}`, id)
        res.json(result || { code: 0 })
      } catch (error) {
        Bot.makeLog("error", `处理飞书 webhook 失败: ${error.message}`, id)
        res.status(500).json({ code: -1, msg: error.message })
      }
    })

    Bot.makeLog("mark", `飞书 webhook 已注册: POST ${webhookPath}`, id)
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
